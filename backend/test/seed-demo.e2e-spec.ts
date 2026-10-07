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
      'TRUNCATE audit_events, redemptions, rewards, growth_snapshots, skill_progress, attempts, exercises, lessons, content_packs, enrollments, classrooms, auth_sessions, users, schools, jurisdictions CASCADE',
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
});
