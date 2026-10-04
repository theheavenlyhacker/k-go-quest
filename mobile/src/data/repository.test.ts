import { describe, expect, it } from 'vitest';
import { LocalRepository, type Database } from './repository';

describe('deleteOwner', () => {
  it('removes the Attempts and Purchases of one owner only', async () => {
    const runs: [string, unknown[] | undefined][] = [];
    const db: Database = { exec: async () => {}, run: async (sql, params) => { runs.push([sql, params]); }, first: async () => null, all: async () => [] };
    await new LocalRepository(db, {} as never).deleteOwner('p1');
    expect(runs).toEqual([
      ['DELETE FROM attempts WHERE owner = ?', ['p1']],
      ['DELETE FROM purchases WHERE owner = ?', ['p1']],
    ]);
  });
});
