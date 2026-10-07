import { describe, expect, it } from 'vitest';
import {
  canOpenAdmin,
  dashboardTiles,
  deviceRows,
  deviceStatus,
  deviceTiles,
  engagementSeries,
  impactReport,
  parseEngagement,
  parseDevices,
  parseImpactReport,
  parsePacks,
  parseSchools,
  parseUsers,
  quarterOf,
  quarterOptions,
  recentQuarters,
  type DeviceRecord,
} from './admin';
import { fixtureAdminData, fixtureEngagement } from './admin-fixtures';
import type { Session } from './server';
import recordedImpact from './recorded/admin-impact-report.json';
import recordedEngagement from './recorded/admin-engagement.json';

const today = '2026-10-07'; // a Wednesday
const data = fixtureAdminData(today);
it('parses live devices and rejects invalid status', () => {
  const device = { ...data.devices[0], status: 'Needs update', updateAvailable: true };
  expect(parseDevices({ items: [device] })[0]).toMatchObject({ online: true, updateAvailable: true });
  expect(parseDevices({ items: [{ ...device, status: 'Offline' }] })[0].online).toBe(false);
  expect(() => parseDevices({ items: [{ ...device, status: 'unknown' }] })).toThrow();
});
const session = (role: Session['user']['role'], revoked = false): Session =>
  ({ user: { ...data.users[0], role }, accessToken: '', refreshToken: '', expiresIn: 0, deviceId: '', offlineUntil: 0, revoked });

describe('canOpenAdmin', () => {
  it('opens only for a live LGU_ADMIN session on a reachable server', () => {
    expect(canOpenAdmin('READY', session('LGU_ADMIN'))).toBe(true);
    expect(canOpenAdmin('READY', session('TEACHER'))).toBe(false);
    expect(canOpenAdmin('READY', session('LGU_ADMIN', true))).toBe(false);
    expect(canOpenAdmin('READY', null)).toBe(false);
  });
  it('closes when the session expires or the connection drops', () => {
    expect(canOpenAdmin('EXPIRED', session('LGU_ADMIN'))).toBe(false);
    expect(canOpenAdmin('UNREACHABLE', session('LGU_ADMIN'))).toBe(false);
  });
});

describe('dashboardTiles', () => {
  it('reports Learners, Teachers, active Shared Tablets and completion rate', () => {
    const tiles = Object.fromEntries(dashboardTiles(data).map((t) => [t.key, t.value]));
    expect(tiles).toEqual({ learners: '1,204', teachers: '42', tablets: '142', completion: '79%' });
  });
  it('shows zeros, not NaN, with no data', () => {
    const empty = dashboardTiles({ impact: { ...data.impact, activeStudents: 0, studentsWithPractice: 0 }, users: [], devices: [] });
    expect(empty.map((t) => t.value)).toEqual(['0', '0', '0', '0%']);
  });
  it('skips deactivated Teachers', () => {
    const users = data.users.map((u) => (u.role === 'TEACHER' ? { ...u, active: false } : u));
    expect(dashboardTiles({ ...data, users }).find((t) => t.key === 'teachers')?.value).toBe('0');
  });
});

describe('engagementSeries', () => {
  it('gives seven bars ending today, today highlighted, scaled to the busiest day', () => {
    const { bars } = engagementSeries(data.engagement, today);
    expect(bars).toHaveLength(7);
    expect(bars.map((b) => b.label).join('')).toBe('TFSSMTW');
    expect(bars.filter((b) => b.today).map((b) => b.date)).toEqual([today]);
    expect(Math.max(...bars.map((b) => b.height))).toBe(1);
  });
  it('gives week-on-week change against the seven days before', () => {
    const days = [...fixtureEngagement(today)].map((d) => ({ ...d, activeLearners: 100 }));
    expect(engagementSeries(days, today).changePercent).toBe(0);
    const up = days.map((d, i) => (i >= 7 ? { ...d, activeLearners: 112 } : d));
    expect(engagementSeries(up, today)).toMatchObject({ total: 784, changePercent: 12 });
  });
  it('handles empty data: zero bars, no change', () => {
    const s = engagementSeries([], today);
    expect(s.bars.every((b) => b.value === 0 && b.height === 0)).toBe(true);
    expect(s.changePercent).toBeNull();
  });
});

