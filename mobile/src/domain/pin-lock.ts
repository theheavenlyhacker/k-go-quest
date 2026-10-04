export const WAIT_MS = 5 * 60000;
export const IDLE_MS = 5 * 60000;
const MAX_FAILURES = 5;

export interface Lockout { failed: number; until: number; }

export const lockedOut = (state: Lockout, now: number) => state.until > now;
export const isIdle = (lastTouch: number, now: number) => now - lastTouch > IDLE_MS;
export const isValidPin = (pin: string) => /^\d{6}$/.test(pin);

/** A failure after an expired wait starts a fresh count. */
export function recordFailure(state: Lockout, now: number): Lockout {
  const failed = state.until && state.until <= now ? 1 : state.failed + 1;
  return { failed, until: failed >= MAX_FAILURES ? now + WAIT_MS : 0 };
}
