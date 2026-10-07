import { describe, expect, it } from 'vitest';
import { classOverview, type ClassroomReport } from './teacher';
import { classroomReportFixture } from './teacher-fixture';

describe('classOverview (fixture)', () => {
  const view = classOverview(classroomReportFixture);

  it('counts Learners, averages Mastery per Learner and counts those needing help', () => {
    expect(view.tiles.learners).toBe(5);
    // Plateau Flag (Ana), no recent sync (Paolo, Liza)
    expect(view.tiles.needHelp).toBe(3);
    expect(view.tiles.averageMastery).toBeCloseTo((0.9 + 0.7 + 0.465 + 0.7) / 4, 5);
  });

  it('builds one bar per Subject that has data, in Subject order', () => {
    expect(view.subjects.map((s) => [s.subject, s.title])).toEqual([['MATH', 'Math'], ['ENGLISH', 'English']]);
    expect(view.subjects[0]!.mastery).toBeCloseTo((0.92 + 0.74 + 0.31 + 0.7) / 4, 5);
  });

  it('highlights the Learner with the highest Mastery', () => {
    expect(view.highlight?.alias).toBe('Juanita');
    expect(view.highlight?.mastery).toBeCloseTo(0.9, 5);
  });
});

describe('classOverview (empty classroom)', () => {
  const empty: ClassroomReport = { classroomId: 'c', learners: [], decisionPolicy: '' };
  it('has zero tiles, no bars and no highlight', () => {
    expect(classOverview(empty)).toEqual({ tiles: { learners: 0, averageMastery: null, needHelp: 0 }, subjects: [], highlight: null });
  });
  it('ignores Learners with no Skills for Mastery and highlight', () => {
    const view = classOverview({ ...empty, learners: [{ ...classroomReportFixture.learners[4]! }] });
    expect(view.tiles.learners).toBe(1);
    expect(view.tiles.averageMastery).toBeNull();
    expect(view.highlight).toBeNull();
  });
});
