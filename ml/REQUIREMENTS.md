# K-Go Quests — ML requirements

Derived from the K-Go Quests concept. Every feature in the concept's AI suite is
listed, turned into something buildable and testable, and marked with an honest
feasibility rating. Where a feature as written is not achievable from scratch at
useful quality, the gap is stated and a version that *is* achievable is proposed
rather than quietly substituted.

## 0. Constraints that bind every model

These come from the concept and are not negotiable per feature.

| constraint | consequence for the models |
|---|---|
| Offline-first | Inference runs on the tablet with the radio off. No hosted inference on the learner path. Training happens on a server; only weights and parameters ship. |
| Own models, no third-party inference | Rules out calling a hosted LLM at practice time. Shapes which features are realistic — see §3. |
| DPA 2012, no PII | Training data is anonymised IDs, skill codes and right/wrong. No names, no faces, no location, no raw audio leaving the device. |
| Supplementary, not evaluative | No model output may be the sole basis for a grade, a placement or an intervention. Every flag goes to a teacher who decides. |
| Shared tablets, low-end hardware | Model size and latency budget are hard limits: a learner must not wait. Budget ≤50 MB per model, ≤300 ms inference. |
| Human-in-the-loop | Every generated artefact (quiz, flag, hint) is reviewable and overridable by a teacher before it affects a learner. |

## 1. Feature-by-feature requirements

### F4 — Growth-Delta Leaderboard Balancer **[BUILT]**

Rank classrooms by improvement, not by raw score, so advanced classes cannot
dominate.

- **Input** — per-learner, per-skill mastery estimates over a month.
- **Output** — classroom ranking by mean mastery change per enrolled learner.
- **Model** — Bayesian Knowledge Tracing. Four parameters per skill (prior,
  learn, guess, slip) fitted by Expectation-Maximisation from attempt sequences.
- **Status** — fitter, validation and service are built in this repo; scoring
  runs in the backend; `growth_snapshots` and `/reports/league` are live.
- **Fairness requirement** — a learner with no practice counts as zero movement,
  not as missing. Otherwise a class improves its ranking by having weak learners
  stop practising. Already implemented this way; keep it.
- **Evaluation** — parameter recovery on synthetic cohorts (in `tests/`), plus,
  once real data exists, held-out prediction: does `predict_correct` beat a
  per-skill base rate on unseen attempts?

### F5 — Predictive analytics and plateau flagging **[PARTLY BUILT]**

Flag learners plateauing in a subject, early enough for a teacher to act.

- **Now (rule-based, shipped)** — flag when a skill has ≥5 attempts and mastery
  below 0.40. Deterministic, explainable, already surfaced in the teacher app.
- **Next (predictive)** — forecast whether mastery will still be below threshold
  in N sessions, from the trajectory rather than the current value. A learner
  climbing slowly is not the same as one who has stopped, and the current rule
  cannot tell them apart.
- **Model** — logistic regression or gradient-boosted trees over features from
  the attempt sequence: slope of the last k mastery values, attempt spacing,
  correct-streak length, hint usage, time-on-task.
- **Blocked on data** — spacing and time-on-task need `durationMs` and hint
  events, neither of which the schema records. See §2.
- **Requirement** — output a probability *with* the contributing features, so a
  teacher sees *why*. A bare risk score fails the supplementary-not-evaluative
  constraint.
- **Evaluation** — precision at the top decile on held-out learners. Recall
  matters less than not wasting teacher attention.

### F3 — MATATAG workload and test builder **[PARTLY BUILT]**

Align modules to DepEd MATATAG competencies, generate printable quizzes, grade
them from a photo.

Three separable pieces with very different difficulty:

1. **Quiz generation from an item bank** — *built*. Selects published exercises
   by competency and grade, returns questions plus answer key.
2. **Competency alignment** — *not built, buildable*. Map each lesson to a
   MATATAG competency code. Approach: sentence embeddings over the competency
   catalogue and lesson text, nearest-neighbour with a confidence threshold;
   below threshold it goes to a human reviewer. **This is assistive labelling,
   not autonomous classification** — the concept's own screens show a "needs a
   reviewer" state, which is the correct design.
   - Blocked on: there is no `skills` table and no competency catalogue in the
     database. Both are prerequisites.
3. **QR camera auto-grading** — *not built, and mostly not ML*. Decoding a QR
   header is a solved library problem. Reading ticked bubbles is classical
   computer vision (perspective correction, thresholding), not a learned model.
   Treat it as CV engineering, not research.

### F1 — On-device voice tutor in local languages **[NOT BUILT — see §3]**

Localised voice hints in Tagalog, Cebuano and Ilocano, tuned to the learner's
level.

Split this into two problems that get confused:

- **Delivery (solved today)** — `expo-speech` already does text-to-speech,
  including `fil-PH`. The app calls it on the Module screen. No model needed.
- **Content (the hard part)** — producing an explanation that is correct, at the
  right level, in the right language.

**Training a language model from scratch that explains fractions correctly in
Cebuano is not achievable in this project.** It needs pretraining compute and a
corpus that does not exist for these languages at this scale. Claiming otherwise
would not survive a technical question.

**The achievable version, which keeps the offline guarantee:** generate the
explanations at *authoring* time, teacher-side and online, review them, and ship
them inside the content pack. The learner offline gets a correct explanation for
the item they just got wrong, in their language, with no signal and no model on
the device. Levelling comes from the mastery estimate selecting among two or
three pre-authored depths per item.

- **Requirement** — explanations are content, versioned with the pack, reviewable
  by a teacher before publication, and carry the same attribution as the item.
