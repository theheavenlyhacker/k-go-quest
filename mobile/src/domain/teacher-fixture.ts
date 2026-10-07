import type { ServerClassroom } from './server';
import type { ClassroomReport, ReportLearner, ReportSkill } from './teacher';

/** Fixture data for the Teacher shell: the default source until the live wiring lands. */

const skill = (skillCode: string, subject: ReportSkill['subject'], mastery: number, attempts = 6): ReportSkill =>
  ({ skillCode, subject, mastery, attempts, correctAttempts: Math.round(attempts * mastery) });

const learner = (id: string, alias: string, skills: ReportSkill[], lastSyncAt: string | null, flagged = false): ReportLearner => ({
  id, alias, skills, lastSyncAt,
  connectivityStatus: lastSyncAt && lastSyncAt >= '2026-10-01' ? 'RECENT_SYNC' : 'NO_RECENT_SYNC',
  learningStatus: !skills.length ? 'INSUFFICIENT_DATA' : flagged ? 'TEACHER_REVIEW_SUGGESTED' : 'NO_RULE_TRIGGERED',
  reason: flagged ? 'At least five distinct exercises in a skill, with estimated mastery below 40%' : null,
});

export const classroomFixture: ServerClassroom = {
  id: '7f0c1a52-0000-4000-8000-000000000001', name: 'Sampaguita', grade: 5, teacherId: '7f0c1a52-0000-4000-8000-0000000000a1', schoolId: '7f0c1a52-0000-4000-8000-0000000000b1',
};

export const classroomReportFixture: ClassroomReport = {
  classroomId: classroomFixture.id,
  learners: [
    learner('l1', 'Juanita', [skill('math5.fractions.equivalent', 'MATH', 0.92), skill('english5.reading.main-idea', 'ENGLISH', 0.88)], '2026-10-06T09:00:00.000Z'),
    learner('l2', 'Miguel', [skill('math5.fractions.equivalent', 'MATH', 0.74), skill('english5.reading.main-idea', 'ENGLISH', 0.66)], '2026-10-05T09:00:00.000Z'),
    learner('l3', 'Ana', [skill('math5.fractions.add', 'MATH', 0.31, 8), skill('english5.reading.main-idea', 'ENGLISH', 0.62)], '2026-10-06T09:00:00.000Z', true),
    learner('l4', 'Paolo', [skill('math5.fractions.equivalent', 'MATH', 0.7)], '2026-09-20T09:00:00.000Z'),
    learner('l5', 'Liza', [], null),
  ],
  decisionPolicy: 'Supplementary rule-based signals; teacher decides next action',
};

/** Fixture-only: Impact Points, class count and Learner streaks have no backend concept yet (see #31). */
export const teacherExtrasFixture = { impactPoints: 2450, classCount: 3, streaks: { l1: 12, l2: 5, l3: 2, l4: 0 } as Record<string, number> };
