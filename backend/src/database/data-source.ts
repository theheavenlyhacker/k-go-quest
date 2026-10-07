import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { readFileSync } from 'node:fs';
import { ENTITIES } from './entities';
import { InitialSchema1790800000000 } from './migrations/1790800000000-initial-schema';
import { ModelParams1790900000000 } from './migrations/1790900000000-model-params';
import { AttemptSource1791000000000 } from './migrations/1791000000000-attempt-source';
import { Quizzes1791100000000 } from './migrations/1791100000000-quizzes';
import { Devices1791200000000 } from './migrations/1791200000000-devices';
import { databaseSchema } from './schema';

/**
 * The database CA, from a file or straight from the environment.
 *
 * `DATABASE_CA_PATH` is the right answer on a server where a file can be put
 * somewhere. A platform that only hands you environment variables — Railway,
 * Render, Fly — has nowhere to put one, so `DATABASE_CA` carries the PEM
 * itself. Escaped newlines are accepted because most dashboards mangle real
 * ones. Certificate verification is never disabled either way.
 */
export function databaseCertificate(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const inline = env.DATABASE_CA?.trim();
  if (inline) {
    const pem = inline.includes('\\n') ? inline.replace(/\\n/g, '\n') : inline;
    // A PEM wants a closing newline, and trimming the pasted value took it off.
    return `${pem.trimEnd()}\n`;
  }
  const path = env.DATABASE_CA_PATH?.trim();
  return path ? readFileSync(path, 'utf8') : undefined;
}

export function databaseOptions(
  url: string,
  ssl: boolean,
  ca?: string,
  schemaName = 'kgo',
): DataSourceOptions {
  const schema = databaseSchema(schemaName);
  const parsed = new URL(url);
  if (
    [...parsed.searchParams.keys()].some(
      (key) =>
        key.toLowerCase().startsWith('ssl') ||
        ['options', 'search_path'].includes(key.toLowerCase()),
    )
  )
    throw new Error(
      'Configure database TLS and schema through dedicated environment values',
    );
  return {
    type: 'postgres',
    url,
    schema,
    ssl: ssl
      ? {
          rejectUnauthorized: true,
          ...(ca ? { ca } : {}),
        }
      : false,
    entities: ENTITIES,
    migrations: [
      InitialSchema1790800000000,
      ModelParams1790900000000,
      AttemptSource1791000000000,
      Quizzes1791100000000,
      Devices1791200000000,
    ],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: {
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
      // Raw SQL and migration references must never fall back to public tables.
      options: `-c search_path=${schema}`,
    },
  };
}
// Create lazily: importing this module must not read CLI-only environment values.
export function cliDataSource() {
  return new DataSource(
    databaseOptions(
      process.env.DATABASE_URL ?? '',
      process.env.DATABASE_SSL === 'true',
      databaseCertificate(),
      process.env.DATABASE_SCHEMA || 'kgo',
    ),
  );
}
export default cliDataSource;
