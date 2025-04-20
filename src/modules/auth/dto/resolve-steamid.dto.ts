import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ResolveSteamIdDto {
  @ApiProperty({ description: 'Vanity URL користувача', example: 'playerone' })
  @IsString()
  @IsNotEmpty()
  vanityUrl: string;
}

export class SteamIdResponseDto {
  @ApiProperty({ description: 'Steam ID користувача', example: '76561198000000000' })
  @IsString()
  steamId: string;
}