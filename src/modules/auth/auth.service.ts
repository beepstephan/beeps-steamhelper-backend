import { Injectable } from '@nestjs/common';
import { UserService } from '../../domain/user/user.service';
import { GameService } from '../../domain/game/game.service';
import { RecommendationService } from '../../domain/recommendations/recommendation.service';
import { UserProfileDto, FavoriteGenreDto, GameWithGenreDto, ActivityDto, MultiplayerStatsDto, RecommendedGameDto, UserDto  } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private gameService: GameService,
    private recommendationService: RecommendationService,
  ) {}

  async validateSteamUser(steamId: string): Promise<UserDto> {
    const user = await this.userService.findOrCreate(steamId);
    return {
      id: user.id,
      steamId: user.steamId,
      username: user.username,
      avatar: user.avatar,
    };
  }

  async getUserProfile(steamId: string): Promise<UserProfileDto> {
    const profile = await this.userService.getProfile(steamId);
    const gamesData = await this.gameService.getGames(steamId);
    const recommendations = await this.recommendationService.getRecommendations(steamId);

    const genreStats: { [key: string]: number } = gamesData.games.reduce(
      (acc: { [key: string]: number }, game) => {
        const playtime = typeof game.playtime === 'number' && game.playtime >= 0 ? game.playtime : 0;
        acc[game.genre] = (acc[game.genre] || 0) + playtime;
        return acc;
      },
      {},
    );
    const totalPlaytime: number = Object.values(genreStats).reduce(
      (sum: number, val: number) => sum + val,
      0,
    );

    const favoriteGenres: FavoriteGenreDto[] = totalPlaytime === 0
      ? []
      : Object.entries(genreStats)
          .map(([genre, time]) => ({
            genre,
            percentage: Math.round((time / totalPlaytime) * 100),
          }))
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 3);

    const recentPlaytime: number = gamesData.activity.last2Weeks;
    const mood: string =
      recentPlaytime > 20 ? 'Активний геймер' : recentPlaytime > 5 ? 'Легкий відпочинок' : 'Рідкісний гість';

    return {
      profile: {
        id: profile.id,
        steamId: profile.steamId,
        username: profile.username,
        avatar: profile.avatar,
      },
      games: {
        totalGames: gamesData.totalGames,
        topGames: gamesData.games.slice(0, 5) as GameWithGenreDto[],
        activity: gamesData.activity as ActivityDto,
        multiplayerStats: gamesData.multiplayerStats as MultiplayerStatsDto,
      },
      recommendations: recommendations.games.slice(0, 3) as RecommendedGameDto[],
      favoriteGenres,
      mood,
    };
  }
}