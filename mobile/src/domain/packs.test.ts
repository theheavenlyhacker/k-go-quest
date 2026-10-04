import { describe, expect, it } from 'vitest';

import { DEFAULT_SKILL_PARAMETERS } from '../content/starter-pack';
import { checksumBody, compareVersions, offers, toPack, type DownloadedPack } from './packs';
import type { PackPayload, ServerPackSummary } from './server';

const parameters = () => DEFAULT_SKILL_PARAMETERS;

/** The server issues UUIDs for everything, so the fixtures do too. */
const uuid = (n: number) => `${`${n}`.repeat(8)}-1111-4111-8111-111111111111`;
const PACK = uuid(1);
const LESSON = uuid(2);
const FIRST = uuid(3);
const SECOND = uuid(4);

const payload = (over: Partial<PackPayload> = {}): PackPayload => ({
  pack: { id: PACK, title: 'Fractions', subject: 'MATH', grade: 5, version: '1.2.0' },
  lessons: [
    {
      id: LESSON, packId: PACK, title: 'Equivalent fractions', skillCode: 'math5.equivalent',
      body: 'Two fractions are equivalent when they name the same amount.', hints: { en: 'Do the same to both.' },
      exercises: [
        { id: FIRST, lessonId: LESSON, prompt: 'Which equals 1/2?', options: ['2/4', '2/3'] },
        { id: SECOND, lessonId: LESSON, prompt: 'Which equals 3/4?', options: ['6/10', '6/8'] },
      ],
    },
  ],
  checksum: 'unused-here',
  ...over,
});

