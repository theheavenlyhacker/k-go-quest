import {
  Body,
  Controller,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ContentPack, Exercise, Lesson, Role } from '../../database/entities';
import { CurrentUser, type Principal, Roles } from '../../common/security';
import { ScopeService } from '../../common/scope.service';

export class QuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 100, { each: true })
  skillCodes: string[];
  @IsInt() @Min(1) @Max(50) itemCount: number;
}
@ApiTags('Teacher quizzes')
@ApiBearerAuth()
@Roles(Role.TEACHER)
@Controller('quizzes')
export class QuizzesController {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
  ) {}
  @Post('classrooms/:id/build') async build(
    @CurrentUser() actor: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuizDto,
  ) {
    const classroom = await this.scope.classroom(actor, id);
    const items = await this.db
      .getRepository(Exercise)
      .createQueryBuilder('e')
      .innerJoin(Lesson, 'l', 'l.id = e.lessonId')
      .innerJoin(ContentPack, 'p', 'p.id = l.packId')
      .where(
        'p.published = true AND p.grade = :grade AND p.jurisdictionId = :jurisdictionId AND l.skillCode IN (:...skills)',
        {
          grade: classroom.grade,
          skills: dto.skillCodes,
          jurisdictionId: actor.jurisdictionId,
        },
      )
      .select([
        'e.id AS "id"',
        'e.prompt AS "prompt"',
        'e.options AS "options"',
        'e.correctOption AS "correctOption"',
        'l.skillCode AS "skillCode"',
      ])
      .orderBy('e.id', 'ASC')
      .limit(dto.itemCount)
      .getRawMany<{
        id: string;
        prompt: string;
        options: string[];
        correctOption: number;
        skillCode: string;
      }>();
    return {
      quizId: randomUUID(),
      classroomId: id,
      requestedItems: dto.itemCount,
      actualItems: items.length,
      questions: items.map(({ correctOption: _key, ...question }) => question),
      answerKey: items.map((i) => ({
        exerciseId: i.id,
        correctOption: i.correctOption,
      })),
      mode: 'ITEM_BANK_SELECTION',
      note: 'Teacher-only JSON for printing. AI generation and camera grading are not implemented.',
    };
  }
}
@Module({ controllers: [QuizzesController] })
export class QuizzesModule {}
