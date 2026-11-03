/**
 * Perft verification against two independent sources:
 *  (1) the Python research prototype (fixtures/perft_v0.1.json, research/results/perft.json)
 *  (2) test/reference/spec-rules.ts, a separate predicate-based generator
 *      written from the rules prose that shares no code with src/rules.
 * Set WG_SLOW=1 to also run the depth-4 reference comparison (~1.45M leaves).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game, internal } from '../src/rules/index.ts';
import { createPosition, initialPosition, type Position } from '../src/rules/position.ts';
import { refFromBoard, refInitial, refLegal, refPerft } from './reference/spec-rules.ts';
import { legalStrings, rng } from './helpers.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/perft_v0.1.json', import.meta.url), 'utf8')) as {
  start: Record<string, number>;
  startRoyalPruned: Record<string, number>;
  mid: { game: number; board: number[]; side: 1 | -1; seals: [number, number]; quiet: number; ply: number; perft: Record<string, number> }[];
};
const research = JSON.parse(readFileSync(new URL('../research/results/perft.json', import.meta.url), 'utf8')) as Record<string, Record<string, number>>;
const SLOW = process.env.WG_SLOW === '1';

describe('perft', () => {
  it('start position matches research/results/perft.json (depth 1-3) and the Python depth-4 oracle', () => {
    const p = initialPosition();
    const ember = research['Ember Six']!;
    for (const d of ['1', '2', '3']) expect(internal.perft(p, Number(d))).toBe(ember[d]);
    expect(internal.perft(p, 4)).toBe(fixture.start['4']);
    expect(fixture.start).toEqual({ '1': 34, '2': 1156, '3': 40936, '4': 1449035 });
  });

  it('start position depth 5 matches the Python oracle (raw; royal-pruned under WG_SLOW)', () => {
    const d5 = JSON.parse(readFileSync(new URL('../fixtures/perft_d5_python_v0.1.json', import.meta.url), 'utf8')) as { raw: number; royalPruned: number };
    expect(internal.perft(initialPosition(), 5)).toBe(d5.raw);
    if (SLOW) expect(internal.perftTerminal(initialPosition(), 5)).toBe(d5.royalPruned);
  });

  it('independent reference generator agrees at depth 1-3 from the start', () => {
    for (const d of [1, 2, 3]) expect(refPerft(refInitial(), d)).toBe(internal.perft(initialPosition(), d));
  });

  it.runIf(SLOW)('independent reference generator agrees at depth 4 from the start (slow)', () => {
    expect(refPerft(refInitial(), 4)).toBe(1449035);
  }, 600_000);

  it('mid-game positions from golden replays match Python and the reference (depth 1-3)', () => {
    expect(fixture.mid.length).toBeGreaterThanOrEqual(8);
    for (const m of fixture.mid) {
      const p = createPosition(m.board, m.side, m.seals, m.quiet, m.ply);
      for (const d of ['1', '2', '3']) {
        expect(internal.perft(p, Number(d))).toBe(m.perft[d]);
      }
      expect(refPerft(refFromBoard(m.board, m.side, m.seals), 2)).toBe(m.perft['2']);
    }
  });

  it('legal-action sets equal the reference along 300 seeded random games (every position visited)', () => {
    const r = rng(20261103);
    let positions = 0;
    for (let game = 0; game < 300; game++) {
      let g = Game.initial();
      while (!g.isOver) {
        const pd = g.position();
        const p = createPosition(pd.board, pd.side, pd.seals, pd.quietPly, pd.totalPly);
        expect(legalStrings(p)).toEqual(refLegal(refFromBoard(pd.board, pd.side, pd.seals)).sort());
        positions++;
        const aa = g.legalActions();
        const next = g.play(aa[Math.floor(r() * aa.length)]!);
        if (!next.ok) throw new Error(next.error.message);
        g = next.value;
      }
    }
    expect(positions).toBeGreaterThan(5000);
  });

  it('legal-action sets equal the reference on 2000 seeded random (valid) placements incl. zero seals', () => {
    const r = rng(7);
    const army = [1, 2, 2, 3, 3, 4, 5, 5, 5, 5, 5, 5];
    for (let n = 0; n < 2000; n++) {
      const board = new Array<number>(36).fill(0);
      const free = Array.from({ length: 36 }, (_, i) => i);
      for (const side of [1, -1]) {
        for (const t of army) {
          if (t !== 1 && r() < 0.4) continue; // random captures, royals always present
          const k = Math.floor(r() * free.length);
          board[free.splice(k, 1)[0]!] = t * side;
        }
      }
      const side = r() < 0.5 ? 1 : -1;
      const seals: [number, number] = [Math.floor(r() * 3), Math.floor(r() * 3)];
      const p: Position = createPosition(board, side, seals, 0, 0);
      expect(legalStrings(p)).toEqual(refLegal(refFromBoard(board, side, seals)).sort());
    }
  });

  it('terminal-aware perft matches the Python royal-pruned oracle from the start (depth 1-4)', () => {
    // Raw and pruned counts first differ at depth 4: a royal capture is possible on ply 3
    // (e.g. d1-c3, d6~d5 Concord moves the second Archwizard forward, c3xd5).
    const p = initialPosition();
    expect(fixture.startRoyalPruned).toEqual({ '1': 34, '2': 1156, '3': 40936, '4': 1448971 });
    for (const d of ['1', '2', '3', '4']) expect(internal.perftTerminal(p, Number(d))).toBe(fixture.startRoyalPruned[d]);
    expect(refPerft(refInitial(), 3, true)).toBe(40936);
  });

  it.runIf(SLOW)('independent reference royal-pruned perft agrees at depth 4 (slow)', () => {
    expect(refPerft(refInitial(), 4, true)).toBe(1448971);
  }, 600_000);

  it('royal capture is reachable on ply 3 (pinned line)', () => {
    let g = Game.initial();
    for (const t of ['d1-c3', 'd5~d6', 'c3xd5']) {
      const r = g.play(internal.parseAction(t));
      if (!r.ok) throw new Error(`${t}: ${r.error.message}`);
      g = r.value;
    }
    expect(g.outcome).toEqual({ winner: 1, reason: 'royal-capture' });
  });

  it('terminal-aware perft prunes children of a terminal node', () => {
    // A a1, enemy A b1, enemy F f6. After a1xb1 the game is over; raw perft still
    // expands the enemy Familiar's 2 moves, terminal-aware perft does not.
    const b = new Array<number>(36).fill(0);
    b[0] = 1; b[1] = -1; b[35] = -5;
    const p = createPosition(b, 1, [0, 0], 0, 0);
    expect(internal.perft(p, 1)).toBe(3);
    expect(internal.perft(p, 2) - internal.perftTerminal(p, 2)).toBe(2);
  });

  it('perftDivide sums to perft', () => {
    const p = initialPosition();
    const div = internal.perftDivide(p, 3);
    expect([...div.values()].reduce((a, b) => a + b, 0)).toBe(40936);
    expect(div.size).toBe(34);
  });
});
