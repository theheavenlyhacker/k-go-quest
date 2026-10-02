import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790800000000 implements MigrationInterface {
  name = 'InitialSchema1790800000000';
  async up(q: QueryRunner) {
    const base =
      '"id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now()';
    const tables: [string, string][] = [
      ['jurisdictions', '"name" varchar(120) NOT NULL'],
      [
        'schools',
        '"jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "name" varchar(120) NOT NULL',
      ],
      [
        'users',
        `"loginId" varchar(80) NOT NULL UNIQUE, "role" varchar(40) NOT NULL CHECK (role IN ('STUDENT','TEACHER','LGU_ADMIN')), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "schoolId" uuid REFERENCES schools(id), "alias" varchar(80) NOT NULL, "passwordHash" varchar NOT NULL, "active" boolean NOT NULL DEFAULT true, "coins" integer NOT NULL DEFAULT 0 CHECK (coins >= 0), "failedLogins" integer NOT NULL DEFAULT 0, "lockedUntil" timestamptz, "updatedAt" timestamptz NOT NULL DEFAULT now(), CHECK ((role = 'LGU_ADMIN' AND "schoolId" IS NULL) OR (role <> 'LGU_ADMIN' AND "schoolId" IS NOT NULL))`,
      ],
      [
        'auth_sessions',
        '"userId" uuid NOT NULL REFERENCES users(id), "deviceId" varchar(80) NOT NULL, "refreshHash" varchar NOT NULL, "expiresAt" timestamptz NOT NULL, "revokedAt" timestamptz',
      ],
      [
        'classrooms',
        '"schoolId" uuid NOT NULL REFERENCES schools(id), "teacherId" uuid NOT NULL REFERENCES users(id), "name" varchar(80) NOT NULL, "grade" integer NOT NULL CHECK (grade BETWEEN 1 AND 12)',
      ],
      [
        'enrollments',
        '"classroomId" uuid NOT NULL REFERENCES classrooms(id), "studentId" uuid NOT NULL REFERENCES users(id), "active" boolean NOT NULL DEFAULT true, UNIQUE ("classroomId", "studentId")',
      ],
      [
        'content_packs',
        '"jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "title" varchar(120) NOT NULL, "subject" varchar(30) NOT NULL, "grade" integer NOT NULL CHECK (grade BETWEEN 1 AND 12), "version" varchar(30) NOT NULL, "published" boolean NOT NULL DEFAULT false, "attribution" varchar NOT NULL DEFAULT \'Original K-Go demo content\'',
      ],
      [
        'lessons',
        '"packId" uuid NOT NULL REFERENCES content_packs(id), "title" varchar(120) NOT NULL, "skillCode" varchar(100) NOT NULL, "body" text NOT NULL, "hints" jsonb NOT NULL DEFAULT \'{}\'',
      ],
      [
        'exercises',
        '"lessonId" uuid NOT NULL REFERENCES lessons(id), "prompt" text NOT NULL, "options" jsonb NOT NULL, "correctOption" integer NOT NULL CHECK ("correctOption" BETWEEN 0 AND 5), "coinAward" integer NOT NULL DEFAULT 5 CHECK ("coinAward" BETWEEN 0 AND 20)',
      ],
      [
        'attempts',
        '"clientAttemptId" uuid NOT NULL, "studentId" uuid NOT NULL REFERENCES users(id), "classroomId" uuid NOT NULL REFERENCES classrooms(id), "exerciseId" uuid NOT NULL REFERENCES exercises(id), "skillCode" varchar(100) NOT NULL, "subject" varchar(30) NOT NULL, "selectedOption" integer NOT NULL, "correct" boolean NOT NULL, "awardedCoins" integer NOT NULL CHECK ("awardedCoins" >= 0), "occurredAt" timestamptz NOT NULL, "receivedAt" timestamptz NOT NULL, UNIQUE ("studentId", "clientAttemptId")',
      ],
      [
        'skill_progress',
        '"studentId" uuid NOT NULL REFERENCES users(id), "skillCode" varchar(100) NOT NULL, "subject" varchar(30) NOT NULL, "mastery" double precision NOT NULL DEFAULT 0.2 CHECK (mastery BETWEEN 0 AND 1), "attempts" integer NOT NULL DEFAULT 0, "correctAttempts" integer NOT NULL DEFAULT 0, "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("studentId", "skillCode")',
      ],
      [
        'growth_snapshots',
        '"studentId" uuid NOT NULL REFERENCES users(id), "classroomId" uuid NOT NULL REFERENCES classrooms(id), "skillCode" varchar(100) NOT NULL, "month" varchar(7) NOT NULL, "baseline" double precision NOT NULL, "latest" double precision NOT NULL, UNIQUE ("studentId", "skillCode", "month")',
      ],
      [
        'rewards',
        '"jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "title" varchar(120) NOT NULL, "cost" integer NOT NULL CHECK (cost > 0), "stock" integer NOT NULL CHECK (stock >= 0), "active" boolean NOT NULL DEFAULT true',
      ],
      [
        'redemptions',
        '"studentId" uuid NOT NULL REFERENCES users(id), "rewardId" uuid NOT NULL REFERENCES rewards(id), "requestId" uuid NOT NULL, "cost" integer NOT NULL CHECK (cost > 0), "status" varchar(20) NOT NULL DEFAULT \'ISSUED\' CHECK (status IN (\'ISSUED\',\'CLAIMED\')), "claimedAt" timestamptz, "claimedBy" uuid REFERENCES users(id), UNIQUE ("studentId", "requestId")',
      ],
      [
        'audit_events',
        '"actorId" uuid REFERENCES users(id), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "action" varchar(80) NOT NULL, "targetId" uuid, "metadata" jsonb NOT NULL DEFAULT \'{}\'',
      ],
    ];
    for (const [name, columns] of tables)
      await q.query(`CREATE TABLE "${name}" (${base}, ${columns})`);
    for (const [index, columns] of [
      ['schools', '"jurisdictionId"'],
      ['users', '"jurisdictionId", "schoolId"'],
      ['auth_sessions', '"userId"'],
      ['classrooms', '"teacherId", "schoolId"'],
      ['enrollments', '"studentId", "active"'],
      ['lessons', '"packId"'],
      ['exercises', '"lessonId"'],
      ['attempts', '"studentId", "exerciseId", "receivedAt"'],
      ['attempts', '"classroomId", "receivedAt"'],
      ['rewards', '"jurisdictionId"'],
      ['audit_events', '"jurisdictionId", "createdAt"'],
    ].entries()) {
      const [name, cols] = columns;
      await q.query(
        `CREATE INDEX "idx_${name}_${index}" ON "${name}" (${cols})`,
      );
    }
    await q.query(
      'CREATE UNIQUE INDEX "one_active_session_per_user" ON auth_sessions ("userId") WHERE "revokedAt" IS NULL',
    );
  }
  async down(q: QueryRunner) {
    for (const name of [
      'audit_events',
      'redemptions',
      'rewards',
      'growth_snapshots',
      'skill_progress',
      'attempts',
      'exercises',
      'lessons',
      'content_packs',
      'enrollments',
      'classrooms',
      'auth_sessions',
      'users',
      'schools',
      'jurisdictions',
    ])
      await q.query(`DROP TABLE "${name}"`);
  }
}
