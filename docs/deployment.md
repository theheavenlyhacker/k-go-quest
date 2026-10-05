# Deploying K-Go Quests

A runbook for putting this in front of real learners, and an honest account of
what is not ready yet. Read §2 before anything else.

## 1. What you are actually deploying

Three things, and only the first two are needed:

| Part | Where it runs | Needed? |
|---|---|---|
| **The tablets** | Android tablets in a classroom | Always. This is the product. |
| **The backend** | One container, one PostgreSQL database | Only for Online Mode: uploads, league, teacher and admin screens, vouchers |
| **The model service** (`ml/service`) | A container, occasionally | No — see §6.4. Training is offline and the tablet runs its own models. |

A tablet with the app installed and no server is a complete product: practice,
grading, Mastery, Coins, Cosmetics and Growth all work. Everything in §4 is for
what the server adds.

## 2. Stop — what is not ready

None of these stop a demo. All of them would hurt in a classroom.

**Blocking for real learners**

1. ~~**A locked-out learner stays locked out.**~~ Fixed. Five wrong PINs still
   cost a five-minute wait, but the Caretaker screen now shows how long is left
   and has a **Let back in** button that clears it without changing the PIN the
   child already knows. The count was already resetting once a wait expired.
2. **No privacy impact assessment.** This processes minors' learning data in the
   Philippines. The engineering is built for the Data Privacy Act — anonymised
   IDs, no faces, no GPS, encryption at rest — but engineering is not compliance.
   See §7.
3. **The League is exhibition-grade.** There are no cohort-stability rules, no
   skill-coverage requirement and no anti-collusion checks. Do not let funding
   or a prize depend on a rank until `SPEC.md` GM-9 is closed.
4. ~~**`feat/online-mode` is not merged.**~~ Merged. Everything in §4 is on
   `main`.

**Known defects worth fixing first**

5. ~~`GET /users` omits `loginId`.~~ Fixed — an admin can now read back the login
   they just provisioned, which is the login a Caretaker types to link a Profile.
   It is an identifier, not a credential; the password hash stays unselected.
6. Two identity systems: Clerk for the Caretaker Account at Setup, the backend's
   own accounts for Online Mode. Deliberate and documented in
   `online-mode.md`, but it is two things to operate, two things to pay for and
   two places a sign-in can fail.
7. The handwriting model has never seen a Filipino learner's handwriting. 98.3%
   on held-out MNIST says nothing about a Grade 5 fingertip. Collect a few
   hundred labelled samples from the pilot before trusting it anywhere it counts.

**Untested**

8. ~~**The sync chain has never run over HTTP.**~~ It has now, against a
   disposable PostgreSQL 16. The compiled artefact — `dist/` and a pruned
   `node_modules`, which is exactly what the image carries — ran its
   migrations, first-admin bootstrap and demo seed from `dist/`, and then, over
   real HTTP: all three roles signing in, scoped reports, an upload retried to
   prove it is idempotent, checksum verification, the wallet and voucher path
   and the Teacher quiz. The backend's own 27-test end-to-end suite passed
   against a second disposable database on the same server.

   What has still not been exercised is that chain against **your** database:
   that run had no Aiven in it, no TLS and no real Content Pack. One command
   closes it, from a machine with the toolchain installed natively:

   ```bash
   cd backend && npm run smoke:configured
   ```

   It starts a temporary compiled API against the configured database, checks
   all three demo roles and logs them out. Run it before the pilot.

9. The ink pad has never run on real hardware. It uses the view responder rather
   than a gesture library precisely so it would be boring — but boring is a
   prediction until a finger touches glass.

## 3. Rotate these before you go anywhere near production

The Aiven password and the demo passwords were pasted into a chat and a seed
script. Treat all of them as public:

