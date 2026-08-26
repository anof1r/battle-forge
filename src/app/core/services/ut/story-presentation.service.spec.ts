import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryPresentationMessage } from '../../models/story-presentation.model';
import { StoryPresentationService } from '../story-presentation.service';

class FakeBroadcastChannel {
  static readonly channels: FakeBroadcastChannel[] = [];

  onmessage: ((event: MessageEvent<StoryPresentationMessage>) => void) | null = null;

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.push(this);
  }

  postMessage(message: StoryPresentationMessage): void {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        queueMicrotask(() => channel.onmessage?.({ data: message } as MessageEvent));
      }
    }
  }

  close(): void {
    const index = FakeBroadcastChannel.channels.indexOf(this);
    if (index >= 0) FakeBroadcastChannel.channels.splice(index, 1);
  }
}

describe('StoryPresentationService', () => {
  beforeEach(() => {
    FakeBroadcastChannel.channels.splice(0);
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a local ordered deck and returns to battle when its final slide is removed', () => {
    const service = new StoryPresentationService();
    const tavern = new File(['tavern'], '01-tavern.webp', { type: 'image/webp' });
    const forest = new File(['forest'], '02-forest.webp', { type: 'image/webp' });

    expect(service.addFiles([tavern, forest])).toBe(2);
    expect(service.slides().map((slide) => slide.name)).toEqual([
      '01-tavern.webp',
      '02-forest.webp',
    ]);
    expect(service.slides().map((slide) => slide.order)).toEqual([0, 1]);
    expect(service.activeSlide()?.name).toBe('01-tavern.webp');

    service.setMode('story');
    service.nextSlide();
    expect(service.activeSlide()?.name).toBe('02-forest.webp');

    service.moveSlide(service.activeSlide()!.id, -1);
    expect(service.slides()[0].name).toBe('02-forest.webp');
    expect(service.slides().map((slide) => slide.order)).toEqual([0, 1]);

    service.removeSlide(service.slides()[1].id);
    service.removeSlide(service.slides()[0].id);
    expect(service.slides()).toEqual([]);
    expect(service.mode()).toBe('battle');
    service.ngOnDestroy();
  });

  it('inserts new images before a selected slide and shifts a 30-slide deck safely', () => {
    const service = new StoryPresentationService();
    const files = Array.from(
      { length: 30 },
      (_, index) => new File([`slide-${index + 1}`], `${index + 1}.webp`, { type: 'image/webp' }),
    );
    service.addFiles(files);
    const formerMiddle = service.slides()[15];

    expect(
      service.addFiles(
        [new File(['inserted'], '15b.webp', { type: 'image/webp' })],
        formerMiddle.id,
      ),
    ).toBe(1);

    expect(service.slides()[15].name).toBe('15b.webp');
    expect(service.slides()[16].id).toBe(formerMiddle.id);
    expect(service.slides().map((slide) => slide.order)).toEqual(
      Array.from({ length: 31 }, (_, index) => index),
    );
    service.ngOnDestroy();
  });

  it('synchronizes uploaded slides and presentation controls between browser tabs', async () => {
    const dm = new StoryPresentationService();
    const display = new StoryPresentationService();
    await vi.waitFor(() => expect(FakeBroadcastChannel.channels).toHaveLength(2));

    dm.addFiles([
      new File(['tavern'], 'tavern.jpg', { type: 'image/jpeg' }),
      new File(['forest'], 'forest.jpg', { type: 'image/jpeg' }),
    ]);
    await vi.waitFor(() => expect(display.slides()).toHaveLength(2));

    dm.setMode('story');
    dm.nextSlide();

    await vi.waitFor(() => expect(display.mode()).toBe('story'));
    await vi.waitFor(() => expect(display.activeSlide()?.name).toBe('forest.jpg'));

    dm.setMode('battle');
    await vi.waitFor(() => expect(display.mode()).toBe('battle'));
    dm.ngOnDestroy();
    display.ngOnDestroy();
  });
});
