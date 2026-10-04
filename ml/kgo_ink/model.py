"""A small convolutional network, forward and backward, in NumPy.

Deliberately hand-written rather than taken from a framework. The forward pass
has to be reimplemented in TypeScript to run on the tablet, and the only way to
be sure the two agree is for both to be small enough to read in one sitting.

    1x28x28 -> conv 8@3x3 -> ReLU -> maxpool 2
            -> conv 16@3x3 -> ReLU -> maxpool 2
            -> flatten 784 -> dense 32 -> ReLU -> dense 11 -> softmax

About 27,000 parameters: 106 KB as float32, which is what makes shipping it
inside a Content Pack reasonable.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

CLASSES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '/']
CONV1, CONV2, HIDDEN = 8, 16, 32


def im2col(x: np.ndarray, k: int) -> np.ndarray:
    """(n, c, h, w) with one pixel of zero padding -> (n, h*w, c*k*k)."""
    n, c, h, w = x.shape
    pad = k // 2
    padded = np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    cols = np.empty((n, c, k, k, h, w), dtype=x.dtype)
    for i in range(k):
        for j in range(k):
            cols[:, :, i, j] = padded[:, :, i : i + h, j : j + w]
    return cols.transpose(0, 4, 5, 1, 2, 3).reshape(n, h * w, c * k * k)


def col2im(cols: np.ndarray, shape: tuple[int, int, int, int], k: int) -> np.ndarray:
    n, c, h, w = shape
    pad = k // 2
    cols = cols.reshape(n, h, w, c, k, k).transpose(0, 3, 4, 5, 1, 2)
    out = np.zeros((n, c, h + 2 * pad, w + 2 * pad), dtype=cols.dtype)
    for i in range(k):
        for j in range(k):
            out[:, :, i : i + h, j : j + w] += cols[:, :, i, j]
    return out[:, :, pad : pad + h, pad : pad + w]


def maxpool(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n, c, h, w = x.shape
    windows = x.reshape(n, c, h // 2, 2, w // 2, 2).transpose(0, 1, 2, 4, 3, 5).reshape(n, c, h // 2, w // 2, 4)
    picked = windows.argmax(axis=-1)
    return windows.max(axis=-1), picked


def unpool(grad: np.ndarray, picked: np.ndarray, shape: tuple[int, int, int, int]) -> np.ndarray:
    n, c, h, w = shape
    flat = np.zeros((n, c, h // 2, w // 2, 4), dtype=grad.dtype)
    idx = np.indices(picked.shape)
    flat[idx[0], idx[1], idx[2], idx[3], picked] = grad
    return flat.reshape(n, c, h // 2, w // 2, 2, 2).transpose(0, 1, 2, 4, 3, 5).reshape(n, c, h, w)


@dataclass
class Params:
    k1: np.ndarray  # (8, 1, 3, 3)
    b1: np.ndarray
    k2: np.ndarray  # (16, 8, 3, 3)
    b2: np.ndarray
    w3: np.ndarray  # (784, 32)
    b3: np.ndarray
    w4: np.ndarray  # (32, 11)
    b4: np.ndarray

    def flat(self) -> list[np.ndarray]:
        return [self.k1, self.b1, self.k2, self.b2, self.w3, self.b3, self.w4, self.b4]


def initial(seed: int = 0) -> Params:
    """He initialisation: the ReLUs halve the variance, so the weights double it."""
    rng = np.random.default_rng(seed)

    def he(shape: tuple[int, ...], fan_in: int) -> np.ndarray:
        return rng.normal(0.0, np.sqrt(2.0 / fan_in), shape)

    return Params(
        k1=he((CONV1, 1, 3, 3), 9),
        b1=np.zeros(CONV1),
        k2=he((CONV2, CONV1, 3, 3), CONV1 * 9),
        b2=np.zeros(CONV2),
        w3=he((7 * 7 * CONV2, HIDDEN), 7 * 7 * CONV2),
        b3=np.zeros(HIDDEN),
        w4=he((HIDDEN, len(CLASSES)), HIDDEN),
        b4=np.zeros(len(CLASSES)),
    )


def forward(p: Params, x: np.ndarray) -> tuple[np.ndarray, dict]:
    """x is (n, 28, 28) with ink in 0..1. Returns logits and the cache for backward."""
    n = x.shape[0]
    a0 = x.reshape(n, 1, 28, 28)

    c1 = im2col(a0, 3) @ p.k1.reshape(CONV1, -1).T + p.b1
    z1 = c1.transpose(0, 2, 1).reshape(n, CONV1, 28, 28)
    r1 = np.maximum(z1, 0.0)
    p1, pick1 = maxpool(r1)

    c2 = im2col(p1, 3) @ p.k2.reshape(CONV2, -1).T + p.b2
    z2 = c2.transpose(0, 2, 1).reshape(n, CONV2, 14, 14)
    r2 = np.maximum(z2, 0.0)
    p2, pick2 = maxpool(r2)

    flat = p2.reshape(n, -1)
    z3 = flat @ p.w3 + p.b3
    r3 = np.maximum(z3, 0.0)
    logits = r3 @ p.w4 + p.b4
    cache = dict(a0=a0, z1=z1, r1=r1, pick1=pick1, p1=p1, z2=z2, r2=r2, pick2=pick2, flat=flat, z3=z3, r3=r3)
    return logits, cache


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def loss_and_grads(p: Params, x: np.ndarray, y: np.ndarray) -> tuple[float, Params]:
    n = x.shape[0]
    logits, c = forward(p, x)
    probs = softmax(logits)
    loss = float(-np.log(np.clip(probs[np.arange(n), y], 1e-12, None)).mean())

    d_logits = probs.copy()
    d_logits[np.arange(n), y] -= 1.0
    d_logits /= n

    g_w4 = c['r3'].T @ d_logits
    g_b4 = d_logits.sum(axis=0)
    d_r3 = d_logits @ p.w4.T
    d_z3 = d_r3 * (c['z3'] > 0)

    g_w3 = c['flat'].T @ d_z3
    g_b3 = d_z3.sum(axis=0)
    d_flat = d_z3 @ p.w3.T
    d_p2 = d_flat.reshape(n, CONV2, 7, 7)

    d_r2 = unpool(d_p2, c['pick2'], (n, CONV2, 14, 14))
    d_z2 = d_r2 * (c['z2'] > 0)
    d_c2 = d_z2.reshape(n, CONV2, 14 * 14).transpose(0, 2, 1)
    cols2 = im2col(c['p1'], 3)
    g_k2 = np.einsum('nij,nik->jk', d_c2, cols2).reshape(p.k2.shape)
    g_b2 = d_c2.sum(axis=(0, 1))
    d_p1 = col2im(d_c2 @ p.k2.reshape(CONV2, -1), (n, CONV1, 14, 14), 3)

    d_r1 = unpool(d_p1, c['pick1'], (n, CONV1, 28, 28))
    d_z1 = d_r1 * (c['z1'] > 0)
    d_c1 = d_z1.reshape(n, CONV1, 28 * 28).transpose(0, 2, 1)
    cols1 = im2col(c['a0'], 3)
    g_k1 = np.einsum('nij,nik->jk', d_c1, cols1).reshape(p.k1.shape)
    g_b1 = d_c1.sum(axis=(0, 1))

    return loss, Params(g_k1, g_b1, g_k2, g_b2, g_w3, g_b3, g_w4, g_b4)


def predict(p: Params, x: np.ndarray) -> np.ndarray:
    logits, _ = forward(p, x)
    return softmax(logits)
