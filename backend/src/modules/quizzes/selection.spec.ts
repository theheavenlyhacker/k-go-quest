import { pickItems, weakestSkills } from './selection';

describe('weakestSkills', () => {
  const skills = [
    { skillCode: 'c', mean: 0.5 },
    { skillCode: 'a', mean: 0.2 },
    { skillCode: 'b', mean: 0.97 },
    { skillCode: 'd', mean: 0.2 },
  ];
  it('orders by lowest mean Mastery, skips Mastered Skills, breaks ties by code', () => {
    expect(weakestSkills(skills, 10)).toEqual(['a', 'd', 'c']);
  });
  it('is deterministic whatever the input order and honours the limit', () => {
    expect(weakestSkills([...skills].reverse(), 2)).toEqual(['a', 'd']);
  });
});

describe('pickItems', () => {
  const c = (id: string, skillCode: string, answered: number) => ({ id, skillCode, answered });
  const pool = [c('e3', 'a', 5), c('e1', 'a', 0), c('e2', 'a', 0), c('e4', 'b', 1), c('e5', 'b', 0)];
  it('rotates through Skills weakest first and prefers least-answered Exercises', () => {
    expect(pickItems(pool, ['a', 'b'], 4)).toEqual(['e1', 'e5', 'e2', 'e4']);
  });
  it('returns fewer when the bank runs out, and is repeatable', () => {
    expect(pickItems(pool, ['b'], 5)).toEqual(['e5', 'e4']);
    expect(pickItems(pool, ['a', 'b'], 4)).toEqual(pickItems([...pool].reverse(), ['a', 'b'], 4));
  });
});
