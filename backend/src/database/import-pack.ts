import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dataSource from './data-source';
import { ContentPack, Exercise, Lesson, Role, Subject, User } from './entities';

/**
 * Imports the tablet's Starter Pack so the server knows the same Exercises.
 *
 * Without this the tablet uploads Attempts against Exercise ids the server has
 * never seen and every one is refused. The ids come from the file, not from the
 * database: they are derived from the content slugs by
 * `mobile/scripts/starter-pack-export.ts`, so re-seeding the server from an
 * empty database still matches the Attempt log already on a tablet.
 *
 *   npm run pack:import -- --file ../mobile/src/content/starter-pack.json
 *   npm run pack:import -- --file ... --dry-run
 *   npm run pack:import -- --file ... --allow-republish
 */
interface ExportedExercise { slug: string; id: string; prompt: string; options: string[]; correctOption: number }
interface ExportedLesson { slug: string; id: string; title: string; skillCode: string; body: string; hints: Record<string, string>; exercises: ExportedExercise[] }
interface ExportedPack { slug: string; id: string; title: string; subject: string; grade: number; version: string; grading: string; lessons: ExportedLesson[] }
interface ExportedCatalog { namespace: string; generatedFrom: string; packs: ExportedPack[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function read(path: string): ExportedCatalog {
  const catalogue = JSON.parse(readFileSync(resolve(path), 'utf8')) as ExportedCatalog;
  if (!Array.isArray(catalogue.packs) || catalogue.packs.length === 0)
    throw new Error('That file contains no packs.');
  for (const pack of catalogue.packs) {
    if (!UUID.test(pack.id)) throw new Error(`Pack ${pack.slug} has no derived id. Run "npm run export:pack" in mobile.`);
    if (!(pack.subject in Subject)) throw new Error(`Pack ${pack.slug} has an unknown subject ${pack.subject}.`);
    for (const lesson of pack.lessons) {
      if (!UUID.test(lesson.id)) throw new Error(`Lesson ${lesson.slug} has no derived id.`);
      for (const exercise of lesson.exercises) {
        if (!UUID.test(exercise.id)) throw new Error(`Exercise ${exercise.slug} has no derived id.`);
        // A wrong key here marks correct answers wrong for every Learner, so it is checked before anything is written.
        if (!Number.isInteger(exercise.correctOption) || exercise.correctOption < 0 || exercise.correctOption >= exercise.options.length)
          throw new Error(`Exercise ${exercise.slug} has an answer key outside its options.`);
      }
    }
  }
  return catalogue;
}

async function main() {
  const file = option('file');
  if (!file) throw new Error('Pass --file <path to starter-pack.json>');
  const catalogue = read(file);
  const dryRun = flag('dry-run');

  const db = dataSource();
  await db.initialize();
  try {
    const admin = await db.getRepository(User).findOneBy({ role: Role.LGU_ADMIN });
    if (!admin) throw new Error('Bootstrap an LGU admin first: npm run db:bootstrap');

    for (const pack of catalogue.packs) {
      const exercises = pack.lessons.reduce((total, lesson) => total + lesson.exercises.length, 0);
      const existing = await db.getRepository(ContentPack).findOneBy({ id: pack.id });
      if (existing && existing.version === pack.version) {
        console.log(`= ${pack.slug} ${pack.version} already imported (${pack.lessons.length} lessons, ${exercises} exercises)`);
        continue;
      }
      if (existing && !flag('allow-republish'))
        throw new Error(
          `${pack.slug} is already published as ${existing.version} and this file is ${pack.version}. ` +
            'Published content is meant to be immutable; pass --allow-republish if you really mean to overwrite it.',
        );
      console.log(`${dryRun ? '~' : '+'} ${pack.slug} ${pack.version} (${pack.lessons.length} lessons, ${exercises} exercises)`);
      if (dryRun) continue;

      await db.transaction(async (manager) => {
        await manager.save(ContentPack, manager.create(ContentPack, {
          id: pack.id,
          jurisdictionId: admin.jurisdictionId,
          title: pack.title,
          subject: Subject[pack.subject as keyof typeof Subject],
          grade: pack.grade,
          version: pack.version,
          published: true,
          attribution: 'Original K-Go Starter Pack; no Khan Academy content',
        }));
        for (const lesson of pack.lessons) {
          await manager.save(Lesson, manager.create(Lesson, {
            id: lesson.id,
            packId: pack.id,
            title: lesson.title,
            skillCode: lesson.skillCode,
            body: lesson.body,
            hints: lesson.hints,
          }));
          for (const exercise of lesson.exercises) {
            await manager.save(Exercise, manager.create(Exercise, {
              id: exercise.id,
              lessonId: lesson.id,
              prompt: exercise.prompt,
              options: exercise.options,
              correctOption: exercise.correctOption,
              coinAward: 5,
            }));
          }
        }
      });
    }
    console.log(dryRun ? 'Dry run: nothing was written.' : 'Import complete.');
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
