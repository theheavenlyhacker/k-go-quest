import 'dotenv/config';
import { Client, type ClientConfig } from 'pg';
import { DataSource } from 'typeorm';
import { databaseCertificate, databaseOptions } from './data-source';
import { databaseSchema, inspectSchema } from './schema';

async function main() {
  const schema = databaseSchema(process.env.DATABASE_SCHEMA || 'kgo');
  const options = databaseOptions(
    process.env.DATABASE_URL ?? '',
    process.env.DATABASE_SSL === 'true',
    databaseCertificate(),
    schema,
  ) as Extract<ReturnType<typeof databaseOptions>, { type: 'postgres' }>;
  const client = new Client({
    connectionString: options.url,
    ssl: options.ssl as ClientConfig['ssl'],
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await client.end();
  }
  const db = new DataSource(options);
  await db.initialize();
  try {
    // PostgreSQL advisory lock prevents two deployment workers racing migrations.
    const lock = db.createQueryRunner();
    await lock.connect();
    try {
      await lock.query('SELECT pg_advisory_lock(hashtext($1))', [
        `kgo:migrations:${schema}`,
      ]);
      const migrations = await db.runMigrations({ transaction: 'all' });
      if (!(await inspectSchema(db)).ready)
        throw new Error('Schema validation failed');
      console.log(
        `Database schema ${schema} ready; ${migrations.length} migration(s) applied.`,
      );
    } finally {
      await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [
        `kgo:migrations:${schema}`,
      ]);
      await lock.release();
    }
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Migration failed. Check the connection, schema compatibility, and database permissions. Credentials were not logged.',
  );
  process.exitCode = 1;
});
