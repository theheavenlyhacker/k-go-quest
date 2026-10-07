import { COINS_PER_CORRECT } from './engine';

/** The three intro slides (Figma Frames 6-8), worded in glossary terms. */
export const introSlides = [
  { key: 'learn', title: 'Learn anytime, anywhere', body: 'Download Content Packs in Math, English, Filipino and Science so you can keep practising even without internet.' },
  { key: 'hints', title: 'Get help with Hints', body: 'Stuck on an Exercise? Every Lesson has a Hint that explains it, and the tablet reads it aloud when it has a voice for your language.' },
  { key: 'coins', title: 'Grow and earn Coins', body: `Earn ${COINS_PER_CORRECT} Coins for each correct Counted Attempt (your first answer to an Exercise). Later answers are practice only. On Sync answers earn Coins only after the server marks them correct. Watch your Growth each month and spend Coins on Cosmetics.` },
] as const;

const last = introSlides.length - 1;

/** One tap on the primary button: the next slide, or finished from the last one. */
export function nextSlide(index: number): { index: number; done: boolean } {
  return index >= last ? { index: last, done: true } : { index: index + 1, done: false };
}

export const isLastSlide = (index: number) => index >= last;
export const primaryLabel = (index: number) => (isLastSlide(index) ? 'Get Started' : 'Next');
