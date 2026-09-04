import '@testing-library/jest-dom/vitest';
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { inject, provideEnvironmentInitializer } from '@angular/core';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import english from '../public/i18n/en.json';
import russian from '../public/i18n/ru.json';

class TestTranslocoLoader implements TranslocoLoader {
  getTranslation(language: string): Observable<Translation> {
    return of(language === 'ru' ? russian : english);
  }
}

setupTestBed({
  zoneless: false,
  providers: [
    provideTransloco({
      config: {
        availableLangs: ['en', 'ru'],
        defaultLang: 'ru',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: true,
      },
      loader: TestTranslocoLoader,
    }),
    provideEnvironmentInitializer(() => {
      const transloco = inject(TranslocoService);
      transloco.setTranslation(english, 'en');
      transloco.setTranslation(russian, 'ru');
      transloco.setActiveLang('ru');
    }),
  ],
});
