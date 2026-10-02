"""Does the fitter actually recover parameters it has not been told?

Run directly (`python3 tests/test_recovery.py`) or under pytest.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kgo_bkt import BktParams, DEFAULT, fit_skill, simulate, update_mastery
from kgo_bkt.model import predict_correct

# Parameter sets spanning an easy skill, a hard one, and a guessable one.
CASES = [
    ("balanced", BktParams(prior=0.25, learn=0.12, guess=0.18, slip=0.07)),
    ("hard skill", BktParams(prior=0.08, learn=0.05, guess=0.10, slip=0.04)),
    ("already known", BktParams(prior=0.55, learn=0.20, guess=0.22, slip=0.06)),
    ("guessable", BktParams(prior=0.15, learn=0.10, guess=0.28, slip=0.05)),
]

TOLERANCE = {"prior": 0.08, "learn": 0.05, "guess": 0.07, "slip": 0.04}


def test_parameter_recovery() -> None:
    for index, (name, truth) in enumerate(CASES):
        sequences = simulate(truth, n_learners=600, items_per_learner=15, seed=100 + index)
        result = fit_skill(sequences, skill=name, seed=20 + index)
        assert result.fitted, f"{name}: fitter gave up"
        assert result.converged, f"{name}: EM did not converge"
        for field, tol in TOLERANCE.items():
            got = getattr(result.params, field)
            want = getattr(truth, field)
            assert abs(got - want) <= tol, (
                f"{name}: {field} off by {abs(got - want):.3f} (fitted {got:.3f}, truth {want:.3f})"
            )
        print(f"  ok  {name:<14} {result.params.as_dict()}")


def test_insufficient_data_falls_back() -> None:
    truth = BktParams(prior=0.3, learn=0.1, guess=0.2, slip=0.05)
    result = fit_skill(simulate(truth, n_learners=5, items_per_learner=4, seed=1), skill="sparse")
    assert not result.fitted
    assert result.params == DEFAULT
    assert "Not enough evidence" in result.note
    print(f"  ok  sparse data falls back to defaults")


def test_update_matches_backend_formula() -> None:
    """Golden values taken by running updateMastery() from the backend's
    src/modules/learning/mastery.ts with the same inputs. If this test breaks,
    the two implementations have drifted and fitted parameters no longer mean
    the same thing on both sides."""
    p = BktParams(prior=0.20, learn=0.08, guess=0.20, slip=0.10)
    after_correct = update_mastery(0.2, True, p)
    after_wrong = update_mastery(0.2, False, p)
    assert abs(after_correct - 0.5670588235) < 1e-9, after_correct
    assert abs(after_wrong - 0.1078787879) < 1e-9, after_wrong
    print(f"  ok  update matches backend ({after_correct:.10f} / {after_wrong:.10f})")


def test_correct_answers_raise_mastery() -> None:
    """Strictly increasing until the 0.999 ceiling, never decreasing."""
    for name, truth in CASES:
        mastery = truth.prior
        for _ in range(8):
            nxt = update_mastery(mastery, True, truth)
            assert nxt >= mastery - 1e-12, f"{name}: a correct answer lowered mastery"
            if mastery < 0.99:
                assert nxt > mastery, f"{name}: mastery stalled below the ceiling"
            mastery = nxt
        assert mastery > 0.8, f"{name}: eight correct answers should approach mastery, got {mastery:.3f}"
    print("  ok  correct answers raise mastery monotonically")


def test_wrong_answers_lower_mastery() -> None:
    for name, truth in CASES:
        mastery = 0.9
        nxt = update_mastery(mastery, False, truth)
        assert nxt < mastery, f"{name}: a wrong answer should lower mastery"
    print("  ok  wrong answers lower mastery")


def test_prediction_is_bounded_by_guess_and_slip() -> None:
    p = BktParams(prior=0.2, learn=0.1, guess=0.2, slip=0.05)
    assert abs(predict_correct(0.0, p) - p.guess) < 1e-9
    assert abs(predict_correct(1.0, p) - (1.0 - p.slip)) < 1e-9
    print("  ok  prediction bounded by guess and slip")


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    print(f"running {len(tests)} tests\n")
    for test in tests:
        print(f"{test.__name__}:")
        test()
    print("\nall passed")
