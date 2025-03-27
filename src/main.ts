import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigModule } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  ConfigModule.forRoot();
  console.log("JWT_SECRET:", process.env.JWT_SECRET);
  await app.listen(process.env.PORT ?? 4200);
}
bootstrap();
