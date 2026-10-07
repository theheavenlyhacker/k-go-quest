import type { SetupStep } from './setup';

export type AppRoute = 'loading' | 'intro' | 'setup' | 'picker' | 'caretaker' | 'lock' | 'student';

/**
 * Which part of the app owns the screen. One place decides, so the router
 * guards never repeat each other's conditions. The intro comes before
 * everything else, once per Shared Tablet; after it a tablet goes to Setup, or
 * straight to the Profile picker if Setup already finished.
 */
export function appRoute(s: { ready: boolean; introSeen: boolean; step: SetupStep; hasProfile: boolean; locked: boolean; caretaker: boolean }): AppRoute {
  if (!s.ready) return 'loading';
  if (!s.introSeen) return 'intro';
  if (s.step !== 'done') return 'setup';
  if (!s.hasProfile) return s.caretaker ? 'caretaker' : 'picker';
  return s.locked ? 'lock' : 'student';
}
