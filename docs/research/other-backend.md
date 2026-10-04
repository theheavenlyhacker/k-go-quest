# The "other backend": does a second K-Go server exist, and does it share our database?

**Question.** Two docs in `backend/docs/` assert that another K-Go backend exists — one that
speaks `/v1/sync/push` with device-token enrollment, client coin events and snake_case
payloads, and that owns the `public` tables in the same Postgres instance. Is it real? What
protocol does it speak? Does it share the Aiven Postgres instance with the NestJS app in
`backend/`? And must the forthcoming tablet-facing server contract spec account for it?

## Answer, if you read nothing else

**No second K-Go backend exists as a reachable artifact anywhere this repo can see, and the
tablet-facing contract spec can treat it as out of scope — provided the spec restates the two
invariants that currently make that safe.** Every trace of the "separate Express app" in this
repository is two sentences of prose in two Markdown files; there is no route definition, no
schema, no package manifest, no branch, no tag and no sibling repository containing it. The
string `sync/push` has existed in exactly one file for the whole life of the repo
(`backend/docs/offline-contract.md`), and `device_token`, `/v1/sync`, `coin_event` and
`client_attempt_id` return **zero** hits across all history. The tag `v0-fullstack`, which the
question flagged as a candidate, is *not* the Express app — it is this repo's own earlier
NestJS full-stack version. Separately, the `kgo`-schema isolation that `backend/docs/database.md`
describes is **real, not convention**: a single code path sets both TypeORM's `schema` and a
per-connection `-c search_path=<schema>` with no `public` fallback, and refuses any
`DATABASE_URL` that tries to smuggle `search_path` in as a query parameter. The one genuine
coupling hazard the spec *should* name is not the mythical Express app at all — it is `ml/.env`,
which defines its own `DATABASE_URL` and `DATABASE_SCHEMA`, making the ML service a second
real process pointed at the same database.

## Confidence and gaps

**High confidence** on: the absence of the Express app from this repo and its history
(exhaustive pickaxe and per-tree enumeration, below); the identity of `v0-fullstack`; the
mechanism and completeness of schema isolation; the mobile client never having spoken the
snake_case protocol; the absence of any deploy step in CI.

**Gaps, stated plainly:**

- **The Express app's existence outside this repo is unproven in both directions.** I can show
  it is not in this repo, not in its history, and not in any of the four other repositories
  under `vannynotfound`. I *cannot* show it does not exist on someone's laptop, in a private
  repo under another account, or already deployed against the shared Aiven instance. The two
  doc sentences are first-party assertions by this repo's author and are weak evidence that
  *something* existed; they are not evidence of what or where.
- **The actual contents of the `public` schema are unverified.** Per the task constraint I did
  not connect to any database. Whether `public` currently holds the other backend's tables, is
  empty, or never existed is unknown from source.
- **No ADR or issue explains it.** `docs/adr/` does not exist despite `AGENTS.md` referencing
  it, and no GitHub issue mentions the Express app.
- Claims marked *(inference)* below are mine, not the repo's.

---

## 1. Does it exist as a reachable artifact?

### The two asserting sources — and one correction to the premise

The `database.md` quote is accurate. `backend/docs/database.md:3`:

> Run `npm run db:migrate` to create the schema selected by `DATABASE_SCHEMA` (default `kgo`).
> […] **Existing `public` tables belong to the other backend and are not modified.**

The second quote is **not in `backend/docs/api.md`**. The current `api.md` ends at line 90 with
the Redemption section. The sentence actually lives at **`backend/docs/offline-contract.md:20`**,
the last line of that file:

> This NestJS API uses camelCase and `/api/v1` routes. The separate Express app's
> `/v1/sync/push`, device-token enrollment, client coin events, and snake_case payloads are a
> different protocol and are not compatible without an explicit client migration.

Worth correcting in whatever brief cites it, so the next reader does not grep `api.md` and
conclude the claim was deleted.

### Tags

One tag exists in the repository:

```
v0-fullstack -> 4483035d7e9601f346b762dc6489f37fe589a92b
               "build: convert to Turborepo with npm workspaces"  (Fri Oct 2 2026)
```

