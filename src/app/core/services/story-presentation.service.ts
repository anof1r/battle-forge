import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  DATA_ROOT,
  PRESENTATION_STATE_PATH,
} from '../constants/data-paths.constants';
import {
  STORY_MEDIA_ENDPOINT,
  STORY_SLIDE_MEDIA_KEY,
  STORY_SLIDES_ENDPOINT,
} from '../constants/story-presentation.constants';
import {
  DisplayPresentationMode,
  StoryPresentationState,
  StorySlide,
  StorySlideMedia,
  StorySlideRecord,
  StorySlideUploadResponse,
  StorySlideUploadResult,
} from '../models/story-presentation.model';
import { storySectionIdFromFileName } from '../utils/story-script.util';
import { LoggerService } from './logger.service';
import { RealtimeDataService } from './realtime-data.service';

export function buildStorySlideUrl(media: StorySlideMedia | null | undefined): string | null {
  if (!media || !STORY_SLIDE_MEDIA_KEY.test(media.key)) return null;
  const encodedKey = media.key.split('/').map(encodeURIComponent).join('/');
  return `${STORY_MEDIA_ENDPOINT}/${encodedKey}?v=${media.version}`;
}

/**
 * Slides live on the server (image files in the media volume, records in MongoDB) and the
 * display state lives in `settings/presentation`, so every client sees the same thing.
 */
@Injectable({ providedIn: 'root' })
export class StoryPresentationService {
  private readonly http = inject(HttpClient);
  private readonly realtimeData = inject(RealtimeDataService);
  private readonly logger = inject(LoggerService);

  private readonly sourceRecords = toSignal(
    this.realtimeData.subscribe<Record<string, Partial<StorySlideRecord>>>(DATA_ROOT.STORY_SLIDES),
    { initialValue: null },
  );
  private readonly sourceState = toSignal(
    this.realtimeData.subscribe<Partial<StoryPresentationState>>(PRESENTATION_STATE_PATH),
    { initialValue: null },
  );
  // Writable copies that apply local changes immediately and reset on every server update.
  private readonly records = linkedSignal(() => this.sourceRecords());
  private readonly state = linkedSignal(() => this.sourceState());

  readonly slides = computed<StorySlide[]>(() =>
    Object.entries(this.records() ?? {})
      .flatMap(([id, record]) => {
        const slide = this.normalize(id, record);
        return slide ? [slide] : [];
      })
      .sort(
        (left, right) =>
          left.order - right.order ||
          left.createdAt - right.createdAt ||
          left.id.localeCompare(right.id),
      )
      .map((slide, order) => ({ ...slide, order })),
  );
  readonly activeSlideId = computed(() => {
    const slides = this.slides();
    const stored = this.state()?.activeSlideId;
    return slides.some((slide) => slide.id === stored) ? (stored as string) : (slides[0]?.id ?? null);
  });
  readonly activeSlide = computed(() => {
    const id = this.activeSlideId();
    return this.slides().find((slide) => slide.id === id) ?? null;
  });
  readonly activeSlideIndex = computed(() => {
    const id = this.activeSlideId();
    return id ? this.slides().findIndex((slide) => slide.id === id) : -1;
  });
  readonly mode = computed<DisplayPresentationMode>(() =>
    this.state()?.mode === 'story' && this.activeSlide() ? 'story' : 'battle',
  );
  readonly canShowStory = computed(() => this.slides().length > 0);
  readonly canGoPrevious = computed(() => this.activeSlideIndex() > 0);
  readonly canGoNext = computed(() => {
    const index = this.activeSlideIndex();
    return index >= 0 && index < this.slides().length - 1;
  });

  constructor() {
    effect(() => {
      const upcoming = this.slides()[this.activeSlideIndex() + 1];
      if (upcoming && typeof Image !== 'undefined') new Image().src = upcoming.url;
    });
  }

  async addFiles(
    files: readonly File[],
    beforeSlideId: string | null = null,
  ): Promise<StorySlideUploadResult> {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return { added: 0, failed: 0 };

    const existing = this.slides();
    const created: StorySlideRecord[] = [];
    let failed = 0;
    for (const image of images) {
      try {
        created.push(await this.upload(image));
      } catch (error) {
        failed += 1;
        this.logger.error('StoryPresentationService.upload', error);
      }
    }

    const insertAt = beforeSlideId ? existing.findIndex((slide) => slide.id === beforeSlideId) : -1;
    if (created.length > 0 && insertAt >= 0) {
      const ids = existing.map((slide) => slide.id);
      ids.splice(insertAt, 0, ...created.map((slide) => slide.id));
      this.reorder(ids, new Map([...existing, ...created].map((slide) => [slide.id, slide.order])));
    }
    return { added: created.length, failed };
  }

