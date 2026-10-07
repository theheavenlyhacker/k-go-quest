-- K-Go Quests: fresh PostgreSQL schema kgo.
-- Run once in defaultdb. Includes TypeORM migration bookkeeping.
-- Existing public tables are not changed. This script contains no credentials or user data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "kgo";
SET LOCAL search_path = "kgo";

CREATE TABLE "migrations" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL);

CREATE TABLE "jurisdictions" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "name" varchar(120) NOT NULL);

CREATE TABLE "schools" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "name" varchar(120) NOT NULL);

CREATE TABLE "users" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "loginId" varchar(80) NOT NULL UNIQUE, "role" varchar(40) NOT NULL CHECK (role IN ('STUDENT','TEACHER','LGU_ADMIN')), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "schoolId" uuid REFERENCES schools(id), "alias" varchar(80) NOT NULL, "passwordHash" varchar NOT NULL, "active" boolean NOT NULL DEFAULT true, "coins" integer NOT NULL DEFAULT 0 CHECK (coins >= 0), "failedLogins" integer NOT NULL DEFAULT 0, "lockedUntil" timestamptz, "updatedAt" timestamptz NOT NULL DEFAULT now(), CHECK ((role = 'LGU_ADMIN' AND "schoolId" IS NULL) OR (role <> 'LGU_ADMIN' AND "schoolId" IS NOT NULL)));

CREATE TABLE "auth_sessions" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "userId" uuid NOT NULL REFERENCES users(id), "deviceId" varchar(80) NOT NULL, "refreshHash" varchar NOT NULL, "expiresAt" timestamptz NOT NULL, "revokedAt" timestamptz);

CREATE TABLE "classrooms" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "schoolId" uuid NOT NULL REFERENCES schools(id), "teacherId" uuid NOT NULL REFERENCES users(id), "name" varchar(80) NOT NULL, "grade" integer NOT NULL CHECK (grade BETWEEN 1 AND 12));

CREATE TABLE "enrollments" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "classroomId" uuid NOT NULL REFERENCES classrooms(id), "studentId" uuid NOT NULL REFERENCES users(id), "active" boolean NOT NULL DEFAULT true, UNIQUE ("classroomId", "studentId"));

CREATE TABLE "content_packs" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "title" varchar(120) NOT NULL, "subject" varchar(30) NOT NULL, "grade" integer NOT NULL CHECK (grade BETWEEN 1 AND 12), "version" varchar(30) NOT NULL, "published" boolean NOT NULL DEFAULT false, "attribution" varchar NOT NULL DEFAULT 'Original K-Go demo content');

CREATE TABLE "lessons" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "packId" uuid NOT NULL REFERENCES content_packs(id), "title" varchar(120) NOT NULL, "skillCode" varchar(100) NOT NULL, "body" text NOT NULL, "hints" jsonb NOT NULL DEFAULT '{}');

CREATE TABLE "exercises" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "lessonId" uuid NOT NULL REFERENCES lessons(id), "prompt" text NOT NULL, "options" jsonb NOT NULL, "correctOption" integer NOT NULL CHECK ("correctOption" BETWEEN 0 AND 5), "coinAward" integer NOT NULL DEFAULT 5 CHECK ("coinAward" BETWEEN 0 AND 20));

CREATE TABLE "attempts" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "clientAttemptId" uuid NOT NULL, "studentId" uuid NOT NULL REFERENCES users(id), "classroomId" uuid NOT NULL REFERENCES classrooms(id), "exerciseId" uuid NOT NULL REFERENCES exercises(id), "skillCode" varchar(100) NOT NULL, "subject" varchar(30) NOT NULL, "selectedOption" integer NOT NULL, "correct" boolean NOT NULL, "awardedCoins" integer NOT NULL CHECK ("awardedCoins" >= 0), "occurredAt" timestamptz NOT NULL, "receivedAt" timestamptz NOT NULL, UNIQUE ("studentId", "clientAttemptId"));

CREATE TABLE "skill_progress" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "studentId" uuid NOT NULL REFERENCES users(id), "skillCode" varchar(100) NOT NULL, "subject" varchar(30) NOT NULL, "mastery" double precision NOT NULL DEFAULT 0.2 CHECK (mastery BETWEEN 0 AND 1), "attempts" integer NOT NULL DEFAULT 0, "correctAttempts" integer NOT NULL DEFAULT 0, "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("studentId", "skillCode"));

CREATE TABLE "growth_snapshots" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "studentId" uuid NOT NULL REFERENCES users(id), "classroomId" uuid NOT NULL REFERENCES classrooms(id), "skillCode" varchar(100) NOT NULL, "month" varchar(7) NOT NULL, "baseline" double precision NOT NULL, "latest" double precision NOT NULL, UNIQUE ("studentId", "skillCode", "month"));

CREATE TABLE "rewards" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "title" varchar(120) NOT NULL, "cost" integer NOT NULL CHECK (cost > 0), "stock" integer NOT NULL CHECK (stock >= 0), "active" boolean NOT NULL DEFAULT true);

