import * as SQLite from 'expo-sqlite';
import { LocalRepository, type Database } from './repository';
import { cipher } from './crypto';

function adapter(db: SQLite.SQLiteDatabase): Database {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => { await db.runAsync(sql, params); },
    first: (sql, params = []) => db.getFirstAsync(sql, params),
    all: (sql, params = []) => db.getAllAsync(sql, params),
  };
}
let repository: Promise<LocalRepository> | null = null;
export function getRepository() {
  if (!repository) repository = (async () => {
    // The old sync database is dropped, not migrated.
    await SQLite.deleteDatabaseAsync('kgo-quests-v1.db').catch(() => {});
    const repo = new LocalRepository(adapter(await SQLite.openDatabaseAsync('kgo-quests-v2.db')), cipher);
    await repo.initialize(); return repo;
  })().catch((error) => { repository = null; throw error; });
  return repository;
}
