import { getAllBubbleCoordinates, getFiducials, QUIZ_PAPER_LAYOUT } from './quiz-paper-layout';

export interface GrayImage { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export interface BubbleReading {
  /** Chosen option index per item, or null when blank/ambiguous. Never a guess. */
  answers: (number | null)[];
  /** True where the item was ambiguous or double-filled and the Teacher should look. */
  flagged: boolean[];
}

const FILLED = 0.6; // fraction of dark pixels in the bubble's inner disc
const FAINT = 0.38; // between FAINT and FILLED is ambiguous

function otsu(data: ArrayLike<number>): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 3) hist[data[i]!]!++; // ponytail: subsampled histogram
  let total = 0, sumAll = 0;
  hist.forEach((c, v) => { total += c; sumAll += c * v; });
  let wB = 0, sumB = 0, best = 0, t = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += v * hist[v]!;
    const between = wB * wF * (sumB / wB - (sumAll - sumB) / wF) ** 2;
    if (between > best) { best = between; t = v; }
  }
  return t;
}

/** Centroids of dark, solid, squarish blobs. */
function squareBlobs(dark: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h), stack: number[] = [], out: { cx: number; cy: number; area: number }[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!dark[s] || seen[s]) continue;
    let area = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!, x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !dark[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (area < 100 || bw / bh > 1.4 || bh / bw > 1.4 || area / (bw * bh) < 0.7) continue;
    out.push({ cx: sx / area, cy: sy / area, area });
  }
  return out;
}

/** Image px -> mm homography is the inverse; we need mm -> px, so solve src=mm, dst=px. */
function homography(src: [number, number][], dst: [number, number][]): number[] {
  const a: number[][] = [];
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    [a[c], a[p]] = [a[p]!, a[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r]![c]! / a[c]![c]!;
      for (let k = c; k < 9; k++) a[r]![k]! -= f * a[c]![k]!;
    }
  }
  return a.map((row, i) => row[8]! / row[i]!);
}

/**
 * Reads A-D bubble answers from a grayscale photo of a Quiz Paper.
 * Returns null when the four corner fiducials cannot be found, so the caller falls back to manual marking.
 */
export function readBubbleSheet(img: GrayImage, questionCount: number): BubbleReading | null {
  const { width: w, height: h, data } = img;
  const t = otsu(data);
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < dark.length; i++) dark[i] = data[i]! < t ? 1 : 0;

  const blobs = squareBlobs(dark, w, h);
  const maxArea = Math.max(0, ...blobs.map((b) => b.area));
  const c = blobs.filter((b) => b.area >= maxArea * 0.6);
  if (c.length < 4) return null;
  const pick = (score: (b: { cx: number; cy: number }) => number) => c.reduce((m, b) => (score(b) < score(m) ? b : m));
  const found = [pick((b) => b.cx + b.cy), pick((b) => -b.cx + b.cy), pick((b) => b.cx - b.cy), pick((b) => -b.cx - b.cy)]; // TL TR BL BR
  if (new Set(found).size < 4) return null;

  const fid = getFiducials();
  const m = homography(fid.map((f) => [f.cx, f.cy]), found.map((b) => [b.cx, b.cy]));
  const toPx = (x: number, y: number) => {
    const d = m[6]! * x + m[7]! * y + 1;
    return [Math.round((m[0]! * x + m[1]! * y + m[2]!) / d), Math.round((m[3]! * x + m[4]! * y + m[5]!) / d)] as const;
  };

  const inner = QUIZ_PAPER_LAYOUT.bubbleRadiusMm * 0.65, step = 0.3;
  const score = (cx: number, cy: number) => {
    let n = 0, hit = 0;
    for (let dy = -inner; dy <= inner; dy += step) for (let dx = -inner; dx <= inner; dx += step) {
      if (dx * dx + dy * dy > inner * inner) continue;
      const [px, py] = toPx(cx + dx, cy + dy);
      n++;
      if (px >= 0 && py >= 0 && px < w && py < h && dark[py * w + px]) hit++;
    }
    return hit / n;
  };

  const bubbles = getAllBubbleCoordinates(questionCount);
  const answers: (number | null)[] = [], flagged: boolean[] = [];
  for (let q = 0; q < questionCount; q++) {
    const s = bubbles.slice(q * 4, q * 4 + 4).map((b) => score(b.cx, b.cy));
    const strong = s.filter((v) => v >= FILLED).length, faint = s.filter((v) => v >= FAINT && v < FILLED).length;
    const clear = strong === 1 && faint === 0;
    answers.push(clear ? s.findIndex((v) => v >= FILLED) : null);
    flagged.push(!clear && strong + faint > 0);
  }
  return { answers, flagged };
}
