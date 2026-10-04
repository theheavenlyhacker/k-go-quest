import { starterPacks } from '../src/content/starter-pack';
import { uuid5 } from './uuid5';

/**
 * Turns the authored Starter Pack into the catalogue both sides of the app share.
 *
 * The tablet identifies content by slug (`math5.add.q1`) and the server by UUID,
 * so one of them has to be derived from the other or they can never talk about
 * the same Exercise. Deriving the UUID from the slug — same input, same output,
 * on any machine, forever — means the tablet keeps the Attempt log it already
 * has, and the server can be re-seeded from an empty database without breaking
 * a single tablet in the field.
 */

/** Namespace for K-Go content UUIDs. Changing it re-identifies every Exercise, so it never changes. */
export const NAMESPACE = '6f1c7f36-4f1e-5b2a-9a7a-2f1f0d5b9c31';

export interface ExportedExercise { slug: string; id: string; prompt: string; options: string[]; correctOption: number }
export interface ExportedLesson { slug: string; id: string; title: string; skillCode: string; body: string; hints: Record<string, string>; exercises: ExportedExercise[] }
export interface ExportedPack { slug: string; id: string; title: string; subject: string; grade: number; version: string; grading: string; lessons: ExportedLesson[] }
export interface ExportedCatalog { namespace: string; generatedFrom: string; packs: ExportedPack[] }

const id = (slug: string) => uuid5(slug, NAMESPACE);

export function exportCatalog(): ExportedCatalog {
  return {
    namespace: NAMESPACE,
    generatedFrom: 'mobile/src/content/starter-pack.ts',
    packs: starterPacks.map((pack) => ({
      slug: pack.id,
      id: id(pack.id),
      title: pack.title,
      subject: pack.subject,
      grade: pack.grade,
      version: pack.version,
      grading: pack.grading,
      lessons: pack.lessons.map((lesson) => ({
        slug: lesson.id,
        id: id(lesson.id),
        title: lesson.title,
        skillCode: lesson.skillCode,
        body: lesson.body,
        hints: lesson.hints,
        exercises: lesson.exercises.map((exercise) => ({
          slug: exercise.id,
          id: id(exercise.id),
          prompt: exercise.prompt,
          options: exercise.options,
          correctOption: exercise.correctOption,
        })),
      })),
    })),
  };
}
