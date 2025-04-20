import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNumber, IsObject, IsOptional } from 'class-validator';
import { UserDto } from './user.dto';
import { GameWithGenreDto, ActivityDto, MultiplayerStatsDto } from './game.dto';
import { RecommendedGameDto } from './';

export class FavoriteGenreDto {
  @ApiProperty({ description: 'Жанр гри', example: 'Shooter' })
  @IsString()
  genre: string;

  @ApiProperty({ description: 'Відсоток часу в жанрі', example: 40 })
  @IsNumber()
  percentage: number;
}

export class GamesProfileDto {
  @ApiProperty({ description: 'Загальна кількість ігор', example: 50 })
  @IsNumber()
  totalGames: number;

  @ApiProperty({ description: 'Топ-5 ігор', type: [GameWithGenreDto] })
  @IsArray()
  topGames: GameWithGenreDto[];

  @ApiProperty({ description: 'Активність користувача', type: ActivityDto })
  @IsObject()
  activity: ActivityDto;

  @ApiProperty({ description: 'Статистика мультиплеєру', type: MultiplayerStatsDto })
  @IsObject()
  multiplayerStats: MultiplayerStatsDto;
}

export class UserProfileDto {
  @ApiProperty({ description: 'Профіль користувача', type: UserDto })
  @IsObject()
  profile: UserDto;

  @ApiProperty({ description: 'Дані про ігри', type: GamesProfileDto })
  @IsObject()
  games: GamesProfileDto;

  @ApiProperty({ description: 'Рекомендації', type: [RecommendedGameDto] })
  @IsArray()
  recommendations: RecommendedGameDto[];

  @ApiProperty({ description: 'Улюблені жанри', type: [FavoriteGenreDto] })
  @IsArray()
  favoriteGenres: FavoriteGenreDto[];

  @ApiProperty({ description: 'Настрій користувача', example: 'Активний геймер' })
  @IsString()
  mood: string;
}