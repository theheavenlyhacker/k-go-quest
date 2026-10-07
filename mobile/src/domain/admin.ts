import { ago } from './format';
import type { OnlineState } from './online';
import type { Library } from './admin-library';
import type { ServerUser, Session } from './server';

/**
 * The LGU Admin's view model: backend-shaped payloads in, screen-ready data out.
 * No React, no I/O, so the dashboard's arithmetic is testable on its own.
 */

export interface BarangayReach {
  barangay: string;
  learners: number;
  lessons: number;
  offlineLessons: number;
}

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
  quarter?: string;
  learnersReached?: number;
  lessonsCompleted?: number;
  offlineUsageShare?: number;
  reachByBarangay?: BarangayReach[];
}

/** One Shared Tablet. Fixture-only: the server has no device fleet yet. */
export interface DeviceRecord {
  id: string;
  name: string;
  grade: string;
  classroom: string;
  lastSeenAt: string | null;
  online: boolean;
  updateAvailable: boolean;
  storageUsedPercent: number;
}

/** One barangay's reach in one quarter (`2026-Q3`). */
export interface ReachRecord { quarter: string; barangay: string; learners: number; lessons: number; offlineLessons: number }

/** Learners with practice on one day. */
export interface EngagementDay { date: string; activeLearners: number }

export interface AdminData {
  schoolName: string;
  impact: ImpactReport;
  users: ServerUser[];
  devices: DeviceRecord[];
  library: Library;
  /** The last 14 days, oldest first, ending today. */
  engagement: EngagementDay[];
  reach: ReachRecord[];
  loadedAt?: string;
  stale?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, what: string): string => {
  if (typeof value !== 'string') throw new Error(`Admin report: ${what} is not text.`);
  return value;
};
const num = (value: unknown, what: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Admin report: ${what} is not a number.`);
  return value;
};
const optNum = (value: unknown, what: string): number | null => {
  if (value === null || value === undefined) return null;
  return num(value, what);
};
const list = (value: unknown, what: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Admin report: ${what} is not a list.`);
  return value;
};
const record = (value: unknown, what: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`Admin report: ${what} is not an object.`);
  return value;
};

export function parseImpactReport(raw: unknown): ImpactReport {
  const r = record(raw, 'impact');
  const reachByBarangay =
    r.reachByBarangay !== undefined
      ? list(r.reachByBarangay, 'reachByBarangay').map((entry, i) => {
          const b = record(entry, `reachByBarangay[${i}]`);
          return {
            barangay: text(b.barangay, `reachByBarangay[${i}].barangay`),
            learners: num(b.learners, `reachByBarangay[${i}].learners`),
            lessons: num(b.lessons, `reachByBarangay[${i}].lessons`),
            offlineLessons: num(b.offlineLessons, `reachByBarangay[${i}].offlineLessons`),
          };
        })
      : undefined;

  return {
    jurisdictionId: text(r.jurisdictionId, 'jurisdictionId'),
    generatedAt: text(r.generatedAt, 'generatedAt'),
    schools: num(r.schools, 'schools'),
    activeStudents: num(r.activeStudents, 'activeStudents'),
    studentsWithPractice: num(r.studentsWithPractice, 'studentsWithPractice'),
    meanEstimatedMastery: optNum(r.meanEstimatedMastery, 'meanEstimatedMastery'),
    attempts: num(r.attempts, 'attempts'),
    disclaimer: text(r.disclaimer, 'disclaimer'),
    quarter: r.quarter !== undefined ? text(r.quarter, 'quarter') : undefined,
    learnersReached: r.learnersReached !== undefined ? num(r.learnersReached, 'learnersReached') : undefined,
    lessonsCompleted: r.lessonsCompleted !== undefined ? num(r.lessonsCompleted, 'lessonsCompleted') : undefined,
    offlineUsageShare: r.offlineUsageShare !== undefined ? num(r.offlineUsageShare, 'offlineUsageShare') : undefined,
    reachByBarangay,
  };
}

export function parseEngagement(raw: unknown): EngagementDay[] {
  const items = Array.isArray(raw)
    ? raw
    : (raw as { days?: unknown; items?: unknown } | null)?.days ??
      (raw as { items?: unknown } | null)?.items;
  return list(items, 'engagement').map((entry, i) => {
    const d = record(entry, `engagement[${i}]`);
    return {
      date: text(d.date, `engagement[${i}].date`),
      activeLearners: num(d.activeLearners, `engagement[${i}].activeLearners`),
    };
  });
}

export function parseUsers(raw: unknown): ServerUser[] {
  const items = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  return list(items, 'users').map((entry, i) => {
    const u = record(entry, `users[${i}]`);
    return {
      id: text(u.id, `users[${i}].id`),
      loginId: text(u.loginId, `users[${i}].loginId`),
      alias: text(u.alias, `users[${i}].alias`),
      role: text(u.role, `users[${i}].role`) as ServerUser['role'],
      jurisdictionId: typeof u.jurisdictionId === 'string' ? u.jurisdictionId : '',
      schoolId: u.schoolId !== null && u.schoolId !== undefined ? text(u.schoolId, `users[${i}].schoolId`) : null,
      coins: typeof u.coins === 'number' ? u.coins : 0,
      active: typeof u.active === 'boolean' ? u.active : true,
    };
  });
}

