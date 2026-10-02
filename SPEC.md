# K-Go Quests — Requirements Specification

Derived from the K-Go Quests concept (Khan-on-the-Go: Quest Edition). Every
feature the concept commits to appears here as a numbered requirement with
acceptance criteria and an honest status. Where the concept describes something
that cannot be built at useful quality by this project, the requirement says so
and proposes the version that *can* be built, rather than quietly substituting a
weaker feature under the same name.

**Status legend**

| Mark | Meaning |
| --- | --- |
| **DONE** | Implemented, tested, and exercised against a real database or device |
| **PARTIAL** | Implemented in a reduced form; the gap is stated |
| **PLANNED** | Not implemented; ordinary engineering, no research risk |
| **BLOCKED** | Not implementable until a listed prerequisite exists |
| **REDUCED** | The concept's version is out of reach; an achievable version is specified |
| **OUT** | Deliberately out of scope for this repository |

---

## 1. Scope

**In scope.** The learner tablet shell, the teacher and LGU-admin tooling, the
API and database behind them, offline sync, the rewards and league mechanics, and
the mastery model that drives growth ranking.

**Out of scope.** Khan Academy content ingestion (requires their permission), MDM
enrolment and device provisioning (belongs to the OEM/DepEd channel), the
physical voucher supply chain, and the funding workflows themselves.

**How to read a requirement.** Each has an ID, a statement, acceptance criteria
that can be checked, and a status. IDs are stable; cite them in issues and in the
traceability matrix in §8.

---

## 2. Operating constraints

These bind every requirement and are not negotiable per feature.

| ID | Constraint | Consequence |
| --- | --- | --- |
| C-1 | Offline-first | A learner must complete a full practice session with the radio off. No feature may require connectivity on the learner path. |
| C-2 | Own models only | No hosted third-party inference at practice time. Models are trained here and shipped as weights or parameters. |
| C-3 | Data Privacy Act of 2012, no PII | Anonymised IDs only. No names, faces, GPS, guardian contacts. No raw audio or photographs leave the device. |
| C-4 | Supplementary, not evaluative | No model output may be the sole basis for a grade, placement or intervention. |
| C-5 | Shared, low-end tablets | Multiple learners per device. Inference ≤300 ms; model payload ≤50 MB per content pack. |
| C-6 | Human in the loop | Every generated artefact — quiz, flag, hint — is reviewable and overridable by a teacher before it affects a learner. |
| C-7 | Low-bandwidth sync | Sync must complete over a congested community-hub connection. Batches are bounded and resumable. |

---

## 3. Roles

| Role | May do |
| --- | --- |
| **STUDENT** | Own progress, quests, vouchers; own-jurisdiction content and rewards; aggregate class leagues only |
| **TEACHER** | Assigned classrooms and learners, own school, teacher-only quiz keys, content, aggregate leagues |
| **LGU_ADMIN** | Own-jurisdiction schools, accounts, classrooms, content, rewards, claims, impact reports, audit trail |

There is no public registration endpoint that accepts a role. LGU admins
provision accounts inside their own jurisdiction. Identity and role come from the
database on every request, never from the client. **DONE**

---

## 4. Functional requirements

### 4.1 Offline and multi-subject infrastructure (OF)

**OF-1 — Multi-subject local caching. DONE**
Core modules across Mathematics, Science, English and Filipino (Panitikan,
Balarila) are cached on device storage for uninterrupted use without cellular
data.
*Accepts:* a downloaded pack renders every lesson, exercise and hint with the
device in airplane mode; subject taxonomy covers all four subjects.

**OF-2 — Immutable, versioned content packs. DONE**
Packs carry a version and a checksum. A published pack cannot be edited; changes
require a new version.
*Accepts:* an attempt to modify a published pack is rejected; a client can detect
a stale cache from the version alone.

