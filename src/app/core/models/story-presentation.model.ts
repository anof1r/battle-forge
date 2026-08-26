export type DisplayPresentationMode = 'battle' | 'story';

export interface StorySlide {
  id: string;
  name: string;
  order: number;
  blob: Blob;
  objectUrl: string;
}

export interface StorySlideTransfer {
  id: string;
  name: string;
  /** Optional only for compatibility with tabs running an older app version. */
  order?: number;
  blob: Blob;
}

export type StoryPresentationMessage =
  | { type: 'request-state' }
  | {
      type: 'deck-state';
      mode: DisplayPresentationMode;
      activeSlideId: string | null;
      slides: StorySlideTransfer[];
    }
  | {
      type: 'presentation-state';
      mode: DisplayPresentationMode;
      activeSlideId: string | null;
    };
