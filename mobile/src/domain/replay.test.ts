import { describe, expect, it } from 'vitest';
import { starterPacks } from '../content/starter-pack';
import { learningState, replayMastery, type Attempt, type UploadRecord } from './engine';
import type { SkillParameters } from './types';

describe('Mastery replay with new parameters', () => {
  const packs = starterPacks;
  const fractionsSkill = 'math5.fractions.equivalent';

  const sampleLog: Attempt[] = [
    // 3 answers to equivalent fractions exercises
    { id: 'att-1', exerciseId: 'math5.equivalent.q1', selectedOption: 0, at: '2026-10-01T01:00:00Z' }, // correct (q1 answer is 0)
    { id: 'att-2', exerciseId: 'math5.equivalent.q2', selectedOption: 1, at: '2026-10-01T02:00:00Z' }, // correct (q2 answer is 1)
    { id: 'att-3', exerciseId: 'math5.equivalent.q3', selectedOption: 0, at: '2026-10-01T03:00:00Z' }, // wrong (q3 answer is 1)
    // Repeat of q1 (practice only, not counted)
    { id: 'att-4', exerciseId: 'math5.equivalent.q1', selectedOption: 0, at: '2026-10-01T04:00:00Z' },
  ];

  const uploads = new Map<string, UploadRecord>([
    ['att-1', { state: 'DONE', correct: true, balance: 5, ackedAt: Date.parse('2026-10-01T01:05:00Z') }],
  ]);

  const newParameters: Record<string, SkillParameters> = {
    [fractionsSkill]: {
      prior: 0.1,
      learn: 0.05,
      guess: 0.25,
      slip: 0.08,
    },
  };

  it('is deterministic: repeated runs produce identical learning state', () => {
    const run1 = replayMastery(packs, sampleLog, uploads, newParameters);
    const run2 = replayMastery(packs, sampleLog, uploads, newParameters);

    expect(run1.coins).toBe(run2.coins);
    expect([...run1.statuses.entries()]).toEqual([...run2.statuses.entries()]);
    expect(run1.skills).toEqual(run2.skills);
  });

  it('leaves Coins untouched when replaying with new parameters', () => {
    const original = learningState(packs, sampleLog, uploads);
    const replayed = replayMastery(packs, sampleLog, uploads, newParameters);

    expect(replayed.coins).toBe(original.coins);
  });

  it('leaves Counted status and counts untouched', () => {
    const original = learningState(packs, sampleLog, uploads);
    const replayed = replayMastery(packs, sampleLog, uploads, newParameters);

    // Attempt statuses ('graded', 'practice', etc.) are preserved
    for (const [id, status] of original.statuses) {
      expect(replayed.statuses.get(id)).toBe(status);
    }
    expect(replayed.statuses.get('att-4')).toBe('practice');

    // Counted attempt counts per skill are preserved
    const origSkill = original.skills.find((s) => s.skillId === fractionsSkill)!;
    const replayedSkill = replayed.skills.find((s) => s.skillId === fractionsSkill)!;
    expect(replayedSkill.counted).toBe(origSkill.counted);
    expect(replayedSkill.counted).toBe(3);
  });

  it('updates Mastery trajectory to reflect new parameters', () => {
    const original = learningState(packs, sampleLog, uploads);
    const replayed = replayMastery(packs, sampleLog, uploads, newParameters);

    const origSkill = original.skills.find((s) => s.skillId === fractionsSkill)!;
    const replayedSkill = replayed.skills.find((s) => s.skillId === fractionsSkill)!;

    // Because new prior is 0.1 (vs original ~0.31) and learn is 0.05, replayed mastery is different
    expect(replayedSkill.mastery).not.toBeCloseTo(origSkill.mastery, 3);
  });
});
