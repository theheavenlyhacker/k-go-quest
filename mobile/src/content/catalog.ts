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

/**
 * Every id the server issues is a UUID (`backend/docs/api.md`), so a Downloaded
 * Pack's Exercise already carries the server's own id.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The server's id for an Exercise on this tablet, or null when the server has
 * not been given the content it belongs to.
 *
 * A Downloaded Pack's Exercise needs no translation and is returned unchanged.
 * Deliberately not a question about which Packs are installed now: an Attempt
 * waiting to be uploaded must still resolve after its Pack has been superseded
 * by a newer version, or a Learner's unsent work would be discarded for a
 * reason that was never true.
 */
export const serverExerciseId = (slug: string): string | null => exerciseIds.get(slug) ?? (UUID.test(slug) ? slug : null);
export const serverLessonId = (slug: string): string | null => lessonIds.get(slug) ?? null;
export const serverPackId = (slug: string): string | null => packIds.get(slug) ?? null;
