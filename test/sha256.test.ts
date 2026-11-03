import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256, sha256Hex, toHex } from '../src/rules/sha256.ts';
import { rng } from './helpers.ts';

describe('sha256 (pure TS)', () => {
  it('matches FIPS 180-4 example vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('matches node:crypto on 300 seeded random inputs of length 0..299 (all padding boundaries)', () => {
    const r = rng(1);
    for (let len = 0; len < 300; len++) {
      const data = new Uint8Array(len);
      for (let i = 0; i < len; i++) data[i] = Math.floor(r() * 256);
      expect(toHex(sha256(data))).toBe(createHash('sha256').update(data).digest('hex'));
    }
  });
});
