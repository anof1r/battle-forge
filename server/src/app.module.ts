import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { readEnvironment } from './config/environment';
import { DataModule } from './data/data.module';
import { HealthController } from './health/health.controller';

const environment = readEnvironment();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(environment.mongoUri),
    ServeStaticModule.forRoot({
      rootPath: environment.staticRoot,
      exclude: ['/api/{*path}'],
    }),
    DataModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
