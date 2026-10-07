import { subjectTitles } from './subjects';
import type { Subject } from './types';

/**
 * Quiz Builder and Rewards & Credentials view models: pure, no React or I/O.
 * Neither concept has a backend or glossary term yet (#31), so the inputs are
 * the fixture shapes in `teacher-rewards-fixture.ts`.
 */
export interface QuizRecord {
  id: string;
  title: string;
  subject: Subject;
  /** MATATAG strand, e.g. "Number and Algebra". */
  strand: string;
  questionCount: number;
  status: 'PUBLISHED' | 'DRAFT';
}

export interface CredentialRecord { id: string; title: string; issuer: string; /** ISO date. */ completedAt: string }
export interface BadgeRecord { id: string; label: string }
export interface TeacherRewardsRecord { badges: BadgeRecord[]; credentials: CredentialRecord[] }

export interface QuizCard { id: string; title: string; subjectTitle: string; strand: string; questions: string; published: boolean; statusLabel: string }

export const quizCards = (quizzes: QuizRecord[]): QuizCard[] =>
  quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    subjectTitle: subjectTitles[quiz.subject],
    strand: quiz.strand,
    questions: `${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`,
    published: quiz.status === 'PUBLISHED',
    statusLabel: quiz.status === 'PUBLISHED' ? 'Published' : 'Draft',
  }));

/** Impact Points needed per level. ponytail: a flat step until the backend defines levels. */
export const POINTS_PER_LEVEL = 1000;

export interface LevelCard { level: number; points: number; progress: number; toNext: number }

export function levelCard(impactPoints: number): LevelCard {
  const points = Math.max(0, Math.floor(impactPoints));
  const into = points % POINTS_PER_LEVEL;
  return { level: Math.floor(points / POINTS_PER_LEVEL) + 1, points, progress: into / POINTS_PER_LEVEL, toNext: POINTS_PER_LEVEL - into };
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Sep 2026" from an ISO date, independent of device locale and time zone. */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} ${months[(month ?? 1) - 1]} ${year}`;
}

export interface CredentialRow { id: string; title: string; detail: string }

/** Newest first. */
export const credentialRows = (credentials: CredentialRecord[]): CredentialRow[] =>
  [...credentials]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map((credential) => ({ id: credential.id, title: credential.title, detail: `${credential.issuer} · Completed ${shortDate(credential.completedAt)}` }));
