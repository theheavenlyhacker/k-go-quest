import { describe, expect, it } from 'vitest';
import model from '../content/handwriting-model.json';
import { FIELD, normalise, rasterise, roundHalfEven, segment, tightCrop, type Grid } from './ink';
import { ACCURACY, CLASSES, MODEL_VERSION, OVERALL_ACCURACY, certainty, classify, read, spell } from './recognise';

const field = (values: number[]) => Float64Array.from(values);

describe('the ported forward pass', () => {
  /**
   * The test this whole feature rests on. The model file carries three inputs
   * and the probabilities NumPy produced for them; if the TypeScript port ever
   * disagrees, the tablet is quietly reading something different from what was
   * trained and measured.
   */
  it('matches NumPy on the probes stored with the weights', () => {
    expect(model.probe.input).toHaveLength(3);
    model.probe.input.forEach((input, index) => {
      const expected = model.probe.output[index];
      const actual = classify(field(input));
      expect(actual).toHaveLength(CLASSES.length);
      actual.forEach((value, cls) => expect(value).toBeCloseTo(expected[cls], 6));
    });
  });

  it('agrees with NumPy on which symbol each probe is', () => {
    const top = (values: number[]) => values.indexOf(Math.max(...values));
    model.probe.input.forEach((input, index) => {
      expect(top(classify(field(input)))).toBe(top(model.probe.output[index]));
    });
  });

  it('returns a distribution', () => {
    const probs = classify(field(model.probe.input[0]));
    expect(probs.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    expect(Math.min(...probs)).toBeGreaterThanOrEqual(0);
  });

  it('refuses a field that is not 28x28', () => {
    expect(() => classify(new Float64Array(10))).toThrow(/28x28/);
  });

  it('ships its measured accuracy rather than a claim', () => {
    expect(MODEL_VERSION).toBe('ink-cnn-v1');
    expect(CLASSES).toHaveLength(11);
    expect(OVERALL_ACCURACY).toBeGreaterThan(0.9);
    // The fraction bar is drawn, not collected, so it is the weakest class and
    // the screen says so. If that stops being true, the copy needs revisiting.
    const digits = CLASSES.filter((name) => name !== '/').map((name) => ACCURACY[name]);
    expect(ACCURACY['/']).toBeLessThan(Math.min(...digits));
  });
});

describe('reading several symbols', () => {
  it('spells what it read and reports its weakest link', () => {
    const readings = read([field(model.probe.input[0]), field(model.probe.input[1])]);
    expect(readings).toHaveLength(2);
    expect(spell(readings)).toHaveLength(2);
    expect(certainty(readings)).toBe(Math.min(readings[0].confidence, readings[1].confidence));
  });

  it('treats nothing written as no certainty', () => {
    expect(certainty([])).toBe(0);
    expect(spell([])).toBe('');
  });

  it('still answers for an empty field rather than throwing', () => {
    expect(read([new Float64Array(FIELD * FIELD)])).toHaveLength(1);
  });
});

describe('normalising ink', () => {
  const box = (width: number, height: number, x: number, y: number, w: number, h: number): Grid => {
    const grid: Grid = { width, height, data: new Float64Array(width * height) };
    for (let row = y; row < y + h; row += 1) for (let col = x; col < x + w; col += 1) grid.data[row * width + col] = 1;
    return grid;
  };

  const centre = (out: Float64Array) => {
    let total = 0;
    let massY = 0;
    let massX = 0;
    for (let row = 0; row < FIELD; row += 1) {
      for (let col = 0; col < FIELD; col += 1) {
        const value = out[row * FIELD + col];
        total += value;
        massY += value * row;
        massX += value * col;
      }
    }
    return [massY / total, massX / total];
  };

  it('puts the centre of mass in the middle of the field', () => {
    // Within a pixel: the symbol is placed on integer rows and columns, so a
    // half-pixel offset from dead centre is arithmetic, not drift.
    for (const [x, y] of [[0, 0], [30, 28], [11, 3]]) {
      const [cy, cx] = centre(normalise(box(48, 48, x, y, 8, 12)));
      expect(Math.abs(cy - 13.5)).toBeLessThanOrEqual(1);
      expect(Math.abs(cx - 13.5)).toBeLessThanOrEqual(1);
    }
  });

  it('makes size and position stop mattering', () => {
    const small = normalise(box(60, 60, 3, 2, 6, 12));
    const large = normalise(box(60, 60, 26, 20, 18, 36));
    let worst = 0;
    for (let i = 0; i < small.length; i += 1) worst = Math.max(worst, Math.abs(small[i] - large[i]));
    expect(worst).toBeLessThan(0.25);
  });

  it('returns an empty field for empty ink', () => {
    expect(Array.from(normalise(box(20, 20, 0, 0, 0, 0)))).toEqual(Array(FIELD * FIELD).fill(0));
  });

  it('rounds halves to even, the way Python does', () => {
    expect([1.5, 2.5, 2.4, 2.6].map(roundHalfEven)).toEqual([2, 2, 2, 3]);
    expect(roundHalfEven(0.5)).toBe(0);
  });

  it('crops to the ink', () => {
    const cropped = tightCrop(box(20, 20, 4, 6, 5, 3));
    expect([cropped.width, cropped.height]).toEqual([5, 3]);
  });
});

describe('splitting what was drawn into symbols', () => {
  const stroke = (x: number) => [{ x, y: 10 }, { x: x + 2, y: 40 }];

  it('cuts at the gaps between symbols', () => {
    expect(segment([stroke(10), stroke(60), stroke(110)], 160, 60, 2)).toHaveLength(3);
  });

  it('keeps strokes that belong to one symbol together', () => {
    // A "4" is two strokes a couple of pixels apart; it must stay one symbol.
    const groups = segment([stroke(10), [{ x: 6, y: 30 }, { x: 20, y: 30 }]], 160, 60, 2);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('never splits a single stroke across symbols', () => {
    expect(segment([stroke(10), stroke(70)], 160, 60, 2).flat()).toHaveLength(2);
  });

  it('returns nothing for nothing drawn', () => {
    expect(segment([], 160, 60, 2)).toEqual([]);
    expect(segment([[]], 160, 60, 2)).toEqual([]);
  });

  it('rasterises a stroke as connected ink, not dots', () => {
    const grid = rasterise([[{ x: 5, y: 5 }, { x: 50, y: 5 }]], 60, 20, 2);
    let inked = 0;
    for (let x = 5; x <= 50; x += 1) if (grid.data[5 * 60 + x] > 0) inked += 1;
    expect(inked).toBe(46);
  });
});
