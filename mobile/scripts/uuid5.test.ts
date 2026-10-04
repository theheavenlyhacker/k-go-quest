import { describe, expect, it } from 'vitest';
import { sha1, utf8, uuid5 } from './uuid5';

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Published vectors. These are the reason this hand-written hash can be trusted with the Exercise ids. */
describe('sha1', () => {
  it('matches the FIPS 180-1 vectors', () => {
    expect(hex(sha1(utf8('')))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1(utf8('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(hex(sha1(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))))
      .toBe('84983e441c3bd26ebaae4aa1f95129e5e54670f1');
  });
  it('handles a message that lands exactly on a block boundary', () => {
    // 55, 56 and 64 bytes are where padding implementations usually break.
    expect(hex(sha1(utf8('a'.repeat(55))))).toBe('c1c8bbdc22796e28c0e15163d20899b65621d65a');
    expect(hex(sha1(utf8('a'.repeat(56))))).toBe('c2db330f6083854c99d4b5bfb6e8f29f201be699');
    expect(hex(sha1(utf8('a'.repeat(64))))).toBe('0098ba824b5c16427bd7a1122a5a442a25ec644d');
  });
});

describe('utf8', () => {
  it('encodes beyond ASCII, including an astral character', () => {
    expect([...utf8('ñ')]).toEqual([0xc3, 0xb1]);
    expect([...utf8('日')]).toEqual([0xe6, 0x97, 0xa5]);
    expect([...utf8('\u{1F600}')]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });
});

describe('uuid5', () => {
  const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  it('matches the published DNS-namespace vector', () => {
    expect(uuid5('www.example.com', DNS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
  it('sets the version and variant bits', () => {
    const id = uuid5('anything', DNS);
    expect(id[14]).toBe('5');
    expect('89ab').toContain(id[19]);
  });
  it('is stable and distinct', () => {
    expect(uuid5('a', DNS)).toBe(uuid5('a', DNS));
    expect(uuid5('a', DNS)).not.toBe(uuid5('b', DNS));
  });
});
