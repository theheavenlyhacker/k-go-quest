import { describe, expect, it } from 'vitest';
import { coach } from './coach';

describe('coach', () => {
  it('handles no Packs and no Attempts', () => {
    expect(coach([], [])).toMatch(/Download/);
    const pack = { lessons: [{ id: 'l', skillCode: 's', title: 'Fractions', exercises: [] }] } as never;
    expect(coach([pack], [])).toMatch(/begin/);
  });
});
