/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Attempt } from './engine';
import { gradingLabel, gradingMode, lessonProgress } from './grading-mode';
import type { Exercise, Lesson, Pack } from './types';

const SKILL = 'math5.fractions.add';
const PARAMS = { prior: 0.197444, learn: 0.100313, guess: 0.201734, slip: 0.081312 };

const ex = (id: string, correctOption: number | null): Exercise =>
  ({ id, lessonId: 'l', prompt: '', options: ['a', 'b'], correctOption });

const lesson = (id: string, exercises: Exercise[]): Lesson =>
  ({ id, packId: 'p', title: 'L', skillCode: SKILL, body: '', hints: {}, exercises: exercises.map((e) => ({ ...e, lessonId: id })) });

/** `grading` is deliberately wrong on every fixture: nothing may consult it. */
const pack = (lessons: Lesson[]): Pack =>
  ({ id: 'p', title: 'P', subject: 'MATH', grade: 5, version: '1.0.0', grading: 'ON_DEVICE', skills: [{ id: SKILL, parameters: PARAMS }], lessons });

const attempt = (exerciseId: string): Attempt =>
  ({ id: `a-${exerciseId}`, exerciseId, selectedOption: 0, at: '2026-10-01T01:00:00.000Z' });

describe('gradingMode', () => {
  it('reads On Device from a Lesson whose Exercises all carry the answer key', () => {
    expect(gradingMode(lesson('l1', [ex('a', 0), ex('b', 1)]))).toBe('ON_DEVICE');
  });

  it('reads On Sync from a Lesson the server sent without its answer key', () => {
    expect(gradingMode(lesson('l1', [ex('a', null), ex('b', null)]))).toBe('ON_SYNC');
  });

  it('reads Mixed rather than picking a wrong side', () => {
    expect(gradingMode(lesson('l1', [ex('a', 0), ex('b', null)]))).toBe('MIXED');
  });

  it('ignores Pack.grading, which is authoritative for nothing', () => {
    const downloaded = pack([lesson('l1', [ex('a', null)])]);
    expect(downloaded.grading).toBe('ON_DEVICE');
    expect(gradingMode(downloaded)).toBe('ON_SYNC');
  });

  it('reads Mixed from a Pack whose Lessons disagree', () => {
    expect(gradingMode(pack([lesson('l1', [ex('a', 0)]), lesson('l2', [ex('b', null)])]))).toBe('MIXED');
  });

  it('treats a Lesson with no Exercises as On Device, since no key is missing', () => {
    expect(gradingMode(lesson('l1', []))).toBe('ON_DEVICE');
  });
});

describe('the real Starter Pack', () => {
  it('reads On Device, so the offline path is unchanged', async () => {
    const { starterPacks } = await import('../content/starter-pack');
    expect(starterPacks.length).toBeGreaterThan(0);
    for (const starter of starterPacks) expect(gradingMode(starter)).toBe('ON_DEVICE');
  });
});

describe('gradingLabel', () => {
  it('words each mode for a Learner', () => {
    expect(gradingLabel('ON_DEVICE')).toBe('On device');
    expect(gradingLabel('ON_SYNC')).toBe('Marked on sync');
    expect(gradingLabel('MIXED')).toBe('Partly marked on sync');
  });
});

describe('lessonProgress', () => {
  const unmarked = lesson('l1', [ex('d1', null)]);

  it('is Not started when the Learner has never answered', () => {
    expect(lessonProgress(unmarked, undefined, [])).toBe('NOT_STARTED');
  });

  it('is Waiting for the server when answered but unmarked — not Not started', () => {
    expect(lessonProgress(unmarked, undefined, [attempt('d1')])).toBe('WAITING_FOR_SERVER');
  });

  it('is Measured once Mastery exists', () => {
    expect(lessonProgress(lesson('l1', [ex('s1', 0)]), 0.42, [attempt('s1')])).toBe('MEASURED');
  });

  it('ignores Attempts on other Lessons', () => {
    expect(lessonProgress(unmarked, undefined, [attempt('somewhere-else')])).toBe('NOT_STARTED');
  });
});

/**
 * The screens have no render seam on this project — no jsdom, no testing
 * library — so this is the only guard available against a Grading Mode being
 * stated from a literal again. It is weaker than a render test: it proves the
 * literal is gone, not that the right label appears.
 */
describe('no screen states a Grading Mode from a literal', () => {
  const screen = (relative: string) =>
    readFileSync(fileURLToPath(new URL(`../app/${relative}`, import.meta.url)), 'utf8');

  it('the Subjects list derives its Pill', () => {
    expect(screen('(student)/learn.tsx')).not.toMatch(/>On device</);
  });

  it('the Subject screen derives its caption', () => {
    expect(screen('subject.tsx')).not.toMatch(/· on device/);
  });
});
