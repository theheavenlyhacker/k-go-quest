import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A Teacher-built set of Exercises for one Classroom, saved as a draft and published once. */
export class Quizzes1791100000000 implements MigrationInterface {
  name = 'Quizzes1791100000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE "quizzes" (
        "id" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "classroomId" uuid NOT NULL,
        "title" varchar(120) NOT NULL,
        "subject" varchar(30) NOT NULL,
        "skillCodes" jsonb NOT NULL,
        "exerciseIds" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quizzes" PRIMARY KEY ("id")
      )`,
    );
    await q.query(
      'CREATE INDEX "IDX_quizzes_classroomId" ON "quizzes" ("classroomId")',
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "quizzes"');
  }
}
