import { describe, expect, it } from 'vitest';
import { appRoute } from './route';

const base = { ready: true, introSeen: true, step: 'done', hasProfile: false, locked: true, caretaker: false } as const;

describe('appRoute', () => {
  it('waits for the saved flags before choosing, so the intro never flashes', () => {
    expect(appRoute({ ...base, ready: false, introSeen: false })).toBe('loading');
  });
  it('shows the intro first, even on a tablet that is already set up', () => {
    expect(appRoute({ ...base, introSeen: false, step: 'sign-in' })).toBe('intro');
    expect(appRoute({ ...base, introSeen: false })).toBe('intro');
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