describe('compareVersions', () => {
  it('orders by each numeric part rather than as text', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('treats a missing part as zero, so 2.0 and 2.0.0 are the same version', () => {
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('2.0', '2.0.1')).toBeLessThan(0);
  });

  it('puts a pre-release before its release, so a beta is never an update', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0-beta')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('checksumBody', () => {
  it('hashes the pack and lessons only, excluding the response metadata', () => {
    const body = checksumBody(payload());
    expect(body).toBe(JSON.stringify({ pack: payload().pack, lessons: payload().lessons }));
    expect(body).not.toContain('unused-here');
  });

  it('changes when any part of the content changes', () => {
    const changed = payload();
    changed.lessons[0].exercises[0].prompt = 'Which equals 1/3?';
    expect(checksumBody(changed)).not.toBe(checksumBody(payload()));
  });
});

describe('toPack', () => {
  it('always grades a Downloaded Pack on sync, because the download carries no answer key', () => {
    const pack = toPack(payload(), parameters);
    expect(pack.grading).toBe('ON_SYNC');
    expect(pack.lessons[0].exercises.map((e) => e.correctOption)).toEqual([null, null]);
  });

  it('keeps the server ids, so an Attempt against a Downloaded Exercise can be uploaded unchanged', () => {
    const pack = toPack(payload(), parameters);
    expect(pack.id).toBe(PACK);
    expect(pack.lessons[0].id).toBe(LESSON);
    expect(pack.lessons[0].exercises.map((e) => e.id)).toEqual([FIRST, SECOND]);
  });

  it('gives every Skill in the Pack its parameters, once each and in lesson order', () => {
    const body = payload();
    const copy = (id: string, skillCode: string) => ({
      ...body.lessons[0], id, skillCode,
      exercises: body.lessons[0].exercises.map((e, i) => ({ ...e, id: uuid(5 + i), lessonId: id })),
    });
    body.lessons = [body.lessons[0], copy(uuid(7), 'math5.add')];
    const pack = toPack(body, (skillCode) => (skillCode === 'math5.add' ? { prior: 0.3, learn: 0.1, guess: 0.2, slip: 0.1 } : DEFAULT_SKILL_PARAMETERS));
    expect(pack.skills.map((s) => s.id)).toEqual(['math5.equivalent', 'math5.add']);
    expect(pack.skills[1].parameters.prior).toBe(0.3);
  });

  it('defaults absent hints to none rather than failing, so a Pack without translations still installs', () => {
    const body = payload();
    body.lessons[0].hints = null;
    expect(toPack(body, parameters).lessons[0].hints).toEqual({});
  });

  it('refuses a Pack for a Subject this app has no screens for', () => {
    expect(() => toPack(payload({ pack: { ...payload().pack, subject: 'ARALING_PANLIPUNAN' } }), parameters)).toThrow(/subject/i);
  });

  it('refuses a Pack with nothing to practise', () => {
    expect(() => toPack(payload({ lessons: [] }), parameters)).toThrow(/lesson/i);
    const empty = payload();
    empty.lessons[0].exercises = [];
    expect(() => toPack(empty, parameters)).toThrow(/exercise/i);
  });

  it('refuses an Exercise with fewer than two options, which could not be answered', () => {
    const thin = payload();
    thin.lessons[0].exercises[0].options = ['only'];
    expect(() => toPack(thin, parameters)).toThrow(/option/i);
  });

  it('refuses repeated ids, which would make one Exercise shadow another in the Attempt log', () => {
    const clash = payload();
    clash.lessons[0].exercises[1].id = FIRST;
    expect(() => toPack(clash, parameters)).toThrow(/more than once/i);
  });

  /**
   * The Starter Pack identifies its content by slug, so a Pack arriving with a
   * slug could shadow a Starter Pack Exercise and silently un-count Attempts
   * the tablet had already graded.
   */
  it('refuses an id the server would not have issued', () => {
    const slug = payload();
    slug.lessons[0].exercises[0].id = 'math5.equivalent.q1';
    expect(() => toPack(slug, parameters)).toThrow(/not one the server issues/i);
  });
});

describe('offers', () => {
  const summary = (over: Partial<ServerPackSummary>): ServerPackSummary =>
    ({ id: PACK, title: 'Fractions', subject: 'MATH', grade: 5, version: '1.2.0', ...over });
  const held = (over: Partial<ServerPackSummary> = {}): DownloadedPack =>
    ({ checksum: 'abc', downloadedAt: '2026-10-01T00:00:00.000Z', pack: toPack(payload({ pack: { ...payload().pack, ...over } }), parameters) });

  it('has nothing to do about a Pack this tablet already holds at the same version', () => {
    const [offer] = offers([summary({})], [held()]);
    expect(offer.status).toBe('HELD');
    expect(offer.replaces).toBeNull();
  });

  it('offers a Pack this tablet has never seen', () => {
    const [offer] = offers([summary({ id: uuid(9), title: 'Decimals' })], [held()]);
    expect(offer.status).toBe('NEW');
    expect(offer.replaces).toBeNull();
  });

  /**
   * The server gives each published version its own Pack id, so an update is
   * recognised by the Pack Line it continues, and installing it supersedes the
   * older id rather than leaving a Learner two copies of the same Pack.
   */
  it('offers a higher version on a Pack Line already held as an update, and says which id it replaces', () => {
    const [offer] = offers([summary({ id: uuid(8), version: '1.3.0' })], [held()]);
    expect(offer.status).toBe('UPDATE');
    expect(offer.replaces).toBe(PACK);
  });

  it('has nothing to do about a version older than the one held', () => {
    expect(offers([summary({ id: uuid(8), version: '1.1.0' })], [held()])[0].status).toBe('HELD');
  });

  it('has nothing to do when the same id reappears at a lower version', () => {
    expect(offers([summary({ version: '1.1.0' })], [held()])[0].status).toBe('HELD');
  });

  it('treats the same title at another grade as a separate Pack Line', () => {
    expect(offers([summary({ id: uuid(8), grade: 6, version: '1.3.0' })], [held()])[0].status).toBe('NEW');
  });

  it('keeps the server order, so the Caretaker sees the list the server meant to send', () => {
    const list = offers([summary({ id: uuid(9), title: 'Decimals' }), summary({})], [held()]);
    expect(list.map((offer) => offer.summary.id)).toEqual([uuid(9), PACK]);
  });
});
