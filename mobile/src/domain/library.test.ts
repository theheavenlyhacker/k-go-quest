import { describe, expect, it } from 'vitest';
import { libraryProgress, storage, syncBanner } from './library';
import { dailyAnswers, recentAchievements, streak } from './progress';
import type { Pack } from './types';

const pack = { lessons: [
  { exercises: [{ id: 'a' }, { id: 'b' }] },
  { exercises: [{ id: 'c' }] },
] } as unknown as Pack;
const at = (id: string, iso: string) => ({ id, exerciseId: id, selectedOption: 0, at: iso });

describe('libraryProgress', () => {
  it('counts a Lesson only when all its Exercises were answered', () => {
    expect(libraryProgress(pack, [at('a', '2026-01-01'), at('c', '2026-01-01')])).toEqual({ done: 1, total: 2, fraction: 2 / 3 });
  });
  it('is empty for a Pack with no Exercises', () => {
    expect(libraryProgress({ lessons: [] } as unknown as Pack, [])).toEqual({ done: 0, total: 0, fraction: 0 });
  });
});

describe('syncBanner', () => {
  it('is silent with nothing queued', () => expect(syncBanner(0, 'READY')).toBeNull());
  it('enables Sync only when online', () => {
    expect(syncBanner(3, 'READY')?.canSync).toBe(true);
    expect(syncBanner(3, 'UNREACHABLE')).toEqual({ text: 'Offline — 3 answers waiting for school Wi-Fi', canSync: false });
    expect(syncBanner(1, 'SIGNED_OUT')?.text).toContain('1 answer ');
  });
});

it('storage adds what the server offers', () => expect(storage(2, 1)).toEqual({ held: 2, total: 3 }));

describe('progress helpers', () => {
  const now = new Date(2026, 5, 10, 12).getTime();
  const day = (back: number) => new Date(now - back * 86_400_000).toISOString();
  it('streak counts consecutive days, today optional', () => {
    expect(streak([at('a', day(0)), at('b', day(1)), at('c', day(3))], now)).toBe(2);
    expect(streak([at('a', day(1))], now)).toBe(1);
    expect(streak([], now)).toBe(0);
  });
  it('dailyAnswers buckets seven days oldest first', () => {
    const days = dailyAnswers([at('a', day(0)), at('b', day(0)), at('c', day(6))], now);
    expect(days.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });
  it('recentAchievements is newest first and limited', () => {
    const list = recentAchievements([
      { cosmeticId: 'badge-star', price: 25, at: '2026-01-01' }, { cosmeticId: 'badge-book', price: 30, at: '2026-02-01' },
    ], 1);
    expect(list.map((a) => a.id)).toEqual(['badge-book']);
  });
});