**OF-3 — Student packs omit answer keys. DONE**
*Accepts:* the student download payload contains no `correctOption` field;
grading mode is `SERVER_ON_SYNC`.
*Consequence:* offline correctness feedback is impossible by design. The UI must
label coins and correctness as provisional until sync. See SG-11.

**OF-4 — Encrypted local storage. DONE**
Exercise completions, reading logs and progress are encrypted at rest on the
device.
*Accepts:* AES-256-GCM; key is 32 random bytes in the platform keystore; each
record is bound to its owner and cache key through the AEAD additional data, so a
row cannot be lifted into another profile on a shared tablet. An unreadable row
degrades to "nothing cached" and never blocks sign-in.

**OF-5 — Zero-data smart sync. DONE**
An automated, low-bandwidth batch sync runs whenever the device reaches school
Wi-Fi or a community node.
*Accepts:* up to 100 events per batch; each event is `(clientAttemptId,
classroomId, exerciseId, selectedOption, ISO timestamp)`; the client retains
events until acknowledged.

**OF-6 — Idempotent sync. DONE**
*Accepts:* a repeated `(studentId, clientAttemptId)` with an identical payload is
acknowledged without a second reward; a changed payload under the same ID returns
409; a new ID for an already-attempted exercise earns nothing further.

**OF-7 — Atomic sync. DONE**
*Accepts:* wallet, mastery, growth and audit updates commit together; one invalid
event rolls back the whole batch; a PostgreSQL row lock per learner serialises
concurrent uploads and reward spending.

**OF-8 — Bounded clock trust. DONE**
*Accepts:* events are accepted up to 30 days old and 5 minutes ahead; server
receipt time — not the client clock — selects the Asia/Manila league month.

**OF-9 — Partner tablet integration via an MDM/OEM shell. OUT**
The app is built to be pre-installed by an OEM or MDM channel, but no enrolment,
remote command, kiosk lock or device registry is implemented. The admin Device
Management screen says this on its face rather than showing an empty list.
*Prerequisite:* a `devices` table and an MDM vendor contract.

---

### 4.2 Gamified community ecosystem (GM)

**GM-1 — Growth-delta leaderboards. DONE**
Classrooms rank on Individual Mastery Delta, not accumulated points, so a school
starting lower can still win.
*Accepts:* skill deltas average per learner, then across enrolled learners; the
baseline is the first prior estimate seen during monthly server sync.

**GM-2 — Zero-practice fairness rule. DONE**
*Accepts:* a learner with no practice counts as **zero movement, not missing**.
Otherwise a class improves its rank by having its weakest learners stop
practising. This is the single most important line in the league implementation.

**GM-3 — Monthly barangay and division leagues. PARTIAL**
Monthly ranking and growth snapshots exist. The barangay/division hierarchy is
modelled only as LGU jurisdiction plus school; there is no barangay entity and no
cross-division bracket.

**GM-4 — Khan-Coin wallet and daily subject quests. DONE**
*Accepts:* coins are awarded server-side on sync, only on a first correct
attempt; the balance returned by sync is authoritative; the client never computes
a balance it trusts.

**GM-5 — Siklab Voucher redemption. PARTIAL**
*Accepts:* stock-checked issuance, wallet debit and claim workflow are
implemented, with a QR voucher code on the device. Issuance and claiming are
**online**, because stock and balance must be checked centrally. Offline
redemption at a hub is not implemented.

**GM-6 — Avatar customisation. PLANNED**
Not implemented. Coins currently buy vouchers only.

**GM-7 — Community Edu-Siklab hubs. OUT**
No hub entity, hub session or hub operator role. The sync design already works
from any network, which is the technical half; the organisational half is a
deployment programme, not code.

**GM-8 — Teacher micro-credentials and grants. OUT**
Accreditation requires a DepEd accrediting process. No credential is issued and
none is claimed in the UI. Class growth is reported; awarding on it is not
automated.

**GM-9 — League integrity. BLOCKED**
Before competitive funding depends on a rank, the league needs cohort-stability
rules, skill-coverage requirements, comparable assessment design and
anti-collusion checks. None exist.
*Accepts:* a documented integrity review plus an audit that can detect a class
gaming the delta. **This requirement is open, and the league should be labelled
exhibition-only until it closes.**

