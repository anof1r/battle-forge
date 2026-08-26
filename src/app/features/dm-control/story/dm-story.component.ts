import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { renderStoryMarkdown, storySectionIdFromFileName } from '../../../core/utils';
import { LoggerService } from '../../../core/services/logger.service';
import { StoryPresentationService } from '../../../core/services/story-presentation.service';
import { StoryScriptService } from '../../../core/services/story-script.service';

@Component({
  selector: 'app-dm-story',
  standalone: true,
  templateUrl: './dm-story.component.html',
  styleUrl: './dm-story.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmStoryComponent {
  readonly story = inject(StoryPresentationService);
  readonly scripts = inject(StoryScriptService);
  private readonly logger = inject(LoggerService);
  private loadedSectionVersion = '';

  readonly draggedSlideId = signal<string | null>(null);
  readonly insertBeforeSlideId = signal<string | null>(null);
  readonly uploadMessage = signal<string | null>(null);
  readonly scriptDraft = signal('');
  readonly scriptSaving = signal(false);
  readonly scriptEditing = signal(false);
  readonly scriptMessage = signal<string | null>(null);
  readonly scriptError = signal<string | null>(null);

  readonly activeSectionId = computed(() => {
    const slide = this.story.activeSlide();
    return slide ? storySectionIdFromFileName(slide.name) : null;
  });
  readonly savedScript = computed(() => {
    const sectionId = this.activeSectionId();
    return sectionId ? this.scripts.section(sectionId)?.text ?? '' : '';
  });
  readonly scriptPreview = computed(() => renderStoryMarkdown(this.scriptDraft()));
  readonly scriptIsDirty = computed(() => this.scriptDraft() !== this.savedScript());
  readonly hasDuplicateSectionId = computed(() => {
    const sectionId = this.activeSectionId();
    if (!sectionId) return false;
    return this.story.slides().filter(
      (slide) => storySectionIdFromFileName(slide.name) === sectionId,
    ).length > 1;
  });

  constructor() {
    effect(() => {
      const sectionId = this.activeSectionId();
      const section = sectionId ? this.scripts.section(sectionId) : null;
      const version = `${sectionId ?? ''}\u0000${section?.lastUpdated ?? 0}\u0000${section?.text ?? ''}`;
      if (version === this.loadedSectionVersion) return;

      this.loadedSectionVersion = version;
      this.scriptDraft.set(section?.text ?? '');
      this.scriptEditing.set(!(section?.text ?? '').trim());
      this.scriptMessage.set(null);
      this.scriptError.set(null);
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    const added = this.story.addFiles(files, this.insertBeforeSlideId());
    if (added > 0) this.insertBeforeSlideId.set(null);
    this.uploadMessage.set(
      added > 0
        ? `Добавлено изображений: ${added}`
        : 'Подходящие изображения не найдены.',
    );
  }

  setInsertBeforeSlide(event: Event): void {
    this.insertBeforeSlideId.set((event.target as HTMLSelectElement).value || null);
  }

  onDragStart(slideId: string, event: DragEvent): void {
    this.draggedSlideId.set(slideId);
    event.dataTransfer?.setData('text/plain', slideId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onDrop(targetSlideId: string, event: DragEvent): void {
    event.preventDefault();
    const sourceSlideId = this.draggedSlideId() || event.dataTransfer?.getData('text/plain');
    this.draggedSlideId.set(null);
    if (sourceSlideId) this.story.moveSlideBefore(sourceSlideId, targetSlideId);
  }

  stopDragging(): void {
    this.draggedSlideId.set(null);
  }

  moveSlide(slideId: string, offset: -1 | 1, event: Event): void {
    event.stopPropagation();
    this.story.moveSlide(slideId, offset);
  }

  removeSlide(slideId: string, event: Event): void {
    event.stopPropagation();
    this.story.removeSlide(slideId);
  }

  storySectionIdFromFileName(fileName: string): string {
    return storySectionIdFromFileName(fileName);
  }

  onScriptInput(event: Event): void {
    this.scriptDraft.set((event.target as HTMLTextAreaElement).value);
    this.scriptMessage.set(null);
    this.scriptError.set(null);
  }

  resetScriptDraft(): void {
    this.scriptDraft.set(this.savedScript());
    this.scriptEditing.set(false);
    this.scriptMessage.set(null);
    this.scriptError.set(null);
  }

  startScriptEditing(): void {
    this.scriptEditing.set(true);
    this.scriptMessage.set(null);
    this.scriptError.set(null);
  }

  async saveScript(): Promise<void> {
    const sectionId = this.activeSectionId();
    if (!sectionId || this.scriptSaving()) return;

    this.scriptSaving.set(true);
    this.scriptMessage.set(null);
    this.scriptError.set(null);
    try {
      await this.scripts.saveSection(sectionId, this.scriptDraft());
      this.scriptEditing.set(false);
      this.scriptMessage.set(`Сюжет «${sectionId}» сохранён.`);
    } catch (error) {
      this.logger.error('DmStoryComponent.saveScript', error);
      this.scriptError.set('Не удалось сохранить сюжет. Текст оставлен в редакторе — попробуйте ещё раз.');
    } finally {
      this.scriptSaving.set(false);
    }
  }
}
