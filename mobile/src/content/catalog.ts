import catalogue from './starter-pack.json';

/**
 * The bridge between the tablet's content IDs and the server's.
 *
 * A Learner's Attempt records a slug (`math5.add.q1`) because that is what the
 * Starter Pack carries and what the local Attempt log has always held. The
 * server identifies the same Exercise by a UUID. This file holds the mapping,
 * generated with the content by `npm run export:pack`, so an Attempt made
 * offline years ago can still be uploaded without rewriting it.
 *
 * Generated — do not edit by hand. `catalog.test.ts` fails if it drifts from
 * `starter-pack.ts`.
 */
export const CONTENT_NAMESPACE: string = catalogue.namespace;

const exerciseIds = new Map<string, string>();
const lessonIds = new Map<string, string>();
const packIds = new Map<string, string>();
for (const pack of catalogue.packs) {
  packIds.set(pack.slug, pack.id);
  for (const lesson of pack.lessons) {
    lessonIds.set(lesson.slug, lesson.id);
    for (const exercise of lesson.exercises) exerciseIds.set(exercise.slug, exercise.id);
  }
}

/** The server's id for an Exercise, or null when this tablet has content the server has not been given. */
export const serverExerciseId = (slug: string): string | null => exerciseIds.get(slug) ?? null;
export const serverLessonId = (slug: string): string | null => lessonIds.get(slug) ?? null;
export const serverPackId = (slug: string): string | null => packIds.get(slug) ?? null;
