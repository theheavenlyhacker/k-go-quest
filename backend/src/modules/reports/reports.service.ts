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
import { manilaMonth } from '../learning/mastery';

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
      const lastAttempt = await this.db
        .getRepository(Attempt)
        .findOne({
          where: { studentId: student.id },
          order: { receivedAt: 'DESC' },
        });
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
  async impact(actor: Principal) {
    const schools = await this.db
      .getRepository(School)
      .findBy({ jurisdictionId: actor.jurisdictionId });
    const students = await this.db
      .getRepository(User)
      .findBy({
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
    };
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
