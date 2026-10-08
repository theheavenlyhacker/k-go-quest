import type { DataSource } from 'typeorm';

export const INITIAL_MIGRATION = 'InitialSchema1790800000000';

export function databaseSchema(input = 'kgo'): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(input) || input.startsWith('pg_'))
    throw new Error(
      'DATABASE_SCHEMA must be a lowercase PostgreSQL identifier',
    );
  return input;
}

// Check columns as well as names: another app can have a different users table.
export const REQUIRED_COLUMNS: Record<string, string[]> = {
  jurisdictions: ['id', 'createdAt', 'name'],
  schools: ['id', 'createdAt', 'jurisdictionId', 'name'],
  users: [
    'id',
    'createdAt',
    'loginId',
    'role',
    'jurisdictionId',
    'schoolId',
    'alias',
    'passwordHash',
    'active',
    'coins',
    'failedLogins',
    'lockedUntil',
    'updatedAt',
  ],
  auth_sessions: [
    'id',
    'createdAt',
    'userId',
    'deviceId',
    'refreshHash',
    'expiresAt',
    'revokedAt',
  ],
  classrooms: ['id', 'createdAt', 'schoolId', 'teacherId', 'name', 'grade'],
  enrollments: ['id', 'createdAt', 'classroomId', 'studentId', 'active'],
  content_packs: [
    'id',
    'createdAt',
    'jurisdictionId',
    'title',
    'subject',
    'grade',
    'version',
    'published',
    'attribution',
  ],
  lessons: ['id', 'createdAt', 'packId', 'title', 'skillCode', 'body', 'hints'],
  exercises: [
    'id',
    'createdAt',
    'lessonId',
    'prompt',
    'options',
    'correctOption',
    'coinAward',
  ],
  attempts: [
    'id',
    'createdAt',
    'clientAttemptId',
    'studentId',
    'classroomId',
    'exerciseId',
    'skillCode',
    'subject',
    'selectedOption',
    'correct',
    'awardedCoins',
    'occurredAt',
    'receivedAt',
    'source',
  ],
  skill_progress: [
    'id',
    'createdAt',
    'studentId',
    'skillCode',
    'subject',
    'mastery',
    'attempts',
    'correctAttempts',
    'updatedAt',
  ],
  growth_snapshots: [
    'id',
    'createdAt',
    'studentId',
    'classroomId',
    'skillCode',
    'month',
    'baseline',
    'latest',
  ],
  rewards: [
    'id',
    'createdAt',
    'jurisdictionId',
    'title',
    'cost',
    'stock',
    'active',
  ],
  redemptions: [
    'id',
    'createdAt',
    'studentId',
    'rewardId',
    'requestId',
    'cost',
    'status',
    'claimedAt',
    'claimedBy',
  ],
  quizzes: [
    'id',
    'createdAt',
    'classroomId',
    'title',
    'subject',
    'skillCodes',
    'exerciseIds',
    'status',
    'updatedAt',
  ],
  quiz_papers: ['id', 'createdAt', 'quizId', 'studentId', 'answers', 'score', 'gradedAt'],
  audit_events: [
    'id',
    'createdAt',
    'actorId',
    'jurisdictionId',
    'action',
    'targetId',
    'metadata',
  ],
  devices: [
    'id',
    'createdAt',
    'deviceId',
    'jurisdictionId',
    'schoolId',
    'appVersion',
    'packVersions',
    'storageUsedPercent',
    'pendingAttempts',
    'lastSeenAt',
    'updatedAt',
  ],
  migrations: ['id', 'timestamp', 'name'],
};

export async function inspectSchema(db: DataSource) {
  const schema = databaseSchema((db.options as { schema?: string }).schema);
  const rows = await db.query<{ table_name: string; column_name: string }[]>(
    'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1',
    [schema],
  );
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const found = rows.filter((row) => row.table_name === table);
    if (!found.length) missingTables.push(table);
    else
      for (const column of columns)
        if (!found.some((row) => row.column_name === column))
          missingColumns.push(`${table}.${column}`);
  }
  const migrationPresent =
    !missingTables.includes('migrations') &&
    !missingColumns.some((column) => column.startsWith('migrations.')) &&
    (
      await db.query<{ found: boolean }[]>(
        `SELECT EXISTS (SELECT 1 FROM "${schema}"."migrations" WHERE name = $1) AS found`,
        [INITIAL_MIGRATION],
      )
    )[0].found;
  return {
    schema,
    ready: !missingTables.length && !missingColumns.length && migrationPresent,
    expectedTables: Object.keys(REQUIRED_COLUMNS).length,
    missingTables,
    missingColumns,
    migrationPresent,
  };
}
