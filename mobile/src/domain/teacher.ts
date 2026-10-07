import { ago, meanMastery, pct } from './format';
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

export interface InsightLearner {
  id: string;
  alias: string;
  grade: number;
  /** Fixture-only: the Classroom report carries no streak yet. */
  streak: number | null;
  mastery: number | null;
  /** Why this Learner needs attention, or null. */
  attention: string | null;
}

export interface Insights { needsAttention: InsightLearner[]; all: InsightLearner[] }

const DAY = 86_400_000;
const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).replace(/-/g, ' ');

/** `math5.fractions.equivalent` becomes "Fractions · Equivalent". */
export const skillLabel = (code: string) => code.split('.').slice(1).map(titleCase).join(' · ') || code;

function attentionReason(learner: ReportLearner, now: number): string | null {
  if (learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED') {
    const weakest = [...learner.skills].sort((a, b) => a.mastery - b.mastery)[0];
    return weakest ? `Plateau in ${subjectTitles[weakest.subject]} (${pct(weakest.mastery)})` : 'Plateau Flag raised';
  }
  if (learner.connectivityStatus !== 'NO_RECENT_SYNC') return null;
  if (!learner.lastSyncAt) return 'No sync yet';
  const days = Math.max(1, Math.floor((now - Date.parse(learner.lastSyncAt)) / DAY));
  return `${days} ${days === 1 ? 'day' : 'days'} inactive`;
}

const summary = (learner: ReportLearner, grade: number, streaks: Record<string, number>, now: number): InsightLearner => ({
  id: learner.id, alias: learner.alias, grade, streak: streaks[learner.id] ?? null,
  mastery: meanMastery(learner.skills), attention: attentionReason(learner, now),
});

/** Student Insights: Needs attention (report order) and All Learners (by alias). Aliases only, never legal names. */
export function insights(report: ClassroomReport, grade: number, streaks: Record<string, number>, now: number): Insights {
  const all = report.learners.map((learner) => summary(learner, grade, streaks, now));
  return {
    needsAttention: all.filter((learner) => learner.attention),
    all: [...all].sort((a, b) => a.alias.localeCompare(b.alias)),
  };
}

export const searchLearners = (learners: InsightLearner[], query: string) => {
  const needle = query.trim().toLowerCase();
  return needle ? learners.filter((learner) => learner.alias.toLowerCase().includes(needle)) : learners;
};

export interface LearnerDetail extends InsightLearner {
  skills: { code: string; label: string; subjectTitle: string; mastery: number; attempts: number }[];
}

export function learnerDetail(report: ClassroomReport, id: string, grade: number, streaks: Record<string, number>, now: number): LearnerDetail | null {
  const learner = report.learners.find((item) => item.id === id);
  if (!learner) return null;
  const skills = [...learner.skills].sort((a, b) => a.mastery - b.mastery).map((skill) => ({
    code: skill.skillCode, label: skillLabel(skill.skillCode), subjectTitle: subjectTitles[skill.subject], mastery: skill.mastery, attempts: skill.attempts,
  }));
  return { ...summary(learner, grade, streaks, now), skills };
}

export type AlertPriority = 'high' | 'medium' | 'low';
export interface TeacherAlert { id: string; learnerId: string; priority: AlertPriority; title: string; description: string; at: string | null; relative: string }
export interface AlertsView { tiles: { open: number; resolved: number; high: number }; open: TeacherAlert[] }

const LONG_INACTIVE_DAYS = 14;
const priorityRank: Record<AlertPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Alerts from data the system has: Plateau Flag is high, no recent sync is
 * medium, and no sync for LONG_INACTIVE_DAYS is low (it fades to background
 * noise rather than escalating). `resolved` maps alert id to the ISO time the
 * Teacher resolved it; the dismissal is local to the tablet.
 */
export function alerts(report: ClassroomReport, now: number, resolved: Record<string, string>): AlertsView {
  const all: TeacherAlert[] = [];
  for (const learner of report.learners) {
    const at = learner.lastSyncAt;
    const base = { learnerId: learner.id, at, relative: ago(at, now) };
    if (learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED')
      all.push({ ...base, id: `${learner.id}:plateau`, priority: 'high', title: `Plateau Flag: ${learner.alias}`, description: attentionReason(learner, now) ?? 'Plateau Flag raised' });
    if (learner.connectivityStatus === 'NO_RECENT_SYNC') {
      const long = at != null && now - Date.parse(at) >= LONG_INACTIVE_DAYS * DAY;
      all.push({ ...base, id: `${learner.id}:sync`, priority: long ? 'low' : 'medium', title: `${long ? 'Long inactivity' : at ? 'No recent sync' : 'No sync yet'}: ${learner.alias}`, description: attentionReason(learner, now) ?? '' });
    }
  }
  const open = all.filter((alert) => !resolved[alert.id]).sort((a, b) =>
    priorityRank[a.priority] - priorityRank[b.priority] || Date.parse(b.at ?? '') - Date.parse(a.at ?? '') || 0);
  const resolvedRecently = Object.values(resolved).filter((time) => now - Date.parse(time) <= 7 * DAY).length;
  return { tiles: { open: open.length, resolved: resolvedRecently, high: open.filter((a) => a.priority === 'high').length }, open };
}
