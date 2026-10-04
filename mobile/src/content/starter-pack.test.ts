import { FITTED_SKILL_PARAMETERS } from './fitted-parameters';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILL_PARAMETERS, starterPacks } from './starter-pack';

const lessons = starterPacks.flatMap((p) => p.lessons);
const exercises = lessons.flatMap((l) => l.exercises);

describe('Starter Pack', () => {
  it('gives every Exercise 2 to 6 options and exactly one in-range correct option', () => {
    for (const e of exercises) {
      expect(e.options.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.options.length, e.id).toBeLessThanOrEqual(6);
      expect(Number.isInteger(e.correctOption) && e.correctOption >= 0 && e.correctOption < e.options.length, e.id).toBe(true);
      expect(new Set(e.options).size, `${e.id} repeats an option`).toBe(e.options.length);
    }
  });

  it('gives Math 3 Skills with at least 8 Exercises each', () => {
    const math = starterPacks.find((p) => p.subject === 'MATH')!;
    expect(math.skills).toHaveLength(3);
    for (const s of math.skills) {
      const count = math.lessons.filter((l) => l.skillCode === s.id).flatMap((l) => l.exercises).length;
      expect(count, s.id).toBeGreaterThanOrEqual(8);
    }
  });

  it('gives every Lesson one known Skill and an English Hint', () => {
    for (const p of starterPacks) {
      for (const l of p.lessons) {
        expect(p.skills.some((s) => s.id === l.skillCode), l.id).toBe(true);
        expect(l.hints.en?.trim(), l.id).toBeTruthy();
      }
    }
  });

  it('gives every Skill a pack-prefixed ID and parameters', () => {
    for (const p of starterPacks) for (const s of p.skills) {
      expect(s.id.startsWith(`${p.id}.`), s.id).toBe(true);
      expect(s.parameters).toEqual(FITTED_SKILL_PARAMETERS[s.id] ?? DEFAULT_SKILL_PARAMETERS);
      expect(Object.keys(FITTED_SKILL_PARAMETERS)).toContain(s.id);
    }
  });

  it('repeats no ID', () => {
    const ids = [...starterPacks.map((p) => p.id), ...starterPacks.flatMap((p) => p.skills.map((s) => s.id)), ...lessons.map((l) => l.id), ...exercises.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains no Khan naming', () => {
    expect(JSON.stringify(starterPacks)).not.toMatch(/khan/i);
  });
});

describe('Hints', () => {
  it('gives every Lesson a Hint in en, tl, ceb and ilo', () => {
    for (const l of lessons) for (const code of ['en', 'tl', 'ceb', 'ilo']) expect(l.hints[code]?.trim(), `${l.id} ${code}`).toBeTruthy();
  });
});