**`v0-fullstack` is not the other backend.** Its top-level tree is `backend/ ml/ mobile/` plus
Turborepo config, and `git show v0-fullstack:backend/package.json` names it
`khan-go-quests-backend` with `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm`, `typeorm` and
`pg`. `express` appears only transitively, as the dependency of `@nestjs/platform-express` —
which is NestJS's standard HTTP adapter, not a separate Express app.

The repo says as much itself. `README.md:75`: "The previous full-stack version is tagged
`v0-fullstack`." And `docs/online-mode.md:152`: "~~Restore `backend/` and `ml/service/` from
`v0-fullstack`, and the backend CI job.~~ Done." `v0-fullstack` is this project's own earlier
self.

### Branches, local and remote

Local: `feat/online-mode` (HEAD), `jai-ver`, `main`. Remote (`git ls-remote origin`) adds ten
`issue-N-*` feature branches plus `turborepo`, which points at the same commit as
`v0-fullstack`. Every one is a branch of this same three-workspace project.

### Every tree in history

Enumerating the top-level entry of every commit reachable from every ref —
`git rev-list --all | while read c; do git ls-tree --name-only $c; done | sort -u` — yields the
complete set of top-level paths that have *ever* existed:

```
.dockerignore  .github  .gitignore  AGENTS.md  CONTEXT.md
README.md  SPEC.md  backend  docs  ml  mobile
package-lock.json  package.json  turbo.json
```

There has never been a second server directory. The same sweep for `package.json` files ever
committed returns exactly three: `backend/package.json`, `mobile/package.json`, and the root
workspace manifest.

The repo's first commit, `e3a8699` (Fri Oct 2 2026), states its own scope:

> K-Go Quests: backend, tablet shell and BKT model in one repository
>
> Brings the three projects together:
> - `backend/` NestJS 12 API, PostgreSQL via TypeORM, offline sync, rewards, growth-delta leagues, reports
> - `mobile/` Expo SDK 57 tablet shell […]
> - `ml/` Bayesian Knowledge Tracing […]

*(Inference)* The Express app was a fourth, pre-existing project that was never brought into
this merge, and `offline-contract.md:20` was written to warn a client developer who might still
have been holding its protocol in mind. That sentence was present in `e3a8699` itself — the
very first commit — so the Express app predates this repository entirely.

### Other repositories under the same account

`gh repo list vannynotfound` returns five:

| Repo | What it actually is | The other backend? |
| --- | --- | --- |
| `k-go-quests` | this repo | — |
| `testBackend` | `"NestJS auth + users REST API (MySQL on Aiven)"`; deps `@nestjs/core`, `mysql2`; routes `src/auth/*`, `src/users/*` | **No** — NestJS not Express, MySQL not Postgres, no sync/coins |
| `auth-rest-api-manipulation` | NestJS + `mysql2`, `src/auth/*` + `src/users/*` | **No** — same reasons |
| `nestjs-installation` | NestJS scaffold, no `database/` dir | **No** |
| `DuaDana` | `"A finance app for couple"`; `server/src/app.ts` is Express, but models are `Account`, `Couple`, `CoupleInvite`, `User` | **No** — unrelated domain |

`DuaDana` is the only Express server in the account, and it is a couples' finance app with no
exercises, coins, mastery or device enrollment. GitHub code search across the account for
`sync/push` and for `device_token` both returned `total_count: 0`.

### GitHub Issues

`AGENTS.md` names GitHub Issues as where issues and specs live. Fourteen issues exist; none
mentions Express or a second backend. Issue 3, "Remove the backend and server-only features",
is about *this* repo's NestJS backend (it is the issue behind commit `157ee1d`).

**Conclusion for Q1: no evidence found, anywhere reachable, that the Express app exists as an
artifact.** It exists only as two sentences of prose.

## 2. What protocol does it speak?

Only what `backend/docs/offline-contract.md:20` says it does, which is four bare nouns:
`/v1/sync/push`, device-token enrollment, client coin events, snake_case payloads.

