import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorySlide } from '../../../core/models/story-presentation.model';
import { LoggerService } from '../../../core/services/logger.service';
import { StoryPresentationService } from '../../../core/services/story-presentation.service';
import { StoryScriptService } from './story-script.service';
import { DmStoryComponent } from './dm-story.component';

describe('DmStoryComponent', () => {
  let fixture: ComponentFixture<DmStoryComponent>;
  let component: DmStoryComponent;
  let slides: ReturnType<typeof signal<StorySlide[]>>;
  let activeSlide: ReturnType<typeof signal<StorySlide | null>>;
  let story: {
    mode: ReturnType<typeof signal<'battle' | 'story'>>;
    slides: typeof slides;
    activeSlide: typeof activeSlide;
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
  let scripts: {
    section: ReturnType<typeof vi.fn>;
    saveSection: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn> };

  const tavern: StorySlide = {
    id: 'tavern',
    name: '1.png',
    sectionId: '1',
    order: 0,
    media: { key: 'slides/tavern.webp', version: 1 },
    createdAt: 1,
    lastUpdated: 1,
    url: '/media/slides/tavern.webp?v=1',
  };
  const forest: StorySlide = {
    id: 'forest',
    name: '2.jpg',
    sectionId: '2',
    order: 1,
    media: { key: 'slides/forest.webp', version: 1 },
    createdAt: 2,
    lastUpdated: 2,
    url: '/media/slides/forest.webp?v=1',
  };

  const host = () => fixture.nativeElement as HTMLElement;

  function selectTavern(): void {
    slides.set([tavern]);
    activeSlide.set(tavern);
    story.activeSlideId.set(tavern.id);
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
  }

  beforeEach(() => {
    slides = signal<StorySlide[]>([]);
    activeSlide = signal<StorySlide | null>(null);
    story = {
      mode: signal<'battle' | 'story'>('battle'),
      slides,
      activeSlide,
      activeSlideId: signal<string | null>(null),
      activeSlideIndex: signal(-1),
      canShowStory: signal(false),
      canGoPrevious: signal(false),
      canGoNext: signal(false),
      addFiles: vi.fn().mockResolvedValue({ added: 2, failed: 0 }),
      setMode: vi.fn(),
      previousSlide: vi.fn(),
      nextSlide: vi.fn(),
      selectSlide: vi.fn(),
      moveSlide: vi.fn(),
      moveSlideBefore: vi.fn(),
      removeSlide: vi.fn(),
    };
    scripts = {
      section: vi.fn((id: string) =>
        id === '1' ? { id: '1', text: '# Tavern', createdAt: 100, lastUpdated: 100 } : null,
      ),
      saveSection: vi.fn().mockResolvedValue(undefined),
    };
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DmStoryComponent],
      providers: [
        { provide: StoryPresentationService, useValue: story },
        { provide: StoryScriptService, useValue: scripts },
        { provide: LoggerService, useValue: logger },
      ],
    });
    fixture = TestBed.createComponent(DmStoryComponent);
    component = fixture.componentInstance;
  });

  describe('uploading images', () => {
    it('passes the selected files and the insert position to the story service', async () => {
      // Arrange
      const input = {
        files: [
          new File(['tavern'], 'tavern.jpg', { type: 'image/jpeg' }),
          new File(['forest'], 'forest.webp', { type: 'image/webp' }),
        ],
        value: 'selected',
      };
      component.insertBeforeSlideId.set('forest');

      // Act
      await component.onFilesSelected({ target: input } as unknown as Event);

      // Assert
      expect(story.addFiles).toHaveBeenCalledWith(input.files, 'forest');
    });

    it('resets the file input and the insert position after a successful upload', async () => {
      // Arrange
      const input = {
        files: [new File(['a'], 'a.png', { type: 'image/png' })],
        value: 'selected',
      };
      component.insertBeforeSlideId.set('forest');

      // Act
      await component.onFilesSelected({ target: input } as unknown as Event);

      // Assert
      expect(input.value).toBe('');
      expect(component.insertBeforeSlideId()).toBeNull();
      expect(component.uploading()).toBe(false);
      expect(component.uploadMessage()).toMatch(/\b2\b/);
    });

    it('reports failed uploads and keeps the insert position', async () => {
      // Arrange
      story.addFiles.mockResolvedValueOnce({ added: 0, failed: 1 });
      const input = { files: [new File(['a'], 'a.png', { type: 'image/png' })], value: 'x' };
      component.insertBeforeSlideId.set('forest');

      // Act
      await component.onFilesSelected({ target: input } as unknown as Event);

      // Assert
      expect(component.insertBeforeSlideId()).toBe('forest');
      expect(component.uploadMessage()).toMatch(/\b1\b/);
      expect(component.uploading()).toBe(false);
    });

    it('restores the legacy story order when the images are uploaded for the first time', async () => {
      // Arrange
      scripts.section.mockImplementation((id: string) => ({
        id,
        text: 'Story',
        order: Number(id) - 1,
        createdAt: 100,
        lastUpdated: 100,
      }));
      const files = ['4', '2', '1', '3'].map(
        (name) => new File([name], `${name}.webp`, { type: 'image/webp' }),
      );

      // Act
      await component.onFilesSelected({ target: { files, value: 'x' } } as unknown as Event);

      // Assert
      const uploaded = story.addFiles.mock.calls[0][0] as File[];
      expect(uploaded.map((file) => file.name)).toEqual(['1.webp', '2.webp', '3.webp', '4.webp']);
      expect(story.addFiles).toHaveBeenCalledWith(uploaded, null);
    });
  });

  describe('deck', () => {
    beforeEach(() => {
      slides.set([tavern, forest]);
      activeSlide.set(tavern);
      story.activeSlideId.set('tavern');
      story.activeSlideIndex.set(0);
      story.canShowStory.set(true);
      story.canGoNext.set(true);
      fixture.detectChanges();
    });

    it('renders every slide beside the script and marks the active one', () => {
      // Arrange - deck rendered in beforeEach

      // Act
      const cards = host().querySelectorAll<HTMLElement>('.story-slide');

      // Assert
      expect(host().querySelector('.story-deck')).toBeVisible();
      expect(cards).toHaveLength(2);
      expect(cards[0]).toHaveClass('story-slide--active');
    });

    it('selects a slide when its card is clicked', () => {
      // Arrange
      const cards = host().querySelectorAll<HTMLElement>('.story-slide');

      // Act
      cards[1].click();

      // Assert
      expect(story.selectSlide).toHaveBeenCalledWith('forest');
    });

    it('delegates moving a slide to the story service', () => {
      // Arrange - deck rendered in beforeEach

      // Act
      component.moveSlide('forest', -1, new Event('click'));

      // Assert
      expect(story.moveSlide).toHaveBeenCalledWith('forest', -1);
    });

    it('delegates removing a slide to the story service', () => {
      // Arrange - deck rendered in beforeEach

      // Act
      component.removeSlide('forest', new Event('click'));

      // Assert
      expect(story.removeSlide).toHaveBeenCalledWith('forest');
    });
  });

  describe('script', () => {
    it('loads the script of the active slide using its section key', () => {
      // Arrange - no setup needed

      // Act
      selectTavern();

      // Assert
      expect(component.activeSectionId()).toBe('1');
      expect(component.scriptDraft()).toBe('# Tavern');
    });

    it('shows the rendered teleprompter instead of the editor by default', () => {
      // Arrange - no setup needed

      // Act
      selectTavern();

      // Assert
      expect(host().querySelector('.story-script__markdown')).toHaveTextContent('Tavern');
      expect(host().querySelector('textarea')).toBeNull();
      expect(host().querySelector('.story-script__workspace')).toHaveClass(
        'story-script__workspace--reading',
      );
    });

    it('previews the draft while editing', () => {
      // Arrange
      selectTavern();
      component.startScriptEditing();
      fixture.detectChanges();
      const textarea = host().querySelector<HTMLTextAreaElement>('textarea')!;

      // Act
      textarea.value = '**Check DC 12**';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Assert
      expect(host().querySelector('.story-script__markdown strong')).toHaveTextContent(
        'Check DC 12',
      );
    });

    it('saves the draft and returns to the teleprompter', async () => {
      // Arrange
      selectTavern();
      component.startScriptEditing();
      component.scriptDraft.set('**Check DC 12**');

      // Act
      await component.saveScript();
      fixture.detectChanges();

      // Assert
      expect(scripts.saveSection).toHaveBeenCalledWith('1', '**Check DC 12**');
      expect(component.scriptEditing()).toBe(false);
      expect(host().querySelector('textarea')).toBeNull();
      expect(host().querySelector('.story-script__markdown strong')).toHaveTextContent(
        'Check DC 12',
      );
    });

    it('keeps the draft and reports a retryable error when saving fails', async () => {
      // Arrange
      selectTavern();
      component.startScriptEditing();
      component.scriptDraft.set('Unsaved text');
      scripts.saveSection.mockRejectedValueOnce(new Error('offline'));

      // Act
      await component.saveScript();

      // Assert
      expect(component.scriptDraft()).toBe('Unsaved text');
      expect(component.scriptEditing()).toBe(true);
      expect(component.scriptError()).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith('DmStoryComponent.saveScript', expect.any(Error));
    });
  });
});
