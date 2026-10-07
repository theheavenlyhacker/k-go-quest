import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILL_PARAMETERS, starterPacks as fittedPacks } from '../content/starter-pack';
import { COINS_PER_CORRECT, MASTERED_AT, PLATEAU_ATTEMPTS, PLATEAU_BELOW, demoHistory, grade, growth, learningState, quests, updateMastery, type Attempt } from './engine';

const NOW = '2026-01-01T00:00:00.000Z';
const P = DEFAULT_SKILL_PARAMETERS;
// Pin the textbook numbers so these tests check the arithmetic, not the fitted values.
const starterPacks = fittedPacks.map((p) => ({ ...p, skills: p.skills.map((s) => ({ ...s, parameters: P })) }));
const skill = 'math5.fractions.equivalent';
const exs = starterPacks.flatMap((p) => p.lessons).filter((l) => l.skillCode === skill).flatMap((l) => l.exercises);
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
/** The Starter Pack is graded on the tablet, so every answer key is present. */
const key = (exercise: { correctOption: number | null }) => exercise.correctOption!;
const answer = (i: number, right: boolean, t = i): Attempt => ({ id: `a${t}`, exerciseId: exs[i].id, selectedOption: right ? key(exs[i]) : (key(exs[i]) + 1) % exs[i].options.length, at: at(t) });
const mastery = (log: Attempt[], id = skill) => learningState(starterPacks, log).skills.find((s) => s.skillId === id)!.mastery;

describe('updateMastery (ported from backend mastery.spec.ts at v0-fullstack)', () => {
  it('raises estimates on correct answers and lowers them on errors', () => {
    expect(updateMastery(0.5, true, P)).toBeGreaterThan(0.5);
    expect(updateMastery(0.5, false, P)).toBeLessThan(0.5);
  });
  it('remains bounded across long response sequences', () => {
    let m = 0.2;
    for (let i = 0; i < 1000; i++) {
      m = updateMastery(m, i % 3 === 0, P);
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThan(1);
    }
  });
  it('clamps to 0.001-0.999', () => {
    expect(updateMastery(0.999, true, { prior: 0, learn: 1, guess: 0, slip: 0 })).toBe(0.999);
    expect(updateMastery(0.001, false, { prior: 0, learn: 0, guess: 0, slip: 1 })).toBe(0.001);
  });
  it('keeps the prior when the evidence is impossible', () => {
    expect(updateMastery(0.4, true, { prior: 0, learn: 0, guess: 0, slip: 1 })).toBe(0.4);
  });
});

describe('Mastery', () => {
  it('starts at the prior', () => expect(mastery([])).toBe(P.prior));
  it('goes 0.567, 0.867, 0.970 over three correct Counted Attempts', () => {
    const r = [0, 1, 2].map((n) => mastery([0, 1, 2].slice(0, n + 1).map((i) => answer(i, true))));
    expect(r.map((x) => +x.toFixed(3))).toEqual([0.567, 0.867, 0.97]);
  });
  it('settles near 0.091 after five wrong Counted Attempts', () => {
    expect(mastery([0, 1, 2, 3, 4].map((i) => answer(i, false)))).toBeCloseTo(0.091, 3);
  });
  it('replays in time order, whatever the log order', () => {
    const log = [answer(0, false, 1), answer(1, true, 2), answer(2, true, 3)];
    expect(mastery([...log].reverse())).toBe(mastery(log));
  });
  it('counts only the first Attempt at an Exercise', () => {
    const log = [answer(0, false, 1), answer(0, true, 2), answer(0, true, 3)];
    expect(mastery(log)).toBe(mastery([log[0]]));
    expect(learningState(starterPacks, log).coins).toBe(0);
  });
  it('is Mastered from exactly 0.95', () => {
    expect(MASTERED_AT).toBe(0.95);
    const two = learningState(starterPacks, [0, 1].map((i) => answer(i, true))).skills.find((s) => s.skillId === skill)!;
    const three = learningState(starterPacks, [0, 1, 2].map((i) => answer(i, true))).skills.find((s) => s.skillId === skill)!;
    expect([two.mastered, three.mastered]).toEqual([false, true]);
    const exact = { prior: 0.95, learn: 0, guess: 0, slip: 0 };
    const pack = { ...starterPacks[0], skills: [{ id: skill, parameters: exact }] };
    expect(learningState([pack], []).skills[0].mastered).toBe(true);
  });
  it('ignores Attempts at Exercises it does not know', () => {
    expect(mastery([{ id: 'x', exerciseId: 'nope', selectedOption: 0, at: NOW }])).toBe(P.prior);
  });
});

