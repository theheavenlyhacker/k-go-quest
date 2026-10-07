import { describe, expect, it } from 'vitest';
import { identifyQuizPaper, markingGrid, parseQuizPapers, parseQuizSummaries, quizRecord, skillLabel, suggestedSkills, toggleSkill, type ServerQuizSummary } from './quiz';
import { ApiError } from './client';
import { loadCached, type Cached } from './teacher-load';

describe('cached quiz lists', () => {
  const quiz: ServerQuizSummary = { id: 'q', classroomId: 'c', title: 'T', subject: 'MATH', skillCodes: ['math5.fractions'], status: 'DRAFT', questionCount: 4 };
  it('keeps live quizzes available offline and still rejects an expired session', async () => {
    let saved: Cached<ServerQuizSummary[]> | null = null;
    const cache = { get: async () => saved, put: async (entry: Cached<ServerQuizSummary[]>) => { saved = entry; } };
    await loadCached(async () => [quiz], parseQuizSummaries, cache);
    const offline = await loadCached(async () => { throw new ApiError(0, 'offline'); }, parseQuizSummaries, cache);
    expect(offline.stale).toBe(true);
    expect(offline.value.map(quizRecord)[0]).toMatchObject({ id: 'q', title: 'T', strand: 'Fractions' });
    await expect(loadCached(async () => { throw new ApiError(401, 'expired'); }, parseQuizSummaries, cache)).rejects.toThrow('expired');
  });
  it('accepts empty lists and rejects malformed summaries before caching', () => {
    expect(parseQuizSummaries([])).toEqual([]);
    for (const raw of [{}, [null], [{ ...quiz, skillCodes: [1] }], [{ ...quiz, subject: 'OTHER' }], [{ ...quiz, questionCount: -1 }]])
      expect(() => parseQuizSummaries(raw)).toThrow(/Quizzes/);
  });
});

describe('quiz view models', () => {
  it('labels Skills and maps a server Quiz to a list record', () => {
    expect(skillLabel('math5.fractions')).toBe('Fractions');
    expect(quizRecord({ id: 'q', classroomId: 'c', title: 'T', subject: 'MATH', skillCodes: ['math5.fractions', 'math5.decimals'], status: 'DRAFT', questionCount: 4 })).toEqual({
      id: 'q', title: 'T', subject: 'MATH', strand: 'Fractions, Decimals', questionCount: 4, status: 'DRAFT',
    });
  });
  it('pre-ticks the suggested weakest Skills and toggles a pick', () => {
    const skills = [{ skillCode: 'a', meanMastery: 0.2, suggested: true, exercises: 3 }, { skillCode: 'b', meanMastery: 0.9, suggested: false, exercises: 3 }];
    expect(suggestedSkills(skills)).toEqual(['a']);
    expect(toggleSkill(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSkill(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('quiz papers parsing', () => {
  it('parses valid server quiz papers list', () => {
    const raw = [{ id: 'p1', quizId: 'q1', studentId: 's1', alias: 'Ada' }];
    expect(parseQuizPapers(raw)).toEqual([
      { id: 'p1', paperId: 'p1', quizId: 'q1', studentId: 's1', alias: 'Ada' },
    ]);
  });

  it('rejects malformed papers payload', () => {
    expect(() => parseQuizPapers('not-an-array')).toThrow(/missing/);
    expect(() => parseQuizPapers([null])).toThrow(/wrong shape/);
    expect(() => parseQuizPapers([{ id: 'p1', quizId: 'q1', studentId: 123, alias: 'Ada' }])).toThrow(/wrong shape/);
  });
});


describe('marking Quiz Papers', () => {
  const quiz = { id: 'q', classroomId: 'c', title: 'T', subject: 'MATH' as const, skillCodes: ['math'], status: 'PUBLISHED' as const,
    questionCount: 3, questions: ['one', 'two', 'three'].map((id) => ({ id, skillCode: 'math', prompt: id, options: ['A', 'B', 'C', 'D'] })),
    answerKey: [{ exerciseId: 'three', correctOption: 3 }, { exerciseId: 'one', correctOption: 0 }, { exerciseId: 'two', correctOption: 1 }] };
  it('scores by Exercise key and treats blanks and missing answers as wrong', () => {
    expect(markingGrid(quiz, [0, null, 2])).toMatchObject({ score: 1, total: 3, rows: [{ correct: true }, { answer: null, correct: false }, { correct: false }] });
    expect(markingGrid(quiz, [])).toMatchObject({ score: 0, total: 3 });
    expect(markingGrid(quiz, [0, 1, 3]).score).toBe(3);
    expect(() => markingGrid({ ...quiz, answerKey: [] }, [])).toThrow(/incomplete/);
  });
  it('identifies issued papers by QR without trusting an alias in the QR, and refuses other Quizzes', () => {
    const paper = { id: 'p', quizId: 'q', studentId: 's', alias: 'Ada' };
    expect(identifyQuizPaper(JSON.stringify({ quizId: 'q', paperId: 'p', alias: 'Fake' }), 'q', [paper])).toEqual(paper);
    expect(() => identifyQuizPaper(JSON.stringify({ quizId: 'other', paperId: 'p' }), 'q', [paper])).toThrow('different Quiz');
    for (const raw of ['bad', 'null', '{}', '{"quizId":"q","paperId":"unknown"}']) expect(() => identifyQuizPaper(raw, 'q', [paper])).toThrow();
  });
  it('preserves result summaries and rejects invalid aggregates before caching', () => {
    const summary = { ...quiz, submittedCount: 5, classAverage: 80 };
    expect(quizRecord(parseQuizSummaries([summary])[0]!)).toMatchObject({ submittedCount: 5, classAverage: 80 });
    for (const bad of [{ submittedCount: -1 }, { submittedCount: 1.5 }, { classAverage: NaN }, { classAverage: 101 }])
      expect(() => parseQuizSummaries([{ ...summary, ...bad }])).toThrow('invalid results');
  });
});
