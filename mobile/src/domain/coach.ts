import { learningState, type Attempt } from './engine';
import type { Pack } from './types';

/**
 * One line of advice for a Learner, from their Mastery alone. No network and no
 * model: the same Attempts always give the same words.
 */
export function coach(packs: Pack[], log: Attempt[]): string {
  const lessons = packs.flatMap((p) => p.lessons);
  if (!lessons.length) return 'Download a Content Pack to start practising.';
  if (!log.length) return 'Pick any Lesson to begin. I will learn what you need as you go.';
  const title = (skillId: string) => lessons.find((l) => l.skillCode === skillId)?.title ?? skillId;
  const open = learningState(packs, log).skills.filter((s) => !s.mastered);
  if (!open.length) return 'Every Skill is Mastered. Great work!';
  const stuck = open.find((s) => s.plateau);
  if (stuck) return `${title(stuck.skillId)} is tricky. Open Hints, then try it again.`;
  const weakest = open.reduce((a, b) => (b.mastery < a.mastery ? b : a));
  return `Practise ${title(weakest.skillId)} next: Mastery is ${Math.round(weakest.mastery * 100)}%.`;
}
