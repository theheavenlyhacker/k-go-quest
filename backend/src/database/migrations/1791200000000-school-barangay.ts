import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds barangay to schools so an LGU Admin can track reach, completed lessons
 * and offline usage per barangay.
 */
export class SchoolBarangay1791200000000 implements MigrationInterface {
  name = 'SchoolBarangay1791200000000';
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE "schools" ADD "barangay" varchar(80) NOT NULL DEFAULT ''`,
    );
  }
  async down(q: QueryRunner) {
    await q.query('ALTER TABLE "schools" DROP COLUMN "barangay"');
  }
}
