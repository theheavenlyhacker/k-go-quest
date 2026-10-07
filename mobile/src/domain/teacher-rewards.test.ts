import { describe, expect, it } from 'vitest';
import { credentialRows, levelCard, quizCards, shortDate } from './teacher-rewards';
import { quizzesFixture, teacherRewardsFixture } from './teacher-rewards-fixture';

describe('quizCards', () => {
  const cards = quizCards(quizzesFixture);
  it('maps Subject title, strand, question count and status', () => {
    expect(cards[0]).toMatchObject({ title: 'Equivalent Fractions Check', subjectTitle: 'Math', strand: 'Number and Algebra', questions: '10 questions', published: true, statusLabel: 'Published' });
    expect(cards[2]).toMatchObject({ subjectTitle: 'Science', published: false, statusLabel: 'Draft' });
  });
  it('singularises one question and handles no quizzes', () => {
    expect(quizCards([{ ...quizzesFixture[0]!, questionCount: 1 }])[0]!.questions).toBe('1 question');
    expect(quizCards([])).toEqual([]);
  });
});

describe('levelCard', () => {
  it('derives level, progress and points to the next level', () => {
    expect(levelCard(2450)).toEqual({ level: 3, points: 2450, progress: 0.45, toNext: 550 });
  });
  it('starts at level 1 and ignores negatives', () => {
    expect(levelCard(0)).toEqual({ level: 1, points: 0, progress: 0, toNext: 1000 });
    expect(levelCard(-5).points).toBe(0);
  });
});

describe('credentialRows', () => {
  it('lists newest first with a completion date', () => {
    const rows = credentialRows(teacherRewardsFixture.credentials);
    expect(rows.map((r) => r.id)).toEqual(['c1', 'c2', 'c3']);
    expect(rows[0]!.detail).toBe('DepEd Training Center · Completed 12 Sep 2026');
  });
  it('formats dates without locale or time zone drift', () => {
    expect(shortDate('2026-01-01T23:59:59.000Z')).toBe('1 Jan 2026');
  });
});
