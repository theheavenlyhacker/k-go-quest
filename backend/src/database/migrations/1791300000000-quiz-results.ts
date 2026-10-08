import type { MigrationInterface, QueryRunner } from 'typeorm';

/** One current result per issued Paper; a rescan replaces its marking. */
export class QuizResults1791300000000 implements MigrationInterface {
  name = 'QuizResults1791300000000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE "quiz_papers"
      ADD COLUMN "answers" jsonb,
      ADD COLUMN "score" integer,
      ADD COLUMN "gradedAt" timestamptz`);
  }
  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE "quiz_papers"
      DROP COLUMN "gradedAt", DROP COLUMN "score", DROP COLUMN "answers"`);
  }
}
