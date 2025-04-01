import { Controller, Get, Req, Res, UseGuards, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { SteamUser } from './interfaces/steam-user.interface';
import { AuthService } from './auth.service';
import { GameWithGenre } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {}

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  steamLogin() {
    return { message: 'Redirecting to Steam...' };
  }

  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SteamUser;
    if (!user) throw new Error('User not found after Steam authentication');
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined in configuration');
    const token = jwt.sign(
      { steamId: user.steamId, username: user.username, avatar: user.avatar },
      secret as string,
      { expiresIn: '24h' }
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
  getUser(@Req() req: Request) {
    return req.user;
  }

  @Get('profile/:steamId')
  async getProfile(@Param('steamId') steamId: string) {
    return this.authService.getProfile(steamId);
  }

  @Get('games/:steamId')
  async getGames(@Param('steamId') steamId: string): Promise<{
    games: GameWithGenre[];
    activity: { last3Days: number; last2Weeks: number; lastMonth: number };
    totalGames: number;
    multiplayerStats: { multiplayerTime: number; singleplayerTime: number; mixedTime: number };
  }> {
    return this.authService.getGames(steamId);
  }

  @Get('resolve-steamid')
  async resolveSteamId(@Query('vanityurl') vanityUrl: string) {
    if (!vanityUrl) throw new Error('Vanity URL is required');
    return this.authService.resolveSteamId(vanityUrl);
  }
}