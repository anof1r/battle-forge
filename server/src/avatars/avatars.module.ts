import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { AvatarStorageService } from './avatar-storage.service';
import { AvatarsController } from './avatars.controller';

@Module({
  imports: [DataModule],
  controllers: [AvatarsController],
  providers: [AvatarStorageService],
})
export class AvatarsModule {}