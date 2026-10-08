import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DataSource } from 'typeorm';
import {
  Classroom,
  Enrollment,
  Quiz,
  QuizPaper,
  QuizStatus,
  Role,
  SkillProgress,
  Subject,
  User,
} from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { ScopeService } from '../../common/scope.service';
import { DEFAULT_PARAMS } from '../learning/mastery';
import {
  pickItems,
  weakestSkills,
  type Candidate,
  type SkillMean,
} from './selection';

/** How many weakest Skills a Quiz draws from when the Teacher names none. */
const SUGGESTED_SKILLS = 3;

export class CreateQuizDto {
  @IsUUID() classroomId: string;
  @IsEnum(Subject) subject: Subject;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 100, { each: true })
  skillCodes?: string[];
  @IsInt() @Min(1) @Max(50) itemCount: number;
  @IsOptional() @IsString() @Length(1, 120) title?: string;
}
export class UpdateQuizDto {
  @IsOptional() @IsString() @Length(1, 120) title?: string;
  /** The full, ordered list; removing an id removes the item. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  exerciseIds?: string[];
  /** Swaps this item for the next best Exercise in the same Skill. */
  @IsOptional() @IsUUID() replaceExerciseId?: string;
}

export class SaveQuizResultDto {
  @IsUUID() paperId: string;
  @IsArray() @ArrayMaxSize(50) answers: (number | null)[];
}

interface Bank extends Candidate {
  prompt: string;
  options: string[];
  correctOption: number;
}

