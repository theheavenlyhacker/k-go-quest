# k-go-quests-ml

Fits the Bayesian Knowledge Tracing parameters that K-Go Quests uses to
estimate what a learner knows. Trained from scratch on the platform's own
practice logs — no hosted model, no third-party API.

## Why BKT

Every answer a learner syncs is one bit: right or wrong, on a known skill, in
order. BKT is the model that fits that shape. It treats knowing a skill as a
hidden two-state variable and estimates four numbers per skill:

| parameter | meaning |
|---|---|
| `prior` (L0) | chance the learner already knew the skill before the first item |
| `learn` (T)  | chance an item moves them from not-knowing to knowing |
| `guess` (G)  | chance of a correct answer while still not knowing |
| `slip`  (S)  | chance of a wrong answer while already knowing |

The backend shipped with one hand-picked set of these four numbers shared by
every skill. That is a guess, and it is wrong in different directions for
different skills: fractions and reading inference do not have the same guess
rate when one is multiple-choice arithmetic and the other is comprehension.
This repo replaces the guess with values fitted from data.

## Method

Expectation-Maximisation (Baum-Welch) over a constrained two-state HMM, run
per skill across every learner's sequence for that skill.

- **No forgetting.** The transition matrix is `[[1-T, T], [0, 1]]` — once known,
  stays known within a sequence. This is the standard BKT constraint.
- **Scaled forward-backward**, so long sequences do not underflow.
- **Ten random restarts** per skill, best log-likelihood wins. The likelihood
  surface has local optima; a single start is a coin flip.
- **Degeneracy bounds** after every EM step: `guess ≤ 0.30`, `slip ≤ 0.10`.
  Without these, EM finds "guessing explains everything" solutions where a
  correct answer *lowers* the mastery estimate. Any fit that still ends with
  `guess + slip ≥ 1` is discarded and the skill keeps the shared defaults.
- **Evidence minimums**: 25 learner-sequences and 150 answers per skill. Below
  that the skill is reported as unfitted and scores on defaults. A parameter
  fitted from 30 answers is noise with a decimal point on it.

## Validation

There are no real learners yet, so the fitter is judged by parameter recovery:
simulate sequences from parameters we chose, refit, and check it finds them.

```bash
python3 tests/test_recovery.py
```

Current result — four parameter sets spanning an easy skill, a hard one, a
mostly-known one and a guessable one, all recovered inside tolerance:

```
balanced       truth prior=0.25 learn=0.12 guess=0.18 slip=0.07
               fit   prior=0.242 learn=0.120 guess=0.173 slip=0.065
hard skill     truth prior=0.08 learn=0.05 guess=0.10 slip=0.04
               fit   prior=0.103 learn=0.050 guess=0.105 slip=0.032
```

The suite also pins `update_mastery` to golden values taken from the backend's
`src/modules/learning/mastery.ts`. **If that test fails, the Python and
TypeScript implementations have drifted and fitted parameters no longer mean
the same thing on both sides.** Fix the drift; do not update the constant.

## Running it

```bash
pip install -r requirements.txt

# exercise the whole path with a simulated cohort
python3 scripts/fit_model.py --source synthetic --out model.json

# fit against real practice logs
python3 scripts/fit_model.py --source postgres --out model.json \
    --database-url "postgresql://avnadmin:...@...aivencloud.com:12590/defaultdb?sslmode=require" \
    --schema kgo \
    --version bkt-em-2026Q4
```

`--schema` must match `DATABASE_SCHEMA` in the backend's `.env`. It matters more
than it looks: a stale `attempts` table left behind in `public` resolves through
the default search path and the fitter reads *that* instead, reporting "no
practice data" while a full database sits one schema away. The loader now pins
the schema and fails loudly if the table is not there.

Then, in the backend repo:

```bash
npm run migration:run                              # once, adds the tables
npm run model:import -- ../khan-go-quest-ml/model.json --activate
```

The importer refuses synthetic parameters unless `--allow-synthetic` is passed,
so a simulated fit cannot reach a live jurisdiction by accident. It also
refuses degenerate parameter sets and duplicate versions.

## Handwriting

A second model lives in `kgo_ink/`: a small convolutional network that reads
handwritten digits and the fraction bar, so a learner can write `3/4` on the
tablet instead of tapping an option.

    1x28x28 -> conv 8@3x3 -> ReLU -> pool
            -> conv 16@3x3 -> ReLU -> pool
            -> 784 -> dense 32 -> ReLU -> dense 11 -> softmax

About 27,000 parameters. Forward and backward passes are written out in NumPy
rather than taken from a framework, because the forward pass has to be
reimplemented in TypeScript to run on the tablet, and the only way to be sure
the two agree is for both to be small enough to read in one sitting.

| class | held-out accuracy |
|---|---|
| digits 0-9 | 0.980 - 0.998 |
| fraction bar `/` | 0.947 |
| overall | **0.983** |

The digits come from MNIST. There is no `/` in MNIST, so that class is drawn:
random angle, thickness, bow and position, normalised like every other sample.
It is the weakest class in the model and is labelled as such on the screen that
uses it. Collecting real fraction bars from learners is what would fix it.

Augmentation matters more than the architecture here. MNIST was written with a
mouse at high contrast; a learner draws with a fingertip, thicker and more
slanted. `data.augment` adds rotation, scale, shift and stroke thickening, and
that is the difference between a model that scores well on the test set and one
that works on a tablet.

### Running it

MNIST is not in this repository. Download the four `.gz` files first:

```
mkdir -p data/mnist && cd data/mnist
for f in train-images-idx3-ubyte train-labels-idx1-ubyte t10k-images-idx3-ubyte t10k-labels-idx1-ubyte; do
  curl -LO "https://ossci-datasets.s3.amazonaws.com/mnist/$f.gz"
done
```

Then train, which takes about eight minutes on a laptop and writes the weights
straight into the app:

```
python scripts/train_ink.py --mnist data/mnist --out ../mobile/src/content/handwriting-model.json
python scripts/train_ink.py --export-only --out ../mobile/src/content/handwriting-model.json   # re-export, no retraining
```

The exported file carries the weights, the measured per-class accuracy, and
three fixed inputs with the probabilities NumPy produced for them. The tablet's
test suite runs those same inputs through its own port of the forward pass and
compares — so the two implementations cannot drift apart unnoticed.

### The part that is not a model

`kgo_ink/normalise.py` is half the system. MNIST was built by fitting each digit
into a 20x20 box and centring it in a 28x28 field by its centre of mass. Ink
from a tablet looks nothing like a MNIST digit until the same two steps are
applied, so they are applied identically there and in
`mobile/src/domain/ink.ts`, down to Python's round-half-to-even. One pixel of
disagreement moves the whole symbol.

## What this does not do

The handwriting model reads isolated digits and a fraction bar. It does not
read words, working shown across several lines, or anything photographed —
it reads strokes, not pictures. It has never seen a Filipino learner's
handwriting: every digit it was trained on came from MNIST, and the first
real collection is what would tell us how far that generalises.

- It does not personalise per learner. BKT parameters are per *skill*; the
  per-learner state is the mastery estimate the backend already stores.
- It does not use response time or hint usage, because the schema does not
  record them yet. Both are strong signals and would need a migration first.
- It does not claim measured learning outcomes. These are practice estimates.
  The backend's impact endpoint says so, and so should any report built on it.

## Retraining

Refit when a skill's answer count has roughly doubled, or quarterly, whichever
comes first. Always import with a new `--version`; versions are immutable and
`attempts` is the source of truth, so an old fit can be reproduced exactly.