- Aiven database password (and create new least-privilege users — §4.2)
- `JWT_SECRET` — regenerate: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`
- `BOOTSTRAP_PASSWORD`, `DEMO_PASSWORD`
- The Clerk instance: a development instance is not a production one

Nothing secret belongs in the app. `EXPO_PUBLIC_*` values are compiled into the
APK and can be read out of it by anyone — the API address lives there, and that
is fine. The Clerk **publishable** key is fine. The Clerk secret key must never
be in the repo or the app.

## 4. The backend

### 4.1 The database

Aiven's free tier is a development convenience: it sleeps, it has no useful
backup window, and its connection limit is small. For production use a paid
plan or any managed PostgreSQL 17 in or near the Philippines, and turn on:

- daily backups with point-in-time recovery
- TLS required (the app refuses to start without it in production)
- a retention policy that matches what §7 says you promised

Keep `DATABASE_SCHEMA=kgo`. It isolates this app from anything else in the
database and the readiness check depends on it.

### 4.2 Two database users, not one

The admin credential is for setup only. Create:

- a **migration** user that may create and alter tables
- a **runtime** user that may only read and write rows in `kgo`

The runtime container gets the second one. This is the difference between a
compromised API leaking rows and a compromised API dropping the schema.

### 4.3 Configuration

The app validates its environment at boot and refuses to start if production is
misconfigured. In production it requires:

- `NODE_ENV=production`
- `DATABASE_SSL=true` and the database CA — either `DATABASE_CA_PATH` pointing at
  a file, or `DATABASE_CA` holding the PEM itself for a platform that only gives
  you environment variables (§4.8)
- `SWAGGER_ENABLED=false`
- every entry in `CORS_ORIGINS` an explicit `https://` origin with no path and no `*`
- a `JWT_SECRET` that does not start with `replace-`
- no SSL parameters inside `DATABASE_URL` — `node-postgres` will quietly override
  explicit TLS settings if they are there

Set `TRUST_PROXY_HOPS` only to the number of proxies you actually run in front
of the app. The default of 0 trusts no forwarded headers, which is the safe
answer until you know the topology; setting it wrong lets a client spoof its own
IP and defeat the rate limiter.

### 4.4 Run it

```bash
docker build -t kgo-backend backend
docker run -d --name kgo-api -p 3000:3000 \
  --env-file backend/.env \
  -v /etc/kgo/aiven-ca.pem:/app/certs/aiven-ca.pem:ro \
  -e DATABASE_CA_PATH=/app/certs/aiven-ca.pem \
  kgo-backend
```

The image carries no secrets and no certificate; both are mounted at run time.
On a platform with nowhere to mount a file — Railway, Render, Fly — the CA goes
into `DATABASE_CA` instead; see §4.8.
Put it behind a reverse proxy that terminates HTTPS — the app does not do TLS
itself, and the tablets will refuse a plain-HTTP address in a production build.

**One instance, for now.** Rate limits are held in process memory. Two
containers behind a load balancer means each enforces half the limit. Either run
one instance or move rate limiting to the gateway before you scale out.

### 4.5 Bring the schema up

Separate, deliberate, and run as the migration user — not from the container:

```bash
cd backend
npm ci
npm run migration:run     # creates the schema under a deployment lock
npm run db:check          # must print ready: true
npm run db:bootstrap      # the first LGU admin; credentials come from .env
```

Then remove `BOOTSTRAP_PASSWORD` from the environment. Do **not** run
`npm run db:seed` — it creates demo accounts and refuses to run in production
anyway.

### 4.6 Load the content

The tablet identifies Exercises by slug and the server by UUID, and the UUIDs
are derived from the slugs. That is what lets a tablet that has been offline for
a year still upload correctly, and it means re-seeding the server from an empty
database is safe:

```bash
cd backend
npm run pack:import -- --file ../mobile/src/content/starter-pack.json --dry-run
npm run pack:import -- --file ../mobile/src/content/starter-pack.json
```

If you ever change the Starter Pack, run `npm run export:pack` in `mobile/`
first; CI fails if the two drift.

The import is idempotent: run again on an unchanged Pack and it reports
`already imported` and writes nothing, so it is safe in a deployment script. The
demo database already has all four Packs loaded this way — 6 Lessons, 33
Exercises.

Fitted BKT parameters are a separate import and are optional — without them
every Skill uses the Default Skill Parameters, which are a starting guess and
are labelled as such in the app:

```bash
cd ml && python scripts/fit_model.py --database-url "$DATABASE_URL" --schema kgo --out model.json
cd ../backend && npm run model:import -- --file ../ml/model.json --activate
```

