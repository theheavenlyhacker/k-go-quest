# K-Go Quests

An offline learning app for Philippine public-school learners. It runs on a shared
Android tablet and adapts practice to each learner. Learners never need a network,
and neither does Setup: a tablet delivered to a school with no signal can be set
up and used in full. Going online adds things; it is never the way in.

## Language

### People and devices

**Learner**:
A child who practises on the tablet.
_Avoid_: student, user, account — **except** as the name of a Role. The server
calls that same child a Student, and so does the sign-in screen, because that is
the word a Role is written with in the API and on the chip a person taps.

**Caretaker**:
The adult who manages a Shared Tablet. Only the Caretaker can create or delete Profiles, reset a Learner's PIN and see Plateau Flags for every Profile. The Caretaker may sign in to a Caretaker Account at Setup, and then uses a Caretaker PIN offline. The same person often also holds a Server Account with the Teacher Role, but the two are different things: one owns the tablet, the other says which school it reports to.
_Avoid_: teacher, admin, parent — **except** as Role names, which belong to a Server Account and not to this word.

**Caretaker Account**:
The identity that answers *who owns this Shared Tablet*. It is reached by an email code or by Google, and it is what makes a forgotten Caretaker PIN recoverable — which is the only thing it is for. Both ways need the tablet to be online, so Setup can be finished without one; a tablet with no Caretaker Account simply cannot recover a forgotten PIN. Only the Caretaker Account that did Setup can reset the Caretaker PIN. Learners never have one. It is not the Server Account.
_Avoid_: login, user account

**Server Account**:
The identity that answers *which school and jurisdiction this Shared Tablet reports to*. It carries a Role, and signing in to it is what opens Online Mode. A Shared Tablet works for its whole life without one.
_Avoid_: login, server login, cloud account

**Role**:
What a Server Account is allowed to do: **Student**, **Teacher** or **Admin**. The three are named on the sign-in screen and are `STUDENT`, `TEACHER` and `LGU_ADMIN` in the API. A Role is a property of a Server Account and of nothing else — a Profile has none, and neither does a Caretaker Account. The sign-in screen asks which Role is expected before the password is typed; the server decides what the account actually is, and says so when the two disagree.
_Avoid_: permission, access level, account type

**Classroom**:
A group of Learners on the server, taught by one Teacher. A Classroom exists only on the server; a Shared Tablet has no Classroom of its own.
_Avoid_: class, section, group

**Welcome**:
What the app shows the very first time it is opened, before Setup: the splash, three Onboarding steps and the sign-in. It is shown once per Shared Tablet and can always be walked past.
_Avoid_: intro, tour, landing

**Onboarding**:
The three screens inside Welcome that say what the app is for. They explain, they ask for nothing, and skipping them costs nothing. The word names these screens only; the act of preparing a tablet is **Setup**.
_Avoid_: tutorial, walkthrough

**Setup**:
Preparing a Shared Tablet for use, after Welcome. The Caretaker may sign in to a Caretaker Account, then sets the Caretaker PIN and creates the first Profiles. Only the last two are required: Setup finishes with no network at all.
_Avoid_: registration

**Profile**:
One Learner's identity and progress on one Shared Tablet, protected by a PIN. It is shown by an alias the Caretaker picks, never a legal name.
_Avoid_: account, login

**Shared Tablet**:
One device used in turn by several Learners, each through their own Profile. A Learner always uses the same Shared Tablet.
_Avoid_: device, phone

### Content

**Pack Author**:
The person who writes Content Packs, outside the app.
_Avoid_: admin, teacher, content manager

**Content Pack**:
A bundle of Lessons for one Subject, with each Skill's parameters.
_Avoid_: course, module, download

**Starter Pack**:
A Content Pack that ships inside the app, so the app works on first launch.