---

### 4.3 AI suite (AI)

Full model-level detail is in [`ml/REQUIREMENTS.md`](ml/REQUIREMENTS.md). This
section is the contract the rest of the platform depends on.

**AI-1 — Growth-delta balancer (concept F4). DONE**
Bayesian Knowledge Tracing, four parameters per skill (prior, learn, guess,
slip), fitted by Expectation-Maximisation over attempt sequences.
*Accepts:*
- Parameter recovery on synthetic cohorts with known ground truth (6 tests).
- Degeneracy clamped: `guess ≤ 0.30`, `slip ≤ 0.10`, and `guess + slip < 1`
  enforced by a database CHECK constraint.
- Minimum data to fit a skill: 25 sequences and 150 observations. Below that the
  skill keeps prototype parameters and says so.
- Every mastery figure records the model version that produced it.
- The Python fitter and the TypeScript scorer are pinned by a golden-value test.
*Known gap:* mastery updates only on the first attempt per exercise.

**AI-2 — Predictive plateau flagging (concept F5). PARTIAL**
*Now:* a deterministic rule — ≥5 distinct exercises and mastery below 0.40 —
surfaced to the assigned teacher. Explainable, no training data needed.
*Next:* forecast whether mastery will still be below threshold in N sessions,
from the trajectory rather than the current value. A learner climbing slowly and
one who has stopped look identical to the current rule.
*Blocked on:* `attempts.durationMs` and hint-open events, neither recorded. See §6.
*Accepts:* the output carries its contributing features, so a teacher sees why. A
bare risk score fails C-4.

**AI-3 — MATATAG workload and test builder (concept F3). PARTIAL**
Three separable pieces:
- *Quiz generation from the item bank* — **DONE.** Selects published exercises by
  competency and grade; returns questions plus a teacher-only key; prints with a
  QR header.
- *Competency alignment* — **BLOCKED.** Needs a `skills` table and the MATATAG
  competency catalogue, neither of which exists. Intended approach: sentence
  embeddings over the catalogue and lesson text, nearest neighbour with a
  confidence threshold, below which it routes to a human reviewer. This is
  assistive labelling, not autonomous classification.
- *QR camera auto-grading* — **PLANNED, and mostly not ML.** Decoding the QR
  header is a solved library problem; reading ticked bubbles is classical
  computer vision. Treat as engineering, not research.

**AI-4 — On-device voice tutor in local languages (concept F1). REDUCED**
*Concept:* localised voice hints in Tagalog, Cebuano and Ilocano, tuned to level.
*What is honest:* delivery is solved — `expo-speech` does on-device TTS including
`fil-PH`, and the Tutor screen uses it today. **Content is the hard part, and
training a language model from scratch that explains fractions correctly in
Cebuano is not achievable by this project.** It needs pretraining compute and a
corpus that does not exist for these languages at this scale.
*Achievable version, which keeps C-1 and C-2 intact:* author the explanations
teacher-side and online, review them, and ship them inside the content pack.
Offline, the learner gets a correct explanation for the item they just missed, in
their language, with no model on the device. Levelling comes from the mastery
estimate selecting among two or three pre-authored depths per item.
*Accepts:* explanations are versioned content, teacher-reviewed before
publication, and carry the same attribution as the item.

**AI-5 — Multi-subject OCR and explanation evaluator (concept F2). REDUCED**
Three sub-features with three different verdicts:

| Sub-feature | Verdict |
| --- | --- |
| Handwritten digits and fraction notation | **PLANNED, buildable from scratch.** Small CNN, 1–3 MB, MNIST-style data plus a locally collected set of Filipino learners' handwriting. Narrow output space makes it tractable. |
| Handwritten or typed essay-outline structure | **REDUCED.** Structural checks — has a thesis line, has N distinct supporting points — are feasible with shallow NLP. Judging *quality* is not. Ship the structural feedback and label it as structural. |
| Spoken or typed explanation comprehension | **REDUCED.** Semantic understanding of free text in four languages is not buildable from scratch here. The honest substitute is coverage of teacher-authored key concepts per lesson — checkable, explainable, useful. It is coverage, not comprehension, and the UI must say so. |

