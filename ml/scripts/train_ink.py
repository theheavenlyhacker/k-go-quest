"""Trains the handwriting model and writes it out for the tablet.

    python scripts/train_ink.py --mnist ./data/mnist --out ../mobile/src/content/handwriting-model.json

MNIST is not in this repository. Download the four .gz files from
https://ossci-datasets.s3.amazonaws.com/mnist into the --mnist directory first;
they are 11 MB in total and the script says which are missing.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kgo_ink.data import SLASH, load_mnist, synth_slashes  # noqa: E402
from kgo_ink.model import CLASSES, Params, predict  # noqa: E402
from kgo_ink.train import accuracy, per_class, train  # noqa: E402


def signif(value: float, digits: int = 6) -> float:
    """Rounded so the exported file is small, diffable, and byte-identical run to run."""
    if value == 0 or not np.isfinite(value):
        return 0.0
    return float(round(value, digits - 1 - int(np.floor(np.log10(abs(value))))))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--mnist', default='data/mnist')
    parser.add_argument('--out', required=True)
    parser.add_argument('--epochs', type=int, default=6)
    parser.add_argument('--slashes', type=int, default=6000)
    parser.add_argument('--seed', type=int, default=0)
    parser.add_argument('--checkpoint', default='data/ink-params.npz', help='where the trained weights are kept, so exporting again needs no retraining')
    parser.add_argument('--export-only', action='store_true', help='re-export from the checkpoint without training')
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    mnist = load_mnist(Path(args.mnist))

    print(f'Drawing {args.slashes} fraction bars...')
    train_slash = synth_slashes(args.slashes, rng)
    test_slash = synth_slashes(max(200, args.slashes // 6), rng)

    x = np.concatenate([mnist['train_x'], train_slash])
    y = np.concatenate([mnist['train_y'], np.full(len(train_slash), SLASH)])
    val_x = np.concatenate([mnist['test_x'], test_slash])
    val_y = np.concatenate([mnist['test_y'], np.full(len(test_slash), SLASH)])
    print(f'{len(x)} training samples, {len(val_x)} held out, {len(CLASSES)} classes')

    checkpoint = Path(args.checkpoint)
    if args.export_only:
        saved = np.load(checkpoint)
        params = Params(**{name: saved[name] for name in ('k1', 'b1', 'k2', 'b2', 'w3', 'b3', 'w4', 'b4')})
        print(f'Loaded {checkpoint}')
    else:
        params, _ = train(x, y, val_x, val_y, epochs=args.epochs, seed=args.seed)
        checkpoint.parent.mkdir(parents=True, exist_ok=True)
        np.savez(checkpoint, **{name: getattr(params, name) for name in ('k1', 'b1', 'k2', 'b2', 'w3', 'b3', 'w4', 'b4')})
        print(f'Saved {checkpoint}')

    # Round first, score second: the tablet runs the rounded weights, so those
    # are the ones whose accuracy is worth reporting and whose probe must match.
    params = Params(**{
        name: np.vectorize(signif)(getattr(params, name)).astype(np.float64)
        for name in ('k1', 'b1', 'k2', 'b2', 'w3', 'b3', 'w4', 'b4')
    })
    scores = per_class(params, val_x, val_y, CLASSES)
    print('per-class held-out accuracy:')
    for name, score in scores.items():
        print(f'  {name}  {score:.4f}')

    # A fixed input and its exact output, so the TypeScript port can be pinned.
    sample = val_x[:3]
    probe = predict(params, sample)

    model = {
        'version': 'ink-cnn-v1',
        'classes': CLASSES,
        'shape': {'conv1': list(params.k1.shape), 'conv2': list(params.k2.shape), 'hidden': int(params.w3.shape[1])},
        'accuracy': {name: signif(score, 4) for name, score in scores.items()},
        'overall': signif(accuracy(params, val_x, val_y), 4),
        'weights': {
            name: [signif(v) for v in getattr(params, name).reshape(-1).tolist()]
            for name in ('k1', 'b1', 'k2', 'b2', 'w3', 'b3', 'w4', 'b4')
        },
        'probe': {
            'input': [[signif(v, 4) for v in row.reshape(-1).tolist()] for row in sample],
            'output': [[signif(v) for v in row.tolist()] for row in probe],
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Wrote {out} ({out.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
