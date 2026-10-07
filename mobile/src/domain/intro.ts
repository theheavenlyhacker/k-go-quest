/** The three intro slides (Figma Frames 6-8), worded in glossary terms. */
export const introSlides = [
  { key: 'learn', title: 'Learn anytime, anywhere', body: 'Download Content Packs in Math, English, Filipino and Science so you can keep practising even without internet.' },
  { key: 'hints', title: 'Get help with Hints', body: 'Stuck on an Exercise? Every Lesson has a Hint that explains it, and the tablet can read it aloud.' },
  { key: 'coins', title: 'Grow and earn Coins', body: 'Earn a Coin for each correct first Attempt, watch your Growth each month, and spend Coins on badges.' },
] as const;

export type IntroSlide = (typeof introSlides)[number];

const last = introSlides.length - 1;

/** One tap on the primary button: the next slide, or finished from the last one. */
export function nextSlide(index: number): { index: number; done: boolean } {
  return index >= last ? { index: last, done: true } : { index: index + 1, done: false };
}

export const isLastSlide = (index: number) => index >= last;
export const primaryLabel = (index: number) => (isLastSlide(index) ? 'Get Started' : 'Next');
