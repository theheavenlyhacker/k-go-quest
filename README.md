# K-Go Quests

**Khan-on-the-Go: Quest Edition** — an offline-first, AI-driven learning platform
for Philippine public schools. It pairs a multi-subject offline tablet shell with
a growth-based classroom league and strict learner-protection guardrails, so that
a learner on a DepEd-issued tablet with no signal can keep practising, and the
teacher still gets usable signals when the device next finds Wi-Fi.

This repository holds all three parts of the platform.

| Folder | What it is | Stack |
| --- | --- | --- |
| [`backend/`](backend) | REST API, PostgreSQL schema, offline sync, rewards, leagues, reports | NestJS 12, TypeORM 0.3, PostgreSQL |
| [`mobile/`](mobile) | The tablet shell — 31 screens across learner, teacher and LGU-admin roles | Expo SDK 57, expo-router, React Native 0.86, Reanimated 4 |
| [`ml/`](ml) | Bayesian Knowledge Tracing fitter, validation suite and inference service | Python 3.11, NumPy, FastAPI |

Read [`SPEC.md`](SPEC.md) for the full requirements — every feature in the
concept, turned into something testable, with its current status. Read
[`ml/REQUIREMENTS.md`](ml/REQUIREMENTS.md) for the model-by-model version of the
same thing.

## How the three parts fit together

```
          authoring / online                      offline, on the tablet
  ┌──────────────────────────────┐        ┌──────────────────────────────────┐
  │ backend (NestJS)             │        │ mobile (Expo)                    │
  │  • publishes immutable       │ pack   │  • SQLite cache, AES-256-GCM      │
  │    content packs   ─────────────────► │  • per-profile PIN, auto-lock     │
  │  • grades attempts on sync   │        │  • answers queue in an outbox     │
  │  • mastery, coins, vouchers  │ ◄───── │  • low-bandwidth batch sync       │
  │  • growth-delta leagues      │ sync   │                                   │
  └───────────┬──────────────────┘        └──────────────────────────────────┘
              │ attempts (anonymised: id, skill, correct)
              ▼
  ┌──────────────────────────────┐
  │ ml (Python)                  │   fitted parameters, imported by version
  │  • EM-fits BKT per skill     │ ──────────────────────────────────────────►
  │  • validates by recovery     │   into skill_model_params / model_versions
  │  • FastAPI service for       │
  │    prediction and insight    │
  └──────────────────────────────┘
```

The scorer lives in the backend, not the model service, so a learner's mastery
never depends on a network hop. Python fits the parameters; TypeScript applies
them. The two implementations are pinned to each other by a golden-value test —
if `ml/kgo_bkt/model.py` and `backend/src/modules/learning/mastery.ts` ever
disagree, that test fails.

## What is actually built

Being precise about this matters more than looking finished.

**Working, tested, running against a real database**

- Offline sync: idempotent batch upload keyed by client UUID, server-side
  grading, pessimistic row lock per learner, rollback on an invalid batch.
- Auth: scrypt password hashes, 15-minute access tokens, rotating refresh tokens
  bound to a device ID, one active online session per account, lockout after five
  failures.
- Content packs: versioned, checksummed, immutable once published; student packs
  ship without answer keys.
- Rewards: Khan-Coin wallet, stock-checked voucher issuance, claim workflow.
- Growth-delta leagues: classrooms ranked by mean mastery change, with no
  practice counting as zero movement so a class cannot climb by having its
  weakest learners stop.
- BKT: four parameters per skill fitted by Expectation-Maximisation, validated by
  parameter recovery on synthetic cohorts, imported into the backend by version.
- Tablet shell: all 31 screens, offline cache, per-profile PIN, voice hints via
  `expo-speech`, printable quizzes with QR headers, voucher QR codes.

**Partly built**

- Plateau flagging is a deterministic rule (≥5 exercises, mastery < 0.40), not a
  predictive model. It works and is explainable; it cannot yet tell a learner who
  is climbing slowly from one who has stopped.
