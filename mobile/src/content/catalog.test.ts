import { describe, expect, it } from 'vitest';
import { exportCatalog } from '../../scripts/starter-pack-export';
import catalogue from './starter-pack.json';
import { serverExerciseId } from './catalog';
import { starterPacks } from './starter-pack';

/**
 * The committed catalogue has to stay equal to the authored Starter Pack.
 *
 * If it drifts, the tablet uploads Attempts against Exercise ids the server has
 * never been given, and every upload is refused for a reason nobody can see.
 * Catching it here costs one test; catching it in the field costs a deployment.
 */
describe('starter-pack.json', () => {
  it('matches the authored Starter Pack', () => {
    expect(catalogue).toEqual(exportCatalog());
  });

  it('gives every Exercise on this tablet a server id', () => {
    const slugs = starterPacks.flatMap((p) => p.lessons.flatMap((l) => l.exercises.map((e) => e.id)));
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.filter((slug) => serverExerciseId(slug) === null)).toEqual([]);
  });

  it('keeps ids distinct and stable across runs', () => {
    const ids = catalogue.packs.flatMap((p) => [p.id, ...p.lessons.flatMap((l) => [l.id, ...l.exercises.map((e) => e.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(exportCatalog()).toEqual(exportCatalog());
  });
});
