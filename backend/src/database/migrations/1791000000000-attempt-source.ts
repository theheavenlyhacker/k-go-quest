import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Says where an Attempt came from, so synthetic demo history can be told apart
 * from real practice and included or excluded on purpose by a later refit.
 */
export class AttemptSource1791000000000 implements MigrationInterface {
  name = 'AttemptSource1791000000000';
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE "attempts" ADD "source" varchar(20) NOT NULL DEFAULT 'device'`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('ALTER TABLE "attempts" DROP COLUMN "source"');
  }
}
