import type { Attempt } from '../domain/engine';
import type { Purchase } from '../domain/shop';
import type { Repository } from './repository';

// Web is a UI preview: attempts live in memory and are lost on reload. Native uses encrypted SQLite.
const logs = new Map<string, Attempt[]>();
const bought = new Map<string, Purchase[]>();
const repository: Repository = {
  attempts: async (owner) => [...(logs.get(owner) ?? [])],
  record: async (owner, attempt) => { logs.set(owner, [...(logs.get(owner) ?? []), attempt]); },
  purchases: async (owner) => [...(bought.get(owner) ?? [])],
  recordPurchase: async (owner, purchase) => { bought.set(owner, [...(bought.get(owner) ?? []), purchase]); },
  deleteOwner: async (owner) => { logs.delete(owner); bought.delete(owner); },
};
export const getRepository = async () => repository;