*Hard requirement:* raw audio and photographs never leave the device and are
deleted after evaluation. Only the derived score syncs (C-3).
*Hard requirement:* bonus coins from any of these are capped and flagged for
teacher review. A model a learner can game will be gamed.
*Current state:* the Tutor screen ships the voice and retrieval modes and shows
an honest empty state for handwriting. The concept-retelling card awards nothing,
because no scorer exists yet — it does not pretend to score.

**AI-6 — Content moderation (concept §4, unlisted in the AI suite). BLOCKED**
The concept commits to automated keyword filters on forums, peer-mentoring and
guild channels. That is an NLP requirement with a child-safety obligation, and it
is unimplemented.
*Minimum:* multilingual blocklist with normalisation (leetspeak, spacing,
diacritics) across Tagalog, Cebuano, Ilocano and English, plus contact-detail
patterns (phone numbers, social handles) to block unauthorised contact.
*Escalation:* anything flagged goes to an adult moderator; nothing auto-publishes
to minors without passing the filter.
**Gate: if forums ship before this does, the safeguard claim in the concept is
not true. Either build it or cut forums from scope.** Forums are currently not
built, which is the correct ordering.

**AI-7 — Model governance. DONE**
*Accepts:* every model output records its producing version; a fitted model is
re-derivable from immutable `attempts` plus a version tag; exactly one model
version is active at a time (enforced by a partial unique index); the importer
refuses degenerate parameters and refuses synthetic parameters unless explicitly
allowed.

---

### 4.4 Safeguards and participant protection (SG)

**SG-1 — Anonymised profiles. DONE** No legal full names, faces, GPS or guardian
numbers are collected. Admin lists show pseudonymous aliases.

**SG-2 — Data minimisation in reports. DONE** Individual learning reports reach
only the learner and their assigned teacher. LGU impact reports are aggregate.

**SG-3 — No invented metrics. DONE** Reports do not fabricate costs, hours saved,
accreditation or measured learning outcomes.

**SG-4 — Device encryption at rest. DONE** See OF-4.

**SG-5 — Per-profile PIN on shared tablets. DONE** Six digits. The verifier is
peppered with a device-bound keystore secret, so a copied database cannot be used
to brute-force PINs offline.

**SG-6 — Auto-logout on inactivity. DONE** The session locks on inactivity and
re-entry requires the PIN.

**SG-7 — Session binding. DONE** One active online session per account. A login
elsewhere revokes older sessions. *Honest limit:* revocation cannot erase an
offline cache already on a device.

**SG-8 — Abnormal login flagging. PARTIAL** Five failed passwords lock an account
for 15 minutes and the event is audited. Login responses do not disclose whether
an account exists. There is no behavioural anomaly detection, and **the lockout
counter does not decay and has no admin reset endpoint** — an open defect.

**SG-9 — Transport and application hardening. DONE** Verified database TLS,
Helmet, explicit CORS origins, global and per-endpoint rate limits, strict nested
DTO validation rejecting unknown fields, a 256 KiB body cap, parameterised
queries, safe errors, request IDs, no-store responses. HTTP logs omit bodies,
headers, query strings and credentials.

**SG-10 — Audited mutations. DONE** Every mutation writes an audit event; the
admin audit trail is the only device-side activity view that exists.

**SG-11 — Supplementary AI only. DONE as a design rule.** No model output is the
sole basis for a grade, placement or intervention. Offline feedback is labelled
provisional until the server grades it.

**SG-12 — Child protection in community features. BLOCKED on AI-6.** Forums,
peer mentoring and guilds are not built. They must not ship before the moderation
filter and an adult moderator workflow exist.

