import type { QuizRecord } from './teacher-rewards';
import type { Subject } from './types';

/** The Quiz shapes the server speaks (`backend/docs/api.md`). Teacher-only; the answer key never reaches a Learner. */
export interface ServerQuizSummary {
  id: string;
  classroomId: string;
  title: string;
  subject: Subject;
  skillCodes: string[];
  status: 'DRAFT' | 'PUBLISHED';
  questionCount: number;
}
export interface ServerQuiz extends ServerQuizSummary {
  questions: { id: string; skillCode: string; prompt: string; options: string[] }[];
  answerKey: { exerciseId: string; correctOption: number }[];
}
export interface SkillChoice { skillCode: string; meanMastery: number; suggested: boolean; exercises: number }
export interface ServerQuizPaper {
  id: string;
  paperId?: string;
  quizId: string;
  studentId: string;
  alias: string;
}

export function parseQuizPapers(raw: unknown): ServerQuizPaper[] {
  if (!Array.isArray(raw)) throw new Error('Quiz papers: the list is missing.');
  return raw.map((item: unknown, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Quiz papers: item ${i} has the wrong shape.`);
    const { id, quizId, studentId, alias } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof quizId !== 'string' || typeof studentId !== 'string' || typeof alias !== 'string') {
      throw new Error(`Quiz papers: item ${i} has the wrong shape.`);
    }
    return { id, paperId: id, quizId, studentId, alias };
  });
}

/** Validate the live list before saving it for offline use. */
export function parseQuizSummaries(raw: unknown): ServerQuizSummary[] {
  if (!Array.isArray(raw)) throw new Error('Quizzes: the list is missing.');
  return raw.map((item: unknown, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Quizzes: item ${i} has the wrong shape.`);
    const { id, classroomId, title, subject, skillCodes, status, questionCount } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof classroomId !== 'string' || typeof title !== 'string'
      || (subject !== 'MATH' && subject !== 'ENGLISH' && subject !== 'FILIPINO' && subject !== 'SCIENCE')
      || !Array.isArray(skillCodes) || !skillCodes.every((code): code is string => typeof code === 'string')
      || (status !== 'DRAFT' && status !== 'PUBLISHED') || typeof questionCount !== 'number' || !Number.isInteger(questionCount) || questionCount < 0)
      throw new Error(`Quizzes: item ${i} has the wrong shape.`);
    return { id, classroomId, title, subject, skillCodes, status, questionCount };
  });
}

/** "math5.fractions" reads as "Fractions". */
export function skillLabel(code: string): string {
  const name = code.split('.').pop() ?? code;
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]+/g, ' ');
}

export const quizRecord = (quiz: ServerQuizSummary): QuizRecord => ({
  id: quiz.id,
  title: quiz.title,
  subject: quiz.subject,
  strand: quiz.skillCodes.map(skillLabel).join(', ') || 'No Skills',
  questionCount: quiz.questionCount,
  status: quiz.status,
});

/** Pre-ticked Skills: the ones the server suggests as the Classroom's weakest. */
export const suggestedSkills = (choices: SkillChoice[]): string[] => choices.filter((c) => c.suggested).map((c) => c.skillCode);

export const toggleSkill = (picked: string[], code: string): string[] => (picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]);
