import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Attempt,
  AuditEvent,
  Classroom,
  ContentPack,
  Enrollment,
  GrowthSnapshot,
  Lesson,
  Role,
  School,
  SkillProgress,
  Subject,
  User,
} from '../../database/entities';
import { ScopeService } from '../../common/scope.service';
import type { Principal } from '../../common/security';
import type { PaginationDto } from '../../common/pagination.dto';
import { manilaMonth, manilaStreak } from '../learning/mastery';
import {
  formatSkillTitle,
  groupLearnersByTopSkill,
  lowestNonMasteredSkill,
  type LearnerInput,
  type SuggestionsResult,
} from './suggestions';

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
  async suggestions(actor: Principal, id: string): Promise<SuggestionsResult> {
    await this.scope.classroom(actor, id);
    const memberships = await this.db
      .getRepository(Enrollment)
      .findBy({ classroomId: id, active: true });

    const learnersWithSkills: LearnerInput[] = [];
    const allSkillCodes = new Set<string>();

    for (const member of memberships) {
      const student = await this.db
        .getRepository(User)
        .findOneBy({ id: member.studentId, active: true });
      if (!student) continue;
      const skills = await this.db
        .getRepository(SkillProgress)
        .findBy({ studentId: student.id });
      for (const s of skills) allSkillCodes.add(s.skillCode);
      learnersWithSkills.push({
        id: student.id,
        alias: student.alias,
        skills: skills.map((s) => ({
          skillCode: s.skillCode,
          mastery: s.mastery,
          subject: s.subject,
        })),
      });
    }

    const skillMetadata = new Map<string, { title: string; subject: Subject }>();
    if (allSkillCodes.size > 0) {
      const lessons = await this.db
        .getRepository(Lesson)
        .createQueryBuilder('l')
        .innerJoin(ContentPack, 'p', 'p.id = l.packId')
        .where('l.skillCode IN (:...codes)', { codes: Array.from(allSkillCodes) })
        .andWhere('p.jurisdictionId = :jurisdictionId', {
          jurisdictionId: actor.jurisdictionId,
        })
        .select([
          'l.skillCode AS "skillCode"',
          'l.title AS "title"',
          'p.subject AS "subject"',
        ])
        .getRawMany<{ skillCode: string; title: string; subject: Subject }>();

      for (const l of lessons) {
        skillMetadata.set(l.skillCode, { title: l.title, subject: l.subject });
      }
      for (const learner of learnersWithSkills) {
        for (const s of learner.skills) {
          if (!skillMetadata.has(s.skillCode) && s.subject) {
            skillMetadata.set(s.skillCode, {
              title: formatSkillTitle(s.skillCode),
              subject: s.subject,
            });
          }
        }
      }
    }

    const mlUrl = process.env.ML_SERVICE_URL?.trim();
    const mlToken = (
      process.env.ML_SERVICE_TOKEN ||
      process.env.KGO_ML_TOKEN ||
      ''
    ).trim();

    let method: 'model' | 'fallback' = 'fallback';
    const learnerTopSkills: {
      id: string;
      alias: string;
      topSkill: string | null;
    }[] = [];

    if (mlUrl) {
      try {
        const topSkills = await Promise.all(
          learnersWithSkills.map(async (learner) => {
            if (!learner.skills.length)
              return { id: learner.id, alias: learner.alias, topSkill: null };
            const payload = {
              skills: learner.skills.map((s) => ({
                skillCode: s.skillCode,
                mastery: s.mastery,
              })),
              limit: 1,
            };
            const res = await fetch(`${mlUrl.replace(/\/+$/, '')}/recommend`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(mlToken ? { Authorization: `Bearer ${mlToken}` } : {}),
              },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(3000),
            });
            if (!res.ok)
              throw new Error(`ML service responded with ${res.status}`);
            const data = (await res.json()) as { skillCode: string }[];
            return {
              id: learner.id,
              alias: learner.alias,
              topSkill: data[0]?.skillCode ?? null,
            };
          }),
        );
        method = 'model';
        learnerTopSkills.push(...topSkills);
      } catch {
        method = 'fallback';
        learnerTopSkills.length = 0;
      }
    }

    if (method === 'fallback') {
      for (const learner of learnersWithSkills) {
        learnerTopSkills.push({
          id: learner.id,
          alias: learner.alias,
          topSkill: lowestNonMasteredSkill(learner.skills),
        });
      }
    }

    const groups = groupLearnersByTopSkill(learnerTopSkills, skillMetadata);

    return {
      classroomId: id,
      method,
      groups,
      decisionPolicy:
        'Suggested practice groups; teacher decides next action',
    };
  }
  async impact(actor: Principal) {
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
