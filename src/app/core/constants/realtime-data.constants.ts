export const REALTIME_DATA_ENDPOINT = '/api/data';

export const REALTIME_DATA_EVENT = {
  CHANGED: 'data:changed',
  SUBSCRIBE: 'data:subscribe',
  UNSUBSCRIBE: 'data:unsubscribe',
} as const;
