import { ApiError } from './client';

/** Shown when a Learner (`STUDENT`) account signs in as the Caretaker. */
export const LEARNER_ACCOUNT = 'This is a Learner account. Sign in with the Teacher or LGU account that manages this tablet.';

/** Thrown when the account that signed in is a Learner's. */
export class LearnerAccountError extends Error {
  constructor() { super(LEARNER_ACCOUNT); this.name = 'LearnerAccountError'; }
}

/** There is no reset flow: Server Accounts are provisioned by the LGU Admin. */
export const FORGOT_PASSWORD = 'Ask your LGU Admin to reset your password. Server Accounts are managed by the LGU Admin, so there is nothing to reset on this tablet.';

export type SignInProblem = { kind: 'connection' | 'credentials' | 'learner' | 'other'; message: string };

export function signInProblem(error: unknown): SignInProblem {
  if (error instanceof LearnerAccountError) return { kind: 'learner', message: error.message };
  if (error instanceof ApiError) {
    // status 0 is a refused connection or a timeout: the client never got an answer.
    if (error.status === 0) return { kind: 'connection', message: 'No connection to the school server. Check this tablet\'s Wi-Fi and try again.' };
    // 400 and 401 are the server rejecting the email or password. 403 is not: the account may be suspended, so keep the server's words.
    if (error.status === 400 || error.status === 401) return { kind: 'credentials', message: 'That email or password is not right. Check both and try again.' };
    if (error.status === 429) return { kind: 'other', message: 'Too many tries. Wait a moment, then try again.' };
    if (error.status >= 500) return { kind: 'other', message: 'The school server had a problem. Try again in a moment.' };
  }
  return { kind: 'other', message: error instanceof Error ? error.message : 'Sign in did not work. Please try again.' };
}

export const canSubmit = (email: string, password: string, busy: boolean) =>
  !busy && email.trim().length >= 3 && password.length >= 8;
