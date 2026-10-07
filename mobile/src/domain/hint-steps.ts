/** Short forms whose full stop does not end a sentence. */
const ABBREVIATION = /(?:^|\s)(?:e\.g|i\.e|etc|vs|approx|no|mr|mrs|ms|dr)\.$/i;

/**
 * A Hint as the steps a Learner can tick off.
 *
 * A Hint is fixed text written by the Pack Author, so these are its own lines
 * or sentences, never a verdict on what the Learner did: the tablet cannot tell
 * whether a worked step is right, and does not pretend to.
 */
export function hintSteps(hint: string): string[] {
  const lines = hint.split(/\r?\n/).map((l) => l.replace(/^\s*(?:\d+[.)]|[-*\u2022])\s*/, '').trim()).filter(Boolean);
  if (lines.length !== 1) return lines;
  // A sentence ends at . ! ? followed by a space, so "0.5" and "1/2" stay whole; abbreviations are glued back on.
  return lines[0].split(/(?<=[.!?])\s+/).reduce<string[]>((steps, part) => {
    const last = steps[steps.length - 1];
    if (last !== undefined && ABBREVIATION.test(last)) steps[steps.length - 1] = `${last} ${part}`;
    else steps.push(part);
    return steps;
  }, []);
}
