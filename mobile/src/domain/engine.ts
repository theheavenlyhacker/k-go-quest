import type { Pack, SkillParameters } from './types';

/** The learning engine: pure, no React or Expo. Mastery and Coins are replayed from the Attempt log, never stored. */
export const COINS_PER_CORRECT = 5;
export const MASTERED_AT = 0.95;
export const PLATEAU_ATTEMPTS = 5;
export const PLATEAU_BELOW = 0.4;

/** What is stored for one answer. Everything else is derived. */
export interface Attempt { id: string; exerciseId: string; selectedOption: number; at: string; }
export interface SkillMastery { skillId: string; mastery: number; mastered: boolean; counted: number; plateau: boolean; }
export interface LearningState { skills: SkillMastery[]; coins: number; }
export interface Grade { correct: boolean; counted: boolean; coins: number; correctOption: number; attempt: Attempt; }

/** Copied from the backend's BKT function at tag v0-fullstack. */
export function updateMastery(prior: number, correct: boolean, { guess, slip, learn }: SkillParameters): number {
  const known = prior * (correct ? 1 - slip : slip);
  const unknown = (1 - prior) * (correct ? guess : 1 - guess);
  const total = known + unknown;
  const posterior = total > 0 ? known / total : prior;
  return Math.min(0.999, Math.max(0.001, posterior + (1 - posterior) * learn));
}

const exerciseIndex = (packs: Pack[]) => {
  const byId = new Map<string, { skillId: string; correctOption: number; options: number }>();
  for (const p of packs) for (const l of p.lessons) for (const e of l.exercises) byId.set(e.id, { skillId: l.skillCode, correctOption: e.correctOption, options: e.options.length });
  return byId;
};

/** Time order; ties keep log order (Array.sort is stable). */
const inTimeOrder = (log: Attempt[]) => [...log].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

export function learningState(packs: Pack[], log: Attempt[]): LearningState {
  const exercises = exerciseIndex(packs);
  const params = new Map(packs.flatMap((p) => p.skills.map((s) => [s.id, s.parameters] as const)));
  const mastery = new Map([...params].map(([id, p]) => [id, p.prior]));
  const seen = new Set<string>();
  const counted = new Map<string, number>();
  let coins = 0;
  for (const a of inTimeOrder(log)) {
    const ex = exercises.get(a.exerciseId);
    if (!ex || seen.has(a.exerciseId)) continue;
    seen.add(a.exerciseId);
    counted.set(ex.skillId, (counted.get(ex.skillId) ?? 0) + 1);
    const correct = a.selectedOption === ex.correctOption;
    if (correct) coins += COINS_PER_CORRECT;
    mastery.set(ex.skillId, updateMastery(mastery.get(ex.skillId)!, correct, params.get(ex.skillId)!));
  }
  return { skills: [...mastery].map(([skillId, m]) => {
    const n = counted.get(skillId) ?? 0;
    return { skillId, mastery: m, mastered: m >= MASTERED_AT, counted: n, plateau: n >= PLATEAU_ATTEMPTS && m < PLATEAU_BELOW };
  }), coins };
}

export interface MonthGrowth { up: number; mastered: number; }
export interface Growth { thisMonth: MonthGrowth; lastMonth: MonthGrowth; }

/** Growth for the calendar months (tablet-local) of `now` and the month before. Never negative: a fall counts as nothing. */
export function growth(packs: Pack[], log: Attempt[], now: Date): Growth {
  const edge = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1).getTime();
  const at = (t: number) => learningState(packs, log.filter((a) => Date.parse(a.at) < t)).skills;
  const month = (from: number, to: number): MonthGrowth => {
    const before = new Map(at(from).map((s) => [s.skillId, s]));
    let up = 0, mastered = 0;
    for (const s of at(to)) {
      const b = before.get(s.skillId)!;
      if (s.mastery > b.mastery) up++;
      if (s.mastered && !b.mastered) mastered++;
    }
    return { up, mastered };
  };
  return { thisMonth: month(edge(0), edge(1)), lastMonth: month(edge(-1), edge(0)) };
}

