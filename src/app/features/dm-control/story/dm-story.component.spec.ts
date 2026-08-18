import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorySlide } from '../../../core/models/story-presentation.model';
import { StoryPresentationService } from '../../../core/services/story-presentation.service';
import { DmStoryComponent } from './dm-story.component';

describe('DmStoryComponent', () => {
  let fixture: ComponentFixture<DmStoryComponent>;
  let component: DmStoryComponent;
  let slides: ReturnType<typeof signal<StorySlide[]>>;
  let story: {
    mode: ReturnType<typeof signal<'battle' | 'story'>>;
    slides: typeof slides;
    activeSlideId: ReturnType<typeof signal<string | null>>;
    activeSlideIndex: ReturnType<typeof signal<number>>;
    canShowStory: ReturnType<typeof signal<boolean>>;
    canGoPrevious: ReturnType<typeof signal<boolean>>;
    canGoNext: ReturnType<typeof signal<boolean>>;
    addFiles: ReturnType<typeof vi.fn>;
    setMode: ReturnType<typeof vi.fn>;
    previousSlide: ReturnType<typeof vi.fn>;
    nextSlide: ReturnType<typeof vi.fn>;
    selectSlide: ReturnType<typeof vi.fn>;
    moveSlide: ReturnType<typeof vi.fn>;
    moveSlideBefore: ReturnType<typeof vi.fn>;
    removeSlide: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    slides = signal<StorySlide[]>([]);
    story = {
      mode: signal<'battle' | 'story'>('battle'),
      slides,
      activeSlideId: signal<string | null>(null),
      activeSlideIndex: signal(-1),
      canShowStory: signal(false),
      canGoPrevious: signal(false),
      canGoNext: signal(false),
      addFiles: vi.fn().mockReturnValue(2),
      setMode: vi.fn(),
      previousSlide: vi.fn(),
      nextSlide: vi.fn(),
      selectSlide: vi.fn(),
      moveSlide: vi.fn(),
      moveSlideBefore: vi.fn(),
      removeSlide: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [DmStoryComponent],
      providers: [{ provide: StoryPresentationService, useValue: story }],
    });
    fixture = TestBed.createComponent(DmStoryComponent);
    component = fixture.componentInstance;
  });

  it('loads selected image files and resets the file input', () => {
    const input = {
      files: [
        new File(['tavern'], 'tavern.jpg', { type: 'image/jpeg' }),
        new File(['forest'], 'forest.webp', { type: 'image/webp' }),
      ],
      value: 'selected',
    };

    component.onFilesSelected({ target: input } as unknown as Event);

    expect(story.addFiles).toHaveBeenCalledWith(input.files);
    expect(input.value).toBe('');
    expect(component.uploadMessage()).toBe('Добавлено изображений: 2');
  });

  it('renders slides and delegates selection, ordering and removal', () => {
    const tavern: StorySlide = {
      id: 'tavern',
      name: 'tavern.jpg',
      blob: new Blob(['tavern']),
      objectUrl: 'blob:tavern',
    };
    const forest: StorySlide = {
      id: 'forest',
      name: 'forest.jpg',
      blob: new Blob(['forest']),
      objectUrl: 'blob:forest',
    };
    slides.set([tavern, forest]);
    story.activeSlideId.set('tavern');
    story.activeSlideIndex.set(0);
    story.canShowStory.set(true);
    story.canGoNext.set(true);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll<HTMLElement>('.story-slide');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveClass('story-slide--active');

    cards[1].click();
    expect(story.selectSlide).toHaveBeenCalledWith('forest');

    component.moveSlide('forest', -1, new Event('click'));
    expect(story.moveSlide).toHaveBeenCalledWith('forest', -1);
    component.removeSlide('forest', new Event('click'));
    expect(story.removeSlide).toHaveBeenCalledWith('forest');
  });
});
