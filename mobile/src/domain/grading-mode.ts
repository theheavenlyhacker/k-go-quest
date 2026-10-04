import type { Attempt } from './engine';
import type { Lesson, Pack } from './types';

/**
 * Grading Mode, as a reader on this tablet can actually know it.
 *
 * `Pack.grading` is authoritative for nothing: `packs.ts` writes `ON_SYNC` for
 * every Downloaded Pack regardless of what the server said, and the engine
 * never reads the field at all — it keys on the answer key being absent. The
 * key is the only fact that decides, and it is per **Exercise**, while the
 * field is per **Pack**. One concept at two granularities with nothing
 * reconciling them is why three screens each derived their own answer and two
 * got it wrong.
 *
 * So this module derives it, and `MIXED` is a real answer rather than a wrong
 * side: a Pack may hold Lessons that disagree.
 */
export type GradingMode = 'ON_DEVICE' | 'ON_SYNC' | 'MIXED';

/** How a Lesson or a whole Pack is graded. A Pack is MIXED when its Lessons disagree. */
export function gradingMode(of: Lesson | Pack): GradingMode {
  if ('exercises' in of) {
    const keyed = of.exercises.filter((e) => e.correctOption !== null).length;
    // A Lesson with no Exercises is missing no key, so nothing waits on a server.
    if (keyed === of.exercises.length) return 'ON_DEVICE';
    return keyed === 0 ? 'ON_SYNC' : 'MIXED';
  }
  const modes = new Set(of.lessons.map(gradingMode));
  return modes.size === 1 ? [...modes][0] : 'MIXED';
}

/** The one wording for a Grading Mode, so no screen invents its own. */
export function gradingLabel(mode: GradingMode): string {
  if (mode === 'ON_DEVICE') return 'On device';
  return mode === 'ON_SYNC' ? 'Marked on sync' : 'Partly marked on sync';
}

/**
 * What a Lesson should read as.
 *
 * `learningState` leaves out a Skill nothing has measured, deliberately: a
 * prior is a guess and showing it as Mastery would put an unearned number in
 * front of a Learner. But absent Mastery then means two different things, and
 * the Attempt log is what tells them apart.
 */
export type LessonProgress = 'NOT_STARTED' | 'WAITING_FOR_SERVER' | 'MEASURED';

export function lessonProgress(lesson: Lesson, mastery: number | undefined, log: Attempt[]): LessonProgress {
  if (mastery !== undefined) return 'MEASURED';
  const answered = log.some((a) => lesson.exercises.some((e) => e.id === a.exerciseId));
  return answered ? 'WAITING_FOR_SERVER' : 'NOT_STARTED';
}
