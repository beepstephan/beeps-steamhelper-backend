import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class FavoriteGameDto {
  @ApiProperty({ description: 'ID гри', example: 730, nullable: true })
  @IsNumber()
  @IsOptional()
  appid: number | null;

  @ApiProperty({ description: 'Назва гри', example: 'Counter-Strike 2' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'URL зображення', example: 'https://steamcdn-a.akamaihd.net/...' })
  @IsString()
  @IsOptional()
  imageUrl: string | null;
}

export class AddFavoriteDto {
  @ApiProperty({ description: 'ID гри для додавання', example: 730 })
  @IsNumber()
  appid: number;
}