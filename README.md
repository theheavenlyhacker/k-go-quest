# K-Go Quests

Offline learning for Philippine public-school tablets. A Learner practises Math,
Science, English and Filipino with no signal. Every answer is graded the moment
it is given, and the app adapts the next Quests using **Bayesian Knowledge
Tracing (BKT)** with Default Skill Parameters, running on the tablet. No Learner
data leaves the tablet: only the Caretaker's email address goes online, once, to
sign in at Setup. Terms are defined in [`CONTEXT.md`](CONTEXT.md).

Two models, both trained from scratch and both running on the tablet. **BKT** is
four numbers per Skill and plain arithmetic; Mastery is an estimate, never a
grade. **Handwriting** is a small convolutional network — about 27,000 numbers,
98.3% on held-out digits — that reads what a Learner writes. Neither needs a
server, a native module or a download, and neither grades anything.

| Folder | What it is | Stack |
| --- | --- | --- |
| [`mobile/`](mobile) | The tablet app | Expo SDK 57, expo-router, React Native |
| [`ml/`](ml) | Offline BKT fitter, handwriting model and tests | Python 3.11, NumPy |

Putting this in front of real learners: **[`docs/deployment.md`](docs/deployment.md)** —
what to deploy, in what order, and an honest list of what is not ready yet.

## Run it

Setting up a fresh clone? Run the wizard instead of following the steps by hand:

```bash
bash scripts/setup.sh
```

It walks you through all of it in nine stages — the Clerk publishable key, the
database (hosted Aiven or the local container), the backend secrets, the schema
and the first admin, and the ML service — writing each value to the right
`.env` and confirming before anything irreversible. Re-running it is safe:
every value offers what you already have as the default.

The manual path, if you prefer it:

```bash
cd mobile
cp .env.example .env.local   # set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (publishable key only)
npm install
npx expo start               # press a for an Android device or emulator

npm run typecheck && npm run lint && npm test    # mobile checks
cd ../ml && pip install -r requirements.txt pytest && python -m pytest   # ML checks
```

`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` comes from a Clerk development instance with
email-code sign-in. Never put the Clerk secret key in the app or the repo.

## Demo script (Android, ~5 minutes)

1. **Setup, online.** Launch the app. Tap *Set up this tablet*, enter the
   Caretaker email, tap *Email me a code*, enter the code, tap *Verify code*. Set a
   6-digit Caretaker PIN, add a Profile (alias, 6-digit PIN), then tap *Finish
   setup*. A Demo Learner is created with two months of history.
2. **Airplane mode on.** From here the whole app works with no network.
3. **Profile.** On *Who is learning?* pick the Demo Learner and enter its PIN.
4. **Quests.** On Learn, show the Quests (lowest-Mastery Skill first) and the Subjects.
5. **Lesson.** Open a Quest. Read the Lesson, answer an Exercise: a wrong answer
   shows the correct option, a right one earns 5 Coins. A retry changes neither
   Mastery nor Coins. Open the Hint, switch language (English, Tagalog, Cebuano,
   Ilocano) and tap *Read aloud*. With no installed voice for that language, the
   Hint is shown as text only.
6. **Progress.** Show Mastery estimates, Mastered Skills, Growth (this month next
   to last month) and the Plateau Flag with its nudge.
7. **Shop.** Buy a badge with Coins. A badge you cannot afford is refused.
8. **Caretaker.** Back on the picker tap *Caretaker*, enter the Caretaker PIN. See
   every Profile with its Plateau Flags, open one read-only, add a Profile, reset
   a Learner PIN, delete a Profile (with confirmation), and tap *Reset demo*.
9. **Forgotten Caretaker PIN (network on).** Turn airplane mode off. On the
   Caretaker PIN screen tap *Forgot Caretaker PIN*, sign in with the same email,
   set a new PIN. A different account is refused. Profiles are kept.

## Demo script, online (Teacher and Admin, ~5 minutes)

Needs Docker and Node 24. The `.env` values are throwaway, localhost-only demo
values; nothing here is a secret.

1. **Start the stack.** `cd backend && cp .env.example .env && docker compose up -d --build --wait`
   brings up PostgreSQL, the API (`:3000`) and the model service (`:8000`), all healthy.
2. **Seed the jurisdiction.** `npm ci && npm run db:seed:demo` (from `backend/`) provisions one
   LGU Admin, two schools, three Grade 5 Classrooms with a Teacher each and 30 Learners
   (aliases only) with about two months of synthetic Attempts, and imports the Starter Pack
   so a tablet's Attempts upload. Running it again changes nothing; `-- --reset` rebuilds it.
   The synthetic Attempts carry `source = 'demo'`, so a refit can include or exclude them.
3. **Point the app at it.** In `mobile/.env.local` set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000`
   (Android emulator: `http://10.0.2.2:3000`). The stack binds to `127.0.0.1`; to reach it from
   a tablet, change the `ports:` host addresses in `backend/docker-compose.yml`.
4. **Sign in.** As the Caretaker go online and sign in to the server as `teacher-demo` (Teacher
   screens) or `admin-demo` (Admin screens); the password is `DEMO_PASSWORD` from `.env`.
   `teacher-demo-2` and `teacher-demo-3` own the other two Classrooms.
5. **Link a Profile.** As Caretaker, link a Profile to `learner-01`. Its Starter Pack Attempts
   now upload and are accepted.
6. **Look.** The League ranks three Classrooms with distinct growth; every Classroom has a
   Plateau Flag, a Learner with no recent sync, and one who never synced.

## Roadmap

Not built, in rough order of interest:

- Fitted Skill Parameters and exporting practice data (Default Skill Parameters stay until real data exists).
- Signed Content Packs, Imported Packs, and replaying Mastery when parameters change. (Downloading Content Packs and their updates from a school server is built; see `docs/online-mode.md`.)
- Teacher and admin roles, classroom reports, printable quizzes, school and user management, an impact dashboard and an audit log.
- Classroom leagues and vouchers for real goods.
- Cloud sync or backup, and moving a Profile between tablets.
- Stronger storage and recovery: SQLCipher, a Recovery Code, protection against a wrong tablet clock.
- Neural models: OCR, speech recognition, on-device language models.
- Translated screens (they stay English; only Hints are translated) and theme Cosmetics.
- iOS and Google Play distribution.

## Notes

Hint translations (Tagalog, Cebuano, Ilocano) are demo quality and need native
review before real use. A Learner's progress lives on one tablet; a lost or reset
tablet loses it. The previous full-stack version is tagged `v0-fullstack`.

`mobile/LICENSE` is the MIT license from the `create-expo-app` template and
covers that template, not this project.
