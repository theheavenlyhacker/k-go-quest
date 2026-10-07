"""Tests for model refit, learner-level split, and log-loss evaluation.

Covers Issue #70:
- The split is by Learner (disjoint sets of learner IDs).
- The split never trains on an Attempt later than one it evaluates (no future leakage).
- Log-loss evaluation properly compares fitted parameters vs defaults.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kgo_bkt import BktParams, DEFAULT, fit_skill
from kgo_bkt.data import CountedAttempt, split_by_learner_no_leakage, attempts_to_sequences
from kgo_bkt.model import evaluate_log_loss, sequence_log_loss


def test_split_by_learner_no_future_leakage() -> None:
    """The split is strictly by Learner and never trains on an Attempt later than one it evaluates."""
    base = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
    attempts: list[CountedAttempt] = []

    # 10 learners, each answering over 20 consecutive days
    for learner_idx in range(10):
        student_id = f"student-{learner_idx:02d}"
        for day in range(20):
            occurred_at = base + timedelta(days=day, hours=learner_idx)
            attempts.append(
                CountedAttempt(
                    skill_code="math5.fractions.add",
                    student_id=student_id,
                    correct=1 if (day + learner_idx) % 2 == 0 else 0,
                    occurred_at=occurred_at,
                    id=f"{student_id}-day{day}",
                )
            )

    train_attempts, test_attempts = split_by_learner_no_leakage(attempts, test_learner_ratio=0.2)

    assert len(train_attempts) > 0, "Train attempts should not be empty"
    assert len(test_attempts) > 0, "Test attempts should not be empty"

    train_learners = {a.student_id for a in train_attempts}
    test_learners = {a.student_id for a in test_attempts}

    # 1. The split is by Learner: disjoint learner sets
    assert train_learners.isdisjoint(test_learners), (
        f"Learner leakage: overlap found {train_learners & test_learners}"
    )

    # 2. Never trains on an Attempt later than one it evaluates
    max_train_time = max(a.occurred_at for a in train_attempts)
    min_test_time = min(a.occurred_at for a in test_attempts)
    assert max_train_time <= min_test_time, (
        f"Future leakage: max train time ({max_train_time}) > min test time ({min_test_time})"
    )

    for test_attempt in test_attempts:
        for train_attempt in train_attempts:
            assert train_attempt.occurred_at <= test_attempt.occurred_at, (
                f"Train attempt at {train_attempt.occurred_at} is later than evaluated test attempt at {test_attempt.occurred_at}"
            )


def test_sequence_log_loss() -> None:
    """Log-loss improves when parameters match the underlying distribution."""
    # A sequence with mostly correct answers
    seq = [1, 1, 1, 1, 1, 1, 1, 1]

    high_ability_params = BktParams(prior=0.7, learn=0.2, guess=0.25, slip=0.05)
    low_ability_params = BktParams(prior=0.05, learn=0.01, guess=0.1, slip=0.1)

    loss_high, n_high = sequence_log_loss(seq, high_ability_params)
    loss_low, n_low = sequence_log_loss(seq, low_ability_params)

    assert n_high == len(seq)
    assert n_low == len(seq)
    assert loss_high < loss_low, "High ability model should have lower log-loss on all-correct sequence"


def test_evaluate_log_loss_on_test_sequences() -> None:
    """evaluate_log_loss compares fitted parameters against defaults."""
    test_seqs = {
        "skill-1": [
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 0],
        ]
    }
    fitted = {"skill-1": BktParams(prior=0.6, learn=0.2, guess=0.2, slip=0.05)}
    fitted_loss, default_loss, obs = evaluate_log_loss(test_seqs, fitted, DEFAULT)

    assert obs == 10
    assert fitted_loss < default_loss, "Fitted parameters should beat default parameters"


def test_refit_learner_split_end_to_end() -> None:
    """End-to-end check of learner split and sequence conversion."""
    base = datetime(2026, 9, 1, tzinfo=timezone.utc)
    attempts: list[CountedAttempt] = []

    for s in range(6):
        for d in range(10):
            attempts.append(
                CountedAttempt(
                    skill_code="math5.decimals",
                    student_id=f"student-{s}",
                    correct=1 if d > 2 else 0,
                    occurred_at=base + timedelta(days=d),
                    id=f"att-{s}-{d}",
                )
            )

    train, test = split_by_learner_no_leakage(attempts)
    train_seqs = attempts_to_sequences(train)
    test_seqs = attempts_to_sequences(test)

    assert "math5.decimals" in train_seqs
    assert "math5.decimals" in test_seqs
    assert len(train_seqs["math5.decimals"]) + len(test_seqs["math5.decimals"]) == 6
