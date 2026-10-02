import 'dotenv/config';
import { readFileSync } from 'node:fs';
import dataSource from './data-source';
import { ModelVersion, SkillModelParams } from './entities';

/**
 * Imports fitted BKT parameters produced by the khan-go-quest-ml repo.
 *
 *   npm run model:import -- model.json --activate
 *   npm run model:import -- model.json --dry-run
 *
 * Synthetic fits are refused unless --allow-synthetic is passed, so simulated
 * parameters cannot be promoted into a live jurisdiction by accident.
 */
interface SkillRow {
  prior: number; learn: number; guess: number; slip: number;
  sequences: number; observations: number; fitted: boolean; note?: string;
}
interface ModelFile {
  modelVersion: string; fittedAt: string; source: string; method: string;
  skills: Record<string, SkillRow>;
}

const inRange = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1;

function parse(path: string): ModelFile {
  const data = JSON.parse(readFileSync(path, 'utf8')) as ModelFile;
  if (!data.modelVersion || !data.fittedAt || !data.skills) throw new Error('Not a model file: missing modelVersion, fittedAt or skills');
  if (data.modelVersion.length > 60) throw new Error('modelVersion must be 60 characters or fewer');
  for (const [skill, row] of Object.entries(data.skills)) {
    if (!row.fitted) continue;
    for (const key of ['prior', 'learn', 'guess', 'slip'] as const) {
      if (!inRange(row[key])) throw new Error(`${skill}: ${key} must be strictly between 0 and 1`);
    }
    if (row.guess + row.slip >= 1) throw new Error(`${skill}: guess + slip must be below 1 (degenerate model)`);
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith('--'));
  if (!path) throw new Error('Usage: model:import -- <model.json> [--activate] [--dry-run] [--allow-synthetic]');
  const activate = args.includes('--activate');
  const dryRun = args.includes('--dry-run');

  const data = parse(path);
  if (data.source === 'synthetic' && !args.includes('--allow-synthetic')) {
    throw new Error('This file holds synthetic parameters. Re-run with --allow-synthetic only on a scratch database.');
  }

  // Skills the fitter declined to fit are left out entirely, so scoring falls
  // back to the shared defaults rather than storing a fake "fitted" row.
  const fitted = Object.entries(data.skills).filter(([, row]) => row.fitted);
  console.log(`${data.modelVersion}: ${fitted.length} fitted of ${Object.keys(data.skills).length} skills (source: ${data.source})`);
  if (dryRun) { console.log('Dry run — nothing written.'); return; }
  if (!fitted.length) throw new Error('Nothing to import: no skill met the evidence minimums.');

  const db = dataSource();
  await db.initialize();
  try {
    await db.transaction(async (manager) => {
      if (await manager.existsBy(ModelVersion, { version: data.modelVersion })) {
        throw new Error(`Model version ${data.modelVersion} is already imported. Refit with a new --version.`);
      }
      if (activate) await manager.update(ModelVersion, { active: true }, { active: false });
      await manager.save(ModelVersion, manager.create(ModelVersion, {
        version: data.modelVersion,
        method: data.method.slice(0, 200),
        source: data.source.slice(0, 30),
        active: activate,
        fittedAt: new Date(data.fittedAt),
        skills: fitted.length,
      }));
      await manager.save(SkillModelParams, fitted.map(([skillCode, row]) => manager.create(SkillModelParams, {
        modelVersion: data.modelVersion,
        skillCode,
        prior: row.prior, learn: row.learn, guess: row.guess, slip: row.slip,
        sequences: row.sequences, observations: row.observations,
      })));
    });
    console.log(activate ? 'Imported and activated. New syncs score with these parameters.' : 'Imported. Re-run with --activate to score with it.');
  } finally {
    await db.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Import failed.');
  process.exitCode = 1;
});
