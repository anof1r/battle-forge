import { EnvironmentProviders, Type, isDevMode } from '@angular/core';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './i18n.constants';
import { TranslocoHttpLoader } from './transloco-http.loader';

export function provideBattleForgeI18n(
  loader: Type<TranslocoLoader> = TranslocoHttpLoader,
): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: SUPPORTED_LANGUAGES.map(({ code }) => code),
      defaultLang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: {
        logMissingKey: isDevMode(),
        useFallbackTranslation: true,
        allowEmpty: false,
      },
    },
    loader,
  });
}
