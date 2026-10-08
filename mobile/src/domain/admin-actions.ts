import { knownSubject } from './packs';
import type { ServerClassroom } from './server';

export function passwordError(password: string): string | null {
  return password.length < 12 || password.length > 128 ? 'Password must be 12–128 characters.' : null;
}

export interface LearnerForm { alias: string; loginId: string; password: string; classroomId: string }
export function learnerFormErrors(form: LearnerForm, classrooms: ServerClassroom[]): string[] {
  const errors: string[] = [];
  if (form.alias.trim().length < 2 || form.alias.trim().length > 80) errors.push('Alias must be 2–80 characters.');
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(form.loginId.trim())) errors.push('Login ID must be 3–80 letters, numbers, dots, underscores or hyphens.');
  const password = passwordError(form.password);
  if (password) errors.push(password);
  if (!classrooms.some((c) => c.id === form.classroomId)) errors.push('Choose a Classroom.');
  return errors;
}

export interface ImportExercise { prompt: string; options: string[]; correctOption: number; coinAward: number }
export interface ImportLesson { title: string; skillCode: string; body: string; hints: Record<string, string>; exercises: ImportExercise[] }
export interface ImportPack { title: string; subject: string; grade: number; version: string; lessons: ImportLesson[] }
export class PackFileError extends Error {
  constructor(public errors: string[]) { super(errors.join('\n')); }
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Validate the whole export before creating any drafts; exported UUIDs never enter authoring POSTs. */
export function parsePackFile(text: string): ImportPack[] {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new PackFileError(['File: invalid JSON.']); }
  const root = object(raw);
  const values = 'packs' in root ? root.packs : [raw];
  if (!Array.isArray(values) || values.length === 0) throw new PackFileError(['File: expected a Content Pack or a nonempty packs catalogue.']);
  const errors: string[] = [];
  const string = (value: unknown, min: number, max: number, path: string): string => {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) errors.push(`${path}: must be ${min}–${max} characters.`);
    return typeof value === 'string' ? value : '';
  };
  const list = (value: unknown, path: string): unknown[] => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) errors.push(`${path}: must contain 1–100 entries.`);
    return Array.isArray(value) ? value : [];
  };
  const packs = values.map((value, pi): ImportPack => {
    const p = object(value), path = `Pack ${pi + 1}`;
    const title = string(p.title, 2, 120, `${path} title`);
    if (typeof p.subject !== 'string' || !knownSubject(p.subject)) errors.push(`${path}: subject must be MATH, SCIENCE, ENGLISH or FILIPINO.`);
    if (!Number.isInteger(p.grade) || Number(p.grade) < 1 || Number(p.grade) > 12) errors.push(`${path}: grade must be 1–12.`);
    const version = string(p.version, 1, 30, `${path} version`);
    const lessons = list(p.lessons, `${path} Lessons`).map((value, li): ImportLesson => {
      const l = object(value), lp = `${path}, Lesson ${li + 1}${typeof l.title === 'string' ? ` (${l.title})` : ''}`;
      const title = string(l.title, 2, 120, `${lp} title`);
      const skillCode = string(l.skillCode, 2, 100, `${lp} Skill code`);
      const body = string(l.body, 2, 20000, `${lp} body`);
      const hints: Record<string, string> = {};
      const supplied = object(l.hints);
      hints.en = string(supplied.en, 1, 2000, `${lp} English Hint`);
      for (const lang of ['tl', 'ceb', 'ilo']) if (supplied[lang] !== undefined) hints[lang] = string(supplied[lang], 1, 2000, `${lp} ${lang} Hint`);
      const exercises = list(l.exercises, `${lp} Exercises`).map((value, ei): ImportExercise => {
        const e = object(value), ep = `${lp}, Exercise ${ei + 1}`;
        const prompt = string(e.prompt, 2, 2000, `${ep} prompt`);
        const options = Array.isArray(e.options) ? e.options.map((v, oi) => string(v, 1, 500, `${ep} option ${oi + 1}`)) : [];
        if (options.length < 2 || options.length > 6) errors.push(`${ep}: needs 2–6 options.`);
        if (!Number.isInteger(e.correctOption) || Number(e.correctOption) < 0 || Number(e.correctOption) >= options.length) errors.push(`${ep}: correctOption must name an existing option (starting at zero).`);
        const coinAward = e.coinAward === undefined ? 5 : Number(e.coinAward);
        if (!Number.isInteger(coinAward) || coinAward < 0 || coinAward > 20 || (e.coinAward !== undefined && typeof e.coinAward !== 'number')) errors.push(`${ep}: coinAward must be 0–20.`);
        return { prompt, options, correctOption: Number(e.correctOption), coinAward };
      });
      return { title, skillCode, body, hints, exercises };
    });
    return { title, subject: String(p.subject), grade: Number(p.grade), version, lessons };
  });
  if (errors.length) throw new PackFileError(errors);
  return packs;
}

export type AdminCall = <T>(method: 'POST' | 'PATCH', route: string, body?: unknown) => Promise<T>;
export interface ImportProgress { packId?: string; lessonIds: string[]; exerciseCounts: number[] }
export async function importPack(call: AdminCall, pack: ImportPack, attribution: string, progress: ImportProgress = { lessonIds: [], exerciseCounts: [] }): Promise<string> {
  if (attribution.trim().length < 2 || attribution.length > 500) throw new Error('Attribution must be 2–500 characters.');
  const { lessons, ...metadata } = pack;
  if (!progress.packId) progress.packId = (await call<{ id: string }>('POST', 'content/packs', { ...metadata, attribution: attribution.trim() })).id;
  try {
    for (const [i, { exercises, ...lesson }] of lessons.entries()) {
      if (!progress.lessonIds[i]) progress.lessonIds[i] = (await call<{ id: string }>('POST', `content/packs/${progress.packId}/lessons`, lesson)).id;
      for (let j = progress.exerciseCounts[i] ?? 0; j < exercises.length; j++) {
        await call('POST', `content/lessons/${progress.lessonIds[i]}/exercises`, exercises[j]);
        progress.exerciseCounts[i] = j + 1;
      }
    }
  } catch (error) {
    throw new Error(`Draft ${pack.title} (${progress.packId}) is incomplete. ${error instanceof Error ? error.message : 'Upload failed.'} Retry the remaining content here before publishing. Closing and importing again creates a new draft.`);
  }
  return progress.packId;
}
