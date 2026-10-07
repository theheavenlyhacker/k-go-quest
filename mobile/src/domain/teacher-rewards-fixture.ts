import type { QuizRecord, TeacherRewardsRecord } from './teacher-rewards';

/** Fixture data for the Quizzes and Rewards tabs, until the backend has these concepts (#31). */
export const quizzesFixture: QuizRecord[] = [
  { id: 'q1', title: 'Equivalent Fractions Check', subject: 'MATH', strand: 'Number and Algebra', questionCount: 10, status: 'PUBLISHED' },
  { id: 'q2', title: 'Finding the Main Idea', subject: 'ENGLISH', strand: 'Reading and Literature', questionCount: 8, status: 'PUBLISHED' },
  { id: 'q3', title: 'Life Cycles Review', subject: 'SCIENCE', strand: 'Living Things', questionCount: 12, status: 'DRAFT' },
];

export const teacherRewardsFixture: TeacherRewardsRecord = {
  badges: [
    { id: 'b1', label: 'Early Adopter' },
    { id: 'b2', label: 'Mastery Mentor' },
    { id: 'b3', label: 'Streak Keeper' },
    { id: 'b4', label: 'Offline Hero' },
  ],
  credentials: [
    { id: 'c1', title: 'Teaching Fractions with Hints', issuer: 'DepEd Training Center', completedAt: '2026-09-12' },
    { id: 'c2', title: 'Shared Tablet Classroom Routines', issuer: 'LGU Education Office', completedAt: '2026-08-03' },
    { id: 'c3', title: 'Reading Intervention Basics', issuer: 'DepEd Training Center', completedAt: '2026-06-21' },
  ],
};
