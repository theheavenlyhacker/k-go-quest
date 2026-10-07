import { describe, expect, it } from 'vitest';
import { appRoute } from './route';

const base = { ready: true, introSeen: true, signInSeen: true, step: 'done', hasProfile: false, locked: true, caretaker: false } as const;

describe('appRoute', () => {
  it('waits for the saved flags before choosing, so the intro never flashes', () => {
    expect(appRoute({ ...base, ready: false, introSeen: false })).toBe('loading');
  });
  it('shows the intro first, even on a tablet that is already set up', () => {
    expect(appRoute({ ...base, introSeen: false, step: 'sign-in' })).toBe('intro');
    expect(appRoute({ ...base, introSeen: false })).toBe('intro');
  });
  it('puts the front door after the intro and before Setup', () => {
    expect(appRoute({ ...base, signInSeen: false, step: 'sign-in' })).toBe('signIn');
    expect(appRoute({ ...base, signInSeen: false })).toBe('signIn');
  });
  it('keeps the intro ahead of the front door', () => {
    expect(appRoute({ ...base, introSeen: false, signInSeen: false })).toBe('intro');
  });
  /**
   * The whole point of the door: walking past it without signing in must land
   * on a tablet that still sets up and still works.
   */
  it('goes on to Setup once the door is passed, signed in or not', () => {
    expect(appRoute({ ...base, signInSeen: true, step: 'caretaker-pin' })).toBe('setup');
  });
  it('leads from the intro to Setup, or to the Profile picker once set up', () => {
    expect(appRoute({ ...base, step: 'sign-in' })).toBe('setup');
    expect(appRoute({ ...base, step: 'profiles' })).toBe('setup');
    expect(appRoute(base)).toBe('picker');
  });
  it('keeps the other screens as they were', () => {
    expect(appRoute({ ...base, caretaker: true })).toBe('caretaker');
    expect(appRoute({ ...base, hasProfile: true })).toBe('lock');
    expect(appRoute({ ...base, hasProfile: true, locked: false })).toBe('student');
  });
});
