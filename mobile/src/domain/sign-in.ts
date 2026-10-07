import { ApiError } from './client';

/** Shown when a Learner (`STUDENT`) account signs in as the Caretaker. */
export const LEARNER_ACCOUNT = 'This is a Learner account. Sign in with the Teacher or LGU account that manages this tablet.';

/** There is no reset flow: Server Accounts are provisioned by the LGU Admin. */
export const FORGOT_PASSWORD = 'Ask your LGU Admin to reset your password. Server Accounts are managed by the LGU Admin, so there is nothing to reset on this tablet.';

export type SignInProblem = { kind: 'connection' | 'credentials' | 'learner' | 'other'; message: string };

export function signInProblem(error: unknown): SignInProblem {
  if (error instanceof ApiError && error.status === 0)
    return { kind: 'connection', message: 'No connection to the school server. Check this tablet\'s Wi-Fi and try again.' };
  if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403))
    return { kind: 'credentials', message: 'That login or password is not right. Check both and try again.' };
  const message = error instanceof Error ? error.message : 'Sign in did not work. Please try again.';
  return { kind: message === LEARNER_ACCOUNT ? 'learner' : 'other', message };
}

export const canSubmit = (loginId: string, password: string, busy: boolean) =>
  !busy && loginId.trim().length >= 3 && password.length >= 8;
