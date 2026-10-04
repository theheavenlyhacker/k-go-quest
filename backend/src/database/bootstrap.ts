import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import dataSource from './data-source';
import { Jurisdiction, Role, User } from './entities';
import { hashPassword } from '../modules/auth/password';

async function main() {
  const db = dataSource();
  const loginId = process.env.BOOTSTRAP_LOGIN?.toLowerCase();
  const password = process.env.BOOTSTRAP_PASSWORD;
  const jurisdiction = process.env.BOOTSTRAP_JURISDICTION;
  if (
    !loginId ||
    !/^[a-z0-9._-]{3,80}$/.test(loginId) ||
    !password ||
    password.length < 12 ||
    password.startsWith('replace-') ||
    !jurisdiction
  )
    throw new Error(
      'Set a valid BOOTSTRAP_LOGIN, strong BOOTSTRAP_PASSWORD (12+ characters), and BOOTSTRAP_JURISDICTION',
    );
  await db.initialize();
  try {
    if (await db.getRepository(User).existsBy({ role: Role.LGU_ADMIN }))
      throw new Error(
        'An LGU admin already exists; use authenticated provisioning',
      );
    await db.transaction(async (manager) => {
      const lgu = await manager.save(
        Jurisdiction,
        manager.create(Jurisdiction, { id: randomUUID(), name: jurisdiction }),
      );
      await manager.save(
        User,
        manager.create(User, {
          loginId,
          alias: 'LGU administrator',
          passwordHash: await hashPassword(password),
          jurisdictionId: lgu.id,
          schoolId: null,
          role: Role.LGU_ADMIN,
          lockedUntil: null,
        }),
      );
    });
    console.log(
      'Initial LGU administrator created. Remove BOOTSTRAP_PASSWORD from your environment.',
    );
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Bootstrap failed: check environment values and whether an admin already exists.',
  );
  process.exitCode = 1;
});