  selectSlide(slideId: string): void {
    if (!this.slides().some((slide) => slide.id === slideId)) return;
    this.publishState(this.mode(), slideId);
  }

  setMode(mode: DisplayPresentationMode): void {
    if (mode === 'story' && !this.canShowStory()) return;
    this.publishState(mode, this.activeSlideId());
  }

  previousSlide(): void {
    const index = this.activeSlideIndex();
    if (index <= 0) return;
    this.publishState(this.mode(), this.slides()[index - 1].id);
  }

  nextSlide(): void {
    const index = this.activeSlideIndex();
    const slides = this.slides();
    if (index < 0 || index >= slides.length - 1) return;
    this.publishState(this.mode(), slides[index + 1].id);
  }

  moveSlide(slideId: string, offset: -1 | 1): void {
    const ids = this.slides().map((slide) => slide.id);
    const index = ids.indexOf(slideId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.reorder(ids);
  }

  moveSlideBefore(slideId: string, targetSlideId: string): void {
    if (slideId === targetSlideId) return;
    const ids = this.slides().map((slide) => slide.id);
    const sourceIndex = ids.indexOf(slideId);
    const targetIndex = ids.indexOf(targetSlideId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, slideId);
    this.reorder(ids);
  }

  removeSlide(slideId: string): void {
    if (!this.slides().some((slide) => slide.id === slideId)) return;
    // The server also moves the display to a neighbouring slide when the active one is removed.
    firstValueFrom(this.http.delete(`${STORY_SLIDES_ENDPOINT}/${encodeURIComponent(slideId)}`)).catch(
      (error: unknown) => this.logger.error('StoryPresentationService.removeSlide', error),
    );
  }

  private async upload(file: File): Promise<StorySlideRecord> {
    const body = new FormData();
    body.append('name', file.name);
    body.append('sectionId', storySectionIdFromFileName(file.name));
    body.append('file', file, file.name);
    const response = await firstValueFrom(
      this.http.post<StorySlideUploadResponse>(STORY_SLIDES_ENDPOINT, body),
    );
    return response.slide;
  }

  private publishState(mode: DisplayPresentationMode, activeSlideId: string | null): void {
    const lastUpdated = Date.now();
    this.state.set({ mode, activeSlideId, lastUpdated });
    this.realtimeData
      .update(PRESENTATION_STATE_PATH, { mode, activeSlideId, lastUpdated })
      .catch((error: unknown) => {
        this.logger.error('StoryPresentationService.publishState', error);
        this.state.set(this.sourceState());
      });
  }

  private reorder(ids: readonly string[], knownOrders?: ReadonlyMap<string, number>): void {
    const known = knownOrders ?? new Map(this.slides().map((slide) => [slide.id, slide.order]));
    const changes = ids.flatMap((id, order) => (known.get(id) === order ? [] : [{ id, order }]));
    if (changes.length === 0) return;

    this.records.update((records) => {
      const next = { ...(records ?? {}) };
      for (const { id, order } of changes) {
        if (next[id]) next[id] = { ...next[id], order };
      }
      return next;
    });
    this.realtimeData
      .update(
        DATA_ROOT.STORY_SLIDES,
        Object.fromEntries(changes.map(({ id, order }) => [`${id}/order`, order])),
      )
      .catch((error: unknown) => {
        this.logger.error('StoryPresentationService.reorder', error);
        this.records.set(this.sourceRecords());
      });
  }

  private normalize(id: string, record: Partial<StorySlideRecord>): StorySlide | null {
    const url = buildStorySlideUrl(record.media);
    if (!record.media || !url) return null;
    const name = typeof record.name === 'string' ? record.name : '';
    return {
      id,
      name,
      sectionId:
        typeof record.sectionId === 'string' && record.sectionId
          ? record.sectionId
          : storySectionIdFromFileName(name),
      order: Number.isFinite(record.order) ? Number(record.order) : 0,
      media: record.media,
      createdAt: Number.isFinite(record.createdAt) ? Number(record.createdAt) : 0,
      lastUpdated: Number.isFinite(record.lastUpdated) ? Number(record.lastUpdated) : 0,
      url,
    };
  }
}
