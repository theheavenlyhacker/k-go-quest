/**
 * RFC 4122 version 5 UUIDs, in plain TypeScript.
 *
 * Deliberately has no `node:crypto` import: this file is shared by the export
 * script and the drift test, and pulling Node types into the app's tsconfig for
 * the sake of two scripts would mean adding a dependency the lockfile does not
 * have.
 *
 * Correctness is pinned by the published test vectors in `uuid5.test.ts` rather
 * than assumed — a wrong hash here would silently re-identify every Exercise.
 */

/** FIPS 180-1. Operates on whole messages only; the inputs here are a few dozen bytes. */
export function sha1(message: Uint8Array): Uint8Array {
  const bits = message.length * 8;
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) << 6);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000), false);
  view.setUint32(padded.length - 4, bits >>> 0, false);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 80; i += 1) {
      const mixed = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (mixed << 1) | (mixed >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const next = (((a << 5) | (a >>> 27)) + (f >>> 0) + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const digest = new Uint8Array(20);
  const out = new DataView(digest.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => out.setUint32(i * 4, h, false));
  return digest;
}

/** UTF-8, written out rather than taken from TextEncoder so this file needs no platform globals. */
export function utf8(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) { code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00); i += 1; }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parse(uuid: string): Uint8Array {
  if (!HEX.test(uuid)) throw new Error(`${uuid} is not a UUID.`);
  const hex = uuid.replace(/-/g, '');
  return Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

function format(bytes: Uint8Array): string {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** SHA-1 of namespace + name, with the version and variant bits set. Same input, same output, on any machine, forever. */
export function uuid5(name: string, namespace: string): string {
  const ns = parse(namespace);
  const text = utf8(name);
  const input = new Uint8Array(ns.length + text.length);
  input.set(ns);
  input.set(text, ns.length);
  const bytes = sha1(input).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return format(bytes);
}
