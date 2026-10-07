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
