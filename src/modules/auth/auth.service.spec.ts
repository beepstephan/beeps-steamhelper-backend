import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../domain/user/user.service';
import { GameService } from '../../domain/game/game.service';
import { RecommendationService } from '../../domain/recommendations/recommendation.service';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let gameService: GameService;
  let recommendationService: RecommendationService;

  const mockUser = {
    id: 1,
    steamId: '123456789',
    username: 'testuser',
    avatar: 'http://avatar.url',
  };

  const mockGamesResponse = {
    games: [
      { name: 'Game1', playtime: 100, playtime_2weeks: 10, genre: 'Action', isMultiplayer: true, isMixed: false },
      { name: 'Game2', playtime: 50, playtime_2weeks: 5, genre: 'RPG', isMultiplayer: false, isMixed: false },
    ],
    activity: { last3Days: 2, last2Weeks: 15, lastMonth: 30 },
    totalGames: 2,
    multiplayerStats: { multiplayerTime: 100, singleplayerTime: 50, mixedTime: 0 },
  };

  const mockRecommendations = {
    games: [
      { appid: 123, name: 'RecommendedGame1', comment: 'Great game for action fans' },
      { appid: 456, name: 'RecommendedGame2', comment: 'Perfect for RPG lovers' },
    ],
    isLimited: false,
    lowPlaytimeGames: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOrCreate: jest.fn(),
            getProfile: jest.fn(),
          },
        },
        {
          provide: GameService,
          useValue: {
            getGames: jest.fn(),
          },
        },
        {
          provide: RecommendationService,
          useValue: {
            getRecommendations: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    gameService = module.get<GameService>(GameService);
    recommendationService = module.get<RecommendationService>(RecommendationService);

    jest.clearAllMocks();
  });

  describe('validateSteamUser', () => {
    it('should validate and return user data', async () => {
      jest.spyOn(userService, 'findOrCreate').mockResolvedValue(mockUser);

      const result = await service.validateSteamUser('123456789');

      expect(userService.findOrCreate).toHaveBeenCalledWith('123456789');
      expect(result).toEqual({
        id: 1,
        steamId: '123456789',
        username: 'testuser',
        avatar: 'http://avatar.url',
      });
    });

    it('should throw an error if user creation fails', async () => {
      jest.spyOn(userService, 'findOrCreate').mockRejectedValue(new Error('User creation failed'));

      await expect(service.validateSteamUser('123456789')).rejects.toThrow('User creation failed');
    });
  });

  describe('getUserProfile', () => {
    it('should return a detailed user profile with games, recommendations, genres, and mood', async () => {
      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponse);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      const result = await service.getUserProfile('123456789');

      expect(userService.getProfile).toHaveBeenCalledWith('123456789');
      expect(gameService.getGames).toHaveBeenCalledWith('123456789');
      expect(recommendationService.getRecommendations).toHaveBeenCalledWith('123456789');

      expect(result).toEqual({
        profile: {
          id: 1,
          steamId: '123456789',
          username: 'testuser',
          avatar: 'http://avatar.url',
        },
        games: {
          totalGames: 2,
          topGames: [
            { name: 'Game1', playtime: 100, playtime_2weeks: 10, genre: 'Action', isMultiplayer: true, isMixed: false },
            { name: 'Game2', playtime: 50, playtime_2weeks: 5, genre: 'RPG', isMultiplayer: false, isMixed: false },
          ],
          activity: { last3Days: 2, last2Weeks: 15, lastMonth: 30 },
          multiplayerStats: { multiplayerTime: 100, singleplayerTime: 50, mixedTime: 0 },
        },
        recommendations: [
          { appid: 123, name: 'RecommendedGame1', comment: 'Great game for action fans' },
          { appid: 456, name: 'RecommendedGame2', comment: 'Perfect for RPG lovers' },
        ],
        favoriteGenres: [
          { genre: 'Action', percentage: 67 },
          { genre: 'RPG', percentage: 33 },
        ],
        mood: 'Легкий відпочинок',
      });
    });

    it('should throw an error if profile fetch fails', async () => {
      jest.spyOn(userService, 'getProfile').mockRejectedValue(new Error('Profile not found'));

      await expect(service.getUserProfile('123456789')).rejects.toThrow('Profile not found');
    });

    it('should throw an error if games fetch fails', async () => {
      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockRejectedValue(new Error('Games fetch failed'));

      await expect(service.getUserProfile('123456789')).rejects.toThrow('Games fetch failed');
    });

    it('should handle zero total playtime gracefully', async () => {
      const mockGamesResponseWithZeroPlaytime = {
        ...mockGamesResponse,
        games: [
          { name: 'Game1', playtime: 0, playtime_2weeks: 0, genre: 'Action', isMultiplayer: true, isMixed: false },
          { name: 'Game2', playtime: 0, playtime_2weeks: 0, genre: 'RPG', isMultiplayer: false, isMixed: false },
        ],
        activity: { last3Days: 0, last2Weeks: 0, lastMonth: 0 },
      };

      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseWithZeroPlaytime);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      const result = await service.getUserProfile('123456789');

      expect(result.favoriteGenres).toEqual([]);
      expect(result.mood).toEqual('Рідкісний гість');
    });

    it('should handle empty games list gracefully', async () => {
      const mockGamesResponseWithEmptyGames = {
        ...mockGamesResponse,
        games: [],
        activity: { last3Days: 0, last2Weeks: 0, lastMonth: 0 },
      };

      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseWithEmptyGames);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      const result = await service.getUserProfile('123456789');

      expect(result.favoriteGenres).toEqual([]);
      expect(result.mood).toEqual('Рідкісний гість');
      expect(result.games.topGames).toEqual([]);
    });

    it('should handle empty recommendations list gracefully', async () => {
      const mockRecommendationsWithEmptyGames = {
        ...mockRecommendations,
        games: [],
      };

      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponse);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendationsWithEmptyGames);

      const result = await service.getUserProfile('123456789');

      expect(result.recommendations).toEqual([]);
    });

    it('should handle different mood values based on recent playtime', async () => {
      const mockGamesResponseActiveGamer = {
        ...mockGamesResponse,
        activity: { last3Days: 10, last2Weeks: 25, lastMonth: 50 },
      };
      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseActiveGamer);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      let result = await service.getUserProfile('123456789');
      expect(result.mood).toEqual('Активний геймер');

      const mockGamesResponseCasual = {
        ...mockGamesResponse,
        activity: { last3Days: 2, last2Weeks: 10, lastMonth: 20 },
      };
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseCasual);

      result = await service.getUserProfile('123456789');
      expect(result.mood).toEqual('Легкий відпочинок');

      const mockGamesResponseRare = {
        ...mockGamesResponse,
        activity: { last3Days: 0, last2Weeks: 3, lastMonth: 6 },
      };
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseRare);

      result = await service.getUserProfile('123456789');
      expect(result.mood).toEqual('Рідкісний гість');
    });

    it('should handle invalid playtime values in games', async () => {
      const mockGamesResponseWithInvalidPlaytime = {
        ...mockGamesResponse,
        games: [
          { name: 'Game1', playtime: -10, playtime_2weeks: 0, genre: 'Action', isMultiplayer: true, isMixed: false },
          { name: 'Game2', playtime: null as any, playtime_2weeks: 0, genre: 'RPG', isMultiplayer: false, isMixed: false },
        ],
      };

      jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);
      jest.spyOn(gameService, 'getGames').mockResolvedValue(mockGamesResponseWithInvalidPlaytime);
      jest.spyOn(recommendationService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      const result = await service.getUserProfile('123456789');

      expect(result.favoriteGenres).toEqual([]);
    });
  });
});