import { describe, expect, it } from 'vitest';
import { quizRecord, skillLabel, suggestedSkills, toggleSkill } from './quiz';

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
