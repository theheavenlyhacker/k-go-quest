import { describe, expect, it } from 'vitest';
import { gradeLabel, storageLabel } from './sidebar';

describe('gradeLabel', () => {
  it('uses the highest grade among the Packs', () => expect(gradeLabel([{ grade: 3 }, { grade: 5 }])).toBe('Grade 5'));
  it('falls back to Learner with no Packs', () => expect(gradeLabel([])).toBe('Learner'));
});

describe('storageLabel', () => {
  it('picks a readable unit', () => {
    expect(storageLabel(512)).toBe('512 B');
    expect(storageLabel(2048)).toBe('2 KB');
    expect(storageLabel(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
