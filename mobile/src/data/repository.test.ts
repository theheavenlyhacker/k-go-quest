import { describe, expect, it } from 'vitest';
import { LocalRepository, type Database } from './repository';

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
