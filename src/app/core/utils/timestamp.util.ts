/** Stamps a Firebase-bound payload with a fresh `lastUpdated` timestamp. */
export function withTimestamp<T extends object>(
  data: T,
  now = Date.now(),
): T & { lastUpdated: number } {
  return { ...data, lastUpdated: now };
}
