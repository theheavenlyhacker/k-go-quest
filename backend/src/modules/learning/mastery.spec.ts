import {
  manilaDay,
  manilaStreak,
  manilaMonth,
  manilaQuarter,
  quarterDateRange,
  updateMastery,
} from './mastery';
describe('Mastery prototype', () => {
  it('raises estimates on correct answers and lowers them on errors', () => {
    expect(updateMastery(0.5, true)).toBeGreaterThan(0.5);
    expect(updateMastery(0.5, false)).toBeLessThan(0.5);
  });
  it('remains bounded across long response sequences', () => {
    let mastery = 0.2;
    for (let i = 0; i < 1000; i++) {
      mastery = updateMastery(mastery, i % 3 === 0);
      expect(mastery).toBeGreaterThan(0);
      expect(mastery).toBeLessThan(1);
    }
  });
  it('uses Philippine season boundaries', () => {
    expect(manilaMonth(new Date('2026-09-30T16:00:00Z'))).toBe('2026-10');
    expect(manilaMonth(new Date('2026-09-30T15:59:59Z'))).toBe('2026-09');
    expect(manilaQuarter(new Date('2026-09-30T16:00:00Z'))).toBe('2026-Q4');
    expect(manilaQuarter(new Date('2026-09-30T15:59:59Z'))).toBe('2026-Q3');
    const q3 = quarterDateRange('2026-Q3');
    expect(q3.start.toISOString()).toBe('2026-06-30T16:00:00.000Z');
    expect(q3.end.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    const q4 = quarterDateRange('2026-Q4');
    expect(q4.start.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(q4.end.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });
  describe('manilaStreak', () => {
    const now = new Date('2026-10-07T04:00:00Z'); // 12:00 on 7 Oct in Manila
    const at = (iso: string) => new Date(iso);
    it('counts consecutive Manila days ending today', () => {
      // 16:30Z on 5 Oct is 00:30 on 6 Oct in Manila, so it is the 6th, not the 5th.
      expect(
        manilaStreak(
          [
            at('2026-10-06T16:30:00Z'),
            at('2026-10-06T10:00:00Z'),
            at('2026-10-07T01:00:00Z'),
          ],
          now,
        ),
      ).toBe(2);
    });
    it('stays alive until today ends, then breaks', () => {
      expect(
        manilaStreak(
          [at('2026-10-05T01:00:00Z'), at('2026-10-06T01:00:00Z')],
          now,
        ),
      ).toBe(2);
      expect(
        manilaStreak(
          [at('2026-10-04T01:00:00Z'), at('2026-10-05T01:00:00Z')],
          now,
        ),
      ).toBe(0);
    });
    it('stops at the first gap and is zero without practice', () => {
      expect(
        manilaStreak(
          [at('2026-10-07T01:00:00Z'), at('2026-10-05T01:00:00Z')],
          now,
        ),
      ).toBe(1);
      expect(manilaStreak([], now)).toBe(0);
      expect(manilaDay(at('2026-10-06T16:30:00Z'))).toBe('2026-10-07');
    });
  });
});
