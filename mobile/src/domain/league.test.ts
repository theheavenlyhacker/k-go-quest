import { describe, expect, it } from 'vitest';
import { leagueView } from './league';
import type { LeagueReport } from './server';

const row = (rank: number, classroomId: string, grade: number, growthPercentagePoints: number) =>
  ({ rank, classroomId, name: `Room ${classroomId}`, grade, enrolledLearners: 20, participatingLearners: 15, growthPercentagePoints });
const report: LeagueReport = { month: '2026-10', items: [row(1, 'a', 5, 9), row(2, 'b', 6, 7), row(3, 'c', 5, 4), row(4, 'd', 5, 1)] };

describe('leagueView', () => {
  it('paints the podium 2nd, 1st, 3rd', () => {
    expect(leagueView(report, 'd', 'division').podium.map((r) => r.classroomId)).toEqual(['b', 'a', 'c']);
  });
  it('ranks afresh within the Learner\'s grade', () => {
    const view = leagueView(report, 'c', 'grade');
    expect(view.rows.map((r) => [r.classroomId, r.rank])).toEqual([['a', 1], ['c', 2], ['d', 3]]);
    expect(view.mine?.rank).toBe(2);
    expect(view.behind).toBe(5);
  });
  it('knows when the Classroom leads', () => {
    expect(leagueView(report, 'a', 'division').behind).toBe(0);
  });
  it('has no place for a Learner whose Classroom is not listed', () => {
    const view = leagueView(report, 'zzz', 'division');
    expect(view.mine).toBeNull();
    expect(view.behind).toBeNull();
    expect(leagueView(report, 'zzz', 'grade').rows).toEqual([]);
  });
  it('copes with fewer than three Classrooms', () => {
    expect(leagueView({ month: 'm', items: [row(1, 'a', 5, 1)] }, 'a', 'division').podium).toHaveLength(1);
  });
});
