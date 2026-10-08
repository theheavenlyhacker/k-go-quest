# API route map

Base path: `/api/v1`. Protected requests use `Authorization: Bearer <accessToken>`. IDs are UUIDs; answer indexes start at zero. Pagination uses `?page=1&limit=20`, maximum 100. Successful POSTs return 201, GET/PATCH return 200. Errors contain statusCode, message, requestId and timestamp.

| Method and path                              | Access                                        |
| -------------------------------------------- | --------------------------------------------- |
| GET health/live, health/ready                | Public                                        |
| POST auth/login, auth/refresh                | Public, tightly rate limited                  |
| GET auth/me; POST auth/logout, auth/password | Authenticated                                 |
| GET/POST users; PATCH users/:id              | Own LGU admin                                 |
| POST users/:id/password                     | Own LGU admin; revokes sessions               |
| GET schools                                  | Teacher's school or LGU's schools             |
| POST schools                                 | LGU admin                                     |
| GET classrooms                               | Own enrollments, assignments, or LGU schools  |
| POST classrooms                              | LGU admin                                     |
| POST classrooms/:id/enrollments              | Assigned teacher or own LGU                   |
| DELETE classrooms/:id/enrollments/:studentId | Assigned teacher or own LGU; keeps history    |
| GET classrooms/:id/learners                  | Assigned teacher or own LGU                   |
| GET content/packs                            | Own jurisdiction; optional grade and subject  |
| GET content/packs?status=draft                | Own LGU admin only                            |
| GET content/packs/:id                         | Own LGU admin; includes private answer keys   |
| GET content/packs/:id/download               | Published own-jurisdiction pack               |
| POST content/packs                           | LGU admin                                     |
| POST content/packs/:id/lessons               | Own LGU admin, draft only                     |
| POST content/lessons/:id/exercises           | Own LGU admin, draft only                     |
| POST content/packs/:id/publish               | Own LGU admin; lessons and exercises required |
| POST learning/sync                           | Student, own account                          |
| GET learning/progress/me, learning/quests    | Student                                       |
| GET learning/learners/:id/progress           | Assigned teacher                              |
| GET models/active                            | Any signed-in role                            |
| POST quizzes                                 | Assigned teacher; saves a draft, weakest Skills first when none named |
| GET quizzes?classroomId=                     | Assigned teacher                              |
| GET quizzes/skills?classroomId=&subject=     | Assigned teacher; Skills by mean Mastery, weakest suggested |
| GET quizzes/:id                              | Assigned teacher; includes private answer key |
| PATCH quizzes/:id                            | Assigned teacher; draft only (title, exerciseIds, replaceExerciseId) |
| POST quizzes/:id/publish                     | Assigned teacher; a published Quiz is immutable |
| POST quizzes/:id/results                     | Assigned teacher; replaces a Paper Result, grades server-side |
| GET quizzes/:id/results                      | Assigned teacher; Learner scores and item difficulty |
| POST quizzes/:id/papers                      | Assigned teacher; issues paper ids for active Learners (idempotent) |
| GET rewards                                  | Own jurisdiction                              |
| POST rewards                                 | LGU admin                                     |
| PATCH rewards/:id                            | Own LGU admin; cost, stock, title, active      |
| GET rewards?status=all                       | Own LGU admin; includes disabled items        |
| POST rewards/redemptions                     | Student                                       |
| GET rewards/redemptions/me                   | Student                                       |
| POST rewards/redemptions/:id/claim           | Own LGU admin                                 |
| GET reports/classrooms/:id                   | Assigned teacher                              |
| GET reports/classrooms/:id/suggestions       | Assigned teacher; practice groups from ML service with fallback |

| GET reports/impact                           | Own LGU admin; optional quarter YYYY-Qn       |
| GET reports/engagement                       | Own LGU admin; optional days (default 7)      |
| GET reports/audit                            | Own LGU admin                                 |
| GET reports/league                           | Own LGU aggregates; optional month YYYY-MM    |
| POST devices/check-in                        | Authenticated                                 |
| GET devices                                  | Own LGU admin                                 |


## Login

```json
{
  "loginId": "student-demo",
  "password": "<your DEMO_PASSWORD>",
  "deviceId": "expo-device-unique-id"
}
```