The fitter refuses a Skill with fewer than 25 sequences or 150 observations, and
the importer refuses degenerate parameters. Both failures are loud on purpose: a
model fitted on nothing is worse than no model.

### 4.7 Check it is alive

| Endpoint | Means |
|---|---|
| `GET /api/v1/health/live` | the process is listening — use this as the liveness probe |
| `GET /api/v1/health/ready` | **503 until the schema is complete** — use this as the readiness probe |

There is no `GET /api/v1/health`. It answers 404, and a platform health check
pointed at it fails every deploy.

### 4.8 Railway, specifically

Railway builds the Dockerfile, terminates HTTPS for you and hands the process
environment variables — nothing else. It is a reasonable home for this backend.
Seven things differ from §4.4, and the second, third and sixth will bite you.

1. **Set the service root directory to `backend`.** Railway looks for a
   Dockerfile at the repository root; this one lives in `backend/`. Settings →
   Source → Root Directory → `backend`. Do not move the file.
2. **The CA goes in a variable, not a file.** There is nowhere to mount a PEM,
   so paste the Aiven CA into `DATABASE_CA` and leave `DATABASE_CA_PATH` empty.
   Newlines typed into Railway's editor survive; a value with escaped `\n` is
   accepted too. Certificate verification stays on either way — if the handshake
   fails, the CA is wrong, and `DATABASE_SSL=false` is not the fix.
3. **`TRUST_PROXY_HOPS=1`.** Railway's edge forwards every request, so at the
   default of 0 the app sees one client address for the whole country: the rate
   limiter then counts everyone together, and one Learner retrying a PIN can
   lock out a province. Exactly 1 — one proxy, one hop.
4. **Leave `PORT` alone.** Railway injects it and the app reads it. Setting it
   yourself is how you get a deploy that builds and never answers.
5. **Keep replicas at 1.** Rate limits live in process memory (§4.4). Two
   replicas each enforce half the limit.
6. **Point the health check at `/api/v1/health/live`.** Not `/health/ready`:
   the first deploy comes up against a database with no schema, readiness
   answers 503 until migrations run, and Railway would roll the deploy back
   before you got the chance. `live` says only that the process is listening,
   which is all a platform check should ask.
7. **Migrations are yours to run.** Railway has no release phase, so run them
   once the service is up — from your laptop against the same `DATABASE_URL`
   (§4.5), or as a one-off command on the service:

   ```bash
   railway run --service <name> npm run prod:migrate     # node dist/database/migrate.js
   railway run --service <name> npm run prod:check       # must print ready: true
   railway run --service <name> npm run prod:bootstrap   # the first LGU admin
   ```

   Use the `prod:` scripts there, not `npm run migration:run`. That one calls
   `ts-node` over `src/`, and the final image carries only `dist/` and
   `node_modules` — there is no TypeScript left in it to run.

The variables, in full:

```
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:12590/kgo
DATABASE_SSL=true
DATABASE_SCHEMA=kgo
DATABASE_CA=-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
JWT_SECRET=<48+ random characters>
CORS_ORIGINS=https://your-admin-site
TRUST_PROXY_HOPS=1
SWAGGER_ENABLED=false
```

`CORS_ORIGINS` must be explicit `https://` origins — the validator rejects `*`
and refuses to start. The tablets do not use CORS at all, so if there is no web
admin yet, the Railway URL itself is a harmless placeholder.

**There is no config file to commit.** Railway's `railway.json` and
`railway.toml` are deprecated — they keep working until 1 December 2026, but a
service created now cannot use them, so this repository deliberately carries
neither. Set the seven things above in the dashboard. The replacement, if you
would rather keep configuration in the repository, is Infrastructure as Code: a
`.railway/railway.ts` at the repository root. That is more machinery than one
service needs, and it would be the first thing at the root of this repository to
depend on npm.

**What of this has actually been run.** The production artefact — `npm ci`,
`npm run build`, `npm prune --omit=dev`, then `dist/`, `package.json` and
`node_modules` alone, which is exactly what the image's final stage carries —
was booted with `NODE_ENV=production` against PostgreSQL 16 over TLS, with the
CA supplied inline in `DATABASE_CA` with its newlines escaped. Migrations, the
schema check and the first-admin bootstrap all ran from `dist/`.
`health/live` answered 200 throughout; `health/ready` answered 503 before
migrations and 200 after; a deliberately wrong CA was refused with "unable to
verify the first certificate" rather than quietly accepted. `nest build` also
succeeds without `test/` and `docs/`, which `.dockerignore` strips. Not run
here: `docker build` itself, and Railway's own edge.

