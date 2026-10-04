import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCatalog } from './starter-pack-export.ts';

/**
 * Regenerates `src/content/starter-pack.json`, which the backend imports so its
 * Exercise UUIDs match this tablet's.
 *
 *     npm run export:pack
 *
 * Plain JavaScript on purpose: it is the only file here that touches Node APIs,
 * and keeping it out of the TypeScript project means the app does not need
 * @types/node for the sake of one script.
 *
 * `src/content/catalog.test.ts` fails if the JSON drifts from the Starter Pack,
 * so forgetting to run this is caught by CI, not by a sync that quietly uploads
 * to Exercises the server has never heard of.
 */
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'starter-pack.json');
writeFileSync(target, `${JSON.stringify(exportCatalog(), null, 2)}\n`, 'utf8');
console.log(`Wrote ${target}`);
