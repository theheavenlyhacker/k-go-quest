# K-Go Quests Backend

NestJS 12 API for Students, Teachers, and LGU Admins. PostgreSQL persistence uses TypeORM migrations. This implements the learning-and-rewards MVP; advanced AI and MDM integrations are separate work.

## Start with Aiven

The ignored `.env` contains your supplied Aiven connection and generated application secrets. Your downloaded project CA is copied to `certs/aiven-ca.pem`, also ignored. `DATABASE_SCHEMA=kgo` isolates this NestJS application from the other backend's public tables. Application tables are not automatically created on startup.

1. Install dependencies from the repository root: `npm ci` (npm workspaces).
2. Create tables: `npm run db:migrate`. This creates the configured schema and applies migrations under a deployment lock. Alternatively, run `database/schema.sql` once in an SQL client connected to Aiven's `defaultdb`; the export creates schema `kgo` and includes migration bookkeeping. Do not paste it over existing tables.
3. Create the first LGU admin: `npm run db:bootstrap`. Its login and generated password are in local `.env` under `BOOTSTRAP_LOGIN` and `BOOTSTRAP_PASSWORD`. Remove the bootstrap password from the environment after successful provisioning.
4. Optional demo: `npm run db:seed`. This creates `student-demo`, `teacher-demo`, a Grade 5 class, three original fraction questions, and a demo reward. Use the password in `DEMO_PASSWORD`. Demo records are not real student data.
5. Start: `npm run start:dev`.
6. API: `http://localhost:3000/api/v1`. Development documentation: `http://localhost:3000/api/docs`.
7. Verify connection and schema: `npm run db:check`. `ready: true` confirms the required columns and migration record exist in the configured schema. `GET /api/v1/health/ready` returns 503 when the application schema is incomplete, even if PostgreSQL accepts a connection.
8. Optional configured-database verification: `npm run smoke:configured`. This starts a temporary compiled API, checks all three demo roles, and logs them out. It uses `.env`, creates authentication/audit records, and requires bootstrap and demo seed. It does not award coins or redeem rewards.

Do not replace configured `.env` with `.env.example`. The example is for a new setup and contains placeholders. TLS certificate verification is enabled. Do not add SSL query parameters to DATABASE_URL; node-postgres can override explicit TLS settings if those parameters are present. Containers need the CA mounted at DATABASE_CA_PATH, or the PEM itself in DATABASE_CA where there is nowhere to mount a file.

For Expo on a physical device, use your computer's LAN IP instead of localhost. Add an exact browser development origin to CORS_ORIGINS for Expo web. Native clients do not rely on browser CORS.

## Structure

```
src/
  common/       # Identity, scoped access, audit, safe errors, pagination
  config/       # Environment validation and production settings
  database/     # Entities, migration, bootstrap, original demo seed
  modules/
    auth/       # Login, refresh rotation, logout, password changes
    users/      # LGU provisioning and deactivation
    schools/    # Schools within an LGU jurisdiction
    classrooms/ # Teacher assignments and enrollments
    content/    # Versioned lesson packs and safe downloads
    learning/   # Offline ingestion, mastery estimates, quests
    quizzes/    # Teacher-only item-bank selection
    rewards/    # Stock, wallet spending, vouchers and claims
    reports/    # Teacher signals, LGU aggregates, leagues, audit
    health/     # Liveness and readiness
scripts/        # Schema export and isolated integration runner
database/schema.sql
docs/           # API, database map, ML integration boundary
```

## Access

| Role      | Operations                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------- |
| STUDENT   | Own progress, quests, uploads and vouchers; own-jurisdiction content/rewards; aggregate class leagues |
| TEACHER   | Assigned classrooms/learners, own school, teacher quiz keys, content and aggregate leagues            |
| LGU_ADMIN | Own-jurisdiction schools, accounts, classrooms, content, rewards, claims, impact and audit            |

There is no public registration endpoint accepting a role. LGU admins provision accounts inside their jurisdiction. The database supplies current identity and role. Individual learning reports are available to the learner and assigned teacher; LGU impact reports are aggregate. Administration lists contain pseudonymous aliases. The backend does not collect faces, GPS, guardian numbers, or legal full names. IDs, aliases and progress remain pseudonymous records, not a guarantee of irreversible anonymization or automatic legal compliance.

## Offline sync

Download an immutable published pack, cache it in Expo, and retain attempts locally. POST `/learning/sync` accepts up to 100 events with client UUID, classroom UUID, exercise UUID, selected-option index and ISO timestamp. The server verifies enrollment, grade and the published answer, then returns confirmations and the authoritative wallet balance.

