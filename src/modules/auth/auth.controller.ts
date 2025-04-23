import { Controller, Get, Req, Res, UseGuards, Param, Query, Post, Delete, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

import { AuthService } from './auth.service';
import { UserService } from '../../domain/user';
import { SteamApiService, GameService } from '../../domain/game';
import { RecommendationService } from '../../domain/recommendations/recommendation.service';
import { FavoritesService } from '../../domain/favorites/favorites.service';
import { SteamUser } from './interfaces/steam-user.interface';

import {
  UserDto,
  GamesResponseDto,
  SteamIdResponseDto,
  RecommendationsDto,
  FavoriteGameDto,
  AddFavoriteDto,
  UserProfileDto,
} from './dto';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private userService: UserService,
    private gameService: GameService,
    private steamApiService: SteamApiService,
    private recommendationService: RecommendationService,
    private favoritesService: FavoritesService,
  ) {}

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  @ApiOperation({ summary: 'Ініціювати авторизацію через Steam' })
  @ApiResponse({ status: 200, description: 'Перенаправлення на Steam' })
  steamLogin() {
    return { message: 'Redirecting to Steam...' };
  }

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  @ApiOperation({ summary: 'Callback після авторизації Steam' })
  @ApiResponse({ status: 200, description: 'JWT-токен у відповіді' })
  async steamAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SteamUser;
    if (!user) throw new Error('User not found after Steam authentication');
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined in configuration');
    const token = jwt.sign(
      { steamId: user.steamId, username: user.username, avatar: user.avatar },
      secret as string,
      { expiresIn: '24h' },
    );
    res.send(`
      <script>
        localStorage.removeItem("viewedSteamId");
        window.location.href = "http://localhost:5173/charts?token=${token}";
      </script>
    `);
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Отримати дані авторизованого користувача' })
  @ApiResponse({ status: 200, description: 'Дані користувача', type: UserDto })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  getUser(@Req() req: Request): UserDto {
    if (!req.user) throw new Error('User not authenticated');
    return {
      id: (req.user as any).id || 0,
      steamId: (req.user as any).steamId,
      username: (req.user as any).username,
      avatar: (req.user as any).avatar,
    };
  }

  @Get('profile/:steamId')
  @ApiOperation({ summary: 'Отримати профіль за Steam ID' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiResponse({ status: 200, description: 'Дані профілю', type: UserDto })
  async getProfile(@Param('steamId') steamId: string): Promise<UserDto> {
    return this.userService.getProfile(steamId);
  }

  @Get('games/:steamId')
  @ApiOperation({ summary: 'Отримати ігри користувача' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiResponse({ status: 200, description: 'Список ігор і статистика', type: GamesResponseDto })
  async getGames(@Param('steamId') steamId: string): Promise<GamesResponseDto> {
    return this.gameService.getGames(steamId);
  }

  @Get('resolve-steamid')
  @ApiOperation({ summary: 'Отримати Steam ID за Vanity URL' })
  @ApiQuery({ name: 'vanityurl', description: 'Vanity URL користувача', example: 'playerone' })
  @ApiResponse({ status: 200, description: 'Steam ID', type: SteamIdResponseDto })
  async resolveSteamId(@Query('vanityurl', ValidationPipe) vanityUrl: string): Promise<SteamIdResponseDto> {
    return this.steamApiService.resolveSteamId(vanityUrl);
  }

  @Get('recommendations/:steamId')
  @ApiOperation({ summary: 'Отримати рекомендації ігор' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiResponse({ status: 200, description: 'Рекомендації', type: RecommendationsDto })
  async getRecommendations(@Param('steamId') steamId: string): Promise<RecommendationsDto> {
    return this.recommendationService.getRecommendations(steamId);
  }

  @Get('favorites/:steamId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Отримати обрані ігри' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiResponse({ status: 200, description: 'Список обраних ігор', type: [FavoriteGameDto] })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  async getFavorites(@Param('steamId') steamId: string): Promise<FavoriteGameDto[]> {
    return this.favoritesService.getFavoriteGames(steamId);
  }

  @Post('favorites/:steamId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Додати гру до обраних' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiBody({ type: AddFavoriteDto })
  @ApiResponse({ status: 201, description: 'Оновлений список обраних', type: [FavoriteGameDto] })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  async addFavorite(
    @Param('steamId') steamId: string,
    @Body(ValidationPipe) body: AddFavoriteDto,
  ): Promise<FavoriteGameDto[]> {
    return this.favoritesService.addFavoriteGame(steamId, body.appid);
  }

  @Delete('favorites/:steamId/:appid')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Видалити гру з обраних' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiParam({ name: 'appid', description: 'ID гри', example: 730 })
  @ApiResponse({ status: 200, description: 'Оновлений список обраних', type: [FavoriteGameDto] })
  @ApiResponse({ status: 401, description: 'Неавторизовано' })
  async removeFavorite(@Param('steamId') steamId: string, @Param('appid') appid: number): Promise<FavoriteGameDto[]> {
    return this.favoritesService.removeFavoriteGame(steamId, appid);
  }

  @Get('user-profile/:steamId')
  @ApiOperation({ summary: 'Отримати повний профіль користувача' })
  @ApiParam({ name: 'steamId', description: 'Steam ID користувача', example: '76561198000000000' })
  @ApiResponse({ status: 200, description: 'Повний профіль', type: UserProfileDto })
  async getUserProfile(@Param('steamId') steamId: string): Promise<UserProfileDto> {
    return this.authService.getUserProfile(steamId);
  }
}