**Downloaded Pack**:
A Content Pack a Caretaker has taken from the server onto one Shared Tablet, where it sits beside the Starter Pack rather than replacing it. Its Grading Mode is always On Sync, because the server sends it without its answer key. A Shared Tablet works for its whole life with none.
_Avoid_: installed pack, imported pack, cached pack

**Pack Line**:
Every version of one Content Pack. A Pack Line is one Subject, one grade and one title together; the server gives each published version its own identity, so a new version continues a Pack Line instead of changing a Content Pack in place. Downloading a newer version supersedes the older one on the same Pack Line, so a Learner is never left two copies.
_Avoid_: pack family, pack series, channel

**Grading Mode**:
How a Content Pack's Exercises are graded, chosen by the Pack Author. **On Device** ships the answer key inside the Pack, so the tablet grades instantly. **On Sync** withholds the key, so the tablet records the Attempt unmarked and the server grades it on upload. The Starter Pack is always On Device. A Shared Tablet knows the Grading Mode per **Lesson**, from whether the answer key arrived with it, so a Pack whose Lessons disagree is partly On Sync rather than one or the other.
_Avoid_: grading policy, server grading, offline grading

**Subject**:
One school subject, such as Math or Science. Each Content Pack covers one Subject.

**Skill**:
One competency that has its own Mastery.
_Avoid_: topic, competency code

**Lesson**:
A short reading on one Skill, followed by Exercises.

**Exercise**:
One multiple-choice question with exactly one correct option.
_Avoid_: item, question, quiz

**Hint**:
A fixed explanation written by the Pack Author, in one or more languages. The app reads a Hint aloud only when the tablet has a voice for that language. A Hint is never generated at practice time.
_Avoid_: tutor, AI tutor

### Practice

**Attempt**:
A Learner's answer to one Exercise. The tablet grades it at once when the Content Pack's Grading Mode is On Device. Under On Sync the tablet records it unmarked and says so, and the server grades it on upload.
_Avoid_: submission, sync event

**Unmarked Attempt**:
An Attempt nobody has said is right or wrong yet, because no answer key for its Exercise is on the Shared Tablet. A Learner sees that their answer was saved and is waiting to be marked, never a verdict the tablet is in no position to give. It moves no Mastery and earns no Coins, and it is distinct from an Exercise a Learner has not opened.
_Avoid_: pending, provisional, ungraded

**Counted Attempt**:
The first Attempt a Learner makes at an Exercise. Only Counted Attempts move Mastery and earn Coins; later Attempts are practice only. An unmarked Attempt counts once the server has graded it, never before.
_Avoid_: retry, score

**Quiz**:
A Teacher-built set of Exercises for one Classroom, taken on paper. Its Skills are picked for the Classroom's weakest (lowest mean Mastery, not Mastered) unless the Teacher chooses them. It is saved as a draft, editable until published, then immutable. Selection is deterministic from the item bank, never AI-written. Taking a Quiz is never a Counted Attempt.
_Avoid_: test, assessment, generated quiz

**Quiz Paper**:
A single printable bubble sheet for one Learner for a published Quiz, headed with the Learner's alias (never a legal name). It carries large A–D answer bubbles in a fixed grid, four solid corner fiducial marks, and a QR code encoding the Quiz id and Paper id.
_Avoid_: test paper, exam sheet, answer sheet, scantron

**Paper Result**:
The Teacher's confirmed marking of one Quiz Paper: one A–D answer or blank per item, scored by the server against the Quiz answer key. A rescan replaces that Paper's result. It is never an Attempt, moves no Mastery and earns no Coins. The camera reads the QR code, then one still is read on the tablet to pre-fill the A–D answers; items that are blank-ambiguous or double-filled are left blank and highlighted. The photo is discarded after reading and nothing saves without Confirm.
_Avoid_: Counted Attempt, bubble recognition

### Learning model

**Mastery**:
The estimated probability that a Learner knows a Skill, updated after each Counted Attempt.
_Avoid_: score, level, progress

