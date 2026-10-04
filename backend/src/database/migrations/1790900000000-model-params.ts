import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves the BKT parameters out of code and into data, so they can be refitted
 * from real practice logs without a redeploy. Scoring falls back to the shared
 * defaults for any skill with no fitted row.
 */
export class ModelParams1790900000000 implements MigrationInterface {
  name = 'ModelParams1790900000000';
  async up(q: QueryRunner) {
    const base = '"id" uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now()';
    await q.query(`CREATE TABLE "model_versions" (${base},
      "version" varchar(60) NOT NULL UNIQUE,
      "method" varchar(200) NOT NULL,
      "source" varchar(30) NOT NULL,
      "active" boolean NOT NULL DEFAULT false,
      "fittedAt" timestamptz NOT NULL,
      "skills" integer NOT NULL CHECK (skills >= 0))`);
    await q.query(`CREATE TABLE "skill_model_params" (${base},
      "modelVersion" varchar(60) NOT NULL REFERENCES model_versions(version) ON DELETE CASCADE,
      "skillCode" varchar(100) NOT NULL,
      "prior" double precision NOT NULL CHECK (prior > 0 AND prior < 1),
      "learn" double precision NOT NULL CHECK (learn > 0 AND learn < 1),
      "guess" double precision NOT NULL CHECK (guess > 0 AND guess < 1),
      "slip" double precision NOT NULL CHECK (slip > 0 AND slip < 1),
      "sequences" integer NOT NULL CHECK (sequences >= 0),
      "observations" integer NOT NULL CHECK (observations >= 0),
      UNIQUE ("modelVersion", "skillCode"),
      -- A model where guessing explains more than knowing is not usable.
      CHECK (guess + slip < 1))`);
    await q.query('CREATE INDEX "idx_skill_model_params_lookup" ON "skill_model_params" ("modelVersion", "skillCode")');
    // At most one active model at a time, so scoring is never ambiguous.
    await q.query('CREATE UNIQUE INDEX "one_active_model" ON "model_versions" ("active") WHERE "active" = true');
  }
  async down(q: QueryRunner) {
    for (const name of ['skill_model_params', 'model_versions']) await q.query(`DROP TABLE "${name}"`);
  }
}
