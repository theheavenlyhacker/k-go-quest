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
  /** ISO time the Learner last answered anything, or null. */
  lastPracticeAt: string | null;
  /** Consecutive Manila days with a Counted Attempt. */
  streak: number;
  /** Mean Mastery per Subject. */
  subjects: { subject: Subject; mastery: number }[];
  connectivityStatus: 'RECENT_SYNC' | 'NO_RECENT_SYNC';
  learningStatus: 'INSUFFICIENT_DATA' | 'TEACHER_REVIEW_SUGGESTED' | 'NO_RULE_TRIGGERED';
  reason: string | null;
}

export interface ClassroomReport { classroomId: string; learners: ReportLearner[]; decisionPolicy: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, what: string) => { if (typeof value !== 'string') throw new Error(`Classroom report: ${what} is not text.`); return value; };
const num = (value: unknown, what: string) => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Classroom report: ${what} is not a number.`); return value; };
const time = (value: unknown, what: string) => (value === null ? null : text(value, what));
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], what: string): T => {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new Error(`Classroom report: ${what} is not one of ${allowed.join(', ')}.`);
  return value as T;
};
const list = (value: unknown, what: string): unknown[] => { if (!Array.isArray(value)) throw new Error(`Classroom report: ${what} is not a list.`); return value; };
const record = (value: unknown, what: string): Record<string, unknown> => { if (!isRecord(value)) throw new Error(`Classroom report: ${what} is not an object.`); return value; };

function parseSkill(raw: unknown, where: string): ReportSkill {
  const r = record(raw, where);
  return {
    skillCode: text(r.skillCode, `${where}.skillCode`), subject: oneOf(r.subject, subjects, `${where}.subject`),
    mastery: num(r.mastery, `${where}.mastery`), attempts: num(r.attempts, `${where}.attempts`), correctAttempts: num(r.correctAttempts, `${where}.correctAttempts`),
  };
}

/** Per-Skill rows of `GET learning/learners/:id/progress`. */
export const parseProgressSkills = (raw: unknown): ReportSkill[] =>
  list(record(raw, 'progress').skills, 'progress.skills').map((skill, i) => parseSkill(skill, `progress.skills[${i}]`));

/**
 * Checks a `GET reports/classrooms/:id` body and keeps only what the screens use.
 * Strict on purpose: if the server's shape drifts, the Teacher sees an error (or
 * their cached report) and the contract test fails, rather than a screen quietly
 * showing wrong numbers.
 */
export function parseClassroomReport(raw: unknown): ClassroomReport {
  const r = record(raw, 'report');
  return {
    classroomId: text(r.classroomId, 'classroomId'),
    decisionPolicy: text(r.decisionPolicy, 'decisionPolicy'),
    learners: list(r.learners, 'learners').map((entry, i) => {
      const where = `learners[${i}]`;
      const l = record(entry, where);
      return {
        id: text(l.id, `${where}.id`), alias: text(l.alias, `${where}.alias`),
        skills: list(l.skills, `${where}.skills`).map((skill, j) => parseSkill(skill, `${where}.skills[${j}]`)),
        lastSyncAt: time(l.lastSyncAt, `${where}.lastSyncAt`), lastPracticeAt: time(l.lastPracticeAt, `${where}.lastPracticeAt`),
        streak: num(l.streak, `${where}.streak`),
        subjects: list(l.subjects, `${where}.subjects`).map((row, j) => {
          const s = record(row, `${where}.subjects[${j}]`);
          return { subject: oneOf(s.subject, subjects, `${where}.subjects[${j}].subject`), mastery: num(s.mastery, `${where}.subjects[${j}].mastery`) };
        }),
        connectivityStatus: oneOf(l.connectivityStatus, ['RECENT_SYNC', 'NO_RECENT_SYNC'], `${where}.connectivityStatus`),
        learningStatus: oneOf(l.learningStatus, ['INSUFFICIENT_DATA', 'TEACHER_REVIEW_SUGGESTED', 'NO_RULE_TRIGGERED'], `${where}.learningStatus`),
        reason: l.reason === null ? null : text(l.reason, `${where}.reason`),
      };
    }),
  };
}

export interface SuggestedGroupLearner { id: string; alias: string }

export interface SuggestedGroup {
  skillCode: string;
  skillTitle: string;
  subject: Subject;
  learners: SuggestedGroupLearner[];
  count: number;
}

export interface ClassroomSuggestions {
  classroomId: string;
  method: 'model' | 'fallback';
  groups: SuggestedGroup[];
  decisionPolicy: string;
}

export function parseClassroomSuggestions(raw: unknown): ClassroomSuggestions {
  const r = record(raw, 'suggestions');
  return {
    classroomId: text(r.classroomId, 'classroomId'),
    method: oneOf(r.method, ['model', 'fallback'] as const, 'method'),
    decisionPolicy: text(r.decisionPolicy, 'decisionPolicy'),
    groups: list(r.groups, 'groups').map((item, i) => {
      const where = `groups[${i}]`;
      const g = record(item, where);
      return {
        skillCode: text(g.skillCode, `${where}.skillCode`),
        skillTitle: text(g.skillTitle, `${where}.skillTitle`),
        subject: oneOf(g.subject, subjects, `${where}.subject`),
        count: num(g.count, `${where}.count`),
        learners: list(g.learners, `${where}.learners`).map((l, j) => {
          const lwhere = `${where}.learners[${j}]`;
          const learner = record(l, lwhere);
          return {
            id: text(learner.id, `${lwhere}.id`),
            alias: text(learner.alias, `${lwhere}.alias`),
          };
        }),
      };
    }),
  };
}

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
  /** Consecutive days with a Counted Attempt; 0 means none. */
  streak: number;
  /** ISO time of the Learner's last practice, or null. */
  lastPracticeAt: string | null;
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

const summary = (learner: ReportLearner, grade: number, now: number): InsightLearner => ({
  id: learner.id, alias: learner.alias, grade, streak: learner.streak, lastPracticeAt: learner.lastPracticeAt,
  mastery: meanMastery(learner.skills), attention: attentionReason(learner, now),
});

/** Student Insights: Needs attention (report order) and All Learners (by alias). Aliases only, never legal names. */
export function insights(report: ClassroomReport, grade: number, now: number): Insights {
  const all = report.learners.map((learner) => summary(learner, grade, now));
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

/** `progress` is the Learner's own per-Skill Mastery from the server; without it the report's Skills are shown. */
export function learnerDetail(report: ClassroomReport, id: string, grade: number, now: number, progress?: ReportSkill[]): LearnerDetail | null {
  const learner = report.learners.find((item) => item.id === id);
  if (!learner) return null;
  const skills = [...(progress ?? learner.skills)].sort((a, b) => a.mastery - b.mastery).map((skill) => ({
    code: skill.skillCode, label: skillLabel(skill.skillCode), subjectTitle: subjectTitles[skill.subject], mastery: skill.mastery, attempts: skill.attempts,
  }));
  const base = summary(learner, grade, now);
  return { ...base, mastery: progress ? meanMastery(progress) : base.mastery, skills };
}

export type AlertPriority = 'high' | 'medium' | 'low';
export interface TeacherAlert { id: string; learnerId: string; priority: AlertPriority; title: string; description: string; at: string | null; relative: string }
export interface AlertsView { tiles: { open: number; resolved: number; high: number }; open: TeacherAlert[] }

const LONG_INACTIVE_DAYS = 14;
const RESOLVED_WINDOW_DAYS = 7;
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
  const resolvedRecently = Object.values(resolved).filter((time) => now - Date.parse(time) <= RESOLVED_WINDOW_DAYS * DAY).length;
  return { tiles: { open: open.length, resolved: resolvedRecently, high: open.filter((a) => a.priority === 'high').length }, open };
}
