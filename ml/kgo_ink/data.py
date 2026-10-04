"""Training data: MNIST digits, a synthesised fraction bar, and the kind of
distortion a finger on a tablet actually produces.

MNIST is written with a mouse or a stylus at high contrast. A learner draws
with a fingertip: thicker, blobbier, more slanted. The augmentation here exists
to close that gap, and is the difference between a model that scores well on
the test set and one that works on a tablet.

There is no '/' in MNIST, so the fraction bar is drawn. That class is the
weakest part of the model and is marked as such wherever its accuracy is
reported.
"""
from __future__ import annotations

import gzip
from pathlib import Path

import numpy as np

from .model import CLASSES
from .normalise import normalise

SLASH = CLASSES.index('/')
MIRROR = 'https://ossci-datasets.s3.amazonaws.com/mnist'
FILES = {
    'train_x': 'train-images-idx3-ubyte.gz',
    'train_y': 'train-labels-idx1-ubyte.gz',
    'test_x': 't10k-images-idx3-ubyte.gz',
    'test_y': 't10k-labels-idx1-ubyte.gz',
}


def _images(path: Path) -> np.ndarray:
    with gzip.open(path, 'rb') as handle:
        magic = int.from_bytes(handle.read(4), 'big')
        if magic != 2051:
            raise ValueError(f'{path} is not an MNIST image file')
        count = int.from_bytes(handle.read(4), 'big')
        rows = int.from_bytes(handle.read(4), 'big')
        cols = int.from_bytes(handle.read(4), 'big')
        raw = np.frombuffer(handle.read(count * rows * cols), dtype=np.uint8)
    return raw.reshape(count, rows, cols).astype(np.float64) / 255.0


def _labels(path: Path) -> np.ndarray:
    with gzip.open(path, 'rb') as handle:
        magic = int.from_bytes(handle.read(4), 'big')
        if magic != 2049:
            raise ValueError(f'{path} is not an MNIST label file')
        count = int.from_bytes(handle.read(4), 'big')
        raw = np.frombuffer(handle.read(count), dtype=np.uint8)
    return raw.astype(np.int64)


def load_mnist(directory: Path) -> dict[str, np.ndarray]:
    missing = [name for name in FILES.values() if not (directory / name).exists()]
    if missing:
        raise FileNotFoundError(
            f'Missing {", ".join(missing)} in {directory}. Download them from {MIRROR} first.'
        )
    return {
        'train_x': _images(directory / FILES['train_x']),
        'train_y': _labels(directory / FILES['train_y']),
        'test_x': _images(directory / FILES['test_x']),
        'test_y': _labels(directory / FILES['test_y']),
    }


def draw_slash(rng: np.random.Generator) -> np.ndarray:
    """One hand-drawn-looking fraction bar, normalised like every other sample."""
    size = 48
    canvas = np.zeros((size, size), dtype=np.float64)
    angle = rng.uniform(np.deg2rad(55), np.deg2rad(85))
    length = rng.uniform(26, 40)
    thickness = rng.uniform(1.4, 3.2)
    bow = rng.uniform(-0.1, 0.1)
    cx, cy = size / 2 + rng.uniform(-2, 2), size / 2 + rng.uniform(-2, 2)
    steps = 160
    for step in range(steps):
        t = step / (steps - 1) - 0.5
        # A slight bow keeps the strokes from all being perfectly straight.
        offset = bow * length * (0.25 - t * t)
        x = cx + np.cos(angle) * t * length * -1 + offset
        y = cy - np.sin(angle) * t * length
        xi, yi = int(round(x)), int(round(y))
        radius = int(np.ceil(thickness))
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                px, py = xi + dx, yi + dy
                if 0 <= px < size and 0 <= py < size:
                    distance = np.hypot(dx, dy)
                    ink = max(0.0, 1.0 - max(0.0, distance - thickness / 2))
                    canvas[py, px] = max(canvas[py, px], ink)
    return normalise(canvas)


def synth_slashes(count: int, rng: np.random.Generator) -> np.ndarray:
    return np.stack([draw_slash(rng) for _ in range(count)])


def _affine(images: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Random rotation, scale and shift, sampled bilinearly."""
    n = images.shape[0]
    angle = rng.uniform(-0.21, 0.21, n)          # about +/- 12 degrees
    scale = rng.uniform(0.88, 1.12, n)
    shift_y = rng.uniform(-2.0, 2.0, n)
    shift_x = rng.uniform(-2.0, 2.0, n)

    grid_y, grid_x = np.mgrid[0:28, 0:28]
    cy = cx = 13.5
    dy = (grid_y - cy)[None, :, :]
    dx = (grid_x - cx)[None, :, :]
    cos = np.cos(angle)[:, None, None] / scale[:, None, None]
    sin = np.sin(angle)[:, None, None] / scale[:, None, None]
    src_y = cos * dy + sin * dx + cy + shift_y[:, None, None]
    src_x = -sin * dy + cos * dx + cx + shift_x[:, None, None]

    y0 = np.floor(src_y).astype(int)
    x0 = np.floor(src_x).astype(int)
    wy, wx = src_y - y0, src_x - x0
    out = np.zeros_like(images)
    for oy in (0, 1):
        for ox in (0, 1):
            yy, xx = y0 + oy, x0 + ox
            valid = (yy >= 0) & (yy < 28) & (xx >= 0) & (xx < 28)
            weight = (wy if oy else 1 - wy) * (wx if ox else 1 - wx)
            idx = np.arange(n)[:, None, None]
            out += np.where(valid, images[idx, np.clip(yy, 0, 27), np.clip(xx, 0, 27)] * weight, 0.0)
    return np.clip(out, 0.0, 1.0)


def _thicken(images: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A fingertip lays down a fatter line than a stylus; some samples get one."""
    chosen = rng.random(images.shape[0]) < 0.5
    if not chosen.any():
        return images
    out = images.copy()
    picked = out[chosen]
    grown = picked.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        grown = np.maximum(grown, np.roll(picked, (dy, dx), axis=(1, 2)))
    out[chosen] = np.maximum(picked, grown * rng.uniform(0.55, 0.95, (chosen.sum(), 1, 1)))
    return np.clip(out, 0.0, 1.0)


def augment(images: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    return _thicken(_affine(images, rng), rng)
