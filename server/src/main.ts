import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { readEnvironment } from './config/environment';

async function bootstrap(): Promise<void> {
  const environment = readEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '5mb' });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(environment.port, '0.0.0.0');
  Logger.log(`Battle Forge is available on port ${environment.port}.`, 'Bootstrap');
}

void bootstrap();
