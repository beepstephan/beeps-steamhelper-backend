import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { SteamApiService } from '../game/steam-api.service';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { RecommendationsDto, RecommendedGameDto } from '../../modules/auth/dto/recommendation.dto';

@Injectable()
export class RecommendationService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private steamApiService: SteamApiService,
  ) {
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not defined');
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getRecommendations(steamId: string): Promise<RecommendationsDto> {
    const cachedKey = `recommendations:${steamId}`;
    const cached = await this.redisService.get(cachedKey);

    if (cached) {
      const cachedData = JSON.parse(cached);
      const lastUpdated = cachedData.lastUpdated || 0;
      const diff = (new Date().getTime() - lastUpdated) / (1000 * 60 * 60);
      if (diff < 24) {
        console.log('Повертаємо свіжі кешовані рекомендації');
        return cachedData.recommendations;
      }
      console.log('Кеш застарів, генеруємо нові рекомендації');
    }

    const allGames = await this.steamApiService.getOwnedGames(steamId);
    const totalGames = allGames.length;
    const ownedGameNames = new Set(allGames.map(game => game.name.toLowerCase().trim()));
    console.log('Ігри в бібліотеці користувача:', Array.from(ownedGameNames));

    let recommendations: RecommendationsDto = { games: [], isLimited: false, lowPlaytimeGames: [] };

    const lowPlaytimeGames: RecommendedGameDto[] = allGames
      .filter(game => game.playtime_forever < 180)
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(5, allGames.filter(g => g.playtime_forever < 180).length))
      .map(game => ({
        appid: game.appid,
        name: game.name,
        comment: 'Ця гра у тебе недограна — спробуй її!',
      }));
    recommendations.lowPlaytimeGames = lowPlaytimeGames;

    if (totalGames > 300) {
      recommendations.games = lowPlaytimeGames;
      recommendations.isLimited = true;
    } else {
      const prompt = `
        Ось бібліотека користувача Steam (${totalGames} ігор): 
        ${JSON.stringify(allGames.map(g => ({ name: g.name, playtime: Math.round(g.playtime_forever / 60) })))}. 
        Проаналізуй уподобання користувача за жанрами ігор та награними годинами. 
        ПОВЕРНИ ЛИШЕ JSON із 20 унікальними рекомендаціями ігор зі Steam, яких немає у списку вище, 
        в які він не грав (0 годин), і які відповідають його смакам. 
        Уникай популярних ігор типу Hades, Celeste, Stardew Valley, якщо вони не відповідають його основним жанрам. 
        Пропонуй як AAA проєкти, так і інді проєкти, як круті 2D ігри, так і 3D ігри також, 
        в залежності від уподобань користувача (тобто якщо 2D ігор в бібліотеці користувача мало, то не рекомендуй їх).
        Формат: [{"name": "назва гри", "comment": "текст до 15 слів"}].
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.9,
      });

      const rawRecommendations = response.choices[0].message.content;
      console.log('Raw recommendations:', rawRecommendations);
      const parsedRecommendations = rawRecommendations ? this.parseRecommendations(rawRecommendations) : [];

      const enrichedRecommendations = await Promise.all(
        parsedRecommendations.map(async (game) => {
          const appid = await this.getAppIdByName(game.name);
          console.log(`Гра "${game.name}": appid = ${appid}`);
          return { ...game, appid } as RecommendedGameDto;
        }),
      );

      const filteredRecommendations = enrichedRecommendations
        .filter(game => {
          const isInLibrary = ownedGameNames.has(game.name.toLowerCase().trim());
          const hasAppId = game.appid !== null;
          console.log(
            `Фільтрація "${game.name}": в бібліотеці = ${isInLibrary}, має appid = ${hasAppId}`,
          );
          return !isInLibrary && hasAppId;
        });

      console.log('Фінальні рекомендації:', filteredRecommendations);
      recommendations.games = filteredRecommendations;
      recommendations.isLimited = false;
    }

    const cachedData = {
      recommendations,
      lastUpdated: new Date().getTime(),
    };
    await this.redisService.set(cachedKey, JSON.stringify(cachedData), 3600);
    return recommendations;
  }

  async getAppIdByName(gameName: string): Promise<number | null> {
    const cacheKey = `appid:${gameName.toLowerCase()}`;
    const cachedAppId = await this.redisService.get(cacheKey);
    if (cachedAppId !== null) return Number(cachedAppId);

    try {
      const response = await this.steamApiService.getAppList();
      if (!response || !response.applist || !response.applist.apps) {
        console.error(`Failed to fetch app list for ${gameName}`);
        await this.redisService.set(cacheKey, null, 86400);
        return null;
      }

      const appList = response.applist.apps;

      const normalizedGameName = gameName
        .toLowerCase()
        .replace(/[^a-z0-9: ]/g, '')
        .trim();

      console.log(`Нормалізована назва для пошуку: "${normalizedGameName}"`);

      const exactMatch = appList.find(app => {
        const normalizedAppName = app.name
          .toLowerCase()
          .replace(/[^a-z0-9: ]/g, '')
          .trim();
        return normalizedAppName === normalizedGameName;
      });

      if (exactMatch) {
        console.log(`Точний збіг для "${gameName}": "${exactMatch.name}" (appid: ${exactMatch.appid})`);
        await this.redisService.set(cacheKey, exactMatch.appid, 604800);
        return exactMatch.appid;
      }

      console.warn(`Гра "${gameName}" не знайдена в Steam (немає точного збігу після нормалізації)`);
      await this.redisService.set(cacheKey, null, 86400);
      return null;
    } catch (err) {
      console.error(`Помилка пошуку appid для ${gameName}: ${err.message}`);
      await this.redisService.set(cacheKey, null, 86400);
      return null;
    }
  }

  private parseRecommendations(rawText: string | null): { name: string; comment: string }[] {
    if (!rawText) {
      console.error('Raw recommendations is null or empty');
      return [];
    }

    try {
      const cleanedText = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      console.log('Cleaned text:', cleanedText);

      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(r => typeof r.name === 'string' && typeof r.comment === 'string')
          .slice(0, 10);
      }
      throw new Error('Response is not an array');
    } catch (err) {
      console.error('Failed to parse:', err.message, 'Raw:', rawText);
      return [];
    }
  }
}