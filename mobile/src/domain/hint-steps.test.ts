import { describe, expect, it } from 'vitest';
import { hintSteps } from './hint-steps';

describe('hintSteps', () => {
  it('splits a Hint into sentences, one step each', () => {
    expect(hintSteps('Make the denominators match. Add the numerators. Keep the denominator.')).toEqual([
      'Make the denominators match.', 'Add the numerators.', 'Keep the denominator.',
    ]);
  });
  it('prefers lines and drops list numbering', () => {
    expect(hintSteps('1. Find the LCD\n2) Rewrite both fractions\n\n3. Add')).toEqual(['Find the LCD', 'Rewrite both fractions', 'Add']);
  });
  it('does not split inside a decimal or fraction', () => {
    expect(hintSteps('Write 0.5 as 1/2. Then compare.')).toEqual(['Write 0.5 as 1/2.', 'Then compare.']);
  });
  it('does not split after an abbreviation', () => {
    expect(hintSteps('Use a common denominator, e.g. 12 for 3 and 4. Then add 1/2 and 1/3.')).toEqual([
      'Use a common denominator, e.g. 12 for 3 and 4.', 'Then add 1/2 and 1/3.',
    ]);
  });
  it('is empty for no Hint', () => {
    expect(hintSteps('  ')).toEqual([]);
  });
});
