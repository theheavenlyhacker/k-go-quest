import type { AttemptInput, SyncResponse } from '../domain/server';
import type { Outbox } from '../domain/sync';
import type { Repository } from './repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why an Attempt on this tablet can never be uploaded. Both are permanent, so the Attempt leaves the queue. */
const FABRICATED = 'The Demo Learner’s practice history is made up by the app, so it is never uploaded to a real classroom.';
const UNKNOWN_EXERCISE = 'The server has not been given this Content Pack, so it has no Exercise to file this answer against.';

/**
 * Presents the Attempt log to the SyncEngine as an outbox.
 *
 * There is no second queue: the Attempts a Learner has already made *are* the
 * queue, and an `uploads` row is what takes one out of it. A tablet that has
 * been offline for a year therefore has a full outbox the moment it is linked,
 * with nothing to migrate.
 *
 * Two translations happen here. The Classroom comes from the Link rather than
 * from the Attempt, because a Learner practises against a Content Pack and not
 * against a Classroom. And the Exercise slug the tablet records becomes the
 * UUID the server knows, through the generated catalogue — which is what lets
 * an Attempt made years ago still be filed correctly.
 */
export class AttemptOutbox implements Outbox {
  constructor(
    private repo: Repository,
    private classroomId: string,
    private serverExerciseId: (slug: string) => string | null,
  ) {}

  /**
   * Attempts that can actually go up.
   *
   * Anything that never can is settled here with its reason rather than left in
   * the queue: an Attempt that is retried forever is a sync that never finishes
   * and a Learner who is never told why.
   */
  async pending(owner: string, limit: number): Promise<AttemptInput[]> {
    const sendable: AttemptInput[] = [];
    // Settling unsendable Attempts can empty a whole page. Keep reading until
    // there is something to send or the log runs out, or a page of demo rows
    // would look like an empty outbox with real Attempts still behind it.
    for (let page = 0; page < 20 && sendable.length === 0; page += 1) {
      const attempts = await this.repo.notUploaded(owner, limit);
      if (!attempts.length) break;
      for (const attempt of attempts) {
        if (!UUID.test(attempt.id)) {
          await this.repo.markUpload(owner, attempt.id, { state: 'REVIEW', detail: FABRICATED });
          continue;
        }
        const exerciseId = this.serverExerciseId(attempt.exerciseId);
        if (!exerciseId) {
          await this.repo.markUpload(owner, attempt.id, { state: 'REVIEW', detail: UNKNOWN_EXERCISE });
          continue;
        }
        sendable.push({
          clientAttemptId: attempt.id,
          classroomId: this.classroomId,
          exerciseId,
          selectedOption: attempt.selectedOption,
          occurredAt: attempt.at,
        });
      }
    }
    return sendable;
  }

  /** A duplicate is still settled: the server already holds it, so it must leave the outbox. */
  async acknowledge(owner: string, response: SyncResponse): Promise<void> {
    // Each row carries the verdict and the balance it arrived with, so a crash part-way
    // through leaves every settled Attempt whole and the rest to be sent again.
    const ackedAt = Date.now();
    for (const result of response.results) {
      await this.repo.markUpload(owner, result.clientAttemptId, { state: 'DONE', correct: result.correct, balance: response.coinBalance, ackedAt });
    }
  }

  async review(owner: string, id: string, message: string): Promise<void> {
    await this.repo.markUpload(owner, id, { state: 'REVIEW', detail: message });
  }
}
