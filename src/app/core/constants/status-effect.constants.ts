export const STATUS_EFFECT_TYPE = {
  POISONED: 'poisoned',
  BURNING: 'burning',
  FROZEN: 'frozen',
  FRIGHTENED: 'frightened',
  BLEEDING: 'bleeding',
  STUNNED: 'stunned',
  RESTRAINED: 'restrained',
  BLESSED: 'blessed',
  PRONE: 'prone',
  BLINDED: 'blinded',
  PARALYZED: 'paralyzed',
  INVISIBLE: 'invisible',
  CHARMED: 'charmed',
  GRAPPLED: 'grappled',
  UNCONSCIOUS: 'unconscious',
  EXHAUSTED: 'exhausted',
  INCAPACITATED: 'incapacitated',
  DEAFENED: 'deafened',
  PETRIFIED: 'petrified',
  RESOURCE_ACTIVE: 'resource-active',
} as const;

export type StatusEffectType = (typeof STATUS_EFFECT_TYPE)[keyof typeof STATUS_EFFECT_TYPE];

export const STATUS_EFFECT_TRIGGER = {
  TURN_START: 'turn-start',
  TURN_END: 'turn-end',
} as const;

export type StatusEffectTrigger =
  (typeof STATUS_EFFECT_TRIGGER)[keyof typeof STATUS_EFFECT_TRIGGER];

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
  {
    type: STATUS_EFFECT_TYPE.PRONE,
    label: 'Сбит с ног',
    icon: '💢',
    description: 'Существо лежит и должно потратить движение, чтобы встать.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.BLINDED,
    label: 'Ослеплён',
    icon: '🙈',
    description: 'Существо не видит окружающее.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.PARALYZED,
    label: 'Парализован',
    icon: '⚡',
    description: 'Существо не может двигаться и действовать.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.INVISIBLE,
    label: 'Невидим',
    icon: '👻',
    description: 'Существо невидимо без помощи магии или особого чувства.',
    beneficial: true,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.CHARMED,
    label: 'Очарован',
    icon: '💖',
    description: 'Существо находится под влиянием другого существа.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.GRAPPLED,
    label: 'Схвачен',
    icon: '🤝',
    description: 'Скорость существа равна нулю.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.UNCONSCIOUS,
    label: 'Без сознания',
    icon: '💤',
    description: 'Существо не может двигаться и действовать.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.EXHAUSTED,
    label: 'Истощение',
    icon: '🪫',
    description: 'Уровень истощения и его эффекты отслеживаются ДМом.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.INCAPACITATED,
    label: 'Недееспособен',
    icon: '⛔',
    description: 'Существо не может совершать действия.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.DEAFENED,
    label: 'Оглохший',
    icon: '🔇',
    description: 'Существо ничего не слышит и автоматически проваливает проверки, требующие слуха.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.PETRIFIED,
    label: 'Окаменевший',
    icon: '🗿',
    description: 'Существо и всё его немагическое снаряжение превращены в твёрдое вещество.',
    beneficial: false,
    damageCapable: false,
  },
  {
    type: STATUS_EFFECT_TYPE.RESOURCE_ACTIVE,
    label: 'Активный ресурс',
    icon: '⚡',
    description: 'Активная способность или классовый ресурс персонажа.',
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
import { StatusEffectDefinition } from '../models/status-effect-definition.model';
