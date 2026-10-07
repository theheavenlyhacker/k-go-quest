"""Fitting BKT parameters with Expectation-Maximisation (Baum-Welch).

The transition matrix is constrained — a learner never forgets within a
sequence — so only the unknown -> known transition is re-estimated. Guess and
slip are clamped to the conventional degeneracy bounds after every step.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from .model import EPS, BktParams, DEFAULT, forward_backward

# Below this there is not enough evidence to prefer a fitted value over the
# shared default, and pretending otherwise would be the whole problem.
MIN_SEQUENCES = 25
MIN_OBSERVATIONS = 150


@dataclass
class FitResult:
    params: BktParams
    log_likelihood: float
    sequences: int
    observations: int
    iterations: int
    converged: bool
    fitted: bool
    note: str

    def as_dict(self) -> dict:
        # NaN is legal in Python's json but not in strict JSON, and the
        # backend importer parses this with JSON.parse. Unfitted skills have no
        # likelihood, so they emit null.
        likelihood = (
            None
            if self.log_likelihood != self.log_likelihood or self.log_likelihood in (float("inf"), float("-inf"))
            else round(self.log_likelihood, 4)
        )
        return {
            **self.params.as_dict(),
            "logLikelihood": likelihood,
            "sequences": self.sequences,
            "observations": self.observations,
            "iterations": self.iterations,
            "converged": self.converged,
            "fitted": self.fitted,
            "note": self.note,
        }


def em_fit(
    sequences: Sequence[Sequence[int]],
    init: BktParams,
    max_iter: int = 300,
    tol: float = 1e-7,
) -> tuple[BktParams, float, int, bool]:
    p = init.clamped()
    previous = -np.inf
    iterations = 0
    converged = False

    for iterations in range(1, max_iter + 1):
        prior_num = 0.0
        learn_num = learn_den = 0.0
        guess_num = guess_den = 0.0
        slip_num = slip_den = 0.0
        total_ll = 0.0
        used = 0

        for sequence in sequences:
            if len(sequence) == 0:
                continue
            obs = np.asarray(sequence, dtype=int)
            gamma, xi, ll = forward_backward(obs, p)
            total_ll += ll
            used += 1

            prior_num += gamma[0, 1]
            if len(obs) > 1:
                learn_num += xi[:, 0, 1].sum()
                learn_den += gamma[:-1, 0].sum()
            guess_num += float((gamma[:, 0] * obs).sum())
            guess_den += float(gamma[:, 0].sum())
            slip_num += float((gamma[:, 1] * (1 - obs)).sum())
            slip_den += float(gamma[:, 1].sum())

        if used == 0:
            return p, -np.inf, iterations, False

        p = BktParams(
            prior=prior_num / used,
            learn=learn_num / learn_den if learn_den > EPS else p.learn,
            guess=guess_num / guess_den if guess_den > EPS else p.guess,
            slip=slip_num / slip_den if slip_den > EPS else p.slip,
        ).clamped()

        if abs(total_ll - previous) < tol:
            converged = True
            previous = total_ll
            break
        previous = total_ll

    return p, float(previous), iterations, converged


def fit_skill(
    sequences: Sequence[Sequence[int]],
    restarts: int = 10,
    seed: int = 11,
    skill: str = "",
    min_sequences: int = MIN_SEQUENCES,
    min_observations: int = MIN_OBSERVATIONS,
) -> FitResult:
    """EM from several random starts; the best log-likelihood wins.

    The likelihood surface has local optima, so a single start is a coin flip.
    """
    usable = [list(s) for s in sequences if len(s) > 0]
    observations = sum(len(s) for s in usable)

    if len(usable) < min_sequences or observations < min_observations:
        return FitResult(
            params=DEFAULT,
            log_likelihood=float("nan"),
            sequences=len(usable),
            observations=observations,
            iterations=0,
            converged=False,
            fitted=False,
            note=(
                f"Not enough evidence for {skill or 'this skill'}: "
                f"{len(usable)} sequences / {observations} answers "
                f"(need {min_sequences} / {min_observations}). Using shared defaults."
            ),
        )

    rng = np.random.default_rng(seed)
    best: tuple[BktParams, float, int, bool] | None = None

    starts = [DEFAULT] + [
        BktParams(
            prior=float(rng.uniform(0.05, 0.60)),
            learn=float(rng.uniform(0.02, 0.35)),
            guess=float(rng.uniform(0.05, 0.30)),
            slip=float(rng.uniform(0.02, 0.10)),
        )
        for _ in range(max(0, restarts - 1))
    ]

    for start in starts:
        candidate = em_fit(usable, start)
        if best is None or candidate[1] > best[1]:
            best = candidate

    assert best is not None
    params, ll, iterations, converged = best
    degenerate = params.is_degenerate()

    return FitResult(
        params=DEFAULT if degenerate else params,
        log_likelihood=ll,
        sequences=len(usable),
        observations=observations,
        iterations=iterations,
        converged=converged,
        fitted=not degenerate,
        note=(
            "Degenerate fit (guess + slip >= 1); kept shared defaults."
            if degenerate
            else "Fitted by EM with multiple restarts."
        ),
    )
