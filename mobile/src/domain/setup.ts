export type SetupStep = 'sign-in' | 'caretaker-pin' | 'profiles' | 'done';

/** Which part of Setup is next, given what this tablet has already saved. */
export function setupStep(saved: { hasCaretaker: boolean; pinSet: boolean; done: boolean }): SetupStep {
  if (!saved.hasCaretaker) return 'sign-in';
  if (!saved.pinSet) return 'caretaker-pin';
  return saved.done ? 'done' : 'profiles';
}

/**
 * Keeps the Clerk user ID, then always ends the Clerk session so none remains.
 * A failed save is rethrown after sign-out, so Setup can show it and retry.
 */
export async function keepCaretaker(userId: string, save: (id: string) => Promise<void>, signOut: () => Promise<void>) {
  try {
    await save(userId);
  } finally {
    await signOut();
  }
}

/**
 * For "Forgot Caretaker PIN": only the Caretaker Account saved at Setup may reset.
 * The Clerk session is ended whether or not the account matches.
 */
export async function confirmCaretaker(userId: string, savedId: string | null, signOut: () => Promise<void>) {
  await signOut();
  if (!savedId || userId !== savedId) throw new Error('That is not the Caretaker Account used at Setup. The PIN was not changed.');
}

/** Turns a failed sign-in request into plain advice when the tablet is offline. */
export function signInMessage(message: string) {
  return /network|fetch|offline|internet/i.test(message) ? 'A network is needed for this sign-in. Nothing was changed.' : message;
}
