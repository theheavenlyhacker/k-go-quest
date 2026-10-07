import { describe, expect, it } from 'vitest';
import { canOpenAdmin, dashboardTiles, engagementSeries } from './admin';
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
