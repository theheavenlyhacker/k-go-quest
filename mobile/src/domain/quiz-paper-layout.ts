import QRCode from 'qrcode-svg';

/**
 * Shared layout geometry for printable Quiz Papers on standard A4.
 * Reused by scanner slices (#64) for fiducial localization and bubble sampling.
 */
export const QUIZ_PAPER_LAYOUT = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginLeftMm: 15,
  marginRightMm: 15,
  marginTopMm: 15,
  marginBottomMm: 15,
  fiducialSizeMm: 10,
  qrCodeSizeMm: 24,
  qrCodeXMm: 155,
  qrCodeYMm: 16,
  bubbleRadiusMm: 3.75, // 7.5mm diameter
  maxQuestions: 20,
  questionsPerColumn: 10,
  columns: 2,
  col1StartX: 26,
  col2StartX: 126,
  gridStartYMm: 65,
  rowPitchYMm: 17,
  optionOffsetsMm: [14, 26, 38, 50], // A, B, C, D offsets from colStartX
} as const;

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

export interface FiducialCoordinate {
  corner: 'TL' | 'TR' | 'BL' | 'BR';
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface QRCodeCoordinate {
  x: number;
  y: number;
  size: number;
  cx: number;
  cy: number;
}

export interface BubbleCoordinate {
  questionNumber: number; // 1 to 20
  optionIndex: number; // 0 to 3
  optionLabel: OptionLabel;
  cx: number;
  cy: number;
  radius: number;
  colIndex: number; // 0 or 1
  rowIndex: number; // 0 to 9
}

export interface QuestionLabelCoordinate {
  questionNumber: number;
  x: number;
  y: number;
}

/** Returns the 4 solid corner fiducials. */
export function getFiducials(): FiducialCoordinate[] {
  const {
    pageWidthMm,
    pageHeightMm,
    marginLeftMm,
    marginRightMm,
    marginTopMm,
    marginBottomMm,
    fiducialSizeMm,
  } = QUIZ_PAPER_LAYOUT;
  const half = fiducialSizeMm / 2;

  const tlX = marginLeftMm;
  const tlY = marginTopMm;
  const trX = pageWidthMm - marginRightMm - fiducialSizeMm;
  const trY = marginTopMm;
  const blX = marginLeftMm;
  const blY = pageHeightMm - marginBottomMm - fiducialSizeMm;
  const brX = trX;
  const brY = blY;

  return [
    { corner: 'TL', x: tlX, y: tlY, width: fiducialSizeMm, height: fiducialSizeMm, cx: tlX + half, cy: tlY + half },
    { corner: 'TR', x: trX, y: trY, width: fiducialSizeMm, height: fiducialSizeMm, cx: trX + half, cy: trY + half },
    { corner: 'BL', x: blX, y: blY, width: fiducialSizeMm, height: fiducialSizeMm, cx: blX + half, cy: blY + half },
    { corner: 'BR', x: brX, y: brY, width: fiducialSizeMm, height: fiducialSizeMm, cx: brX + half, cy: brY + half },
  ];
}

/** Returns the QR code bounding box in mm. */
export function getQRCodeCoordinate(): QRCodeCoordinate {
  const { qrCodeXMm, qrCodeYMm, qrCodeSizeMm } = QUIZ_PAPER_LAYOUT;
  return {
    x: qrCodeXMm,
    y: qrCodeYMm,
    size: qrCodeSizeMm,
    cx: qrCodeXMm + qrCodeSizeMm / 2,
    cy: qrCodeYMm + qrCodeSizeMm / 2,
  };
}

/** Check if a point/circle is strictly inside the printable margin boundary. */
export function isInsidePrintableArea(x: number, y: number, radius = 0): boolean {
  const { pageWidthMm, pageHeightMm, marginLeftMm, marginRightMm, marginTopMm, marginBottomMm } =
    QUIZ_PAPER_LAYOUT;
  return (
    x - radius >= marginLeftMm &&
    x + radius <= pageWidthMm - marginRightMm &&
    y - radius >= marginTopMm &&
    y + radius <= pageHeightMm - marginBottomMm
  );
}

/** Check if a point/circle overlaps any corner fiducials. */
export function doesCollideWithFiducials(x: number, y: number, radius = 0): boolean {
  for (const f of getFiducials()) {
    if (
      x + radius >= f.x &&
      x - radius <= f.x + f.width &&
      y + radius >= f.y &&
      y - radius <= f.y + f.height
    ) {
      return true;
    }
  }
  return false;
}

/** Returns the center coordinate for a specific bubble. */
export function getBubbleCoordinate(questionNumber: number, optionIndex: number): BubbleCoordinate {
  if (questionNumber < 1 || questionNumber > QUIZ_PAPER_LAYOUT.maxQuestions) {
    throw new Error(`Invalid questionNumber ${questionNumber}. Must be between 1 and ${QUIZ_PAPER_LAYOUT.maxQuestions}.`);
  }
  if (optionIndex < 0 || optionIndex > 3) {
    throw new Error(`Invalid optionIndex ${optionIndex}. Must be between 0 and 3.`);
  }

  const { questionsPerColumn, col1StartX, col2StartX, gridStartYMm, rowPitchYMm, optionOffsetsMm, bubbleRadiusMm } =
    QUIZ_PAPER_LAYOUT;

  const colIndex = questionNumber <= questionsPerColumn ? 0 : 1;
  const rowIndex = colIndex === 0 ? questionNumber - 1 : questionNumber - 1 - questionsPerColumn;

  const colStartX = colIndex === 0 ? col1StartX : col2StartX;
  const cx = colStartX + optionOffsetsMm[optionIndex]!;
  const cy = gridStartYMm + rowIndex * rowPitchYMm;

  return {
    questionNumber,
    optionIndex,
    optionLabel: OPTION_LABELS[optionIndex]!,
    cx,
    cy,
    radius: bubbleRadiusMm,
    colIndex,
    rowIndex,
  };
}

/** Returns coordinates of question label (e.g. "1.", "12."). */
export function getQuestionLabelCoordinate(questionNumber: number): QuestionLabelCoordinate {
  if (questionNumber < 1 || questionNumber > QUIZ_PAPER_LAYOUT.maxQuestions) {
    throw new Error(`Invalid questionNumber ${questionNumber}. Must be between 1 and ${QUIZ_PAPER_LAYOUT.maxQuestions}.`);
  }
  const { questionsPerColumn, col1StartX, col2StartX, gridStartYMm, rowPitchYMm } = QUIZ_PAPER_LAYOUT;
  const colIndex = questionNumber <= questionsPerColumn ? 0 : 1;
  const rowIndex = colIndex === 0 ? questionNumber - 1 : questionNumber - 1 - questionsPerColumn;
  const x = (colIndex === 0 ? col1StartX : col2StartX) + 2;
  const y = gridStartYMm + rowIndex * rowPitchYMm;
  return { questionNumber, x, y };
}

/** Returns all bubble coordinates for a given item count (1 to 20). */
export function getAllBubbleCoordinates(questionCount: number): BubbleCoordinate[] {
  const coords: BubbleCoordinate[] = [];
  for (let q = 1; q <= questionCount; q++) {
    for (let opt = 0; opt < 4; opt++) {
      coords.push(getBubbleCoordinate(q, opt));
    }
  }
  return coords;
}

/**
 * Pure-JS SVG QR code encoder.
 * Generates valid standalone SVG encoding { quizId, paperId }.
 */
export function generateQuizPaperQrSvg(
  payload: { quizId: string; paperId: string },
  sizeMm = QUIZ_PAPER_LAYOUT.qrCodeSizeMm,
): string {
  const content = JSON.stringify({ quizId: payload.quizId, paperId: payload.paperId });
  const qr = new QRCode({
    content,
    padding: 2,
    width: sizeMm,
    height: sizeMm,
    join: true,
    container: 'svg',
  });
  const svg = qr.svg();
  return svg
    .replace(/<\?xml.*?\?>/i, '')
    .replace(
      /<svg([^>]*)width="[^"]*"([^>]*)height="[^"]*"/i,
      `<svg$1width="${sizeMm}mm"$2height="${sizeMm}mm" viewBox="0 0 ${sizeMm} ${sizeMm}"`,
    )
    .trim();
}

export interface QuizPaperLearner {
  id?: string;
  paperId?: string;
  studentId: string;
  alias: string;
}

export interface QuizQuestionData {
  id: string;
  prompt: string;
  options: string[];
  skillCode?: string;
  correctOption?: number;
}

export interface QuizPdfParams {
  quizId: string;
  title: string;
  subject: string;
  learners: QuizPaperLearner[];
  questions: QuizQuestionData[];
  answerKey?: { exerciseId: string; correctOption: number }[];
}

/**
 * Generates self-contained HTML for expo-print.
 * Produces:
 * 1. One Quiz Paper bubble sheet per Learner with fiducials, alias, QR code, and fixed bubbles
 * 2. Separate Question Booklet page(s)
 * 3. Teacher Answer Key page
 */
export function generateQuizPdfHtml(params: QuizPdfParams): string {
  const { quizId, title, subject, learners, questions, answerKey } = params;
  const fiducials = getFiducials();
  const qrCoord = getQRCodeCoordinate();
  const questionCount = Math.min(questions.length, QUIZ_PAPER_LAYOUT.maxQuestions);

  // Pre-generate fiducials HTML
  const fiducialsHtml = fiducials
    .map(
      (f) =>
        `<div style="position:absolute; left:${f.x}mm; top:${f.y}mm; width:${f.width}mm; height:${f.height}mm; background:#000;"></div>`,
    )
    .join('\n');

  // Pre-generate answer grid HTML
  let gridHtml = '';
  // Vertical column divider
  gridHtml += `<div style="position:absolute; left:105mm; top:60mm; width:1px; height:170mm; background:#d1d5db;"></div>\n`;

  for (let q = 1; q <= questionCount; q++) {
    const label = getQuestionLabelCoordinate(q);
    gridHtml += `<div style="position:absolute; left:${label.x}mm; top:${label.y - 4}mm; width:8mm; height:8mm; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#374151;">${q}.</div>\n`;

    for (let opt = 0; opt < 4; opt++) {
      const b = getBubbleCoordinate(q, opt);
      const diameter = b.radius * 2;
      const left = b.cx - b.radius;
      const top = b.cy - b.radius;
      gridHtml += `<div style="position:absolute; left:${left}mm; top:${top}mm; width:${diameter}mm; height:${diameter}mm; border-radius:50%; border:1.8px solid #1f2937; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#1f2937; background:#fff;">${b.optionLabel}</div>\n`;
    }
  }

  // Generate learner sheets
  const learnerPagesHtml = learners
    .map((learner) => {
      const paperId = learner.paperId || learner.id || '';
      const qrSvg = generateQuizPaperQrSvg({ quizId, paperId });
      return `
      <section class="page">
        ${fiducialsHtml}
        <!-- Header -->
        <div style="position:absolute; left:30mm; top:16mm; width:120mm;">
          <div style="font-size:11px; font-weight:800; letter-spacing:1px; color:#4b5563; text-transform:uppercase;">K-Go Quests · Quiz Paper</div>
          <div style="font-size:18px; font-weight:800; color:#111827; margin-top:2px;">${escapeHtml(title)}</div>
          <div style="font-size:13px; color:#4b5563; margin-top:1px;">${escapeHtml(subject)} · ${questionCount} Questions</div>
          <div style="font-size:15px; font-weight:700; color:#1e3a8a; margin-top:6px; padding:3px 8px; background:#eff6ff; border-left:3px solid #3b82f6; display:inline-block;">Learner: ${escapeHtml(learner.alias)}</div>
        </div>

        <!-- QR Code -->
        <div style="position:absolute; left:${qrCoord.x}mm; top:${qrCoord.y}mm; width:${qrCoord.size}mm; height:${qrCoord.size}mm;">
          ${qrSvg}
        </div>

        <!-- Instructions banner -->
        <div style="position:absolute; left:26mm; top:49mm; width:158mm; padding:6px 12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px; font-size:10.5px; color:#374151;">
          <strong>Instructions:</strong> Use pencil or pen to completely shade the circle corresponding to your chosen answer (e.g. <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#1f2937; vertical-align:middle;"></span>). Make clean marks and do not fold or tear this paper.
        </div>

        <!-- Bubble Grid -->
        ${gridHtml}

        <!-- Footer -->
        <div style="position:absolute; left:30mm; top:252mm; width:150mm; text-align:center; font-size:9.5px; color:#6b7280;">
          K-Go Quests Assessment Paper · Server Paper ID: ${escapeHtml(paperId)}
        </div>
      </section>
      `;
    })
    .join('\n');

  // Generate Question Booklet page
  const questionItemsHtml = questions
    .slice(0, questionCount)
    .map((q, idx) => {
      const optionsHtml = q.options
        .map(
          (opt, oIdx) =>
            `<div style="font-size:11px; color:#374151;"><strong style="color:#111827;">${OPTION_LABELS[oIdx]})</strong> ${escapeHtml(opt)}</div>`,
        )
        .join('');
      return `
      <div style="margin-bottom:12mm; break-inside:avoid;">
        <div style="font-size:12.5px; font-weight:700; color:#111827; margin-bottom:2mm;">${idx + 1}. ${escapeHtml(q.prompt)}</div>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:2mm 4mm; margin-left:2mm;">
          ${optionsHtml}
        </div>
      </div>
      `;
    })
    .join('');

  const questionBookletPageHtml = `
  <section class="page" style="padding:18mm 20mm;">
    <div style="border-bottom:2px solid #111827; padding-bottom:4mm; margin-bottom:8mm;">
      <div style="font-size:12px; font-weight:800; letter-spacing:1px; color:#4b5563; text-transform:uppercase;">K-Go Quests · Question Sheet</div>
      <div style="font-size:22px; font-weight:800; color:#111827;">${escapeHtml(title)}</div>
      <div style="font-size:13px; color:#4b5563;">${escapeHtml(subject)} · Grade Exam · ${questionCount} Questions</div>
    </div>
    <div>
      ${questionItemsHtml}
    </div>
  </section>
  `;

  // Generate Teacher Answer Key page
  const keyMap = new Map<string, number>();
  if (answerKey) {
    for (const a of answerKey) keyMap.set(a.exerciseId, a.correctOption);
  } else {
    for (const q of questions) {
      if (typeof q.correctOption === 'number') keyMap.set(q.id, q.correctOption);
    }
  }

  const answerKeyRowsHtml = questions
    .slice(0, questionCount)
    .map((q, idx) => {
      const correct = keyMap.get(q.id);
      const letter = typeof correct === 'number' && correct >= 0 && correct < 4 ? OPTION_LABELS[correct] : '—';
      const text = typeof correct === 'number' && q.options[correct] ? q.options[correct] : '';
      return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 10px; font-weight:700; color:#111827;">${idx + 1}</td>
        <td style="padding:6px 10px; font-weight:800; font-size:13px; color:#065f46; background:#ecfdf5; text-align:center;">${letter}</td>
        <td style="padding:6px 10px; color:#374151;">${escapeHtml(text)}</td>
        <td style="padding:6px 10px; color:#6b7280; font-size:11px;">${escapeHtml(q.prompt)}</td>
      </tr>
      `;
    })
    .join('');

  const learnersRosterRowsHtml = learners
    .map(
      (l, idx) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:4px 8px; color:#6b7280; font-size:11px;">${idx + 1}</td>
        <td style="padding:4px 8px; font-weight:700; color:#111827; font-size:11.5px;">${escapeHtml(l.alias)}</td>
        <td style="padding:4px 8px; font-family:monospace; font-size:10.5px; color:#4b5563;">${escapeHtml(l.paperId || l.id || '')}</td>
      </tr>`,
    )
    .join('');

  const teacherKeyPageHtml = `
  <section class="page" style="padding:18mm 20mm;">
    <div style="border-bottom:2px solid #065f46; padding-bottom:4mm; margin-bottom:6mm;">
      <div style="font-size:11px; font-weight:800; letter-spacing:1px; color:#065f46; text-transform:uppercase;">Confidential · Teacher Only</div>
      <div style="font-size:22px; font-weight:800; color:#111827;">Answer Key: ${escapeHtml(title)}</div>
      <div style="font-size:12px; color:#4b5563;">${escapeHtml(subject)} · ${questionCount} Questions · ${learners.length} Enrolled Learners</div>
    </div>

    <div style="font-size:13px; font-weight:700; color:#111827; margin-bottom:2mm;">Correct Answers</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:6mm; font-size:12px;">
      <thead>
        <tr style="background:#f9fafb; border-bottom:1.5px solid #d1d5db; text-align:left;">
          <th style="padding:6px 10px; width:30px;">#</th>
          <th style="padding:6px 10px; width:45px; text-align:center;">Key</th>
          <th style="padding:6px 10px; width:180px;">Option</th>
          <th style="padding:6px 10px;">Question Prompt</th>
        </tr>
      </thead>
      <tbody>
        ${answerKeyRowsHtml}
      </tbody>
    </table>

    <div style="font-size:13px; font-weight:700; color:#111827; margin-bottom:2mm;">Classroom Learner Paper IDs</div>
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr style="background:#f9fafb; border-bottom:1.5px solid #d1d5db; text-align:left;">
          <th style="padding:4px 8px; width:30px;">#</th>
          <th style="padding:4px 8px; width:160px;">Learner Alias</th>
          <th style="padding:4px 8px;">Issued Paper ID</th>
        </tr>
      </thead>
      <tbody>
        ${learnersRosterRowsHtml}
      </tbody>
    </table>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Quiz Papers</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
      background: #fff;
    }
  </style>
</head>
<body>
${learnerPagesHtml}
${questionBookletPageHtml}
${teacherKeyPageHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
