"""Training loop: SGD with momentum, augmenting every batch on the fly."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import augment
from .model import Params, initial, loss_and_grads, predict


@dataclass
class Report:
    epoch: int
    loss: float
    accuracy: float


def accuracy(p: Params, x: np.ndarray, y: np.ndarray, batch: int = 512) -> float:
    correct = 0
    for start in range(0, len(x), batch):
        probs = predict(p, x[start : start + batch])
        correct += int((probs.argmax(axis=1) == y[start : start + batch]).sum())
    return correct / len(x)


def per_class(p: Params, x: np.ndarray, y: np.ndarray, classes: list[str], batch: int = 512) -> dict[str, float]:
    guesses = np.concatenate([predict(p, x[s : s + batch]).argmax(axis=1) for s in range(0, len(x), batch)])
    return {
        name: float((guesses[y == index] == index).mean()) if (y == index).any() else float('nan')
        for index, name in enumerate(classes)
    }


def train(
    x: np.ndarray,
    y: np.ndarray,
    val_x: np.ndarray,
    val_y: np.ndarray,
    *,
    epochs: int = 6,
    batch: int = 128,
    rate: float = 0.08,
    momentum: float = 0.9,
    seed: int = 0,
    log=print,
) -> tuple[Params, list[Report]]:
    rng = np.random.default_rng(seed)
    p = initial(seed)
    velocity = [np.zeros_like(t) for t in p.flat()]
    history: list[Report] = []

    for epoch in range(1, epochs + 1):
        order = rng.permutation(len(x))
        running = 0.0
        batches = 0
        # Decay once the model stops making fast progress.
        lr = rate * (0.5 ** ((epoch - 1) // 3))
        for start in range(0, len(order), batch):
            idx = order[start : start + batch]
            xb = augment(x[idx], rng)
            loss, grads = loss_and_grads(p, xb, y[idx])
            for tensor, grad, v in zip(p.flat(), grads.flat(), velocity):
                v *= momentum
                v -= lr * grad
                tensor += v
            running += loss
            batches += 1
        acc = accuracy(p, val_x, val_y)
        history.append(Report(epoch, running / batches, acc))
        log(f'epoch {epoch}  loss {running / batches:.4f}  held-out accuracy {acc:.4f}  (lr {lr:.3f})')
    return p, history
