import { describe, expect, it } from 'vitest';
import { canOpenAdmin, dashboardTiles, deviceRows, deviceStatus, deviceTiles, engagementSeries, impactReport, quarterOf, quarterOptions, type DeviceRecord } from './admin';
import { fixtureAdminData, fixtureEngagement } from './admin-fixtures';
import type { Session } from './server';

const today = '2026-10-07'; // a Wednesday
const data = fixtureAdminData(today);
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
