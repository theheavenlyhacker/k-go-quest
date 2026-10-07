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
  submittedCount?: number;
  /** Mean percent correct among submitted papers, or null before any submission. */
  classAverage?: number | null;
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
    const { submittedCount, classAverage } = item as Record<string, unknown>;
    if ((submittedCount !== undefined && (typeof submittedCount !== 'number' || !Number.isInteger(submittedCount) || submittedCount < 0))
      || (classAverage !== undefined && classAverage !== null && (typeof classAverage !== 'number' || !Number.isFinite(classAverage) || classAverage < 0 || classAverage > 100)))
      throw new Error(`Quizzes: item ${i} has invalid results.`);
    return { id, classroomId, title, subject, skillCodes, status, questionCount,
      ...(submittedCount !== undefined ? { submittedCount: submittedCount as number } : {}),
      ...(classAverage !== undefined ? { classAverage: classAverage as number | null } : {}) };
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
  ...(quiz.submittedCount !== undefined ? { submittedCount: quiz.submittedCount } : {}),
  ...(quiz.classAverage !== undefined ? { classAverage: quiz.classAverage } : {}),
});

/** Pre-ticked Skills: the ones the server suggests as the Classroom's weakest. */
export const suggestedSkills = (choices: SkillChoice[]): string[] => choices.filter((c) => c.suggested).map((c) => c.skillCode);

export const toggleSkill = (picked: string[], code: string): string[] => (picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]);

export type PaperAnswer = number | null;
export interface QuizResults {
  quizId: string; title: string; total: number; submittedCount: number; classAverage: number | null;
  learners: { paperId: string; studentId: string; alias: string; answers: PaperAnswer[]; score: number; gradedAt: string }[];
  items: { exerciseId: string; correctCount: number; submittedCount: number; difficulty: number | null }[];
}

/** Match only a Paper issued for this Quiz. QR contents are never used as a Learner alias. */
export function identifyQuizPaper(raw: string, quizId: string, papers: ServerQuizPaper[]): ServerQuizPaper {
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error('This QR code is not a Quiz Paper.'); }
  if (!payload || typeof payload !== 'object' || typeof (payload as Record<string, unknown>).quizId !== 'string'
    || typeof (payload as Record<string, unknown>).paperId !== 'string') throw new Error('This QR code is not a Quiz Paper.');
  const qr = payload as { quizId: string; paperId: string };
  if (qr.quizId !== quizId) throw new Error('This paper belongs to a different Quiz.');
  const paper = papers.find((p) => p.id === qr.paperId && p.quizId === quizId);
  if (!paper) throw new Error('This paper was not issued for this Quiz.');
  return paper;
}

/** Blanks count as wrong. This preview never touches practice, Mastery or Coins. */
export function markingGrid(quiz: ServerQuiz, answers: PaperAnswer[]) {
  const rows = quiz.questions.map((question, index) => {
    const answer = answers[index] ?? null;
    const key = quiz.answerKey.find((k) => k.exerciseId === question.id);
    if (!key) throw new Error('The Quiz answer key is incomplete.');
    return { number: index + 1, answer, correctOption: key.correctOption, correct: answer !== null && answer === key.correctOption };
  });
  return { rows, score: rows.filter((r) => r.correct).length, total: rows.length };
}