**SG-13 — Deployment obligations not met by code. OPEN** A privacy impact
assessment, retention and deletion policy, DPO sign-off, least-privilege database
users for runtime versus migrations, a shared rate limiter for multi-instance
deployment, backups, load testing, credential rotation and an independent security
review all remain deployment work. The engineering measures here are taken to
meet the DPA 2012; they are not a compliance certification.

---

### 4.5 Sustainability and business model (SU)

**SU-1 — B2B/B2G deployment channels. OUT** Partnership and distribution work,
not software. The MDM shell requirement it implies is OF-9.

**SU-2 — SK, CSR and SEF funding. OUT** No funding workflow is implemented.

**SU-3 — LGU impact reporting. PARTIAL** Aggregate jurisdiction reports exist and
are generated from real practice data. They deliberately report only what is
measured — practice volume, mastery movement, participation — and invent no
savings, costs or outcomes (SG-3). Anything a budget renewal actually needs
beyond that is unbuilt.

**SU-4 — Cost of operation. OPEN** Not specified. A deployment needs sizing for
the sync load of N tablets per school and the storage cost of immutable attempts.

---

## 5. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | On-device inference ≤300 ms. BKT is microseconds; any CNN must be measured on target hardware, not assumed. |
| NFR-2 | Model payload ≤50 MB per content pack — packs download over hub Wi-Fi. |
| NFR-3 | A full practice session completes offline with no degraded behaviour other than provisional grading. |
| NFR-4 | Sync is resumable and bounded: ≤100 events per batch, client retains until acknowledged, an invalid batch can be split by the client. |
| NFR-5 | Access tokens expire in 15 minutes; refresh tokens within 7 days, hashed at rest, device-bound, rotated, with old tokens rejected. |
| NFR-6 | Models run sandboxed: no network, no filesystem access beyond their own cache. |
| NFR-7 | Reproducibility: any fitted model is re-derivable from immutable `attempts` plus its version tag. |
| NFR-8 | Explainability: any output shown to a teacher carries its reason. A score without a reason cannot be acted on and invites over-trust. |
| NFR-9 | The tablet UI is usable one-handed on a low-end 7–10" device at 1× and 1.3× font scale. |
| NFR-10 | Zero type errors and zero lint errors across all three projects as a merge gate. |

---

## 6. Data the models need and the schema does not record

Every signal below is **unrecoverable retroactively**. Each day the app runs
without them is training data permanently lost. This is the highest-leverage item
in the whole specification and it is cheap.

| Signal | Needed by | Status |
| --- | --- | --- |
| `attempts.durationMs` | AI-2 plateau prediction, gaming detection | **missing** |
| Hint-opened events | AI-2, AI-4 levelling | **missing** |
| `skills` table + MATATAG competency catalogue | AI-3 alignment, AI-4 levelling | **missing** |
| `skill_prerequisites` graph | a real recommender, AI-2 root-cause | **missing** |
| Per-item difficulty | adaptive selection beyond weakest-first | **missing** |
| Teacher overrides of model output | training signal for every supervised model | **missing** |
| `attempts.correct`, ordered, per skill | AI-1 BKT | present, in use |
| `model_versions`, `skill_model_params` | reproducibility, auditability | present |

Teacher overrides deserve emphasis: they are the only labelled data this system
will ever generate for free. Record them from the first day the teacher app
ships, or every supervised model starts from zero.

---

## 7. Non-goals and limits stated plainly

Claims a technical judge will test, and the answer that survives the question:

1. **No conversational AI tutor.** Not attempted. Needs pretraining scale this
   project does not have.
2. **No free-text comprehension scoring.** Concept coverage against
   teacher-authored key concepts is what ships, and the UI calls it coverage.
3. **No essay quality grading.** Structural feedback only.
4. **No offline grading.** The tablet has no answer key by design (OF-3), so
   correctness and coins are provisional until sync. This is a privacy and
   anti-cheating decision, not a missing feature.
