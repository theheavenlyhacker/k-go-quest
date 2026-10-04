export type Subject = 'MATH' | 'ENGLISH' | 'FILIPINO' | 'SCIENCE';
export interface Profile { id: string; alias: string; }
export interface SkillParameters { prior: number; learn: number; guess: number; slip: number; }
export interface SkillSpec { id: string; parameters: SkillParameters; }
export interface Pack { id: string; title: string; subject: Subject; grade: number; version: string; skills: SkillSpec[]; lessons: Lesson[]; }
export interface Exercise { id: string; lessonId: string; prompt: string; options: string[]; correctOption: number; }
export interface Lesson { id: string; packId: string; title: string; skillCode: string; body: string; hints: Record<string, string>; exercises: Exercise[]; }
