/** Weakness-first selection for Quizzes: pure, deterministic, no I/O. */
export interface SkillMean { skillCode: string; mean: number }
export interface Candidate { id: string; skillCode: string; answered: number }

const MASTERED = 0.95;

/** Skills the Classroom has not Mastered, lowest mean Mastery first. */
export function weakestSkills(skills: SkillMean[], limit: number): string[] {
  return skills
    .filter((s) => s.mean < MASTERED)
    .sort((a, b) => a.mean - b.mean || a.skillCode.localeCompare(b.skillCode))
    .slice(0, limit)
    .map((s) => s.skillCode);
}

/** Takes one Exercise per Skill in turn, weakest Skill first; within a Skill the least-answered first. */
export function pickItems(pool: Candidate[], skillOrder: string[], count: number): string[] {
  const queues = skillOrder.map((code) =>
    pool
      .filter((c) => c.skillCode === code)
      .sort((a, b) => a.answered - b.answered || a.id.localeCompare(b.id)),
  );
  const picked: string[] = [];
  while (picked.length < count && queues.some((q) => q.length))
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < count) picked.push(next.id);
    }
  return picked;
}