export function parseSchools(raw: unknown): { id: string; name: string; barangay?: string }[] {
  const items = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  return list(items, 'schools').map((entry, i) => {
    const s = record(entry, `schools[${i}]`);
    return {
      id: text(s.id, `schools[${i}].id`),
      name: text(s.name, `schools[${i}].name`),
      barangay: s.barangay !== undefined ? text(s.barangay, `schools[${i}].barangay`) : undefined,
    };
  });
}

export function parsePacks(raw: unknown): { id: string; title: string; subject: string; grade: number; version: string }[] {
  const items = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  return list(items, 'packs').map((entry, i) => {
    const p = record(entry, `packs[${i}]`);
    return {
      id: text(p.id, `packs[${i}].id`),
      title: text(p.title, `packs[${i}].title`),
      subject: text(p.subject, `packs[${i}].subject`),
      grade: num(p.grade, `packs[${i}].grade`),
      version: text(p.version, `packs[${i}].version`),
    };
  });
}

/** Generates the last `count` quarters in YYYY-Qn format, newest first, starting with the quarter of `today`. */
export function recentQuarters(today: string, count: number = 4): string[] {
  const year = Number(today.slice(0, 4));
  const currentQ = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let q = currentQ - i;
    let y = year;
    while (q <= 0) {
      q += 4;
      y -= 1;
    }
    result.push(`${y}-Q${q}`);
  }
  return result;
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

export const quarterOf = (date: string) => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
const quarterLabel = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;

/** Quarters with records plus the current one, newest first. */
export function quarterOptions(reach: ReachRecord[], today: string) {
  const all = new Set([quarterOf(today), ...reach.map((r) => r.quarter)]);
  return [...all].sort().reverse().map((value) => ({ value, label: quarterLabel(value) }));
}

export interface BarangayBar { name: string; learners: number; share: number }

/** Impact tiles and reach-by-barangay bars for one quarter. */
export function impactReport(reach: ReachRecord[], quarter: string): { tiles: Tile[]; barangays: BarangayBar[] } {
  const rows = reach.filter((r) => r.quarter === quarter);
  const sum = (f: (r: ReachRecord) => number) => rows.reduce((a, r) => a + f(r), 0);
  const lessons = sum((r) => r.lessons);
  const offline = lessons ? Math.round((sum((r) => r.offlineLessons) / lessons) * 100) : 0;
  const peak = Math.max(...rows.map((r) => r.learners), 0);
  return {
    tiles: [
      { key: 'learners', label: 'Learners reached', value: count(sum((r) => r.learners)), tone: 'brand' },
      { key: 'barangays', label: 'Barangays covered', value: count(new Set(rows.map((r) => r.barangay)).size), tone: 'brand' },
      { key: 'lessons', label: 'Lessons completed', value: count(lessons), tone: 'brand' },
      { key: 'offline', label: 'Offline usage', value: `${offline}%`, tone: 'warning' },
    ],
    barangays: rows
      .map((r) => ({ name: r.barangay, learners: r.learners, share: peak ? r.learners / peak : 0 }))
      .sort((a, b) => b.learners - a.learners || a.name.localeCompare(b.name)),
  };
}

export type DeviceStatus = 'Online' | 'Needs Update' | 'Offline';

/** A tablet that cannot be reached is Offline whatever else is true of it. */
export const deviceStatus = (d: DeviceRecord): DeviceStatus => (!d.online ? 'Offline' : d.updateAvailable ? 'Needs Update' : 'Online');

export function deviceTiles(devices: DeviceRecord[]): Tile[] {
  return [
    { key: 'total', label: 'Total Shared Tablets', value: count(devices.length), tone: 'brand' },
    { key: 'online', label: 'Online now', value: count(devices.filter((d) => d.online).length), tone: 'brand' },
    { key: 'attention', label: 'Need attention', value: count(devices.filter((d) => deviceStatus(d) === 'Needs Update').length), tone: 'warning' },
  ];
}

export interface DeviceRow { id: string; name: string; context: string; detail: string; status: DeviceStatus }

const RANK: Record<DeviceStatus, number> = { 'Needs Update': 0, Offline: 1, Online: 2 };

/** Problem tablets first, then by name. */
export function deviceRows(devices: DeviceRecord[]): DeviceRow[] {
  return devices
    .map((d) => {
      const status = deviceStatus(d);
      return {
        id: d.id,
        name: d.name,
        context: `${d.grade} · ${d.classroom}`,
        detail: status === 'Offline' ? (d.lastSeenAt ? `Last seen ${ago(d.lastSeenAt)}` : 'Not seen yet') : `${d.storageUsedPercent}% storage used`,
        status,
      };
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name, 'en', { numeric: true }));
}
