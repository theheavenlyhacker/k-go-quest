import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A Shared Tablet reporting its status, storage and content versions to the school server. */
export class Devices1791200000000 implements MigrationInterface {
  name = 'Devices1791200000000';
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE "devices" (
        "id" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deviceId" varchar(80) NOT NULL UNIQUE,
        "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id),
        "schoolId" uuid REFERENCES schools(id),
        "appVersion" varchar(40) NOT NULL,
        "packVersions" jsonb NOT NULL DEFAULT '[]',
        "storageUsedPercent" integer NOT NULL DEFAULT 0,
        "pendingAttempts" integer NOT NULL DEFAULT 0,
        "lastSeenAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id")
      )`,
    );
    await q.query(
      'CREATE INDEX "IDX_devices_jurisdictionId" ON "devices" ("jurisdictionId")',
    );
    await q.query(
      'CREATE INDEX "IDX_devices_schoolId" ON "devices" ("schoolId")',
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "devices"');
  }
}
