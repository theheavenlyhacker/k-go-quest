import type { Pack } from './types';

/** Header grade label. A Profile has no grade of its own, so it follows the Packs on the tablet: the highest one. */
export function gradeLabel(packs: Pick<Pack, 'grade'>[]) {
  return packs.length ? `Grade ${Math.max(...packs.map((p) => p.grade))}` : 'Learner';
}

/** Storage used, in the unit a Learner can read. */
export function storageLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
