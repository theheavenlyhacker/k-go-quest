import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import QRCode from 'qrcode-svg';
import {
  doesCollideWithFiducials,
  generateQuizPaperQrSvg,
  generateQuizPdfHtml,
  getAllBubbleCoordinates,
  getBubbleCoordinate,
  getFiducials,
  getQRCodeCoordinate,
  getQuestionLabelCoordinate,
  isInsidePrintableArea,
  OPTION_LABELS,
  QUIZ_PAPER_LAYOUT,
} from './quiz-paper-layout';

describe('quiz-paper-layout constants and fiducials', () => {
  it('defines standard A4 dimensions and margins', () => {
    expect(QUIZ_PAPER_LAYOUT.pageWidthMm).toBe(210);
    expect(QUIZ_PAPER_LAYOUT.pageHeightMm).toBe(297);
    expect(QUIZ_PAPER_LAYOUT.marginLeftMm).toBe(15);
    expect(QUIZ_PAPER_LAYOUT.marginRightMm).toBe(15);
    expect(QUIZ_PAPER_LAYOUT.marginTopMm).toBe(15);
    expect(QUIZ_PAPER_LAYOUT.marginBottomMm).toBe(15);
  });

  it('provides 4 solid corner fiducials inside the printable boundary', () => {
    const fiducials = getFiducials();
    expect(fiducials).toHaveLength(4);

    const corners = fiducials.map((f) => f.corner);
    expect(corners).toEqual(['TL', 'TR', 'BL', 'BR']);

    for (const f of fiducials) {
      expect(f.width).toBe(QUIZ_PAPER_LAYOUT.fiducialSizeMm);
      expect(f.height).toBe(QUIZ_PAPER_LAYOUT.fiducialSizeMm);
      expect(f.cx).toBe(f.x + f.width / 2);
      expect(f.cy).toBe(f.y + f.height / 2);
      expect(isInsidePrintableArea(f.cx, f.cy, f.width / 2)).toBe(true);
    }

    const [tl, tr, bl, br] = fiducials;
    expect(tl!.x).toBe(15);
    expect(tl!.y).toBe(15);
    expect(tr!.x).toBe(210 - 15 - 10);
    expect(tr!.y).toBe(15);
    expect(bl!.x).toBe(15);
    expect(bl!.y).toBe(297 - 15 - 10);
    expect(br!.x).toBe(210 - 15 - 10);
    expect(br!.y).toBe(297 - 15 - 10);
  });

  it('positions QR code in the header without colliding with fiducials', () => {
    const qr = getQRCodeCoordinate();
    expect(qr.size).toBe(QUIZ_PAPER_LAYOUT.qrCodeSizeMm);
    expect(isInsidePrintableArea(qr.cx, qr.cy, qr.size / 2)).toBe(true);
    expect(doesCollideWithFiducials(qr.cx, qr.cy, qr.size / 2)).toBe(false);

    // TR fiducial is at x = 185..195, QR code is at x = 155..179
    expect(qr.x + qr.size).toBeLessThan(185);
  });
});

describe('quiz-paper-layout bubble grid for 1 to 20 items', () => {
  it('keeps all bubble positions inside printable area for 1 to 20 items', () => {
    for (let q = 1; q <= 20; q++) {
      for (let opt = 0; opt < 4; opt++) {
        const bubble = getBubbleCoordinate(q, opt);
        expect(bubble.questionNumber).toBe(q);
        expect(bubble.optionIndex).toBe(opt);
        expect(bubble.optionLabel).toBe(OPTION_LABELS[opt]);
        expect(bubble.radius).toBe(QUIZ_PAPER_LAYOUT.bubbleRadiusMm);

        // Crucial requirement: inside printable boundary
        const inside = isInsidePrintableArea(bubble.cx, bubble.cy, bubble.radius);
        expect(inside).toBe(true);

        // Crucial requirement: no collision with corner fiducials
        const collidesFiducial = doesCollideWithFiducials(bubble.cx, bubble.cy, bubble.radius);
        expect(collidesFiducial).toBe(false);

        // Crucial requirement: no collision with QR code
        const qr = getQRCodeCoordinate();
        const overlapsQr =
          bubble.cx + bubble.radius >= qr.x &&
          bubble.cx - bubble.radius <= qr.x + qr.size &&
          bubble.cy + bubble.radius >= qr.y &&
          bubble.cy - bubble.radius <= qr.y + qr.size;
        expect(overlapsQr).toBe(false);
      }
    }
  });

  it('allocates 10 questions in column 1 and 10 questions in column 2', () => {
    for (let q = 1; q <= 10; q++) {
      const b = getBubbleCoordinate(q, 0);
      expect(b.colIndex).toBe(0);
      expect(b.rowIndex).toBe(q - 1);
    }
    for (let q = 11; q <= 20; q++) {
      const b = getBubbleCoordinate(q, 0);
      expect(b.colIndex).toBe(1);
      expect(b.rowIndex).toBe(q - 11);
    }
  });

  it('ensures bubble options A, B, C, D in each row do not overlap and are ordered left-to-right', () => {
    for (let q = 1; q <= 20; q++) {
      const a = getBubbleCoordinate(q, 0);
      const b = getBubbleCoordinate(q, 1);
      const c = getBubbleCoordinate(q, 2);
      const d = getBubbleCoordinate(q, 3);

      expect(a.cx + a.radius).toBeLessThan(b.cx - b.radius);
      expect(b.cx + b.radius).toBeLessThan(c.cx - c.radius);
      expect(c.cx + c.radius).toBeLessThan(d.cx - d.radius);

      expect(a.cy).toBe(b.cy);
      expect(b.cy).toBe(c.cy);
      expect(c.cy).toBe(d.cy);
    }
  });

  it('ensures question rows are vertically spaced without overlap', () => {
    for (let q = 1; q < 10; q++) {
      const curr = getBubbleCoordinate(q, 0);
      const next = getBubbleCoordinate(q + 1, 0);
      expect(curr.cy + curr.radius).toBeLessThan(next.cy - next.radius);
      expect(next.cy - curr.cy).toBe(QUIZ_PAPER_LAYOUT.rowPitchYMm);
    }
  });

  it('getAllBubbleCoordinates returns exactly 4 * questionCount items', () => {
    expect(getAllBubbleCoordinates(5)).toHaveLength(20);
    expect(getAllBubbleCoordinates(10)).toHaveLength(40);
    expect(getAllBubbleCoordinates(20)).toHaveLength(80);
  });

  it('question label coordinates match row heights and precede bubbles', () => {
    for (let q = 1; q <= 20; q++) {
      const label = getQuestionLabelCoordinate(q);
      const firstBubble = getBubbleCoordinate(q, 0);
      expect(label.y).toBe(firstBubble.cy);
      expect(label.x).toBeLessThan(firstBubble.cx);
    }
  });

  it('throws for out-of-range questions or options', () => {
    expect(() => getBubbleCoordinate(0, 0)).toThrow();
    expect(() => getBubbleCoordinate(21, 0)).toThrow();
    expect(() => getBubbleCoordinate(1, -1)).toThrow();
    expect(() => getBubbleCoordinate(1, 4)).toThrow();
    expect(() => getQuestionLabelCoordinate(0)).toThrow();
    expect(() => getQuestionLabelCoordinate(21)).toThrow();
  });
});