**The models do not go on Railway.** Neither model is a service: training is a
laptop job that writes BKT parameters into the database and handwriting weights
into the APK, and both run on the tablet afterwards. There is nothing to host —
see §6. `ml/service/` is optional and no part of the product calls it (§6.4); if
you ever do deploy it, keep it off the public internet.

## 5. The tablets

This is the hard part, and the part that has nothing to do with servers.

### 5.1 Expo Go is not production

Everything so far has run inside Expo Go. A classroom needs a standalone
Android build. Nothing in the app needs a custom native module, so this is a
configuration job, not a porting job.

### 5.2 Two decisions you cannot take back

**The Android package name.** `app.json` does not have one yet, and EAS will
refuse to build without it. It is permanent — it is the app's identity on every
tablet and in the Play Store forever. Something like:

```json
"android": { "package": "ph.kgoquests.app", ... }
```

**The signing keystore.** Android will only install an update signed with the
same key as the install. Lose the keystore and you can never update the app on a
tablet again — the only path is uninstall, which takes every Learner's Profile,
Attempt log and Coins with it, because all of it lives on the tablet.

Let EAS generate and hold it (`eas credentials`), then **download a copy and put
it somewhere that is not one laptop**. This is the single most expensive mistake
available in this project.

### 5.3 Build

`eas.json` has three profiles:

```bash
cd mobile
npx eas-cli build --platform android --profile preview      # APK, internal, for testing
npx eas-cli build --platform android --profile production   # APK, for the tablets
npx eas-cli build --platform android --profile play-store   # AAB, only for the Play Store
```

Use the **APK** for DepEd tablets you install by hand or through an MDM. The
**AAB** is only for the Play Store, which this is not going through yet.

**Set `EXPO_PUBLIC_API_URL` for the build.** Without it a release APK stays
offline permanently and says nothing about it: practice, grading, Mastery,
Coins, Cosmetics and Growth all work, but nothing uploads, the League is empty
and no Content Pack can be downloaded. `resolveApiUrl` refuses a plain-HTTP
address outside development and the tablet treats the refusal as "no server",
which is the right behaviour and an easy thing to ship by accident. Set it as
an EAS environment variable on the profile, or in `.env.local` for a local
build. `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is needed the same way for the
Caretaker sign-in; that screen at least says so on itself.

`app.json` carries `android.versionCode: 1`. **Bump it on every build** — a
tablet refuses an update whose versionCode is not higher than the one
installed.

The application id is `ph.kgoquests.app` and the label under the icon is
`K-Go Quests`. **Neither can change after the first install** — a tablet
treats a different package as a different app, with its own data and no upgrade
path. The `slug` stays `k-go-quests-mobile` because that is the EAS project's
own identifier, not anything a Learner sees.

Build the release once and check these by hand, because a release build differs
from Expo Go in ways that only show up at runtime: the ink pad, the voice hints
(`expo-speech` needs a Filipino voice installed on the device), the encrypted
SQLite cache surviving an app restart, and the first launch of Setup.

### 5.4 Getting it onto DepEd tablets

Three routes, in increasing order of how much paperwork they need:

1. **Sideload the APK** — a USB stick and `adb install`, or a file the teacher
   opens. Fine for a pilot of one school. No update path: every new version is a
   manual visit.
2. **MDM** — whatever the division already uses for its tablets pushes the APK
   and updates it. This is what the concept assumes and what makes a hundred
   tablets maintainable. It needs the division's IT, not code.
3. **Play Store** — needed only if tablets are not centrally managed. Adds a
   review process, a privacy policy URL and a data-safety declaration that must
   match §7.

Whichever route, decide **before the pilot** how version two reaches a tablet
that is three provinces away. A product that cannot be updated is a product
whose first bug is permanent.

## 6. The models

Two models, both trained from scratch, both running on the tablet. Neither needs
a server at practice time, which is the whole point. What follows is how each
one gets from `ml/` onto a tablet.

### 6.1 Where the work happens

Training is a laptop job, not a deployment. `ml/` needs Python 3.11 and NumPy
and nothing else:

```bash
cd ml
python -m venv .venv && . .venv/bin/activate      # .venv\Scripts\activate on Windows
pip install -r requirements.txt pytest
python -m pytest -q                                # 18 tests, no dataset needed
```

The tests deliberately need no data: CI has no MNIST and no practice logs, and
the properties worth pinning — that the gradients are right, that normalisation
is what it claims, that BKT recovers known parameters — do not depend on either.

### 6.2 BKT — the mastery estimate

Fitted from real practice logs, so it only improves once learners have used the
app. Until then every Skill runs on Default Skill Parameters, which the app
labels as a starting guess rather than a measurement.

```bash
cd ml
python scripts/fit_model.py --database-url "$DATABASE_URL" --schema kgo --out model.json
cd ../backend && npm run model:import -- --file ../ml/model.json --activate
```

Two refusals are deliberate and should not be worked around: the fitter will not
fit a Skill with fewer than 25 sequences or 150 observations, and the importer
rejects degenerate parameters (`guess + slip >= 1`) and synthetic ones without
`--allow-synthetic`. A model fitted on nothing is worse than no model.

Exactly one model version is active at a time, enforced by a partial unique
index. Every Mastery figure records the version that produced it, so a bad fit
is traceable and reversible: import the previous version and activate it.

**This does not need an app release.** The parameters travel in the Content Pack.

### 6.3 Handwriting — reading what a Learner writes

MNIST is not in the repository. Fetch it once:

```bash
cd ml && mkdir -p data/mnist && cd data/mnist
for f in train-images-idx3-ubyte train-labels-idx1-ubyte t10k-images-idx3-ubyte t10k-labels-idx1-ubyte; do
  curl -LO "https://ossci-datasets.s3.amazonaws.com/mnist/$f.gz"
