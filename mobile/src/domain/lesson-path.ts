import type { Attempt } from './engine';
import type { Pack } from './types';

/** Practice milestones advance from saved answers, including work awaiting sync. */
export function lessonPath(pack: Pack, attempts: Attempt[]) {
  const answered = new Set(attempts.map(attempt => attempt.exerciseId));
  const lessons = pack.lessons.map((lesson, index) => {
    const done = lesson.exercises.filter(exercise => answered.has(exercise.id)).length;
    const total = lesson.exercises.length;
    return { lesson, index, answered: done, total, complete: total > 0 && done === total, fraction: total ? done / total : 0 };
  });
  const currentIndex = lessons.findIndex(item => !item.complete);
  const completed = lessons.filter(item => item.complete).length;
  return {
    completed,
    total: lessons.length,
    finished: lessons.length > 0 && completed === lessons.length,
    currentIndex,
    nodes: lessons.map(item => ({ ...item, state: item.complete ? 'complete' as const : item.index === currentIndex ? 'current' as const : 'upcoming' as const })),
  };
}
