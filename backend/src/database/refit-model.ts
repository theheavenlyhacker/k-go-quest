import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importModel } from './import-model';

/**
 * Refits skill parameters from server Counted Attempts using the ML service.
 *
 *   npm run model:refit
 *   npm run model:refit -- --include-demo
 *   npm run model:refit -- --include-demo --version=bkt-demo-20261007
 */
export async function refitModel(options: {
  includeDemo?: boolean;
  version?: string;
  out?: string;
  url?: string;
  token?: string;
} = {}) {
  const includeDemo = options.includeDemo ?? process.argv.includes('--include-demo');
  const versionArg =
    options.version ??
    process.argv.find((a) => a.startsWith('--version='))?.slice(10) ??
    (process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : undefined);
  const outArg =
    options.out ??
    process.argv.find((a) => a.startsWith('--out='))?.slice(6) ??
    (process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : undefined);

  const url = options.url || process.env.MODEL_SERVICE_URL || process.env.KGO_ML_URL || 'http://127.0.0.1:8000';
  const token = options.token || process.env.KGO_ML_TOKEN || 'demo-local-only-ml-token-0123456789';

  let spawnedProcess: ChildProcess | null = null;
  const isHealthy = async () => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      return res.ok;
    } catch {
      return false;
    }
  };

  if (!(await isHealthy())) {
    // Attempt to spawn ML service locally if not already running
    const mlDir = resolve(__dirname, '../../../ml');
    const venvUvicorn = resolve(mlDir, '.venv/bin/uvicorn');
    const uvicornCmd = existsSync(venvUvicorn) ? venvUvicorn : 'uvicorn';
    try {
      spawnedProcess = spawn(uvicornCmd, ['service.app:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: mlDir,
        env: {
          ...process.env,
          KGO_ML_TOKEN: token,
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://kgo:demo-local-only-db-password@localhost:5432/kgo',
          DATABASE_SCHEMA: process.env.DATABASE_SCHEMA || 'kgo',
        },
        stdio: 'ignore',
      });
      // Wait for service to become healthy
      let ready = false;
      for (let i = 0; i < 30; i++) {
        if (await isHealthy()) {
          ready = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!ready) {
        throw new Error('Model service did not respond on /health');
      }
    } catch (err) {
      if (spawnedProcess) spawnedProcess.kill();
      throw new Error(`Model service is not reachable at ${url} and could not be auto-started: ${(err as Error).message}`);
    }
  }

  try {
    const res = await fetch(`${url}/fit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        includeDemo,
        version: versionArg,
      }),
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
      const detail = errorBody.detail || errorBody.message || res.statusText;
      if (res.status === 409 || !includeDemo) {
        console.log(`Refit refused: ${detail}`);
        return;
      }
      throw new Error(`Model service /fit failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      modelVersion: string;
      source: string;
      fittedAt: string;
      skills: Record<string, unknown>;
      evaluation?: {
        heldOutLogLoss: number;
        defaultLogLoss: number;
        beatsDefault: boolean;
        testObservations: number;
        testLearners: number;
      };
    };

    const evalData = data.evaluation;
    if (evalData) {
      console.log(`Held-out log-loss: ${evalData.heldOutLogLoss.toFixed(4)} (default: ${evalData.defaultLogLoss.toFixed(4)})`);
      if (!evalData.beatsDefault) {
        console.log(
          `Activation refused: fitted model log-loss (${evalData.heldOutLogLoss.toFixed(4)}) did not beat default parameters (${evalData.defaultLogLoss.toFixed(4)}).`,
        );
        process.exitCode = 1;
        return;
      }
    }

    const artifactPath = outArg || resolve(__dirname, '../../../ml/model.json');
    writeFileSync(artifactPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Wrote model artifact to ${artifactPath}`);

    // Import and activate the newly fitted model
    await importModel(artifactPath, { activate: true, allowSynthetic: data.source === 'synthetic' });
  } finally {
    if (spawnedProcess) {
      spawnedProcess.kill();
    }
  }
}

async function main() {
  await refitModel();
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Refit failed.');
    process.exitCode = 1;
  });
}
