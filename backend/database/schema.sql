-- K-Go Quests: fresh PostgreSQL schema kgo.
-- Run once in defaultdb. Includes TypeORM migration bookkeeping.
-- Existing public tables are not changed. This script contains no credentials or user data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "kgo";
SET LOCAL search_path = "kgo";

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

CREATE TABLE "migrations" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL);

INSERT INTO "migrations" ("timestamp", "name") VALUES (1790800000000, 'InitialSchema1790800000000');

COMMIT;
