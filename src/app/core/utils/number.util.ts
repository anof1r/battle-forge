/** Normalizes numeric form input; never returns NaN, Infinity or a fraction. */
export function clampInteger(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const number = Number(value);
  const integer = Number.isFinite(number) ? Math.floor(number) : minimum;
  return Math.max(minimum, Math.min(maximum, integer));
}

/** Domain commands reject invalid quantities instead of silently changing their cost. */
export function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
