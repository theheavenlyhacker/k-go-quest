if (require.main === module) require('ts-node/register');
const fs = require('node:fs');
const path = require('node:path');
const { MIGRATIONS } = require('../src/database/data-source');

async function generateSchemaSql() {
  const queries = [
    'CREATE TABLE "migrations" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)',
  ];
  for (const Migration of MIGRATIONS) {
    const migration = new Migration();
    await migration.up({ query: async (query) => queries.push(query) });
    const timestamp = Number(migration.name.slice(-13));
    queries.push(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (${timestamp}, '${migration.name}')`,
    );
  }
  const sql =
    '-- K-Go Quests: fresh PostgreSQL schema kgo.\n-- Run once in defaultdb. Includes TypeORM migration bookkeeping.\n-- Existing public tables are not changed. This script contains no credentials or user data.\nBEGIN;\nCREATE SCHEMA IF NOT EXISTS "kgo";\nSET LOCAL search_path = "kgo";\n\n' +
    queries.map((q) => q + ';').join('\n\n') +
    '\n\nCOMMIT;\n';
  return sql;
}

async function main() {
  const sql = await generateSchemaSql();
  fs.mkdirSync(path.resolve('database'), { recursive: true });
  fs.writeFileSync(path.resolve('database/schema.sql'), sql);
  console.log('Generated database/schema.sql from the backend migration');
}
module.exports = { generateSchemaSql };
if (require.main === module)
  void main().catch(() => {
    console.error('Schema export failed');
    process.exitCode = 1;
  });
