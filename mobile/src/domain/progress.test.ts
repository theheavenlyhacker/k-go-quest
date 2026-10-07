import { describe, expect, it } from 'vitest';
import { badges, dailyAnswers, recentAchievements, streak } from './progress';

const at = (id: string, d: Date) => ({ id, exerciseId: id, selectedOption: 0, at: d.toISOString() });
const noon = new Date(2026, 5, 10, 12).getTime();
const on = (back: number, h = 12, m = 0) => new Date(2026, 5, 10 - back, h, m);

describe('streak', () => {
  it('counts consecutive days ending today', () => expect(streak([at('a', on(0)), at('b', on(1)), at('c', on(3))], noon)).toBe(2));
  it('keeps a run alive when today has no answer yet', () => expect(streak([at('a', on(1)), at('b', on(2))], noon)).toBe(2));
  it('is broken by a missing yesterday', () => expect(streak([at('a', on(2))], noon)).toBe(0));
  it('is zero for an empty log', () => expect(streak([], noon)).toBe(0));
  it('treats 00:00 and 23:59 as the same day', () => {
    expect(streak([at('a', on(0, 0, 0)), at('b', on(1, 23, 59))], new Date(2026, 5, 10, 23, 59).getTime())).toBe(2);
  });
  it('crosses a month boundary', () => {
    const june1 = new Date(2026, 5, 1, 9).getTime();
    expect(streak([at('a', new Date(2026, 5, 1, 8)), at('b', new Date(2026, 4, 31, 20))], june1)).toBe(2);
  });
});

describe('dailyAnswers', () => {
  it('buckets seven days oldest first', () => {
    expect(dailyAnswers([at('a', on(0)), at('b', on(0, 0, 1)), at('c', on(6, 23, 59))], noon).map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });
  it('drops answers older than the window and keeps the last midnight', () => {
    const counts = dailyAnswers([at('a', on(7, 23, 59)), at('b', on(6, 0, 0))], noon).map((d) => d.count);
    expect(counts).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
  it('is all zeros for an empty log', () => expect(dailyAnswers([], noon).every((d) => d.count === 0)).toBe(true));
});

describe('badges', () => {
  const list = [
    { cosmeticId: 'badge-star', price: 25, at: '2026-01-01' },
    { cosmeticId: 'badge-book', price: 30, at: '2026-02-01' },
    { cosmeticId: 'not-a-cosmetic', price: 1, at: '2026-03-01' },
  ];
  it('counts only catalogue Cosmetics', () => expect(badges(list)).toHaveLength(2));
  it('lists newest first, badges only, within the limit', () => {
    expect(recentAchievements(list).map((a) => a.id)).toEqual(['badge-book', 'badge-star']);
    expect(recentAchievements(list, 1)).toHaveLength(1);
  });
});
