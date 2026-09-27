/** Shared by imported sheets, normalized saves, weapon attacks and presentation. */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
