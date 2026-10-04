# Online mode

How K-Go Quests behaves when the Shared Tablet has a connection, and why the
offline build and the full-stack build can live in one app instead of replacing
each other.

Terms are the ones in [`CONTEXT.md`](../CONTEXT.md). Two are added here:

**Online Mode**:
What the app can do while the Shared Tablet has a connection. It is always extra.
Nothing a Learner does requires it.
_Avoid_: sync mode, cloud mode

**Linked Profile**:
A Profile the Caretaker has tied to a Learner account on the server, so its
Attempts can be uploaded. A Profile that is not linked still works exactly as
before and uploads nothing.
_Avoid_: registered profile, synced account

## The rule everything follows

> Offline is the product. Online is an accelerator.

A tablet that never sees Wi-Fi again must keep working forever: practice,
grading, Mastery, Coins, Cosmetics, Growth. Every online feature below is
something the app gains when a connection appears, and loses cleanly when it
goes away. If a change would make a Learner wait for the network, it is the
wrong change.

## What was in conflict

The offline build and the full-stack build disagreed on three things, and the
disagreements were deliberate on both sides.

| | Offline build (now) | Full-stack build (`v0-fullstack`) |
| --- | --- | --- |
| Who is a Learner | A local Profile: alias + 6-digit PIN, no server identity | A server account with a role and a jurisdiction |
| Who grades an Attempt | The tablet, instantly, from the answer key in the Content Pack | The server, on sync; student packs ship **without** the answer key |
| Where Content Packs come from | Bundled in the app as the Starter Pack | Downloaded from the server, versioned and checksummed |

The second row is the sharp one. "Grade instantly on the tablet" and "the tablet
must never hold the answer key" cannot both be true of the same Content Pack.

## The resolution

### 1. Grading is a property of the Content Pack, not of the app

Each Content Pack declares how its Exercises are graded:

- `ON_DEVICE` — the answer key ships with the Pack. The tablet grades instantly.
  Coins and Mastery move immediately. **The Starter Pack is always this.**
- `ON_SYNC` — the Pack ships without the answer key. The tablet records the
  Attempt and says plainly that it is not graded yet; the server grades it on
  upload and returns the result.

A Pack Author chooses per Pack. A Pack meant for daily practice on a tablet that
may never connect is `ON_DEVICE`. A Pack used for anything that counts — a
graded assessment, a competition round — is `ON_SYNC`, because that is the only
mode where an answer key never sits on a shared tablet.

This replaces "the app is offline-only" and "the app grades on sync" with one
rule that produces both behaviours, and it keeps each one's reason intact.

### 2. Identity stays local; the server link is additive

The Caretaker Account (Clerk, email code at Setup) still owns the tablet, and
Profiles are still local alias + PIN. Online Mode **adds** a second, optional
sign-in: the Caretaker signs in to the K-Go server, which already carries roles
(`STUDENT`, `TEACHER`, `LGU_ADMIN`) and jurisdiction.

That server session is what unlocks everything online:

- downloading Content Packs,
- uploading Attempts for **Linked Profiles only**,
- the Teacher and LGU Admin screens, if the account carries those roles.

A Profile becomes Linked when the Caretaker, while signed in, ties it to a
Learner account the LGU Admin has already provisioned. Nothing is uploaded for
an unlinked Profile — a tablet can run its whole life with none.

Two identities is a cost, and it is taken deliberately: the Caretaker Account
answers *who owns this tablet* and works at Setup with no K-Go server at all,
while the server account answers *which school and jurisdiction this tablet
reports to*. Folding them into one means a tablet cannot be set up until the
server knows about it, which breaks the first rule. **If that cost is not worth
it, the Clerk step is the one to drop** — the backend's own auth can do both —
but that is a deliberate later decision, not a drift.

### 3. The tablet is the first grader; the server is the recorder and the referee

For an `ON_DEVICE` Pack the tablet's grade stands the moment it is given. On
upload the server re-checks it against its own key. Agreement is the normal
case and nothing changes. Disagreement means the tablet is running an old Pack
version, and the server's result wins and is shown as a correction. Mastery and
Coins are recomputed from the corrected Attempt.

This keeps the instant feedback that makes the offline app good, and still gives
the server the last word where it matters.

### 4. Only Counted Attempts and Growth cross the wire

What uploads, per Linked Profile: the Attempt log — Exercise ID, chosen option,
timestamp, client UUID. What comes back: confirmations, the authoritative Coin
balance, and Growth. What never leaves the tablet: PINs, the Caretaker PIN,
alias-to-person mappings, audio, photographs, and anything a Learner typed.

Aliases, not names, reach the server. The Data Privacy Act posture of the
offline build survives unchanged.

## What Online Mode gives back

| Feature | Offline | Online |
| --- | --- | --- |
| Practice, grading, Mastery, Coins, Cosmetics | Full | Full, plus server re-check |
| Growth | This tablet's Profiles | The real Growth-Delta league across tablets, schools and barangays |
| Content Packs | The bundled Starter Pack | Download new Packs and Pack versions |
| Plateau Flags | Caretaker, this tablet | Also the assigned Teacher, for their whole class |
| Teacher screens | — | Class, Learners, Alerts, Quiz Builder, Growth |
| LGU Admin screens | — | Schools, Users, Content, Impact, Audit |
| Rewards | Cosmetics bought with Coins | Also Siklab Vouchers, issued and claimed online against central stock |

The League returns as the thing it was designed to be: ranking by Mastery
improvement across classrooms, not by totals. The on-tablet standings built for
offline stay as the fallback, and become the empty state when the tablet has
never connected.

**This reverses a decision recorded in `CONTEXT.md`** ("League → replaced by
Growth", "the tutor screen becomes Hints"). The offline reasoning was sound —
without a server there is nobody to rank against. With one, both can be true:
Growth is what a Learner sees about themselves, the League is what a classroom
sees about itself. `CONTEXT.md` needs that section rewritten rather than left
contradicting the code.

## Failure behaviour

Each of these is a state the app must show plainly, never a spinner that never
ends:

- **No connection.** Everything offline works. Online features show when they
  last succeeded, not an error.
- **Connection, no server session.** Practice unaffected. Online features
  prompt the Caretaker to sign in, and nothing else changes.
- **Session expired mid-sync.** Attempts stay in the outbox. The app does not
  lock a Learner out of practice to force a sign-in.
- **Server rejects an Attempt.** It moves to a review state with the reason
  attached, and the rest of the batch still uploads.
- **Pack version changed under a Learner.** Already-counted Attempts keep their
  result; the correction path in §3 applies.

## Order of work

1. ~~Restore `backend/` and `ml/service/` from `v0-fullstack`, and the backend CI job.~~ Done.
2. Add `grading` to the Content Pack shape, defaulting to `ON_DEVICE`, so the
   Starter Pack keeps working untouched.
3. Restore `domain/client.ts` and `domain/sync.ts`; add an outbox beside the
   existing Attempt log rather than replacing it.
4. Caretaker server sign-in, and Profile linking.
5. Pack download and version checks.
6. Restore the Teacher and LGU Admin screens, and the server-backed League and
   Vouchers, behind the role the server reports.
7. Rewrite the `CONTEXT.md` section this document contradicts.

Every step from 2 onward must leave the offline path working on its own. The
check for each is the same: put the tablet in airplane mode and run the demo
script in the README from start to finish.
