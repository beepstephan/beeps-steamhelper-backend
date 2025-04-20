import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { SteamStrategy } from './steam.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RedisService } from '../../common/redis/redis.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/user/entities/user.entity';
import { Game } from '../../domain/game/entities/game.entity';
import { UserGame } from '../../domain/game/entities/user-game.entity';
import { UserService } from '../../domain/user/user.service';
import { UserRepository } from '../../domain/user/user.repository';
import { SteamApiService } from '../../domain/game/steam-api.service';
import { GameService } from '../../domain/game/game.service';
import { GameRepository } from '../../domain/game/game.repository';
import { RecommendationService } from '../../domain/recommendations/recommendation.service';
import { FavoritesService } from '../../domain/favorites/favorites.service';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'steam' }),
    TypeOrmModule.forFeature([User, Game, UserGame]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SteamStrategy,
    JwtStrategy,
    RedisService,
    UserService,
    UserRepository,
    {
      provide: SteamApiService,
      useFactory: (configService: ConfigService, redisService: RedisService) =>
        new SteamApiService(configService, redisService),
      inject: [ConfigService, RedisService],
    },
    GameService,
    GameRepository,
    RecommendationService,
    FavoritesService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AuthModule {}