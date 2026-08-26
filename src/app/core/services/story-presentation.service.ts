import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import {
  DisplayPresentationMode,
  StoryPresentationMessage,
  StorySlide,
  StorySlideTransfer,
} from '../models/story-presentation.model';
import { STORY_PRESENTATION_CHANNEL } from '../constants/story-presentation.constants';

@Injectable({ providedIn: 'root' })
export class StoryPresentationService implements OnDestroy {
  private readonly channel = this.createChannel();

  readonly mode = signal<DisplayPresentationMode>('battle');
  readonly slides = signal<StorySlide[]>([]);
  readonly activeSlideId = signal<string | null>(null);

  readonly activeSlide = computed(() => {
    const id = this.activeSlideId();
    return this.slides().find((slide) => slide.id === id) ?? null;
  });
  readonly activeSlideIndex = computed(() => {
    const id = this.activeSlideId();
    return id ? this.slides().findIndex((slide) => slide.id === id) : -1;
  });
  readonly canShowStory = computed(() => this.slides().length > 0);
  readonly canGoPrevious = computed(() => this.activeSlideIndex() > 0);
  readonly canGoNext = computed(() => {
    const index = this.activeSlideIndex();
    return index >= 0 && index < this.slides().length - 1;
  });

  constructor() {
    if (!this.channel) return;
    this.channel.onmessage = (event: MessageEvent<StoryPresentationMessage>) => {
      this.handleMessage(event.data);
    };
    queueMicrotask(() => this.channel?.postMessage({ type: 'request-state' }));
  }

  addFiles(files: readonly File[], beforeSlideId: string | null = null): number {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return 0;

    const additions = imageFiles.map<StorySlide>((file) => ({
      id: `story_${crypto.randomUUID()}`,
      name: file.name,
      order: 0,
      blob: file,
      objectUrl: this.createObjectUrl(file),
    }));
    const next = [...this.slides()];
    const requestedIndex = beforeSlideId
      ? next.findIndex((slide) => slide.id === beforeSlideId)
      : next.length;
    const insertAt = requestedIndex < 0 ? next.length : requestedIndex;
    next.splice(insertAt, 0, ...additions);
    this.slides.set(this.reindex(next));
    if (!this.activeSlideId()) this.activeSlideId.set(additions[0].id);
    this.publishDeckState();
    return additions.length;
  }

  selectSlide(slideId: string): void {
    if (!this.slides().some((slide) => slide.id === slideId)) return;
    this.activeSlideId.set(slideId);
    this.publishPresentationState();
  }

  setMode(mode: DisplayPresentationMode): void {
    if (mode === 'story' && !this.canShowStory()) return;
    this.mode.set(mode);
    this.publishPresentationState();
  }

  previousSlide(): void {
    const index = this.activeSlideIndex();
    if (index <= 0) return;
    this.activeSlideId.set(this.slides()[index - 1].id);
    this.publishPresentationState();
  }

  nextSlide(): void {
    const index = this.activeSlideIndex();
    const slides = this.slides();
    if (index < 0 || index >= slides.length - 1) return;
    this.activeSlideId.set(slides[index + 1].id);
    this.publishPresentationState();
  }

  moveSlide(slideId: string, offset: -1 | 1): void {
    const slides = [...this.slides()];
    const index = slides.findIndex((slide) => slide.id === slideId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= slides.length) return;
    [slides[index], slides[target]] = [slides[target], slides[index]];
    this.slides.set(this.reindex(slides));
    this.publishDeckState();
  }

  moveSlideBefore(slideId: string, targetSlideId: string): void {
    if (slideId === targetSlideId) return;
    const slides = [...this.slides()];
    const sourceIndex = slides.findIndex((slide) => slide.id === slideId);
    const targetIndex = slides.findIndex((slide) => slide.id === targetSlideId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [slide] = slides.splice(sourceIndex, 1);
    const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    slides.splice(adjustedTarget, 0, slide);
    this.slides.set(this.reindex(slides));
    this.publishDeckState();
  }

  removeSlide(slideId: string): void {
    const current = this.slides();
    const index = current.findIndex((slide) => slide.id === slideId);
    if (index < 0) return;
    this.revokeObjectUrl(current[index].objectUrl);
    const remaining = this.reindex(current.filter((slide) => slide.id !== slideId));
    this.slides.set(remaining);
    if (this.activeSlideId() === slideId) {
      this.activeSlideId.set(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    }
    if (remaining.length === 0) this.mode.set('battle');
    this.publishDeckState();
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.slides().forEach((slide) => this.revokeObjectUrl(slide.objectUrl));
  }

  private handleMessage(message: StoryPresentationMessage): void {
    if (message.type === 'request-state') {
      this.publishDeckState();
      return;
    }
    if (message.type === 'presentation-state') {
      this.applyPresentationState(message.mode, message.activeSlideId);
      return;
    }
    this.replaceDeck(message.slides);
    this.applyPresentationState(message.mode, message.activeSlideId);
  }

  private replaceDeck(transfers: StorySlideTransfer[]): void {
    this.slides().forEach((slide) => this.revokeObjectUrl(slide.objectUrl));
    const slides = transfers.map<StorySlide>((slide, index) => ({
      ...slide,
      order: Number.isFinite(slide.order) ? Number(slide.order) : index,
      objectUrl: this.createObjectUrl(slide.blob),
    }));
    this.slides.set(this.sortAndReindex(slides));
  }

  private applyPresentationState(
    mode: DisplayPresentationMode,
    activeSlideId: string | null,
  ): void {
    const slides = this.slides();
    const selected = slides.some((slide) => slide.id === activeSlideId)
      ? activeSlideId
      : (slides[0]?.id ?? null);
    this.activeSlideId.set(selected);
    this.mode.set(mode === 'story' && selected ? 'story' : 'battle');
  }

  private publishDeckState(): void {
    const message: StoryPresentationMessage = {
      type: 'deck-state',
      mode: this.mode(),
      activeSlideId: this.activeSlideId(),
      slides: this.slides().map(({ id, name, order, blob }) => ({ id, name, order, blob })),
    };
    this.channel?.postMessage(message);
  }

  private publishPresentationState(): void {
    const message: StoryPresentationMessage = {
      type: 'presentation-state',
      mode: this.mode(),
      activeSlideId: this.activeSlideId(),
    };
    this.channel?.postMessage(message);
  }

  private createChannel(): BroadcastChannel | null {
    return typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(STORY_PRESENTATION_CHANNEL);
  }

  private sortAndReindex(slides: readonly StorySlide[]): StorySlide[] {
    return slides
      .map((slide, index) => ({ slide, index }))
      .sort(
        (left, right) =>
          left.slide.order - right.slide.order || left.index - right.index,
      )
      .map(({ slide }, order) => ({ ...slide, order }));
  }

  private reindex(slides: readonly StorySlide[]): StorySlide[] {
    return slides.map((slide, order) => ({ ...slide, order }));
  }

  private createObjectUrl(blob: Blob): string {
    return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob)
      : '';
  }

  private revokeObjectUrl(url: string): void {
    if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}
