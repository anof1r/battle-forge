import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { DataGateway } from '../data/data.gateway';
import { DataStoreService } from '../data/data-store.service';
import {
  PRESENTATION_PATH,
  SLIDES_PATH,
  SlideMedia,
  SlideRecord,
  SlideUploadResponse,
} from './slide.model';
import { SlideStorageService } from './slide-storage.service';
import { UploadSlideDto } from './slides.dto';

const MAX_SLIDE_BYTES = 25 * 1024 * 1024;
const SLIDE_ID = /^[0-9a-f-]+$/i;

@Controller('api/slides')
export class SlidesController {
  constructor(
    private readonly storage: SlideStorageService,
    private readonly store: DataStoreService,
    private readonly gateway: DataGateway,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: MAX_SLIDE_BYTES } }))
  async upload(
    @Body() body: UploadSlideDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_SLIDE_BYTES })
        .addFileTypeValidator({ fileType: /^image\// })
        .build(),
    )
    file: Express.Multer.File,
  ): Promise<SlideUploadResponse> {
    const media = await this.storage.save(file.buffer);
    const now = Date.now();
    const id = randomUUID();
    const slide: SlideRecord = {
      id,
      name: body.name.trim(),
      sectionId: body.sectionId.trim(),
      order: this.nextOrder(await this.readSlides()),
      media,
      createdAt: now,
      lastUpdated: now,
    };

    try {
      await this.store.set(this.slidePath(id), slide);
      await this.gateway.publishRelated(SLIDES_PATH);
    } catch (error) {
      await this.storage.remove(media);
      throw error;
    }
    return { slide };
  }

  @Delete(':slideId')
  async remove(@Param('slideId') slideId: string): Promise<{ success: true }> {
    if (!SLIDE_ID.test(slideId)) throw new BadRequestException('Invalid slide identifier.');

    const slides = await this.readSlides();
    const index = slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) throw new NotFoundException('Slide was not found.');

    const removed = slides[index];
    const remaining = slides.filter((slide) => slide.id !== slideId);
    await this.store.remove(this.slidePath(slideId));
    await this.gateway.publishRelated(SLIDES_PATH);
    await this.releasePresentation(slideId, remaining[Math.min(index, remaining.length - 1)]);
    await this.storage.remove(removed.media);
    return { success: true };
  }

  private async releasePresentation(
    removedId: string,
    replacement: SlideRecord | undefined,
  ): Promise<void> {
    const presentation = await this.store.get(PRESENTATION_PATH);
    if (!this.isRecord(presentation) || presentation['activeSlideId'] !== removedId) return;

    await this.store.update(PRESENTATION_PATH, {
      activeSlideId: replacement?.id ?? null,
      ...(replacement ? {} : { mode: 'battle' }),
      lastUpdated: Date.now(),
    });
    await this.gateway.publishRelated(PRESENTATION_PATH);
  }

  private async readSlides(): Promise<SlideRecord[]> {
    const records = await this.store.get(SLIDES_PATH);
    if (!this.isRecord(records)) return [];
    return Object.entries(records)
      .filter((entry): entry is [string, Record<string, unknown>] => this.isRecord(entry[1]))
      .map(([id, record]) => ({
        id,
        order: Number.isFinite(record['order']) ? Number(record['order']) : 0,
        media: this.media(record['media']),
      }) as SlideRecord)
      .sort((left, right) => left.order - right.order);
  }

  private nextOrder(slides: readonly SlideRecord[]): number {
    return slides.reduce((highest, slide) => Math.max(highest, slide.order), -1) + 1;
  }

  private media(value: unknown): SlideMedia | null {
    if (!this.isRecord(value)) return null;
    return typeof value['key'] === 'string' && typeof value['version'] === 'number'
      ? { key: value['key'], version: value['version'] }
      : null;
  }

  private slidePath(id: string): string {
    return `${SLIDES_PATH}/${id}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
