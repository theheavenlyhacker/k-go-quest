/**
 * Bayesian Knowledge Tracing.
 *
 * Parameters are fitted per skill from real practice logs by the companion
 * repo (khan-go-quest-ml) and stored in skill_model_params. DEFAULT_PARAMS is
 * the fallback for any skill with too little evidence to fit — it is a
 * starting prior, not a measured value.
 *
 * The arithmetic in updateMastery must stay identical to
 * kgo_bkt/model.py::update_mastery, or fitted parameters stop meaning the same
 * thing on the two sides. Both are covered by golden-value tests.
 */
export interface BktParams {
  prior: number;
  learn: number;
  guess: number;
  slip: number;
}

export const DEFAULT_PARAMS: BktParams = {
  prior: 0.2,
  learn: 0.08,
  guess: 0.2,
  slip: 0.1,
};

/** Kept for callers that reported the prototype shape. */
export const MASTERY_MODEL = {
  version: 'bkt-prototype-v1',
  initial: DEFAULT_PARAMS.prior,
  guess: DEFAULT_PARAMS.guess,
  slip: DEFAULT_PARAMS.slip,
  learn: DEFAULT_PARAMS.learn,
};

export function updateMastery(
  prior: number,
  correct: boolean,
  params: BktParams = DEFAULT_PARAMS,
): number {
  const { guess, slip, learn } = params;
  const known = prior * (correct ? 1 - slip : slip);
  const unknown = (1 - prior) * (correct ? guess : 1 - guess);
  const total = known + unknown;
  const posterior = total > 0 ? known / total : prior;
  return Math.min(0.999, Math.max(0.001, posterior + (1 - posterior) * learn));
}

/** Probability the next answer is correct, given the current estimate. */
export function predictCorrect(
  mastery: number,
  params: BktParams = DEFAULT_PARAMS,
): number {
  return mastery * (1 - params.slip) + (1 - mastery) * params.guess;
}

export function manilaMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

/** The calendar day in Manila, as YYYY-MM-DD. */
export const manilaDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);

/**
 * Consecutive Manila days with practice, counting back from today. A streak
 * that reached yesterday is still alive: the Learner has until the day ends.
 */
export function manilaStreak(practiced: Date[], now: Date): number {
  const days = new Set(practiced.map(manilaDay));
  let cursor = now.getTime();
  if (!days.has(manilaDay(new Date(cursor)))) cursor -= 86_400_000;
  let streak = 0;
  // Manila has no daylight saving, so a day is always 24 hours.
  while (days.has(manilaDay(new Date(cursor)))) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

/** The calendar quarter in Manila, as YYYY-Qn. */
export function manilaQuarter(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const q = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${q}`;
}

/** The start (inclusive) and end (exclusive) timestamps for a quarter in Manila timezone. */
export function quarterDateRange(quarter: string): { start: Date; end: Date } {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(6));
  const startMonth = String((q - 1) * 3 + 1).padStart(2, '0');
  const start = new Date(`${year}-${startMonth}-01T00:00:00+08:00`);
  const end =
    q === 4
      ? new Date(`${year + 1}-01-01T00:00:00+08:00`)
      : new Date(
          `${year}-${String(q * 3 + 1).padStart(2, '0')}-01T00:00:00+08:00`,
        );
  return { start, end };
}

