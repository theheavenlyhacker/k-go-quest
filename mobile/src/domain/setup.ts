export type SetupStep = 'sign-in' | 'caretaker-pin' | 'profiles' | 'done';

/** Which part of Setup is next, given what this tablet has already saved. */
export function setupStep(saved: { hasCaretaker: boolean; pinSet: boolean; done: boolean }): SetupStep {
  if (!saved.hasCaretaker) return 'sign-in';
  if (!saved.pinSet) return 'caretaker-pin';
  return saved.done ? 'done' : 'profiles';
}

/**
 * Whether Setup's first step is satisfied, and whether a forgotten Caretaker
 * PIN could still be recovered.
 *
 * Setup can finish with no network at all: a Caretaker who cannot sign in marks
 * this tablet as having a local Caretaker instead. That costs exactly one
 * thing — recovery, which works by proving who you are — so the two facts are
 * separate. `linked` turns true when an account is attached, at Setup or later.
 */
export const caretakerState = (accountId: string | null, local: boolean) => ({
  present: Boolean(accountId) || local,
  linked: Boolean(accountId),
});

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
  // Two different situations, and telling a Caretaker the wrong one wastes a trip.
  if (!savedId) throw new Error('No Caretaker Account is linked to this tablet, so the PIN cannot be recovered this way.');
  if (userId !== savedId) throw new Error('That is not the Caretaker Account used at Setup. The PIN was not changed.');
}

/** Turns a failed sign-in request into plain advice when the tablet is offline. */
export function signInMessage(message: string) {
  return /network|fetch|offline|internet/i.test(message) ? 'A network is needed for this sign-in. Nothing was changed.' : message;
}
