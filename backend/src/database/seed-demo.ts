import 'dotenv/config';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { In, type DataSource } from 'typeorm';
import dataSource from './data-source';
import {
  Attempt,
  AuditEvent,
  AuthSession,
  Classroom,
  Enrollment,
  GrowthSnapshot,
  Jurisdiction,
  Redemption,
  Reward,
  Role,
  School,
  SkillProgress,
  Subject,
  User,
} from './entities';
import { importPack, readCatalogue } from './import-pack';
import { hashPassword } from '../modules/auth/password';
import {
  DEFAULT_PARAMS,
  manilaMonth,
  updateMastery,
} from '../modules/learning/mastery';

/**
 * The demo jurisdiction a judge can explore: one LGU Admin, two schools, three
 * Grade 5 Classrooms with a Teacher each, and 30 Learners (aliases only) with
 * about two months of synthetic Attempts. Every Attempt is written with
 * source = 'demo' so a later refit can include or exclude it on purpose.
 *
 *   npm run db:seed:demo               idempotent: a second run changes nothing
 *   npm run db:seed:demo -- --reset    drops the demo data and recreates it
 *
 * Needs the Starter Pack (default ../mobile/src/content/starter-pack.json, or
 * --file / DEMO_PACK_FILE) and DEMO_PASSWORD, the password of every demo account.
 */
const DAY = 86400000;
export const DEMO_ADMIN = 'admin-demo';
export const DEMO_PACK_FILE = '../mobile/src/content/starter-pack.json';

