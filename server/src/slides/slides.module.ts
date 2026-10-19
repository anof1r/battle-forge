import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { SlideStorageService } from './slide-storage.service';
import { SlidesController } from './slides.controller';

@Module({
  imports: [DataModule],
  controllers: [SlidesController],
  providers: [SlideStorageService],
})
export class SlidesModule {}