describe('QR code pure-JS SVG generation and scanning', () => {
  it('generates an SVG string encoding { quizId, paperId } and decodes with jsQR', () => {
    const payload = { quizId: 'quiz-uuid-1234', paperId: 'paper-uuid-5678' };
    const svg = generateQuizPaperQrSvg(payload);

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('<?xml');

    // Decode modules to prove phone-camera scannability
    const content = JSON.stringify(payload);
    const qrInstance = new QRCode({
      content,
      padding: 4,
      width: 200,
      height: 200,
    });
    const modules: boolean[][] = qrInstance.qrcode.modules;
    const modCount = modules.length;
    const scale = 4;
    const imgWidth = modCount * scale;
    const imgHeight = modCount * scale;
    const rawData = new Uint8ClampedArray(imgWidth * imgHeight * 4);

    for (let y = 0; y < imgHeight; y++) {
      for (let x = 0; x < imgWidth; x++) {
        const modY = Math.floor(y / scale);
        const modX = Math.floor(x / scale);
        const isDark = modules[modY]![modX]!;
        const idx = (y * imgWidth + x) * 4;
        const val = isDark ? 0 : 255;
        rawData[idx] = val;
        rawData[idx + 1] = val;
        rawData[idx + 2] = val;
        rawData[idx + 3] = 255;
      }
    }

    const decoded = jsQR(rawData, imgWidth, imgHeight);
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(JSON.stringify(payload));

    const parsed = JSON.parse(decoded!.data);
    expect(parsed).toEqual(payload);
    // Crucial requirement: QR code holds no alias and no answers
    expect(parsed.alias).toBeUndefined();
    expect(parsed.answers).toBeUndefined();
  });
});

describe('generateQuizPdfHtml', () => {
  const learners = Array.from({ length: 30 }, (_, i) => ({
    paperId: `paper-id-${i + 1}`,
    studentId: `student-id-${i + 1}`,
    alias: `Learner Alias ${i + 1}`,
  }));

  const questions = Array.from({ length: 10 }, (_, i) => ({
    id: `exercise-${i + 1}`,
    prompt: `Question prompt ${i + 1}?`,
    options: ['Option A text', 'Option B text', 'Option C text', 'Option D text'],
    skillCode: 'math5.fractions',
    correctOption: i % 4,
  }));

  const answerKey = questions.map((q) => ({ exerciseId: q.id, correctOption: q.correctOption! }));

  it('generates HTML with 30 learner sheets + 1 question booklet + 1 teacher answer key', () => {
    const html = generateQuizPdfHtml({
      quizId: 'quiz-uuid-999',
      title: 'Math Quarter 1 Quiz',
      subject: 'MATH',
      learners,
      questions,
      answerKey,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Math Quarter 1 Quiz');

    // Page count: 30 learner pages + 1 booklet + 1 answer key = 32 pages
    const pageMatches = html.match(/<section class="page"/g);
    expect(pageMatches).toHaveLength(32);

    // Each learner has their alias heading, never legal name
    for (const l of learners) {
      expect(html).toContain(`Learner: ${l.alias}`);
      expect(html).toContain(l.paperId);
    }

    // Question Booklet content
    expect(html).toContain('K-Go Quests · Question Sheet');
    expect(html).toContain('Question prompt 1?');
    expect(html).toContain('Option A text');

    // Teacher Answer Key content
    expect(html).toContain('Answer Key: Math Quarter 1 Quiz');
    expect(html).toContain('Confidential · Teacher Only');
  });
});
