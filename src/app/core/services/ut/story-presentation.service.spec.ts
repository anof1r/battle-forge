import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorySlideRecord } from '../../models/story-presentation.model';
import { LoggerService } from '../logger.service';
import { RealtimeDataService } from '../realtime-data.service';
import { StoryPresentationService, buildStorySlideUrl } from '../story-presentation.service';

type Records = Record<string, Partial<StorySlideRecord>> | null;
type State = { mode?: string; activeSlideId?: string | null } | null;

function record(id: string, order: number, name = `${order}.png`): StorySlideRecord {
  return {
    id,
    name,
    sectionId: `${order}`,
    order,
    media: { key: `slides/${id}.webp`, version: 7 },
    createdAt: order,
    lastUpdated: order,
  };
}

describe('StoryPresentationService', () => {
  let records: BehaviorSubject<Records>;
  let state: BehaviorSubject<State>;
  let realtimeData: { subscribe: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let service: StoryPresentationService;

  beforeEach(() => {
    records = new BehaviorSubject<Records>({
      b: record('b', 1),
      a: record('a', 0),
      c: record('c', 2),
    });
    state = new BehaviorSubject<State>(null);
    realtimeData = {
      subscribe: vi.fn((path: string) =>
        (path === 'dm-library/slides' ? records : state).asObservable(),
      ),
      update: vi.fn().mockResolvedValue(undefined),
    };
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeDataService, useValue: realtimeData },
        { provide: LoggerService, useValue: logger },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(StoryPresentationService);
  });

  describe('state subscriptions', () => {
    it('subscribes to the slides collection', () => {
      // Arrange - service created in beforeEach

      // Act
      const calls = realtimeData.subscribe.mock.calls.map(([path]) => path);

      // Assert
      expect(calls).toContain('dm-library/slides');
    });

    it('subscribes to the presentation state', () => {
      // Arrange - service created in beforeEach

      // Act
      const calls = realtimeData.subscribe.mock.calls.map(([path]) => path);

      // Assert
      expect(calls).toContain('settings/presentation');
    });
  });

  describe('slides', () => {
    it('orders slides and reindexes gaps while skipping records with unsafe media keys', () => {
      // Arrange
      const incoming = {
        b: record('b', 10),
        a: record('a', 4),
        broken: { id: 'broken', media: { key: '../etc/passwd', version: 1 } },
      };

      // Act
      records.next(incoming);

      // Assert
      expect(service.slides().map((slide) => [slide.id, slide.order])).toEqual([
        ['a', 0],
        ['b', 1],
      ]);
    });

    it('resolves the server media URL with a cache-busting version', () => {
      // Arrange
      records.next({ a: record('a', 0) });

      // Act
      const url = service.slides()[0].url;

      // Assert
      expect(url).toBe('/media/slides/a.webp?v=7');
    });

    it('derives the section key from the file name for records without one', () => {
      // Arrange
      const legacy = { ...record('a', 0, 'act.1.png'), sectionId: undefined };

      // Act
      records.next({ a: legacy });

      // Assert
      expect(service.slides()[0].sectionId).toBe('act_1');
    });
  });

  describe('presentation state', () => {
    it('defaults to battle mode with the first slide selected', () => {
      // Arrange - empty presentation state

      // Act
      const snapshot = { mode: service.mode(), activeSlideId: service.activeSlideId() };

      // Assert
      expect(snapshot).toEqual({ mode: 'battle', activeSlideId: 'a' });
    });

    it('follows the active slide and mode published by the server', () => {
      // Arrange
      const published = { mode: 'story', activeSlideId: 'b' };

      // Act
      state.next(published);

      // Assert
      expect(service.mode()).toBe('story');
      expect(service.activeSlide()?.id).toBe('b');
      expect(service.activeSlideIndex()).toBe(1);
    });

    it('falls back to the first slide when the active slide no longer exists', () => {
      // Arrange
      const published = { mode: 'story', activeSlideId: 'deleted' };

      // Act
      state.next(published);

      // Assert
      expect(service.activeSlideId()).toBe('a');
    });

    it('cannot show the story when there are no slides', () => {
      // Arrange
      state.next({ mode: 'story', activeSlideId: 'a' });

      // Act
      records.next(null);

      // Assert
      expect(service.mode()).toBe('battle');
      expect(service.canShowStory()).toBe(false);
    });

    it('follows the server when another client switches the display back to battle', () => {
      // Arrange
      service.setMode('story');

      // Act
      state.next({ mode: 'battle', activeSlideId: 'a' });

      // Assert
      expect(service.mode()).toBe('battle');
    });
  });

  describe('publishing', () => {
    it('applies the mode immediately and publishes it through the shared document', () => {
      // Arrange
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      // Act
      service.setMode('story');

      // Assert
      expect(service.mode()).toBe('story');
      expect(realtimeData.update).toHaveBeenLastCalledWith('settings/presentation', {
        mode: 'story',
        activeSlideId: 'a',
        lastUpdated: 1000,
      });
    });

    it('does not publish anything when there are no slides to show', () => {
      // Arrange
      records.next(null);

      // Act
      service.setMode('story');

      // Assert
      expect(realtimeData.update).not.toHaveBeenCalled();
    });

    it('navigates to the next slide and stops at the end of the deck', () => {
      // Arrange
      service.setMode('story');
      realtimeData.update.mockClear();

      // Act
      service.nextSlide();
      service.nextSlide();
      service.nextSlide();

      // Assert
      expect(service.activeSlideId()).toBe('c');
      expect(service.canGoNext()).toBe(false);
      expect(realtimeData.update).toHaveBeenCalledTimes(2);
    });

    it('navigates to the previous slide', () => {
      // Arrange
      vi.spyOn(Date, 'now').mockReturnValue(1000);
      state.next({ mode: 'story', activeSlideId: 'c' });

      // Act
      service.previousSlide();

      // Assert
      expect(realtimeData.update).toHaveBeenLastCalledWith('settings/presentation', {
        mode: 'story',
        activeSlideId: 'b',
        lastUpdated: 1000,
      });
    });

    it('ignores a selection of an unknown slide', () => {
      // Arrange
      realtimeData.update.mockClear();

      // Act
      service.selectSlide('missing');

      // Assert
      expect(realtimeData.update).not.toHaveBeenCalled();
    });

    it('reverts an optimistic change when the write fails', async () => {
      // Arrange
      realtimeData.update.mockRejectedValueOnce(new Error('offline'));

      // Act
      service.setMode('story');

      // Assert
      expect(service.mode()).toBe('story');
      await vi.waitFor(() => expect(service.mode()).toBe('battle'));
      expect(logger.error).toHaveBeenCalledWith(
        'StoryPresentationService.publishState',
        expect.any(Error),
      );
    });
  });

  describe('reordering', () => {
    it('persists only the changed order values when a slide moves', () => {
      // Arrange - deck is a, b, c

      // Act
      service.moveSlide('a', 1);

      // Assert
      expect(service.slides().map((slide) => slide.id)).toEqual(['b', 'a', 'c']);
      expect(realtimeData.update).toHaveBeenCalledWith('dm-library/slides', {
        'b/order': 0,
        'a/order': 1,
      });
    });

    it('does not write when a slide cannot move past the start of the deck', () => {
      // Arrange - deck is a, b, c

      // Act
      service.moveSlide('a', -1);

      // Assert
      expect(realtimeData.update).not.toHaveBeenCalled();
    });

    it('moves a slide before another slide', () => {
      // Arrange - deck is a, b, c

      // Act
      service.moveSlideBefore('c', 'a');

      // Assert
      expect(service.slides().map((slide) => slide.id)).toEqual(['c', 'a', 'b']);
      expect(realtimeData.update).toHaveBeenCalledWith('dm-library/slides', {
        'c/order': 0,
        'a/order': 1,
        'b/order': 2,
      });
    });
  });

  describe('addFiles', () => {
    it('posts each image with its original name and section key', async () => {
      // Arrange
      const file = new File(['x'], 'new.one.png', { type: 'image/png' });

      // Act
      const result = service.addFiles([file]);
      const request = await vi.waitFor(() => http.expectOne('/api/slides'));
      request.flush({ slide: record('d', 3, 'new.one.png') });
      await result;

      // Assert
      const body = request.request.body as FormData;
      expect(body.get('name')).toBe('new.one.png');
      expect(body.get('sectionId')).toBe('new_one');
      expect(body.get('file')).toBeInstanceOf(File);
    });

    it('uploads sequentially and reports the added count', async () => {
      // Arrange
      const files = [
        new File(['x'], 'one.png', { type: 'image/png' }),
        new File(['y'], 'two.png', { type: 'image/png' }),
        new File(['z'], 'notes.txt', { type: 'text/plain' }),
      ];

      // Act
      const result = service.addFiles(files);
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush({
        slide: record('d', 3, 'one.png'),
      });
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush({
        slide: record('e', 4, 'two.png'),
      });

      // Assert
      await expect(result).resolves.toEqual({ added: 2, failed: 0 });
      http.verify();
    });

    it('places uploaded slides before the requested slide', async () => {
      // Arrange
      const files = [
        new File(['x'], 'one.png', { type: 'image/png' }),
        new File(['y'], 'two.png', { type: 'image/png' }),
      ];

      // Act
      const result = service.addFiles(files, 'b');
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush({
        slide: record('d', 3, 'one.png'),
      });
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush({
        slide: record('e', 4, 'two.png'),
      });
      await result;

      // Assert
      expect(realtimeData.update).toHaveBeenCalledWith('dm-library/slides', {
        'd/order': 1,
        'e/order': 2,
        'b/order': 3,
        'c/order': 4,
      });
    });

    it('counts failed uploads and does not reorder when appending', async () => {
      // Arrange
      const files = [
        new File(['x'], 'ok.png', { type: 'image/png' }),
        new File(['y'], 'bad.png', { type: 'image/png' }),
      ];

      // Act
      const result = service.addFiles(files);
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush({
        slide: record('d', 3, 'ok.png'),
      });
      (await vi.waitFor(() => http.expectOne('/api/slides'))).flush('nope', {
        status: 400,
        statusText: 'Bad Request',
      });

      // Assert
      await expect(result).resolves.toEqual({ added: 1, failed: 1 });
      expect(realtimeData.update).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'StoryPresentationService.upload',
        expect.anything(),
      );
    });

    it('ignores a selection without images', async () => {
      // Arrange
      const files = [new File(['x'], 'notes.txt', { type: 'text/plain' })];

      // Act
      const result = await service.addFiles(files);

      // Assert
      expect(result).toEqual({ added: 0, failed: 0 });
      http.verify();
    });
  });

  describe('removeSlide', () => {
    it('asks the server to delete an existing slide', () => {
      // Arrange - deck is a, b, c

      // Act
      service.removeSlide('b');

      // Assert
      const request = http.expectOne('/api/slides/b');
      expect(request.request.method).toBe('DELETE');
      request.flush({ success: true });
    });

    it('does not call the server for an unknown slide', () => {
      // Arrange - deck is a, b, c

      // Act
      service.removeSlide('missing');

      // Assert
      http.verify();
    });
  });
});

describe('buildStorySlideUrl', () => {
  it('resolves keys inside the slides directory', () => {
    // Arrange
    const media = { key: 'slides/abc-1.webp', version: 3 };

    // Act
    const url = buildStorySlideUrl(media);

    // Assert
    expect(url).toBe('/media/slides/abc-1.webp?v=3');
  });

  it('rejects keys outside the slides directory', () => {
    // Arrange
    const media = { key: 'avatars/players/abc.webp', version: 3 };

    // Act
    const url = buildStorySlideUrl(media);

    // Assert
    expect(url).toBeNull();
  });

  it('rejects missing media', () => {
    // Arrange - no media

    // Act
    const url = buildStorySlideUrl(null);

    // Assert
    expect(url).toBeNull();
  });
});
