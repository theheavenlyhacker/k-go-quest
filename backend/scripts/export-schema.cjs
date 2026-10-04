require('ts-node/register');
const fs = require('node:fs');
const path = require('node:path');
const {
  InitialSchema1790800000000,
} = require('../src/database/migrations/1790800000000-initial-schema');

async function main() {
  const queries = [];
  await new InitialSchema1790800000000().up({
    query: async (query) => queries.push(query),
  });
  const migrationTable =
    'CREATE TABLE "migrations" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)';
  const record = `INSERT INTO "migrations" ("timestamp", "name") VALUES (1790800000000, 'InitialSchema1790800000000')`;
  const sql =
    '-- K-Go Quests: fresh PostgreSQL schema kgo.\n-- Run once in defaultdb. Includes TypeORM migration bookkeeping.\n-- Existing public tables are not changed. This script contains no credentials or user data.\nBEGIN;\nCREATE SCHEMA IF NOT EXISTS "kgo";\nSET LOCAL search_path = "kgo";\n\n' +
    [...queries, migrationTable, record].map((q) => q + ';').join('\n\n') +
    '\n\nCOMMIT;\n';
  fs.mkdirSync(path.resolve('database'), { recursive: true });
  fs.writeFileSync(path.resolve('database/schema.sql'), sql);
  console.log('Generated database/schema.sql from the backend migration');
}
void main().catch(() => {
  console.error('Schema export failed');
  process.exitCode = 1;
});
