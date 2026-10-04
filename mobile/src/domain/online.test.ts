import { describe, expect, it } from 'vitest';
import { allows, onlineState, parseLinks, uploadSummary, usable } from './online';
import type { Session } from './server';
import type { Attempt } from './engine';
import type { Upload } from '../data/repository';

const session = (over: Partial<Session> = {}): Session => ({
  user: { id: 'u1', loginId: 'teacher-demo', alias: 'T', role: 'TEACHER', jurisdictionId: 'j1', schoolId: 's1', coins: 0 },
  accessToken: 'a', refreshToken: 'r', expiresIn: 900, deviceId: 'd1', offlineUntil: 2_000, ...over,
});

const attempt = (id: string): Attempt => ({ id, exerciseId: `e.${id}`, selectedOption: 0, at: '2026-10-01T00:00:00.000Z' });

describe('usable', () => {
  it('accepts a session whose refresh token has not expired', () => {
    expect(usable(session(), 1_000)).toBe(true);
  });
  it('rejects a missing, revoked or expired session', () => {
    expect(usable(null, 1_000)).toBe(false);
    expect(usable(session({ revoked: true }), 1_000)).toBe(false);
    expect(usable(session({ offlineUntil: 500 }), 1_000)).toBe(false);
  });
});

describe('onlineState', () => {
  it('reports UNREACHABLE before anything else, even with a good session', () => {
    expect(onlineState(false, session(), 1_000)).toBe('UNREACHABLE');
  });
  it('separates never-signed-in from signed-in-too-long-ago', () => {
    expect(onlineState(true, null, 1_000)).toBe('SIGNED_OUT');
    expect(onlineState(true, session({ offlineUntil: 500 }), 1_000)).toBe('EXPIRED');
    expect(onlineState(true, session(), 1_000)).toBe('READY');
  });
});

describe('allows', () => {
  it('ranks roles so an admin passes a teacher check', () => {
    expect(allows(session({ user: { ...session().user, role: 'LGU_ADMIN' } }), 'TEACHER')).toBe(true);
    expect(allows(session(), 'TEACHER')).toBe(true);
    expect(allows(session({ user: { ...session().user, role: 'STUDENT' } }), 'TEACHER')).toBe(false);
  });
  it('refuses a revoked session whatever its role', () => {
    expect(allows(session({ revoked: true }), 'STUDENT')).toBe(false);
    expect(allows(null, 'STUDENT')).toBe(false);
  });
});

describe('parseLinks', () => {
  it('returns nothing for absent or unreadable storage', () => {
    expect(parseLinks(null)).toEqual({});
    expect(parseLinks('not json')).toEqual({});
    expect(parseLinks('[1,2]')).toEqual({});
  });
  it('drops a half-written link rather than uploading to the wrong Classroom', () => {
    const raw = JSON.stringify({
      good: { learnerId: 'l1', classroomId: 'c1', serverAlias: 'Alias' },
      noClassroom: { learnerId: 'l2' },
      noLearner: { classroomId: 'c3' },
      empty: { learnerId: '', classroomId: 'c4' },
    });
    expect(Object.keys(parseLinks(raw))).toEqual(['good']);
    expect(parseLinks(raw).good).toEqual({ profileId: 'good', learnerId: 'l1', classroomId: 'c1', serverAlias: 'Alias' });
  });
});

describe('uploadSummary', () => {
  const uploads = new Map<string, Upload>([['a', { state: 'DONE' }], ['b', { state: 'REVIEW', detail: 'why' }]]);
  it('counts an Attempt with no row as pending', () => {
    expect(uploadSummary([attempt('a'), attempt('b'), attempt('c')], uploads)).toEqual({ pending: 1, uploaded: 1, review: 1 });
  });
  it('reads a never-linked Profile as all pending, not as an error', () => {
    expect(uploadSummary([attempt('x'), attempt('y')], new Map())).toEqual({ pending: 2, uploaded: 0, review: 0 });
  });
});
