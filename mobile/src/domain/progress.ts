import type { Attempt } from './engine';
import type { Purchase } from './shop';
import { CATALOG } from './shop';

/** Local calendar day, `back` days before `now`. Calendar arithmetic, not 24h steps, so a daylight-saving change cannot skip or repeat a day. */
const dayBack = (now: number, back: number) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12); };
const key = (date: Date) => date.toDateString();

/** Consecutive days up to today on which the Learner answered at least once. Today with no answer yet does not break the run. */
export function streak(log: Attempt[], now: number): number {
  const days = new Set(log.map((a) => key(new Date(a.at))));
  let count = 0;
  for (let back = 0; back < 365; back += 1) {
    if (days.has(key(dayBack(now, back)))) count += 1;
    else if (back > 0) break;
  }
  return count;
}

/** Answers per day for the last `days` days, oldest first. The tablet records answers, not minutes, so this is the study-time chart's honest unit. */
export function dailyAnswers(log: Attempt[], now: number, days = 7) {
  const counts = new Map<string, number>();
  for (const a of log) counts.set(key(new Date(a.at)), (counts.get(key(new Date(a.at))) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = dayBack(now, days - 1 - i);
    return { label: day.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1), count: counts.get(key(day)) ?? 0 };
  });
}

/** Purchases that are Cosmetics in the catalogue. Anything else on file is not a badge and is not counted. */
export const badges = (purchases: Purchase[]) => purchases.filter((p) => CATALOG.some((c) => c.id === p.cosmeticId));

/** Badges bought, newest first. */
export function recentAchievements(purchases: Purchase[], limit = 3) {
  return badges(purchases)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
    .map((p) => ({ id: p.cosmeticId, name: CATALOG.find((c) => c.id === p.cosmeticId)!.name, at: p.at }));
}
