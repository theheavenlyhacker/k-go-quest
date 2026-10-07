import { ApiError } from './client';
import type { ServerClassroom } from './server';

export interface Cached<T> { value: T; fetchedAt: string }
export interface Cache<T> { get(): Promise<Cached<T> | null>; put(entry: Cached<T>): Promise<void> }
export interface Loaded<T> extends Cached<T> { /** True when the server could not be reached and this is the last copy the tablet saved. */ stale: boolean }

/**
 * Fetches something from the server and keeps the last good copy.
 *
 * Only an unreachable server falls back to the saved copy: an expired session
 * (401) or a refused request still throws, so the app can send the Teacher back
 * to the Caretaker area instead of showing old numbers as if nothing happened.
 * `parse` runs on the fresh body only, so a drifted shape is never cached.
 */
export async function loadCached<T>(fetchRaw: () => Promise<unknown>, parse: (raw: unknown) => T, cache: Cache<T>, now: Date = new Date()): Promise<Loaded<T>> {
  let raw: unknown;
  try {
    raw = await fetchRaw();
  } catch (error) {
    const saved = error instanceof ApiError && error.status === 0 ? await cache.get().catch(() => null) : null;
    if (saved) return { ...saved, stale: true };
    throw error;
  }
  const fresh = { value: parse(raw), fetchedAt: now.toISOString() };
  await cache.put(fresh).catch(() => undefined);
  return { ...fresh, stale: false };
}

/** The Classrooms of `GET classrooms`, which is a page; only the fields the shell uses are kept. */
export function parseClassrooms(raw: unknown): ServerClassroom[] {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error('Classrooms: the list is missing.');
  return items.map((item: Record<string, unknown>, i) => {
    const { id, name, grade, teacherId, schoolId } = item;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof grade !== 'number' || typeof teacherId !== 'string' || typeof schoolId !== 'string')
      throw new Error(`Classrooms: item ${i} has the wrong shape.`);
    return { id, name, grade, teacherId, schoolId };
  });
}