describe('quarters', () => {
  it('names the quarter a date falls in, and lists quarters newest first', () => {
    expect(quarterOf('2026-10-07')).toBe('2026-Q4');
    expect(quarterOf('2026-03-31')).toBe('2026-Q1');
    expect(quarterOptions(data.reach, today).map((q) => q.value)).toEqual(['2026-Q4', '2026-Q3', '2026-Q2']);
  });
  it('always offers the current quarter, even with no records', () => {
    expect(quarterOptions([], today)).toEqual([{ value: '2026-Q4', label: 'Q4 2026' }]);
  });
});

describe('impactReport', () => {
  const rec = (barangay: string, learners: number) => ({ quarter: 'x', barangay, learners, lessons: 1, offlineLessons: 0 });
  it('counts only the chosen quarter', () => {
    const tiles = (q: string) => Object.fromEntries(impactReport(data.reach, q).tiles.map((t) => [t.key, t.value]));
    expect(tiles('2026-Q3')).toEqual({ learners: '1,204', barangays: '3', lessons: '9,100', offline: '80%' });
    expect(tiles('2026-Q2')).not.toEqual(tiles('2026-Q3'));
  });
  it('orders barangays by Learners reached, then by name, with bars scaled to the largest', () => {
    const { barangays } = impactReport(data.reach, '2026-Q3');
    expect(barangays.map((b) => b.name)).toEqual(['Pembo', 'Cembo', 'Rizal']);
    expect(barangays[0].share).toBe(1);
    expect(impactReport([rec('B', 5), rec('A', 5)], 'x').barangays.map((b) => b.name)).toEqual(['A', 'B']);
  });
  it('shows zeros, not NaN, for a quarter with no records', () => {
    const empty = impactReport(data.reach, '2020-Q1');
    expect(empty.tiles.map((t) => t.value)).toEqual(['0', '0', '0', '0%']);
    expect(empty.barangays).toEqual([]);
  });
});

