export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'ru', label: 'Русский', locale: 'ru-RU' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'battle-forge.language';

export function isAppLanguage(value: string | null): value is AppLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value);
}
