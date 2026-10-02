"""Bayesian Knowledge Tracing: the model itself.

Two latent states per skill — unknown (0) and known (1) — with no forgetting,
so the only transition is unknown -> known. Four parameters:

    prior (L0)  probability the learner already knew the skill before item 1
    learn (T)   probability of moving unknown -> known after an item
    guess (G)   probability of answering correctly while still unknown
    slip  (S)   probability of answering incorrectly while already known

The update in `posterior_known` is the same arithmetic the mobile backend runs
in `src/modules/learning/mastery.ts`. If one changes, the other must change
with it, or fitted parameters stop meaning what the app thinks they mean.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Sequence

import numpy as np

EPS = 1e-9

# Degeneracy bounds. Without them EM happily lands on "guessing explains
# everything" solutions where a correct answer lowers the mastery estimate.
# These are the conventional limits from the BKT literature.
MAX_GUESS = 0.30
MAX_SLIP = 0.10
MIN_LEARN, MAX_LEARN = 0.001, 0.500
MIN_PRIOR, MAX_PRIOR = 0.010, 0.850
FLOOR = 0.001


@dataclass(frozen=True)
class BktParams:
    prior: float
    learn: float
    guess: float
    slip: float

    def clamped(self) -> "BktParams":
        return BktParams(
            prior=float(np.clip(self.prior, MIN_PRIOR, MAX_PRIOR)),
            learn=float(np.clip(self.learn, MIN_LEARN, MAX_LEARN)),
            guess=float(np.clip(self.guess, FLOOR, MAX_GUESS)),
            slip=float(np.clip(self.slip, FLOOR, MAX_SLIP)),
        )

    def is_degenerate(self) -> bool:
        """A model where guessing beats knowing is not usable for teaching."""
        return self.guess + self.slip >= 1.0

    def as_dict(self) -> dict:
        return {key: round(value, 6) for key, value in asdict(self).items()}


DEFAULT = BktParams(prior=0.20, learn=0.08, guess=0.20, slip=0.10)


def matrices(p: BktParams):
    pi = np.array([1.0 - p.prior, p.prior], dtype=float)
    transition = np.array([[1.0 - p.learn, p.learn], [0.0, 1.0]], dtype=float)
    # emission[state][observation], observation 1 == correct
    emission = np.array([[1.0 - p.guess, p.guess], [p.slip, 1.0 - p.slip]], dtype=float)
    return pi, transition, emission


def posterior_known(prior: float, correct: bool, p: BktParams) -> float:
    """One observation of evidence, before the learning transition."""
    known = prior * ((1.0 - p.slip) if correct else p.slip)
    unknown = (1.0 - prior) * (p.guess if correct else (1.0 - p.guess))
    total = known + unknown
    return known / total if total > EPS else prior


def update_mastery(prior: float, correct: bool, p: BktParams = DEFAULT) -> float:
    """Evidence, then the chance the item itself taught the skill."""
    posterior = posterior_known(prior, correct, p)
    return min(0.999, max(0.001, posterior + (1.0 - posterior) * p.learn))


def predict_correct(prior: float, p: BktParams) -> float:
    """Probability the next answer is correct, given current mastery."""
    return prior * (1.0 - p.slip) + (1.0 - prior) * p.guess


def forward_backward(obs: Sequence[int], p: BktParams):
    """Scaled forward-backward. Returns (gamma, xi, log-likelihood).

    gamma[t, s] is P(state s at t | observations); xi[t, i, j] is
    P(state i at t, state j at t+1 | observations).
    """
    observations = np.asarray(obs, dtype=int)
    n = len(observations)
    pi, transition, emission = matrices(p)

    alpha = np.zeros((n, 2))
    scale = np.zeros(n)
    alpha[0] = pi * emission[:, observations[0]]
    scale[0] = alpha[0].sum() + EPS
    alpha[0] /= scale[0]
    for t in range(1, n):
        alpha[t] = (alpha[t - 1] @ transition) * emission[:, observations[t]]
        scale[t] = alpha[t].sum() + EPS
        alpha[t] /= scale[t]

    beta = np.zeros((n, 2))
    beta[n - 1] = 1.0
    for t in range(n - 2, -1, -1):
        beta[t] = transition @ (emission[:, observations[t + 1]] * beta[t + 1])
        beta[t] /= scale[t + 1]

    gamma = alpha * beta
    gamma /= gamma.sum(axis=1, keepdims=True) + EPS

    xi = np.zeros((max(n - 1, 0), 2, 2))
    for t in range(n - 1):
        step = (
            alpha[t][:, None]
            * transition
            * emission[:, observations[t + 1]][None, :]
            * beta[t + 1][None, :]
        )
        total = step.sum()
        # Normalising per step keeps this correct regardless of which scaling
        # convention beta follows.
        xi[t] = step / total if total > EPS else step

    return gamma, xi, float(np.log(scale).sum())


def log_likelihood(sequences: Sequence[Sequence[int]], p: BktParams) -> float:
    return sum(forward_backward(seq, p)[2] for seq in sequences if len(seq) > 0)