describe('device status', () => {
  const device = (over: Partial<DeviceRecord>): DeviceRecord => ({ ...data.devices[0], online: true, updateAvailable: false, ...over });
  it('maps offline, needs-update and online', () => {
    expect(deviceStatus(device({ online: false, updateAvailable: true }))).toBe('Offline');
    expect(deviceStatus(device({ updateAvailable: true }))).toBe('Needs Update');
    expect(deviceStatus(device({}))).toBe('Online');
  });
  it('tiles count total, online now and need attention', () => {
    const tiles = Object.fromEntries(deviceTiles(data.devices).map((t) => [t.key, t.value]));
    expect(tiles).toEqual({ total: '160', online: '142', attention: '9' });
  });
  it('rows show storage when online and last seen when offline, problem tablets first', () => {
    const rows = deviceRows([
      device({ id: 'a', name: 'A', storageUsedPercent: 40 }),
      device({ id: 'b', name: 'B', online: false, lastSeenAt: null }),
      device({ id: 'c', name: 'C', updateAvailable: true }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows.find((r) => r.id === 'a')?.detail).toBe('40% storage used');
    expect(rows.find((r) => r.id === 'b')?.detail).toBe('Not seen yet');
    expect(rows.find((r) => r.id === 'b')?.status).toBe('Offline');
  });
});

describe('Impact report contract test', () => {
  it('parses recorded responses through the Admin view model', () => {
    const report = parseImpactReport(recordedImpact);
    expect(report.jurisdictionId).toBe('a1b2c3d4-0000-4000-8000-000000000001');
    expect(report.schools).toBe(2);
    expect(report.quarter).toBe('2026-Q4');
    expect(report.learnersReached).toBe(28);
    expect(report.lessonsCompleted).toBe(84);
    expect(report.offlineUsageShare).toBeCloseTo(0.3571, 4);

    const reachRecords = (report.reachByBarangay ?? []).map((b) => ({
      quarter: report.quarter!,
      barangay: b.barangay,
      learners: b.learners,
      lessons: b.lessons,
      offlineLessons: b.offlineLessons,
    }));

    const view = impactReport(reachRecords, '2026-Q4');
    expect(view.tiles).toEqual([
      { key: 'learners', label: 'Learners reached', value: '28', tone: 'brand' },
      { key: 'barangays', label: 'Barangays covered', value: '2', tone: 'brand' },
      { key: 'lessons', label: 'Lessons completed', value: '84', tone: 'brand' },
      { key: 'offline', label: 'Offline usage', value: '36%', tone: 'warning' },
    ]);
    expect(view.barangays.map((b) => b.name)).toEqual(['Pembo', 'Cembo']);
    expect(view.barangays[0].learners).toBe(16);
    expect(view.barangays[0].share).toBe(1);
    expect(view.barangays[1].share).toBeCloseTo(12 / 16, 2);
  });

  it.each(['jurisdictionId', 'generatedAt', 'schools', 'activeStudents', 'attempts', 'disclaimer'])(
    'fails when impact report loses %s',
    (field) => {
      const { [field]: _gone, ...rest } = recordedImpact as Record<string, unknown>;
      expect(() => parseImpactReport(rest)).toThrow(/Admin report/);
    },
  );

  it('fails when a value has the wrong type', () => {
    expect(() => parseImpactReport({ ...recordedImpact, schools: 'two' })).toThrow(/schools/);
    expect(() => parseImpactReport('not an object')).toThrow(/object/);
  });
});

describe('Engagement contract test', () => {
  it('parses recorded responses through the engagementSeries view model', () => {
    const days = parseEngagement(recordedEngagement);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-10-01', activeLearners: 12 });

    const series = engagementSeries(days, '2026-10-07');
    expect(series.bars).toHaveLength(7);
    expect(series.total).toBe(120);
    expect(series.bars[6].today).toBe(true);
    expect(series.bars[6].value).toBe(22);
  });

  it('fails when engagement payload is invalid', () => {
    expect(() => parseEngagement({ not: 'a list' })).toThrow(/list/);
    expect(() => parseEngagement([{ date: 123, activeLearners: 10 }])).toThrow(/date/);
  });
});

describe('recentQuarters', () => {
  it('generates the last N quarters newest first', () => {
    expect(recentQuarters('2026-10-07', 4)).toEqual(['2026-Q4', '2026-Q3', '2026-Q2', '2026-Q1']);
    expect(recentQuarters('2026-02-15', 3)).toEqual(['2026-Q1', '2025-Q4', '2025-Q3']);
  });
});

describe('parseUsers, parseSchools, parsePacks', () => {
  it('parses users list', () => {
    const users = parseUsers({
      items: [
        { id: 'u1', loginId: 'admin-1', alias: 'Admin 1', role: 'LGU_ADMIN', active: true },
      ],
    });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: 'u1', loginId: 'admin-1', role: 'LGU_ADMIN' });
    expect(() => parseUsers('bad')).toThrow(/list/);
  });

  it('parses schools list', () => {
    const schools = parseSchools({
      items: [{ id: 's1', name: 'School 1', barangay: 'Pembo' }],
    });
    expect(schools).toHaveLength(1);
    expect(schools[0].barangay).toBe('Pembo');
  });

  it('parses content packs list', () => {
    const packs = parsePacks({
      items: [{ id: 'p1', title: 'Math 5', subject: 'MATH', grade: 5, version: '1.0' }],
    });
    expect(packs).toHaveLength(1);
    expect(packs[0].title).toBe('Math 5');
  });
});
