export interface StoryScriptSection {
  id: string;
  text: string;
  createdAt: number;
  lastUpdated: number;
  /** Legacy position from before slides were stored on the server; only used to order a first upload. */
  order?: number;
}
