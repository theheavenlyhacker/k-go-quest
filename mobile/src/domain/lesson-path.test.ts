import { describe, expect, it } from 'vitest';
import { lessonPath } from './lesson-path';
import type { Pack } from './types';
import type { Attempt } from './engine';

const pack = {
  id: 'math', subject: 'MATH', grade: 5, title: 'Fractions', version: '1', grading: 'ON_DEVICE', skills: [],
  lessons: ['one', 'two', 'three'].map(id => ({ id, packId: 'math', title: id, skillCode: id, body: '', hints: {}, exercises: [0, 1].map(n => ({ id: `${id}-${n}`, lessonId: id, prompt: '', options: ['A'], correctOption: 0 })) })),
} satisfies Pack;
const answer = (exerciseId: string) => ({ id: exerciseId, exerciseId, at: '2026-10-08T10:00:00Z' } as Attempt);

describe('lesson path', () => {
  it('highlights the first lesson for a new learner', () => {
    expect(lessonPath(pack, []).nodes.map(n => n.state)).toEqual(['current', 'upcoming', 'upcoming']);
  });
  it('advances after all exercises have saved answers, without requiring grading', () => {
    const path = lessonPath(pack, [answer('one-0'), answer('one-1')]);
    expect(path.completed).toBe(1);
    expect(path.currentIndex).toBe(1);
    expect(path.nodes.map(n => n.state)).toEqual(['complete', 'current', 'upcoming']);
  });
  it('does not advance from repeated answers or unrelated exercises', () => {
    const path = lessonPath(pack, [answer('one-0'), answer('one-0'), answer('elsewhere')]);
    expect(path.nodes[0].fraction).toBe(0.5);
    expect(path.completed).toBe(0);
  });
  it('keeps later completed lessons visible without skipping the next unfinished one', () => {
    expect(lessonPath(pack, [answer('three-0'), answer('three-1')]).nodes.map(n => n.state)).toEqual(['current', 'upcoming', 'complete']);
  });
  it('shows the unit milestone only when every lesson is completed', () => {
    const path = lessonPath(pack, pack.lessons.flatMap(l => l.exercises.map(e => answer(e.id))));
    expect(path.finished).toBe(true);
    expect(path.currentIndex).toBe(-1);
  });
  it('does not invent completion for empty packs or lessons without exercises', () => {
    expect(lessonPath({ ...pack, lessons: [] }, []).finished).toBe(false);
    expect(lessonPath({ ...pack, lessons: [{ ...pack.lessons[0], exercises: [] }] }, []).completed).toBe(0);
  });
});
