/**
 * A Hint as the steps a Learner can tick off.
 *
 * A Hint is fixed text written by the Pack Author, so these are its own lines
 * or sentences, never a verdict on what the Learner did: the tablet cannot tell
 * whether a worked step is right, and does not pretend to.
 */
export function hintSteps(hint: string): string[] {
  const lines = hint.split(/\r?\n/).map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
  // A sentence ends at . ! ? followed by a space, so "0.5" and "1/2" stay whole.
  return lines.length > 1 ? lines : (lines[0]?.split(/(?<=[.!?])\s+/) ?? []);
}
