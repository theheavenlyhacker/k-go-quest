import type { OnlineState } from './online';
import type { Library } from './admin-library';
import type { ServerUser, Session } from './server';

/**
 * The LGU Admin's view model: backend-shaped payloads in, screen-ready data out.
 * No React, no I/O, so the dashboard's arithmetic is testable on its own.
 */

/** `GET reports/impact`, as `backend/src/modules/reports` returns it. */
export interface ImpactReport {
  jurisdictionId: string;
  generatedAt: string;
  schools: number;
  activeStudents: number;
  studentsWithPractice: number;
  meanEstimatedMastery: number | null;
  attempts: number;
  disclaimer: string;
}

/** One Shared Tablet. Fixture-only: the server has no device fleet yet. */
export interface DeviceRecord { id: string; name: string; lastSeenAt: string | null; online: boolean }

/** Learners with practice on one day. Fixture-only: the server has no weekly engagement yet. */
export interface EngagementDay { date: string; activeLearners: number }

export interface AdminData {
  schoolName: string;
  impact: ImpactReport;
  users: ServerUser[];
  devices: DeviceRecord[];
  library: Library;
  /** The last 14 days, oldest first, ending today. */
  engagement: EngagementDay[];
}

/** The Admin shell opens for a live LGU Admin session on a reachable server, and for nothing else. */
export function canOpenAdmin(state: OnlineState, session: Session | null): boolean {
  return state === 'READY' && !session?.revoked && session?.user.role === 'LGU_ADMIN';
}

export interface Tile { key: string; label: string; value: string; tone: 'brand' | 'warning' }

const count = (n: number) => n.toLocaleString('en-US');

export function dashboardTiles(data: Pick<AdminData, 'impact' | 'users' | 'devices'>): Tile[] {
  const { impact, users, devices } = data;
  // Completion is the share of Learners who have practised at all.
  const completion = impact.activeStudents ? Math.round((impact.studentsWithPractice / impact.activeStudents) * 100) : 0;
  return [
    { key: 'learners', label: 'Learners', value: count(impact.activeStudents), tone: 'brand' },
    { key: 'teachers', label: 'Teachers', value: count(users.filter((u) => u.role === 'TEACHER' && u.active !== false).length), tone: 'brand' },
    { key: 'tablets', label: 'Active Shared Tablets', value: count(devices.filter((d) => d.online).length), tone: 'brand' },
    { key: 'completion', label: 'Completion rate', value: `${completion}%`, tone: 'warning' },
  ];
}

export interface EngagementBar { date: string; label: string; value: number; height: number; today: boolean }
export interface Engagement { bars: EngagementBar[]; total: number; changePercent: number | null }

const DAY = 86_400_000;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The seven days ending `today` (a YYYY-MM-DD date), each as a bar scaled to the
 * busiest day, and the change against the seven days before. A day with no
 * record counts as zero; the change is null when last week had no one to compare with.
 */
export function engagementSeries(days: EngagementDay[], today: string): Engagement {
  const byDate = new Map(days.map((d) => [d.date, d.activeLearners]));
  const end = Date.parse(`${today}T00:00:00Z`);
  const at = (back: number) => byDate.get(dayKey(end - back * DAY)) ?? 0;
  const values = Array.from({ length: 7 }, (_, i) => at(6 - i));
  const previous = Array.from({ length: 7 }, (_, i) => at(13 - i)).reduce((a, b) => a + b, 0);
  const total = values.reduce((a, b) => a + b, 0);
  const peak = Math.max(...values, 0);
  return {
    bars: values.map((value, i) => {
      const ms = end - (6 - i) * DAY;
      return { date: dayKey(ms), label: LETTERS[new Date(ms).getUTCDay()], value, height: peak ? value / peak : 0, today: i === 6 };
    }),
    total,
    changePercent: previous ? Math.round(((total - previous) / previous) * 100) : null,
  };
}
