/**
 * Parses JSON while recovering the common LSS export defect of a comma directly
 * before an object/array terminator. Commas inside strings are never changed.
 */
export function parseJsonWithTrailingCommaRecovery<T>(input: string): T {
  try {
    return JSON.parse(input) as T;
  } catch (originalError) {
    const recovered = removeTrailingJsonCommas(input);
    if (recovered === input) throw originalError;
    return JSON.parse(recovered) as T;
  }
}

export function removeTrailingJsonCommas(input: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ',') {
      let nextIndex = index + 1;
      while (nextIndex < input.length && /\s/.test(input[nextIndex])) nextIndex += 1;
      if (input[nextIndex] === '}' || input[nextIndex] === ']') continue;
    }

    result += character;
  }

  return result;
}