describe('Coins and grading', () => {
  it('pays 5 per correct Counted Attempt', () => {
    expect(COINS_PER_CORRECT).toBe(5);
    expect(learningState(starterPacks, [answer(0, true), answer(1, false), answer(2, true)]).coins).toBe(10);
  });
  it('grades a first correct Attempt as counted and worth 5', () => {
    const r = grade(starterPacks, [], { id: 'n', exerciseId: exs[0].id, selectedOption: key(exs[0]) }, NOW);
    expect(r).toMatchObject({ correct: true, counted: true, coins: 5, correctOption: key(exs[0]) });
    expect(r.attempt).toEqual({ id: 'n', exerciseId: exs[0].id, selectedOption: key(exs[0]), at: NOW });
  });
  it('grades a wrong Attempt as worth 0 and reveals the correct option', () => {
    const r = grade(starterPacks, [], { id: 'n', exerciseId: exs[0].id, selectedOption: 3 }, NOW);
    expect(r).toMatchObject({ correct: false, counted: true, coins: 0, correctOption: key(exs[0]) });
  });
  it('grades a retry as practice only', () => {
    const r = grade(starterPacks, [answer(0, false)], { id: 'n', exerciseId: exs[0].id, selectedOption: key(exs[0]) }, NOW);
    expect(r).toMatchObject({ correct: true, counted: false, coins: 0 });
  });
  it('rejects unknown Exercises and out-of-range options', () => {
    expect(() => grade(starterPacks, [], { id: 'n', exerciseId: 'nope', selectedOption: 0 }, NOW)).toThrow();
    expect(() => grade(starterPacks, [], { id: 'n', exerciseId: exs[0].id, selectedOption: 99 }, NOW)).toThrow();
  });
});

describe('A Content Pack graded on sync', () => {
  // The same Lessons with the answer key taken out, which is what a Pack
  // downloaded from the server looks like on this tablet.
  const onSync = starterPacks.map((p) => ({
    ...p, id: `${p.id}-sync`, grading: 'ON_SYNC' as const,
    lessons: p.lessons.map((l) => ({
      ...l, id: `${l.id}-sync`, packId: `${p.id}-sync`,
      exercises: l.exercises.map((e) => ({ ...e, id: `${e.id}-sync`, lessonId: `${l.id}-sync`, correctOption: null })),
    })),
  }));
  const target = onSync.flatMap((p) => p.lessons).filter((l) => l.skillCode === skill).flatMap((l) => l.exercises);
  const unmarked = (n: number): Attempt[] => target.slice(0, n).map((e, i) => ({ id: `s${i}`, exerciseId: e.id, selectedOption: 0, at: at(i) }));

  it('records the Attempt without marking it', () => {
    const r = grade(onSync, [], { id: 'n', exerciseId: target[0].id, selectedOption: 0 }, NOW);
    expect(r.graded).toBe(false);
    expect(r.counted).toBe(true);
    expect(r.attempt).toEqual({ id: 'n', exerciseId: target[0].id, selectedOption: 0, at: NOW });
  });

  /**
   * Not "Mastery of zero" and not the prior either: a Skill nothing has
   * measured is absent, so every screen reads it as not started rather than
   * showing a Learner a number that came from a starting guess.
   */
  it('reports no Mastery and no Coins at all, because only the server can mark it', () => {
    const state = learningState(onSync, unmarked(3));
    expect(state.coins).toBe(0);
    expect(state.skills.map((s) => s.skillId)).toEqual([]);
  });

  it('never flags a Plateau on answers nobody has marked', () => {
    const state = learningState(onSync, unmarked(PLATEAU_ATTEMPTS + 2));
    expect(state.skills.filter((s) => s.plateau)).toEqual([]);
  });

  it('offers no Quests, so one download cannot crowd the Starter Pack out of practise-next', () => {
    const next = quests([...starterPacks, ...onSync], []);
    expect(next.length).toBeGreaterThan(0);
    expect(next.filter((q) => target.some((e) => e.id === q.exerciseId))).toEqual([]);
  });

  it('does not offer again an Exercise the Learner has already answered', () => {
    expect(quests(onSync, unmarked(1)).map((q) => q.exerciseId)).not.toContain(target[0].id);
  });

  it('still refuses an option that is not on the Exercise', () => {
    expect(() => grade(onSync, [], { id: 'n', exerciseId: target[0].id, selectedOption: 99 }, NOW)).toThrow();
  });

  it('leaves a Pack graded on the tablet working beside it', () => {
    expect(learningState([...starterPacks, ...onSync], [answer(0, true), ...unmarked(2)]).coins).toBe(COINS_PER_CORRECT);
  });
});

