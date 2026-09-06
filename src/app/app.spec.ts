import { TranslocoService } from '@jsverse/transloco';
import { LANGUAGE_STORAGE_KEY } from './core/i18n/i18n.constants';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));
  it('renders the router outlet', () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });
  it('restores the interface language before opening a route', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ru');
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('ru');
  });
});
