import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StoryPresentationService } from '../../../core/services/story-presentation.service';

@Component({
  selector: 'app-dm-story',
  standalone: true,
  templateUrl: './dm-story.component.html',
  styleUrl: './dm-story.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmStoryComponent {
  readonly story = inject(StoryPresentationService);
  readonly draggedSlideId = signal<string | null>(null);
  readonly uploadMessage = signal<string | null>(null);

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    const added = this.story.addFiles(files);
    this.uploadMessage.set(
      added > 0
        ? `Добавлено изображений: ${added}`
        : 'Подходящие изображения не найдены.',
    );
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
}