describe('Growth', () => {
  // Local dates, because months follow the tablet's clock.
  const day = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();
  const on = (i: number, right: boolean, when: string): Attempt => ({ ...answer(i, right), id: `g${i}${when}`, at: when });
  const NOWD = new Date(2026, 5, 15, 12); // 15 June
  const g = (log: Attempt[]) => growth(starterPacks, log, NOWD);

  it('is zero with no Attempts', () => expect(g([])).toEqual({ thisMonth: { up: 0, mastered: 0 }, lastMonth: { up: 0, mastered: 0 } }));
  it('counts a Skill that went up this month and last month separately', () => {
    const log = [on(0, true, day(4, 10)), on(1, true, day(5, 3))];
    expect(g(log).lastMonth.up).toBe(1);
    expect(g(log).thisMonth.up).toBe(1);
  });
  it('counts a Skill that became Mastered this month, not one already Mastered at the start', () => {
    const log = [0, 1, 2].map((i) => on(i, true, day(5, 2 + i)));
    expect(g(log).thisMonth).toEqual({ up: 1, mastered: 1 });
    const earlier = [...[0, 1, 2].map((i) => on(i, true, day(4, 2 + i))), on(3, true, day(5, 2))];
    expect(g(earlier).thisMonth.mastered).toBe(0);
    expect(g(earlier).lastMonth.mastered).toBe(1);
  });
  it('does not count a Skill whose Mastery fell, and is never negative', () => {
    const log = [on(0, true, day(4, 5)), on(1, false, day(5, 1)), on(2, false, day(5, 2))];
    expect(g(log).thisMonth).toEqual({ up: 0, mastered: 0 });
  });
  it('respects month boundaries in local time', () => {
    const lastInstant = new Date(2026, 4, 31, 23, 59, 59).toISOString();
    const firstInstant = new Date(2026, 5, 1, 0, 0, 0).toISOString();
    expect(g([on(0, true, lastInstant)])).toMatchObject({ lastMonth: { up: 1 }, thisMonth: { up: 0 } });
    expect(g([on(0, true, firstInstant)])).toMatchObject({ lastMonth: { up: 0 }, thisMonth: { up: 1 } });
  });
  it('handles January looking back to December', () => {
    const log = [on(0, true, new Date(2025, 11, 20).toISOString())];
    expect(growth(starterPacks, log, new Date(2026, 0, 5)).lastMonth.up).toBe(1);
  });
});

describe('Plateau Flag', () => {
  const flag = (n: number, right = false) => learningState(starterPacks, Array.from({ length: n }, (_, i) => answer(i, right))).skills.find((s) => s.skillId === skill)!;
  it('is raised at the fifth Counted Attempt with Mastery below 0.40, not the fourth', () => {
    expect(PLATEAU_ATTEMPTS).toBe(5);
    expect(PLATEAU_BELOW).toBe(0.4);
    expect(flag(4).mastery).toBeLessThan(0.4);
    expect([flag(4).plateau, flag(5).plateau]).toEqual([false, true]);
  });
  it('is not raised when Mastery is 0.40 or more', () => {
    expect(flag(5, true).plateau).toBe(false);
  });
  it('counts only Counted Attempts', () => {
    const log = [0, 1, 2, 3].flatMap((i) => [answer(i, false, i * 2), answer(i, false, i * 2 + 1)]);
    expect(learningState(starterPacks, log).skills.find((s) => s.skillId === skill)!.plateau).toBe(false);
  });
});

