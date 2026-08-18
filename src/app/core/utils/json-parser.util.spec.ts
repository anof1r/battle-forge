import { describe, expect, it } from 'vitest';
import {
  parseJsonWithTrailingCommaRecovery,
  removeTrailingJsonCommas,
} from './json-parser.util';

describe('JSON trailing-comma recovery', () => {
  it('removes trailing commas from nested objects and arrays', () => {
    expect(
      parseJsonWithTrailingCommaRecovery('{"items":[1,2,],"meta":{"valid":true,},}'),
    ).toEqual({ items: [1, 2], meta: { valid: true } });
  });

  it('does not alter comma-like text or escaped quotes inside strings', () => {
    const source = '{"text":"keep ,} and ,] and \\\"quoted,}\\\"",}';

    expect(removeTrailingJsonCommas(source)).toBe(
      '{"text":"keep ,} and ,] and \\\"quoted,}\\\""}',
    );
    expect(parseJsonWithTrailingCommaRecovery<{ text: string }>(source).text).toBe(
      'keep ,} and ,] and "quoted,}"',
    );
  });

  it('still rejects malformed JSON unrelated to trailing commas', () => {
    expect(() => parseJsonWithTrailingCommaRecovery('{"value":,}')).toThrow(SyntaxError);
  });
});
