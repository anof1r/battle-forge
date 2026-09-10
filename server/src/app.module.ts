import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AvatarsModule } from './avatars/avatars.module';
import { readEnvironment } from './config/environment';
import { DataModule } from './data/data.module';
import { HealthController } from './health/health.controller';
import { Open5eModule } from './open5e/open5e.module';

const environment = readEnvironment();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(environment.mongoUri),
    ServeStaticModule.forRoot(
      {
        rootPath: environment.mediaRoot,
        serveRoot: '/media',
        serveStaticOptions: {
          fallthrough: false,
          immutable: true,
          index: false,
          maxAge: '1y',
        },
      },
      {
        rootPath: environment.staticRoot,
        exclude: ['/api/{*path}', '/media/{*path}'],
      },
    ),
    DataModule,
    AvatarsModule,
    Open5eModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
