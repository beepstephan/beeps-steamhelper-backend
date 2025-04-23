import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SteamStrategy } from './steam.strategy';
import { JwtStrategy } from './jwt.strategy';

import { RedisService } from '../../common/redis/redis.service';

import { User, UserService, UserRepository} from '../../domain/user';

import { Game, UserGame, SteamApiService, GameService, GameRepository } from '../../domain/game';

import { RecommendationService } from '../../domain/recommendations/recommendation.service';
import { FavoritesService } from '../../domain/favorites/favorites.service';


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