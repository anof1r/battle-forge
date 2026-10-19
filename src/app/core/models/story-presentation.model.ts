export type DisplayPresentationMode = 'battle' | 'story';

/** Reference to an image stored under the server media volume. */
export interface StorySlideMedia {
  key: string;
  version: number;
}

/** Persisted slide record stored under `dm-library/slides`. */
export interface StorySlideRecord {
  id: string;
  name: string;
  /** Key of the teleprompter section linked to this slide. */
  sectionId: string;
  order: number;
  media: StorySlideMedia;
  createdAt: number;
  lastUpdated: number;
}

export interface StorySlide extends StorySlideRecord {
  url: string;
}

/** Shared document describing what the display shows right now (`settings/presentation`). */
export interface StoryPresentationState {
  mode: DisplayPresentationMode;
  activeSlideId?: string | null;
  lastUpdated: number;
}

export interface StorySlideUploadResponse {
  slide: StorySlideRecord;
}

export interface StorySlideUploadResult {
  added: number;
  failed: number;
}