done
```

Train — about eight minutes on a laptop — and write the weights straight into
the app:

```bash
cd ml
python scripts/train_ink.py --mnist data/mnist --out ../mobile/src/content/handwriting-model.json
python scripts/train_ink.py --export-only --out ../mobile/src/content/handwriting-model.json
```

The second form re-exports from the saved checkpoint without retraining. Both
print per-class held-out accuracy; that number goes into the model file and onto
the screen the Learner sees, so it is never a claim, only a measurement.

**This does need an app release.** The 279 KB of weights ship inside the APK —
verified, not assumed: an Android production export inlines all 26,731 of them
into the JavaScript bundle, and Hermes compiles that bundle to bytecode without
complaint. The fitted BKT parameters in `src/content/fitted-parameters.ts` and
the Starter Pack ride along the same way. Loading the model costs a few
milliseconds at startup, which is why it is a plain import and not a lazy one.
`recognise.test.ts` re-checks the shipped weights against the probabilities
NumPy produced on every push, so a truncated or stale model file fails CI
rather than the classroom.
If retraining becomes frequent — and it should, once real handwriting is being
collected — move the weights into the Content Pack so they download like
content. The model file already carries its own version string for that.

### 6.4 The model service is optional

`ml/service/` is a FastAPI app that exposes prediction and fitting over HTTP.
**Nothing in the product needs it.** The tablet runs its own models and the
backend scores attempts itself; the service exists for dashboards and for
experimenting against real data without a laptop.

Deploy it only if you have a use for it, and if you do:

```bash
docker build -t kgo-ml ml
docker run -d -p 8000:8000 \
  -e KGO_ML_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')" \
  -e DATABASE_URL="$DATABASE_URL" -e DATABASE_SCHEMA=kgo \
  kgo-ml
