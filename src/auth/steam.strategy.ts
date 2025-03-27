import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(configService: ConfigService) {
    super({
      returnURL: configService.get<string>('STEAM_RETURN_URL') as string,
      realm: configService.get<string>('STEAM_REALM') as string,
      apiKey: configService.get<string>('STEAM_API_KEY') as string,
    });
  }

  async validate(identifier: string, profile: any): Promise<any> {
    const { id, displayName, photos } = profile;
    return { steamId: id, username: displayName, avatar: photos[2].value };
  }
}