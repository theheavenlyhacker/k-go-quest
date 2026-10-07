import { meanMastery } from './format';
import { subjects, subjectTitles } from './subjects';
import type { Subject } from './types';

/**
 * The Teacher shell's view model: pure, with no React, Expo or I/O.
 *
 * Input is the body of `GET reports/classrooms/:id`
 * (`backend/src/modules/reports/reports.service.ts`), which is the shape the
 * fixture in `teacher-fixture.ts` copies, so swapping the fixture for the live
 * call changes no screen.
 */
export interface ReportSkill { skillCode: string; subject: Subject; mastery: number; attempts: number; correctAttempts: number }

export interface ReportLearner {
  id: string;
  alias: string;
  skills: ReportSkill[];
  /** ISO time of the last Attempt the server received, or null if it has none. */
  lastSyncAt: string | null;
  connectivityStatus: 'RECENT_SYNC' | 'NO_RECENT_SYNC';
  learningStatus: 'INSUFFICIENT_DATA' | 'TEACHER_REVIEW_SUGGESTED' | 'NO_RULE_TRIGGERED';
  reason: string | null;
}

export interface ClassroomReport { classroomId: string; learners: ReportLearner[]; decisionPolicy: string }

export interface SubjectBar { subject: Subject; title: string; mastery: number }

export interface ClassOverview {
  tiles: { learners: number; averageMastery: number | null; needHelp: number };
  subjects: SubjectBar[];
  highlight: { alias: string; mastery: number } | null;
}

/** A Learner needs help when a Plateau Flag is raised or the server has not heard from them lately. */
const needsHelp = (learner: ReportLearner) =>
  learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED' || learner.connectivityStatus === 'NO_RECENT_SYNC';

/**
 * Class Overview from a Classroom report.
 *
 * ponytail: the report carries no history, so the highlight is the Learner with
 * the highest Mastery now, not the biggest gain this week. Swap the rule here
 * when the backend reports weekly change; the screen does not care.
 */
export function classOverview(report: ClassroomReport): ClassOverview {
  const means = report.learners
    .map((learner) => ({ alias: learner.alias, mastery: meanMastery(learner.skills) }))
    .filter((entry): entry is { alias: string; mastery: number } => entry.mastery !== null);
  const bars: SubjectBar[] = [];
  for (const subject of subjects) {
    const skills = report.learners.flatMap((learner) => learner.skills.filter((skill) => skill.subject === subject));
    const mastery = meanMastery(skills);
    if (mastery !== null) bars.push({ subject, title: subjectTitles[subject], mastery });
  }
  const top = [...means].sort((a, b) => b.mastery - a.mastery || a.alias.localeCompare(b.alias))[0];
  return {
    tiles: {
      learners: report.learners.length,
      averageMastery: meanMastery(means),
      needHelp: report.learners.filter(needsHelp).length,
    },
    subjects: bars,
    highlight: top ?? null,
  };
}