@Injectable()
export class QuizzesService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
  ) {}

  /** Exercises a Classroom can be quizzed on, with how often it has answered each. */
  private bank(
    classroom: Classroom,
    jurisdictionId: string,
    subject: Subject,
  ): Promise<Bank[]> {
    return this.db.query(
      `SELECT e.id, l."skillCode", e.prompt, e.options, e."correctOption",
         (SELECT count(*)::int FROM attempts a
           WHERE a."exerciseId" = e.id AND a."classroomId" = $4) AS answered
       FROM exercises e
       JOIN lessons l ON l.id = e."lessonId"
       JOIN content_packs p ON p.id = l."packId"
       WHERE p.published = true AND p.grade = $1 AND p."jurisdictionId" = $2 AND p.subject = $3
         AND jsonb_array_length(e.options) BETWEEN 2 AND 4
         AND e."correctOption" BETWEEN 0 AND 3
         AND e."correctOption" < jsonb_array_length(e.options)`,
      [classroom.grade, jurisdictionId, subject, classroom.id],
    );
  }

  /** Classroom mean Mastery per Skill; a Learner with no record yet counts at the prior. */
  private async skillMeans(
    classroomId: string,
    skillCodes: string[],
  ): Promise<SkillMean[]> {
    const learners = (
      await this.db
        .getRepository(Enrollment)
        .findBy({ classroomId, active: true })
    ).map((e) => e.studentId);
    const rows = learners.length
      ? await this.db
          .getRepository(SkillProgress)
          .createQueryBuilder('s')
          .where('s.studentId IN (:...learners)', { learners })
          .getMany()
      : [];
    return skillCodes.map((skillCode) => {
      const total = learners.reduce(
        (sum, id) =>
          sum +
          (rows.find((r) => r.studentId === id && r.skillCode === skillCode)
            ?.mastery ?? DEFAULT_PARAMS.prior),
        0,
      );
      return {
        skillCode,
        mean: learners.length ? total / learners.length : DEFAULT_PARAMS.prior,
      };
    });
  }

  async skills(actor: Principal, classroomId: string, subject: Subject) {
    const classroom = await this.scope.classroom(actor, classroomId);
    const bank = await this.bank(classroom, actor.jurisdictionId, subject);
    const codes = [...new Set(bank.map((b) => b.skillCode))];
    const means = await this.skillMeans(classroomId, codes);
    const suggested = weakestSkills(means, SUGGESTED_SKILLS);
    return means
      .sort((a, b) => a.mean - b.mean || a.skillCode.localeCompare(b.skillCode))
      .map((m) => ({
        skillCode: m.skillCode,
        meanMastery: m.mean,
        suggested: suggested.includes(m.skillCode),
        exercises: bank.filter((b) => b.skillCode === m.skillCode).length,
      }));
  }

  private async view(quiz: Quiz) {
    const bank = quiz.exerciseIds.length
      ? await this.db.query<Bank[]>(
          `SELECT e.id, l."skillCode", e.prompt, e.options, e."correctOption"
           FROM exercises e JOIN lessons l ON l.id = e."lessonId"
           WHERE e.id = ANY($1::uuid[])`,
          [quiz.exerciseIds],
        )
      : [];
    const items = quiz.exerciseIds.flatMap((id) => {
      const found = bank.find((b) => b.id === id);
      return found ? [found] : [];
    });
    return {
      id: quiz.id,
      classroomId: quiz.classroomId,
      title: quiz.title,
      subject: quiz.subject,
      skillCodes: quiz.skillCodes,
      status: quiz.status,
      questionCount: quiz.exerciseIds.length,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questions: items.map((i) => ({
        id: i.id,
        skillCode: i.skillCode,
        prompt: i.prompt,
        options: i.options,
      })),
      answerKey: items.map((i) => ({
        exerciseId: i.id,
        correctOption: i.correctOption,
      })),
      note: "Picked for your Classroom's weakest Skills from the item bank. Teacher-only; taken on paper, never a Counted Attempt.",
    };
  }

  async create(actor: Principal, dto: CreateQuizDto) {
    const classroom = await this.scope.classroom(actor, dto.classroomId);
    const bank = await this.bank(classroom, actor.jurisdictionId, dto.subject);
    const inBank = [...new Set(bank.map((b) => b.skillCode))];
    const skillCodes =
      dto.skillCodes ??
      weakestSkills(
        await this.skillMeans(classroom.id, inBank),
        SUGGESTED_SKILLS,
      );
    const order = dto.skillCodes
      ? (await this.skillMeans(classroom.id, skillCodes))
          .sort(
            (a, b) => a.mean - b.mean || a.skillCode.localeCompare(b.skillCode),
          )
          .map((m) => m.skillCode)
      : skillCodes;
    const exerciseIds = pickItems(bank, order, dto.itemCount);
    if (!exerciseIds.length)
      throw new BadRequestException(
        'No published Exercises match those Skills for this Classroom',
      );
    const quiz = await this.db.getRepository(Quiz).save(
      this.db.getRepository(Quiz).create({
        classroomId: classroom.id,
        title: dto.title ?? `${dto.subject} Quiz`,
        subject: dto.subject,
        skillCodes: order,
        exerciseIds,
        status: QuizStatus.DRAFT,
      }),
    );
    return this.view(quiz);
  }

  /** A Quiz in a Classroom this Teacher teaches; anything else is the same 404/403 as the Classroom. */
  private async own(actor: Principal, id: string) {
    const quiz = await this.db.getRepository(Quiz).findOneBy({ id });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const classroom = await this.scope.classroom(actor, quiz.classroomId);
    return { quiz, classroom };
  }

  async list(actor: Principal, classroomId: string) {
    await this.scope.classroom(actor, classroomId);
    const quizzes = await this.db
      .getRepository(Quiz)
      .find({ where: { classroomId }, order: { updatedAt: 'DESC' } });
    const summaries = await this.db.query<
      { quizId: string; submittedCount: number; classAverage: number }[]
    >(
      `SELECT p."quizId", count(*)::int AS "submittedCount",
         avg(p.score::float / jsonb_array_length(q."exerciseIds") * 100) AS "classAverage"
       FROM quiz_papers p JOIN quizzes q ON q.id = p."quizId"
       WHERE q."classroomId" = $1 AND p."gradedAt" IS NOT NULL GROUP BY p."quizId"`,
      [classroomId],
    );
    return quizzes.map((q) => ({
      id: q.id,
      classroomId: q.classroomId,
      title: q.title,
      subject: q.subject,
      skillCodes: q.skillCodes,
      status: q.status,
      questionCount: q.exerciseIds.length,
      submittedCount:
        summaries.find((s) => s.quizId === q.id)?.submittedCount ?? 0,
      classAverage:
        summaries.find((s) => s.quizId === q.id)?.classAverage ?? null,
      updatedAt: q.updatedAt,
    }));
  }

  async get(actor: Principal, id: string) {
    return this.view((await this.own(actor, id)).quiz);
  }

  async update(actor: Principal, id: string, dto: UpdateQuizDto) {
    const { quiz, classroom } = await this.own(actor, id);
    if (quiz.status === QuizStatus.PUBLISHED)
      throw new ConflictException('A published Quiz cannot be changed');
    if (dto.exerciseIds && dto.replaceExerciseId)
      throw new BadRequestException(
        'Send exerciseIds or replaceExerciseId, not both',
      );
    const bank = await this.bank(classroom, actor.jurisdictionId, quiz.subject);
    let ids = dto.exerciseIds ?? quiz.exerciseIds;
    if (dto.exerciseIds) {
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException('Exercises may appear once');
      if (ids.some((x) => !bank.some((b) => b.id === x)))
        throw new BadRequestException(
          'Every Exercise must be a published one for this Classroom and Subject',
        );
    }
    if (dto.replaceExerciseId) {
      const old = bank.find((b) => b.id === dto.replaceExerciseId);
      if (!old || !ids.includes(old.id))
        throw new BadRequestException('That Exercise is not in this Quiz');
      const pool = bank.filter((b) => !ids.includes(b.id));
      // Same Skill first, then the Quiz's other Skills.
      const next =
        pickItems(pool, [old.skillCode], 1)[0] ??
        pickItems(pool, quiz.skillCodes, 1)[0];
      if (!next) throw new ConflictException('No other Exercise is available');
      ids = ids.map((x) => (x === old.id ? next : x));
    }
    quiz.exerciseIds = ids;
    quiz.title = dto.title ?? quiz.title;
    quiz.skillCodes = [
      ...new Set(
        ids.flatMap((x) => bank.find((b) => b.id === x)?.skillCode ?? []),
      ),
    ];
    return this.view(
      await this.saveDraft(quiz, {
        title: quiz.title,
        skillCodes: quiz.skillCodes,
        exerciseIds: quiz.exerciseIds,
      }),
    );
  }

  /** Writes only while the Quiz is still a draft, so a concurrent publish cannot be overwritten. */
  private async saveDraft(quiz: Quiz, changes: Partial<Quiz>) {
    const done = await this.db
      .getRepository(Quiz)
      .update({ id: quiz.id, status: QuizStatus.DRAFT }, changes);
    if (!done.affected)
      throw new ConflictException('A published Quiz cannot be changed');
    return this.db.getRepository(Quiz).findOneByOrFail({ id: quiz.id });
  }

  async publish(actor: Principal, id: string) {
    const { quiz } = await this.own(actor, id);
    if (quiz.status === QuizStatus.PUBLISHED)
      throw new ConflictException('Quiz is already published');
    const view = await this.view(quiz);
    if (
      view.questions.some((q) => q.options.length > 4) ||
      view.answerKey.some((k) => k.correctOption > 3)
    )
      throw new BadRequestException(
        'Paper Quizzes support A–D only. Replace items with more than four options before publishing.',
      );
    return this.view(
      await this.saveDraft(quiz, { status: QuizStatus.PUBLISHED }),
    );
  }

  async saveResult(actor: Principal, id: string, dto: SaveQuizResultDto) {
    const { quiz } = await this.own(actor, id);
    if (quiz.status !== QuizStatus.PUBLISHED)
      throw new ConflictException('Publish the Quiz before marking papers');
    const repo = this.db.getRepository(QuizPaper);
    const paper = await repo.findOneBy({ id: dto.paperId, quizId: id });
    if (!paper)
      throw new BadRequestException('This paper does not belong to this Quiz');
    const view = await this.view(quiz);
    if (
      view.questions.some((q) => q.options.length > 4) ||
      view.answerKey.some((k) => k.correctOption > 3)
    )
      throw new ConflictException(
        'This Quiz has items beyond A–D and cannot be marked as a Paper Quiz',
      );
    if (view.answerKey.length !== quiz.exerciseIds.length)
      throw new ConflictException('The Quiz answer key is incomplete');
    if (
      dto.answers.length !== view.questions.length ||
      dto.answers.some(
        (a, i) =>
          a !== null &&
          (!Number.isInteger(a) ||
            a < 0 ||
            a > 3 ||
            a >= view.questions[i].options.length),
      )
    )
      throw new BadRequestException(
        'Send one answer per item: an option index 0–3, or null for blank',
      );
    const correctness = dto.answers.map(
      (a, i) => a !== null && a === view.answerKey[i].correctOption,
    );
    const score = correctness.filter(Boolean).length;
    // An atomic update on the issued Paper makes retries and rescans replace the result.
    await repo.update(
      { id: paper.id, quizId: id },
      { answers: dto.answers, score, gradedAt: new Date() },
    );
    return {
      paperId: paper.id,
      studentId: paper.studentId,
      score,
      total: quiz.exerciseIds.length,
      correctness,
    };
  }

  async results(actor: Principal, id: string) {
    const { quiz } = await this.own(actor, id);
    const view = await this.view(quiz);
    const learners = await this.db
      .getRepository(QuizPaper)
      .createQueryBuilder('p')
      .innerJoin(User, 'u', 'u.id = p.studentId')
      .where('p.quizId = :id AND p.gradedAt IS NOT NULL', { id })
      .select([
        'p.id AS "paperId"',
        'p.studentId AS "studentId"',
        'u.alias AS "alias"',
        'p.answers AS "answers"',
        'p.score AS "score"',
        'p.gradedAt AS "gradedAt"',
      ])
      .orderBy('u.alias', 'ASC')
      .getRawMany<{
        paperId: string;
        studentId: string;
        alias: string;
        answers: (number | null)[];
        score: number;
        gradedAt: Date;
      }>();
    return {
      quizId: id,
      title: quiz.title,
      total: quiz.exerciseIds.length,
      submittedCount: learners.length,
      classAverage: learners.length
        ? learners.reduce(
            (sum, p) => sum + (p.score / quiz.exerciseIds.length) * 100,
            0,
          ) / learners.length
        : null,
      learners,
      items: view.answerKey.map((key, i) => {
        const correctCount = learners.filter(
          (p) => p.answers[i] === key.correctOption,
        ).length;
        return {
          exerciseId: key.exerciseId,
          correctCount,
          submittedCount: learners.length,
          difficulty: learners.length
            ? 1 - correctCount / learners.length
            : null,
        };
      }),
    };
  }

  async papers(actor: Principal, id: string) {
    const { quiz, classroom } = await this.own(actor, id);
    if (quiz.status !== QuizStatus.PUBLISHED)
      throw new ConflictException(
        'Quiz must be published before issuing papers',
      );
    const learners = await this.db
      .getRepository(User)
      .createQueryBuilder('u')
      .innerJoin(
        Enrollment,
        'e',
        'e.studentId = u.id AND e.classroomId = :classroomId AND e.active = true',
        { classroomId: classroom.id },
      )
      .where('u.active = true')
      .select(['u.id AS "studentId"', 'u.alias AS "alias"'])
      .orderBy('u.alias', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .getRawMany<{ studentId: string; alias: string }>();

    const paperRepo = this.db.getRepository(QuizPaper);
    const existing = await paperRepo.findBy({ quizId: quiz.id });
    const existingByStudent = new Map(existing.map((p) => [p.studentId, p]));

    const toCreate: QuizPaper[] = [];
    for (const learner of learners) {
      if (!existingByStudent.has(learner.studentId)) {
        toCreate.push(
          paperRepo.create({
            quizId: quiz.id,
            studentId: learner.studentId,
          }),
        );
      }
    }
    if (toCreate.length > 0) {
      const saved = await paperRepo.save(toCreate);
      for (const p of saved) {
        existingByStudent.set(p.studentId, p);
      }
    }

    return learners.map((l) => {
      const pid = existingByStudent.get(l.studentId)!.id;
      return {
        id: pid,
        paperId: pid,
        quizId: quiz.id,
        studentId: l.studentId,
        alias: l.alias,
      };
    });
  }
}

