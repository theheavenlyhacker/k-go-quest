import type { Role, Skill } from './types';
export const roleHome = (role: Role) => role === 'STUDENT' ? '/(student)/learn' : role === 'TEACHER' ? '/(teacher)/class' : '/(admin)/schools';
export const roleName = (role: Role) => role === 'LGU_ADMIN' ? 'LGU Admin' : role === 'TEACHER' ? 'Teacher' : 'Student';
export const initials = (alias: string) => alias.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
export const meanMastery = (skills: Skill[]) => skills.length ? skills.reduce((sum, s) => sum + s.mastery, 0) / skills.length : null;
export const pct = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value * 100)}%`;
export const ago = (date: string | null | undefined) => {
  if (!date) return 'Not yet synced';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`; return `${Math.floor(minutes / 1440)}d ago`;
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
