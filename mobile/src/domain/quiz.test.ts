import { describe, expect, it } from 'vitest';
import { parseQuizSummaries, quizRecord, skillLabel, suggestedSkills, toggleSkill, type ServerQuizSummary } from './quiz';
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
