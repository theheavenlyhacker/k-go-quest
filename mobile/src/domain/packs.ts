import type { PackPayload, ServerPackSummary } from './server';
import type { Exercise, Lesson, Pack, SkillParameters, SkillSpec, Subject } from './types';

/**
 * The rules for taking a Content Pack from the server, with no I/O in them.
 *
 * A Downloaded Pack is always graded on sync, because the server sends it
 * without its answer key — that is the whole point of the mode. The Starter
 * Pack is untouched by any of this and keeps grading on the tablet, so a tablet
 * that never downloads anything behaves exactly as it did.
 *
 * See `docs/online-mode.md`.
 */

/** The Subjects this app has screens for. A Pack for any other Subject is refused. */
const SUBJECTS: Subject[] = ['MATH', 'ENGLISH', 'FILIPINO', 'SCIENCE'];

/** The Subject a server string names, or null when this app has no screens for it. */
export const knownSubject = (value: string): Subject | null => SUBJECTS.find((subject) => subject === value) ?? null;

/**
 * Every id the server issues is a UUID (`backend/docs/api.md`), and the Starter
 * Pack's ids are slugs, so the two can never collide — which is what lets an
 * Attempt against a Downloaded Pack be uploaded with no translation at all.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One Downloaded Pack, as the tablet keeps it between launches. */
export interface DownloadedPack {
  /** The server's checksum for the version held, so a re-download can be skipped. */
  checksum: string;
  /** When this tablet last took this Pack from the server. */
  downloadedAt: string;
  pack: Pack;
}

/**
 * Orders two version strings.
 *
 * Each part is compared as a number where both sides are numeric and as text
 * otherwise, so an unexpected version string such as `1.0.0-beta` still orders
 * consistently instead of throwing.
 */
export function compareVersions(left: string, right: string): number {
  const split = (value: string) => value.split(/[.\-+]/).filter((part) => part.length > 0);
  const leftParts = split(left);
  const rightParts = split(right);
  const numeric = (part: string | undefined) => part !== undefined && /^\d+$/.test(part);
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i += 1) {
    const one = leftParts[i];
    const two = rightParts[i];
    // An absent numeric part is zero, so 2.0 and 2.0.0 are the same version.
    // An absent part against a non-numeric one is the semver rule for a
    // pre-release: 1.0.0-beta comes before 1.0.0, so a beta is never offered to
    // a tablet as an update to the release.
    if (one === undefined || two === undefined) {
      if (!numeric(one ?? two)) return one === undefined ? 1 : -1;
    }
    const a = one ?? '0';
    const b = two ?? '0';
    const order = numeric(a) && numeric(b) ? Number(a) - Number(b) : a.localeCompare(b);
    if (order !== 0) return order;
  }
  return 0;
}

/**
 * The exact bytes the server hashed to produce `checksum`.
 *
 * The server builds its digest over `JSON.stringify({ pack, lessons })` before
 * adding the metadata beside it, so the tablet has to rebuild the same string
 * from the same key order — which `JSON.parse` preserves from the response
 * text. It is a contract between the two sides rather than a canonical
 * encoding; a mismatch means the two versions of this app disagree, which is
 * exactly what the check exists to catch.
 */
export function checksumBody(payload: PackPayload): string {
  return JSON.stringify({ pack: payload.pack, lessons: payload.lessons });
}

/**
 * Turns a download into a Content Pack this tablet can practise from.
 *
 * Everything that would make a Pack unusable is refused here, before it reaches
 * storage, so a Downloaded Pack is always one a Learner can actually open.
 */
export function toPack(payload: PackPayload, parameters: (skillCode: string) => SkillParameters): Pack {
  const { pack, lessons } = payload;
  const subject = knownSubject(pack.subject);
  if (!subject) throw new Error(`This tablet has no screens for the subject ${pack.subject}.`);
  if (!lessons.length) throw new Error('That Content Pack has no lessons in it yet.');

  const seen = new Set<string>();
  const once = (id: string) => {
    // A slug here would be an id the Starter Pack could also carry, and the
    // Exercise holding it would shadow the Starter Pack's in the Attempt log.
    if (!UUID.test(id)) throw new Error(`That Content Pack has the id ${id || '(none)'}, which is not one the server issues.`);
    if (seen.has(id)) throw new Error(`That Content Pack uses the id ${id} more than once.`);
    seen.add(id);
  };
  once(pack.id);

  const converted: Lesson[] = lessons.map((lesson) => {
    once(lesson.id);
    if (!lesson.exercises.length) throw new Error(`The lesson ${lesson.title} has no exercises in it.`);
    const exercises: Exercise[] = lesson.exercises.map((exercise) => {
      once(exercise.id);
      if (exercise.options.length < 2) throw new Error(`An exercise in ${lesson.title} has too few options to answer.`);
      return {
        id: exercise.id,
        lessonId: lesson.id,
        prompt: exercise.prompt,
        options: exercise.options,
        // No answer key came with the Pack, so the tablet cannot mark this.
        correctOption: null,
      };
    });
    return {
      id: lesson.id,
      packId: pack.id,
      title: lesson.title,
      skillCode: lesson.skillCode,
      body: lesson.body,
      hints: lesson.hints ?? {},
      exercises,
    };
  });

  const skills: SkillSpec[] = [];
  for (const lesson of converted) {
    if (skills.some((skill) => skill.id === lesson.skillCode)) continue;
    skills.push({ id: lesson.skillCode, parameters: parameters(lesson.skillCode) });
  }

  return { id: pack.id, title: pack.title, subject, grade: pack.grade, version: pack.version, grading: 'ON_SYNC', skills, lessons: converted };
}

/**
 * What this tablet can do with one Content Pack the server offers.
 *
 * `HELD` is the one answer that means nothing to do: this tablet already has
 * this version, or a newer one on the same Pack Line.
 */
export type PackStatus = 'NEW' | 'UPDATE' | 'HELD';

export interface PackOffer {
  summary: ServerPackSummary;
  status: PackStatus;
  /** The Downloaded Pack id this one supersedes, or null when it starts a new Pack Line. */
  replaces: string | null;
}

/** A Pack Line: every version of one Content Pack shares a Subject, a grade and a title. */
const packLine = (pack: { subject: string; grade: number; title: string }) => `${pack.subject}/${pack.grade}/${pack.title}`;

/**
 * Matches what the server offers against what this tablet holds.
 *
 * The server gives each published version its own Pack id, so an update is
 * recognised by the Pack Line it continues and `replaces` is the id that
 * installing it supersedes — otherwise a Learner would be left two copies of
 * the same Pack.
 */
export function offers(available: ServerPackSummary[], downloaded: DownloadedPack[]): PackOffer[] {
  const byId = new Map(downloaded.map((entry) => [entry.pack.id, entry.pack]));
  const byLine = new Map(downloaded.map((entry) => [packLine(entry.pack), entry.pack]));
  return available.map((summary) => {
    const held = byId.get(summary.id);
    if (held && compareVersions(held.version, summary.version) >= 0) return { summary, status: 'HELD', replaces: null };
    const sameLine = byLine.get(packLine(summary));
    if (!sameLine) return { summary, status: 'NEW', replaces: null };
    if (compareVersions(summary.version, sameLine.version) <= 0) return { summary, status: 'HELD', replaces: null };
    return { summary, status: 'UPDATE', replaces: sameLine.id };
  });
}
