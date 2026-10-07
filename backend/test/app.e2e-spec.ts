import { type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { databaseOptions } from '../src/database/data-source';
import {
  Attempt,
  Classroom,
  ContentPack,
  Enrollment,
  Exercise,
  Jurisdiction,
  Lesson,
  Redemption,
  Reward,
  Role,
  School,
  SkillProgress,
  Subject,
  User,
} from '../src/database/entities';
import { hashPassword } from '../src/modules/auth/password';
import { setupApp } from '../src/setup-app';

describe('K-Go API on real PostgreSQL', () => {
  let app: INestApplication;
  let db: DataSource;
  let data: {
    admin: User;
    otherAdmin: User;
    teacher: User;
    otherTeacher: User;
    student: User;
    classroom: Classroom;
    otherClass: Classroom;
    pack: ContentPack;
    lesson: Lesson;
    exercises: Exercise[];
    reward: Reward;
  };
  const password = 'Test-only-password-123!';
  let passwordHash: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (loginId: string, deviceId = 'test-device-001') => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ loginId, password, deviceId })
      .expect(201);
    return result.body as { accessToken: string; refreshToken: string };
  };
  const attempt = (exercise: Exercise = data.exercises[0]) => ({
    clientAttemptId: randomUUID(),
    classroomId: data.classroom.id,
    exerciseId: exercise.id,
    selectedOption: 0,
    occurredAt: new Date().toISOString(),
  });
  const sync = (token: string, attempts: unknown[]) =>
    request(app.getHttpServer())
      .post('/api/v1/learning/sync')
      .set(auth(token))
      .send({ attempts });
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error(
        'Use npm run test:integration; TEST_DATABASE_URL must be disposable',
      );
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_SSL = 'false';
    process.env.DATABASE_SCHEMA = 'kgo';
    process.env.DATABASE_CA_PATH = '';
    process.env.DATABASE_CA = '';
    process.env.JWT_SECRET =
      'integration-test-secret-is-at-least-forty-eight-characters-123456';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.CORS_ORIGINS = 'http://localhost:8081';
    passwordHash = await hashPassword(password);
    const setup = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await setup.connect();
    try {
      await setup.query('CREATE SCHEMA IF NOT EXISTS kgo');
      // A different app can use public.users; NestJS must never read or truncate it.
      await setup.query(
        'CREATE TABLE IF NOT EXISTS public.users (foreign_marker text PRIMARY KEY)',
      );
      await setup.query(
        "INSERT INTO public.users VALUES ('other-app') ON CONFLICT DO NOTHING",
      );
    } finally {
      await setup.end();
    }
    const migrations = new DataSource(
      databaseOptions(process.env.TEST_DATABASE_URL, false),
    );
    await migrations.initialize();
    await migrations.runMigrations();
    await migrations.destroy();
  }, 60000);
  beforeEach(async () => {
    const { AppModule } = require('../src/app.module') as {
      AppModule: Type<unknown>;
    };
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false, bodyParser: false });
    setupApp(app);
    await app.init();
    db = app.get(DataSource);
    await db.query(
      'TRUNCATE audit_events, quizzes, redemptions, rewards, growth_snapshots, skill_progress, attempts, exercises, lessons, content_packs, enrollments, classrooms, auth_sessions, users, schools, jurisdictions CASCADE',
    );
    const lgu = await db.manager.save(
      Jurisdiction,
      db.manager.create(Jurisdiction, { name: 'LGU A' }),
    );
    const otherLgu = await db.manager.save(
      Jurisdiction,
      db.manager.create(Jurisdiction, { name: 'LGU B' }),
    );
    const school = await db.manager.save(
      School,
      db.manager.create(School, { name: 'School A', jurisdictionId: lgu.id }),
    );
    const makeUser = (loginId: string, role: Role, jurisdictionId = lgu.id) =>
      db.manager.save(
        User,
        db.manager.create(User, {
          loginId,
          alias: loginId,
          role,
          jurisdictionId,
          schoolId: role === Role.LGU_ADMIN ? null : school.id,
          passwordHash,
          lockedUntil: null,
        }),
      );
    const admin = await makeUser('admin-test', Role.LGU_ADMIN);
    const otherAdmin = await makeUser(
      'other-admin',
      Role.LGU_ADMIN,
      otherLgu.id,
    );
    const teacher = await makeUser('teacher-test', Role.TEACHER);
    const otherTeacher = await makeUser('other-teacher', Role.TEACHER);
    const student = await makeUser('student-test', Role.STUDENT);
    const classroom = await db.manager.save(
      Classroom,
      db.manager.create(Classroom, {
        name: 'Class A',
        grade: 5,
        schoolId: school.id,
        teacherId: teacher.id,
      }),
    );
    const otherClass = await db.manager.save(
      Classroom,
      db.manager.create(Classroom, {
        name: 'Class B',
        grade: 5,
        schoolId: school.id,
        teacherId: otherTeacher.id,
      }),
    );
    await db.manager.save(
      Enrollment,
      db.manager.create(Enrollment, {
        classroomId: classroom.id,
        studentId: student.id,
      }),
    );
    const pack = await db.manager.save(
      ContentPack,
      db.manager.create(ContentPack, {
        jurisdictionId: lgu.id,
        title: 'Original fractions',
        grade: 5,
        subject: Subject.MATH,
        version: '1.0',
        published: true,
      }),
    );
    const lesson = await db.manager.save(
      Lesson,
      db.manager.create(Lesson, {
        packId: pack.id,
        title: 'Fractions',
        skillCode: 'math5.fractions',
        body: 'Use common denominators',
        hints: { en: 'Match denominators first' },
      }),
    );
    const exercises: Exercise[] = [];
    for (let i = 0; i < 3; i++)
      exercises.push(
        await db.manager.save(
          Exercise,
          db.manager.create(Exercise, {
            lessonId: lesson.id,
            prompt: `Exercise ${i}`,
            options: ['Correct', 'Incorrect'],
            correctOption: 0,
            coinAward: 5,
          }),
        ),
      );
    const reward = await db.manager.save(
      Reward,
      db.manager.create(Reward, {
        title: 'School supplies',
        cost: 10,
        stock: 2,
        jurisdictionId: lgu.id,
      }),
    );
    data = {
      admin,
      otherAdmin,
      teacher,
      otherTeacher,
      student,
      classroom,
      otherClass,
      pack,
      lesson,
      exercises,
      reward,
    };
  });
  afterEach(async () => {
    if (app) await app.close();
  });

  it('exposes health, secure headers, and protected business endpoints', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['x-request-id']).toBeDefined();
    expect(result.headers['x-powered-by']).toBeUndefined();
    await request(app.getHttpServer()).get('/api/v1/content/packs').expect(401);
  });
  it('rejects injected role fields, strings for numbers, and forged coin amounts', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        loginId: 'student-test',
        password,
        deviceId: 'test-device-001',
        role: 'LGU_ADMIN',
      })
      .expect(400);
    const { accessToken } = await login('student-test');
    await sync(accessToken, [{ ...attempt(), selectedOption: '0' }]).expect(
      400,
    );
    await sync(accessToken, [{ ...attempt(), awardedCoins: 999 }]).expect(400);
  });
  it('rejects malformed and oversized requests with trace IDs and permits authorized browser deletion', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expect(invalid.headers['x-request-id']).toBeDefined();
    expect(invalid.body.requestId).toBe(invalid.headers['x-request-id']);
    expect(invalid.headers['cache-control']).toBe('no-store');
    const oversized = await request(app.getHttpServer())
      .post('/api/v1/learning/sync')
      .send({ padding: 'x'.repeat(300000) })
      .expect(413);
    expect(oversized.body.requestId).toBe(oversized.headers['x-request-id']);
    const preflight = await request(app.getHttpServer())
      .options(
        `/api/v1/classrooms/${data.classroom.id}/enrollments/${data.student.id}`,
      )
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://localhost:8081',
    );
    expect(preflight.headers['access-control-allow-methods']).toContain(
      'DELETE',
    );
    const denied = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://unknown.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: `${'-'.repeat(36)}.${'a'.repeat(64)}`,
        deviceId: 'test-device-001',
      })
      .expect(400);
  });
  it('blocks student provisioning and hides credential fields', async () => {
    const student = await login('student-test');
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set(auth(student.accessToken))
      .expect(403);
    const admin = await login('admin-test');
    const result = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set(auth(admin.accessToken))
      .expect(200);
    expect(JSON.stringify(result.body)).not.toMatch(
      /passwordHash|refreshHash|lockedUntil/,
    );
    expect(result.body.total).toBe(4);
  });
  it('blocks cross-jurisdiction provisioning and content downloads', async () => {
    const { accessToken } = await login('other-admin');
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(accessToken))
      .send({
        loginId: 'new-student',
        password,
        alias: 'New learner',
        role: 'STUDENT',
        schoolId: data.classroom.schoolId,
      })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/content/packs/${data.pack.id}/download`)
      .set(auth(accessToken))
      .expect(404);
  });
  it('blocks teachers outside an assigned classroom', async () => {
    const { accessToken } = await login('other-teacher');
    await request(app.getHttpServer())
      .get(`/api/v1/reports/classrooms/${data.classroom.id}`)
      .set(auth(accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/learning/learners/${data.student.id}/progress`)
      .set(auth(accessToken))
      .expect(403);
  });
  it('rotates refresh tokens, binds devices, and revokes access on logout', async () => {
    const tokens = await login('student-test');
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken, deviceId: 'wrong-device-123' })
      .expect(401);
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken, deviceId: 'test-device-001' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken, deviceId: 'test-device-001' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(auth(refreshed.body.accessToken))
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(refreshed.body.accessToken))
      .expect(401);
  });
  it('invalidates the previous device when a new session starts', async () => {
    const first = await login('student-test');
    const second = await login('student-test', 'test-device-002');
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(first.accessToken))
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(second.accessToken))
      .expect(200);
  });
  it('locks an account after five failed passwords', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          loginId: 'student-test',
          password: 'wrong-password-123',
          deviceId: 'test-device-001',
        })
        .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ loginId: 'student-test', password, deviceId: 'test-device-001' })
      .expect(401);
  });
  it('rate limits repeated login requests', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          loginId: 'missing-user',
          password,
          deviceId: 'test-device-001',
        })
        .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ loginId: 'missing-user', password, deviceId: 'test-device-001' })
      .expect(429);
  });
  it('omits answer keys from student packs and quests', async () => {
    const { accessToken } = await login('student-test');
    const pack = await request(app.getHttpServer())
      .get(`/api/v1/content/packs/${data.pack.id}/download`)
      .set(auth(accessToken))
      .expect(200);
    expect(JSON.stringify(pack.body)).not.toContain('correctOption');
    expect(pack.body.checksum).toMatch(/^[a-f0-9]{64}$/);
    const quests = await request(app.getHttpServer())
      .get('/api/v1/learning/quests')
      .set(auth(accessToken))
      .expect(200);
    expect(quests.body.items).toHaveLength(3);
    expect(JSON.stringify(quests.body)).not.toContain('correctOption');
  });
  it('grades sync, makes retries idempotent, and prevents repeat farming', async () => {
    const { accessToken } = await login('student-test');
    const input = attempt();
    const first = await sync(accessToken, [input]).expect(201);
    expect(first.body.coinBalance).toBe(5);
    const retry = await sync(accessToken, [input]).expect(201);
    expect(retry.body.awardedCoins).toBe(0);
    expect(retry.body.results[0].duplicate).toBe(true);
    await sync(accessToken, [{ ...input, selectedOption: 1 }]).expect(409);
    const repeated = await sync(accessToken, [
      { ...input, clientAttemptId: randomUUID() },
    ]).expect(201);
    expect(repeated.body.coinBalance).toBe(5);
    expect(
      (
        await db
          .getRepository(SkillProgress)
          .findOneByOrFail({ studentId: data.student.id })
      ).attempts,
    ).toBe(1);
  });
  it('serializes simultaneous duplicate uploads', async () => {
    const { accessToken } = await login('student-test');
    const input = attempt();
    const results = await Promise.all(
      [1, 2].map(() => sync(accessToken, [input]).expect(201)),
    );
    expect(results.reduce((sum, r) => sum + r.body.awardedCoins, 0)).toBe(5);
    expect(await db.getRepository(Attempt).count()).toBe(1);
  });
  it('rolls back a whole sync batch when a later exercise is invalid', async () => {
    const { accessToken } = await login('student-test');
    await sync(accessToken, [
      attempt(),
      { ...attempt(), exerciseId: randomUUID() },
    ]).expect(404);
    expect(await db.getRepository(Attempt).count()).toBe(0);
    expect(
      (await db.getRepository(User).findOneByOrFail({ id: data.student.id }))
        .coins,
    ).toBe(0);
  });
  it('rejects future timestamps and unenrolled classrooms', async () => {
    const { accessToken } = await login('student-test');
    await sync(accessToken, [
      {
        ...attempt(),
        occurredAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ]).expect(400);
    await sync(accessToken, [
      { ...attempt(), classroomId: data.otherClass.id },
    ]).expect(403);
  });
  it('separates connectivity from learning warnings', async () => {
    const { accessToken } = await login('teacher-test');
    const report = await request(app.getHttpServer())
      .get(`/api/v1/reports/classrooms/${data.classroom.id}`)
      .set(auth(accessToken))
      .expect(200);
    expect(report.body.learners[0].connectivityStatus).toBe('NO_RECENT_SYNC');
    expect(report.body.learners[0].learningStatus).toBe('INSUFFICIENT_DATA');
  });
  it('returns aggregate LGU impact reports', async () => {
    const { accessToken } = await login('admin-test');
    const report = await request(app.getHttpServer())
      .get('/api/v1/reports/impact')
      .set(auth(accessToken))
      .expect(200);
    expect(report.body.activeStudents).toBe(1);
    expect(JSON.stringify(report.body)).not.toContain('student-test');
    expect(report.body.meanEstimatedMastery).toBeNull();
  });
  it('keeps published content immutable and quiz keys teacher-only', async () => {
    const admin = await login('admin-test');
    await request(app.getHttpServer())
      .post(`/api/v1/content/packs/${data.pack.id}/lessons`)
      .set(auth(admin.accessToken))
      .send({
        title: 'Changed lesson',
        skillCode: 'math',
        body: 'New lesson content',
        hints: { en: 'Hint' },
      })
      .expect(409);
    const student = await login('student-test');
    await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth(student.accessToken))
      .send({ classroomId: data.classroom.id, subject: 'MATH', itemCount: 3 })
      .expect(403);
  });
  it('lets a Teacher build, edit and publish a Quiz that others cannot touch', async () => {
    const teacher = await login('teacher-test');
    const other = await login('other-teacher');
    const student = await login('student-test');
    const http = () => request(app.getHttpServer());
    const draft = await http()
      .post('/api/v1/quizzes')
      .set(auth(teacher.accessToken))
      .send({ classroomId: data.classroom.id, subject: 'MATH', itemCount: 3 })
      .expect(201);
    expect(draft.body.status).toBe('DRAFT');
    expect(draft.body.skillCodes).toEqual(['math5.fractions']);
    expect(draft.body.answerKey).toHaveLength(3);
    const id = draft.body.id as string;
    const listed = await http()
      .get(`/api/v1/quizzes?classroomId=${data.classroom.id}`)
      .set(auth(teacher.accessToken))
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain('correctOption');
    const skills = await http()
      .get(`/api/v1/quizzes/skills?classroomId=${data.classroom.id}&subject=MATH`)
      .set(auth(teacher.accessToken))
      .expect(200);
    expect(skills.body[0]).toMatchObject({ skillCode: 'math5.fractions', suggested: true });
    // Another Teacher's Classroom is closed to read and edit; Learners never see keys.
    await http().get(`/api/v1/quizzes/${id}`).set(auth(other.accessToken)).expect(403);
    await http()
      .patch(`/api/v1/quizzes/${id}`)
      .set(auth(other.accessToken))
      .send({ title: 'Mine now' })
      .expect(403);
    await http().get(`/api/v1/quizzes/${id}`).set(auth(student.accessToken)).expect(403);
    await http()
      .get(`/api/v1/quizzes?classroomId=${data.classroom.id}`)
      .set(auth(student.accessToken))
      .expect(403);
    // Remove an item, rename, then publish.
    const remaining = draft.body.questions.slice(1).map((q: { id: string }) => q.id);
    const edited = await http()
      .patch(`/api/v1/quizzes/${id}`)
      .set(auth(teacher.accessToken))
      .send({ title: 'Fractions check', exerciseIds: remaining })
      .expect(200);
    expect(edited.body.questionCount).toBe(2);
    expect(edited.body.title).toBe('Fractions check');
    const swapped = await http()
      .patch(`/api/v1/quizzes/${id}`)
      .set(auth(teacher.accessToken))
      .send({ replaceExerciseId: remaining[0] })
      .expect(200);
    expect(swapped.body.questions.map((q: { id: string }) => q.id)).not.toContain(remaining[0]);
    await http().post(`/api/v1/quizzes/${id}/publish`).set(auth(teacher.accessToken)).expect(201);
    await http()
      .patch(`/api/v1/quizzes/${id}`)
      .set(auth(teacher.accessToken))
      .send({ title: 'Too late' })
      .expect(409);
    await http().post(`/api/v1/quizzes/${id}/publish`).set(auth(teacher.accessToken)).expect(409);
  });
  it('deducts coins once, scopes vouchers, prevents double claims and voucher login', async () => {
    const student = await login('student-test');
    await db.getRepository(User).update(data.student.id, { coins: 15 });
    const input = { requestId: randomUUID(), rewardId: data.reward.id };
    const first = await request(app.getHttpServer())
      .post('/api/v1/rewards/redemptions')
      .set(auth(student.accessToken))
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/rewards/redemptions')
      .set(auth(student.accessToken))
      .send(input)
      .expect(201);
    expect(
      (await db.getRepository(User).findOneByOrFail({ id: data.student.id }))
        .coins,
    ).toBe(5);
    const otherAdmin = await login('other-admin');
    await request(app.getHttpServer())
      .post(`/api/v1/rewards/redemptions/${first.body.redemption.id}/claim`)
      .set(auth(otherAdmin.accessToken))
      .expect(404);
    const admin = await login('admin-test');
    await request(app.getHttpServer())
      .post(`/api/v1/rewards/redemptions/${first.body.redemption.id}/claim`)
      .set(auth(admin.accessToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/rewards/redemptions/${first.body.redemption.id}/claim`)
      .set(auth(admin.accessToken))
      .expect(409);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(first.body.qrToken))
      .expect(401);
  });
  it('prevents concurrent wallet overspending', async () => {
    const { accessToken } = await login('student-test');
    await db.getRepository(User).update(data.student.id, { coins: 10 });
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/rewards/redemptions')
          .set(auth(accessToken))
          .send({ requestId: randomUUID(), rewardId: data.reward.id }),
      ),
    );
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(await db.getRepository(Redemption).count()).toBe(1);
    expect(
      (await db.getRepository(User).findOneByOrFail({ id: data.student.id }))
        .coins,
    ).toBe(0);
  });
  it('isolates the NestJS schema from another application and checks schema readiness', async () => {
    expect(
      (await db.query('SELECT foreign_marker FROM public.users'))[0]
        .foreign_marker,
    ).toBe('other-app');
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    await db.query(
      'ALTER TABLE kgo.attempts RENAME TO attempts_temporarily_unavailable',
    );
    try {
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503);
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    } finally {
      await db.query(
        'ALTER TABLE kgo.attempts_temporarily_unavailable RENAME TO attempts',
      );
    }
  });
  it('lets only the owning LGU reset a password and revokes existing sessions', async () => {
    const student = await login('student-test');
    const teacher = await login('teacher-test');
    const otherAdmin = await login('other-admin');
    const path = `/api/v1/users/${data.student.id}/password`;
    const payload = { newPassword: 'New-recovered-password-123!' };
    await request(app.getHttpServer())
      .post(path)
      .set(auth(teacher.accessToken))
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set(auth(otherAdmin.accessToken))
      .send(payload)
      .expect(404);
    const admin = await login('admin-test');
    await request(app.getHttpServer())
      .post(path)
      .set(auth(admin.accessToken))
      .send({ newPassword: 'short' })
      .expect(400);
    const result = await request(app.getHttpServer())
      .post(path)
      .set(auth(admin.accessToken))
      .send(payload)
      .expect(201);
    expect(result.body.changed).toBe(true);
    expect(JSON.stringify(result.body)).not.toContain(payload.newPassword);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(student.accessToken))
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ loginId: 'student-test', password, deviceId: 'test-device-001' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        loginId: 'student-test',
        password: payload.newPassword,
        deviceId: 'test-device-001',
      })
      .expect(201);
  });
  it('supports a complete draft authoring and publishing workflow without exposing private keys', async () => {
    const admin = await login('admin-test');
    const otherAdmin = await login('other-admin');
    const student = await login('student-test');
    const pack = await request(app.getHttpServer())
      .post('/api/v1/content/packs')
      .set(auth(admin.accessToken))
      .send({
        title: 'Science demo',
        subject: Subject.SCIENCE,
        grade: 5,
        version: '1.0',
        attribution: 'Original test content',
      })
      .expect(201);
    const path = `/api/v1/content/packs/${pack.body.id}`;
    const drafts = await request(app.getHttpServer())
      .get('/api/v1/content/packs?status=draft')
      .set(auth(admin.accessToken))
      .expect(200);
    expect(drafts.body.items.map((p: { id: string }) => p.id)).toContain(
      pack.body.id,
    );
    await request(app.getHttpServer())
      .get('/api/v1/content/packs?status=draft')
      .set(auth(student.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(path)
      .set(auth(otherAdmin.accessToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(path)
      .set(auth(student.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`${path}/download`)
      .set(auth(student.accessToken))
      .expect(404);
    await request(app.getHttpServer())
      .post(`${path}/publish`)
      .set(auth(admin.accessToken))
      .expect(400);
    const lesson = await request(app.getHttpServer())
      .post(`${path}/lessons`)
      .set(auth(admin.accessToken))
      .send({
        title: 'States of water',
        skillCode: 'science5.water.states',
        body: 'Water can be solid ice, liquid water or water vapor.',
        hints: { en: 'Think about freezing and boiling.' },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`${path}/publish`)
      .set(auth(admin.accessToken))
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/content/lessons/${lesson.body.id}/exercises`)
      .set(auth(admin.accessToken))
      .send({
        prompt: 'What is ice?',
        options: ['Liquid', 'Solid'],
        correctOption: 1,
        coinAward: 5,
      })
      .expect(201);
    const detail = await request(app.getHttpServer())
      .get(path)
      .set(auth(admin.accessToken))
      .expect(200);
    expect(detail.body.lessons[0].exercises[0].correctOption).toBe(1);
    await request(app.getHttpServer())
      .post(`${path}/publish`)
      .set(auth(admin.accessToken))
      .expect(201);
    const download = await request(app.getHttpServer())
      .get(`${path}/download`)
      .set(auth(student.accessToken))
      .expect(200);
    expect(JSON.stringify(download.body)).not.toContain('correctOption');
    expect(download.body.lessons[0].exercises).toHaveLength(1);
  });
  it('lets assigned teachers end enrollment, retains history, and allows safe re-enrollment', async () => {
    const student = await login('student-test');
    const input = attempt();
    await sync(student.accessToken, [input]).expect(201);
    const teacher = await login('teacher-test');
    const otherTeacher = await login('other-teacher');
    const path = `/api/v1/classrooms/${data.classroom.id}/enrollments/${data.student.id}`;
    await request(app.getHttpServer())
      .delete(path)
      .set(auth(otherTeacher.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .delete(path)
      .set(auth(student.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .delete(path)
      .set(auth(teacher.accessToken))
      .expect(200);
    await request(app.getHttpServer())
      .delete(path)
      .set(auth(teacher.accessToken))
      .expect(200);
    await sync(student.accessToken, [input]).expect(201);
    await sync(student.accessToken, [attempt(data.exercises[1])]).expect(403);
    expect(await db.getRepository(Attempt).count()).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/v1/classrooms/${data.classroom.id}/enrollments`)
      .set(auth(teacher.accessToken))
      .send({ studentId: data.student.id })
      .expect(201);
    expect(await db.getRepository(Enrollment).count()).toBe(1);
    await sync(student.accessToken, [attempt(data.exercises[1])]).expect(201);
  });
  it('lets the owning LGU restock and disable rewards without changing issued voucher costs', async () => {
    const student = await login('student-test');
    await db.getRepository(User).update(data.student.id, { coins: 20 });
    const issued = await request(app.getHttpServer())
      .post('/api/v1/rewards/redemptions')
      .set(auth(student.accessToken))
      .send({ requestId: randomUUID(), rewardId: data.reward.id })
      .expect(201);
    const otherAdmin = await login('other-admin');
    const admin = await login('admin-test');
    const path = `/api/v1/rewards/${data.reward.id}`;
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(admin.accessToken))
      .send({ stock: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${data.student.id}`)
      .set(auth(admin.accessToken))
      .send({ active: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(student.accessToken))
      .send({ stock: 100 })
      .expect(403);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(otherAdmin.accessToken))
      .send({ stock: 100 })
      .expect(404);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(admin.accessToken))
      .send({ stock: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(path)
      .set(auth(admin.accessToken))
      .send({ stock: 100, cost: 30, active: false })
      .expect(200);
    const catalog = await request(app.getHttpServer())
      .get('/api/v1/rewards')
      .set(auth(student.accessToken))
      .expect(200);
    expect(catalog.body.items).toHaveLength(0);
    await request(app.getHttpServer())
      .get('/api/v1/rewards?status=all')
      .set(auth(student.accessToken))
      .expect(403);
    const all = await request(app.getHttpServer())
      .get('/api/v1/rewards?status=all')
      .set(auth(admin.accessToken))
      .expect(200);
    expect(all.body.items[0].stock).toBe(100);
    await request(app.getHttpServer())
      .post('/api/v1/rewards/redemptions')
      .set(auth(student.accessToken))
      .send({ requestId: randomUUID(), rewardId: data.reward.id })
      .expect(404);
    expect(
      (
        await db
          .getRepository(Redemption)
          .findOneByOrFail({ id: issued.body.redemption.id })
      ).cost,
    ).toBe(10);
    await request(app.getHttpServer())
      .post(`/api/v1/rewards/redemptions/${issued.body.redemption.id}/claim`)
      .set(auth(admin.accessToken))
      .expect(201);
  });
  it('acknowledges a previously committed attempt after its upload window or enrollment ends', async () => {
    const student = await login('student-test');
    const input = attempt();
    await sync(student.accessToken, [input]).expect(201);
    // Simulate elapsed time after an initial valid upload whose acknowledgment was lost.
    input.occurredAt = new Date(Date.now() - 31 * 86400000).toISOString();
    await db
      .getRepository(Attempt)
      .update(
        { studentId: data.student.id, clientAttemptId: input.clientAttemptId },
        { occurredAt: new Date(input.occurredAt) },
      );
    await db
      .getRepository(Enrollment)
      .update({ studentId: data.student.id }, { active: false });
    const result = await sync(student.accessToken, [input]).expect(201);
    expect(result.body.results[0].duplicate).toBe(true);
    expect(result.body.awardedCoins).toBe(0);
    expect(result.body.coinBalance).toBe(5);
    await sync(student.accessToken, [{ ...input, selectedOption: 1 }]).expect(
      409,
    );
    await sync(student.accessToken, [attempt()]).expect(403);
  });
  it('invalidates sessions after password changes and deactivation', async () => {
    const student = await login('student-test');
    await request(app.getHttpServer())
      .post('/api/v1/auth/password')
      .set(auth(student.accessToken))
      .send({
        currentPassword: password,
        newPassword: 'Changed-test-password-123',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(student.accessToken))
      .expect(401);
    const teacher = await login('teacher-test');
    const admin = await login('admin-test');
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${data.teacher.id}`)
      .set(auth(admin.accessToken))
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(teacher.accessToken))
      .expect(401);
  });
});
