import { describe, expect, it } from 'vitest';
import { IDLE_MS, WAIT_MS, isIdle, isValidPin, lockedOut, recordFailure, remaining } from './pin-lock';

const fresh = { failed: 0, until: 0 };

describe('pin lockout', () => {
  it('waits 5 minutes after the 5th wrong PIN', () => {
    let state = fresh;
    for (let i = 0; i < 4; i++) state = recordFailure(state, 1000);
    expect(lockedOut(state, 1000)).toBe(false);
    state = recordFailure(state, 1000);
    expect(state.until).toBe(1000 + WAIT_MS);
    expect(lockedOut(state, 1000 + WAIT_MS - 1)).toBe(true);
    expect(lockedOut(state, 1000 + WAIT_MS)).toBe(false);
  });

  it('restarts the count after a wait has expired', () => {
    const expired = { failed: 5, until: 1000 };
    expect(recordFailure(expired, 2000)).toEqual({ failed: 1, until: 0 });
  });

  it('counts down the minutes left, rounding up', () => {
    const state = { failed: 5, until: 1000 + WAIT_MS };
    // A Learner who comes back partway through is told what is actually left,
    // not the whole wait again.
    expect(remaining(state, 1000)).toBe(5);
    expect(remaining(state, 1000 + WAIT_MS - 60000)).toBe(1);
    expect(remaining(state, 1000 + WAIT_MS - 1)).toBe(1);
  });

  it('reports nothing left once the wait is over, or was never set', () => {
    expect(remaining({ failed: 5, until: 1000 }, 1000)).toBe(0);
    expect(remaining({ failed: 5, until: 1000 }, 9999)).toBe(0);
    expect(remaining(fresh, 1000)).toBe(0);
  });
});

describe('idle lock', () => {
  it('locks only after 5 minutes without touches', () => {
    expect(isIdle(0, IDLE_MS)).toBe(false);
    expect(isIdle(0, IDLE_MS + 1)).toBe(true);
  });
});

describe('pin format', () => {
  it('requires exactly 6 digits', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
  });
});