**No route definition, DTO, schema or test for any of it exists in this repo or its history.**
`git log --all -S<term>` — which reports every commit where a string's occurrence count changed,
across all refs — gives:

| Term | Commits touching it |
| --- | --- |
| `sync/push` | `e3a8699`, `157ee1d`, `3d84fc7`, `e735461` — **all four are the prose file only** |
| `device_token` | none |
| `/v1/sync` | none |
| `coin_event` | none |
| `client_attempt_id` | none |

And `git grep -l "sync/push" <commit>` for each of those four commits returns
`backend/docs/offline-contract.md` and nothing else (it returns nothing at `157ee1d` and
`3d84fc7`, the commits that removed the backend — see §5).

So the four protocol features cannot be quoted from source, because no source for them exists
here. **This is the finding, not a failure to find it.** Any spec statement about the Express
app's wire format would be repeating one unsourced sentence.

For contrast, the protocol the NestJS app *does* speak is fully specified and quotable:
`backend/docs/api.md:3` fixes the base path at `/api/v1` with `Authorization: Bearer
<accessToken>`; `api.md:27` defines `POST learning/sync`; and `api.md:56-68` gives the sync
payload in camelCase — `clientAttemptId`, `classroomId`, `exerciseId`, `selectedOption`,
`occurredAt`. `api.md:70` states the authority rule the Express app's "client coin events"
would violate: "Do not send correctness, coins, mastery, role or studentId; those values come
from the server."

## 3. Does it share the Aiven Postgres instance? Is the isolation real?

**The isolation is real and enforced in code, not convention.** It rests on four mechanisms,
all in `backend/src`.

**(a) One choke point.** `backend/src/database/data-source.ts:10` exports `databaseOptions()`,
and it is the *only* producer of connection options. Both consumers go through it:
`backend/src/database/database.module.ts:14` (the running app, passing
`config.getOrThrow<string>('DATABASE_SCHEMA')` at line 18) and
`backend/src/database/data-source.ts:53` `cliDataSource()` / `backend/src/database/migrate.ts:9`
(every CLI task). There is no second path that could omit the schema.

**(b) Both layers are pinned, with no `public` fallback.** `data-source.ts:28-49` returns:

```ts
return {
  type: 'postgres',
  url,
  schema,                                    // line 31 — TypeORM entity resolution
  …
  extra: {
    …
    // Raw SQL and migration references must never fall back to public tables.
    options: `-c search_path=${schema}`,     // line 48 — the server-side session
  },
};
```

Line 31 covers TypeORM's generated SQL; line 48 covers hand-written SQL and migration DDL. The
`search_path` is set to the single schema — note there is no `, public` appended, which is what
makes the comment on line 47 true rather than aspirational.

**(c) The escape hatch is closed.** Overriding the schema via the connection URL is rejected
twice, independently. `data-source.ts:18-27` throws if any `DATABASE_URL` query parameter
starts with `ssl` or is `options`/`search_path`. `backend/src/config/environment.ts:33-42`
repeats the same check at boot with the message "Configure database TLS and schema through
dedicated environment values, not URL parameters". So a deployer cannot reach `public` by
appending `?options=-csearch_path%3Dpublic`.

**(d) The identifier is validated, not interpolated blindly.**
`backend/src/database/schema.ts:5-11`:

```ts
export function databaseSchema(input = 'kgo'): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(input) || input.startsWith('pg_'))
    throw new Error('DATABASE_SCHEMA must be a lowercase PostgreSQL identifier');
  return input;
}
```

This matters because line 48 interpolates the value into a connection string. The same
constraint is applied a second time at the config boundary,
`backend/src/config/environment.ts:13-16`, which pattern-matches `DATABASE_SCHEMA` and
explicitly `.invalid('pg_catalog', 'pg_temp', 'pg_toast')` with `.default('kgo')`.

Corroborating: `grep -rn "public" backend/src --include=*.ts` finds **no** reference to the
`public` schema anywhere in the backend source.

**The SQL export agrees.** `backend/database/schema.sql:1-6`:

```sql
-- K-Go Quests: fresh PostgreSQL schema kgo.
-- Run once in defaultdb. Includes TypeORM migration bookkeeping.
-- Existing public tables are not changed. This script contains no credentials or user data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "kgo";
SET LOCAL search_path = "kgo";
```