5. **No Khan Academy content in this repository.** The platform is designed to
   carry it; shipping it needs permission.
6. **No MATATAG catalogue data.** DepEd's; not bundled.
7. **BKT is not proof of learning impact.** It is a four-parameter model fitted to
   right/wrong sequences. Held-out predictive evaluation against a per-skill base
   rate is the next honest step, and it needs real data.
8. **The league is exhibition-grade until GM-9 closes.**
9. **Pseudonymous is not anonymous.** IDs, aliases and progress are pseudonymous
   records. That is not a guarantee of irreversible anonymisation.

---

## 8. Traceability

| Requirement | Implemented in |
| --- | --- |
| OF-1, OF-2, OF-3 | `backend/src/modules/content/`, `mobile/src/app/pack.tsx` |
| OF-4 | `mobile/src/data/crypto.ts`, `mobile/src/data/repository.ts` |
| OF-5 – OF-8 | `backend/src/modules/learning/learning.service.ts`, `mobile/src/state/app-context.tsx` |
| GM-1, GM-2, GM-3 | `backend/src/modules/reports/`, `mobile/src/app/(student)/league.tsx`, `(teacher)/grow.tsx` |
| GM-4, GM-5 | `backend/src/modules/rewards/`, `mobile/src/app/(student)/rewards.tsx`, `voucher.tsx` |
| AI-1 | `ml/kgo_bkt/`, `backend/src/modules/learning/mastery.ts`, `ml/tests/test_recovery.py` |
| AI-2 | `backend/src/modules/reports/`, `mobile/src/app/(teacher)/alerts.tsx` |
| AI-3 | `backend/src/modules/quizzes/`, `mobile/src/app/(teacher)/quiz.tsx` |
| AI-4, AI-5 | `mobile/src/app/(student)/tutor.tsx` |
| AI-7 | `backend/src/database/import-model.ts`, `backend/src/database/migrations/` |
| SG-1 – SG-3 | `backend/src/common/`, `backend/src/modules/reports/` |
| SG-5 – SG-7 | `mobile/src/state/app-context.tsx`, `mobile/src/app/lock.tsx`, `backend/src/modules/auth/` |
| SG-8 – SG-10 | `backend/src/modules/auth/`, `backend/src/common/`, `mobile/src/app/(admin)/devices.tsx` |
| SU-3 | `backend/src/modules/reports/`, `mobile/src/app/(admin)/impact.tsx` |

---

## 9. Known defects

Open, reproducible, and worth fixing before a demo:

1. **Mastery updates only on the first attempt per exercise.** Deliberate
   anti-farming behaviour, but it means repeated practice does not move the
   estimate — a hole in the core learning loop.
2. **Lockout never decays and has no reset endpoint.** A learner locked out stays
   locked for the full window with no admin escape hatch.
3. **`GET /content/packs` hard-filters `published: true`,** so an LGU admin cannot
   list their own drafts through that route.
4. **`GET /users` omits `loginId`,** so an admin cannot see the login they just
   provisioned.
5. **Module correct/wrong rendering is unreachable** while packs omit
   `correctOption` (OF-3). The code paths exist and are dead.

---

## 10. Build order

Ordered by what unblocks the most and what is cheapest to lose:

1. **Record the missing signals** (§6). Cheap, blocks everything downstream,
   unrecoverable if delayed.
2. **`skills` table and the MATATAG competency catalogue.** Unblocks AI-3
   alignment and any real recommender.
3. **Close the §9 defects.** Small, visible, and all five are demo-facing.
4. **AI-6 moderation filter**, before any community feature ships. Safety, not
   features.
5. **AI-2 predictive flagging**, once `durationMs` has accumulated.
6. **AI-5 digit and fraction OCR.** The highest-visibility genuinely
   from-scratch model, and strong demonstration material.
7. **AI-4 authored explanations.** A content pipeline, not a model — which is
   exactly why it is achievable.
