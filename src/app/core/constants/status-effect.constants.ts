export const STATUS_EFFECT_TYPE = {
  POISONED: 'poisoned',
  BURNING: 'burning',
  FROZEN: 'frozen',
  FRIGHTENED: 'frightened',
  BLEEDING: 'bleeding',
  STUNNED: 'stunned',
  RESTRAINED: 'restrained',
  BLESSED: 'blessed',
} as const;

export type StatusEffectType = (typeof STATUS_EFFECT_TYPE)[keyof typeof STATUS_EFFECT_TYPE];

export const STATUS_EFFECT_TRIGGER = {
  TURN_START: 'turn-start',
  TURN_END: 'turn-end',
} as const;

export type StatusEffectTrigger =
  (typeof STATUS_EFFECT_TRIGGER)[keyof typeof STATUS_EFFECT_TRIGGER];

export interface StatusEffectDefinition {
  type: StatusEffectType;
  label: string;
  icon: string;
  description: string;
  beneficial: boolean;
  damageCapable: boolean;
}

export const STATUS_EFFECT_DEFINITIONS: readonly StatusEffectDefinition[] = [
  {
    type: STATUS_EFFECT_TYPE.POISONED,
    label: 'Отравление',
    icon: '☠️',
    description: 'Яд ослабляет существо.',
    beneficial: false,
    damageCapable: true,
  },
  {
    type: STATUS_EFFECT_TYPE.BURNING,
    label: 'Горение',
    icon: '🔥',
    description: 'Существо охвачено пламенем.',
    beneficial: false,
    damageCapable: true,
  },
  {
    type: STATUS_EFFECT_TYPE.FROZEN,
    label: 'Заморозка',
    icon: '❄️',
    description: 'Лёд сковывает движения.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.FRIGHTENED,
    label: 'Страх',
    icon: '👁️',
    description: 'Существо охвачено ужасом.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.BLEEDING,
    label: 'Кровотечение',
    icon: '🩸',
    description: 'Открытая рана продолжает кровоточить.',
    beneficial: false,
    damageCapable: true,
  },
  {
    type: STATUS_EFFECT_TYPE.STUNNED,
    label: 'Оглушение',
    icon: '💫',
    description: 'Существо дезориентировано.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.RESTRAINED,
    label: 'Опутан',
    icon: '⛓️',
    description: 'Движения существа ограничены.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.BLESSED,
    label: 'Благословение',
    icon: '✨',
    description: 'Существо окружено благотворной магией.',
    beneficial: true,
    damageCapable: false,
  },
] as const;

export function getStatusEffectDefinition(type: StatusEffectType): StatusEffectDefinition {
  return (
    STATUS_EFFECT_DEFINITIONS.find((effect) => effect.type === type) ?? {
      type,
      label: 'Неизвестный эффект',
      icon: '❔',
      description: 'Эффект из более новой или пользовательской версии данных.',
      beneficial: false,
      damageCapable: false,
    }
  );
}
