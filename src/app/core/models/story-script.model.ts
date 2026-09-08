export interface StoryScriptSection {
  id: string;
  text: string;
  createdAt: number;
  lastUpdated: number;
  /** Persisted slide order; absent until the DM reorders the deck at least once. */
  order?: number;
}
