import type { Outbox } from '../domain/sync';
import type { AttemptInput, AttemptResult, QueuedAttempt, Snapshot, SyncResponse } from '../domain/types';
import { emptySnapshot } from '../domain/types';

export type SqlValue = string | number | null;
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  transaction(work: (tx: Database) => Promise<void>): Promise<void>;
}
export interface Cipher { encrypt(owner: string, key: string, value: unknown): Promise<string>; decrypt<T>(owner: string, key: string, value: string): Promise<T>; }
export const LOCAL_SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS cache (owner TEXT NOT NULL, cache_key TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, cache_key));
CREATE TABLE IF NOT EXISTS outbox (owner TEXT NOT NULL, event_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('PENDING','REVIEW')), cipher TEXT NOT NULL, ordinal INTEGER NOT NULL, PRIMARY KEY(owner, event_id));
CREATE INDEX IF NOT EXISTS pending_by_owner ON outbox(owner, state, ordinal);
CREATE TABLE IF NOT EXISTS outcomes (owner TEXT NOT NULL, event_id TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, event_id));
CREATE TABLE IF NOT EXISTS requests (owner TEXT NOT NULL, reward_id TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, reward_id));
PRAGMA user_version = 1;`;

export interface Repository extends Outbox {
  snapshot(owner: string): Promise<Snapshot>;
  save(owner: string, snapshot: Snapshot): Promise<void>;
  queue(owner: string, input: AttemptInput): Promise<void>;
  queued(owner: string): Promise<QueuedAttempt[]>;
  outcomes(owner: string): Promise<{ input: AttemptInput; result: AttemptResult }[]>;
  redemptionRequest(owner: string, rewardId: string, newId: () => string): Promise<string>;
  finishRedemption(owner: string, rewardId: string): Promise<void>;
}
export class LocalRepository implements Repository {
  constructor(private db: Database, private cipher: Cipher) {}
  /**
   * Reads one encrypted row, tolerating rows this build cannot open.
   *
   * A row becomes unreadable when it was written in an older record format, or
   * when the keystore entry behind it is gone (reinstall, cleared app data,
   * restored backup). Everything cached here is server-authoritative and can be
   * downloaded again, so an unreadable row is discarded rather than thrown: a
   * stale cache must degrade to "nothing cached", never lock a learner out of
   * their own tablet at the PIN screen.
   */
  private async open<T>(owner: string, key: string, value: string, discard: () => Promise<void>): Promise<T | null> {
    try {
      return await this.cipher.decrypt<T>(owner, key, value);
    } catch {
      await discard();
      return null;
    }
  }
  async initialize() {
    const version = await this.db.first<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('This cache requires a newer version of K-Go Quests.');
    await this.db.exec(LOCAL_SCHEMA);
  }
  async snapshot(owner: string) {
    const row = await this.db.first<{ cipher: string }>('SELECT cipher FROM cache WHERE owner = ? AND cache_key = ?', [owner, 'snapshot']);
    if (!row) return emptySnapshot();
    const cached = await this.open<Snapshot>(owner, 'snapshot', row.cipher, () => this.db.run('DELETE FROM cache WHERE owner = ? AND cache_key = ?', [owner, 'snapshot']));
    return cached ?? emptySnapshot();
  }
  async save(owner: string, snapshot: Snapshot) {
    await this.db.run('INSERT INTO cache VALUES (?, ?, ?) ON CONFLICT(owner, cache_key) DO UPDATE SET cipher = excluded.cipher', [owner, 'snapshot', await this.cipher.encrypt(owner, 'snapshot', snapshot)]);
  }
  async queue(owner: string, input: AttemptInput) {
    const cipher = await this.cipher.encrypt(owner, input.clientAttemptId, { input });
    // A UUID identifies an immutable answer, including on this device.
    await this.db.transaction(async (tx) => {
      const found = await tx.first<{ cipher: string }>('SELECT cipher FROM outbox WHERE owner = ? AND event_id = ?', [owner, input.clientAttemptId]);
      if (found) {
        const old = await this.open<{ input: AttemptInput }>(owner, input.clientAttemptId, found.cipher, () => tx.run('DELETE FROM outbox WHERE owner = ? AND event_id = ?', [owner, input.clientAttemptId]));
        if (old) {
          if (JSON.stringify(old.input) !== JSON.stringify(input)) throw new Error('This attempt ID already belongs to a different answer.');
          return;
        }
      }
      await tx.run('INSERT INTO outbox VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner, event_id) DO UPDATE SET state = excluded.state, cipher = excluded.cipher, ordinal = excluded.ordinal', [owner, input.clientAttemptId, 'PENDING', cipher, Date.now()]);
    });
  }
  async queued(owner: string): Promise<QueuedAttempt[]> {
    const rows = await this.db.all<{ event_id: string; state: QueuedAttempt['state']; cipher: string }>('SELECT event_id, state, cipher FROM outbox WHERE owner = ? ORDER BY ordinal, event_id', [owner]);
    const opened = await Promise.all(rows.map(async (row) => {
      const entry = await this.open<{ input: AttemptInput; error?: string }>(owner, row.event_id, row.cipher, () => this.discardOutbox(owner, row.event_id));
      return entry && { ...entry, state: row.state };
    }));
    return opened.filter((entry): entry is QueuedAttempt => entry !== null);
  }
  async pending(owner: string, limit: number) {
    const rows = await this.db.all<{ event_id: string; cipher: string }>('SELECT event_id, cipher FROM outbox WHERE owner = ? AND state = ? ORDER BY ordinal, event_id LIMIT ?', [owner, 'PENDING', limit]);
    const opened = await Promise.all(rows.map((row) => this.open<{ input: AttemptInput }>(owner, row.event_id, row.cipher, () => this.discardOutbox(owner, row.event_id))));
    return opened.filter((entry) => entry !== null).map((entry) => entry.input);
  }
  async review(owner: string, id: string, error: string) {
    await this.db.transaction(async (tx) => {
      const row = await tx.first<{ cipher: string }>('SELECT cipher FROM outbox WHERE owner = ? AND event_id = ?', [owner, id]);
      if (!row) return;
      const original = await this.open<{ input: AttemptInput }>(owner, id, row.cipher, () => tx.run('DELETE FROM outbox WHERE owner = ? AND event_id = ?', [owner, id]));
      if (!original) return;
      await tx.run('UPDATE outbox SET state = ?, cipher = ? WHERE owner = ? AND event_id = ?', ['REVIEW', await this.cipher.encrypt(owner, id, { ...original, error }), owner, id]);
    });
  }
  async acknowledge(owner: string, response: SyncResponse) {
    await this.db.transaction(async (tx) => {
      for (const result of response.results) {
        const row = await tx.first<{ cipher: string }>('SELECT cipher FROM outbox WHERE owner = ? AND event_id = ?', [owner, result.clientAttemptId]);
        if (!row) continue;
        const original = await this.open<{ input: AttemptInput }>(owner, result.clientAttemptId, row.cipher, () => tx.run('DELETE FROM outbox WHERE owner = ? AND event_id = ?', [owner, result.clientAttemptId]));
        // The server accepted the attempt either way, so the outbox row always
        // goes; only the local receipt needs a readable original.
        if (original) await tx.run('INSERT INTO outcomes VALUES (?, ?, ?) ON CONFLICT(owner, event_id) DO UPDATE SET cipher = excluded.cipher', [owner, result.clientAttemptId, await this.cipher.encrypt(owner, result.clientAttemptId, { input: original.input, result })]);
        await tx.run('DELETE FROM outbox WHERE owner = ? AND event_id = ?', [owner, result.clientAttemptId]);
      }
      const row = await tx.first<{ cipher: string }>('SELECT cipher FROM cache WHERE owner = ? AND cache_key = ?', [owner, 'snapshot']);
      const snapshot = (row && await this.open<Snapshot>(owner, 'snapshot', row.cipher, () => tx.run('DELETE FROM cache WHERE owner = ? AND cache_key = ?', [owner, 'snapshot']))) || emptySnapshot();
      if (snapshot.progress) snapshot.progress.coinBalance = response.coinBalance;
      await tx.run('INSERT INTO cache VALUES (?, ?, ?) ON CONFLICT(owner, cache_key) DO UPDATE SET cipher = excluded.cipher', [owner, 'snapshot', await this.cipher.encrypt(owner, 'snapshot', snapshot)]);
    });
  }
  async outcomes(owner: string) {
    const rows = await this.db.all<{ event_id: string; cipher: string }>('SELECT event_id, cipher FROM outcomes WHERE owner = ?', [owner]);
    const opened = await Promise.all(rows.map((row) => this.open<{ input: AttemptInput; result: AttemptResult }>(owner, row.event_id, row.cipher, () => this.db.run('DELETE FROM outcomes WHERE owner = ? AND event_id = ?', [owner, row.event_id]))));
    return opened.filter((entry) => entry !== null);
  }
  async redemptionRequest(owner: string, rewardId: string, newId: () => string) {
    let requestId = '';
    await this.db.transaction(async (tx) => {
      const row = await tx.first<{ cipher: string }>('SELECT cipher FROM requests WHERE owner = ? AND reward_id = ?', [owner, rewardId]);
      const existing = row && await this.open<string>(owner, rewardId, row.cipher, () => tx.run('DELETE FROM requests WHERE owner = ? AND reward_id = ?', [owner, rewardId]));
      requestId = existing ?? newId();
      if (!existing) await tx.run('INSERT INTO requests VALUES (?, ?, ?) ON CONFLICT(owner, reward_id) DO UPDATE SET cipher = excluded.cipher', [owner, rewardId, await this.cipher.encrypt(owner, rewardId, requestId)]);
    });
    return requestId;
  }
  private discardOutbox(owner: string, id: string) { return this.db.run('DELETE FROM outbox WHERE owner = ? AND event_id = ?', [owner, id]); }
  async finishRedemption(owner: string, rewardId: string) { await this.db.run('DELETE FROM requests WHERE owner = ? AND reward_id = ?', [owner, rewardId]); }
}
