/**
 * The shapes the K-Go server speaks.
 *
 * Kept apart from `types.ts`, which is the offline content model, so the
 * boundary between "what this tablet knows on its own" and "what a server told
 * us" stays visible in the imports. Nothing here is needed for a Learner to
 * practise; see `docs/online-mode.md`.
 */
export type Role = 'STUDENT' | 'TEACHER' | 'LGU_ADMIN';

export interface ServerUser {
  id: string;
  loginId: string;
  alias: string;
  role: Role;
  jurisdictionId: string;
  schoolId: string | null;
  coins: number;
  active?: boolean;
}

/** An online session. `offlineUntil` is how long its refresh token stays usable without the server. */
export interface Session {
  user: ServerUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceId: string;
  offlineUntil: number;
  revoked?: boolean;
}

/** One Attempt as the server takes it. `occurredAt` is the tablet's clock and the server does not trust it for anything but ordering. */
export interface AttemptInput {
  clientAttemptId: string;
  classroomId: string;
  exerciseId: string;
  selectedOption: number;
  occurredAt: string;
}

export interface AttemptResult {
  clientAttemptId: string;
  correct: boolean;
  awardedCoins: number;
  duplicate: boolean;
}

export interface Page<T> { items: T[]; total: number; page: number; limit: number }

export interface ServerClassroom { id: string; name: string; grade: number; teacherId: string; schoolId: string }

export interface SyncResponse {
  results: AttemptResult[];
  awardedCoins: number;
  coinBalance: number;
  serverTime: string;
  modelVersion: string;
}

/**
 * A Profile tied to a Learner account on the server.
 *
 * The session is that Learner's own, not the Caretaker's: the server authorises
 * an upload as the Learner whose Attempts they are, which is the rule that stops
 * one account filing answers for another. The Caretaker enters the Learner's
 * credentials once, at linking, and never again.
 */
export interface Link {
  profileId: string;
  learnerId: string;
  classroomId: string;
  serverAlias: string;
}
