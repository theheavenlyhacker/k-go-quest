import { ConflictException } from '@nestjs/common';
import { QuizPapers1791200000000 } from '../../database/migrations/1791200000000-quiz-papers';
import { QuizStatus } from '../../database/entities';
import { QuizzesService } from './quizzes.module';

describe('QuizPapers migration', () => {
  it('creates and drops quiz_papers table', async () => {
    const queries: string[] = [];
    const runner = {
      query: (sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      },
    };
    const migration = new QuizPapers1791200000000();
    await migration.up(runner as any);
    expect(queries[0]).toContain('CREATE TABLE "quiz_papers"');
    expect(queries[0]).toContain('"quizId" uuid NOT NULL');
    expect(queries[0]).toContain('"studentId" uuid NOT NULL');
    expect(queries[1]).toContain('CREATE INDEX "IDX_quiz_papers_quizId"');
    expect(queries[2]).toContain('CREATE INDEX "IDX_quiz_papers_studentId"');

    queries.length = 0;
    await migration.down(runner as any);
    expect(queries[0]).toBe('DROP TABLE "quiz_papers"');
  });
});

describe('QuizzesService.papers', () => {
  const actor = {
    userId: 'teacher-1',
    role: 'TEACHER',
    jurisdictionId: 'jur-1',
    schoolId: 'sch-1',
  } as any;

  it('rejects paper issuance when quiz is not published', async () => {
    const scope = {
      classroom: jest.fn().mockResolvedValue({ id: 'class-1' }),
    };
    const db = {
      getRepository: jest.fn().mockReturnValue({
        findOneBy: jest.fn().mockResolvedValue({
          id: 'quiz-1',
          classroomId: 'class-1',
          status: QuizStatus.DRAFT,
        }),
      }),
    };
    const service = new QuizzesService(db as any, scope as any);
    await expect(service.papers(actor, 'quiz-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('issues papers for active learners and is idempotent', async () => {
    const scope = {
      classroom: jest.fn().mockResolvedValue({ id: 'class-1' }),
    };
    const learners = [
      { studentId: 'student-1', alias: 'Ada L.' },
      { studentId: 'student-2', alias: 'Grace H.' },
    ];
    const existingPapers: Array<{ id: string; quizId: string; studentId: string }> = [];

    const mockPaperRepo = {
      findBy: jest.fn().mockImplementation(async ({ quizId }) => {
        return existingPapers.filter((p) => p.quizId === quizId);
      }),
      create: jest.fn().mockImplementation(({ quizId, studentId }) => ({
        id: `paper-${studentId}`,
        quizId,
        studentId,
      })),
      save: jest.fn().mockImplementation(async (items) => {
        existingPapers.push(...items);
        return items;
      }),
    };

    const mockUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(learners),
      }),
    };

    const mockQuizRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'quiz-1',
        classroomId: 'class-1',
        status: QuizStatus.PUBLISHED,
      }),
    };

    const db = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity.name === 'Quiz') return mockQuizRepo;
        if (entity.name === 'User') return mockUserRepo;
        if (entity.name === 'QuizPaper') return mockPaperRepo;
        return {};
      }),
    };

    const service = new QuizzesService(db as any, scope as any);

    // First call: issues papers
    const papers1 = await service.papers(actor, 'quiz-1');
    expect(papers1).toHaveLength(2);
    expect(papers1[0]).toEqual({
      id: 'paper-student-1',
      paperId: 'paper-student-1',
      quizId: 'quiz-1',
      studentId: 'student-1',
      alias: 'Ada L.',
    });
    expect(papers1[1]).toEqual({
      id: 'paper-student-2',
      paperId: 'paper-student-2',
      quizId: 'quiz-1',
      studentId: 'student-2',
      alias: 'Grace H.',
    });
    expect(mockPaperRepo.save).toHaveBeenCalledTimes(1);

    // Second call: idempotent, reuses existing
    const papers2 = await service.papers(actor, 'quiz-1');
    expect(papers2).toEqual(papers1);
    expect(mockPaperRepo.save).toHaveBeenCalledTimes(1); // not called again
  });
});
