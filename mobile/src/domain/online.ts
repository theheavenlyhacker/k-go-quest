import type { Attempt } from './engine';
import type { Link, Role, Session } from './server';
import type { Upload } from '../data/repository';

/**
 * The rules of Online Mode, with no I/O in them.
 *
 * Online Mode is always extra: every function here answers "what, if anything,
 * can this tablet do right now", and the answer "nothing" is a normal state
 * that changes nothing about practice. See `docs/online-mode.md`.
 */

/** The Caretaker's own server session is filed under this owner, beside the Profiles'. */
export const CARETAKER_OWNER = 'caretaker';

/** Vault key for a server session. One per linked Profile, plus the Caretaker's. */
export const sessionKey = (owner: string) => `kgo-session-${owner}`;

/** Vault key for the Profile-to-Learner links. */
export const LINKS_KEY = 'kgo-links';

/** How many Attempts go up in one request. The server refuses more. */
export const BATCH_LIMIT = 100;

/**
 * A session stays usable while its refresh token could still be redeemed.
 *
 * Checked against the tablet's clock, which may be wrong — so this is a way to
 * avoid a pointless request, never a security boundary. The server decides.
 */
export function usable(session: Session | null, now: number): boolean {
  if (!session || session.revoked) return false;
  return session.offlineUntil > now;
}

export type OnlineState =
  | 'UNREACHABLE'   // no connection, or the server did not answer
  | 'SIGNED_OUT'    // reachable, but nobody has signed in on this tablet
  | 'EXPIRED'       // signed in once, but the session is too old to use
  | 'READY';        // uploads and downloads can run

export function onlineState(reachable: boolean, session: Session | null, now: number): OnlineState {
  if (!reachable) return 'UNREACHABLE';
  if (!session) return 'SIGNED_OUT';
  return usable(session, now) ? 'READY' : 'EXPIRED';
}

/** Roles the server grants, ranked by what they may open. A Caretaker may hold any of them, or none. */
const RANK: Record<Role, number> = { STUDENT: 0, TEACHER: 1, LGU_ADMIN: 2 };

export function allows(session: Session | null, needed: Role): boolean {
  if (!session || session.revoked) return false;
  return RANK[session.user.role] >= RANK[needed];
}

export function parseLinks(raw: string | null): Record<string, Link> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const links: Record<string, Link> = {};
    for (const [profileId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const link = value as Partial<Link>;
      // A half-written link is worse than none: it would upload Attempts to the wrong Classroom.
      if (typeof link?.learnerId === 'string' && typeof link?.classroomId === 'string' && link.learnerId && link.classroomId) {
        links[profileId] = { profileId, learnerId: link.learnerId, classroomId: link.classroomId, serverAlias: typeof link.serverAlias === 'string' ? link.serverAlias : '' };
      }
    }
    return links;
  } catch {
    return {};
  }
}

export interface UploadSummary { pending: number; uploaded: number; review: number }

/**
 * What is waiting to go up for one Profile.
 *
 * An Attempt with no `uploads` row is pending, which makes an unlinked Profile
 * read as "all pending" rather than as an error — correct, since linking it
 * later uploads exactly that backlog.
 */
export function uploadSummary(attempts: Attempt[], uploads: Map<string, Upload>): UploadSummary {
  let uploaded = 0;
  let review = 0;
  for (const attempt of attempts) {
    const state = uploads.get(attempt.id)?.state;
    if (state === 'DONE') uploaded += 1;
    else if (state === 'REVIEW') review += 1;
  }
  return { pending: attempts.length - uploaded - review, uploaded, review };
}