**Mastered**:
A Skill whose Mastery is at least 0.95.
_Avoid_: complete, passed, done

**Skill Parameters**:
The four numbers (prior, learn, guess, slip) that control how Mastery moves for one Skill. They are fitted offline and shipped in a Content Pack.
_Avoid_: model, weights

**Default Skill Parameters**:
Placeholder Skill Parameters used for every Skill until fitted values exist. They are a starting guess, not a measurement.
_Avoid_: dummy data, real model

**Quest**:
A practice suggestion: one Exercise the Learner has not answered yet, taken from the lowest-Mastery Skill that is not Mastered.
_Avoid_: task, assignment

**Plateau Flag**:
A mark on a Skill where a Learner has made at least five Counted Attempts and Mastery is still below 0.40. The Learner sees it as a nudge to review; the Caretaker sees it for every Profile.
_Avoid_: alert, failing, at-risk

### Motivation

**Coin**:
A point earned for a correct Counted Attempt. A Coin has no value outside the app and buys only Cosmetics.
_Avoid_: Khan-Coin, money, reward

**Cosmetic**:
A badge built into the app that a Learner buys with Coins. A Cosmetic never changes what or how a Learner practises.

**Growth**:
Two counts for one month: the Learner's Skills whose Mastery went up, and the Skills that became Mastered. Each count is shown next to last month's. Growth compares a Learner only with their own past, never with other Learners, and it is never negative.
_Avoid_: rank, leaderboard, score

**League**:
A ranking of Classrooms against one another by how much their Learners' Mastery improved over a month, never by totals. A League is what a Classroom sees about itself, and it exists only when a Shared Tablet has reached the server. Growth remains the only thing a Learner sees about their own progress.
_Avoid_: leaderboard, standings, ranking of Learners

### Going online

**Online Mode**:
What the app can do while the Shared Tablet has a connection. It is always extra: nothing a Learner does requires it, and every part of it is lost cleanly when the connection goes.
_Avoid_: sync mode, cloud mode, online version

**Linked Profile**:
A Profile the Caretaker has tied to a Learner account on the server, so its Counted Attempts can be uploaded. A Profile that is not linked works exactly as any other and uploads nothing.
_Avoid_: registered profile, synced account, enrolled profile

**Device Check-in**:
A report sent to the server whenever a tablet's Caretaker signs in or a Linked Profile syncs, carrying `{deviceId, appVersion, packVersions, storageUsedPercent, pendingAttempts}`. It is best effort and never blocks sign-in or sync. The server uses it to track Shared Tablets and derive their Online, Needs update, or Offline status for the LGU Admin.
_Avoid_: heartbeat, ping, telemetry

## Relationships

- A **Shared Tablet** holds one or more **Profiles**, managed by one **Caretaker**
- A **Caretaker** may have one **Caretaker Account**; a tablet set up with no network has none, and cannot recover a forgotten Caretaker PIN until one is linked
- A **Server Account** has exactly one **Role**; a **Profile** and a **Caretaker Account** have none
- A **Profile** belongs to exactly one **Learner**, and a **Learner** has exactly one **Profile**
- A **Content Pack** covers one **Subject** and contains many **Lessons**
- A **Lesson** practises one **Skill**, contains many **Exercises** and has one **Hint**
- A **Skill** belongs to exactly one **Content Pack** and has one set of **Skill Parameters**
- A **Profile** has one **Mastery** value for each **Skill** it has practised
- A **Quest** points to one **Exercise**
- A **Plateau Flag** belongs to one **Profile** and one **Skill**
- A **Profile** earns **Coins** and owns the **Cosmetics** it bought
- In **Online Mode** a Shared Tablet holds one **Server Account** session, whose **Role** decides which screens open
- A **Content Pack** has one **Grading Mode**, which decides whether the tablet or the server grades its **Attempts**
- A **Content Pack** is one version on one **Pack Line**; a **Shared Tablet** holds at most one version of a **Pack Line** as a **Downloaded Pack**
- A **Linked Profile** is tied to one **Server Account** with the Student **Role**, and belongs to one **Classroom**
- A published **Quiz** issues one **Quiz Paper** per active Learner in the **Classroom**, plus an answer key for the **Teacher**
- A **League** ranks **Classrooms**; **Growth** describes one **Learner**
- A **Shared Tablet** reports to the server through **Device Check-in** whenever its **Caretaker** signs in or a **Linked Profile** syncs

