import { manilaMonth, updateMastery } from './mastery';
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
  });
});
