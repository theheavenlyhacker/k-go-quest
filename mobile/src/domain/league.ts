import type { LeagueReport, LeagueRow } from './server';

/** `grade` keeps the Learner's own grade; `division` is every Classroom the server listed. */
export type LeagueScope = 'grade' | 'division';

/** What a Learner sees for their own Classroom in place of its name. */
export const OWN_CLASSROOM = 'Your Classroom';

export interface LeagueView {
  /** Sorted by improvement here, not trusted from the server; Classrooms level on improvement share a rank. */
  rows: LeagueRow[];
  /** The three best places in the order the Figma paints them (2nd, 1st, 3rd), ties included. */
  podium: LeagueRow[];
  /** The Learner's own Classroom, if it is in this scope. */
  mine: LeagueRow | null;
  /** How far the Learner's Classroom is from first, in percentage points; 0 when it is first or level with first. */
  behind: number | null;
  /** True when the Learner's Classroom is level with at least one other at the top. */
  tiedForFirst: boolean;
  /** The Learner's Classroom as a share of first place's improvement, 0 to 1, for the progress bar. */
  share: number;
}

/**
 * The League as a screen needs it. A League ranks Classrooms by Mastery
 * improvement and nothing else: a Learner's place in it is their Classroom's.
 */
export function leagueView(report: LeagueReport, classroomId: string | null, scope: LeagueScope): LeagueView {
  const own = report.items.find((row) => row.classroomId === classroomId) ?? null;
  const sorted = report.items
    .filter((row) => scope === 'division' || (own !== null && row.grade === own.grade))
    .sort((a, b) => b.growthPercentagePoints - a.growthPercentagePoints || a.classroomId.localeCompare(b.classroomId));
  // Competition ranking: level Classrooms share a place and the next place is skipped.
  const rows = sorted.map((row) => ({ ...row, rank: 1 + sorted.filter((other) => other.growthPercentagePoints > row.growthPercentagePoints).length }));
  const mine = rows.find((row) => row.classroomId === classroomId) ?? null;
  const top = rows[0]?.growthPercentagePoints ?? 0;
  const podium = [rows[1], rows[0], rows[2]].filter((row): row is LeagueRow => Boolean(row));
  const behind = mine && rows[0] ? Math.max(0, Number((top - mine.growthPercentagePoints).toFixed(2))) : null;
  return {
    rows,
    podium,
    mine,
    behind,
    tiedForFirst: mine?.rank === 1 && rows.filter((row) => row.rank === 1).length > 1,
    share: !mine ? 0 : top > 0 ? Math.min(1, Math.max(0, mine.growthPercentagePoints) / top) : 1,
  };
}