describe('quests', () => {
  const exercisesOf = (id: string) => starterPacks.flatMap((p) => p.lessons).filter((l) => l.skillCode === id).flatMap((l) => l.exercises);
  const skillIds = starterPacks.flatMap((p) => p.skills.map((s) => s.id));
  const answerAll = (id: string, right: boolean): Attempt[] => exercisesOf(id).map((e, i) => ({ id: `${id}${i}`, exerciseId: e.id, selectedOption: right ? key(e) : (key(e) + 1) % e.options.length, at: at(i) }));
  const quest = (log: Attempt[], limit?: number) => quests(starterPacks, log, limit);

  it('gives a new Profile three Quests in pack order', () => {
    const q = quest([]);
    expect(q).toHaveLength(3);
    expect(q.map((x) => x.exerciseId)).toEqual(exercisesOf(skillIds[0]).slice(0, 3).map((e) => e.id));
    expect(q[0]).toMatchObject({ skillId: skillIds[0], lessonId: expect.any(String) });
  });
  it('puts the lowest Mastery first', () => {
    const ahead = quest(answerAll(skillIds[0], true).slice(0, 1), 100);
    expect(ahead[0].skillId).not.toBe(skillIds[0]);
    expect(ahead.at(-1)!.skillId).toBe(skillIds[0]);
    const behind = quest([answer(0, false)]);
    expect(behind[0].skillId).toBe(skill);
  });
  it('never offers an answered Exercise', () => {
    const log = [answer(0, true)];
    expect(quest(log, 100).map((x) => x.exerciseId)).not.toContain(exs[0].id);
  });
  it('skips Mastered Skills', () => {
    const log = [0, 1, 2].map((i) => answer(i, true));
    expect(learningState(starterPacks, log).skills.find((s) => s.skillId === skill)!.mastered).toBe(true);
    expect(quest(log, 100).some((x) => x.skillId === skill)).toBe(false);
  });
  it('skips Skills whose Exercises are all answered', () => {
    const log = answerAll(skill, false);
    expect(quest(log, 100).some((x) => x.skillId === skill)).toBe(false);
  });
  it('is empty when nothing is left', () => {
    const log = skillIds.flatMap((id) => answerAll(id, false));
    expect(quest(log)).toEqual([]);
  });
});

describe('demoHistory', () => {
  const now = new Date(2026, 4, 17, 10, 30);
  const log = demoHistory(starterPacks, now);
  const g = growth(starterPacks, log, now);
  const flags = (l: Attempt[]) => learningState(starterPacks, l).skills.filter((s) => s.plateau).length;
  it('is deterministic for a given time', () => expect(demoHistory(starterPacks, new Date(now))).toEqual(log));
  it('is backdated, with unique ids and only Counted Attempts', () => {
    expect(log.every((a) => Date.parse(a.at) <= now.getTime())).toBe(true);
    expect(new Set(log.map((a) => a.id)).size).toBe(log.length);
    expect(new Set(log.map((a) => a.exerciseId)).size).toBe(log.length);
  });
  it('gives nonzero Growth for this month and last month', () => {
    expect(g.thisMonth.up).toBeGreaterThan(0);
    expect(g.lastMonth.up).toBeGreaterThan(0);
  });
  it('yields exactly one Plateau Flag', () => expect(flags(log)).toBe(1));
  it('holds at the very start of a month and in January', () => {
    for (const t of [new Date(2026, 0, 1), new Date(2026, 5, 1)]) {
      const h = demoHistory(starterPacks, t), gr = growth(starterPacks, h, t);
      expect([gr.thisMonth.up > 0, gr.lastMonth.up > 0, flags(h)]).toEqual([true, true, 1]);
    }
  });
});

describe('growth with no history', () => {
  it('is zero rather than throwing', () => {
    expect(growth(starterPacks, [], new Date(2026, 0, 15))).toEqual({ thisMonth: { up: 0, mastered: 0 }, lastMonth: { up: 0, mastered: 0 } });
  });
});
