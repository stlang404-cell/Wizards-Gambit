import { describe, expect, it } from 'vitest';
import { Game, internal, parseAction, type Action } from '../src/rules/index.ts';
import { LEVELS, MATE, moveSeed, think, type LevelId } from '../src/ai/search.ts';
import { evaluate } from '../src/ai/evaluate.ts';
import { createPosition } from '../src/rules/position.ts';
import { rng } from './helpers.ts';

const ALL: LevelId[] = ['novice', 'adept', 'magister'];
const FAST: LevelId[] = ['novice', 'adept'];
const game = (t: string): Game => {
  const r = Game.fromPosition(t);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const text = (g: Game, a: Action): string => internal.formatAction(a, g.position().board);
const scoreOf = (g: Game, lv: LevelId, notation: string): number | undefined => {
  const code = internal.encodeAction(parseAction(notation)!);
  return think(g, lv, 1).rootScores.find((s) => s.code === code)?.score;
};
function play(g: Game, ...moves: string[]): Game {
  for (const m of moves) {
    const r = g.play(parseAction(m));
    if (!r.ok) throw new Error(`${m}: ${r.error.message}`);
    g = r.value;
  }
  return g;
}

describe('baseline AI: tactics', () => {
  it.each(ALL)('%s takes an immediate royal capture', (lv) => {
    // first W a1 can capture the enemy A on a3; a juicier enemy Warden sits on b1
    const g = game('5a/6/6/a5/6/Ww3A 1 2-2 0 10'.replace('5a', '6'));
    const r = think(g, lv, 7);
    expect(text(g, r.action)).toBe('a1xa3');
    expect(r.score).toBeGreaterThan(MATE - 10);
  });

  it.each(ALL)('%s avoids an immediate royal loss when an escape exists', (lv) => {
    // first A on c3 attacked by enemy W on c5 (c4 empty); stepping aside saves it
    const g = game('5a/2w3/6/2A3/6/6 1 0-0 0 10');
    const r = think(g, lv, 3);
    const next = g.play(r.action);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    // no enemy reply captures the Archwizard
    for (const reply of next.value.legalActions()) {
      const after = next.value.play(reply);
      expect(after.ok && after.value.outcome?.reason === 'royal-capture').toBe(false);
    }
  });

  it('always returns a legal action on 200 seeded random positions (novice/adept) and 20 (magister)', () => {
    const r = rng(5);
    for (let n = 0; n < 220; n++) {
      let g = Game.initial();
      const plies = Math.floor(r() * 30);
      for (let i = 0; i < plies && !g.isOver; i++) {
        const l = g.legalActions();
        const nx = g.play(l[Math.floor(r() * l.length)]!);
        if (nx.ok) g = nx.value;
      }
      if (g.isOver) continue;
      const lv: LevelId = n < 20 ? 'magister' : n % 2 ? 'novice' : 'adept';
      expect(g.isLegal(think(g, lv, n).action)).toBe(true);
    }
  });

  it('refuses to think on a finished game', () => {
    expect(() => think(game('6/6/6/6/6/A5 2 0-0 0 31'), 'adept', 1)).toThrow();
  });

  it.each(FAST)('%s is deterministic for (history, level, seed)', (lv) => {
    const g = play(Game.initial(), 'c2-c3', 'd5-d4');
    const a = think(g, lv, 99);
    const b = think(g, lv, 99);
    expect(a.code).toBe(b.code);
    expect(a.nodes).toBe(b.nodes);
  });

  it('evaluation is antisymmetric under the 180-degree color swap', () => {
    const r = rng(11);
    for (let n = 0; n < 200; n++) {
      let g = Game.initial();
      for (let i = 0; i < 20 && !g.isOver; i++) {
        const l = g.legalActions();
        const nx = g.play(l[Math.floor(r() * l.length)]!);
        if (nx.ok) g = nx.value;
      }
      if (g.isOver) continue;
      const p = g.position();
      const mirrored = createPosition([...p.board].reverse().map((v) => (v === 0 ? 0 : -v)), p.side === 1 ? -1 : 1, [p.seals[1], p.seals[0]], p.quietPly, p.totalPly);
      const orig = createPosition(p.board, p.side, p.seals, p.quietPly, p.totalPly);
      expect(evaluate(mirrored)).toBe(evaluate(orig));
    }
  });
});

describe('baseline AI: Concord study positions', () => {
  // A a1 attacked through a2 by enemy W a3; b2 covered by enemy H d4; friendly F b1.
  const ESCAPE = '5a/6/3h2/w5/6/AF4 1 1-0 0 10';

  it.each(ALL)('beneficial: %s finds the only saving Concord (a1~b1)', (lv) => {
    const g = game(ESCAPE);
    const r = think(g, lv, 1);
    expect(text(g, r.action)).toBe('a1~b1');
    expect(Math.abs(r.score)).toBeLessThan(MATE - 1000);
    // every ordinary move loses the Archwizard
    for (const s of r.rootScores) if (s.code !== r.code) expect(s.score).toBeLessThan(-(MATE - 10));
  });

  it.each(ALL)('same position without a seal is lost for %s (the seal is decisive)', (lv) => {
    const r = think(game(ESCAPE.replace('1-0', '0-0')), lv, 1);
    expect(r.score).toBeLessThan(-(MATE - 10));
  });

  it.each(ALL)('harmful: %s does not swap its Archwizard onto an attacked square (a1~b2)', (lv) => {
    const g = game('5a/6/3h2/6/1F4/A5 1 2-0 0 10');
    const r = think(g, lv, 1);
    expect(text(g, r.action)).not.toBe('a1~b2');
    expect(scoreOf(g, lv, 'a1~b2')!).toBeLessThan(-(MATE - 10));
  });

  it.each(FAST)('neutral-but-costly: %s does not spend a seal on an identical-type swap in a quiet opening', (lv) => {
    const g = Game.initial();
    const r = think(g, lv, 1);
    expect(r.action.kind).toBe('move');
    expect(scoreOf(g, lv, 'a2~b2')!).toBeLessThan(r.score);
  });
});

describe('baseline AI: draw awareness', () => {
  // first player is a Warden up; shuffle Archwizards until the start position has occurred twice
  const START = '5a/6/6/6/6/A4W 1 0-0 0 0';
  const cycled = (): Game => play(game(START), 'a1-b1', 'f6-e6', 'b1-a1', 'e6-f6', 'a1-b1', 'f6-e6', 'b1-a1');
  it('the move that would complete a threefold repetition scores exactly 0 for the second player', () => {
    const g = cycled(); // second player to move; e6-f6 recreates the start position a third time
    expect(g.side).toBe(-1);
    expect(scoreOf(g, 'adept', 'e6-f6')).toBe(0);
  });

  it.each(FAST)('%s (down a Warden) claims the repetition draw', (lv) => {
    const g = cycled();
    expect(text(g, think(g, lv, 1).action)).toBe('e6-f6');
  });

  it('without the history the same move is not a draw', () => {
    const g = game('5a/6/6/6/6/A4W 2 0-0 0 7'.replace('5a/6', '4a1/6'));
    expect(scoreOf(g, 'adept', 'e6-f6')).not.toBe(0);
  });

  it('quiet-limit and ply-cap draws are scored inside the tree', () => {
    // second player down a Warden; any move reaches 60 quiet plies -> draw (score 0 for every root move)
    const g = game('4a1/6/6/6/6/A4W 2 0-0 59 101');
    const r = think(g, 'adept', 1);
    expect(r.rootScores.every((s) => s.score === 0)).toBe(true);
    const cap = think(game('4a1/6/6/6/6/A4W 2 0-0 0 179'), 'adept', 1);
    expect(cap.rootScores.every((s) => s.score === 0)).toBe(true);
  });
});

describe('levels', () => {
  it('level table is stable and ordered by search effort', () => {
    expect(LEVELS.novice.maxDepth).toBeLessThan(LEVELS.adept.maxDepth);
    expect(LEVELS.adept.maxDepth).toBeLessThan(LEVELS.magister.maxDepth);
    expect(moveSeed(1, 0)).toBe(moveSeed(1, 0));
    expect(moveSeed(1, 0)).not.toBe(moveSeed(1, 1));
  });
});
