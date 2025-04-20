import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsString, IsOptional } from 'class-validator';

export class RecommendedGameDto {
  @ApiProperty({ description: 'ID гри', example: 730, nullable: true })
  @IsNumber()
  @IsOptional()
  appid: number | null;

  @ApiProperty({ description: 'Назва гри', example: 'Counter-Strike 2' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Коментар до рекомендації', example: 'Ця гра у тебе недограна!' })
  @IsString()
  comment: string;
}

export class RecommendationsDto {
  @ApiProperty({ description: 'Список рекомендованих ігор', type: [RecommendedGameDto] })
  @IsArray()
  games: RecommendedGameDto[];

  @ApiProperty({ description: 'Чи обмежені рекомендації?', example: false })
  @IsBoolean()
  isLimited: boolean;

  @ApiProperty({ description: 'Ігри з низьким часом гри', type: [RecommendedGameDto], nullable: true })
  @IsArray()
  @IsOptional()
  lowPlaytimeGames: RecommendedGameDto[] | null;
}