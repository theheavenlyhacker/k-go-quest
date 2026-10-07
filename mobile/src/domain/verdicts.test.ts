import { describe, expect, it } from 'vitest';
import { COINS_PER_CORRECT, learningState, type Attempt } from './engine';
import { balance } from './shop';
import type { Pack } from './types';

const SKILL = 'math5.fractions.add';
const PARAMS = { prior: 0.2, learn: 0.1, guess: 0.2, slip: 0.1 };
const pack = (keys: (number | null)[]): Pack => ({
  id: 'p', title: 'P', subject: 'MATH', grade: 5, version: '1', grading: 'ON_SYNC', skills: [{ id: SKILL, parameters: PARAMS }],
  lessons: [{ id: 'l', packId: 'p', title: 'L', skillCode: SKILL, body: '', hints: {}, exercises: keys.map((k, i) => ({ id: `e${i}`, lessonId: 'l', prompt: '', options: ['a', 'b'], correctOption: k })) }],
});
const attempt = (id: string, exerciseId: string, selectedOption: number, t = 0): Attempt => ({ id, exerciseId, selectedOption, at: new Date(Date.UTC(2026, 9, 1, 0, 0, t)).toISOString() });
const done = (correct: boolean, balance: number, ackedAt = 1) => ({ state: 'DONE' as const, correct, balance, ackedAt });
const mastery = (s: ReturnType<typeof learningState>) => s.skills.find((k) => k.skillId === SKILL)?.mastery;

describe('an ON_SYNC Unmarked Attempt', () => {
  const log = [attempt('a1', 'e0', 0)];
  it('moves nothing until the server grades it', () => {
    const s = learningState([pack([null])], log, new Map());
    expect(mastery(s)).toBeUndefined();
    expect(s.coins).toBe(0);
    expect(s.statuses.get('a1')).toBe('unmarked');
  });
  it('becomes a Counted Attempt with a correct verdict, once, however often the verdict is replayed', () => {
    const uploads = new Map([['a1', done(true, COINS_PER_CORRECT)]]);
    const s = learningState([pack([null])], log, uploads);
    expect(mastery(s)).toBeGreaterThan(PARAMS.prior);
    expect(s.coins).toBe(COINS_PER_CORRECT);
    expect(s.statuses.get('a1')).toBe('marked');
    expect(learningState([pack([null])], log, new Map(uploads))).toEqual(s);
  });
  it('counts a wrong verdict as an attempt that earns nothing', () => {
    const s = learningState([pack([null])], log, new Map([['a1', done(false, 0)]]));
    expect(mastery(s)).toBeLessThan(PARAMS.prior);
    expect(s.coins).toBe(0);
  });
});

describe('an ON_DEVICE Attempt the server marks differently', () => {
  const log = [attempt('a1', 'e0', 0)];
  it('is recomputed from the server verdict and labelled corrected', () => {
    const p = [pack([0])];
    const before = learningState(p, log, new Map());
    expect(before.coins).toBe(COINS_PER_CORRECT);
    const after = learningState(p, log, new Map([['a1', done(false, 0)]]));
    expect(after.coins).toBe(0);
    expect(mastery(after)).toBeLessThan(mastery(before)!);
    expect(after.statuses.get('a1')).toBe('corrected');
  });
  it('leaves an agreeing verdict as plain graded', () => {
    expect(learningState([pack([0])], log, new Map([['a1', done(true, COINS_PER_CORRECT)]])).statuses.get('a1')).toBe('graded');
  });
  it('still counts only the first Attempt at an Exercise', () => {
    const two = [attempt('a1', 'e0', 1, 0), attempt('a2', 'e0', 0, 1)];
    const s = learningState([pack([null])], two, new Map([['a1', done(false, 0)], ['a2', done(true, 0, 2)]]));
    expect(s.skills[0].counted).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.statuses.get('a2')).toBe('practice');
  });
});

describe('wallet reconciliation', () => {
  const p = [pack([null, null, null])];
  const log = [attempt('a1', 'e0', 0, 0), attempt('a2', 'e1', 0, 1), attempt('a3', 'e2', 0, 2)];
  it('follows the server balance, so a duplicate resend is not paid twice', () => {
    // a2 was sent twice: the server awarded it once, and its balance after the resend is unchanged.
    const uploads = new Map([['a1', done(true, 5, 1)], ['a2', done(true, 10, 2)]]);
    expect(learningState(p, log, uploads).coins).toBe(10);
    uploads.set('a2', done(true, 10, 3));
    expect(learningState(p, log, uploads).coins).toBe(10);
  });
  it('adds answers the server has not confirmed yet on top of its balance', () => {
    const uploads = new Map([['a1', done(true, 5, 1)]]);
    const ondevice = [pack([null, 0, null])];
    expect(learningState(ondevice, log, uploads).coins).toBe(5 + COINS_PER_CORRECT);
  });
  it('lets the server lower the balance without taking back a Cosmetic', () => {
    const uploads = new Map([['a1', done(true, 0, 1)], ['a2', done(true, 0, 1)], ['a3', done(true, 0, 1)]]);
    const earned = learningState(p, log, uploads).coins;
    expect(earned).toBe(0);
    const bought = [{ cosmeticId: 'badge-star', price: 25, at: '2026-10-01T00:00:00.000Z' }];
    expect(balance(earned, bought)).toBe(-25); // already owned; future earnings pay it down
  });
  it('is unchanged for an Unlinked Profile, which has no uploads', () => {
    expect(learningState([pack([0, 0, 0])], log, new Map()).coins).toBe(COINS_PER_CORRECT * 3);
  });
});