@ApiTags('Teacher quizzes')
@ApiBearerAuth()
@Roles(Role.TEACHER)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}
  @Post() create(@CurrentUser() actor: Principal, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(actor, dto);
  }
  @Get() list(
    @CurrentUser() actor: Principal,
    @Query('classroomId', ParseUUIDPipe) classroomId: string,
  ) {
    return this.quizzes.list(actor, classroomId);
  }
  @Get('skills') skills(
    @CurrentUser() actor: Principal,
    @Query('classroomId', ParseUUIDPipe) classroomId: string,
    @Query('subject') subject: Subject,
  ) {
    if (!Object.values(Subject).includes(subject))
      throw new BadRequestException('Unknown Subject');
    return this.quizzes.skills(actor, classroomId, subject);
  }
  @Get(':id') get(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.get(actor, id);
  }
  @Patch(':id') update(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(actor, id, dto);
  }
  @Post(':id/publish') publish(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.publish(actor, id);
  }
  @Post(':id/results') saveResult(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveQuizResultDto,
  ) {
    return this.quizzes.saveResult(actor, id, dto);
  }
  @Get(':id/results') results(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.results(actor, id);
  }
  @Post(':id/papers') papers(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.papers(actor, id);
  }
}

@Module({ controllers: [QuizzesController], providers: [QuizzesService] })
export class QuizzesModule {}
