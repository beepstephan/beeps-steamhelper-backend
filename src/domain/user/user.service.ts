import { Injectable } from '@nestjs/common';
import { SteamApiService } from '../game/steam-api.service';
import { UserRepository } from './user.repository';
import { UserDto } from '../../modules/auth/dto/user.dto';
import { SteamProfile } from './interfaces/steam-profile.interface';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private steamApiService: SteamApiService,
  ) {}

  async findOrCreate(steamId: string): Promise<UserDto> {
    let user = await this.userRepository.findBySteamId(steamId);
    if (!user) {
      const profile: SteamProfile = await this.steamApiService.getProfile(steamId);
      user = await this.userRepository.createUser(steamId, profile.username, profile.avatar);
    }
    return {
      id: user.id,
      steamId: user.steamId,
      username: user.username,
      avatar: user.avatar,
    };
  }

  async getProfile(steamId: string): Promise<UserDto> {
    return this.findOrCreate(steamId);
  }
}