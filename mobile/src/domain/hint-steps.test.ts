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
  it('is empty for no Hint', () => {
    expect(hintSteps('  ')).toEqual([]);
  });
});
