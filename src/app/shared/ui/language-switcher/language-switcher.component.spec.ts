import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGE_STORAGE_KEY } from '../../../core/i18n/i18n.constants';
import { LanguageService } from '../../../core/i18n/language.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

describe('LanguageSwitcherComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [LanguageSwitcherComponent] });
    TestBed.inject(TranslocoService).setActiveLang('en');
  });

  it('uses English by default and persists a language change', () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    const language = TestBed.inject(LanguageService);
    fixture.detectChanges();

    expect(language.activeLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'ru';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(language.activeLanguage()).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
  });
});
