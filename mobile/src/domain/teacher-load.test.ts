import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { loadCached, parseClassrooms, type Cached } from './teacher-load';
import { parseClassroomReport, type ClassroomReport } from './teacher';
import recorded from './recorded/classroom-report.json';

const memory = (start: Cached<ClassroomReport> | null = null) => {
  let saved = start;
  return { cache: { get: async () => saved, put: async (entry: Cached<ClassroomReport>) => { saved = entry; } }, saved: () => saved };
};
const offline = async () => { throw new ApiError(0, 'offline'); };

describe('loadCached', () => {
  it('parses the live report and saves it', async () => {
    const store = memory();
    const loaded = await loadCached(async () => recorded, parseClassroomReport, store.cache, new Date('2026-10-07T10:00:00.000Z'));
    expect(loaded.stale).toBe(false);
    expect(store.saved()?.fetchedAt).toBe('2026-10-07T10:00:00.000Z');
  });

  it('shows the saved report, marked stale, when the server cannot be reached', async () => {
    const store = memory();
    await loadCached(async () => recorded, parseClassroomReport, store.cache, new Date('2026-10-07T10:00:00.000Z'));
    expect(await loadCached(offline, parseClassroomReport, store.cache)).toMatchObject({ stale: true, fetchedAt: '2026-10-07T10:00:00.000Z' });
  });

  it('still fails when nothing was saved, or the session expired', async () => {
    await expect(loadCached(offline, parseClassroomReport, memory().cache)).rejects.toThrow('offline');
    const store = memory({ value: { classroomId: 'c', learners: [], decisionPolicy: '' }, fetchedAt: '2026-10-07T10:00:00.000Z' });
    await expect(loadCached(async () => { throw new ApiError(401, 'expired'); }, parseClassroomReport, store.cache)).rejects.toThrow('expired');
  });

  it('rejects a drifted shape instead of caching it', async () => {
    const store = memory();
    await expect(loadCached(async () => ({ ...recorded, learners: 7 }), parseClassroomReport, store.cache)).rejects.toThrow(/learners/);
    expect(store.saved()).toBeNull();
  });
});

describe('parseClassrooms', () => {
  const room = { id: 'a', name: 'Sampaguita', grade: 5, teacherId: 't', schoolId: 's', createdAt: 'x' };
  it('keeps the fields the shell uses', () => {
    expect(parseClassrooms({ items: [room], total: 1 })).toEqual([{ id: 'a', name: 'Sampaguita', grade: 5, teacherId: 't', schoolId: 's' }]);
  });
  it('rejects a changed shape', () => {
    expect(() => parseClassrooms({ items: [{ ...room, grade: '5' }] })).toThrow(/item 0/);
    expect(() => parseClassrooms({})).toThrow(/missing/);
  });
});
