import { describe, expect, it } from 'vitest';
import { readBubbleSheet } from './bubble-reader';
import { fixtureSheets, renderSheet } from './bubble-reader-fixtures';

describe('readBubbleSheet', () => {
  const sheets = fixtureSheets(24);

  it('reads >= 95% of items across 24 synthetic sheets; never guesses ambiguous items', () => {
    let right = 0, total = 0;
    for (const { answers, image } of sheets) {
      const reading = readBubbleSheet(image, answers.length)!;
      expect(reading).not.toBeNull();
      answers.forEach((a, i) => {
        total++;
        const expected = typeof a === 'number' ? a : null; // double/faint/blank must read as blank
        if (reading.answers[i] === expected) right++;
        if (a === 'double' || a === 'faint') {
          expect(reading.answers[i]).toBeNull();
          expect(reading.flagged[i]).toBe(true);
        }
        if (a === null) expect(reading.flagged[i]).toBe(false);
      });
    }
    expect(right / total).toBeGreaterThanOrEqual(0.95);
  });

  it('returns null when there are no fiducials', () => {
    const blank = { width: 300, height: 400, data: new Uint8ClampedArray(300 * 400).fill(230) };
    expect(readBubbleSheet(blank, 10)).toBeNull();
  });

  it('returns null for a sheet with one corner covered', () => {
    const img = renderSheet([0, 1, 2], 5);
    for (let y = 0; y < 150; y++) for (let x = 0; x < 150; x++) img.data[y * img.width + x] = 230;
    expect(readBubbleSheet(img, 3)).toBeNull();
  });

  it('reads one sheet well under 3s on this machine', () => {
    const t = Date.now();
    readBubbleSheet(sheets[0]!.image, sheets[0]!.answers.length);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
