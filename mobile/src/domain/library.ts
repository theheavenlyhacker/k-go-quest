import type { Attempt } from './engine';
import type { OnlineState } from './online';
import type { Pack } from './types';

/** A Lesson is finished once every one of its Exercises has an Attempt. Practice never needs a network, so neither does this. */
export function libraryProgress(pack: Pack, attempts: Attempt[]) {
  const answered = new Set(attempts.map((a) => a.exerciseId));
  const done = pack.lessons.filter((l) => l.exercises.length > 0 && l.exercises.every((e) => answered.has(e.id))).length;
  const exercises = pack.lessons.flatMap((l) => l.exercises);
  const fraction = exercises.length ? exercises.filter((e) => answered.has(e.id)).length / exercises.length : 0;
  return { done, total: pack.lessons.length, fraction };
}

/**
 * "Downloaded X of Y": Content Packs on this tablet out of those it holds plus
 * those the server offers that it does not. Offline the server is unknown, so Y
 * is then just X rather than a guess.
 */
export const storage = (held: number, needDownload: number) => ({ held, total: held + needDownload });

/**
 * The calm banner for answers waiting to go up. Silent when nothing waits.
 * Sync is offered only when the server session is usable, as it is the only
 * state in which an upload can succeed.
 */
export function syncBanner(pending: number, state: OnlineState) {
  if (pending <= 0) return null;
  const noun = pending === 1 ? 'answer' : 'answers';
  return state === 'READY'
    ? { text: `${pending} ${noun} ready to send`, canSync: true }
    : { text: `Offline — ${pending} ${noun} waiting for school Wi-Fi`, canSync: false };
}