Every `CREATE TABLE` that follows is unqualified and therefore lands in `kgo`. `grep -i public`
over the whole file matches only the line-3 comment.

### What would collide if the isolation were not there

This is not hypothetical, and the repo says so itself. `backend/src/database/schema.ts:13`
carries this comment above the readiness checker:

```ts
// Check columns as well as names: another app can have a different users table.
```

That is first-party acknowledgement that a second app with a colliding `users` table is
anticipated. The collision surface, from `backend/database/schema.sql` and
`backend/docs/database.md:5-22`:

- **`users`** — the sharpest. `schema.sql:12` defines it with `"loginId" varchar(80) NOT NULL
  UNIQUE`, a `role` CHECK constrained to `('STUDENT','TEACHER','LGU_ADMIN')`, and
  `"coins" integer NOT NULL DEFAULT 0 CHECK (coins >= 0)`. A `public.users` with a different
  shape would break entity hydration; one with the *same* shape would silently merge two
  identity populations and two coin ledgers.
- **`coins` as an authoritative wallet.** `backend/docs/api.md:72` makes `coinBalance` "the
  authoritative wallet" and `api.md:70` forbids client-reported coin deltas. The Express app's
  "client coin events" are precisely the opposite model. Two writers on one `users.coins`
  column with opposing authority rules is an unbounded reconciliation problem.
- **Generic table names.** `attempts`, `enrollments`, `classrooms`, `schools`, `lessons`,
  `exercises`, `rewards`, `redemptions`, `audit_events`, `auth_sessions` are all plausible
  names for a second education backend to have chosen.
- **`migrations`.** `database.md:22` notes TypeORM bookkeeping lives here. A shared
  `public.migrations` would corrupt both apps' migration state.
- **Quoted camelCase columns.** `database.md:3`: "Keep the quoted camelCase column names: they
  match the TypeORM entities." A snake_case-native app's tables are structurally incompatible —
  which is also *(inference)* why the two apps could not accidentally share a table even if
  names collided; the columns would not resolve.

**One shared resource is genuinely not schema-scoped** *(inference, from Postgres semantics
rather than from the repo)*: `backend/src/database/migrate.ts:34` takes
`pg_advisory_lock(hashtext('kgo:migrations:<schema>'))`. Advisory locks are database-wide, not
schema-scoped. The `kgo:` namespace prefix makes a real collision very unlikely, but it is the
one place where a second app on the same database could block this one. Worth a line in the
spec's operational notes, not a design change.

### Verification tooling

`backend/src/database/schema.ts:132` `inspectSchema()` queries
`information_schema.columns WHERE table_schema = $1` with the validated schema, then checks
every table in `REQUIRED_COLUMNS` (`schema.ts:14-130`, 16 tables) **column by column**, and
confirms the `InitialSchema1790800000000` row exists. Surfaced as `npm run db:check`
(`backend/docs/database.md:26`). So the isolation is not only enforced, it is *asserted* at
deploy time — a `public`-leaking misconfiguration would fail readiness rather than run
silently. `database.md:26` is honest about its ceiling: "Readiness is not an exhaustive
constraint/permission audit."

## 4. Is it deployed or live?

**No evidence that either backend is deployed from this repository.**

- **`.github/workflows/` contains one file, `ci.yml`, and it has no deploy job.** Three jobs —
  `backend (NestJS)`, `mobile (Expo)`, `ml (BKT)` — all terminating in test/lint/audit steps
  (`ci.yml:33-34`, `:50-52`, `:67-68`). Its Postgres is a disposable service container with
  `POSTGRES_USER: kgo_test` and a credential literally named `disposable-ci-password`
  (`ci.yml:13-21`). No Aiven host, no registry push, no environment secret.
- **No host or URL anywhere.** `grep -iE "aiven|https?://|host"` over `ci.yml`,
  `backend/docker-compose.yml` and `backend/Dockerfile` returns nothing.
