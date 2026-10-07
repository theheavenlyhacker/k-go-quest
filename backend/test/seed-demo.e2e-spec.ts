import { type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { databaseOptions } from '../src/database/data-source';
import { seedDemo, DEMO_PACK_FILE } from '../src/database/seed-demo';
import { setupApp } from '../src/setup-app';
import { quarterDateRange } from '../src/modules/learning/mastery';

const password = 'Demo-only-password-123!';
const TABLES = [
  'jurisdictions', 'schools', 'users', 'classrooms', 'enrollments', 'content_packs',
  'lessons', 'exercises', 'attempts', 'skill_progress', 'growth_snapshots', 'rewards',
];

describe('Demo seed on real PostgreSQL', () => {
  let app: INestApplication;
  let db: DataSource;
  const counts = async () =>
    Object.fromEntries(
      await Promise.all(
        TABLES.map(async (t) => [t, Number((await db.query(`SELECT count(*) FROM "${t}"`))[0].count)]),
      ),
    );
  const login = async (loginId: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ loginId, password, deviceId: 'demo-device-001' })
        .expect(201)
    ).body as { accessToken: string };
  const get = (token: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set({ Authorization: `Bearer ${token}` }).expect(200);

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error('Use npm run test:integration; TEST_DATABASE_URL must be disposable');
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DATABASE_SSL: 'false',
      DATABASE_SCHEMA: 'kgo',
      DATABASE_CA_PATH: '',
      DATABASE_CA: '',
      JWT_SECRET: 'integration-test-secret-is-at-least-forty-eight-characters-123456',
      SWAGGER_ENABLED: 'false',
      CORS_ORIGINS: 'http://localhost:8081',
    });
    const migrations = new DataSource(databaseOptions(process.env.TEST_DATABASE_URL, false));
    await migrations.initialize();
    await migrations.query('CREATE SCHEMA IF NOT EXISTS kgo');
    await migrations.runMigrations();
    await migrations.destroy();
    const { AppModule } = require('../src/app.module') as { AppModule: Type<unknown> };
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication({
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    db = app.get(DataSource);
    await db.query(
      'TRUNCATE audit_events, quizzes, redemptions, rewards, growth_snapshots, skill_progress, attempts, exercises, lessons, content_packs, enrollments, classrooms, auth_sessions, users, schools, jurisdictions CASCADE',
    );
    await seedDemo(db, { password });
  }, 120000);
  afterAll(async () => {
    await app?.close();
  });

  it('is idempotent: a second run leaves identical row counts, and --reset rebuilds the same shape', async () => {
    const first = await counts();
    expect(first.attempts).toBeGreaterThan(1000);
    expect(first.users).toBe(34); // admin + 3 teachers + 30 learners
    await seedDemo(db, { password });
    expect(await counts()).toEqual(first);
    await seedDemo(db, { password, reset: true });
    expect(await counts()).toEqual(first);
  }, 120000);

  it('marks all synthetic history as demo and nothing else', async () => {
    const [{ other }] = await db.query(`SELECT count(*) AS other FROM attempts WHERE source <> 'demo'`);
    expect(Number(other)).toBe(0);
  });

  it('gives the League three distinct values and every Classroom a Plateau Flag and a stale learner', async () => {
    const admin = await login('admin-demo');
    const league = (await get(admin.accessToken, '/reports/league')).body;
    expect(league.items).toHaveLength(3);
    expect(new Set(league.items.map((r: any) => r.growthPercentagePoints)).size).toBe(3);
    const teachers = ['teacher-demo', 'teacher-demo-2', 'teacher-demo-3'];
    const rooms = new Set<string>();
    for (const loginId of teachers) {
      const { accessToken } = await login(loginId);
      for (const room of league.items) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reports/classrooms/${room.classroomId}`)
          .set({ Authorization: `Bearer ${accessToken}` });
        if (res.status !== 200) continue;
        rooms.add(room.classroomId);
        const learners = res.body.learners as any[];
        expect(learners.some((l) => l.learningStatus === 'TEACHER_REVIEW_SUGGESTED')).toBe(true);
        expect(learners.some((l) => l.connectivityStatus === 'NO_RECENT_SYNC')).toBe(true);
      }
    }
    expect(rooms.size).toBe(3);
  });

  it('accepts a Starter Pack Attempt from a linked learner', async () => {
    const pack = JSON.parse(readFileSync(resolve(DEMO_PACK_FILE), 'utf8'));
    const exercise = pack.packs[0].lessons[0].exercises[0];
    const learner = await login('learner-01');
    const [{ id: classroomId }] = await db.query(
      `SELECT "classroomId" AS id FROM enrollments e JOIN users u ON u.id = e."studentId" WHERE u."loginId" = 'learner-01'`,
    );
    const res = await request(app.getHttpServer())
      .post('/api/v1/learning/sync')
      .set({ Authorization: `Bearer ${learner.accessToken}` })
      .send({
        attempts: [
          { clientAttemptId: randomUUID(), classroomId, exerciseId: exercise.id, selectedOption: 0, occurredAt: new Date().toISOString() },
        ],
      })
      .expect(201);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].duplicate).toBe(false);
  });

  it('reconciles impact and engagement numbers to direct SQL counts on the seeded data and blocks leakage', async () => {
    const admin = await login('admin-demo');
    const [{ jid }] = await db.query(
      `SELECT "jurisdictionId" AS jid FROM users WHERE "loginId" = 'admin-demo'`,
    );

    const [{ sample_quarter }] = await db.query(
      `SELECT '2026-Q' || CEIL(EXTRACT(MONTH FROM a."occurredAt" AT TIME ZONE 'Asia/Manila') / 3.0)::text AS sample_quarter
       FROM attempts a
       JOIN users u ON u.id = a."studentId"
       WHERE u."jurisdictionId" = $1
       GROUP BY sample_quarter
       ORDER BY count(*) DESC
       LIMIT 1`,
      [jid],
    );

    const { start, end } = quarterDateRange(sample_quarter);

    // Direct SQL counts for the impact report
    const [sqlLearners] = await db.query(
      `SELECT COUNT(DISTINCT a."studentId")::int AS c
       FROM attempts a
       JOIN users u ON u.id = a."studentId"
       WHERE u."jurisdictionId" = $1 AND u.role = 'STUDENT'
         AND a."occurredAt" >= $2 AND a."occurredAt" < $3`,
      [jid, start, end],
    );

    const [sqlAttempts] = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE a."receivedAt" - a."occurredAt" > interval '1 hour')::int AS offline
       FROM attempts a
       JOIN users u ON u.id = a."studentId"
       WHERE u."jurisdictionId" = $1 AND u.role = 'STUDENT'
         AND a."occurredAt" >= $2 AND a."occurredAt" < $3`,
      [jid, start, end],
    );

    const sqlCompleted = await db.query(
      `SELECT a."studentId", l.id AS "lessonId", s.barangay
       FROM attempts a
       JOIN users u ON u.id = a."studentId"
       JOIN schools s ON s.id = u."schoolId"
       JOIN exercises e ON e.id = a."exerciseId"
       JOIN lessons l ON l.id = e."lessonId"
       JOIN content_packs p ON p.id = l."packId"
       JOIN (
         SELECT "lessonId", COUNT(*) AS total_exercises
         FROM exercises
         GROUP BY "lessonId"
       ) ex_counts ON ex_counts."lessonId" = l.id
       WHERE u."jurisdictionId" = $1
         AND p."jurisdictionId" = $1
         AND u.role = 'STUDENT'
         AND a."occurredAt" >= $2 AND a."occurredAt" < $3
       GROUP BY a."studentId", l.id, s.barangay, ex_counts.total_exercises
       HAVING COUNT(DISTINCT a."exerciseId") = ex_counts.total_exercises`,
      [jid, start, end],
    );

    const impactRes = await get(
      admin.accessToken,
      `/reports/impact?quarter=${sample_quarter}`,
    );
    expect(impactRes.body.quarter).toBe(sample_quarter);
    expect(impactRes.body.learnersReached).toBe(sqlLearners.c);
    expect(impactRes.body.lessonsCompleted).toBe(sqlCompleted.length);
    const expectedShare = sqlAttempts.total
      ? Number((sqlAttempts.offline / sqlAttempts.total).toFixed(4))
      : 0;
    expect(impactRes.body.offlineUsageShare).toBeCloseTo(expectedShare, 4);
    expect(impactRes.body.reachByBarangay.map((r: any) => r.barangay)).toEqual([
      'Pembo',
      'Cembo',
    ]);

    // Engagement reconciliation
    const engRes = await get(admin.accessToken, '/reports/engagement?days=7');
    expect(engRes.body).toHaveLength(7);
    for (const dayItem of engRes.body) {
      const [sqlDay] = await db.query(
        `SELECT COUNT(DISTINCT a."studentId")::int AS c
         FROM attempts a
         JOIN users u ON u.id = a."studentId"
         WHERE u."jurisdictionId" = $1 AND u.role = 'STUDENT'
           AND TO_CHAR(a."occurredAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') = $2`,
        [jid, dayItem.date],
      );
      expect(dayItem.activeLearners).toBe(sqlDay.c);
    }

    // Isolation: seed another jurisdiction and verify no leakage
    const otherJid = randomUUID();
    await db.query(
      `INSERT INTO jurisdictions (id, name) VALUES ($1, 'Other Jurisdiction')`,
      [otherJid],
    );
    const otherSchoolId = randomUUID();
    await db.query(
      `INSERT INTO schools (id, "jurisdictionId", name, barangay) VALUES ($1, $2, 'Other School', 'Other Barangay')`,
      [otherSchoolId, otherJid],
    );
    const otherTeacherId = randomUUID();
    await db.query(
      `INSERT INTO users (id, "loginId", role, "jurisdictionId", "schoolId", alias, "passwordHash", active)
       VALUES ($1, 'other-teacher-x', 'TEACHER', $2, $3, 'Other Teacher', 'fakehash', true)`,
      [otherTeacherId, otherJid, otherSchoolId],
    );
    const otherClassroomId = randomUUID();
    await db.query(
      `INSERT INTO classrooms (id, "schoolId", "teacherId", name, grade) VALUES ($1, $2, $3, 'Other Class', 5)`,
      [otherClassroomId, otherSchoolId, otherTeacherId],
    );
    const otherStudentId = randomUUID();
    await db.query(
      `INSERT INTO users (id, "loginId", role, "jurisdictionId", "schoolId", alias, "passwordHash", active)
       VALUES ($1, 'other-student-x', 'STUDENT', $2, $3, 'Other Student', 'fakehash', true)`,
      [otherStudentId, otherJid, otherSchoolId],
    );
    const otherPackId = randomUUID();
    await db.query(
      `INSERT INTO content_packs (id, "jurisdictionId", title, subject, grade, version, published)
       VALUES ($1, $2, 'Other Pack', 'MATH', 5, '1.0', true)`,
      [otherPackId, otherJid],
    );
    const otherLessonId = randomUUID();
    await db.query(
      `INSERT INTO lessons (id, "packId", title, "skillCode", body)
       VALUES ($1, $2, 'Other Lesson', 'math5.fractions.add', 'Body')`,
      [otherLessonId, otherPackId],
    );
    const otherExerciseId = randomUUID();
    await db.query(
      `INSERT INTO exercises (id, "lessonId", prompt, options, "correctOption")
       VALUES ($1, $2, 'Prompt', '["A", "B"]'::jsonb, 0)`,
      [otherExerciseId, otherLessonId],
    );
    await db.query(
      `INSERT INTO attempts (id, "clientAttemptId", "studentId", "classroomId", "exerciseId", "skillCode", subject, "selectedOption", correct, "awardedCoins", "occurredAt", "receivedAt", source)
       VALUES ($1, $2, $3, $4, $5, 'math5.fractions.add', 'MATH', 0, true, 5, $6, $6, 'device')`,
      [
        randomUUID(),
        randomUUID(),
        otherStudentId,
        otherClassroomId,
        otherExerciseId,
        new Date(start.getTime() + 86400000),
      ],
    );

    const isolatedImpact = await get(
      admin.accessToken,
      `/reports/impact?quarter=${sample_quarter}`,
    );
    expect(isolatedImpact.body.learnersReached).toBe(sqlLearners.c);
    expect(
      isolatedImpact.body.reachByBarangay.some(
        (r: any) => r.barangay === 'Other Barangay',
      ),
    ).toBe(false);

    const isolatedEng = await get(admin.accessToken, '/reports/engagement?days=7');
    for (let i = 0; i < 7; i++) {
      expect(isolatedEng.body[i].activeLearners).toBe(
        engRes.body[i].activeLearners,
      );
    }
  });
});

