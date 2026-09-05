import { describe, expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import ru from '../../../../public/i18n/ru.json';
import { CHARACTER_SKILL_DEFINITIONS } from '../constants/character-skill.constants';

describe('character skill translations', () => {
  it('defines English and Russian labels for every supported skill', () => {
    const englishSkills = en.character.skills as Record<string, string>;
    const russianSkills = ru.character.skills as Record<string, string>;

    for (const skill of CHARACTER_SKILL_DEFINITIONS) {
      expect(englishSkills[skill.id]).toBeTruthy();
      expect(russianSkills[skill.id]).toBeTruthy();
    }

    expect(Object.keys(englishSkills)).toHaveLength(CHARACTER_SKILL_DEFINITIONS.length);
    expect(Object.keys(russianSkills)).toHaveLength(CHARACTER_SKILL_DEFINITIONS.length);
  });
});
