"""Tests for the handwriting model.

None of these need MNIST: CI has no dataset, and the properties worth pinning —
that the gradients are right, that normalisation is what it claims, that the
ported forward pass can be checked — do not depend on real digits.
"""
from __future__ import annotations

import numpy as np
import pytest

from kgo_ink.data import augment, draw_slash, synth_slashes
from kgo_ink.model import CLASSES, initial, loss_and_grads, maxpool, predict, softmax, unpool
from kgo_ink.normalise import BOX, FIELD, normalise, tight_crop


def centre_of_mass(image: np.ndarray) -> tuple[float, float]:
    ys, xs = np.mgrid[0 : image.shape[0], 0 : image.shape[1]]
    total = image.sum()
    return float((image * ys).sum() / total), float((image * xs).sum() / total)


class TestNormalise:
    def test_empty_ink_gives_an_empty_field(self):
        assert normalise(np.zeros((40, 40))).sum() == 0.0

    def test_long_side_fits_the_twenty_pixel_box(self):
        tall = np.zeros((60, 10))
        tall[5:55, 3:7] = 1.0
        inked = tight_crop(normalise(tall))
        assert max(inked.shape) <= BOX
        assert normalise(tall).shape == (FIELD, FIELD)

    def test_centres_by_mass_wherever_the_ink_started(self):
        for top, left in ((0, 0), (20, 25), (9, 2)):
            canvas = np.zeros((48, 48))
            canvas[top : top + 12, left : left + 8] = 1.0
            y, x = centre_of_mass(normalise(canvas))
            assert y == pytest.approx(13.5, abs=1.0)
            assert x == pytest.approx(13.5, abs=1.0)

    def test_size_and_position_stop_mattering(self):
        """The same shape drawn small in a corner and large in the middle
        normalises to nearly the same field — which is the entire reason a model
        trained on MNIST can read a stroke drawn with a fingertip."""
        small = np.zeros((60, 60)); small[2:14, 3:9] = 1.0
        large = np.zeros((60, 60)); large[20:56, 26:44] = 1.0
        assert np.abs(normalise(small) - normalise(large)).max() < 0.25


class TestLayers:
    def test_maxpool_halves_and_unpool_returns_the_chosen_cells(self):
        x = np.arange(2 * 3 * 4 * 4, dtype=np.float64).reshape(2, 3, 4, 4)
        pooled, picked = maxpool(x)
        assert pooled.shape == (2, 3, 2, 2)
        back = unpool(np.ones_like(pooled), picked, x.shape)
        # One gradient per window, landing on the cell that won it.
        assert back.sum() == pooled.size
        assert set(np.unique(back)) <= {0.0, 1.0}

    def test_softmax_is_a_distribution(self):
        probs = softmax(np.array([[1.0, 2.0, 3.0], [0.0, 0.0, 0.0]]))
        assert probs.sum(axis=1) == pytest.approx([1.0, 1.0])
        assert probs[1] == pytest.approx([1 / 3, 1 / 3, 1 / 3])

    def test_softmax_survives_large_logits(self):
        assert np.isfinite(softmax(np.array([[1000.0, 999.0]]))).all()


class TestGradients:
    def test_backward_matches_finite_differences(self):
        """The reason the training loop can be trusted. A sign error anywhere in
        backward would still train — just badly — so it is checked numerically."""
        rng = np.random.default_rng(1)
        x = rng.random((3, 28, 28)) * 0.6
        y = rng.integers(0, len(CLASSES), 3)
        p = initial(0)
        _, grads = loss_and_grads(p, x, y)

        worst = 0.0
        for name in ('k1', 'b1', 'k2', 'b2', 'w3', 'b3', 'w4', 'b4'):
            tensor = getattr(p, name).reshape(-1)
            analytic = getattr(grads, name).reshape(-1)
            for index in rng.choice(tensor.size, size=min(3, tensor.size), replace=False):
                keep, eps = tensor[index], 1e-5
                tensor[index] = keep + eps
                up, _ = loss_and_grads(p, x, y)
                tensor[index] = keep - eps
                down, _ = loss_and_grads(p, x, y)
                tensor[index] = keep
                numeric = (up - down) / (2 * eps)
                worst = max(worst, abs(numeric - analytic[index]) / max(1e-9, abs(numeric) + abs(analytic[index])))
        assert worst < 1e-5

    def test_a_handful_of_samples_can_be_memorised(self):
        """End to end: if the loop cannot overfit eleven samples, nothing else
        it reports means anything."""
        rng = np.random.default_rng(3)
        x = rng.random((len(CLASSES), 28, 28)) * 0.8
        y = np.arange(len(CLASSES))
        p = initial(1)
        velocity = [np.zeros_like(t) for t in p.flat()]
        for _ in range(120):
            _, grads = loss_and_grads(p, x, y)
            for tensor, grad, v in zip(p.flat(), grads.flat(), velocity):
                v *= 0.9
                v -= 0.05 * grad
                tensor += v
        assert (predict(p, x).argmax(axis=1) == y).all()


class TestSyntheticInk:
    def test_a_drawn_fraction_bar_is_inked_and_normalised(self):
        image = draw_slash(np.random.default_rng(0))
        assert image.shape == (FIELD, FIELD)
        assert 0.0 < image.max() <= 1.0
        y, x = centre_of_mass(image)
        assert y == pytest.approx(13.5, abs=1.5)
        assert x == pytest.approx(13.5, abs=1.5)

    def test_bars_differ_from_one_another(self):
        batch = synth_slashes(6, np.random.default_rng(2))
        assert batch.shape == (6, FIELD, FIELD)
        assert np.abs(batch[0] - batch[1]).max() > 0.1

    def test_augmentation_keeps_shape_and_range(self):
        rng = np.random.default_rng(4)
        batch = synth_slashes(8, rng)
        out = augment(batch, rng)
        assert out.shape == batch.shape
        assert out.min() >= 0.0 and out.max() <= 1.0
        assert np.abs(out - batch).max() > 0.0
