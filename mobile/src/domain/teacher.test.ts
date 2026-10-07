import { describe, expect, it } from 'vitest';
import { alerts, classOverview, insights, learnerDetail, searchLearners, type ClassroomReport } from './teacher';
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

describe('alerts', () => {
  const now = Date.parse('2026-10-07T09:00:00.000Z');
  const view = alerts(classroomReportFixture, now, {});

  it('derives Plateau Flag as high, no recent sync as medium, long inactivity as low', () => {
    expect(view.open.map((a) => [a.learnerId, a.priority, a.title])).toEqual([
      ['l3', 'high', 'Plateau Flag: Ana'],
      ['l5', 'medium', 'No sync yet: Liza'],
      ['l4', 'low', 'Long inactivity: Paolo'],
    ]);
  });

  it('orders high to low, then newest first', () => {
    const report = { ...classroomReportFixture, learners: [
      { ...classroomReportFixture.learners[3]!, id: 'a', alias: 'A', lastSyncAt: '2026-09-20T00:00:00.000Z' },
      { ...classroomReportFixture.learners[3]!, id: 'b', alias: 'B', lastSyncAt: '2026-09-22T00:00:00.000Z' },
      { ...classroomReportFixture.learners[3]!, id: 'c', alias: 'C', lastSyncAt: '2026-10-02T00:00:00.000Z' },
    ] };
    expect(alerts(report, now, {}).open.map((a) => [a.learnerId, a.priority])).toEqual([['c', 'medium'], ['b', 'low'], ['a', 'low']]);
  });

  it('labels relative time', () => {
    expect(view.open.map((a) => a.relative)).toEqual(['1d ago', 'Not yet synced', '17d ago']);
  });

  it('counts tiles; Resolve removes the alert and counts it for 7 days', () => {
    expect(view.tiles).toEqual({ open: 3, resolved: 0, high: 1 });
    const done = alerts(classroomReportFixture, now, { 'l3:plateau': '2026-10-06T00:00:00.000Z', 'l4:sync': '2026-09-20T00:00:00.000Z' });
    expect(done.open.map((a) => a.id)).toEqual(['l5:sync']);
    expect(done.tiles).toEqual({ open: 1, resolved: 1, high: 0 });
  });

  it('raises both a Plateau and a sync alert for a Learner who has both', () => {
    const both = { ...classroomReportFixture.learners[2]!, lastSyncAt: '2026-09-30T00:00:00.000Z', connectivityStatus: 'NO_RECENT_SYNC' as const };
    expect(alerts({ ...classroomReportFixture, learners: [both] }, now, {}).open.map((a) => [a.id, a.priority])).toEqual([['l3:plateau', 'high'], ['l3:sync', 'medium']]);
  });

  it('is empty when nothing is flagged', () => {
    expect(alerts({ ...classroomReportFixture, learners: [classroomReportFixture.learners[0]!] }, now, {}).open).toEqual([]);
  });
});
