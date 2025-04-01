import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { RedisService } from 'src/common/redis/redis.service';
import { User } from './entities/user.entity';
import { Game } from './entities/game.entity';
import { UserGame } from './entities/user-game.entity';

export interface GameWithGenre {
  name: string;
  playtime: number;
  playtime_2weeks: number;
  genre: string;
  isMultiplayer: boolean;
  isMixed: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Game) private gameRepository: Repository<Game>,
    @InjectRepository(UserGame) private userGameRepository: Repository<UserGame>,
  ) {}

  async getProfile(steamId: string) {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined in configuration');
    const response = await axios.get(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
    );
    const player = response.data.response.players[0];
    if (!player) throw new Error('Profile not found');
    return {
      steamId: player.steamid,
      username: player.personaname,
      avatar: player.avatarfull,
    };
  }

  async getGames(steamId: string): Promise<{
    games: GameWithGenre[];
    activity: { last3Days: number; last2Weeks: number; lastMonth: number };
    totalGames: number;
    multiplayerStats: { multiplayerTime: number; singleplayerTime: number; mixedTime: number };
  }> {
    const cachedKey = `games:${steamId}`;
    const cached = await this.redisService.get(cachedKey);
    if (cached) {
      console.log(`Cache hit for ${cachedKey}`);
      return cached;
    }
    console.log(`Cache miss for ${cachedKey}`);
  
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined in configuration');
  
    let user = await this.userRepository.findOne({ where: { steamId } });
    if (!user) {
      const profile = await this.getProfile(steamId);
      user = this.userRepository.create({ steamId, username: profile.username, avatar: profile.avatar });
      await this.userRepository.save(user);
    }
  
    const userGames = await this.userGameRepository.find({
      where: { user: { id: user.id } },
      relations: ['game'],
    });
    const needsUpdate = !userGames.length || userGames.some(ug => {
      const diff = (new Date().getTime() - new Date(ug.updatedAt).getTime()) / (1000 * 60 * 60);
      return diff > 24;
    });
  
    interface SteamGame {
      appid: number;
      name: string;
      playtime_forever: number;
      playtime_2weeks?: number;
    }
  
    let allGames: SteamGame[] = [];
    if (needsUpdate) {
      const response = await axios.get(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true`
      );
      allGames = response.data.response.games || [];
  
      const standardGenres = [
        'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 'Racing', 'MOBA', 'Indie', 'Casual',
        'Massively Multiplayer', 'Puzzle', 'Platformer', 'Shooter', 'Fighting', 'Stealth', 'Survival', 'Horror',
        'Tower Defense', 'Turn-Based', 'Real-Time Strategy', 'Visual Novel', 'Card Game', 'Music', 'Party', 'Education',
      ];
  
      for (const game of allGames) {
        let dbGame = await this.gameRepository.findOne({ where: { appid: game.appid } });
        const playtime = Math.round(game.playtime_forever / 60);
        const playtime_2weeks = game.playtime_2weeks ? Math.round(game.playtime_2weeks / 60) : 0;
  
        if (!dbGame) {
          const appCacheKey = `app:${game.appid}`;
          let appData = await this.redisService.get(appCacheKey);
          if (!appData) {
            const appDetails = await axios.get(
              `https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=english`
            );
            appData = appDetails.data[game.appid]?.data;
            await this.redisService.set(appCacheKey, appData, 604800);
          }
  
          const genres = appData?.genres?.map((g: any) => g.description) || ['Other'];
          const primaryGenre = standardGenres.includes(genres[0]) ? genres[0] : 'Other';
          const categories = appData?.categories || [];
          const isMultiplayer = categories.some((c: any) => c.id === 1);
          const isMixed = isMultiplayer && categories.some((c: any) => c.id === 2);
  
          dbGame = this.gameRepository.create({
            appid: game.appid,
            name: game.name,
            genre: primaryGenre,
            isMultiplayer,
            isMixed,
          });
          await this.gameRepository.save(dbGame);
        }
  
        let userGame = await this.userGameRepository.findOne({
          where: { user: { id: user.id }, game: { id: dbGame.id } },
        });
        if (!userGame) {
          userGame = this.userGameRepository.create({
            user,
            game: dbGame,
            playtime,
            playtime_2weeks,
            updatedAt: new Date(),
          });
        } else {
          userGame.playtime = playtime;
          userGame.playtime_2weeks = playtime_2weeks;
          userGame.updatedAt = new Date();
        }
        await this.userGameRepository.save(userGame);
      }
    }
  
    const stats = await this.userGameRepository
      .createQueryBuilder('ug')
      .select('SUM(CASE WHEN g.isMixed THEN ug.playtime ELSE 0 END)', 'mixedTime')
      .addSelect('SUM(CASE WHEN g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'multiplayerTime')
      .addSelect('SUM(CASE WHEN NOT g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'singleplayerTime')
      .innerJoin('ug.game', 'g')
      .where('ug.userId = :userId', { userId: user.id })
      .getRawOne();
  
    const multiplayerStats = {
      multiplayerTime: Number(stats.multiplayerTime) || 0,
      singleplayerTime: Number(stats.singleplayerTime) || 0,
      mixedTime: Number(stats.mixedTime) || 0,
    };
  
    const topUserGames = await this.userGameRepository.find({
      where: { user: { id: user.id } },
      relations: ['game'],
      order: { playtime: 'DESC' },
      take: 10,
    });
  
    const gamesWithGenres: GameWithGenre[] = topUserGames.map(ug => ({
      name: ug.game.name,
      playtime: ug.playtime,
      playtime_2weeks: ug.playtime_2weeks,
      genre: ug.game.genre,
      isMultiplayer: ug.game.isMultiplayer,
      isMixed: ug.game.isMixed,
    }));
  
    const totalPlaytime2Weeks = needsUpdate
      ? allGames.reduce((sum, game) => sum + (game.playtime_2weeks || 0), 0)
      : topUserGames.reduce((sum, ug) => sum + ug.playtime_2weeks, 0);
  
    const activity = {
      last3Days: Math.round((totalPlaytime2Weeks * (3 / 14)) / 60),
      last2Weeks: Math.round(totalPlaytime2Weeks / 60),
      lastMonth: Math.round((totalPlaytime2Weeks / 60) * 2.14),
    };
  
    const totalGames = await this.userGameRepository.count({ where: { user: { id: user.id } } });
  
    const result = {
      games: gamesWithGenres,
      activity,
      totalGames,
      multiplayerStats,
    };
  
    await this.redisService.set(cachedKey, result, 3600);
    return result;
  }

  async resolveSteamId(vanityUrl: string) {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined in configuration');
    const response = await axios.get(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${vanityUrl}`
    );
    const data = response.data.response;
    if (data.success === 1) return { steamId: data.steamid };
    throw new Error('Vanity URL not found');
  }
}