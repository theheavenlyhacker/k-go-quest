import { getAllBubbleCoordinates, getFiducials, QUIZ_PAPER_LAYOUT } from './quiz-paper-layout';
import type { GrayImage } from './bubble-reader';

/** Synthetic "photographed" Quiz Papers rendered from the print layout module. Test support only. */
export type FixtureAnswer = number | 'double' | 'faint' | null;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const PX_PER_MM = 3;

/** Solve the 3x3 homography taking 4 src points to 4 dst points. */
function homography(src: [number, number][], dst: [number, number][]) {
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

export function renderSheet(answers: FixtureAnswer[], seed: number): GrayImage {
  const rand = rng(seed);
  const { pageWidthMm: pw, pageHeightMm: ph } = QUIZ_PAPER_LAYOUT;
  const W = Math.round(pw * PX_PER_MM + 120), H = Math.round(ph * PX_PER_MM + 120);
  // page corner (mm) -> image px, with rotation, perspective skew and offset
  const ang = (rand() - 0.5) * 0.12, cs = Math.cos(ang), sn = Math.sin(ang);
  const jit = () => (rand() - 0.5) * 30;
  const corners: [number, number][] = [[0, 0], [pw, 0], [0, ph], [pw, ph]];
  const dst = corners.map(([x, y], i): [number, number] => {
    const cx = (x - pw / 2) * PX_PER_MM, cy = (y - ph / 2) * PX_PER_MM;
    return [W / 2 + cx * cs - cy * sn + (i % 2 ? -jit() : jit()), H / 2 + cx * sn + cy * cs + (i < 2 ? jit() : -jit())];
  });
  const h = homography(dst, corners); // image -> mm
  const fid = getFiducials();
  const bubbles = getAllBubbleCoordinates(answers.length);
  const light = 0.85 + rand() * 0.15, gradient = (rand() - 0.5) * 50;
  const data = new Uint8ClampedArray(W * H);
  const r0 = QUIZ_PAPER_LAYOUT.bubbleRadiusMm;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const d = h[6]! * px + h[7]! * py + 1;
    const x = (h[0]! * px + h[1]! * py + h[2]!) / d, y = (h[3]! * px + h[4]! * py + h[5]!) / d;
    let v = 235;
    if (x >= 0 && x <= pw && y >= 0 && y <= ph) {
      for (const f of fid) if (x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height) v = 25;
      if (y > 60) for (const b of bubbles) {
        const dx = x - b.cx, dy = y - b.cy;
        if (Math.abs(dx) > r0 + 0.1 || Math.abs(dy) > r0 + 0.1) continue;
        const dist = Math.hypot(dx, dy);
        if (dist <= r0 && dist > r0 - 0.5) v = 40;
        if (dist < r0 - 0.5 && Math.abs(dx) < 0.7 && Math.abs(dy) < 1.3) v = 60; // option letter
        const a = answers[b.questionNumber - 1];
        const fill = a === b.optionIndex || a === 'double' && b.optionIndex < 2 ? 0.93 : a === 'faint' && b.optionIndex === 1 ? 0.3 : 0;
        if (fill && dist < r0 - 0.4 && rand() < fill) v = 50;
      }
    } else v = 120 + 30 * Math.sin(px / 40);
    v = v * light + gradient * (px / W) + (rand() - 0.5) * 36;
    data[py * W + px] = v;
  }
  return { width: W, height: H, data };
}

/** 24 deterministic sheets with varied answers (incl. blanks, double fills, faint marks). */
export function fixtureSheets(count = 24) {
  return Array.from({ length: count }, (_, i) => {
    const r = rng(1000 + i);
    const n = 10 + (i % 11);
    const answers: FixtureAnswer[] = Array.from({ length: n }, () => {
      const t = r();
      return t < 0.08 ? null : t < 0.12 ? 'double' : t < 0.16 ? 'faint' : Math.floor(r() * 4);
    });
    return { answers, image: renderSheet(answers, 77 + i) };
  });
}
