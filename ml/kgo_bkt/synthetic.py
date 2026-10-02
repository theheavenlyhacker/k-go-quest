"""Generate practice sequences from known parameters.

This exists so the fitter can be judged before a single Filipino learner has
used the app: simulate from parameters we chose, refit, and check the fitter
recovers them. Nothing here is ever presented as real learner data.
"""

from __future__ import annotations

import numpy as np

from .model import BktParams


def simulate_learner(p: BktParams, n_items: int, rng: np.random.Generator) -> list[int]:
    known = rng.random() < p.prior
    out: list[int] = []
    for _ in range(n_items):
        # The state before the item decides the answer...
        correct = rng.random() < ((1.0 - p.slip) if known else p.guess)
        out.append(int(correct))
        # ...and only then can the item itself teach the skill.
        if not known and rng.random() < p.learn:
            known = True
    return out


def simulate(
    p: BktParams,
    n_learners: int = 400,
    items_per_learner: int = 12,
    jitter: int = 4,
    seed: int = 7,
) -> list[list[int]]:
    """A cohort of sequences with uneven lengths, as real practice is."""
    rng = np.random.default_rng(seed)
    sequences = []
    for _ in range(n_learners):
        length = max(2, items_per_learner + int(rng.integers(-jitter, jitter + 1)))
        sequences.append(simulate_learner(p, length, rng))
    return sequences