## Flagged ambiguities

- "AI" meant both the Mastery estimate and a conversational tutor. Resolved: the only on-device model is Mastery, and nothing is generated at practice time. The screen shows the **Hints** written by the Pack Author and reads them aloud. *Still open*: that screen is labelled "Tutor" in the app, a word this glossary avoids.
- "Student" and "learner" were used interchangeably. First resolved as: **Learner**, everywhere. **Narrowed.** A child on the tablet is a **Learner** and nothing else. **Student** survives as the name of a **Role** on a **Server Account**, which is what the API returns and what the sign-in screen must therefore say. The two words now name the same child seen from two sides: the tablet's and the server's.
- "Reward" meant both Coins and vouchers for real goods. Resolved: only **Coins** exist, and they buy **Cosmetics**. Vouchers are gone.
- "League" meant ranking classrooms against each other. First resolved as: replaced by **Growth**. **Reversed.** The original reason was that without a server there is nobody to rank against, which holds only offline. Both terms now stand and do not overlap: **Growth** is what a Learner sees about themselves, a **League** is what a Classroom sees about itself, and a Learner never sees their position in one.
- *Still open*: the app also shows a month ranking of the **Profiles on one Shared Tablet** against each other, podium and all. That ranks Learners, which is the thing the first League resolution existed to remove. It needs a decision: either that view is **Growth** per Profile with no ranking, or **League** is accepted as something a Learner may see on their own tablet.
- "Teacher" and "admin" meant separate accounts. First resolved as: one **Caretaker** per **Shared Tablet**. **Reversed.** The original reason was that a tablet needs exactly one adult, which is still true — but the server has always carried three **Roles**, and the sign-in screen now names them. A **Caretaker** manages the tablet; a **Teacher** or an **Admin** is what a **Server Account** may be. One person is usually both.
- "Dummy data for the AI" resolved to **Default Skill Parameters** plus demo Lessons in the **Starter Pack**.
- "Provisional" correctness and Coins: resolved, then narrowed by **Grading Mode**. Under On Device — the Starter Pack, and so every tablet that has never downloaded anything — every **Attempt** is graded at once and nothing is provisional. Under On Sync the tablet holds no answer key, so an Attempt waits unmarked rather than being shown a verdict the tablet cannot give; it moves no **Mastery** and earns no **Coins** until the server grades it.
- "Quest" was first written here as pointing to a Skill; the code makes it one Exercise. Resolved: one **Exercise**.
- **Hint**: the spec wanted one Hint per Exercise; the code holds one Hint per Lesson. Resolved: one Hint per **Lesson**.
- "Khan-on-the-Go" and "Khan-Coin" suggested a link with Khan Academy. Resolved: the app is **K-Go Quests**, and its points are **Coins**.
- "Authentication" could mean Learners or the Caretaker signing in online. First resolved as: only the **Caretaker** signs in; Learners use Profile PINs and never go online. **Narrowed.** Learners still never have a **Caretaker Account**, and a Profile is still opened by its PIN alone. But a Learner with a **Server Account** can sign in once, at **Welcome**, to make their Profile a **Linked Profile** — the sign-in is what ties the two together, and practice afterwards needs no network and no session.
- How a Caretaker recovers a forgotten Caretaker PIN. Resolved: by signing in again to the same **Caretaker Account**.