- **`backend/docker-compose.yml` is local-only.** One `postgres:17-alpine` service bound to
  `127.0.0.1:5432:5432` (line 9) — explicitly loopback, not `0.0.0.0`. It defines only the
  database; there is no app service and no second backend service.
- **`backend/.env.example` names no remote.** `DATABASE_URL` is
  `postgresql://kgo:replace-with-local-db-password@localhost:5432/kgo` (line 3),
  `DATABASE_SCHEMA=kgo` (line 5), `DATABASE_SSL=false` (line 6). Every secret is a
  `replace-with-…` placeholder, and `environment.ts:44` refuses to boot on a `JWT_SECRET` still
  starting with `replace-`.
- **Dockerfiles:** `backend/Dockerfile` and `ml/Dockerfile` exist but nothing in CI builds or
  pushes them.

### Populated `.env` files (keys only; no values read or recorded)

Three untracked env files exist. Per the task constraint I recorded **key names only** and read
no values.

- **`backend/.env`** defines: `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_SSL`,
  `DATABASE_SCHEMA`, `DATABASE_CA_PATH`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_ISSUER`,
  `CORS_ORIGINS`, `SWAGGER_ENABLED`, `TRUST_PROXY_HOPS`, `BOOTSTRAP_LOGIN`,
  `BOOTSTRAP_PASSWORD`, `BOOTSTRAP_JURISDICTION`, `DEMO_PASSWORD`. Exactly the
  `.env.example` key set — no extra key referring to another backend.
- **`ml/.env`** defines: `DATABASE_URL`, `DATABASE_SCHEMA`, `KGO_ML_TOKEN`. **This is the
  finding that matters for the spec** — see §6.
- **`mobile/.env.local`** defines one key: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Notably it does
  **not** define an API base URL, so the mobile app falls through to the `resolveApiUrl`
  default (§5). Clerk is the Caretaker Account provider described at `docs/online-mode.md:66`.

The presence of a populated `backend/.env` *(inference)* means the NestJS app has been pointed
at a real database by someone locally — `database.md:3` and `:26` reference Aiven's `defaultdb`
and certificate verification, and `DATABASE_CA_PATH` exists for exactly that. That is a local
developer connection, not a deployment, and says nothing about the Express app.

## 5. Does the mobile app talk to it, now or historically?

**No, and it never could have.** `mobile/src/domain/client.ts:73`, the last line of
`resolveApiUrl`:

```ts
return value.replace(/\/$/, '').replace(/(?:\/api\/v1)?$/, '/api/v1');
```

This **coerces** any configured base URL to end in `/api/v1`. A deployer who set the Expo
public API variable to `https://host/v1` would get `https://host/v1/api/v1` — the Express app's
`/v1/sync/push` is unreachable by construction, not merely unconfigured. The default when
nothing is set is `http://<metroHost>:3000/api/v1` (`client.ts:69`), and `client.ts:71-72`
rejects any non-HTTPS URL outside development.

`grep -nE "[a-z]+_[a-z]+" mobile/src/domain/client.ts` finds **no snake_case identifier at
all**.

### Full history of the mobile sync client

`git log --all --diff-filter=AD --name-status` over `mobile/src/domain/client.ts` and
`mobile/src/domain/sync.ts`:

| Commit | Action |
| --- | --- |
| `e3a8699` | **A** — both added, in the repo's first commit |
| `5908e4b` `feat(mobile): local profiles replace server sign-in` | **D** — both deleted |
| `3d84fc7` `Offline-only K-Go Quests: Expo app with on-device BKT (#30)` | **D** — deleted on the merged branch |
| `e735461` `feat(online): Online Mode as an accelerator over the offline app` | **A** — both restored |

Enumerating every tree in history for `mobile/.*(client|sync|api)\.ts` returns only those two
paths — there was never a second, alternative client module.

**And the original was already camelCase on `/api/v1`.** `git show
e3a8699:mobile/src/domain/client.ts` has the identical `/api/v1` coercion at line 73, and
`git show e3a8699:mobile/src/domain/sync.ts:13` validates response fields named
`clientAttemptId`, `correct`, `duplicate`, `awardedCoins` — camelCase, matching
`backend/docs/api.md:72`.