Save tokens in Expo secure storage, not ordinary persisted state. Refresh requires refreshToken and the same deviceId. Do not submit a role during login.

## Offline sync

```json
{
  "attempts": [
    {
      "clientAttemptId": "<new UUID per attempt>",
      "classroomId": "<enrolled classroom UUID>",
      "exerciseId": "<downloaded exercise UUID>",
      "selectedOption": 0,
      "occurredAt": "2026-10-01T01:00:00.000Z"
    }
  ]
}
```

Use the actual event timestamp. Keep each event until its clientAttemptId is acknowledged. If a response is lost, resend the identical event. Do not send correctness, coins, mastery, role or studentId; those values come from the server.

The response has `results` with clientAttemptId, correct, awardedCoins, and duplicate; top-level awardedCoins is the amount newly earned by this batch, and coinBalance is the authoritative wallet. A duplicate result can contain its original awardedCoins; do not add that amount to the wallet again. See `offline-contract.md` for retry and cache handling.

## Classroom report

`GET reports/classrooms/:id` returns `{ classroomId, learners, decisionPolicy }`. Each learner has:

- `skills`: one row per Skill with `mastery`, `attempts`, `correctAttempts`.
- `subjects`: `[{ subject, mastery }]`, the mean Mastery of that Subject's Skills.
- `streak`: consecutive Manila days, ending today (or yesterday, which keeps it alive until today ends), with a Counted Attempt. A repeat of an Exercise is practice only and does not extend it.
- `lastPracticeAt`: when the Learner last answered anything (`occurredAt`), or `null`. `lastSyncAt` is when the server last received an Attempt.
- `connectivityStatus`, `learningStatus`, `reason`: the rule-based signals behind Teacher Alerts.

The tablet's contract test (`mobile/src/domain/recorded/classroom-report.json`) parses a recorded response; change the shape and re-record it.

## Suggested practice groups

`GET reports/classrooms/:id/suggestions` returns `{ classroomId, method, groups, decisionPolicy }`. Groups are suggested practice clusters for the Teacher:

- `method`: `"model"` when computed via the model service's `/recommend` endpoint (configured via `ML_SERVICE_URL` and `ML_SERVICE_TOKEN`), or `"fallback"` when the model service is unreachable (grouping by lowest non-Mastered Skill, `< 0.95`).
- `groups`: array of practice groups, sorted by learner count descending:
  - `skillCode`: the Skill where learners gain most.
  - `skillTitle`: human-readable title of the Skill.
  - `subject`: curriculum Subject.
  - `learners`: `[{ id, alias }]`, aliases only.
  - `count`: number of learners in this group.
- `decisionPolicy`: `"Suggested practice groups; teacher decides next action"`.

## LGU reports

`GET reports/impact?quarter=YYYY-Qn` returns jurisdiction metrics for the requested Manila quarter (defaults to current quarter):
- `learnersReached`: distinct Learners with at least one Attempt in the quarter.
- `lessonsCompleted`: total completed Lessons in the quarter (a Lesson where every Exercise was attempted by a Learner).
- `offlineUsageShare`: share of Attempts in the quarter whose `occurredAt` was earlier than `receivedAt` by more than an hour (0.0 to 1.0).
- `reachByBarangay`: `[{ barangay, learners, lessons, offlineLessons }]` ordered by Learners reached descending.
- `disclaimer`: keeps existing disclaimer field.

`GET reports/engagement?days=7` returns `[{ date, activeLearners }]` for the specified number of Manila days (1 to 30, defaults to 7), oldest first ending on Manila today.

## Administration

Reset a password with `POST users/:id/password` and `{ "newPassword": "<12–128 character password>" }`. The affected user must sign in again. Deactivation uses `PATCH users/:id` with `{ "active": false }`.

Remove membership with `DELETE classrooms/:id/enrollments/:studentId`, which returns 200 and an inactive membership. Restore it with the existing enrollment POST. Historical attempts remain stored.

Manage a reward with `PATCH rewards/:id`, supplying any of title, cost, stock, and active. Stock is the absolute available quantity. Disabling an item blocks new redemption; existing vouchers retain their original cost and can still be claimed.

