import type { Attempt } from './engine';
import type { Purchase } from './shop';
import { CATALOG } from './shop';

const DAY = 24 * 60 * 60 * 1000;

/** Consecutive days up to today on which the Learner answered at least once. */
export function streak(log: Attempt[], now: number): number {
  const days = new Set(log.map((a) => new Date(a.at).toDateString()));
  let count = 0;
  for (let back = 0; back < 365; back += 1) {
    if (days.has(new Date(now - back * DAY).toDateString())) count += 1;
    else if (back > 0) break;
  }
  return count;
}

/** Answers per day for the last `days` days, oldest first. The tablet records answers, not minutes, so this is the study-time chart's honest unit. */
export function dailyAnswers(log: Attempt[], now: number, days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(now - (days - 1 - i) * DAY);
    const key = day.toDateString();
    return { label: day.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1), count: log.filter((a) => new Date(a.at).toDateString() === key).length };
  });
}

/** Badges bought, newest first. */
export function recentAchievements(purchases: Purchase[], limit = 3) {
  return [...purchases]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
    .map((p) => ({ id: p.cosmeticId, name: CATALOG.find((c) => c.id === p.cosmeticId)?.name ?? 'Badge', at: p.at }));
}
