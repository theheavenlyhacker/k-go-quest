import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Attempt,
  AuditEvent,
  Classroom,
  Enrollment,
  GrowthSnapshot,
  Role,
  School,
  SkillProgress,
  User,
} from '../../database/entities';
import { ScopeService } from '../../common/scope.service';
import type { Principal } from '../../common/security';
import type { PaginationDto } from '../../common/pagination.dto';
import {
  manilaDay,
  manilaMonth,
  manilaQuarter,
  manilaStreak,
  quarterDateRange,
} from '../learning/mastery';

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
  ) {}
  async classroom(actor: Principal, id: string) {
    await this.scope.classroom(actor, id);
    const memberships = await this.db
      .getRepository(Enrollment)
      .findBy({ classroomId: id, active: true });
    const learners = [];
    for (const member of memberships) {
      const student = await this.db
        .getRepository(User)
        .findOneBy({ id: member.studentId, active: true });
      if (!student) continue;
      const skills = await this.db
        .getRepository(SkillProgress)
        .findBy({ studentId: student.id });
      const lastAttempt = await this.db.getRepository(Attempt).findOne({
        where: { studentId: student.id },
        order: { receivedAt: 'DESC' },
      });
      // Counted Attempts: the first Attempt at each Exercise.
      const attempts = await this.db.getRepository(Attempt).find({
        select: { exerciseId: true, occurredAt: true },
        where: { studentId: student.id },
        order: { occurredAt: 'ASC', id: 'ASC' },
      });
      const counted = new Map<string, Date>();
      for (const a of attempts)
        if (!counted.has(a.exerciseId)) counted.set(a.exerciseId, a.occurredAt);
      const stale =
        !lastAttempt ||
        Date.now() - lastAttempt.receivedAt.getTime() > 7 * 86400000;
      const practiceConcern = skills.some(
        (s) => s.attempts >= 5 && s.mastery < 0.4,
      );
      learners.push({
        id: student.id,
        alias: student.alias,
        skills,
        lastSyncAt: lastAttempt?.receivedAt ?? null,
        lastPracticeAt: attempts.at(-1)?.occurredAt ?? null,
        streak: manilaStreak([...counted.values()], new Date()),
        subjects: [...new Set(skills.map((s) => s.subject))]
          .sort()
          .map((subject) => {
            const own = skills.filter((s) => s.subject === subject);
            return {
              subject,
              mastery: own.reduce((sum, s) => sum + s.mastery, 0) / own.length,
            };
          }),
        connectivityStatus: stale ? 'NO_RECENT_SYNC' : 'RECENT_SYNC',
        learningStatus: !skills.length
          ? 'INSUFFICIENT_DATA'
          : practiceConcern
            ? 'TEACHER_REVIEW_SUGGESTED'
            : 'NO_RULE_TRIGGERED',
        reason: practiceConcern
          ? 'At least five distinct exercises in a skill, with estimated mastery below 40%'
          : null,
      });
    }
    return {
      classroomId: id,
      learners,
      decisionPolicy:
        'Supplementary rule-based signals; teacher decides next action',
    };
  }
  async impact(actor: Principal, quarter?: string) {
    const targetQuarter = quarter ?? manilaQuarter(new Date());
    const { start, end } = quarterDateRange(targetQuarter);

    const schools = await this.db
      .getRepository(School)
      .findBy({ jurisdictionId: actor.jurisdictionId });
    const students = await this.db.getRepository(User).findBy({
      jurisdictionId: actor.jurisdictionId,
      role: Role.STUDENT,
      active: true,
    });
    const ids = students.map((s) => s.id);
    const skills = ids.length
      ? await this.db
          .getRepository(SkillProgress)
          .findBy({ studentId: In(ids) })
      : [];
    const participants = new Set(skills.map((s) => s.studentId));
    const perLearner = ids
      .filter((id) => participants.has(id))
      .map((id) => {
        const values = skills.filter((s) => s.studentId === id);
        return values.reduce((sum, s) => sum + s.mastery, 0) / values.length;
      });

    const [attemptStats, completedRows, barangayLearners] = await Promise.all([
      this.db.query(
        `SELECT
           COUNT(DISTINCT a."studentId") AS learners_reached,
           COUNT(*) AS total_attempts,
           COUNT(*) FILTER (WHERE a."receivedAt" - a."occurredAt" > interval '1 hour') AS offline_attempts
         FROM attempts a
         JOIN users u ON u.id = a."studentId"
         WHERE u."jurisdictionId" = $1
           AND u.role = $2
           AND a."occurredAt" >= $3
           AND a."occurredAt" < $4`,
        [actor.jurisdictionId, Role.STUDENT, start, end],
      ),
      this.db.query(
        `SELECT
           a."studentId",
           s.barangay,
           l.id AS "lessonId",
           BOOL_OR(a."receivedAt" - a."occurredAt" > interval '1 hour') AS is_offline
         FROM attempts a
         JOIN users u ON u.id = a."studentId"
         JOIN schools s ON s.id = u."schoolId"
         JOIN exercises e ON e.id = a."exerciseId"
         JOIN lessons l ON l.id = e."lessonId"
         JOIN content_packs p ON p.id = l."packId"
         JOIN (
           SELECT "lessonId", COUNT(*) AS total_exercises
           FROM exercises
           GROUP BY "lessonId"
         ) ex_counts ON ex_counts."lessonId" = l.id
         WHERE u."jurisdictionId" = $1
           AND p."jurisdictionId" = $1
           AND u.role = $2
           AND a."occurredAt" >= $3
           AND a."occurredAt" < $4
         GROUP BY a."studentId", s.barangay, l.id, ex_counts.total_exercises
         HAVING COUNT(DISTINCT a."exerciseId") = ex_counts.total_exercises`,
        [actor.jurisdictionId, Role.STUDENT, start, end],
      ),
      this.db.query(
        `SELECT
           s.barangay,
           COUNT(DISTINCT a."studentId") AS learners
         FROM attempts a
         JOIN users u ON u.id = a."studentId"
         JOIN schools s ON s.id = u."schoolId"
         WHERE u."jurisdictionId" = $1
           AND u.role = $2
           AND a."occurredAt" >= $3
           AND a."occurredAt" < $4
         GROUP BY s.barangay`,
        [actor.jurisdictionId, Role.STUDENT, start, end],
      ),
    ]);

    const totalAttempts = Number(attemptStats[0]?.total_attempts ?? 0);
    const offlineAttempts = Number(attemptStats[0]?.offline_attempts ?? 0);
    const offlineUsageShare = totalAttempts
      ? Number((offlineAttempts / totalAttempts).toFixed(4))
      : 0;

    const reachByBarangay = barangayLearners
      .map((row: { barangay: string; learners: string | number }) => {
        const bName = row.barangay || 'Unknown';
        const bLessons = completedRows.filter(
          (r: { barangay: string; is_offline: boolean }) =>
            (r.barangay || 'Unknown') === bName,
        );
        return {
          barangay: bName,
          learners: Number(row.learners),
          lessons: bLessons.length,
          offlineLessons: bLessons.filter(
            (r: { is_offline: boolean }) => r.is_offline,
          ).length,
        };
      })
      .sort(
        (a: { learners: number; barangay: string }, b: { learners: number; barangay: string }) =>
          b.learners - a.learners || a.barangay.localeCompare(b.barangay),
      );

    return {
      jurisdictionId: actor.jurisdictionId,
      generatedAt: new Date().toISOString(),
      schools: schools.length,
      activeStudents: students.length,
      studentsWithPractice: participants.size,
      meanEstimatedMastery: perLearner.length
        ? perLearner.reduce((s, v) => s + v, 0) / perLearner.length
        : null,
      attempts: skills.reduce((s, p) => s + p.attempts, 0),
      disclaimer:
        'Practice estimates, not measured learning impact. No cost or hours-saved claims are inferred.',
      quarter: targetQuarter,
      learnersReached: Number(attemptStats[0]?.learners_reached ?? 0),
      lessonsCompleted: completedRows.length,
      offlineUsageShare,
      reachByBarangay,
    };
  }
  async engagement(actor: Principal, days: number = 7) {
    const todayStr = manilaDay(new Date());
    const midnightToday = new Date(`${todayStr}T00:00:00+08:00`).getTime();
    const dateStrings: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const ms = midnightToday - i * 86_400_000;
      dateStrings.push(manilaDay(new Date(ms + 43_200_000)));
    }
    const startDate = new Date(`${dateStrings[0]}T00:00:00+08:00`);
    const endDate = new Date(midnightToday + 86_400_000);

    const rows = await this.db.query(
      `SELECT
         TO_CHAR(a."occurredAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day,
         COUNT(DISTINCT a."studentId") AS learners
       FROM attempts a
       JOIN users u ON u.id = a."studentId"
       WHERE u."jurisdictionId" = $1
         AND u.role = $2
         AND a."occurredAt" >= $3
         AND a."occurredAt" < $4
       GROUP BY day`,
      [actor.jurisdictionId, Role.STUDENT, startDate, endDate],
    );

    const countByDay = new Map(
      rows.map((r: { day: string; learners: string | number }) => [
        r.day,
        Number(r.learners),
      ]),
    );

    return dateStrings.map((date) => ({
      date,
      activeLearners: countByDay.get(date) ?? 0,
    }));
  }
  async league(actor: Principal, month: string = manilaMonth(new Date())) {
    const schools = await this.db
      .getRepository(School)
      .findBy({ jurisdictionId: actor.jurisdictionId });
    const classrooms = schools.length
      ? await this.db
          .getRepository(Classroom)
          .findBy({ schoolId: In(schools.map((s) => s.id)) })
      : [];
    const rows = [];
    for (const classroom of classrooms) {
      const members = await this.db
        .getRepository(Enrollment)
        .findBy({ classroomId: classroom.id, active: true });
      const snapshots = await this.db
        .getRepository(GrowthSnapshot)
        .findBy({ classroomId: classroom.id, month });
      const deltas = members.map((e) => {
        const skills = snapshots.filter((s) => s.studentId === e.studentId);
        return skills.length
          ? (skills.reduce((sum, s) => sum + s.latest - s.baseline, 0) /
              skills.length) *
              100
          : 0;
      });
      rows.push({
        classroomId: classroom.id,
        name: classroom.name,
        grade: classroom.grade,
        enrolledLearners: members.length,
        participatingLearners: members.filter((e) =>
          snapshots.some((s) => s.studentId === e.studentId),
        ).length,
        growthPercentagePoints: deltas.length
          ? Number(
              (deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(2),
            )
          : 0,
      });
    }
    rows.sort(
      (a, b) =>
        b.growthPercentagePoints - a.growthPercentagePoints ||
        a.classroomId.localeCompare(b.classroomId),
    );
    return {
      month,
      timezone: 'Asia/Manila',
      metric: 'MEAN_ESTIMATED_MASTERY_CHANGE',
      policy:
        'Mean skill change per learner, averaged across enrolled learners; missing practice counts as zero. Prototype metric, not a validated fairness guarantee.',
      items: rows.map((r, i) => ({ rank: i + 1, ...r })),
    };
  }
  async audit(actor: Principal, query: PaginationDto) {
    const [items, total] = await this.db
      .getRepository(AuditEvent)
      .findAndCount({
        where: { jurisdictionId: actor.jurisdictionId },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: query.skip,
        take: query.limit,
      });
    return { items, total, page: query.page, limit: query.limit };
  }
}
