import { describe, expect, it } from 'vitest';
import { fixtureLibrary, libraryView, userRows } from './admin-library';
import type { ServerUser } from './server';

const u = (id: string, role: ServerUser['role'], alias: string, active?: boolean): ServerUser =>
  ({ id, loginId: `${alias.toLowerCase()}@x.ph`, alias, role, jurisdictionId: 'j', schoolId: 's', coins: 0, active });
const users = [u('1', 'STUDENT', 'Mango'), u('2', 'TEACHER', 'Ms Cruz'), u('3', 'LGU_ADMIN', 'Admin Reyes'), u('4', 'STUDENT', 'Bayabas', false)];

describe('libraryView', () => {
  it('maps pack status to a chip and totals storage', () => {
    const v = libraryView(fixtureLibrary());
    expect(v.rows.map((r) => r.chip)).toEqual(['Published', 'Published', 'Draft']);
    expect(v.rows[0].detail).toBe('Math · Grade 3 · v1.2 · 148.0 MB');
    expect(v.used).toBe('456.0 MB');
    expect(v.fraction).toBeCloseTo(456 / 2048);
  });
  it('is empty and zero-safe with no packs or capacity', () => {
    expect(libraryView({ capacityBytes: 0, packs: [] })).toMatchObject({ fraction: 0, rows: [] });
  });
  it('caps the bar at full', () => {
    expect(libraryView({ capacityBytes: 1, packs: fixtureLibrary().packs }).fraction).toBe(1);
  });
});

describe('userRows', () => {
  it('filters by role tab', () => {
    expect(userRows(users, 'School', 'STUDENT', '').map((r) => r.name)).toEqual(['Mango', 'Bayabas']);
    expect(userRows(users, 'School', 'ALL', '')).toHaveLength(4);
  });
  it('searches alias and login id, case-insensitively, within the tab', () => {
    expect(userRows(users, 'School', 'ALL', ' cruz ').map((r) => r.id)).toEqual(['2']);
    expect(userRows(users, 'School', 'TEACHER', 'mango')).toEqual([]);
    expect(userRows(users, 'School', 'ALL', 'bayabas@x').map((r) => r.id)).toEqual(['4']);
  });
  it('maps active to a chip and labels role and context', () => {
    const rows = userRows(users, 'Pembo ES', 'ALL', '');
    expect(rows.map((r) => r.chip)).toEqual(['Active', 'Active', 'Active', 'Suspended']);
    expect(rows[2]).toMatchObject({ role: 'LGU Admin', context: 'LGU Admin · Pembo ES' });
  });
});
