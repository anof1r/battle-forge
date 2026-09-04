import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  AppLanguage,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  isAppLanguage,
} from './i18n.constants';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly activeLanguage = signal<AppLanguage>(this.readInitialLanguage());

  constructor() {
    effect(() => {
      const language = this.activeLanguage();
      this.transloco.setActiveLang(language);
      this.document.documentElement.lang = language;
      this.persistLanguage(language);
    });
  }

  setLanguage(language: string): void {
    if (isAppLanguage(language)) this.activeLanguage.set(language);
  }

  private readInitialLanguage(): AppLanguage {
    try {
      const stored = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
      return isAppLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  private persistLanguage(language: AppLanguage): void {
    try {
      globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The app remains usable when storage is blocked or unavailable.
    }
  }
}
