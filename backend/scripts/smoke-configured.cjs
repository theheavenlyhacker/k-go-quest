require('dotenv').config({ quiet: true });
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const { verifyApi } = require('./verify-api.cjs');

async function main() {
  if (!fs.existsSync('dist/main.js'))
    throw new Error('Run npm run build first');
  if (
    !process.env.BOOTSTRAP_LOGIN ||
    !process.env.BOOTSTRAP_PASSWORD ||
    !process.env.DEMO_PASSWORD
  )
    throw new Error(
      'Set bootstrap and demo credentials locally before verification',
    );
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const server = spawn(process.execPath, ['dist/main.js'], {
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(port) },
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (server.exitCode !== null)
        throw new Error('Configured API exited during startup');
      try {
        const result = await fetch(`${base}/api/v1/health/ready`, {
          signal: AbortSignal.timeout(2000),
        });
        if (result.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Waiting for startup. */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Configured API did not become ready');
    const result = await verifyApi(base, {
      adminLogin: process.env.BOOTSTRAP_LOGIN,
      adminPassword: process.env.BOOTSTRAP_PASSWORD,
      demoPassword: process.env.DEMO_PASSWORD,
    });
    console.log(
      JSON.stringify({ configuredApiVerified: true, ...result }, null, 2),
    );
  } finally {
    if (server.exitCode === null) {
      const stopped = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
  }
}
void main().catch((error) => {
  console.error(`Configured verification failed: ${error.message}`);
  process.exitCode = 1;
});
