import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { UserService } from '../user/user.service';
import { SteamApiService } from './steam-api.service';
import { Game } from './entities/game.entity';
import { UserGame } from './entities/user-game.entity';
import { GamesResponseDto, GameWithGenreDto, ActivityDto, MultiplayerStatsDto } from '../../modules/auth/dto/game.dto';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game) private gameRepository: Repository<Game>,
    @InjectRepository(UserGame) private userGameRepository: Repository<UserGame>,
    private redisService: RedisService,
    private userService: UserService,
    private steamApiService: SteamApiService,
  ) {}

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getGames(steamId: string): Promise<GamesResponseDto> {
    const cachedKey = `games:${steamId}`;
    const cachedData = await this.redisService.get(cachedKey);
    if (cachedData) {
      console.log(`Cache hit for ${cachedKey}`);
      return JSON.parse(cachedData);
    }

    try {
      const user = await this.userService.findOrCreate(steamId);
      const userGames = await this.userGameRepository.find({
        where: { user: { id: user.id } },
        relations: ['game'],
      });

      const needsUpdate = !userGames.length || userGames.some(ug => {
        const diff = (new Date().getTime() - new Date(ug.updatedAt).getTime()) / (1000 * 60 * 60);
        return diff > 24;
      });

      let ownedGames;
      const ownedGamesCacheKey = `ownedGames:${steamId}`;
      if (needsUpdate) {
        ownedGames = await this.steamApiService.getOwnedGames(steamId);
        console.log('Steam API owned games:', ownedGames);

        const standardGenres = [
          'Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 'Racing', 'MOBA', 'Indie', 'Casual',
          'Massively Multiplayer', 'Puzzle', 'Platformer', 'Shooter', 'Fighting', 'Stealth', 'Survival', 'Horror',
          'Tower Defense', 'Turn-Based', 'Real-Time Strategy', 'Visual Novel', 'Card Game', 'Music', 'Party', 'Education',
        ];

        for (const game of ownedGames) {
          let dbGame = await this.gameRepository.findOne({ where: { appid: game.appid } });
          const playtime = Math.round(game.playtime_forever / 60);
          const playtime_2weeks = game.playtime_2weeks || 0;

          if (!dbGame) {
            const appCacheKey = `app:${game.appid}`;
            let appData = await this.redisService.get(appCacheKey);
            if (!appData) {
              await this.delay(500);
              try {
                const appDetails = await this.steamApiService.getAppDetails(game.appid);
                appData = appDetails;
                await this.redisService.set(appCacheKey, appData ? JSON.stringify(appData) : null, 604800);
              } catch (err) {
                console.error(`Failed to fetch appdetails for ${game.appid}: ${err.message}`);
                appData = null;
              }
            } else if (typeof appData === 'string') {
              try {
                appData = JSON.parse(appData);
              } catch (parseErr) {
                console.error(`Failed to parse cached appData for ${appCacheKey}: ${parseErr.message}`);
                appData = null;
              }
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
              isVerified: true,
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
        await this.redisService.set(ownedGamesCacheKey, JSON.stringify(ownedGames), 3600);
      } else {
        const cachedOwnedGames = await this.redisService.get(ownedGamesCacheKey);
        ownedGames = cachedOwnedGames ? JSON.parse(cachedOwnedGames) : [];
        console.log(`Cache hit for ${ownedGamesCacheKey}`);
      }

      const recentGames = await this.steamApiService.getRecentGames(steamId);
      console.log(`Recent games for ${steamId}:`, recentGames);

      const stats = await this.userGameRepository
        .createQueryBuilder('ug')
        .select('SUM(CASE WHEN g.isMixed THEN ug.playtime ELSE 0 END)', 'mixedTime')
        .addSelect('SUM(CASE WHEN g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'multiplayerTime')
        .addSelect('SUM(CASE WHEN NOT g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'singleplayerTime')
        .innerJoin('ug.game', 'g')
        .where('ug.userId = :userId', { userId: user.id })
        .getRawOne();

      const multiplayerStats: MultiplayerStatsDto = {
        multiplayerTime: Number(stats?.multiplayerTime) || 0,
        singleplayerTime: Number(stats?.singleplayerTime) || 0,
        mixedTime: Number(stats?.mixedTime) || 0,
      };

      const topUserGames = await this.userGameRepository.find({
        where: { user: { id: user.id } },
        relations: ['game'],
        order: { playtime: 'DESC' },
        take: 10,
      });

      const gamesWithGenres: GameWithGenreDto[] = topUserGames.map(ug => ({
        name: ug.game.name,
        playtime: ug.playtime,
        playtime_2weeks: Math.round(ug.playtime_2weeks / 60),
        genre: ug.game.genre,
        isMultiplayer: ug.game.isMultiplayer,
        isMixed: ug.game.isMixed,
      }));

      const totalPlaytime2Weeks = recentGames.reduce((sum, game) => sum + (game.playtime_2weeks || 0), 0);
      console.log('Total playtime 2 weeks:', totalPlaytime2Weeks);

      const activity: ActivityDto = {
        last3Days: Math.round((totalPlaytime2Weeks * (3 / 14)) / 60),
        last2Weeks: Math.round(totalPlaytime2Weeks / 60),
        lastMonth: Math.round((totalPlaytime2Weeks / 60) * 2.14),
      };

      const totalGames = await this.userGameRepository.count({ where: { user: { id: user.id } } });

      const result: GamesResponseDto = {
        games: gamesWithGenres,
        activity,
        totalGames,
        multiplayerStats,
      };

      console.log('Result before caching:', result);
      await this.redisService.set(cachedKey, JSON.stringify(result), 3600);
      console.log(`Cache updated for ${cachedKey}`);

      return result;
    } catch (error) {
      console.error(`Error in getGames for steamId ${steamId}:`, error.message, error.stack);
      throw new Error('Failed to fetch games data');
    }
  }
}