import { internal, type Action } from '../src/rules/index.ts';
import type { Position } from '../src/rules/position.ts';

/** Deterministic test PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pos = (text: string): Position => internal.parsePositionUnchecked(text);
export const sq = (name: string): number => {
  const v = /^([a-f])([1-6])$/.exec(name);
  if (!v) throw new Error(`bad square ${name}`);
  return (Number(v[2]) - 1) * 6 + 'abcdef'.indexOf(v[1]!);
};
export const mv = (a: string, b: string): Action => ({ kind: 'move', from: sq(a), to: sq(b) });
export const cc = (a: string, b: string): Action => internal.concord(sq(a), sq(b));

/** Legal actions of a position as sorted notation strings (moves use '-'). */
export function legalStrings(p: Position): string[] {
  return internal.legalActionCodes(p).map((c) => {
    const a = internal.decodeAction(c);
    return internal.formatAction(a);
  }).sort();
}