- Identical retries of `(studentId, clientAttemptId)` receive an acknowledgment without another reward. Changed payloads using the same ID return 409.
- Previously committed identical attempts remain acknowledgeable after the 30-day upload window closes or membership ends. Current enrollment and upload-window checks apply to new events.
- A new ID for an already attempted exercise does not farm mastery or coins. Only the first submitted response contributes. Later practice is stored but not newly rewarded; repeating an incorrect first response does not earn coins.
- Wallet, mastery, growth and audit updates commit together. An invalid item rolls back the entire batch. The mobile client retains events until acknowledged and can split invalid batches.
- Events may be up to 30 days old or five minutes ahead. Server receipt time selects the Asia/Manila league month. Client timestamps are untrusted.
- A PostgreSQL learner-row lock serializes uploads and reward spending, including concurrent requests.
- Student packs omit answer keys. Mobile feedback and coins must be labeled provisional until sync; this backend's grading mode is SERVER_ON_SYNC. Offline answer grading is not implemented.
- Packs have checksums and versions. Published packs cannot be edited; create a new version.

One online device session is active per account. Login elsewhere revokes older sessions but cannot erase an offline device cache. Shared-tablet PINs, device storage encryption and inactivity logout belong in Expo.

## Security

Salted scrypt hashes protect passwords. Access JWTs expire in 15 minutes. Refresh tokens expire after at most seven days, are hashed at rest, bound to the submitted device ID, and rotated. Old refresh tokens are rejected. Logout, password changes, new login and deactivation revoke sessions. Device IDs are application identifiers, not hardware attestation.

LGU admins can reset an account password within their jurisdiction; the reset is audited, clears lockout, and revokes sessions. Assigned teachers and LGU admins can remove or restore enrollment without deleting practice history. LGU admins can retrieve private content drafts, publish completed packs, restock rewards, and disable future redemption while honoring already-issued vouchers.

Five failed passwords lock an account for 15 minutes. Login responses do not disclose whether an account exists. Global and endpoint rate limits, strict nested DTO validation, rejection of extra fields, a 256 KiB body cap, parameterized queries, explicit CORS origins, Helmet, safe errors, request IDs, no-store responses and audited mutations are enabled. HTTP logs omit bodies, headers, query strings and credentials.

Production settings require verified database TLS, HTTPS browser origins, and disabled Swagger. Serve the API behind HTTPS. Set TRUST_PROXY_HOPS only for a known proxy topology; the default trusts no proxy headers. Rate limits use process-local storage; multi-instance deployment needs a shared limiter or gateway. Use separate least-privilege database users for runtime and migrations before deployment; the supplied Aiven admin is for initial setup. Backups, retention, load testing, credential rotation and independent security review remain deployment work.

## Learning and leagues

The BKT estimator is labeled `bkt-prototype-v1`. Its parameters are manually chosen; it is not a trained Python model or proof of learning impact. Teacher signals separate missing sync from difficulty. A learning-review rule requires at least five distinct exercises and estimated mastery below 40%; the teacher decides interventions.

Leagues rank classroom estimated mastery change. Skill deltas are averaged per learner, then across enrolled learners; missing practice counts as zero. The baseline is the first prior estimate observed during monthly server sync and may initially be the prototype prior. Cohort stability, skill coverage, comparable assessment design and anti-cheating validation must be addressed before real competitive funding depends on ranks. Reports do not invent costs, hours saved, accreditation or measured outcomes.

## Verification

```
npm run check
npm audit
```

Windows integration tests create a fresh loopback-only PostgreSQL cluster in `.tmp`, execute the exported SQL, test the API, then stop and remove the cluster. They never use Aiven from `.env`. Other platforms require TEST_DATABASE_URL set to an explicitly disposable database; test tables are truncated. Never point TEST_DATABASE_URL at data you want to keep.

The tests include a conflicting `public.users` table to verify schema isolation, concurrent uploads and wallet spending, all three roles, draft publishing, account recovery, enrollment changes, reward administration, and schema readiness. The compiled application is also started against a separate disposable database to verify its migration, seed, Swagger, and real HTTP workflows.

`npm run db:export` regenerates SQL from the migration. `npm run db:revert` removes the initial schema and is intended only for disposable development databases.

## Next integrations

Python training, on-device speech/OCR/essay evaluation, verified MATATAG mapping, camera paper grading, printable PDF generation, chat moderation, hubs, MDM commands, avatars, guardian messaging, accredited credentials, funding workflows and offline voucher claiming are not implemented. Quiz building selects existing items and returns teacher-only JSON. Reward issuance and claiming are online to centrally check stock and wallet balances. Khan Academy ingestion and branding require appropriate permissions.

See `docs/api.md`, `docs/database.md`, `docs/offline-contract.md` and `docs/ml-contract.md` for integration details.
