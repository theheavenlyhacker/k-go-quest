# K-Go Quests

Offline learning for Philippine public-school tablets. A Learner practises Math,
Science, English and Filipino with no signal. Every answer is graded the moment
it is given, and the app adapts the next Quests using **Bayesian Knowledge
Tracing (BKT)** with Default Skill Parameters, running on the tablet. No Learner
data leaves the tablet: only the Caretaker's email address goes online, once, to
sign in at Setup. Terms are defined in [`CONTEXT.md`](CONTEXT.md).

The only AI is BKT: plain arithmetic, no neural model, no server. Mastery is an
estimate, never a grade.

| Folder | What it is | Stack |
| --- | --- | --- |
| [`mobile/`](mobile) | The tablet app | Expo SDK 57, expo-router, React Native |
| [`ml/`](ml) | Offline BKT fitter and tests | Python 3.11, NumPy |

## Run it

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
