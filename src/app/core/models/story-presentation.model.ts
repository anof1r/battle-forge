export type DisplayPresentationMode = 'battle' | 'story';

export interface StorySlide {
  id: string;
  name: string;
  blob: Blob;
  objectUrl: string;
}

export interface StorySlideTransfer {
  id: string;
  name: string;
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
