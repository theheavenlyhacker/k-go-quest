import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { SyncEngine, retryDelay, validateAcknowledgment, type Outbox } from './sync';
import type { AttemptInput, SyncResponse } from './server';

const input = (id: string): AttemptInput => ({
  clientAttemptId: id, classroomId: 'c1', exerciseId: `e.${id}`, selectedOption: 0, occurredAt: '2026-10-01T00:00:00.000Z',
});

const ok = (ids: string[], coins = 0): SyncResponse => ({
  results: ids.map((id) => ({ clientAttemptId: id, correct: true, awardedCoins: coins, duplicate: false })),
  awardedCoins: coins * ids.length, coinBalance: 10, serverTime: '2026-10-01T00:00:00.000Z', modelVersion: 'bkt-1',
});

class FakeOutbox implements Outbox {
  settled: string[] = [];
  reviewed: { id: string; message: string }[] = [];
  constructor(private queue: AttemptInput[]) {}
  async pending(_owner: string, limit: number) { return this.queue.slice(0, limit); }
  async acknowledge(_owner: string, response: SyncResponse) {
    for (const r of response.results) { this.settled.push(r.clientAttemptId); this.queue = this.queue.filter((i) => i.clientAttemptId !== r.clientAttemptId); }
  }
  async review(_owner: string, id: string, message: string) {
    this.reviewed.push({ id, message }); this.queue = this.queue.filter((i) => i.clientAttemptId !== id);
  }
}

describe('validateAcknowledgment', () => {
  it('accepts a response that answers exactly the batch it was sent', () => {
    expect(() => validateAcknowledgment([input('a'), input('b')], ok(['a', 'b']))).not.toThrow();
  });
  it('refuses a short, padded or mismatched answer', () => {
    expect(() => validateAcknowledgment([input('a'), input('b')], ok(['a']))).toThrow(ApiError);
    expect(() => validateAcknowledgment([input('a')], ok(['a', 'b']))).toThrow(ApiError);
    expect(() => validateAcknowledgment([input('a')], ok(['other']))).toThrow(ApiError);
  });
  it('refuses coin totals that do not add up', () => {
    const tampered = { ...ok(['a'], 5), awardedCoins: 99 };
    expect(() => validateAcknowledgment([input('a')], tampered)).toThrow(ApiError);
  });
});

describe('SyncEngine', () => {
  it('uploads everything when the server accepts', async () => {
    const outbox = new FakeOutbox([input('a'), input('b')]);
    const engine = new SyncEngine(outbox, async (batch) => ok(batch.map((i) => i.clientAttemptId)), () => true);
    expect(await engine.run('owner')).toEqual({ accepted: 2, duplicate: 0, review: 0 });
    expect(outbox.settled).toEqual(['a', 'b']);
  });

  it('splits a rejected batch to isolate the one bad Attempt', async () => {
    const outbox = new FakeOutbox([input('a'), input('bad'), input('c'), input('d')]);
    const engine = new SyncEngine(
      outbox,
      async (batch) => {
        if (batch.some((i) => i.clientAttemptId === 'bad')) throw new ApiError(422, 'That Exercise is not published.');
        return ok(batch.map((i) => i.clientAttemptId));
      },
      () => true,
    );
    const summary = await engine.run('owner');
    expect(summary.review).toBe(1);
    expect(outbox.reviewed).toEqual([{ id: 'bad', message: 'That Exercise is not published.' }]);
    // The other three still went up: one bad answer must not strand the rest.
    expect(outbox.settled.sort()).toEqual(['a', 'c', 'd']);
  });

  it('keeps a retryable failure in the outbox instead of marking it for review', async () => {
    const outbox = new FakeOutbox([input('a')]);
    const engine = new SyncEngine(outbox, async () => { throw new ApiError(503, 'Server busy.'); }, () => true);
    await expect(engine.run('owner')).rejects.toThrow(ApiError);
    expect(outbox.reviewed).toEqual([]);
    expect(outbox.settled).toEqual([]);
  });

  it('stops when the Profile is no longer the active one', async () => {
    const outbox = new FakeOutbox([input('a')]);
    const engine = new SyncEngine(outbox, async (batch) => ok(batch.map((i) => i.clientAttemptId)), () => false);
    await expect(engine.run('owner')).rejects.toThrow(ApiError);
    expect(outbox.settled).toEqual([]);
  });

  it('refuses a second Profile while one is syncing, and shares the job for the same one', async () => {
    const outbox = new FakeOutbox([input('a')]);
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const engine = new SyncEngine(outbox, async (batch) => { await gate; return ok(batch.map((i) => i.clientAttemptId)); }, () => true);
    const first = engine.run('owner');
    expect(engine.run('owner')).toBe(first);
    await expect(engine.run('other')).rejects.toThrow(ApiError);
    release();
    await first;
  });
});

describe('retryDelay', () => {
  it('backs off and then holds at a minute', () => {
    expect(retryDelay(0, 0)).toBeLessThan(retryDelay(3, 0));
    expect(retryDelay(99, 1)).toBeLessThanOrEqual(60000);
  });
});