- **Schema** — extend `lessons.hints` (already multilingual jsonb) to per-exercise
  explanations keyed by language and depth.

### F2 — Multi-subject OCR and explanation evaluator **[PARTLY BUILT — see §3]**

Evaluate handwritten math steps, essay outlines, and spoken or typed
explanations, offline, with bonus coins for accurate concept retelling.

Three sub-features, three different verdicts:

| sub-feature | verdict |
|---|---|
| Handwritten **digits and fraction notation** | **BUILT.** `kgo_ink/`: a 27,000-parameter CNN trained from scratch in NumPy on MNIST plus a drawn fraction bar. 0.983 held-out accuracy overall, 0.947 on the bar. Runs on the tablet as plain arithmetic — no native module, no server. Still has never seen a Filipino learner's handwriting; collecting that is the next step, not a rewrite. |
| Handwritten/typed **essay outline structure** | **Partly buildable.** Structural checks — has a thesis line, has N supporting points, points are distinct — are feasible with shallow NLP. Judging *quality* is not. Ship the structural feedback, say so plainly. |
| **Spoken or typed explanation** comprehension scoring | **Not buildable from scratch.** Requires semantic understanding of free text in four languages. The honest substitute is keyword/concept coverage against teacher-authored key concepts per lesson — checkable, explainable, and genuinely useful, but it is coverage, not comprehension. Label it as such in the UI. |

- **Hard requirement** — raw audio and photographs never leave the device, and
  are deleted after evaluation. Only the derived score syncs. This is a DPA 2012
  obligation and a child-protection one.
- **Hard requirement** — bonus coins awarded by any of these are capped and
  flagged for teacher review, because a model a learner can game is a model that
  will be gamed.

### F6 — Content moderation for forums and peer channels **[NOT BUILT — REQUIRED]**

Not listed in the concept's AI suite, but §4 commits to "automated keyword
filters" on community forums, peer-mentoring and guild interactions. That is an
ML/NLP requirement with a child-safety obligation attached, and it is currently
unimplemented and unscheduled.

- **Minimum** — multilingual blocklist with normalisation (leetspeak, spacing,
  diacritics) covering Tagalog, Cebuano, Ilocano and English, plus contact-detail
  patterns (phone numbers, social handles) to stop unauthorised contact.
- **Escalation** — anything flagged goes to an adult moderator; nothing is
  auto-published to minors without passing the filter.
- **Note** — if forums ship before this does, the safeguard claim in the concept
  is not true. Either build it or cut the forums from scope.

## 2. Data the models need and the schema does not record

Every one of these is unrecoverable retroactively. Each day the app runs without
them is training data permanently lost.

| signal | needed by | status |
|---|---|---|
| `attempts.durationMs` | F5 plateau prediction, gaming detection | **missing** |
| Hint-opened events | F5, F1 levelling | **missing** |
| `skills` table + MATATAG competency catalogue | F3 alignment, F1 levelling | **missing** |
| `skill_prerequisites` graph | a real recommender, F5 root-cause | **missing** |
| Per-item difficulty | adaptive selection beyond weakest-first | **missing** |
| Teacher overrides of model output | training signal for every supervised model | **missing** |
| `attempts.correct`, ordered, per skill | F4 BKT | present and in use |
| `model_versions`, `skill_model_params` | reproducibility, auditability | present |

Teacher overrides deserve emphasis: they are the only labelled data this system
will ever generate for free. Record them from the first day the teacher app
ships, or every supervised model starts from nothing.

## 3. Feasibility summary

| tier | features | assessment |
|---|---|---|
| **Built** | F4 Growth-Delta, F5 rule-based flagging, F3 quiz generation, F2 digit/fraction OCR | Working, tested, live |
| **Buildable, no research risk** | F3 competency alignment, F3 QR grading, F5 predictive flagging, F6 moderation filter | Ordinary engineering plus data collection |
| **Achievable in a reduced, honest form** | F1 voice tutor (pre-authored explanations), F2 outline structure, F2 explanation coverage | Delivers the user-facing value without claiming capability the model lacks |
| **Not achievable from scratch here** | Conversational tutor, free-text comprehension scoring, essay quality grading | Needs pretraining scale that this project does not have |

## 4. Non-functional requirements

- **Latency** — ≤300 ms on-device inference. BKT is microseconds; a CNN on a
  low-end tablet must be measured, not assumed.
- **Size** — ≤50 MB total model payload per content pack, since packs download
  over community-hub Wi-Fi.
- **Sandboxing** — models run with no network and no filesystem access beyond
  their own cache, per the concept's responsible-AI guardrail.
- **Versioning** — every model output records the model version that produced
  it. Already implemented for BKT; required for all others.
- **Reproducibility** — any fitted model can be re-derived from `attempts` plus
  a version tag. Keep attempts immutable.
- **Explainability** — any output shown to a teacher carries its reason. A score
  without a reason cannot be acted on and invites over-trust.

## 5. Suggested build order

1. **Add the missing signals** (§2). Cheap, blocks everything, unrecoverable.
2. **`skills` table and competency catalogue.** Unblocks F3 alignment and a real
   recommender.
3. **F6 moderation filter**, before any forum ships. Safety, not features.
4. **F5 predictive flagging**, once `durationMs` has accumulated.
5. ~~**F2 digit/fraction OCR.**~~ Done. What remains is collecting real
   learners' handwriting: the model has only ever seen MNIST, and a few hundred
   labelled samples from one classroom would tell us how far that carries.
6. **F1 authored explanations.** Content pipeline, not a model.
