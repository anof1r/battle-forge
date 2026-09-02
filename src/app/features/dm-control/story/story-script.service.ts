import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  FIREBASE_ROOT,
  mainStorySectionPath,
} from '../../../core/constants/firebase-paths.constants';
import { StoryScriptSection } from '../../../core/models';
import { FirebaseService } from '../../../core/services/firebase.service';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({ providedIn: 'root' })
export class StoryScriptService {
  private readonly firebase = inject(FirebaseService);
  private readonly logger = inject(LoggerService);
  private readonly records = toSignal(
    this.firebase
      .subscribe<Record<string, Partial<StoryScriptSection>>>(FIREBASE_ROOT.MAIN_STORY_SECTIONS)
      .pipe(
        catchError((error: unknown) => {
          this.logger.error('StoryScriptService.subscribe', error);
          return of(null);
        }),
      ),
    { initialValue: null },
  );

  readonly sections = computed<Record<string, StoryScriptSection>>(() =>
    Object.fromEntries(
      Object.entries(this.records() ?? {}).map(([id, section]) => [
        id,
        this.normalize(id, section),
      ]),
    ),
  );

  section(sectionId: string): StoryScriptSection | null {
    return this.sections()[sectionId] ?? null;
  }

  async saveSection(sectionId: string, text: string): Promise<void> {
    const id = sectionId.trim();
    if (!id) throw new Error('Story section id is required.');

    const now = Date.now();
    const existing = this.section(id);
    const section: StoryScriptSection = {
      id,
      text,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.firebase.set(mainStorySectionPath(id), section);
  }

  private normalize(id: string, section: Partial<StoryScriptSection>): StoryScriptSection {
    return {
      id,
      text: typeof section.text === 'string' ? section.text : '',
      createdAt: Number.isFinite(section.createdAt) ? Number(section.createdAt) : 0,
      lastUpdated: Number.isFinite(section.lastUpdated) ? Number(section.lastUpdated) : 0,
    };
  }
}
