import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { readFileSync } from 'node:fs';
import { ENTITIES } from './entities';
import { InitialSchema1790800000000 } from './migrations/1790800000000-initial-schema';
import { ModelParams1790900000000 } from './migrations/1790900000000-model-params';
import { databaseSchema } from './schema';

export function databaseOptions(
  url: string,
  ssl: boolean,
  caPath?: string,
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
          ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}),
        }
      : false,
    entities: ENTITIES,
    migrations: [InitialSchema1790800000000, ModelParams1790900000000],
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
      process.env.DATABASE_CA_PATH || undefined,
      process.env.DATABASE_SCHEMA || 'kgo',
    ),
  );
}
export default cliDataSource;
