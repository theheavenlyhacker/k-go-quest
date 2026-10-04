const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { verifyApi } = require('./verify-api.cjs');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function runTests(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--experimental-vm-modules',
        require.resolve('jest/bin/jest'),
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
      ],
      { stdio: 'inherit', env, windowsHide: true },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}
async function smokeBuilt(options) {
  const admin = new Client({ ...options, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query('CREATE DATABASE kgo_smoke');
  } finally {
    await admin.end();
  }
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: `postgresql://${options.user}:${options.password}@127.0.0.1:${options.port}/kgo_smoke`,
    DATABASE_SSL: 'false',
    DATABASE_SCHEMA: 'kgo',
    DATABASE_CA_PATH: '',
    DATABASE_CA: '',
    JWT_SECRET: randomBytes(48).toString('hex'),
    SWAGGER_ENABLED: 'true',
    BOOTSTRAP_LOGIN: 'smoke-admin',
    BOOTSTRAP_PASSWORD: randomBytes(24).toString('hex'),
    BOOTSTRAP_JURISDICTION: 'Smoke LGU',
    DEMO_PASSWORD: randomBytes(24).toString('hex'),
    PORT: String(port),
  };
  for (const args of [
    ['dist/database/migrate.js'],
    ['dist/database/bootstrap.js'],
    ['dist/database/seed.js'],
  ])
    execFileSync(process.execPath, args, {
      env,
      windowsHide: true,
      stdio: 'pipe',
      timeout: 30000,
    });
  const server = spawn(process.execPath, ['dist/main.js'], {
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        const response = await fetch(`${base}/api/v1/health/ready`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Wait for startup. */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Built API failed to start');
    const docs = await (await fetch(`${base}/api/docs-json`)).json();
    if (!docs.components.schemas.LoginDto?.properties?.deviceId)
      throw new Error('Swagger DTO metadata missing');
    await verifyApi(
      base,
      {
        adminLogin: env.BOOTSTRAP_LOGIN,
        adminPassword: env.BOOTSTRAP_PASSWORD,
        demoPassword: env.DEMO_PASSWORD,
      },
      true,
    );
    console.log(
      'Compiled migration, bootstrap, seed, API, Swagger, all roles, sync/retry, wallet/voucher and quiz checks passed',
    );
  } finally {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
}
async function main() {
  if (process.env.TEST_DATABASE_URL) {
    process.exitCode = await runTests(process.env);
    return;
  }
  if (process.platform !== 'win32')
    throw new Error(
      'Set TEST_DATABASE_URL to a disposable PostgreSQL database',
    );
  const binaries = require('@embedded-postgres/windows-x64');
  const root = path.resolve('.tmp');
  const dir = path.join(root, `integration-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  const dbDir = path.join(dir, 'data');
  const pwFile = path.join(dir, 'pwfile');
  const password = randomBytes(32).toString('hex');
  const port = await freePort();
  fs.writeFileSync(pwFile, password, { mode: 0o600 });
  let server;
  try {
    execFileSync(
      binaries.initdb,
      [
        '-D',
        dbDir,
        '-U',
        'kgo_test',
        '--pwfile',
        pwFile,
        '--auth-host=scram-sha-256',
        '--auth-local=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ],
      { windowsHide: true, stdio: 'pipe', timeout: 60000 },
    );
    fs.unlinkSync(pwFile);
    server = spawn(
      binaries.postgres,
      ['-D', dbDir, '-h', '127.0.0.1', '-p', String(port)],
      { windowsHide: true, stdio: 'ignore' },
    );
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const client = new Client({
        host: '127.0.0.1',
        port,
        user: 'kgo_test',
        password,
        database: 'postgres',
      });
      try {
        await client.connect();
        await client.query('CREATE DATABASE kgo_test');
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      } finally {
        await client.end().catch(() => {});
      }
    }
    if (!ready) throw new Error('Temporary PostgreSQL did not become ready');
    const verifySql = new Client({
      host: '127.0.0.1',
      port,
      user: 'kgo_test',
      password,
      database: 'kgo_test',
    });
    await verifySql.connect();
    try {
      await verifySql.query(
        fs.readFileSync(path.resolve('database/schema.sql'), 'utf8'),
      );
    } finally {
      await verifySql.end();
    }
    process.exitCode = await runTests({
      ...process.env,
      TEST_DATABASE_URL: `postgresql://kgo_test:${password}@127.0.0.1:${port}/kgo_test`,
    });
    if (!process.exitCode && fs.existsSync(path.resolve('dist/main.js'))) {
      await smokeBuilt({ host: '127.0.0.1', port, user: 'kgo_test', password });
    }
  } finally {
    let stopped = !server;
    if (server) {
      try {
        execFileSync(
          binaries.pg_ctl,
          ['-D', dbDir, '-m', 'fast', '-w', 'stop'],
          { windowsHide: true, stdio: 'pipe', timeout: 30000 },
        );
        stopped = true;
      } catch {
        server.kill();
        console.error('Database stop failed; retained temporary directory.');
      }
    }
    if (
      stopped &&
      path.dirname(dir) === root &&
      path.basename(dir).startsWith('integration-')
    )
      fs.rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
      });
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