```

It fails closed: it refuses to start without a `KGO_ML_TOKEN` of at least 24
characters, and every endpoint except `/health` requires it. It deliberately
does not score attempts — that would be a second implementation of the thing the
backend already does — and it never writes to the database, so the importer
stays the single writer. Keep it off the public internet; it has no multi-tenant
isolation and was never meant to face one.

### 6.5 Keeping the two implementations honest

Both models are written twice: once in Python to train, once in TypeScript to
run on the tablet. That is two chances to disagree, so both are pinned:

- **BKT** — a golden-value test ties `ml/kgo_bkt/model.py` to the scorer in the
  app. Change the arithmetic in one and the other fails.
- **Handwriting** — the model file carries three fixed inputs and the
  probabilities NumPy produced for them. The tablet's test suite runs the same
  inputs through its own port and compares.
- **Normalisation** — the half of the handwriting system that is not a model is
  pinned the same way, down to Python's round-half-to-even.

If you change either model, run both test suites. A drift here is silent: the
tablet simply starts reading something different from what was measured.

## 7. Data protection — this is not optional

The app is built to the Data Privacy Act of 2012: anonymised system IDs, no
legal names, no faces, no GPS, no guardian numbers; AES-256-GCM at rest on the
device with the key in the platform keystore; aliases rather than names reaching
the server; aggregate-only LGU reports.

That is the engineering. Deployment still owes:

- a **privacy impact assessment** before the first real learner
- a named **Data Protection Officer** and a registered processing system
- a written **retention and deletion** policy — and a way to honour a deletion
  request, which today means deleting the Profile on the tablet *and* the rows on
  the server
- **guardian consent**, because these are minors
- a privacy notice in language a parent in a barangay can actually read

Pseudonymous is not anonymous. An alias plus a classroom plus a practice history
identifies a child to anyone in that classroom. Treat the database as personal
data, because it is.

## 8. Backups, watching, rolling back

**Backups.** The database is one half. The other half is on the tablets and is
not backed up by anything — a lost tablet is a lost Learner history unless that
Profile was linked and synced. Say this plainly to the school rather than
discovering it after a theft.

**Watch.** `/health/live` for liveness and `/health/ready` for readiness,
database connection count and disk, and
the `audit_events` table, which already records every mutation. Failed-login
patterns are in there too.

**Rolling back.** The backend rolls back by redeploying the previous image —
but **migrations do not roll back cleanly**, so a release that changes the schema
needs a forward fix, not a revert. The tablets have no rollback at all: a new
APK replaces the old one and a tablet cannot go back. Test on real hardware
before shipping, every time.

## 9. Roll out to one school

Not a division. One school, two classrooms, enough tablets for one class to
share.

- **Week 0** — pilot school agrees, guardian consent collected, privacy notice
  posted, one teacher trained as Caretaker.
- **Week 1** — tablets set up offline only. No server, no accounts. Confirm the
  thing works in the room before adding anything that can fail.
- **Week 2** — backend live, Profiles linked, sync running at the school's
  Wi-Fi. Watch what the audit trail says actually happens, versus what you
  expected.
- **Week 3–6** — collect handwriting samples, watch the plateau flags against
  what the teacher already knows about those children. If the flags disagree with
  the teacher, the teacher is probably right and the model needs work.
- **Then** — the league, once GM-9 is closed and more than one school is on it.
  A league of one school is a list.

The order matters: everything that can work offline should be proven offline
first, because when something breaks later that is the layer you will want to
trust.

## 10. Roughly what it costs

Per month, for one division-scale deployment:

| Item | Rough cost |
|---|---|
| Managed PostgreSQL (small, backed up) | $20–50 |
| One API container | $5–20 |
| Domain and TLS | ~$15/year, TLS free |
| Clerk | free tier is likely enough at this size |
| EAS builds | free tier covers a low release cadence |
| Tablets | the real cost, and not yours — OEM, LGU or telco |

The software is cheap. The sustainability question in the concept is about
tablets, connectivity and the people who run the hubs, not hosting.

## 11. When something breaks

| What you see | Where to look |
|---|---|
| API will not start | the environment guard in `backend/src/config/environment.ts` names the exact rule it failed |
| `/health/ready` returns 503 | migrations have not run, or ran against another schema — `npm run db:check` |
| Sync is refused for every Attempt | the Content Pack was never imported on the server (§4.6) |
| One Attempt sits in "not sent" | the Demo Learner's fabricated history is never uploaded, by design; a real one carries the server's reason |
| A Learner cannot get past the PIN screen | a five-minute wait after five wrong PINs; the Caretaker screen can let them straight back in |
| Handwriting reads nonsense | symbols written too close together; the screen shows what the model actually saw |

---

Written against `feat/online-mode`. If the branch has moved, trust the code.