Draft authoring: create pack, add lessons, add exercises, inspect the admin-only detail, then publish. A pack must have lessons and an exercise in every lesson. Published content stays immutable; create a new version for changes. Learner downloads always omit answer keys.

## Redemption

```json
{ "requestId": "<new UUID per redemption>", "rewardId": "<reward UUID>" }
```

Retain requestId on retries. Retrieve issued vouchers at rewards/redemptions/me. The redemption ID identifies the claim record; LGU authorization and database status determine whether it is claimable. A QR token has a separate audience from access tokens. Offline voucher claiming is deferred.

## Active model parameters

`GET models/active` returns the currently active fitted BKT parameters:

```json
{
  "version": "bkt-em-20261007",
  "source": "postgres",
  "method": "Expectation-Maximisation (Baum-Welch) on a constrained two-state BKT HMM",
  "fittedAt": "2026-10-07T12:00:00.000Z",
  "parameters": {
    "math5.fractions.add": {
      "prior": 0.197444,
      "learn": 0.100313,
      "guess": 0.201734,
      "slip": 0.081312
    }
  }
}
```

If no fitted model has been activated, returns 404.

## Quiz papers

`POST quizzes/:id/papers` issues paper IDs for all active Learners in the Classroom for a published Quiz (idempotent per Quiz). Returns `[{ id, quizId, studentId, alias }]`. The `id` (paper id) is encoded alongside `quizId` into the Quiz Paper QR code for scanning without exposing student identity or answer keys.
## Device check-in

Whenever a tablet's Caretaker signs in or a Linked Profile syncs, the tablet reports its status to `POST devices/check-in`:

```json
{
  "deviceId": "<random-uuid-generated-by-tablet>",
  "appVersion": "1.0.0",
  "packVersions": [
    {
      "packId": "math5",
      "version": "1.0.0",
      "subject": "MATH",
      "grade": 5,
      "title": "Fractions & Decimals"
    }
  ],
  "storageUsedPercent": 42,
  "pendingAttempts": 0
}
```

The server scopes the device by the signing-in account's school and jurisdiction, updating `lastSeenAt`. Check-in failure is best-effort and never blocks sign-in or sync.

`GET devices` lists the Shared Tablets in the LGU Admin's jurisdiction with server-derived status:
- **Online**: seen in the last 15 minutes with up-to-date app and Content Packs.
- **Needs update**: seen in the last 15 minutes, but app or a held Content Pack is behind the latest published version in the jurisdiction.
- **Offline**: not seen in the last 15 minutes.

### Paper Results

`POST quizzes/:id/results` accepts `{ paperId, answers }` for a published Quiz.
Paper Quizzes select only Exercises with 2–4 options; drafts with items beyond
A–D must replace them before publishing. Legacy published Quizzes with more than
four options show a plain unsupported state and cannot save Paper Results.
`answers` follows the Quiz's item order with exactly one integer option index
(0–3, within that item's options) or `null` for an unanswered item. The Paper
must have been issued for this Quiz, and the Teacher must teach its Classroom.
The server grades against the published answer key and returns
`{ paperId, studentId, score, total, correctness }`. Blank answers are incorrect.
Saving the same Paper again replaces its marking atomically; it never adds an
Attempt, changes Mastery or awards Coins.

`GET quizzes/:id/results` returns `{ quizId, title, total, submittedCount,
classAverage, learners, items }`. `classAverage` is percent correct (0–100)
among submitted Papers, or `null` before any submission. `learners` contains
`{ paperId, studentId, alias, answers, score, gradedAt }`; `items` contains
`{ exerciseId, correctCount, submittedCount, difficulty }`, in Quiz item order.
`difficulty` is the fraction incorrect or blank (0–1), or `null` before any
submission. Quiz list summaries also return `submittedCount` and `classAverage`.
Paper Results are Teacher-only, including the Learner Insights detail.

The mobile scanner uses Expo Camera's QR callback only. It identifies an issued
Paper and its server-provided alias, refuses a different Quiz, and lets the
Teacher enter A–D answers or blanks before confirming. No photos are taken or
stored and no automatic bubble recognition runs.
