import type { Attempt, UploadRecord } from '../domain/engine';
import type { DownloadedPack } from '../domain/packs';
import type { Purchase } from '../domain/shop';
import type { Pack } from '../domain/types';

export type SqlValue = string | number | null;
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}
export interface Cipher { encrypt(owner: string, key: string, value: unknown): Promise<string>; decrypt<T>(owner: string, key: string, value: string): Promise<T>; }

/** A Profile's Attempt log and Shop Purchases, each row sealed under that Profile's key. Tables are only ever added, so older databases just gain the new one. */
export const LOCAL_SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS attempts (owner TEXT NOT NULL, attempt_id TEXT NOT NULL, ordinal INTEGER NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, attempt_id));
CREATE INDEX IF NOT EXISTS attempts_by_owner ON attempts(owner, ordinal);
CREATE TABLE IF NOT EXISTS purchases (owner TEXT NOT NULL, cosmetic_id TEXT NOT NULL, ordinal INTEGER NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, cosmetic_id));
CREATE TABLE IF NOT EXISTS uploads (owner TEXT NOT NULL, attempt_id TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, attempt_id));
CREATE TABLE IF NOT EXISTS packs (pack_id TEXT PRIMARY KEY, checksum TEXT NOT NULL, downloaded_at TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cache (owner TEXT NOT NULL, key TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(owner, key));
PRAGMA user_version = 6;`;

/** What the server said about one uploaded Attempt. An Attempt with no row here has not been uploaded. */
export interface Upload extends UploadRecord { detail?: string }

export interface Repository {
  /**
   * Downloaded Packs, which the app practises from beside the Starter Pack.
   *
   * These rows are the one part of this database kept in the clear. A
   * downloaded Pack holds no Learner data and no answer key — that is what
   * `ON_SYNC` means — and the Subjects a tablet offers have to be readable
   * before any Profile has unlocked, so there is no key to read them under.
   */
  downloadedPacks(): Promise<DownloadedPack[]>;
  /** Saves one Pack, removing the id it supersedes in the same transaction. */
  saveDownloadedPack(record: DownloadedPack, replaces: string | null): Promise<void>;
  attempts(owner: string): Promise<Attempt[]>;
  record(owner: string, attempt: Attempt): Promise<void>;
  /** Attempts this tablet has not yet uploaded, oldest first. Online Mode only; nothing calls it offline. */
  notUploaded(owner: string, limit: number): Promise<Attempt[]>;
  markUpload(owner: string, attemptId: string, upload: Upload): Promise<void>;
  uploads(owner: string): Promise<Map<string, Upload>>;
  purchases(owner: string): Promise<Purchase[]>;
  recordPurchase(owner: string, purchase: Purchase): Promise<void>;
  deleteOwner(owner: string): Promise<void>;
  /** A small sealed value an owner keeps for itself, such as a Teacher's last Classroom report or resolved Alerts. */
  cacheGet<T>(owner: string, key: string): Promise<T | null>;
  cachePut(owner: string, key: string, value: unknown): Promise<void>;
}
export class LocalRepository implements Repository {
  constructor(private db: Database, private cipher: Cipher) {}
  async initialize() {
    const version = await this.db.first<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 6) throw new Error('This data requires a newer version of K-Go Quests.');
    await this.db.exec(LOCAL_SCHEMA);
  }
  async downloadedPacks() {
    const rows = await this.db.all<{ checksum: string; downloaded_at: string; payload: string }>(
      'SELECT checksum, downloaded_at, payload FROM packs ORDER BY downloaded_at, pack_id',
    );
    const opened = rows.map((row) => {
      try {
        return { checksum: row.checksum, downloadedAt: row.downloaded_at, pack: JSON.parse(row.payload) as Pack };
      } catch {
        // One unreadable row must not take the Subjects screen down with it.
        return null;
      }
    });
    return opened.filter((entry): entry is DownloadedPack => entry !== null);
  }
  async saveDownloadedPack(record: DownloadedPack, replaces: string | null) {
    // A Pack is only usable whole, so the new version and the removal of the
    // one it supersedes either both happen or neither does. The removal goes
    // first, so a Pack that supersedes its own id is not deleted after being
    // written.
    await this.db.exec('BEGIN IMMEDIATE');
    try {
      if (replaces) await this.db.run('DELETE FROM packs WHERE pack_id = ?', [replaces]);
      await this.db.run(
        'INSERT INTO packs VALUES (?, ?, ?, ?) ON CONFLICT(pack_id) DO UPDATE SET checksum = excluded.checksum, downloaded_at = excluded.downloaded_at, payload = excluded.payload',
        [record.pack.id, record.checksum, record.downloadedAt, JSON.stringify(record.pack)],
      );
      await this.db.exec('COMMIT');
    } catch (error) {
      await this.db.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
  async attempts(owner: string) {
    const rows = await this.db.all<{ attempt_id: string; cipher: string }>('SELECT attempt_id, cipher FROM attempts WHERE owner = ? ORDER BY ordinal', [owner]);
    // A row sealed under a key this tablet no longer holds cannot be opened; it is skipped rather than locking the Learner out.
    const opened = await Promise.all(rows.map((r) => this.cipher.decrypt<Attempt>(owner, r.attempt_id, r.cipher).catch(() => null)));
    return opened.filter((a): a is Attempt => a !== null);
  }
  async record(owner: string, attempt: Attempt) {
    const cipher = await this.cipher.encrypt(owner, attempt.id, attempt);
    await this.db.run('INSERT INTO attempts VALUES (?, ?, ?, ?)', [owner, attempt.id, Date.now(), cipher]);
  }
  /**
   * An Attempt is pending while it has no `uploads` row, so a tablet that has
   * never been online has every Attempt pending and loses nothing. A REVIEW row
   * counts as settled: the server refused it, and retrying it unchanged would
   * only be refused again.
   */
  async notUploaded(owner: string, limit: number) {
    const rows = await this.db.all<{ attempt_id: string; cipher: string }>(
      'SELECT a.attempt_id, a.cipher FROM attempts a LEFT JOIN uploads u ON u.owner = a.owner AND u.attempt_id = a.attempt_id WHERE a.owner = ? AND u.attempt_id IS NULL ORDER BY a.ordinal LIMIT ?',
      [owner, limit],
    );
    const opened = await Promise.all(rows.map((r) => this.cipher.decrypt<Attempt>(owner, r.attempt_id, r.cipher).catch(() => null)));
    return opened.filter((a): a is Attempt => a !== null);
  }
  async markUpload(owner: string, attemptId: string, upload: Upload) {
    const cipher = await this.cipher.encrypt(owner, attemptId, upload);
    await this.db.run('INSERT INTO uploads VALUES (?, ?, ?) ON CONFLICT(owner, attempt_id) DO UPDATE SET cipher = excluded.cipher', [owner, attemptId, cipher]);
  }
  async uploads(owner: string) {
    const rows = await this.db.all<{ attempt_id: string; cipher: string }>('SELECT attempt_id, cipher FROM uploads WHERE owner = ?', [owner]);
    const opened = await Promise.all(rows.map(async (r) => [r.attempt_id, await this.cipher.decrypt<Upload>(owner, r.attempt_id, r.cipher).catch(() => null)] as const));
    return new Map(opened.filter((pair): pair is readonly [string, Upload] => pair[1] !== null));
  }
  async purchases(owner: string) {
    const rows = await this.db.all<{ cosmetic_id: string; cipher: string }>('SELECT cosmetic_id, cipher FROM purchases WHERE owner = ? ORDER BY ordinal', [owner]);
    const opened = await Promise.all(rows.map((r) => this.cipher.decrypt<Purchase>(owner, r.cosmetic_id, r.cipher).catch(() => null)));
    return opened.filter((p): p is Purchase => p !== null);
  }
  /** The primary key makes a second purchase of the same Cosmetic fail; only deleteOwner removes rows. */
  async recordPurchase(owner: string, purchase: Purchase) {
    const cipher = await this.cipher.encrypt(owner, purchase.cosmeticId, purchase);
    await this.db.run('INSERT INTO purchases VALUES (?, ?, ?, ?)', [owner, purchase.cosmeticId, Date.now(), cipher]);
  }
  async cacheGet<T>(owner: string, key: string) {
    const row = await this.db.first<{ cipher: string }>('SELECT cipher FROM cache WHERE owner = ? AND key = ?', [owner, key]);
    return row ? this.cipher.decrypt<T>(owner, key, row.cipher).catch(() => null) : null;
  }
  async cachePut(owner: string, key: string, value: unknown) {
    const cipher = await this.cipher.encrypt(owner, key, value);
    await this.db.run('INSERT INTO cache VALUES (?, ?, ?) ON CONFLICT(owner, key) DO UPDATE SET cipher = excluded.cipher', [owner, key, cipher]);
  }
  /** Removes a Profile's rows: the Caretaker deleting a Profile, or resetting the Demo Learner. */
  async deleteOwner(owner: string) {
    await this.db.run('DELETE FROM attempts WHERE owner = ?', [owner]);
    await this.db.run('DELETE FROM purchases WHERE owner = ?', [owner]);
    await this.db.run('DELETE FROM uploads WHERE owner = ?', [owner]);
  }
}
