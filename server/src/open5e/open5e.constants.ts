export const OPEN5E_API_ROOT = 'https://api.open5e.com/v2';

export const OPEN5E_RESOURCES = ['spells', 'creatures', 'items'] as const;
export type Open5eResource = (typeof OPEN5E_RESOURCES)[number];

export const OPEN5E_ALLOWED_PARAMS = [
  'name__icontains',
  'limit',
  'document__key__in',
  'is_weapon',
] as const;

export const OPEN5E_DEFAULT_LIMIT = 30;
export const OPEN5E_MAX_LIMIT = 50;
export const OPEN5E_TIMEOUT_MS = 8000;
