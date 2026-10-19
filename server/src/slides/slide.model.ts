export const SLIDES_PATH = 'dm-library/slides';
export const PRESENTATION_PATH = 'settings/presentation';

export interface SlideMedia {
  key: string;
  version: number;
}

export interface SlideRecord {
  id: string;
  name: string;
  sectionId: string;
  order: number;
  media: SlideMedia;
  createdAt: number;
  lastUpdated: number;
}

export interface SlideUploadResponse {
  slide: SlideRecord;
}
