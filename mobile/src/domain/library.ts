import type { Attempt } from './engine';
import type { OnlineState } from './online';
import type { PackOffer } from './packs';
import type { Pack } from './types';

/** A Lesson is finished once every one of its Exercises has an Attempt. Practice never needs a network, so neither does this. */
export function libraryProgress(pack: Pack, attempts: Attempt[]) {
  const answered = new Set(attempts.map((a) => a.exerciseId));
  let done = 0, exercises = 0, answeredCount = 0;
  for (const lesson of pack.lessons) {
    const hit = lesson.exercises.filter((e) => answered.has(e.id)).length;
    exercises += lesson.exercises.length;
    answeredCount += hit;
    if (lesson.exercises.length > 0 && hit === lesson.exercises.length) done += 1;
  }
  return { done, total: pack.lessons.length, fraction: exercises ? answeredCount / exercises : 0 };
}

/** What the server has to offer, as a screen can show it. Offline there is no list, so no state either. */
export type Offers = { status: 'loading' } | { status: 'error' } | { status: 'ready'; offers: PackOffer[] };

/**
 * "Downloaded X of Y". The Starter Pack ships in the app and is not a
 * Downloaded Pack, so `downloaded` excludes it. Y is known only while the
 * server's list is, and `null` means "do not draw a total".
 */
export function downloadedCount(downloaded: number, offers: Offers | null) {
  if (offers?.status !== 'ready') return { downloaded, total: null };
  return { downloaded, total: downloaded + offers.offers.filter((o) => o.status === 'NEW').length };
}

/**
 * The calm banner for answers waiting to go up. Silent when nothing waits.
 * Sync is offered only when the server session is usable and this Profile is
 * linked, the only case in which an upload can succeed.
 */
export function syncBanner(pending: number, state: OnlineState, linked: boolean) {
  if (pending <= 0) return null;
  const noun = pending === 1 ? 'answer' : 'answers';
  if (state === 'READY' && linked) return { text: `${pending} ${noun} ready to send`, canSync: true };
  if (state === 'UNREACHABLE') return { text: `Offline — ${pending} ${noun} waiting for school Wi-Fi`, canSync: false };
  return { text: `${pending} ${noun} saved on this tablet, waiting for the school server`, canSync: false };
}
