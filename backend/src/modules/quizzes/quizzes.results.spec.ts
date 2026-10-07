import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { ScopeService } from '../../common/scope.service';
import type { Principal } from '../../common/security';
import {
  Quiz,
  QuizPaper,
  QuizStatus,
  Role,
  Subject,
} from '../../database/entities';
import { QuizzesService } from './quizzes.module';

const actor: Principal = {
  id: 'teacher',
  sessionId: 'session',
  role: Role.TEACHER,
  jurisdictionId: 'lgu',
  schoolId: 'school',
};

describe('paper result marking', () => {
  it('grades with ordered server keys, replaces one paper and validates before writing', async () => {
    const quiz = {
      id: 'quiz',
      classroomId: 'room',
      status: QuizStatus.PUBLISHED,
      exerciseIds: ['a', 'b'],
      title: 'Quiz',
      subject: Subject.MATH,
      skillCodes: ['math'],
    };
    const paper = {
      id: 'paper',
      quizId: 'quiz',
      studentId: 'learner',
      score: null as number | null,
      answers: null as (number | null)[] | null,
    };
    const papers = {
      findOneBy: jest.fn(
        async ({ id, quizId }: { id: string; quizId: string }) =>
          id === paper.id && quizId === paper.quizId ? paper : null,
      ),
      update: jest.fn(async (_id: unknown, values: object) =>
        Object.assign(paper, values),
      ),
    };
    const queriedEntities: unknown[] = [];
    const db = {
      getRepository: (entity: unknown) => {
        queriedEntities.push(entity);
        return entity === Quiz ? { findOneBy: async () => quiz } : papers;
      },
      query: jest.fn(async () => [
        {
          id: 'b',
          skillCode: 'math',
          prompt: 'B',
          options: ['a', 'b', 'c', 'd'],
          correctOption: 3,
        },
        {
          id: 'a',
          skillCode: 'math',
          prompt: 'A',
          options: ['a', 'b', 'c', 'd'],
          correctOption: 0,
        },
      ]),
    };
    const scope = { classroom: jest.fn(async () => ({ id: 'room' })) };
    const service = new QuizzesService(
      db as unknown as DataSource,
      scope as unknown as ScopeService,
    );
    expect(
      await service.saveResult(actor, 'quiz', {
        paperId: 'paper',
        answers: [0, 3],
      }),
    ).toMatchObject({ score: 2, total: 2, correctness: [true, true] });
    await service.saveResult(actor, 'quiz', {
      paperId: 'paper',
      answers: [0, 3],
    });
    expect(
      await service.saveResult(actor, 'quiz', {
        paperId: 'paper',
        answers: [null, 1],
      }),
    ).toMatchObject({ score: 0, correctness: [false, false] });
    expect(paper.answers).toEqual([null, 1]);
    expect(
      papers.update.mock.calls.every(
        ([id]) =>
          JSON.stringify(id) ===
          JSON.stringify({ id: 'paper', quizId: 'quiz' }),
      ),
    ).toBe(true);
    expect(new Set(queriedEntities)).toEqual(new Set([Quiz, QuizPaper])); // Never visits practice, progress or wallets.
    const writes = papers.update.mock.calls.length;
    for (const answers of [[], [4, null], [0.5, null], [NaN, null]])
      await expect(
        service.saveResult(actor, 'quiz', { paperId: 'paper', answers }),
      ).rejects.toThrow(BadRequestException);
    await expect(
      service.saveResult(actor, 'quiz', {
        paperId: 'foreign',
        answers: [0, 3],
      }),
    ).rejects.toThrow('does not belong');
    db.query.mockResolvedValueOnce([
      {
        id: 'a',
        skillCode: 'math',
        prompt: 'A',
        options: ['a', 'b', 'c', 'd', 'e'],
        correctOption: 4,
      },
      {
        id: 'b',
        skillCode: 'math',
        prompt: 'B',
        options: ['a', 'b', 'c', 'd'],
        correctOption: 3,
      },
    ]);
    await expect(
      service.saveResult(actor, 'quiz', { paperId: 'paper', answers: [0, 3] }),
    ).rejects.toThrow('beyond A–D');
    quiz.status = QuizStatus.DRAFT;
    await expect(
      service.saveResult(actor, 'quiz', { paperId: 'paper', answers: [0, 3] }),
    ).rejects.toThrow(ConflictException);
    scope.classroom.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      service.saveResult(actor, 'quiz', { paperId: 'paper', answers: [0, 3] }),
    ).rejects.toThrow(ForbiddenException);
    expect(papers.update).toHaveBeenCalledTimes(writes);
  });
});
