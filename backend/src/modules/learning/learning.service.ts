import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Attempt,
  Classroom,
  ContentPack,
  Enrollment,
  Exercise,
  GrowthSnapshot,
  Lesson,
  ModelVersion,
  SkillModelParams,
  SkillProgress,
  User,
} from '../../database/entities';
import { ScopeService } from '../../common/scope.service';
import type { Principal } from '../../common/security';
import { AuditService } from '../../common/audit.service';
import type { SyncDto } from './sync.dto';
import { type BktParams, DEFAULT_PARAMS, manilaMonth, MASTERY_MODEL, updateMastery } from './mastery';

@Injectable()
export class LearningService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}
  async sync(actor: Principal, dto: SyncDto) {
    const now = new Date();
    return this.db.transaction(async (manager) => {
      // One row serializes wallet changes, sync retries, and redemptions for this learner.
      const student = await manager.findOneOrFail(User, {
        where: { id: actor.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student.active) throw new ForbiddenException();
      // One lookup for the whole batch; skills with no fitted row score on the defaults.
      const model = await manager.findOneBy(ModelVersion, { active: true });
      const tuned = new Map<string, BktParams>(
        (model
          ? await manager.findBy(SkillModelParams, { modelVersion: model.version })
          : []
        ).map((row) => [
          row.skillCode,
          { prior: row.prior, learn: row.learn, guess: row.guess, slip: row.slip },
        ]),
      );
      const results: {
        clientAttemptId: string;
        correct: boolean;
        awardedCoins: number;
        duplicate: boolean;
      }[] = [];
      let awardedCoins = 0;
      for (const input of dto.attempts) {
        const occurredAt = new Date(input.occurredAt);
        const old = await manager.findOneBy(Attempt, {
          studentId: actor.id,
          clientAttemptId: input.clientAttemptId,
        });
        if (old) {
          if (
            old.exerciseId !== input.exerciseId ||
            old.selectedOption !== input.selectedOption ||
            old.classroomId !== input.classroomId ||
            old.occurredAt.getTime() !== occurredAt.getTime()
          )
            throw new ConflictException(
              'Attempt ID was already used for a different payload',
            );
          results.push({
            clientAttemptId: old.clientAttemptId,
            correct: old.correct,
            awardedCoins: old.awardedCoins,
            duplicate: true,
          });
          continue;
        }
        // A lost acknowledgment remains retryable even after the upload window
        // closes or enrollment changes. Only NEW events need current eligibility.
        await this.scope.classroom(actor, input.classroomId);
        if (
          occurredAt > new Date(now.getTime() + 5 * 60000) ||
          occurredAt < new Date(now.getTime() - 30 * 86400000)
        )
          throw new BadRequestException(
            'Attempt must be within 30 days and no more than 5 minutes in the future',
          );
        const exercise = await manager.findOne(Exercise, {
          where: { id: input.exerciseId },
          select: {
            id: true,
            lessonId: true,
            options: true,
            correctOption: true,
            coinAward: true,
          },
        });
        if (!exercise) throw new NotFoundException('Exercise not found');
        if (input.selectedOption >= exercise.options.length)
          throw new BadRequestException('Selected option does not exist');
        const lesson = await manager.findOneByOrFail(Lesson, {
          id: exercise.lessonId,
        });
        const pack = await manager.findOneBy(ContentPack, {
          id: lesson.packId,
          published: true,
          jurisdictionId: actor.jurisdictionId,
        });
        if (!pack) throw new BadRequestException('Exercise is not published');
        const classroom = await manager.findOneByOrFail(Classroom, {
          id: input.classroomId,
        });
        const enrollment = await manager.findOneBy(Enrollment, {
          studentId: actor.id,
          classroomId: input.classroomId,
          active: true,
        });
        if (!enrollment || student.schoolId !== classroom.schoolId)
          throw new ForbiddenException();
        if (pack.grade !== classroom.grade)
          throw new BadRequestException(
            'Exercise grade must match classroom grade',
          );
        if (occurredAt.getTime() + 5 * 60000 < enrollment.createdAt.getTime())
          throw new BadRequestException('Attempt predates enrollment');
        // A new client ID cannot farm either mastery or coins from the same exercise.
        const previouslyCompleted = await manager.existsBy(Attempt, {
          studentId: actor.id,
          exerciseId: exercise.id,
        });
        const correct = input.selectedOption === exercise.correctOption;
        const coins = correct && !previouslyCompleted ? exercise.coinAward : 0;
        const attempt = manager.create(Attempt, {
          clientAttemptId: input.clientAttemptId,
          classroomId: input.classroomId,
          exerciseId: input.exerciseId,
          selectedOption: input.selectedOption,
          occurredAt,
          studentId: actor.id,
          skillCode: lesson.skillCode,
          subject: pack.subject,
          correct,
          awardedCoins: coins,
          receivedAt: now,
        });
        await manager.save(attempt);
        if (!previouslyCompleted) {
          const params = tuned.get(lesson.skillCode) ?? DEFAULT_PARAMS;
          const progress =
            (await manager.findOneBy(SkillProgress, {
              studentId: actor.id,
              skillCode: lesson.skillCode,
            })) ??
            manager.create(SkillProgress, {
              studentId: actor.id,
              skillCode: lesson.skillCode,
              subject: pack.subject,
              mastery: params.prior,
              attempts: 0,
              correctAttempts: 0,
            });
          const prior = progress.mastery;
          progress.mastery = updateMastery(prior, correct, params);
          progress.attempts += 1;
          progress.correctAttempts += Number(correct);
          await manager.save(progress);
          // Server receipt time chooses season; client timestamps are untrusted.
          const month = manilaMonth(now);
          const growth =
            (await manager.findOneBy(GrowthSnapshot, {
              studentId: actor.id,
              skillCode: lesson.skillCode,
              month,
            })) ??
            manager.create(GrowthSnapshot, {
              studentId: actor.id,
              classroomId: classroom.id,
              skillCode: lesson.skillCode,
              month,
              baseline: prior,
            });
          growth.latest = progress.mastery;
          await manager.save(growth);
        }
        awardedCoins += coins;
        results.push({
          clientAttemptId: input.clientAttemptId,
          correct,
          awardedCoins: coins,
          duplicate: false,
        });
      }
      student.coins += awardedCoins;
      await manager.save(student);
      await this.audit.record(actor, 'PROGRESS_SYNCED', actor.id, manager, {
        accepted: results.filter((a) => !a.duplicate).length,
        awardedCoins,
      });
      return {
        results,
        awardedCoins,
        coinBalance: student.coins,
        serverTime: now.toISOString(),
        modelVersion: model?.version ?? MASTERY_MODEL.version,
      };
    });
  }
  private async activeModel() {
    return this.db.getRepository(ModelVersion).findOneBy({ active: true });
  }
  async activeModelParameters() {
    const model = await this.activeModel();
    if (!model) {
      throw new NotFoundException('No active model');
    }
    const rows = await this.db
      .getRepository(SkillModelParams)
      .findBy({ modelVersion: model.version });
    const parameters: Record<
      string,
      { prior: number; learn: number; guess: number; slip: number }
    > = {};
    for (const row of rows) {
      parameters[row.skillCode] = {
        prior: row.prior,
        learn: row.learn,
        guess: row.guess,
        slip: row.slip,
      };
    }
    return {
      version: model.version,
      source: model.source,
      method: model.method,
      fittedAt: model.fittedAt.toISOString(),
      parameters,
      skills: parameters,
    };
  }
  async progress(actor: Principal, id: string) {
    const student = await this.scope.student(actor, id);
    const model = await this.activeModel();
    const skills = await this.db.getRepository(SkillProgress).find({
      where: { studentId: id },
      order: { subject: 'ASC', skillCode: 'ASC' },
    });
    const lastAttempt = await this.db.getRepository(Attempt).findOne({
      where: { studentId: id },
      order: { receivedAt: 'DESC', id: 'DESC' },
    });
    return {
      studentId: id,
      coinBalance: student.coins,
      skills,
      lastSyncAt: lastAttempt?.receivedAt ?? null,
      model: model ? { ...MASTERY_MODEL, version: model.version, fittedAt: model.fittedAt, status: 'FITTED_ESTIMATE' } : { ...MASTERY_MODEL, status: 'PROTOTYPE_ESTIMATE' },
      learningStatus: skills.length ? 'HAS_PRACTICE_DATA' : 'INSUFFICIENT_DATA',
    };
  }
  async quests(actor: Principal) {
    const memberships = await this.db
      .getRepository(Enrollment)
      .findBy({ studentId: actor.id, active: true });
    const classrooms = memberships.length
      ? await this.db
          .getRepository(Classroom)
          .findBy({ id: In(memberships.map((e) => e.classroomId)) })
      : [];
    const grades = [...new Set(classrooms.map((c) => c.grade))];
    if (!grades.length)
      return { items: [], modelVersion: MASTERY_MODEL.version };
    const skills = await this.db
      .getRepository(SkillProgress)
      .findBy({ studentId: actor.id });
    const attempts = await this.db
      .getRepository(Attempt)
      .find({ where: { studentId: actor.id }, select: { exerciseId: true } });
    const completed = new Set(attempts.map((a) => a.exerciseId));
    const exercises = await this.db
      .getRepository(Exercise)
      .createQueryBuilder('e')
      .innerJoin(Lesson, 'l', 'l.id = e.lessonId')
      .innerJoin(ContentPack, 'p', 'p.id = l.packId')
      .where(
        'p.published = true AND p.grade IN (:...grades) AND p.jurisdictionId = :jurisdictionId',
        { grades, jurisdictionId: actor.jurisdictionId },
      )
      .select([
        'e.id AS "exerciseId"',
        'e.prompt AS "prompt"',
        'e.options AS "options"',
        'l.skillCode AS "skillCode"',
        'p.subject AS "subject"',
        'p.grade AS "grade"',
      ])
      .getRawMany<{
        exerciseId: string;
        prompt: string;
        options: string[];
        skillCode: string;
        subject: string;
        grade: number;
      }>();
    const items = exercises
      .filter((e) => !completed.has(e.exerciseId))
      .map((e) => ({
        ...e,
        estimatedMastery:
          skills.find((s) => s.skillCode === e.skillCode)?.mastery ??
          MASTERY_MODEL.initial,
        classroomId: classrooms.find((c) => c.grade === e.grade)!.id,
      }))
      .sort(
        (a, b) =>
          a.estimatedMastery - b.estimatedMastery ||
          a.exerciseId.localeCompare(b.exerciseId),
      )
      .slice(0, 5);
    return {
      items,
      modelVersion: MASTERY_MODEL.version,
      reason:
        'Unattempted exercises in skills with the lowest estimated mastery',
    };
  }
}
