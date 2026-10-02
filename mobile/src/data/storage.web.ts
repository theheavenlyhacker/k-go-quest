import type { Repository } from './repository';
import type { AttemptInput, AttemptResult, QueuedAttempt, Snapshot } from '../domain/types';
import { emptySnapshot } from '../domain/types';

// Web is a UI/API preview: no persistent tokens, private records, or student outbox.
// Reloading a preview tab clears its work; native uses encrypted SQLite payloads.
const snapshots = new Map<string, Snapshot>();
const queues = new Map<string, QueuedAttempt[]>();
const results = new Map<string, { input: AttemptInput; result: AttemptResult }[]>();
const requests = new Map<string, string>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const repository: Repository = {
  snapshot: async (owner) => clone(snapshots.get(owner) ?? emptySnapshot()),
  save: async (owner, snapshot) => { snapshots.set(owner, clone(snapshot)); },
  queue: async (owner, input) => {
    const queue = queues.get(owner) ?? [];
    const existing = queue.find((item) => item.input.clientAttemptId === input.clientAttemptId);
    if (existing && JSON.stringify(existing.input) !== JSON.stringify(input)) throw new Error('Attempt ID conflict');
    if (!existing) queues.set(owner, [...queue, { input: clone(input), state: 'PENDING' }]);
  },
  queued: async (owner) => clone(queues.get(owner) ?? []),
  pending: async (owner, limit) => clone((queues.get(owner) ?? []).filter((q) => q.state === 'PENDING').slice(0, limit).map((q) => q.input)),
  review: async (owner, id, error) => { const item = queues.get(owner)?.find((q) => q.input.clientAttemptId === id); if (item) { item.state = 'REVIEW'; item.error = error; } },
  acknowledge: async (owner, response) => {
    const queue = queues.get(owner) ?? [];
    const outcomes = results.get(owner) ?? [];
    for (const result of response.results) { const row = queue.find((q) => q.input.clientAttemptId === result.clientAttemptId); if (row) outcomes.push({ input: row.input, result }); }
    results.set(owner, outcomes);
    queues.set(owner, queue.filter((q) => !response.results.some((r) => r.clientAttemptId === q.input.clientAttemptId)));
    const snapshot = snapshots.get(owner); if (snapshot?.progress) snapshot.progress.coinBalance = response.coinBalance;
  },
  outcomes: async (owner) => clone(results.get(owner) ?? []),
  redemptionRequest: async (owner, reward, makeId) => { const key = `${owner}/${reward}`; if (!requests.has(key)) requests.set(key, makeId()); return requests.get(key)!; },
  finishRedemption: async (owner, reward) => { requests.delete(`${owner}/${reward}`); },
};
export const getRepository = async () => repository;
