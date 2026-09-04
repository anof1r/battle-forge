export interface LibrarySource {
  provider: 'open5e';
  key: string;
  documentKey: string;
  documentName: string;
  permalink: string;
  originalName: string;
  originalDescription: string;
  contentLanguage?: 'en' | 'ru';
  importedAt: number;
}
