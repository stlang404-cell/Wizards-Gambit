/**
 * Port of research/prototype/test_engine.py (12 methods) for the Ember Six
 * configuration. Mapping:
 *   test_capture_rules_do_not_change_hold -> Ember has no objective counters; repetition identity is board/side/seals only
 *   test_seals_distinguish_repetition     -> ported
 *   test_swap_atomic_and_nonrenewable     -> ported
 *   test_terminal_priority                -> ported
 *   test_hold_objective                   -> NOT APPLICABLE (Nexus Six only; not implemented)
 *   test_initial_symmetry                 -> ported (Ember only)
 *   test_walk_properties_replay_undo      -> ported (Ember; seeded walk with TS PRNG, 100 steps)
 *   test_draws                            -> ported
 *   test_spell_spends                     -> ported
 *   test_royal_capture                    -> ported
 *   test_ray_block                        -> ported
 *   test_blink_no_capture                 -> NOT APPLICABLE (Grand Eight only; not implemented)
 */
import { describe, expect, it } from 'vitest';
import { Game, internal } from '../src/rules/index.ts';
import { createPosition, initialPosition } from '../src/rules/position.ts';
import { rng } from './helpers.ts';

const { adjudicate, legalActionCodes, decodeAction, makeUnchecked, repetitionKey, positionDigest } = internal;

function boardWith(entries: Record<number, number>): number[] {
  const b = new Array<number>(36).fill(0);
  for (const [k, v] of Object.entries(entries)) b[Number(k)] = v;
  return b;
}

describe('ported prototype tests (Ember Six)', () => {
  it('repetition identity contains no objective counters (BUG-001 regression analogue)', () => {
    const p = createPosition(boardWith({ 14: 1, 35: -1 }), 1, [2, 2], 0, 0);
    makeUnchecked(p, 14 * 36 + 15);
    // identity = 36 board bytes + side + 2 seals; nothing else
    expect(repetitionKey(p).length).toBe(39);
  });

  it('seals distinguish repetition identity', () => {
    const s = initialPosition();
    const t = createPosition(s.board, 1, [1, 2], 0, 0);
    expect(repetitionKey(s)).not.toBe(repetitionKey(t));
  });

  it('Concord is atomic and nonrenewable', () => {
    const s = initialPosition();
    const code = legalActionCodes(s).find((c) => decodeAction(c).kind === 'concord')!;
    const a = decodeAction(code);
    if (a.kind !== 'concord') throw new Error('expected concord');
    const t = internal.clonePosition(s);
    makeUnchecked(t, code);
    expect([...t.board].sort()).toEqual([...s.board].sort());
    expect(t.board[a.lo]).toBe(s.board[a.hi]);
    const z = createPosition(s.board, 1, [0, 0], 0, 0);
    expect(legalActionCodes(z).every((c) => decodeAction(c).kind === 'move')).toBe(true);
  });

  it('terminal priority: royal capture beats repetition, quiet and ply cap', () => {
    const b = Array.from(initialPosition().board);
    b[b.indexOf(-1)] = 0;
    const s = createPosition(b, 1, [2, 2], 60, 180);
    expect(adjudicate(s, 3)).toEqual({ winner: 1, reason: 'royal-capture' });
  });

  it('initial position is 180-degree rotation with opposite sign; one Archwizard each', () => {
    const b = Array.from(initialPosition().board);
    expect(b).toEqual([...b].reverse().map((v) => (v === 0 ? 0 : -v)));
    expect(b.filter((v) => v === 1).length).toBe(1);
    expect(b.filter((v) => v === -1).length).toBe(1);
  });

  it('seeded 100-step walk: unique legal actions, occupancy, seals, replay digest, retained-parent undo', () => {
    let g = Game.initial();
    const root = g;
    const r = rng(42);
    const log = [];
    for (let i = 0; i < 100 && !g.isOver; i++) {
      const aa = g.legalActions();
      const codes = aa.map(internal.encodeAction);
      expect(new Set(codes).size).toBe(codes.length);
      const a = aa[Math.floor(r() * aa.length)]!;
      const before = g.position().board.filter((v) => v !== 0).length;
      const next = g.play(a);
      if (!next.ok) throw new Error(next.error.message);
      const after = next.value.position();
      expect([before, before - 1]).toContain(after.board.filter((v) => v !== 0).length);
      expect(after.side).toBe(-g.side);
      expect(after.seals.every((s) => s >= 0)).toBe(true);
      log.push(a);
      g = next.value;
    }
    let replay = root;
    for (const a of log) {
      const n = replay.play(a);
      if (!n.ok) throw new Error(n.error.message);
      replay = n.value;
    }
    expect(replay.digest()).toBe(g.digest());
    let back: Game = g;
    while (back.undo()) back = back.undo()!;
    expect(back).toBe(root);
    expect(back.digest()).toBe(root.digest());
  });

  it('draws: third occurrence and 60 quiet plies', () => {
    const s = initialPosition();
    expect(adjudicate(s, 3)).toEqual({ winner: 0, reason: 'repetition' });
    expect(adjudicate(createPosition(s.board, 1, [2, 2], 60, 60), 1)).toEqual({ winner: 0, reason: 'quiet-limit' });
  });

  it('every opening Concord spends exactly one first-player seal', () => {
    const s = initialPosition();
    for (const code of legalActionCodes(s)) {
      if (decodeAction(code).kind !== 'concord') continue;
      const t = internal.clonePosition(s);
      makeUnchecked(t, code);
      expect([t.seals[0], t.seals[1]]).toEqual([1, 2]);
    }
  });

  it('Archwizard capturing adjacent Archwizard wins immediately', () => {
    const s = createPosition(boardWith({ 0: 1, 1: -1 }), 1, [2, 2], 0, 0);
    expect(legalActionCodes(s)).toContain(0 * 36 + 1);
    makeUnchecked(s, 0 * 36 + 1);
    expect(adjudicate(s, 1)).toEqual({ winner: 1, reason: 'royal-capture' });
  });

  it('Warden ray is blocked by a friendly Familiar', () => {
    const s = createPosition(boardWith({ 0: 2, 1: 5, 35: 1, 34: -1 }), 1, [2, 2], 0, 0);
    expect(legalActionCodes(s)).not.toContain(0 * 36 + 2);
    expect(positionDigest(s)).toMatch(/^[0-9a-f]{64}$/);
  });
});
