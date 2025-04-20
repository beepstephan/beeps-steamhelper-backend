import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { UserGame } from './entities/user-game.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class GameRepository {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(UserGame)
    private userGameRepository: Repository<UserGame>,
  ) {}

  async findGameByAppId(appid: number): Promise<Game | null> {
    return this.gameRepository.findOne({ where: { appid } });
  }

  async createGame(data: {
    appid: number;
    name: string;
    genre: string;
    isMultiplayer: boolean;
    isMixed: boolean;
    isVerified: boolean;
  }): Promise<Game> {
    const game = this.gameRepository.create(data);
    return this.gameRepository.save(game);
  }

  async findUserGames(user: User): Promise<UserGame[]> {
    return this.userGameRepository.find({
      where: { user: { id: user.id } },
      relations: ['game'],
    });
  }

  async createOrUpdateUserGame(user: User, game: Game, playtime: number, playtime_2weeks: number): Promise<UserGame> {
    let userGame = await this.userGameRepository.findOne({
      where: { user: { id: user.id }, game: { id: game.id } },
    });
    if (!userGame) {
      userGame = this.userGameRepository.create({
        user,
        game,
        playtime,
        playtime_2weeks,
        updatedAt: new Date(),
      });
    } else {
      userGame.playtime = playtime;
      userGame.playtime_2weeks = playtime_2weeks;
      userGame.updatedAt = new Date();
    }
    return this.userGameRepository.save(userGame);
  }

  async getMultiplayerStats(user: User): Promise<{
    multiplayerTime: number;
    singleplayerTime: number;
    mixedTime: number;
  }> {
    const stats = await this.userGameRepository
      .createQueryBuilder('ug')
      .select('SUM(CASE WHEN g.isMixed THEN ug.playtime ELSE 0 END)', 'mixedTime')
      .addSelect('SUM(CASE WHEN g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'multiplayerTime')
      .addSelect('SUM(CASE WHEN NOT g.isMultiplayer AND NOT g.isMixed THEN ug.playtime ELSE 0 END)', 'singleplayerTime')
      .innerJoin('ug.game', 'g')
      .where('ug.userId = :userId', { userId: user.id })
      .getRawOne();

    return {
      multiplayerTime: Number(stats?.multiplayerTime) || 0,
      singleplayerTime: Number(stats?.singleplayerTime) || 0,
      mixedTime: Number(stats?.mixedTime) || 0,
    };
  }

  async countUserGames(user: User): Promise<number> {
    return this.userGameRepository.count({ where: { user: { id: user.id } } });
  }
}