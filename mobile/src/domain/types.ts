export type Subject = 'MATH' | 'ENGLISH' | 'FILIPINO' | 'SCIENCE';
export interface Profile { id: string; alias: string; }
export interface SkillParameters { prior: number; learn: number; guess: number; slip: number; }
export interface SkillSpec { id: string; parameters: SkillParameters; }
/**
 * How a Content Pack's Attempts are graded.
 *
 * `ON_DEVICE` ships the answer key with the Pack, so the tablet grades the
 * moment a Learner answers — the Starter Pack is always this, and it is what
 * makes the app work with the radio off. `ON_SYNC` withholds the key, so an
 * Attempt is recorded unmarked and the server grades it on upload; that is the
 * only mode where no answer key sits on a Shared Tablet. See
 * `docs/online-mode.md`.
 */
export type Grading = 'ON_DEVICE' | 'ON_SYNC';
export interface Pack { id: string; title: string; subject: Subject; grade: number; version: string; grading: Grading; skills: SkillSpec[]; lessons: Lesson[]; }
export interface Exercise { id: string; lessonId: string; prompt: string; options: string[]; correctOption: number; }
export interface Lesson { id: string; packId: string; title: string; skillCode: string; body: string; hints: Record<string, string>; exercises: Exercise[]; }
