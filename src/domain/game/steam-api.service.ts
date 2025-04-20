import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import axios from 'axios';
import { UserDto } from '../../modules/auth/dto/user.dto';
import { SteamIdResponseDto } from '../../modules/auth/dto/resolve-steamid.dto';

interface SteamProfile {
  steamId: string;
  username: string;
  avatar: string;
}

@Injectable()
export class SteamApiService {
  private readonly STEAM_API_BASE_URL = 'https://api.steampowered.com';
  private readonly STEAM_STORE_API_BASE_URL = 'https://store.steampowered.com';
  private readonly API_DELAY_MS = 500;
  private readonly CACHE_TTL_SECONDS = 3600; 
  private lastRequestTime = 0;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  private async delay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.API_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.API_DELAY_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  async getProfile(steamId: string): Promise<SteamProfile> {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined');
    await this.delay();
    console.log(`Fetching profile for steamId: ${steamId}`);
    try {
      const response = await axios.get(
        `${this.STEAM_API_BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`,
      );
      const player = response.data.response.players[0];
      if (!player) throw new Error('Profile not found');
      return {
        steamId: player.steamid,
        username: player.personaname,
        avatar: player.avatarfull,
      };
    } catch (error) {
      console.error(`Error in getProfile for steamId ${steamId}:`, error.message);
      throw error;
    }
  }

  async getOwnedGames(steamId: string): Promise<any[]> {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined');
    const cacheKey = `owned_games:${steamId}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      console.log(`Returning cached owned games for steamId: ${steamId}`);
      return JSON.parse(cached);
    }

    await this.delay();
    console.log(`Fetching owned games for steamId: ${steamId}`);
    try {
      const response = await axios.get(
        `${this.STEAM_API_BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true`,
      );
      const games = response.data.response.games || [];
      await this.redisService.set(cacheKey, JSON.stringify(games), this.CACHE_TTL_SECONDS);
      return games;
    } catch (error) {
      console.error(`Error in getOwnedGames for steamId ${steamId}:`, error.message);
      throw error;
    }
  }

  async getRecentGames(steamId: string): Promise<any[]> {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined');
    await this.delay();
    console.log(`Fetching recent games for steamId: ${steamId}`);
    try {
      const response = await axios.get(
        `${this.STEAM_API_BASE_URL}/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json`,
      );
      return response.data.response.games || [];
    } catch (error) {
      console.error(`Error in getRecentGames for steamId ${steamId}:`, error.message);
      throw error;
    }
  }

  async getAppDetails(appid: number): Promise<any> {
    const cacheKey = `app_details:${appid}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      console.log(`Returning cached app details for appid: ${appid}`);
      return JSON.parse(cached);
    }

    await this.delay();
    console.log(`Fetching app details for appid: ${appid}`);
    try {
      const response = await axios.get(
        `${this.STEAM_STORE_API_BASE_URL}/api/appdetails?appids=${appid}&l=english`,
      );
      const data = response.data[appid]?.data;
      if (!data) return null;
      const result = {
        success: true,
        name: data.name,
        genres: data.genres || [],
        categories: data.categories || [],
      };
      await this.redisService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL_SECONDS);
      return result;
    } catch (error) {
      console.error(`Error in getAppDetails for appid ${appid}:`, error.message);
      throw error;
    }
  }

  async getAppList(): Promise<any> {
    const cacheKey = 'steam_app_list';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      console.log('Returning cached Steam app list');
      return JSON.parse(cached);
    }

    await this.delay();
    console.log('Fetching Steam app list');
    try {
      const response = await axios.get(`${this.STEAM_API_BASE_URL}/ISteamApps/GetAppList/v2/`);
      const data = response.data;
      await this.redisService.set(cacheKey, JSON.stringify(data), this.CACHE_TTL_SECONDS * 24);
      return data;
    } catch (error) {
      console.error('Error in getAppList:', error.message);
      throw error;
    }
  }

  async resolveSteamId(vanityUrl: string): Promise<SteamIdResponseDto> {
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined');
    await this.delay();
    console.log(`Resolving vanity URL: ${vanityUrl}`);
    try {
      const response = await axios.get(
        `${this.STEAM_API_BASE_URL}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${vanityUrl}`,
      );
      const data = response.data.response;
      if (data.success === 1) return { steamId: data.steamid };
      throw new Error('Vanity URL not found');
    } catch (error) {
      console.error(`Error in resolveSteamId for vanityUrl ${vanityUrl}:`, error.message);
      throw error;
    }
  }
}