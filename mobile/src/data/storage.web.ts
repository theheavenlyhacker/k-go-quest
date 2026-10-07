import type { Attempt } from '../domain/engine';
import type { DownloadedPack } from '../domain/packs';
import type { Purchase } from '../domain/shop';
import type { Repository, Upload } from './repository';

// Web is a UI preview: attempts live in memory and are lost on reload. Native uses encrypted SQLite.
const logs = new Map<string, Attempt[]>();
const bought = new Map<string, Purchase[]>();
const sent = new Map<string, Map<string, Upload>>();
const downloaded = new Map<string, DownloadedPack>();
const cached = new Map<string, unknown>();
const repository: Repository = {
  downloadedPacks: async () => [...downloaded.values()],
  saveDownloadedPack: async (record, replaces) => {
    if (replaces) downloaded.delete(replaces);
    downloaded.set(record.pack.id, record);
  },
  attempts: async (owner) => [...(logs.get(owner) ?? [])],
  record: async (owner, attempt) => { logs.set(owner, [...(logs.get(owner) ?? []), attempt]); },
  notUploaded: async (owner, limit) => (logs.get(owner) ?? []).filter((a) => !sent.get(owner)?.has(a.id)).slice(0, limit),
  markUpload: async (owner, attemptId, upload) => { sent.set(owner, new Map(sent.get(owner) ?? []).set(attemptId, upload)); },
  uploads: async (owner) => new Map(sent.get(owner) ?? []),
  purchases: async (owner) => [...(bought.get(owner) ?? [])],
  recordPurchase: async (owner, purchase) => { bought.set(owner, [...(bought.get(owner) ?? []), purchase]); },
  cacheGet: async <T,>(owner: string, key: string) => (cached.get(`${owner}/${key}`) as T | undefined) ?? null,
  cachePut: async (owner, key, value) => { cached.set(`${owner}/${key}`, value); },
  deleteOwner: async (owner) => { logs.delete(owner); bought.delete(owner); sent.delete(owner); },
};
export const getRepository = async () => repository;
