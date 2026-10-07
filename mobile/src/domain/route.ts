import type { SetupStep } from './setup';

export type AppRoute = 'loading' | 'intro' | 'signIn' | 'setup' | 'picker' | 'caretaker' | 'lock' | 'student';

/**
 * Which part of the app owns the screen. One place decides, so the router
 * guards never repeat each other's conditions. The intro comes before
 * everything else, once per Shared Tablet; after it a tablet goes to Setup, or
 * straight to the Profile picker if Setup already finished.
 */
export function appRoute(s: { ready: boolean; introSeen: boolean; signInSeen: boolean; step: SetupStep; hasProfile: boolean; locked: boolean; caretaker: boolean }): AppRoute {
  if (!s.ready) return 'loading';
  if (!s.introSeen) return 'intro';
  // The front door: shown once, and never a wall — a tablet with no signal
  // walks past it and is set up in full. See docs/adr/0002.
  if (!s.signInSeen) return 'signIn';
  if (s.step !== 'done') return 'setup';
  if (!s.hasProfile) return s.caretaker ? 'caretaker' : 'picker';
  return s.locked ? 'lock' : 'student';
}
