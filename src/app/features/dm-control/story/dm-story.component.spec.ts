import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorySlide } from '../../../core/models/story-presentation.model';
import { LoggerService } from '../../../core/services/logger.service';
import { StoryPresentationService } from '../../../core/services/story-presentation.service';
import { StoryScriptService } from '../../../core/services/story-script.service';
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
    order: 0,
    blob: new Blob(['tavern']),
    objectUrl: 'blob:tavern',
  };
  const forest: StorySlide = {
    id: 'forest',
    name: '2.jpg',
    order: 1,
    blob: new Blob(['forest']),
    objectUrl: 'blob:forest',
  };

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
      addFiles: vi.fn().mockReturnValue(2),
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
        id === '1'
          ? { id: '1', text: '# Таверна', createdAt: 100, lastUpdated: 100 }
          : null,
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

  it('loads selected image files and resets the file input', () => {
    const input = {
      files: [
        new File(['tavern'], 'tavern.jpg', { type: 'image/jpeg' }),
        new File(['forest'], 'forest.webp', { type: 'image/webp' }),
      ],
      value: 'selected',
    };
    component.insertBeforeSlideId.set('forest');

    component.onFilesSelected({ target: input } as unknown as Event);

    expect(story.addFiles).toHaveBeenCalledWith(input.files, 'forest');
    expect(input.value).toBe('');
    expect(component.insertBeforeSlideId()).toBeNull();
    expect(component.uploadMessage()).toBe('Добавлено изображений: 2');
  });

  it('renders an expandable deck and delegates selection, ordering and removal', () => {
    slides.set([tavern, forest]);
    activeSlide.set(tavern);
    story.activeSlideId.set('tavern');
    story.activeSlideIndex.set(0);
    story.canShowStory.set(true);
    story.canGoNext.set(true);
    fixture.detectChanges();

    const deck = fixture.nativeElement.querySelector<HTMLDetailsElement>('.story-deck');
    const cards = fixture.nativeElement.querySelectorAll<HTMLElement>('.story-slide');
    expect(deck?.open).toBe(true);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveClass('story-slide--active');
    expect(cards[0]).toHaveTextContent('Сюжет: 1');

    cards[1].click();
    expect(story.selectSlide).toHaveBeenCalledWith('forest');

    component.moveSlide('forest', -1, new Event('click'));
    expect(story.moveSlide).toHaveBeenCalledWith('forest', -1);
    component.removeSlide('forest', new Event('click'));
    expect(story.removeSlide).toHaveBeenCalledWith('forest');
  });

  it('loads, previews and saves the script using the image name as its key', async () => {
    slides.set([tavern]);
    activeSlide.set(tavern);
    story.activeSlideId.set(tavern.id);
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.activeSectionId()).toBe('1');
    expect(component.scriptDraft()).toBe('# Таверна');
    expect(fixture.nativeElement.querySelector('.story-script__markdown')).toHaveTextContent(
      'Таверна',
    );
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    expect(fixture.nativeElement.querySelector('.story-script__workspace')).toHaveClass(
      'story-script__workspace--reading',
    );

    const editButton = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.story-script__header button'),
    ).find((button) => button.textContent?.includes('Редактировать'));
    editButton?.click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();
    textarea.value = '**Проверка СЛ 12**';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.story-script__markdown strong')).toHaveTextContent(
      'Проверка СЛ 12',
    );

    await component.saveScript();
    fixture.detectChanges();
    expect(scripts.saveSection).toHaveBeenCalledWith('1', '**Проверка СЛ 12**');
    expect(component.scriptMessage()).toBe('Сюжет «1» сохранён.');
    expect(component.scriptEditing()).toBe(false);
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    expect(fixture.nativeElement.querySelector('.story-script__markdown strong')).toHaveTextContent(
      'Проверка СЛ 12',
    );
  });

  it('keeps the draft and reports a retryable error when Firebase saving fails', async () => {
    slides.set([tavern]);
    activeSlide.set(tavern);
    story.activeSlideId.set(tavern.id);
    fixture.detectChanges();
    TestBed.flushEffects();
    component.startScriptEditing();
    component.scriptDraft.set('Несохранённый текст');
    scripts.saveSection.mockRejectedValueOnce(new Error('offline'));

    await component.saveScript();

    expect(component.scriptDraft()).toBe('Несохранённый текст');
    expect(component.scriptEditing()).toBe(true);
    expect(component.scriptError()).toContain('Текст оставлен в редакторе');
    expect(logger.error).toHaveBeenCalledWith('DmStoryComponent.saveScript', expect.any(Error));
  });
});
