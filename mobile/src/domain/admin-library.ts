import type { Role, ServerPackSummary, ServerUser } from './server';
import { storageLabel } from './sidebar';

/**
 * Content Management and User Management view models. Pure: payloads in,
 * screen-ready rows out.
 */

/** A Content Pack in the library. The server lists only published Packs; Draft and size are fixture-only. */
export interface LibraryPack extends ServerPackSummary { sizeBytes: number; status: 'PUBLISHED' | 'DRAFT' }
export interface Library { capacityBytes: number; packs: LibraryPack[] }

export interface PackRow { id: string; title: string; detail: string; chip: 'Published' | 'Draft'; published: boolean }
export interface LibraryView { used: string; capacity: string; fraction: number; rows: PackRow[] }

export function libraryView({ capacityBytes, packs }: Library): LibraryView {
  const used = packs.reduce((sum, p) => sum + p.sizeBytes, 0);
  return {
    used: storageLabel(used),
    capacity: storageLabel(capacityBytes),
    fraction: capacityBytes ? Math.min(1, used / capacityBytes) : 0,
    rows: packs.map((p) => ({
      id: p.id,
      title: p.title,
      detail: `${p.subject} · Grade ${p.grade} · v${p.version} · ${storageLabel(p.sizeBytes)}`,
      chip: p.status === 'PUBLISHED' ? 'Published' : 'Draft',
      published: p.status === 'PUBLISHED',
    })),
  };
}

export type RoleFilter = 'ALL' | Role;
export interface UserRow { id: string; name: string; context: string; role: string; chip: 'Active' | 'Suspended'; active: boolean }

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Learner', TEACHER: 'Teacher', LGU_ADMIN: 'LGU Admin' };

/** Accounts for the role tab and search, by alias or login id; an unset `active` means active. */
export function userRows(users: ServerUser[], schoolName: string, filter: RoleFilter, query: string): UserRow[] {
  const q = query.trim().toLowerCase();
  return users
    .filter((u) => (filter === 'ALL' || u.role === filter) && (!q || u.alias.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q)))
    .map((u) => ({
      id: u.id,
      name: u.alias,
      role: ROLE_LABEL[u.role],
      context: `${ROLE_LABEL[u.role]} · ${schoolName}`,
      active: u.active !== false,
      chip: u.active === false ? 'Suspended' : 'Active',
    }));
}

export const fixtureLibrary = (): Library => ({
  capacityBytes: 2 * 1024 ** 3,
  packs: [
    { id: 'pack-math-3', title: 'Math Grade 3', subject: 'Math', grade: 3, version: '1.2', sizeBytes: 148 * 1024 ** 2, status: 'PUBLISHED' },
    { id: 'pack-sci-4', title: 'Science Grade 4', subject: 'Science', grade: 4, version: '1.0', sizeBytes: 212 * 1024 ** 2, status: 'PUBLISHED' },
    { id: 'pack-eng-5', title: 'English Grade 5', subject: 'English', grade: 5, version: '0.9', sizeBytes: 96 * 1024 ** 2, status: 'DRAFT' },
  ],
});
