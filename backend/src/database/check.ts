import 'dotenv/config';
import dataSource from './data-source';
import { inspectSchema } from './schema';

async function main() {
  const db = dataSource();
  await db.initialize();
  try {
    const info = await db.query<{ database: string }[]>(
      'SELECT current_database() AS database',
    );
    const status = await inspectSchema(db);
    console.log(
      JSON.stringify(
        {
          connected: true,
          database: info[0].database,
          tlsVerified: process.env.DATABASE_SSL === 'true',
          ...status,
        },
        null,
        2,
      ),
    );
    if (!status.ready) process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Database check failed. Check DATABASE_URL, DATABASE_SCHEMA, and the CA certificate; credentials were not logged.',
  );
  process.exitCode = 1;
});
