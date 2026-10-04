"""Turning ink into the 28x28 field the network was trained on.

The whole model rests on this file. MNIST was built by size-normalising each
digit into a 20x20 box and then centring it in a 28x28 field by its centre of
mass. A stroke drawn on a tablet looks nothing like a MNIST digit until the
same two steps are applied to it, so they are applied identically here and in
`mobile/src/domain/ink.ts`, and pinned by shared vectors.
"""
from __future__ import annotations

import numpy as np

FIELD = 28
BOX = 20


def tight_crop(image: np.ndarray) -> np.ndarray:
    """The smallest rectangle holding every inked pixel."""
    rows = np.any(image > 0, axis=1)
    cols = np.any(image > 0, axis=0)
    if not rows.any() or not cols.any():
        return np.zeros((1, 1), dtype=image.dtype)
    top, bottom = np.where(rows)[0][[0, -1]]
    left, right = np.where(cols)[0][[0, -1]]
    return image[top : bottom + 1, left : right + 1]


def _resize(image: np.ndarray, height: int, width: int) -> np.ndarray:
    """Area-average resize. Written out so the TypeScript side can match it
    exactly; a library's resize would be one more thing to keep in step."""
    src_h, src_w = image.shape
    out = np.zeros((height, width), dtype=np.float64)
    for y in range(height):
        y0, y1 = y * src_h / height, (y + 1) * src_h / height
        for x in range(width):
            x0, x1 = x * src_w / width, (x + 1) * src_w / width
            total = 0.0
            weight = 0.0
            for sy in range(int(np.floor(y0)), min(src_h, int(np.ceil(y1)))):
                cover_y = min(y1, sy + 1) - max(y0, sy)
                if cover_y <= 0:
                    continue
                for sx in range(int(np.floor(x0)), min(src_w, int(np.ceil(x1)))):
                    cover_x = min(x1, sx + 1) - max(x0, sx)
                    if cover_x <= 0:
                        continue
                    area = cover_y * cover_x
                    total += image[sy, sx] * area
                    weight += area
            out[y, x] = total / weight if weight > 0 else 0.0
    return out


def normalise(image: np.ndarray) -> np.ndarray:
    """Crop, fit the long side into 20 pixels, centre by centre of mass in 28x28."""
    cropped = tight_crop(np.asarray(image, dtype=np.float64))
    height, width = cropped.shape
    if height == 0 or width == 0 or cropped.max() <= 0:
        return np.zeros((FIELD, FIELD), dtype=np.float64)
    scale = BOX / max(height, width)
    new_h = max(1, min(BOX, int(round(height * scale))))
    new_w = max(1, min(BOX, int(round(width * scale))))
    small = _resize(cropped, new_h, new_w)

    field = np.zeros((FIELD, FIELD), dtype=np.float64)
    total = small.sum()
    if total <= 0:
        return field
    ys, xs = np.mgrid[0:new_h, 0:new_w]
    centre_y = (small * ys).sum() / total
    centre_x = (small * xs).sum() / total
    top = int(round(FIELD / 2 - centre_y - 0.5))
    left = int(round(FIELD / 2 - centre_x - 0.5))
    top = max(0, min(FIELD - new_h, top))
    left = max(0, min(FIELD - new_w, left))
    field[top : top + new_h, left : left + new_w] = small
    return field
