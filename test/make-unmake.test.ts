/**
 * Production incremental undo must prove equivalence with the research
 * prototype's retained-parent undo (research/10 blueprint). For seeded random
 * walks, at every position and for EVERY legal action:
 *   - make then unmake restores all bytes, counters and the Zobrist key
 *   - make produces the same canonical bytes as the immutable public path
 *   - the incremental Zobrist key equals a from-scratch recomputation
 */
import { describe, expect, it } from 'vitest';
import { Game, internal } from '../src/rules/index.ts';
import { createPosition } from '../src/rules/position.ts';
import { rng } from './helpers.ts';

const bytesHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('unchecked make/unmake', () => {
  it('restores exact bytes and keys for every action along 120 seeded games', () => {
    const r = rng(99);
    let checked = 0;
    for (let game = 0; game < 120; game++) {
      let g = Game.initial();
      while (!g.isOver) {
        const pd = g.position();
        const p = createPosition(pd.board, pd.side, pd.seals, pd.quietPly, pd.totalPly);
        const before = internal.clonePosition(p);
        const beforeBytes = bytesHex(internal.canonicalBytes(p));
        const actions = g.legalActions();
        for (const a of actions) {
          const u = internal.makeUnchecked(p, internal.encodeAction(a));
          const [lo, hi] = internal.computeKey(p);
          expect([p.keyLo, p.keyHi]).toEqual([lo, hi]);
          const viaPublic = g.play(a);
          if (!viaPublic.ok) throw new Error(viaPublic.error.message);
          expect(internal.positionDigest(p)).toBe(viaPublic.value.digest());
          internal.unmakeUnchecked(p, u);
          expect(internal.positionsEqual(p, before)).toBe(true);
          expect(bytesHex(internal.canonicalBytes(p))).toBe(beforeBytes);
          checked++;
        }
        const next = g.play(actions[Math.floor(r() * actions.length)]!);
        if (!next.ok) throw new Error(next.error.message);
        g = next.value;
      }
    }
    expect(checked).toBeGreaterThan(30000);
  });

  it('Zobrist key distinguishes side and seals and ignores counters', () => {
    const b = Array.from(internal.initialPosition().board);
    const k = (side: 1 | -1, s: [number, number], q = 0, t = 0) => {
      const p = createPosition(b, side, s, q, t);
      return `${p.keyLo}:${p.keyHi}`;
    };
    expect(k(1, [2, 2])).not.toBe(k(-1, [2, 2]));
    expect(k(1, [2, 2])).not.toBe(k(1, [1, 2]));
    expect(k(1, [1, 2])).not.toBe(k(1, [2, 1]));
    expect(k(1, [2, 2], 10, 20)).toBe(k(1, [2, 2]));
  });

  it('Zobrist table is stable (pinned initial key)', () => {
    const p = internal.initialPosition();
    // Pinned so a silent table change is noticed; update deliberately with a note if the seed changes.
    expect([p.keyLo, p.keyHi]).toEqual(internal.computeKey(p));
    expect(`${p.keyLo.toString(16)}:${p.keyHi.toString(16)}`).toBe('ad21e0ea:d6b781b0');
  });
});
