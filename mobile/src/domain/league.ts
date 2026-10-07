import type { LeagueReport, LeagueRow } from './server';

/** `grade` keeps the Learner's own grade; `division` is every Classroom the server listed. */
export type LeagueScope = 'grade' | 'division';

export interface LeagueView {
  /** Ranked afresh within the scope, so a grade view starts at 1st. */
  rows: LeagueRow[];
  /** Up to three, in the order the Figma paints them: 2nd, 1st, 3rd. */
  podium: LeagueRow[];
  /** The Learner's own Classroom, if it is in this scope. */
  mine: LeagueRow | null;
  /** How far the Learner's Classroom is from first, in percentage points; 0 when it leads. */
  behind: number | null;
}

/**
 * The League as a screen needs it. A League ranks Classrooms by Mastery
 * improvement and nothing else: a Learner's place in it is their Classroom's.
 */
export function leagueView(report: LeagueReport, classroomId: string | null, scope: LeagueScope): LeagueView {
  const own = report.items.find((row) => row.classroomId === classroomId) ?? null;
  const rows = report.items
    .filter((row) => scope === 'division' || (own !== null && row.grade === own.grade))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const mine = rows.find((row) => row.classroomId === classroomId) ?? null;
  const podium = [rows[1], rows[0], rows[2]].filter((row): row is LeagueRow => Boolean(row));
  const behind = mine && rows[0] ? Math.max(0, Number((rows[0].growthPercentagePoints - mine.growthPercentagePoints).toFixed(2))) : null;
  return { rows, podium, mine, behind };
}
