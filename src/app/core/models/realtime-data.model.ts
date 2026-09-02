export interface RealtimeDataChangedEvent<T = unknown> {
  path: string;
  value: T | null;
}

export interface RealtimeDataSubscription {
  path: string;
}

export interface RealtimeMutationResponse {
  success: true;
}
