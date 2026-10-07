import { describe, expect, it } from 'vitest';
import { downloadedCount, libraryProgress, syncBanner } from './library';
import type { Pack } from './types';

const pack = { lessons: [
  { exercises: [{ id: 'a' }, { id: 'b' }] },
  { exercises: [{ id: 'c' }] },
] } as unknown as Pack;
const at = (id: string, iso: string) => ({ id, exerciseId: id, selectedOption: 0, at: iso });

describe('libraryProgress', () => {
  it('counts a Lesson only when all its Exercises were answered', () => {
    expect(libraryProgress(pack, [at('a', '2026-01-01'), at('c', '2026-01-01')])).toEqual({ done: 1, total: 2, fraction: 2 / 3 });
  });
  it('is empty for a Pack with no Exercises', () => {
    expect(libraryProgress({ lessons: [] } as unknown as Pack, [])).toEqual({ done: 0, total: 0, fraction: 0 });
  });
});

describe('syncBanner', () => {
  it('is silent with nothing queued', () => expect(syncBanner(0, 'READY', true)).toBeNull());
  it('enables Sync only when ready and linked', () => {
    expect(syncBanner(3, 'READY', true)?.canSync).toBe(true);
    expect(syncBanner(3, 'READY', false)?.canSync).toBe(false);
    expect(syncBanner(3, 'UNREACHABLE', true)).toEqual({ text: 'Offline — 3 answers waiting for school Wi-Fi', canSync: false });
  });
  it('does not call a reachable but signed-out tablet offline', () => {
    const banner = syncBanner(1, 'SIGNED_OUT', true);
    expect(banner?.text).not.toContain('Offline');
    expect(banner?.text).toContain('1 answer ');
    expect(banner?.canSync).toBe(false);
  });
});

describe('downloadedCount', () => {
  const offer = (status: string) => ({ summary: {}, status }) as never;
  it('draws no total offline or while loading', () => {
    expect(downloadedCount(2, null)).toEqual({ downloaded: 2, total: null });
    expect(downloadedCount(2, { status: 'loading' }).total).toBeNull();
    expect(downloadedCount(2, { status: 'error' }).total).toBeNull();
  });
  it('adds only packs still to download', () => {
    expect(downloadedCount(1, { status: 'ready', offers: [offer('NEW'), offer('HELD'), offer('UPDATE')] }).total).toBe(2);
  });
});

