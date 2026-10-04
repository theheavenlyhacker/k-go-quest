import { describe, expect, it } from 'vitest';
import { LocalRepository, type Database } from './repository';
import type { DownloadedPack } from '../domain/packs';
import type { Pack } from '../domain/types';

describe('deleteOwner', () => {
  it('removes the Attempts, Purchases and upload records of one owner only', async () => {
    const runs: [string, unknown[] | undefined][] = [];
    const db: Database = { exec: async () => {}, run: async (sql, params) => { runs.push([sql, params]); }, first: async () => null, all: async () => [] };
    await new LocalRepository(db, {} as never).deleteOwner('p1');
    expect(runs).toEqual([
      ['DELETE FROM attempts WHERE owner = ?', ['p1']],
      ['DELETE FROM purchases WHERE owner = ?', ['p1']],
      // Without this a deleted Profile's id would keep its upload rows, and a new
      // Profile that reused the id would look already uploaded.
      ['DELETE FROM uploads WHERE owner = ?', ['p1']],
    ]);
  });
});

describe('the Downloaded Pack cache', () => {
  const pack = (id: string): Pack => ({
    id, title: 'Fractions', subject: 'MATH', grade: 5, version: '1.3.0', grading: 'ON_SYNC',
    skills: [{ id: 'math5.equivalent', parameters: { prior: 0.2, learn: 0.08, guess: 0.2, slip: 0.1 } }],
    lessons: [{
      id: `${id}-l1`, packId: id, title: 'Equivalent fractions', skillCode: 'math5.equivalent', body: 'Body.', hints: {},
      exercises: [{ id: `${id}-q1`, lessonId: `${id}-l1`, prompt: 'Which?', options: ['a', 'b'], correctOption: null }],
    }],
  });
  const record = (id: string): DownloadedPack => ({ checksum: 'sum', downloadedAt: '2026-10-04T00:00:00.000Z', pack: pack(id) });

  function fake(rows: { checksum: string; downloaded_at: string; payload: string }[] = []) {
    const log: string[] = [];
    const db: Database = {
      exec: async (sql) => { log.push(sql); },
      run: async (sql) => { log.push(sql); },
      first: async () => null,
      all: async <T,>() => rows as unknown as T[],
    };
    return { db, log, repo: new LocalRepository(db, {} as never) };
  }

  it('saves a Pack and removes the id it supersedes in one transaction, so a Learner never sees two copies', async () => {
    const { log, repo } = fake();
    await repo.saveDownloadedPack(record('pack-2'), 'pack-1');
    expect(log[0]).toBe('BEGIN IMMEDIATE');
    expect(log.at(-1)).toBe('COMMIT');
    // The removal goes first: a Pack that supersedes its own id must not be
    // deleted again after it has been written.
    expect(log.findIndex((sql) => sql.startsWith('DELETE FROM packs'))).toBeLessThan(log.findIndex((sql) => sql.startsWith('INSERT INTO packs')));
  });

  it('writes nothing but the Pack when there is no older version to supersede', async () => {
    const { log, repo } = fake();
    await repo.saveDownloadedPack(record('pack-1'), null);
    expect(log.filter((sql) => sql.startsWith('DELETE FROM packs'))).toEqual([]);
  });

  it('rolls back a failed save rather than leaving half a Pack behind', async () => {
    const log: string[] = [];
    const db: Database = {
      exec: async (sql) => { log.push(sql); },
      run: async (sql) => { log.push(sql); if (sql.startsWith('INSERT')) throw new Error('disk full'); },
      first: async () => null,
      all: async () => [],
    };
    await expect(new LocalRepository(db, {} as never).saveDownloadedPack(record('pack-2'), null)).rejects.toThrow('disk full');
    expect(log.at(-1)).toBe('ROLLBACK');
  });

  it('reads back the Packs it stored', async () => {
    const stored = record('pack-1');
    const { repo } = fake([{ checksum: 'sum', downloaded_at: stored.downloadedAt, payload: JSON.stringify(stored.pack) }]);
    expect(await repo.downloadedPacks()).toEqual([stored]);
  });

  /**
   * One unreadable row must not take the Subjects screen down with it: the rest
   * of the Packs, and the Starter Pack beside them, still work.
   */
  it('skips a Pack whose stored content cannot be read', async () => {
    const { repo } = fake([
      { checksum: 'sum', downloaded_at: '2026-10-04T00:00:00.000Z', payload: '{not json' },
      { checksum: 'sum', downloaded_at: '2026-10-04T00:00:00.000Z', payload: JSON.stringify(pack('pack-1')) },
    ]);
    expect((await repo.downloadedPacks()).map((entry) => entry.pack.id)).toEqual(['pack-1']);
  });
});
