const WEAPON_STAT_LABELS: Readonly<Record<string, string>> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
};

const ENGLISH_STAT_PATTERN = /\[?(STR|DEX|CON|INT|WIS|CHA)\]?/giu;
const RUSSIAN_STAT_PATTERN = /(?:СИЛ|ЛОВ|ТЕЛ|ИНТ|МДР|ХАР)/u;

export function formatWeaponDamageFormula(
  damage: unknown,
  rawAbility: unknown = 'str',
): string {
  const baseFormula = typeof damage === 'string' && damage.trim() ? damage.trim() : '1d4';
  const translatedFormula = baseFormula.replace(
    ENGLISH_STAT_PATTERN,
    (match) => WEAPON_STAT_LABELS[match.replaceAll('[', '').replaceAll(']', '').toLowerCase()] ?? match,
  );
  if (RUSSIAN_STAT_PATTERN.test(translatedFormula)) return translatedFormula;

  const ability = typeof rawAbility === 'string'
    ? rawAbility.trim().replaceAll('[', '').replaceAll(']', '').toLowerCase()
    : '';
  const abilityLabel = WEAPON_STAT_LABELS[ability];
  return abilityLabel ? `${translatedFormula} + ${abilityLabel}` : translatedFormula;
}