- The MATATAG quiz builder selects from the item bank and prints with a QR
  header. Competency *alignment* and camera grading are not implemented.
- Mastery updates only on the first attempt per exercise. Deliberate — it stops
  coin farming — but it also means later practice does not move the estimate.

**Not built, and named as such in the UI rather than faked**

Handwriting and essay OCR, free-text comprehension scoring, a conversational
tutor, forum moderation filters, MDM device commands, a device registry, avatar
customisation, accredited micro-credentials, guardian messaging, offline voucher
claiming, Khan Academy content ingestion. `SPEC.md` §7 says which of these are
ordinary engineering and which are out of reach for a project this size.

## Running it

Each folder has its own README with the detail. The short version:

```bash
# 1. backend — needs a PostgreSQL database
cd backend
cp .env.example .env          # fill in DATABASE_URL and generate JWT_SECRET
npm ci
npm run migration:run         # create the schema
npm run db:bootstrap          # first LGU admin, credentials from .env
npm run db:seed               # optional demo class, lessons and reward
npm run start:dev             # http://localhost:3000/api/v1

# 2. mobile — point it at the backend's LAN IP, not localhost, for a real device
cd ../mobile
npm install
npx expo start

# 3. ml — fit parameters once there is practice data
cd ../ml
pip install -r requirements.txt
python -m pytest                                   # 6 recovery tests
python scripts/fit_model.py --database-url "$DATABASE_URL" --schema kgo --out model.json
cd ../backend && npm run model:import -- --file ../ml/model.json --activate
```

The fitter refuses to fit a skill with fewer than 25 sequences or 150
observations, and the importer refuses degenerate parameters (`guess + slip ≥ 1`)
and synthetic ones without `--allow-synthetic`. Both failures are loud on
purpose: a model fitted on nothing is worse than no model.

## Learner protection

The architecture carries these, not a policy document:

- **No PII.** Profiles are anonymised system IDs. No legal names, faces, GPS,
  or guardian numbers are collected. Admin lists show pseudonymous aliases.
- **Encrypted at rest on the device.** AES-256-GCM, key in the platform keystore,
  each record bound to its owner and cache key so a row cannot be replayed into
  another learner's profile on a shared tablet.
- **Shared-tablet safety.** Six-digit PIN per profile, device-bound PIN verifier
  (a copied database cannot be brute-forced offline), auto-lock on inactivity,
  one active online session per account.
- **Supplementary, never evaluative.** No model output is the sole basis for a
  grade, placement or intervention. Every flag goes to a teacher who decides.
- **Provisional until sync.** The tablet never claims an answer is correct; the
  server grades, and the UI says so.

These are engineering measures taken to meet the Data Privacy Act of 2012. They
are not a legal compliance certification, and a real deployment still needs a
privacy impact assessment, retention policy, DPO sign-off and an independent
security review.

## Documentation

| Document | Covers |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Platform requirements, acceptance criteria, traceability, non-goals |
| [`ml/REQUIREMENTS.md`](ml/REQUIREMENTS.md) | Per-model requirements, feasibility tiers, missing data signals |
| [`backend/docs/api.md`](backend/docs/api.md) | Endpoints, roles, payloads |
| [`backend/docs/database.md`](backend/docs/database.md) | Table-by-table schema map |
| [`backend/docs/offline-contract.md`](backend/docs/offline-contract.md) | Download and sync contract the mobile client implements |
| [`backend/docs/ml-contract.md`](backend/docs/ml-contract.md) | Boundary between the backend scorer and the Python fitter |

## Notes

Khan Academy is referenced as the content source the platform is designed to
carry. No Khan Academy content, API or branding is included in this repository,
and shipping any would require their permission. The MATATAG competency
catalogue is DepEd's; no catalogue data is bundled here either.

`mobile/LICENSE` is the MIT license that shipped with the `create-expo-app`
template and covers that template, not this project.
