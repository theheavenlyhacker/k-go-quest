import 'dotenv/config';
import dataSource from './data-source';
import {
  Classroom,
  ContentPack,
  Enrollment,
  Exercise,
  Lesson,
  Reward,
  Role,
  School,
  Subject,
  User,
} from './entities';
import { hashPassword } from '../modules/auth/password';

async function main() {
  const db = dataSource();
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production');
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12 || password.startsWith('replace-'))
    throw new Error(
      'Set DEMO_PASSWORD to a unique password of at least 12 characters',
    );
  await db.initialize();
  try {
    const admin = await db
      .getRepository(User)
      .findOneBy({
        loginId: process.env.BOOTSTRAP_LOGIN?.toLowerCase() ?? '',
        role: Role.LGU_ADMIN,
      });
    if (!admin) throw new Error('Bootstrap an LGU admin first');
    if (await db.getRepository(User).existsBy({ loginId: 'student-demo' })) {
      console.log('Demo seed already exists');
      return;
    }
    await db.transaction(async (manager) => {
      const school = await manager.save(
        School,
        manager.create(School, {
          jurisdictionId: admin.jurisdictionId,
          name: 'Demo Elementary School',
        }),
      );
      const passwordHash = await hashPassword(password);
      const teacher = await manager.save(
        User,
        manager.create(User, {
          loginId: 'teacher-demo',
          alias: 'Teacher Demo',
          role: Role.TEACHER,
          jurisdictionId: admin.jurisdictionId,
          schoolId: school.id,
          passwordHash,
          lockedUntil: null,
        }),
      );
      const student = await manager.save(
        User,
        manager.create(User, {
          loginId: 'student-demo',
          alias: 'Learner Demo',
          role: Role.STUDENT,
          jurisdictionId: admin.jurisdictionId,
          schoolId: school.id,
          passwordHash,
          lockedUntil: null,
        }),
      );
      const classroom = await manager.save(
        Classroom,
        manager.create(Classroom, {
          schoolId: school.id,
          teacherId: teacher.id,
          name: 'Grade 5 - Demo',
          grade: 5,
        }),
      );
      await manager.save(
        Enrollment,
        manager.create(Enrollment, {
          classroomId: classroom.id,
          studentId: student.id,
        }),
      );
      const pack = await manager.save(
        ContentPack,
        manager.create(ContentPack, {
          jurisdictionId: admin.jurisdictionId,
          title: 'Fraction Quests',
          subject: Subject.MATH,
          grade: 5,
          version: '1.0.0',
          published: true,
          attribution: 'Original K-Go demo exercises; no Khan Academy content',
        }),
      );
      const lesson = await manager.save(
        Lesson,
        manager.create(Lesson, {
          packId: pack.id,
          title: 'Adding fractions',
          skillCode: 'demo.math5.fractions.add',
          body: 'Use a common denominator before adding fractions. Multiply numerator and denominator by the same number to preserve value.',
          hints: {
            en: 'Rewrite both fractions with the same denominator, then add their numerators.',
            tl: 'Gawing pareho ang denominator ng dalawang fraction bago idagdag ang mga numerator.',
          },
        }),
      );
      for (const [prompt, options] of [
        ['What is 1/2 + 1/4?', ['3/4', '2/6', '1/8']],
        ['What is 1/3 + 1/6?', ['1/2', '2/9', '1/18']],
        ['What is 2/5 + 1/5?', ['3/5', '3/10', '2/25']],
      ] as [string, string[]][])
        await manager.save(
          Exercise,
          manager.create(Exercise, {
            lessonId: lesson.id,
            prompt,
            options,
            correctOption: 0,
            coinAward: 5,
          }),
        );
      await manager.save(
        Reward,
        manager.create(Reward, {
          jurisdictionId: admin.jurisdictionId,
          title: 'Demo School Supply Voucher',
          cost: 10,
          stock: 20,
        }),
      );
    });
    console.log(
      'Created student-demo, teacher-demo, one classroom, original fraction exercises, and demo rewards. Use DEMO_PASSWORD to sign in.',
    );
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error('Seed failed: verify database, bootstrap, and DEMO_PASSWORD.');
  process.exitCode = 1;
});
