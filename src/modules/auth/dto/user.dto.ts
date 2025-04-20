import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class UserDto {
    @ApiProperty({ description: 'Унікальний ідентифікатор користувача', example: 1 })
    @IsNumber()
    id: number;
  
  @ApiProperty({ description: 'Steam ID користувача', example: '76561198000000000' })
  @IsString()
  @IsNotEmpty()
  steamId: string;

  @ApiProperty({ description: 'Ім’я користувача', example: 'PlayerOne' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'URL аватара', example: 'https://steamcdn-a.akamaihd.net/...' })
  @IsString()
  avatar: string;
}