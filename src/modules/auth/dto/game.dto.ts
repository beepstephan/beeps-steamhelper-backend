import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsObject } from 'class-validator';

export class GameWithGenreDto {
  @ApiProperty({ description: 'Назва гри', example: 'Counter-Strike 2' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Години гри загалом', example: 120 })
  @IsNumber()
  playtime: number;

  @ApiProperty({ description: 'Години за останні 2 тижні', example: 10 })
  @IsNumber()
  playtime_2weeks: number;

  @ApiProperty({ description: 'Жанр гри', example: 'Shooter' })
  @IsString()
  genre: string;

  @ApiProperty({ description: 'Чи мультиплеєрна гра', example: true })
  @IsBoolean()
  isMultiplayer: boolean;

  @ApiProperty({ description: 'Чи змішана гра', example: false })
  @IsBoolean()
  isMixed: boolean;
}

export class ActivityDto {
  @ApiProperty({ description: 'Години за останні 3 дні', example: 5 })
  @IsNumber()
  last3Days: number;

  @ApiProperty({ description: 'Години за останні 2 тижні', example: 10 })
  @IsNumber()
  last2Weeks: number;

  @ApiProperty({ description: 'Години за останній місяць', example: 20 })
  @IsNumber()
  lastMonth: number;
}

export class MultiplayerStatsDto {
  @ApiProperty({ description: 'Години в мультиплеєрі', example: 100 })
  @IsNumber()
  multiplayerTime: number;

  @ApiProperty({ description: 'Години в синглплеєрі', example: 50 })
  @IsNumber()
  singleplayerTime: number;

  @ApiProperty({ description: 'Години в змішаних іграх', example: 20 })
  @IsNumber()
  mixedTime: number;
}

export class GamesResponseDto {
  @ApiProperty({ description: 'Список ігор', type: [GameWithGenreDto] })
  games: GameWithGenreDto[];

  @ApiProperty({ description: 'Активність користувача', type: ActivityDto })
  @IsObject()
  activity: ActivityDto;

  @ApiProperty({ description: 'Загальна кількість ігор', example: 50 })
  @IsNumber()
  totalGames: number;

  @ApiProperty({ description: 'Статистика мультиплеєру', type: MultiplayerStatsDto })
  @IsObject()
  multiplayerStats: MultiplayerStatsDto;
}