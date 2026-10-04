# k-go-quests-ml

Fits the Bayesian Knowledge Tracing parameters that K-Go Quests uses to
estimate what a learner knows. Trained from scratch on the platform's own
practice logs — no hosted model, no third-party API.

## Why BKT

Every answer a learner syncs is one bit: right or wrong, on a known skill, in
order. BKT is the model that fits that shape. It treats knowing a skill as a
hidden two-state variable and estimates four numbers per skill:

| parameter | meaning |
|---|---|
| `prior` (L0) | chance the learner already knew the skill before the first item |
| `learn` (T)  | chance an item moves them from not-knowing to knowing |
| `guess` (G)  | chance of a correct answer while still not knowing |
| `slip`  (S)  | chance of a wrong answer while already knowing |

The backend shipped with one hand-picked set of these four numbers shared by
every skill. That is a guess, and it is wrong in different directions for
different skills: fractions and reading inference do not have the same guess
rate when one is multiple-choice arithmetic and the other is comprehension.
This repo replaces the guess with values fitted from data.

## Method

Expectation-Maximisation (Baum-Welch) over a constrained two-state HMM, run
per skill across every learner's sequence for that skill.

- **No forgetting.** The transition matrix is `[[1-T, T], [0, 1]]` — once known,
  stays known within a sequence. This is the standard BKT constraint.
- **Scaled forward-backward**, so long sequences do not underflow.
- **Ten random restarts** per skill, best log-likelihood wins. The likelihood
  surface has local optima; a single start is a coin flip.
- **Degeneracy bounds** after every EM step: `guess ≤ 0.30`, `slip ≤ 0.10`.
  Without these, EM finds "guessing explains everything" solutions where a
  correct answer *lowers* the mastery estimate. Any fit that still ends with
  `guess + slip ≥ 1` is discarded and the skill keeps the shared defaults.
- **Evidence minimums**: 25 learner-sequences and 150 answers per skill. Below
  that the skill is reported as unfitted and scores on defaults. A parameter
  fitted from 30 answers is noise with a decimal point on it.

## Validation

There are no real learners yet, so the fitter is judged by parameter recovery:
simulate sequences from parameters we chose, refit, and check it finds them.

```bash
python3 tests/test_recovery.py
```

Current result — four parameter sets spanning an easy skill, a hard one, a
mostly-known one and a guessable one, all recovered inside tolerance:

```
balanced       truth prior=0.25 learn=0.12 guess=0.18 slip=0.07
               fit   prior=0.242 learn=0.120 guess=0.173 slip=0.065
hard skill     truth prior=0.08 learn=0.05 guess=0.10 slip=0.04
               fit   prior=0.103 learn=0.050 guess=0.105 slip=0.032
```

The suite also pins `update_mastery` to golden values taken from the backend's
`src/modules/learning/mastery.ts`. **If that test fails, the Python and
TypeScript implementations have drifted and fitted parameters no longer mean
the same thing on both sides.** Fix the drift; do not update the constant.

## Running it

```bash
pip install -r requirements.txt

# exercise the whole path with a simulated cohort
python3 scripts/fit_model.py --source synthetic --out model.json

# fit against real practice logs
python3 scripts/fit_model.py --source postgres --out model.json \
    --database-url "postgresql://avnadmin:...@...aivencloud.com:12590/defaultdb?sslmode=require" \
    --schema kgo \
    --version bkt-em-2026Q4
```

`--schema` must match `DATABASE_SCHEMA` in the backend's `.env`. It matters more
than it looks: a stale `attempts` table left behind in `public` resolves through
the default search path and the fitter reads *that* instead, reporting "no
practice data" while a full database sits one schema away. The loader now pins
the schema and fails loudly if the table is not there.

Then, in the backend repo:

```bash
npm run migration:run                              # once, adds the tables
npm run model:import -- ../khan-go-quest-ml/model.json --activate
```

The importer refuses synthetic parameters unless `--allow-synthetic` is passed,
so a simulated fit cannot reach a live jurisdiction by accident. It also
refuses degenerate parameter sets and duplicate versions.

## What this does not do

- It does not personalise per learner. BKT parameters are per *skill*; the
  per-learner state is the mastery estimate the backend already stores.
- It does not use response time or hint usage, because the schema does not
  record them yet. Both are strong signals and would need a migration first.
- It does not claim measured learning outcomes. These are practice estimates.
  The backend's impact endpoint says so, and so should any report built on it.

## Retraining

Refit when a skill's answer count has roughly doubled, or quarterly, whichever
comes first. Always import with a new `--version`; versions are immutable and
`attempts` is the source of truth, so an old fit can be reproduced exactly.