**So there is no removal commit to cite, because there was never a snake_case client to
remove.** The deletions above removed the *NestJS* client, as part of the deliberate
offline-only pivot (GitHub issues 3 and 4: "Remove the backend and server-only features",
"Local Profiles replace server sign-in"), and `e735461` restored it per
`docs/online-mode.md:155`: "Restore `domain/client.ts` and `domain/sync.ts`".

## 6. What breaks if it is ignored? — the answer for the contract spec

**The tablet-facing contract spec can treat the other backend as out of scope.** There is no
demonstrable coupling to address:

| Coupling to rule out | Verdict | Source |
| --- | --- | --- |
| Shared tables | **No.** `kgo` only, enforced at four points, with no `public` fallback and a deploy-time assertion | `data-source.ts:31,48`; `environment.ts:33-42`; `schema.ts:5-11`; `schema.sql:5-6` |
| Shared user identities | **No.** Learner identity is local by design — alias + PIN, "no server identity" | `docs/online-mode.md:14-18`, `:37` |
| Shared coin balances | **No.** `users.coins` lives in `kgo`; server is sole authority and client coin deltas are refused | `schema.sql:12`; `api.md:70-72` |
| Client can reach it | **No.** Base URL is coerced to `/api/v1` | `client.ts:73` |
| Shared deployment | **No evidence.** CI has no deploy job; no host configured anywhere | `.github/workflows/ci.yml` |

**But "out of scope" should be written down as a bounded claim, not an omission.** Three things
belong in the spec:

1. **State the schema boundary as a contract term, not an implementation detail.** "The server
   reads and writes only the schema named by `DATABASE_SCHEMA` (default `kgo`); `public` tables
   are out of scope and are never read or written." It is true today and cheap to assert; if it
   ever stops being true, a spec that stated it will catch the regression, and `npm run
   db:check` already enforces it mechanically.
2. **Declare the wire protocol exclusively.** `/api/v1`, camelCase, bearer tokens, server-sole
   authority over correctness/coins/mastery (`api.md:3`, `:70`). Then one explicit
   non-compatibility note, which is all `offline-contract.md:20` ever warranted: any `/v1/*`,
   snake_case or client-coin-event protocol is a different protocol and no client migration
   path is defined or supported. Ruling it out in one sentence costs nothing and stops the next
   reader re-running this investigation.
3. **Name the real second writer, which is not the Express app.** `ml/.env` defines its own
   `DATABASE_URL` **and `DATABASE_SCHEMA`**. The ML service is a second process configured
   against the same database and plausibly the same `kgo` schema. That is a live, verifiable
   multi-writer situation, and it is the one the spec should actually account for —
   `backend/docs/ml-contract.md` is the place its boundary should be pinned down. The one
   non-schema-scoped resource to note alongside it is the database-wide advisory lock at
   `migrate.ts:34`.

*(Inference)* The most likely history is that `offline-contract.md:20` and `database.md:3` were
written defensively, when the author was working against a shared Aiven instance that another
project of theirs had already populated — the `testBackend` / `auth-rest-api-manipulation` repos
show the pattern of several small servers on one Aiven account, though both of those use MySQL
and neither is the app described. **That is inference. The verifiable fact is that the Express
app appears nowhere in this repository, its history, or any sibling repository, and the `kgo`
isolation that would contain it is real.**

### Recommended follow-up

Two cheap actions that would close the remaining gaps:

- Ask the repo author directly what the Express app was and whether it still has rows in
  `public` on the shared instance. One sentence from them beats any further code archaeology —
  this is the only way to close the §Gaps item that source cannot.
- Then either amend `offline-contract.md:20` and `database.md:3` to say what the other backend
  was and where it lives, or delete both sentences. As written they create exactly the live
  hazard this investigation was commissioned to rule out, and they cost a reader a full day to
  discharge.

---

*Notes compiled by reading this repository's git history, source, SQL and CI configuration, and
by querying the `vannynotfound` GitHub account with `gh`. No database or server was contacted;
no `.env` values were read. All line numbers are as of `f4ab753` on `feat/online-mode`.*
