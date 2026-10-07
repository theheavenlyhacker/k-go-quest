import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Paper ids issued for a Classroom's active Learners on a published Quiz. */
export class QuizPapers1791200000000 implements MigrationInterface {
  name = 'QuizPapers1791200000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE "quiz_papers" (
        "id" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "quizId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        CONSTRAINT "PK_quiz_papers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quiz_papers_quizId_studentId" UNIQUE ("quizId", "studentId")
      )`,
    );
    await q.query(
      'CREATE INDEX "IDX_quiz_papers_quizId" ON "quiz_papers" ("quizId")',
    );
    await q.query(
      'CREATE INDEX "IDX_quiz_papers_studentId" ON "quiz_papers" ("studentId")',
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "quiz_papers"');
  }
}
