import { ApiError } from './client';
import type { AttemptInput, SyncResponse } from './server';

export interface Outbox {
  pending(owner: string, limit: number): Promise<AttemptInput[]>;
  acknowledge(owner: string, response: SyncResponse): Promise<void>;
  review(owner: string, id: string, message: string): Promise<void>;
}
export interface SyncSummary { accepted: number; duplicate: number; review: number; }
export function validateAcknowledgment(batch: AttemptInput[], response: SyncResponse) {
  const ids = new Set(batch.map((input) => input.clientAttemptId));
  if (!Array.isArray(response.results) || response.results.length !== ids.size || new Set(response.results.map((r) => r.clientAttemptId)).size !== ids.size ||
    response.results.some((r) => !ids.has(r.clientAttemptId) || typeof r.correct !== 'boolean' || typeof r.duplicate !== 'boolean' || !Number.isInteger(r.awardedCoins) || r.awardedCoins < 0) ||
    !Number.isInteger(response.coinBalance) || response.coinBalance < 0 || !Number.isInteger(response.awardedCoins) || response.awardedCoins < 0 ||
    response.results.filter((r) => !r.duplicate).reduce((sum, r) => sum + r.awardedCoins, 0) !== response.awardedCoins)
    throw new ApiError(502, 'The server did not acknowledge this batch correctly. Your answers were retained.');
}
export class SyncEngine {
  private job: Promise<SyncSummary> | null = null;
  private owner: string | null = null;
  constructor(private outbox: Outbox, private push: (batch: AttemptInput[]) => Promise<SyncResponse>, private stillActive: (owner: string) => boolean) {}
  run(owner: string): Promise<SyncSummary> {
    if (this.job) {
      if (this.owner !== owner) return Promise.reject(new ApiError(409, 'Wait for the current profile to finish syncing.'));
      return this.job;
    }
    this.owner = owner;
    this.job = this.flush(owner).finally(() => { this.job = null; this.owner = null; });
    return this.job;
  }
  private async flush(owner: string): Promise<SyncSummary> {
    const result = { accepted: 0, duplicate: 0, review: 0 };
    const send = async (batch: AttemptInput[]): Promise<void> => {
      if (!this.stillActive(owner)) throw new ApiError(401, 'Unlock the original profile to continue syncing.');
      try {
        const response = await this.push(batch);
        validateAcknowledgment(batch, response);
        // The response belongs to this owner even if the UI profile changed mid-request.
        await this.outbox.acknowledge(owner, response);
        result.accepted += response.results.filter((r) => !r.duplicate).length;
        result.duplicate += response.results.filter((r) => r.duplicate).length;
      } catch (error) {
        if (!(error instanceof ApiError) || error.retryable || error.status === 401) throw error;
        if (batch.length > 1) {
          const middle = Math.ceil(batch.length / 2);
          await send(batch.slice(0, middle)); await send(batch.slice(middle));
        } else {
          await this.outbox.review(owner, batch[0].clientAttemptId, error.message);
          result.review += 1;
        }
      }
    };
    // Bound one pass so the UI stays responsive on large queues.
    for (let page = 0; page < 20; page++) {
      const batch = await this.outbox.pending(owner, 100);
      if (!batch.length) return result;
      await send(batch);
    }
    return result;
  }
}
export function retryDelay(failures: number, random = Math.random()) { return Math.min(60000, 2000 * 2 ** Math.min(failures, 5)) * (0.75 + random * 0.25); }
