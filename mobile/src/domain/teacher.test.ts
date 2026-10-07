import { describe, expect, it } from 'vitest';
import { classOverview, insights, learnerDetail, searchLearners, type ClassroomReport } from './teacher';
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

describe('insights', () => {
  const now = Date.parse('2026-10-07T09:00:00.000Z');
  const view = insights(classroomReportFixture, 5, { l1: 12, l3: 2 }, now);

  it('searches by alias, ignoring case and spacing', () => {
    expect(searchLearners(view.all, ' an ').map((l) => l.alias)).toEqual(['Ana', 'Juanita']);
    expect(searchLearners(view.all, '')).toHaveLength(5);
    expect(searchLearners(view.all, 'zzz')).toEqual([]);
  });

  it('selects Plateau Flags and no recent sync for Needs attention, with the reason', () => {
    expect(view.needsAttention.map((l) => [l.alias, l.attention])).toEqual([
      ['Ana', 'Plateau in Math (31%)'],
      ['Paolo', '17 days inactive'],
      ['Liza', 'No sync yet'],
    ]);
  });

  it('lists every Learner with grade, streak and Mastery', () => {
    expect(view.all.map((l) => l.alias)).toEqual(['Ana', 'Juanita', 'Liza', 'Miguel', 'Paolo']);
    const ana = view.all[0]!;
    expect([ana.grade, ana.streak]).toEqual([5, 2]);
    expect(view.all[2]!.mastery).toBeNull();
    expect(view.all[2]!.streak).toBeNull();
  });

  it('shows Mastery per Skill, weakest first, for one Learner', () => {
    expect(learnerDetail(classroomReportFixture, 'l3', 5, {}, now)!.skills.map((s) => [s.label, s.subjectTitle, s.mastery])).toEqual([
      ['Fractions · Add', 'Math', 0.31], ['Reading · Main idea', 'English', 0.62],
    ]);
    expect(learnerDetail(classroomReportFixture, 'nope', 5, {}, now)).toBeNull();
  });
});
