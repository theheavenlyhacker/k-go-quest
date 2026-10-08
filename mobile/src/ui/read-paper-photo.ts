import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { readBubbleSheet, type BubbleReading } from '../domain/bubble-reader';

/**
 * Takes one still, reads the bubbles in JS and discards every copy of the photo.
 * Resolves null on any failure so the caller silently falls back to manual marking.
 */
export async function readPaperPhoto(camera: CameraView, questionCount: number): Promise<BubbleReading | null> {
  let uri: string | null = null;
  try {
    uri = (await camera.takePictureAsync({ quality: 0.6, shutterSound: false }))?.uri ?? null;
    if (!uri) return null;
    const small = await (await ImageManipulator.manipulate(uri).resize({ width: 720 }).renderAsync())
      .saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!small.base64) return null;
    const bin = atob(small.base64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const { width, height, data } = decode(bytes, { useTArray: true, formatAsRGBA: true });
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4]! * 77 + data[i * 4 + 1]! * 150 + data[i * 4 + 2]! * 29) >> 8;
    discard(small.uri);
    return readBubbleSheet({ width, height, data: gray }, questionCount);
  } catch {
    return null;
  } finally {
    if (uri) discard(uri);
  }
}

function discard(uri: string) {
  try { new File(uri).delete(); } catch { /* already gone */ }
}
