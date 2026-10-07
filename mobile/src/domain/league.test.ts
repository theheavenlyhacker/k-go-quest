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
  it('gives level Classrooms a shared rank and never claims a lone first', () => {
    const tied: LeagueReport = { month: 'm', items: [row(1, 'a', 5, 6), row(2, 'b', 5, 6), row(3, 'c', 5, 2)] };
    const view = leagueView(tied, 'b', 'division');
    expect(view.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(view.mine?.rank).toBe(1);
    expect(view.behind).toBe(0);
    expect(view.tiedForFirst).toBe(true);
    expect(leagueView(report, 'a', 'division').tiedForFirst).toBe(false);
  });
  it('does not trust the server order', () => {
    const shuffled: LeagueReport = { month: 'm', items: [row(1, 'd', 5, 1), row(2, 'a', 5, 9), row(3, 'b', 6, 7)] };
    const view = leagueView(shuffled, 'd', 'division');
    expect(view.rows.map((r) => r.classroomId)).toEqual(['a', 'b', 'd']);
    expect(view.behind).toBe(8);
    expect(view.share).toBeCloseTo(1 / 9);
  });
  it('shows a full bar when nobody has improved', () => {
    expect(leagueView({ month: 'm', items: [row(1, 'a', 5, 0), row(2, 'b', 5, 0)] }, 'a', 'division').share).toBe(1);
  });
  it('copes with fewer than three Classrooms', () => {
    expect(leagueView({ month: 'm', items: [row(1, 'a', 5, 1)] }, 'a', 'division').podium).toHaveLength(1);
  });
});
