import { Subject } from '../../database/entities';

export interface LearnerSkillInput {
  skillCode: string;
  mastery: number;
  subject?: Subject;
}

export interface LearnerInput {
  id: string;
  alias: string;
  skills: LearnerSkillInput[];
}

export interface SuggestedGroupLearner {
  id: string;
  alias: string;
}

export interface SuggestedGroup {
  skillCode: string;
  skillTitle: string;
  subject: Subject;
  learners: SuggestedGroupLearner[];
  count: number;
}

export interface SuggestionsResult {
  classroomId: string;
  method: 'model' | 'fallback';
  groups: SuggestedGroup[];
  decisionPolicy: string;
}

export const MASTERED_THRESHOLD = 0.95;

/** Format a skill code into a readable fallback title if no Lesson title is available. */
export function formatSkillTitle(skillCode: string): string {
  const parts = skillCode.split('.');
  const last = parts[parts.length - 1] || skillCode;
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pick the lowest non-mastered skill (< 0.95) for a learner.
 * Lowest mastery first, ties broken deterministically by skillCode.
 * Returns null if the learner has no skills or all skills are mastered.
 */
export function lowestNonMasteredSkill(skills: LearnerSkillInput[]): string | null {
  const nonMastered = skills.filter((s) => s.mastery < MASTERED_THRESHOLD);
  if (!nonMastered.length) return null;
  nonMastered.sort(
    (a, b) => a.mastery - b.mastery || a.skillCode.localeCompare(b.skillCode),
  );
  return nonMastered[0].skillCode;
}

/**
 * Group learners by their assigned top skill.
 * Groups are sorted by learner count descending (largest first), then by skillCode ascending.
 * Within each group, learners are sorted by alias ascending, then by id ascending.
 */
export function groupLearnersByTopSkill(
  learners: { id: string; alias: string; topSkill: string | null }[],
  skillMetadata?: Map<string, { title: string; subject: Subject }>,
): SuggestedGroup[] {
  const groupsMap = new Map<string, SuggestedGroupLearner[]>();

  for (const learner of learners) {
    if (!learner.topSkill) continue;
    const existing = groupsMap.get(learner.topSkill) ?? [];
    existing.push({ id: learner.id, alias: learner.alias });
    groupsMap.set(learner.topSkill, existing);
  }

  const groups: SuggestedGroup[] = [];
  for (const [skillCode, groupLearners] of groupsMap.entries()) {
    groupLearners.sort(
      (a, b) => a.alias.localeCompare(b.alias) || a.id.localeCompare(b.id),
    );
    const meta = skillMetadata?.get(skillCode);
    groups.push({
      skillCode,
      skillTitle: meta?.title ?? formatSkillTitle(skillCode),
      subject: meta?.subject ?? Subject.MATH,
      learners: groupLearners,
      count: groupLearners.length,
    });
  }

  groups.sort(
    (a, b) => b.count - a.count || a.skillCode.localeCompare(b.skillCode),
  );
  return groups;
}
