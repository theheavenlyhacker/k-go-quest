import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Persist the intended import shape before any Lessons or Exercises are uploaded. */
export class ContentImport1791400000000 implements MigrationInterface {
  name = 'ContentImport1791400000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE content_packs ADD COLUMN "expectedLessons" jsonb');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE content_packs DROP COLUMN "expectedLessons"');
  }
}
