import { describe, expect, it } from 'vitest';
import { learningState, type Attempt } from '../domain/engine';
import { SyncEngine } from '../domain/sync';
import type { SyncResponse } from '../domain/server';
import type { Pack } from '../domain/types';
import { AttemptOutbox } from './outbox';
import type { Repository, Upload } from './repository';

const SKILL = 'math5.fractions.add';
const pack: Pack = {
  id: 'p', title: 'P', subject: 'MATH', grade: 5, version: '1', grading: 'ON_SYNC', skills: [{ id: SKILL, parameters: { prior: 0.2, learn: 0.1, guess: 0.2, slip: 0.1 } }],
  lessons: [{ id: 'l', packId: 'p', title: 'L', skillCode: SKILL, body: '', hints: {}, exercises: ['e0', 'e1'].map((id) => ({ id, lessonId: 'l', prompt: '', options: ['a', 'b'], correctOption: null })) }],
};
const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const log: Attempt[] = [0, 1].map((n) => ({ id: uuid(n), exerciseId: `e${n}`, selectedOption: 0, at: `2026-10-01T00:00:0${n}.000Z` }));

class MemoryRepo {
  rows = new Map<string, Upload>();
  crashAfter = Infinity;
  async notUploaded(_o: string, limit: number) { return log.filter((a) => !this.rows.has(a.id)).slice(0, limit); }
  async markUpload(_o: string, id: string, upload: Upload) {
    if (this.rows.size >= this.crashAfter) throw new Error('app killed');
    this.rows.set(id, upload);
  }
}

describe('killing the app mid-sync', () => {
  it('loses and double-counts nothing: settled Attempts stay settled, the rest go again, and the server pays once', async () => {
    const repo = new MemoryRepo();
    const paid = new Set<string>();
    const push = async (batch: { clientAttemptId: string }[]): Promise<SyncResponse> => {
      const results = batch.map((i) => {
        const duplicate = paid.has(i.clientAttemptId);
        paid.add(i.clientAttemptId);
        return { clientAttemptId: i.clientAttemptId, correct: true, awardedCoins: duplicate ? 0 : 5, duplicate };
      });
      return { results, awardedCoins: results.reduce((s, r) => s + r.awardedCoins, 0), coinBalance: paid.size * 5, serverTime: '', modelVersion: 'bkt-1' };
    };
    const engine = () => new SyncEngine(new AttemptOutbox(repo as unknown as Repository, 'c1', (slug) => slug), push, () => true);

    repo.crashAfter = 1; // dies after the first row of the batch is written
    await expect(engine().run('o')).rejects.toThrow('app killed');
    expect(repo.rows.size).toBe(1);
    const partway = learningState([pack], log, repo.rows);
    // The settled row carries the server's balance, which already holds both awards.
    expect(partway.coins).toBe(10);

    repo.crashAfter = Infinity; // reopened
    expect(await engine().run('o')).toEqual({ accepted: 0, duplicate: 1, review: 0 });
    const after = learningState([pack], log, repo.rows);
    expect(after.coins).toBe(10);
    expect(after.statuses.get(uuid(0))).toBe('marked');
    expect(after.statuses.get(uuid(1))).toBe('marked');
  });
});
