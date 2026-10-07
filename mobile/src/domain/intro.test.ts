import { describe, expect, it } from 'vitest';
import { introSlides, isLastSlide, nextSlide, primaryLabel } from './intro';

describe('intro', () => {
  it('advances one slide at a time and finishes after the last', () => {
    expect(nextSlide(0)).toEqual({ index: 1, done: false });
    expect(nextSlide(1)).toEqual({ index: 2, done: false });
    expect(nextSlide(2)).toEqual({ index: 2, done: true });
  });
  it('reads Get Started only on the last slide', () => {
    expect([0, 1, 2].map(primaryLabel)).toEqual(['Next', 'Next', 'Get Started']);
    expect(isLastSlide(2)).toBe(true);
  });
  it('avoids the Figma placeholder terms the glossary rejects', () => {
    const copy = introSlides.map((s) => `${s.title} ${s.body}`).join(' ');
    expect(copy).not.toMatch(/khan|voucher|redeem|\bAI\b|tutor|badge/i);
  });
});
