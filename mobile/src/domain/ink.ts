/**
 * Ink: turning what a Learner drew into what the model was trained on.
 *
 * The model is a port of `ml/kgo_ink`, and it only works because the ink is put
 * through exactly the same two steps MNIST was built with: fit the long side of
 * the symbol into a 20-pixel box, then centre it in a 28x28 field by its centre
 * of mass. Size, position and how hard the stroke was drawn all stop mattering,
 * which is what lets a model trained on mouse-written digits read a fingertip.
 *
 * `ml/kgo_ink/normalise.py` is the other half of this file. They are pinned to
 * each other by the probe in the model file; if one changes, the test fails.
 */
export interface Point { x: number; y: number }
export type Stroke = Point[];

export const FIELD = 28;
export const BOX = 20;

export interface Grid { width: number; height: number; data: Float64Array }

const empty = (width: number, height: number): Grid => ({ width, height, data: new Float64Array(width * height) });

/**
 * Python's round(), which goes to even on a tie where JavaScript's goes up.
 * One pixel of disagreement here moves the whole symbol, so it is worth the
 * five lines.
 */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Lays strokes down as a round brush, the way the training data was drawn. */
export function rasterise(strokes: Stroke[], width: number, height: number, thickness: number): Grid {
  const grid = empty(width, height);
  const radius = Math.ceil(thickness);
  const mark = (x: number, y: number) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const ink = Math.max(0, 1 - Math.max(0, Math.hypot(dx, dy) - thickness / 2));
        const at = py * width + px;
        if (ink > grid.data[at]) grid.data[at] = ink;
      }
    }
  };
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    if (stroke.length === 1) { mark(stroke[0].x, stroke[0].y); continue; }
    for (let i = 1; i < stroke.length; i += 1) {
      const from = stroke[i - 1];
      const to = stroke[i];
      // Touch events arrive far apart when a finger moves fast; the gaps are
      // filled here or the stroke reads as dots.
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        mark(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      }
    }
  }
  return grid;
}

export function tightCrop(grid: Grid): Grid {
  let top = grid.height;
  let bottom = -1;
  let left = grid.width;
  let right = -1;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (grid.data[y * grid.width + x] <= 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return empty(1, 1);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const out = empty(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) out.data[y * width + x] = grid.data[(top + y) * grid.width + (left + x)];
  }
  return out;
}

/** Area-average resize, written out so it matches `_resize` in normalise.py exactly. */
export function resizeArea(grid: Grid, height: number, width: number): Grid {
  const out = empty(width, height);
  for (let y = 0; y < height; y += 1) {
    const y0 = (y * grid.height) / height;
    const y1 = ((y + 1) * grid.height) / height;
    for (let x = 0; x < width; x += 1) {
      const x0 = (x * grid.width) / width;
      const x1 = ((x + 1) * grid.width) / width;
      let total = 0;
      let weight = 0;
      for (let sy = Math.floor(y0); sy < Math.min(grid.height, Math.ceil(y1)); sy += 1) {
        const coverY = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (coverY <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.min(grid.width, Math.ceil(x1)); sx += 1) {
          const coverX = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (coverX <= 0) continue;
          const area = coverY * coverX;
          total += grid.data[sy * grid.width + sx] * area;
          weight += area;
        }
      }
      out.data[y * width + x] = weight > 0 ? total / weight : 0;
    }
  }
  return out;
}

/** Crop, fit into 20 pixels, centre by mass in 28x28. The model's only input. */
export function normalise(grid: Grid): Float64Array {
  const cropped = tightCrop(grid);
  const field = new Float64Array(FIELD * FIELD);
  let peak = 0;
  for (const value of cropped.data) if (value > peak) peak = value;
  if (peak <= 0) return field;

  const scale = BOX / Math.max(cropped.height, cropped.width);
  const height = Math.max(1, Math.min(BOX, roundHalfEven(cropped.height * scale)));
  const width = Math.max(1, Math.min(BOX, roundHalfEven(cropped.width * scale)));
  const small = resizeArea(cropped, height, width);

  let total = 0;
  let massY = 0;
  let massX = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = small.data[y * width + x];
      total += value;
      massY += value * y;
      massX += value * x;
    }
  }
  if (total <= 0) return field;

  const top = Math.max(0, Math.min(FIELD - height, roundHalfEven(FIELD / 2 - massY / total - 0.5)));
  const left = Math.max(0, Math.min(FIELD - width, roundHalfEven(FIELD / 2 - massX / total - 0.5)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) field[(top + y) * FIELD + (left + x)] = small.data[y * width + x];
  }
  return field;
}

/**
 * Splits what was drawn into symbols, left to right.
 *
 * Ink is projected onto the horizontal axis and cut at the blank columns, then
 * each stroke is assigned whole to the cut it sits in. Cutting the projection
 * rather than the strokes means a slanted "4" never loses its upright, and
 * assigning whole strokes means nothing is ever sliced down the middle.
 */
export function segment(strokes: Stroke[], width: number, height: number, thickness: number, gap = 6): Stroke[][] {
  const inked = strokes.filter((stroke) => stroke.length > 0);
  if (!inked.length) return [];
  const grid = rasterise(inked, width, height, thickness);

  const column = new Uint8Array(width);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (grid.data[y * width + x] > 0) { column[x] = 1; break; }
    }
  }

  const spans: { from: number; to: number }[] = [];
  let start = -1;
  let blank = 0;
  for (let x = 0; x < width; x += 1) {
    if (column[x]) {
      if (start < 0) start = x;
      blank = 0;
    } else if (start >= 0) {
      blank += 1;
      if (blank >= gap) { spans.push({ from: start, to: x - blank }); start = -1; blank = 0; }
    }
  }
  if (start >= 0) spans.push({ from: start, to: width - 1 });
  if (spans.length <= 1) return [inked];

  const groups: Stroke[][] = spans.map(() => []);
  for (const stroke of inked) {
    const centre = stroke.reduce((sum, point) => sum + point.x, 0) / stroke.length;
    let best = 0;
    let closest = Infinity;
    spans.forEach((span, index) => {
      const distance = centre < span.from ? span.from - centre : centre > span.to ? centre - span.to : 0;
      if (distance < closest) { closest = distance; best = index; }
    });
    groups[best].push(stroke);
  }
  return groups.filter((group) => group.length > 0);
}

/** One 28x28 field per symbol, ready for the model. */
export function fields(strokes: Stroke[], width: number, height: number, thickness: number): Float64Array[] {
  return segment(strokes, width, height, thickness).map((group) => normalise(rasterise(group, width, height, thickness)));
}