export function grade(packs: Pack[], log: Attempt[], answer: Omit<Attempt, 'at'>, now: string): Grade {
  const ex = exerciseIndex(packs).get(answer.exerciseId);
  if (!ex) throw new Error('That Exercise is not on this tablet.');
  if (!Number.isInteger(answer.selectedOption) || answer.selectedOption < 0 || answer.selectedOption >= ex.options) throw new Error('Choose one of the options.');
  const correct = answer.selectedOption === ex.correctOption;
  const counted = !log.some((a) => a.exerciseId === answer.exerciseId);
  return { correct, counted, coins: correct && counted ? COINS_PER_CORRECT : 0, correctOption: ex.correctOption, attempt: { ...answer, at: now } };
}

export interface Quest { exerciseId: string; lessonId: string; skillId: string; mastery: number; }

/** Unanswered Exercises from Skills that are not Mastered, lowest Mastery first, then pack order. */
export function quests(packs: Pack[], log: Attempt[], limit = 3): Quest[] {
  const answered = new Set(log.map((a) => a.exerciseId));
  const open = new Map<string, { exerciseId: string; lessonId: string }[]>();
  for (const p of packs) for (const l of p.lessons) for (const e of l.exercises) {
    if (!answered.has(e.id)) open.set(l.skillCode, [...(open.get(l.skillCode) ?? []), { exerciseId: e.id, lessonId: l.id }]);
  }
  // Array.sort is stable, so equal Mastery keeps pack order.
  return learningState(packs, log).skills
    .filter((s) => !s.mastered)
    .sort((a, b) => a.mastery - b.mastery)
    .flatMap((s) => (open.get(s.skillId) ?? []).map((q) => ({ ...q, skillId: s.skillId, mastery: s.mastery })))
    .slice(0, limit);
}

/**
 * The Demo Learner's starting history, backdated from `now`; the same `now` gives the same Attempts.
 * Last month: five wrong Counted Attempts on one Skill (the one Plateau Flag) and one Skill answered right until Mastered.
 * This month: a third Skill goes up.
 */
export function demoHistory(packs: Pack[], now: Date): Attempt[] {
  const bySkill = new Map<string, { id: string; correctOption: number; options: number }[]>();
  for (const p of packs) for (const l of p.lessons) for (const e of l.exercises) bySkill.set(l.skillCode, [...(bySkill.get(l.skillCode) ?? []), { id: e.id, correctOption: e.correctOption, options: e.options.length }]);
  const pick = (n: number, taken: string[]) => {
    const found = [...bySkill].find(([id, ex]) => ex.length >= n && !taken.includes(id));
    if (!found) throw new Error('The packs have too few Exercises for a demo history.');
    return found;
  };
  const [plateau, plateauEx] = pick(PLATEAU_ATTEMPTS, []);
  const [mastered, masteredEx] = pick(3, [plateau]);
  const [, risingEx] = pick(2, [plateau, mastered]);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonth = (day: number) => new Date(now.getFullYear(), now.getMonth() - 1, day, 12).getTime();
  // This month: minutes before `now`, never before the month began.
  const thisMonth = (i: number) => Math.max(monthStart, now.getTime() - (2 - i) * 60000);
  const rows = [
    ...plateauEx.slice(0, PLATEAU_ATTEMPTS).map((e, i) => ({ e, right: false, t: lastMonth(2 + i) })),
    ...masteredEx.slice(0, 3).map((e, i) => ({ e, right: true, t: lastMonth(8 + i) })),
    ...risingEx.slice(0, 2).map((e, i) => ({ e, right: true, t: thisMonth(i) })),
  ];
  return rows.map(({ e, right, t }, i) => ({ id: `demo-${i}`, exerciseId: e.id, selectedOption: right ? e.correctOption : (e.correctOption + 1) % e.options, at: new Date(t).toISOString() }));
}