/** Stable ids, so a reset finds exactly the rows this seed made and nothing else. */
const id = (name: string) => {
  const h = createHash('sha256').update(`kgo-demo:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const LGU = id('jurisdiction');
const SCHOOLS = [
  { id: id('school:1'), name: 'Rizal Elementary School', barangay: 'Pembo' },
  { id: id('school:2'), name: 'Bonifacio Elementary School', barangay: 'Cembo' },
];
// ceiling = how far this Classroom's improving Learners get, so the League has distinct values.
const CLASSROOMS = [
  {
    id: id('class:1'),
    school: 0,
    name: 'Grade 5 - Sampaguita',
    teacher: 'teacher-demo',
    ceiling: 0.95,
  },
  {
    id: id('class:2'),
    school: 0,
    name: 'Grade 5 - Dahlia',
    teacher: 'teacher-demo-2',
    ceiling: 0.8,
  },
  {
    id: id('class:3'),
    school: 1,
    name: 'Grade 5 - Orchid',
    teacher: 'teacher-demo-3',
    ceiling: 0.65,
  },
];
type Kind = 'improving' | 'flat' | 'plateau' | 'inactive' | 'never';
const KINDS: Kind[] = [
  'improving',
  'improving',
  'improving',
  'improving',
  'improving',
  'flat',
  'flat',
  'plateau',
  'inactive',
  'never',
];
const learnerLogin = (n: number) => `learner-${String(n).padStart(2, '0')}`;
const LEARNERS = CLASSROOMS.flatMap((room, r) =>
  KINDS.map((kind, k) => ({ room, kind, n: r * KINDS.length + k + 1 })),
);

function rng(seed: number) {
  // mulberry32: small, deterministic, plenty for synthetic practice.
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Item {
  id: string;
  skillCode: string;
  subject: Subject;
  correctOption: number;
  options: number;
}

function simulate(
  learner: (typeof LEARNERS)[number],
  items: Item[],
  now: number,
) {
  const random = rng(learner.n * 7919);
  const [from, to] =
    learner.kind === 'never'
      ? [0, -1]
      : learner.kind === 'inactive'
        ? [12, 60]
        : [0, 60];
  const sessionDays: number[] = [];
  for (let day = to; day >= from; day--)
    if (random() < (learner.kind === 'flat' ? 0.3 : 0.4)) sessionDays.push(day);
  // Pace first-time Exercises across both months: the server counts Mastery only on first completion.
  const seen = new Map<string, true>();
  const mastery = new Map<string, number>();
  const growth = new Map<string, GrowthSnapshot>();
  const progress = new Map<string, SkillProgress>();
  const attempts: Attempt[] = [];
  let coins = 0;
  const order = items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
  // Skills are worked through in turn, so a Plateau Flag has five Exercises to rest on.
  order.sort((a, b) => a.skillCode.localeCompare(b.skillCode));
  for (const day of sessionDays) {
    const share = (60 - day) / 60;
    const size = 4 + Math.floor(random() * 3);
    const target = Math.round(items.length * (0.15 + 0.85 * share));
    for (let i = 0; i < size; i++) {
      const fresh = seen.size < target;
      const item = fresh
        ? order.find((o) => !seen.has(o.id))!
        : order[Math.floor(random() * seen.size)];
      const p =
        learner.kind === 'plateau'
          ? 0.1
          : learner.kind === 'flat'
            ? 0.6
            : 0.35 + (learner.room.ceiling - 0.35) * share;
      const correct = random() < p;
      const occurredAt = new Date(now - day * DAY - (size - i) * 45000);
      const first = !seen.has(item.id);
      let awardedCoins = 0;
      if (first) {
        seen.set(item.id, true);
        awardedCoins = correct ? 5 : 0;
        coins += awardedCoins;
        const prior = mastery.get(item.skillCode) ?? DEFAULT_PARAMS.prior;
        const next = updateMastery(prior, correct);
        mastery.set(item.skillCode, next);
        const sp =
          progress.get(item.skillCode) ??
          Object.assign(new SkillProgress(), {
            studentId: '',
            skillCode: item.skillCode,
            subject: item.subject,
            mastery: prior,
            attempts: 0,
            correctAttempts: 0,
          });
        sp.mastery = next;
        sp.attempts += 1;
        sp.correctAttempts += Number(correct);
        progress.set(item.skillCode, sp);
        const month = manilaMonth(occurredAt);
        const key = `${item.skillCode}:${month}`;
        const gs =
          growth.get(key) ??
          Object.assign(new GrowthSnapshot(), {
            classroomId: learner.room.id,
            skillCode: item.skillCode,
            month,
            baseline: prior,
          });
        gs.latest = next;
        growth.set(key, gs);
      }
      attempts.push(
        Object.assign(new Attempt(), {
          clientAttemptId: id(`attempt:${learner.n}:${attempts.length}`),
          classroomId: learner.room.id,
          exerciseId: item.id,
          skillCode: item.skillCode,
          subject: item.subject,
          selectedOption: correct
            ? item.correctOption
            : (item.correctOption + 1) % item.options,
          correct,
          awardedCoins,
          occurredAt,
          receivedAt:
            day % 2 === 0
              ? new Date(occurredAt.getTime() + 2 * 3600000)
              : occurredAt,
          createdAt: occurredAt,
          source: 'demo',
        }),
      );
    }
  }
  return {
    attempts,
    progress: [...progress.values()],
    growth: [...growth.values()],
    coins,
  };
}

/** Removes every row this seed created (by its stable ids), leaving imported packs and anything else alone. */
export async function resetDemo(db: DataSource) {
  await db.transaction(async (m) => {
    const users = (
      await m.find(User, { where: [{ jurisdictionId: LGU }] })
    ).map((u) => u.id);
    const rooms = CLASSROOMS.map((c) => c.id);
    if (users.length) {
      await m.delete(Attempt, { studentId: In(users) });
      await m.delete(SkillProgress, { studentId: In(users) });
      await m.delete(GrowthSnapshot, { studentId: In(users) });
      await m.delete(Enrollment, { studentId: In(users) });
      await m.delete(AuthSession, { userId: In(users) });
      await m.delete(Redemption, { studentId: In(users) });
    }
    await m.delete(AuditEvent, { jurisdictionId: LGU });
    await m.delete(Classroom, { id: In(rooms) });
    if (users.length) await m.delete(User, { id: In(users) });
    await m.delete(Reward, { jurisdictionId: LGU });
    await m.delete(School, { id: In(SCHOOLS.map((s) => s.id)) });
  });
}

export async function seedDemo(
  db: DataSource,
  options: { password: string; file?: string; reset?: boolean; now?: number },
) {
  const now = options.now ?? Date.now();
  const catalogue = readCatalogue(resolve(options.file ?? DEMO_PACK_FILE));
  if (options.reset) await resetDemo(db);
  const passwordHash = await hashPassword(options.password);
  /**
   * A loginId is unique across the whole server, so a name this seed wants may
   * already belong to a row `db:seed` made under a different id. Adopt that row
   * instead of inserting beside it: the insert fails on users_loginId_key and
   * leaves the seed half done, which is how a demo database ends up with two
   * schools, no classrooms and no learners.
   */
  const existingIds = new Map(
    (await db.getRepository(User).find({ select: { id: true, loginId: true } }))
      .map((u) => [u.loginId, u.id] as const),
  );
  const account = (
    loginId: string,
    alias: string,
    role: Role,
    schoolId: string | null,
  ) =>
    Object.assign(new User(), {
      id: existingIds.get(loginId) ?? id(`user:${loginId}`),
      loginId,
      alias,
      role,
      jurisdictionId: LGU,
      schoolId,
      passwordHash,
      lockedUntil: null,
      createdAt: new Date(now - 70 * DAY),
    });
  // The Jurisdiction is not the admin's to create: every demo account points at
  // it, so it has to exist even on a database where `db:bootstrap` already made
  // the admin and this block is skipped. Creating it only alongside the admin is
  // how the seed fails on users_jurisdictionId_fkey instead.
  if (!(await db.getRepository(Jurisdiction).existsBy({ id: LGU })))
    await db
      .getRepository(Jurisdiction)
      .save(Object.assign(new Jurisdiction(), { id: LGU, name: 'Demo LGU' }));
  // The admin and the Starter Pack come first: import-pack needs an admin to publish under.
  if (!(await db.getRepository(User).existsBy({ loginId: DEMO_ADMIN })))
    await db
      .getRepository(User)
      .save(account(DEMO_ADMIN, 'LGU administrator', Role.LGU_ADMIN, null));
  const admin = await db
    .getRepository(User)
    .findOneByOrFail({ loginId: DEMO_ADMIN });
  await importPack(db, catalogue, { adminLoginId: DEMO_ADMIN });

  if (await db.getRepository(User).existsBy({ loginId: learnerLogin(1) })) {
    console.log(
      'Demo data already exists; nothing changed. Use --reset to rebuild it.',
    );
    return;
  }
  const items: Item[] = catalogue.packs
    .filter((p) => p.grade === 5)
    .flatMap((p) =>
      p.lessons.flatMap((l) =>
        l.exercises.map((e) => ({
          id: e.id,
          skillCode: l.skillCode,
          subject: Subject[p.subject as keyof typeof Subject],
          correctOption: e.correctOption,
          options: e.options.length,
        })),
      ),
    );
  await db.transaction(async (m) => {
    for (const s of SCHOOLS)
      await m.save(
        School,
        Object.assign(new School(), {
          ...s,
          jurisdictionId: admin.jurisdictionId,
        }),
      );
    for (const c of CLASSROOMS) {
      const t = account(
        c.teacher,
        c.teacher === 'teacher-demo'
          ? 'Teacher Demo'
          : `Teacher ${c.name.slice(10)}`,
        Role.TEACHER,
        SCHOOLS[c.school].id,
      );
      await m.save(User, t);
      await m.save(
        Classroom,
        Object.assign(new Classroom(), {
          id: c.id,
          schoolId: t.schoolId,
          teacherId: t.id,
          name: c.name,
          grade: 5,
        }),
      );
    }
    for (const l of LEARNERS) {
      const history = simulate(l, items, now);
      const learner = account(
        learnerLogin(l.n),
        `Learner ${String(l.n).padStart(2, '0')}`,
        Role.STUDENT,
        SCHOOLS[l.room.school].id,
      );
      learner.coins = history.coins;
      await m.save(User, learner);
      await m.save(
        Enrollment,
        Object.assign(new Enrollment(), {
          id: id(`enrol:${l.n}`),
          classroomId: l.room.id,
          studentId: learner.id,
          createdAt: new Date(now - 70 * DAY),
        }),
      );
      for (const row of [...history.progress, ...history.growth])
        row.studentId = learner.id;
      for (const row of history.attempts) row.studentId = learner.id;
      for (let i = 0; i < history.attempts.length; i += 500)
        await m.insert(Attempt, history.attempts.slice(i, i + 500));
      if (history.progress.length)
        await m.save(SkillProgress, history.progress);
      if (history.growth.length) await m.save(GrowthSnapshot, history.growth);
    }
    await m.save(
      Reward,
      Object.assign(new Reward(), {
        id: id('reward'),
        jurisdictionId: admin.jurisdictionId,
        title: 'Demo School Supply Voucher',
        cost: 10,
        stock: 20,
      }),
    );
  });
  console.log(
    `Seeded ${LEARNERS.length} learners in ${CLASSROOMS.length} classrooms. Sign in as teacher-demo or ${DEMO_ADMIN} with DEMO_PASSWORD.`,
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production');
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12 || password.startsWith('replace-'))
    throw new Error(
      'Set DEMO_PASSWORD to a password of at least 12 characters',
    );
  const at = process.argv.indexOf('--file');
  const db = dataSource();
  await db.initialize();
  try {
    await seedDemo(db, {
      password,
      reset: process.argv.includes('--reset'),
      file: at === -1 ? process.env.DEMO_PACK_FILE : process.argv[at + 1],
    });
  } finally {
    await db.destroy();
  }
}

if (require.main === module)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