CREATE TABLE "redemptions" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "studentId" uuid NOT NULL REFERENCES users(id), "rewardId" uuid NOT NULL REFERENCES rewards(id), "requestId" uuid NOT NULL, "cost" integer NOT NULL CHECK (cost > 0), "status" varchar(20) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','CLAIMED')), "claimedAt" timestamptz, "claimedBy" uuid REFERENCES users(id), UNIQUE ("studentId", "requestId"));

CREATE TABLE "audit_events" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), "actorId" uuid REFERENCES users(id), "jurisdictionId" uuid NOT NULL REFERENCES jurisdictions(id), "action" varchar(80) NOT NULL, "targetId" uuid, "metadata" jsonb NOT NULL DEFAULT '{}');

CREATE INDEX "idx_schools_0" ON "schools" ("jurisdictionId");

CREATE INDEX "idx_users_1" ON "users" ("jurisdictionId", "schoolId");

CREATE INDEX "idx_auth_sessions_2" ON "auth_sessions" ("userId");

CREATE INDEX "idx_classrooms_3" ON "classrooms" ("teacherId", "schoolId");

CREATE INDEX "idx_enrollments_4" ON "enrollments" ("studentId", "active");

CREATE INDEX "idx_lessons_5" ON "lessons" ("packId");

CREATE INDEX "idx_exercises_6" ON "exercises" ("lessonId");

CREATE INDEX "idx_attempts_7" ON "attempts" ("studentId", "exerciseId", "receivedAt");

CREATE INDEX "idx_attempts_8" ON "attempts" ("classroomId", "receivedAt");

CREATE INDEX "idx_rewards_9" ON "rewards" ("jurisdictionId");

CREATE INDEX "idx_audit_events_10" ON "audit_events" ("jurisdictionId", "createdAt");

CREATE UNIQUE INDEX "one_active_session_per_user" ON auth_sessions ("userId") WHERE "revokedAt" IS NULL;

INSERT INTO "migrations" ("timestamp", "name") VALUES (1790800000000, 'InitialSchema1790800000000');

CREATE TABLE "model_versions" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "version" varchar(60) NOT NULL UNIQUE,
      "method" varchar(200) NOT NULL,
      "source" varchar(30) NOT NULL,
      "active" boolean NOT NULL DEFAULT false,
      "fittedAt" timestamptz NOT NULL,
      "skills" integer NOT NULL CHECK (skills >= 0));

CREATE TABLE "skill_model_params" ("id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(),
      "modelVersion" varchar(60) NOT NULL REFERENCES model_versions(version) ON DELETE CASCADE,
      "skillCode" varchar(100) NOT NULL,
      "prior" double precision NOT NULL CHECK (prior > 0 AND prior < 1),
      "learn" double precision NOT NULL CHECK (learn > 0 AND learn < 1),
      "guess" double precision NOT NULL CHECK (guess > 0 AND guess < 1),
      "slip" double precision NOT NULL CHECK (slip > 0 AND slip < 1),
      "sequences" integer NOT NULL CHECK (sequences >= 0),
      "observations" integer NOT NULL CHECK (observations >= 0),
      UNIQUE ("modelVersion", "skillCode"),
      -- A model where guessing explains more than knowing is not usable.
      CHECK (guess + slip < 1));

CREATE INDEX "idx_skill_model_params_lookup" ON "skill_model_params" ("modelVersion", "skillCode");

CREATE UNIQUE INDEX "one_active_model" ON "model_versions" ("active") WHERE "active" = true;

INSERT INTO "migrations" ("timestamp", "name") VALUES (1790900000000, 'ModelParams1790900000000');

ALTER TABLE "attempts" ADD "source" varchar(20) NOT NULL DEFAULT 'device';

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791000000000, 'AttemptSource1791000000000');

CREATE TABLE "quizzes" (
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
      );

CREATE INDEX "IDX_quizzes_classroomId" ON "quizzes" ("classroomId");

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791100000000, 'Quizzes1791100000000');

ALTER TABLE "schools" ADD "barangay" varchar(80) NOT NULL DEFAULT '';

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791200000000, 'SchoolBarangay1791200000000');

CREATE TABLE "quiz_papers" (
        "id" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "quizId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        CONSTRAINT "PK_quiz_papers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quiz_papers_quizId_studentId" UNIQUE ("quizId", "studentId")
      );

CREATE INDEX "IDX_quiz_papers_quizId" ON "quiz_papers" ("quizId");

CREATE INDEX "IDX_quiz_papers_studentId" ON "quiz_papers" ("studentId");

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791200000000, 'QuizPapers1791200000000');

CREATE TABLE "devices" (
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
      );

CREATE INDEX "IDX_devices_jurisdictionId" ON "devices" ("jurisdictionId");

CREATE INDEX "IDX_devices_schoolId" ON "devices" ("schoolId");

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791200000000, 'Devices1791200000000');

ALTER TABLE "quiz_papers"
      ADD COLUMN "answers" jsonb,
      ADD COLUMN "score" integer,
      ADD COLUMN "gradedAt" timestamptz;

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791300000000, 'QuizResults1791300000000');

ALTER TABLE content_packs ADD COLUMN "expectedLessons" jsonb;

INSERT INTO "migrations" ("timestamp", "name") VALUES (1791400000000, 'ContentImport1791400000000');

COMMIT;
