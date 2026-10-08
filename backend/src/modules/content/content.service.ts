import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { ContentPack, Exercise, Lesson, Role } from '../../database/entities';
import { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import type {
  ContentQueryDto,
  CreateExerciseDto,
  CreateLessonDto,
  CreatePackDto,
} from './content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditService,
  ) {}
  async list(actor: Principal, query: ContentQueryDto) {
    if (query.status === 'draft' && actor.role !== Role.LGU_ADMIN)
      throw new ForbiddenException(
        'Draft content is available to LGU admins only',
      );
    const [items, total] = await this.db
      .getRepository(ContentPack)
      .findAndCount({
        where: {
          jurisdictionId: actor.jurisdictionId,
          published: query.status !== 'draft',
          ...(query.grade ? { grade: query.grade } : {}),
          ...(query.subject ? { subject: query.subject } : {}),
        },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: query.skip,
        take: query.limit,
      });
    return { items, total, page: query.page, limit: query.limit };
  }
  async detail(actor: Principal, id: string) {
    const pack = await this.db
      .getRepository(ContentPack)
      .findOneBy({ id, jurisdictionId: actor.jurisdictionId });
    if (!pack) throw new NotFoundException('Pack not found');
    const lessons = await this.db
      .getRepository(Lesson)
      .find({ where: { packId: id }, order: { createdAt: 'ASC', id: 'ASC' } });
    return {
      pack,
      lessons: await Promise.all(
        lessons.map(async (lesson) => ({
          id: lesson.id,
          packId: lesson.packId,
          title: lesson.title,
          skillCode: lesson.skillCode,
          body: lesson.body,
          hints: lesson.hints,
          createdAt: lesson.createdAt,
          exercises: await this.db
            .getRepository(Exercise)
            .createQueryBuilder('e')
            .addSelect('e.correctOption')
            .where('e.lessonId = :id', { id: lesson.id })
            .orderBy('e.id', 'ASC')
            .getMany(),
        })),
      ),
    };
  }
  async download(actor: Principal, id: string) {
    const pack = await this.db
      .getRepository(ContentPack)
      .findOneBy({ id, published: true, jurisdictionId: actor.jurisdictionId });
    if (!pack) throw new NotFoundException('Published pack not found');
    const lessons = await this.db
      .getRepository(Lesson)
      .find({ where: { packId: id }, order: { createdAt: 'ASC', id: 'ASC' } });
    const payload = {
      pack,
      lessons: await Promise.all(
        lessons.map(async (lesson) => ({
          id: lesson.id,
          packId: lesson.packId,
          title: lesson.title,
          skillCode: lesson.skillCode,
          body: lesson.body,
          hints: lesson.hints,
          createdAt: lesson.createdAt,
          exercises: await this.db.getRepository(Exercise).find({
            where: { lessonId: lesson.id },
            select: {
              id: true,
              lessonId: true,
              prompt: true,
              options: true,
              coinAward: true,
            },
            order: { id: 'ASC' },
          }),
        })),
      ),
    };
    return {
      ...payload,
      checksum: createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex'),
      downloadedAt: new Date().toISOString(),
      gradingMode: 'SERVER_ON_SYNC',
    };
  }
  async create(actor: Principal, dto: CreatePackDto) {
    return this.db.transaction(async (manager) => {
      const pack = await manager.save(
        ContentPack,
        manager.create(ContentPack, {
          title: dto.title,
          grade: dto.grade,
          subject: dto.subject,
          version: dto.version,
          attribution: dto.attribution,
          expectedLessons: dto.expectedLessons ?? null,
          jurisdictionId: actor.jurisdictionId,
        }),
      );
      await this.audit.record(actor, 'CONTENT_PACK_CREATED', pack.id, manager);
      return pack;
    });
  }
  private async draft(
    manager: EntityManager,
    id: string,
    jurisdictionId: string,
  ) {
    const pack = await manager.findOne(ContentPack, {
      where: { id, jurisdictionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!pack) throw new NotFoundException('Pack not found');
    if (pack.published)
      throw new ConflictException(
        'Published packs are immutable; create a new version',
      );
    return pack;
  }
  async addLesson(actor: Principal, packId: string, dto: CreateLessonDto) {
    return this.db.transaction(async (manager) => {
      await this.draft(manager, packId, actor.jurisdictionId);
      if ((await manager.countBy(Lesson, { packId })) >= 100)
        throw new BadRequestException('Maximum 100 lessons per pack');
      const hints: Record<string, string> = { en: dto.hints.en };
      for (const lang of ['tl', 'ceb', 'ilo'] as const)
        if (dto.hints[lang]) hints[lang] = dto.hints[lang]!;
      const lesson = await manager.save(
        Lesson,
        manager.create(Lesson, {
          title: dto.title,
          skillCode: dto.skillCode,
          body: dto.body,
          hints,
          packId,
        }),
      );
      await this.audit.record(actor, 'LESSON_CREATED', lesson.id, manager);
      return lesson;
    });
  }
  async addExercise(
    actor: Principal,
    lessonId: string,
    dto: CreateExerciseDto,
  ) {
    if (dto.correctOption >= dto.options.length)
      throw new BadRequestException('Correct option must exist');
    return this.db.transaction(async (manager) => {
      const lesson = await manager.findOneBy(Lesson, { id: lessonId });
      if (!lesson) throw new NotFoundException('Lesson not found');
      await this.draft(manager, lesson.packId, actor.jurisdictionId);
      if ((await manager.countBy(Exercise, { lessonId })) >= 100)
        throw new BadRequestException('Maximum 100 exercises per lesson');
      const exercise = await manager.save(
        Exercise,
        manager.create(Exercise, {
          prompt: dto.prompt,
          options: dto.options,
          correctOption: dto.correctOption,
          coinAward: dto.coinAward,
          lessonId,
        }),
      );
      await this.audit.record(actor, 'EXERCISE_CREATED', exercise.id, manager);
      return { id: exercise.id, lessonId };
    });
  }
  async publish(actor: Principal, id: string) {
    return this.db.transaction(async (manager) => {
      const pack = await this.draft(manager, id, actor.jurisdictionId);
      const lessons = await manager.findBy(Lesson, { packId: id });
      if (!lessons.length)
        throw new BadRequestException('Pack must contain lessons');
      const actual: { title: string; skillCode: string; exerciseCount: number }[] = [];
      for (const lesson of lessons) {
        const exerciseCount = await manager.countBy(Exercise, { lessonId: lesson.id });
        if (!exerciseCount)
          throw new BadRequestException('Every lesson must contain exercises');
        actual.push({ title: lesson.title, skillCode: lesson.skillCode, exerciseCount });
      }
      if (pack.expectedLessons) {
        const signature = (rows: typeof actual) => JSON.stringify(rows.map((row) => JSON.stringify([row.title, row.skillCode, row.exerciseCount])).sort());
        if (signature(actual) !== signature(pack.expectedLessons))
          throw new BadRequestException('Content import is incomplete or has duplicate content. Finish importing every expected Lesson and Exercise before publishing.');
      }
      await manager.update(ContentPack, id, { published: true });
      await this.audit.record(actor, 'CONTENT_PUBLISHED', id, manager);
      return { id, published: true };
    });
  }
}
