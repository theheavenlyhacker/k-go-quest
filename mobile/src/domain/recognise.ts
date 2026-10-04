import model from '../content/handwriting-model.json';
import { FIELD } from './ink';

/**
 * The handwriting model, running on the tablet.
 *
 * A port of the forward pass in `ml/kgo_ink/model.py` — two convolutions, two
 * poolings and two dense layers, about 27,000 numbers in all. Plain arithmetic
 * over typed arrays: no native module, no server, nothing to download, which is
 * the only way it can work with the radio off.
 *
 * `recognise.test.ts` runs the fixed inputs stored in the model file and checks
 * the outputs against what NumPy produced, so the two implementations cannot
 * drift apart unnoticed.
 */
export const MODEL_VERSION: string = model.version;
export const CLASSES: readonly string[] = model.classes;
/** Held-out accuracy per class, measured on the weights actually shipped here. */
export const ACCURACY: Readonly<Record<string, number>> = model.accuracy;
export const OVERALL_ACCURACY: number = model.overall;

const CONV1 = model.shape.conv1[0];
const CONV2 = model.shape.conv2[0];
const HIDDEN = model.shape.hidden;

const w = model.weights;

function convolve(input: Float64Array, inChannels: number, size: number, kernels: number[], bias: number[], outChannels: number): Float64Array {
  const out = new Float64Array(outChannels * size * size);
  for (let oc = 0; oc < outChannels; oc += 1) {
    const outBase = oc * size * size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = bias[oc];
        for (let ic = 0; ic < inChannels; ic += 1) {
          const kernelBase = (oc * inChannels + ic) * 9;
          const inBase = ic * size * size;
          for (let ky = 0; ky < 3; ky += 1) {
            const sy = y + ky - 1;
            if (sy < 0 || sy >= size) continue;
            for (let kx = 0; kx < 3; kx += 1) {
              const sx = x + kx - 1;
              if (sx < 0 || sx >= size) continue;
              sum += input[inBase + sy * size + sx] * kernels[kernelBase + ky * 3 + kx];
            }
          }
        }
        // ReLU folded in: every convolution here is followed by one.
        out[outBase + y * size + x] = sum > 0 ? sum : 0;
      }
    }
  }
  return out;
}

function pool(input: Float64Array, channels: number, size: number): Float64Array {
  const half = size / 2;
  const out = new Float64Array(channels * half * half);
  for (let c = 0; c < channels; c += 1) {
    for (let y = 0; y < half; y += 1) {
      for (let x = 0; x < half; x += 1) {
        const base = c * size * size + y * 2 * size + x * 2;
        out[c * half * half + y * half + x] = Math.max(input[base], input[base + 1], input[base + size], input[base + size + 1]);
      }
    }
  }
  return out;
}

function dense(input: Float64Array, weights: number[], bias: number[], outputs: number, relu: boolean): Float64Array {
  const out = new Float64Array(outputs);
  for (let j = 0; j < outputs; j += 1) {
    let sum = bias[j];
    for (let i = 0; i < input.length; i += 1) sum += input[i] * weights[i * outputs + j];
    out[j] = relu && sum < 0 ? 0 : sum;
  }
  return out;
}

function softmax(logits: Float64Array): number[] {
  let peak = -Infinity;
  for (const value of logits) if (value > peak) peak = value;
  const exps = Array.from(logits, (value) => Math.exp(value - peak));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/** Probabilities over the eleven classes for one normalised 28x28 field. */
export function classify(field: Float64Array): number[] {
  if (field.length !== FIELD * FIELD) throw new Error(`A field must be ${FIELD}x${FIELD}.`);
  const a1 = pool(convolve(field, 1, 28, w.k1, w.b1, CONV1), CONV1, 28);
  const a2 = pool(convolve(a1, CONV1, 14, w.k2, w.b2, CONV2), CONV2, 14);
  return softmax(dense(dense(a2, w.w3, w.b3, HIDDEN, true), w.w4, w.b4, CLASSES.length, false));
}

export interface Reading { symbol: string; confidence: number }

/** The most likely symbol for each field, in the order they were written. */
export function read(fields: Float64Array[]): Reading[] {
  return fields.map((field) => {
    const probs = classify(field);
    let best = 0;
    for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
    return { symbol: CLASSES[best], confidence: probs[best] };
  });
}

/** What the readings spell, e.g. "3/4". */
export const spell = (readings: Reading[]): string => readings.map((reading) => reading.symbol).join('');

/**
 * How sure the model is of the whole answer: its least confident symbol.
 *
 * A chain is as weak as its weakest link, and one misread digit makes the whole
 * answer wrong — so the lowest confidence is the one worth showing a Learner.
 */
export const certainty = (readings: Reading[]): number =>
  readings.length ? readings.reduce((low, reading) => Math.min(low, reading.confidence), 1) : 0;
