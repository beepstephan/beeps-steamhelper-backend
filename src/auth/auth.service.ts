import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GameWithGenre {
  name: string;
  playtime: number;
  playtime_2weeks: number;
  genre: string;
}

@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {}

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

  async getGames(steamId: string) : Promise<{
    games: GameWithGenre[];
    activity: { last3Days: number; last2Weeks: number; lastMonth: number };
    totalGames: number;
  }>{
    const apiKey = this.configService.get<string>('STEAM_API_KEY');
    if (!apiKey) throw new Error('STEAM_API_KEY is not defined in configuration');
    
    const response = await axios.get(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=true`
    );
    const games = response.data.response.games || [];
    const topGames = games.sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);

    const standardGenres = [
      "Action", "Adventure", "RPG", "Strategy", "Simulation", "Sports", "Racing", "MOBA", "Indie", "Casual",
      "Massively Multiplayer", "Puzzle", "Platformer", "Shooter", "Fighting", "Stealth", "Survival", "Horror",
      "Tower Defense", "Turn-Based", "Real-Time Strategy", "Visual Novel", "Card Game", "Music", "Party", "Education"
    ];

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const gamesWithGenres: GameWithGenre[] = [];

    for (const game of topGames) {
      try {
        const appDetails = await axios.get(
          `https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=english`
        );
        const genres = appDetails.data[game.appid]?.data?.genres?.map(g => g.description) || ['Other'];
        const primaryGenre = standardGenres.includes(genres[0]) ? genres[0] : 'Other';
        gamesWithGenres.push({
          name: game.name,
          playtime: Math.round(game.playtime_forever / 60),
          playtime_2weeks: game.playtime_2weeks ? Math.round(game.playtime_2weeks / 60) : 0,
          genre: primaryGenre,
        });
      } catch (err) {
        console.error(`Failed to fetch genres for ${game.name}: ${err.message}`);
        gamesWithGenres.push({
          name: game.name,
          playtime: Math.round(game.playtime_forever / 60),
          playtime_2weeks: game.playtime_2weeks ? Math.round(game.playtime_2weeks / 60) : 0,
          genre: 'Other',
        });
      }
    }

    const totalPlaytime2Weeks = gamesWithGenres.reduce((sum, game) => sum + (game.playtime_2weeks || 0), 0);
    const totalPlaytimeForever = gamesWithGenres.reduce((sum, game) => sum + game.playtime, 0);
    return {
      games: gamesWithGenres,
      activity: {
        last3Days: Math.round(totalPlaytime2Weeks * 0.214),
        last2Weeks: totalPlaytime2Weeks,
        lastMonth: Math.round(totalPlaytimeForever * 0.033 + totalPlaytime2Weeks),
      },
      totalGames: games.length,
    };
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