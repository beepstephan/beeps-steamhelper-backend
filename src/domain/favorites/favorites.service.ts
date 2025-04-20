import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { RedisService } from '../../common/redis/redis.service';
import { UserService } from '../user/user.service';
import { RecommendationService } from '../recommendations/recommendation.service';
import { Game } from '../game/entities/game.entity';
import { UserGame } from '../game/entities/user-game.entity';
import { FavoriteGameDto } from '../../modules/auth/dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Game) private gameRepository: Repository<Game>,
    @InjectRepository(UserGame) private userGameRepository: Repository<UserGame>,
    private userService: UserService,
    private redisService: RedisService,
    private recommendationService: RecommendationService,
  ) {}

  async addFavoriteGame(steamId: string, appid: number): Promise<FavoriteGameDto[]> {
    const user = await this.userService.findOrCreate(steamId);
    let game = await this.gameRepository.findOne({ where: { appid } });

    if (!game) {
      const appDetails = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`,
      );
      const gameData = appDetails.data[appid]?.data;
      if (!gameData) throw new Error('Game not found in Steam');

      game = this.gameRepository.create({
        appid,
        name: gameData.name,
        genre: gameData.genres?.[0]?.description || 'Other',
        isMultiplayer: gameData.categories?.some((c: any) => c.id === 1) || false,
        isMixed: gameData.categories?.some((c: any) => c.id === 1 && c.id === 2) || false,
        isVerified: true,
      });
      await this.gameRepository.save(game);
    }

    let userGame = await this.userGameRepository.findOne({
      where: { user: { id: user.id }, game: { id: game.id } },
    });
    if (!userGame) {
      userGame = this.userGameRepository.create({
        user,
        game,
        playtime: 0,
        playtime_2weeks: 0,
        updatedAt: new Date(),
        isFavorite: true,
      });
    } else {
      userGame.isFavorite = true;
    }
    await this.userGameRepository.save(userGame);

    await this.redisService.del(`recommendations:${steamId}`);
    return this.getFavoriteGames(steamId);
  }

  async removeFavoriteGame(steamId: string, appid: number): Promise<FavoriteGameDto[]> {
    const user = await this.userService.findOrCreate(steamId);
    const userGame = await this.userGameRepository.findOne({
      where: { user: { id: user.id }, game: { appid } },
    });
    if (userGame) {
      userGame.isFavorite = false;
      await this.userGameRepository.save(userGame);
    }

    await this.redisService.del(`recommendations:${steamId}`);
    return this.getFavoriteGames(steamId);
  }

  async getFavoriteGames(steamId: string): Promise<FavoriteGameDto[]> {
    const user = await this.userService.findOrCreate(steamId);
    const favorites = await this.userGameRepository.find({
      where: { user: { id: user.id }, isFavorite: true },
      relations: ['game'],
    });

    return favorites.map(f => ({
      appid: f.game.appid ?? null,
      name: f.game.name,
      imageUrl: f.game.appid
        ? `https://steamcdn-a.akamaihd.net/steam/apps/${f.game.appid}/header.jpg`
        : null,
    }));
  }
}