import { describe, expect, it } from 'vitest';
import { Game, parseAction } from '../src/rules/index.ts';
import { NO_SELECTION, capturedPieces, click, highlights, outcomeText, threatenedRoyals, toggleCast } from '../src/play/interaction.ts';
import { sq } from './helpers.ts';

const game = (t: string): Game => {
  const r = Game.fromPosition(t);
  if (!r.ok) throw new Error('bad');
  return r.value;
};

describe('board interaction', () => {
  it('select, show engine-derived targets, then move', () => {
    const g = Game.initial();
    const s1 = click(g, NO_SELECTION, sq('d1'));
    expect(s1.selection.selected).toBe(sq('d1'));
    const hl = highlights(g, s1.selection);
    expect(hl.moves.sort()).toEqual([sq('c3'), sq('e3')].sort());
    expect(hl.canCast).toBe(true);
    const s2 = click(g, s1.selection, sq('c3'));
    expect(s2.action).toEqual(parseAction('d1-c3'));
  });

  it('clicking an illegal square deselects; clicking another own piece reselects; clicking enemy with nothing selected does nothing', () => {
    const g = Game.initial();
    const s = click(g, NO_SELECTION, sq('a1'));
    expect(click(g, s.selection, sq('a4')).selection).toEqual(NO_SELECTION);
    expect(click(g, s.selection, sq('b1')).selection.selected).toBe(sq('b1'));
    expect(click(g, NO_SELECTION, sq('a6'))).toEqual({ selection: NO_SELECTION });
  });

  it('Concord mode: partner click yields a canonical Concord; non-partner own piece gives a message', () => {
    const g = Game.initial();
    let sel = click(g, NO_SELECTION, sq('b2')).selection;
    sel = toggleCast(g, sel).selection;
    expect(sel.castMode).toBe(true);
    expect(highlights(g, sel).concord.sort((a, b) => a - b)).toEqual([sq('a1'), sq('b1'), sq('c1'), sq('a2'), sq('c2')].sort((a, b) => a - b));
    expect(highlights(g, sel).moves).toEqual([]);
    const r = click(g, sel, sq('a1'));
    expect(r.action).toEqual({ kind: 'concord', lo: sq('a1'), hi: sq('b2') });
    expect(click(g, sel, sq('f2')).message).toMatch(/touching/);
  });

  it('Concord unavailable without seals or partners', () => {
    const g = game('5a/6/6/6/6/A5 1 0-0 0 0');
    const sel = click(g, NO_SELECTION, sq('a1')).selection;
    expect(toggleCast(g, sel).message).toMatch(/No seals/);
    const g2 = game('5a/6/6/6/6/A5 1 2-2 0 0');
    expect(toggleCast(g2, click(g2, NO_SELECTION, sq('a1')).selection).message).toMatch(/no friendly neighbour/);
    expect(toggleCast(g2, NO_SELECTION).message).toMatch(/Select/);
  });

  it('threatened royal detection uses the engine', () => {
    expect(threatenedRoyals(game('5a/2w3/6/2A3/6/6 1 0-0 0 0'), 1)).toEqual([sq('c3')]);
    expect(threatenedRoyals(game('5a/1w4/6/2A3/6/6 1 0-0 0 0'), 1)).toEqual([]);
    expect(threatenedRoyals(Game.initial(), 1)).toEqual([]);
  });

  it('captured pieces and outcome text', () => {
    const b = Array.from(game('6/6/6/2a3/2A3/6 1 2-2 0 0').position().board);
    const c = capturedPieces(b);
    expect(c.byFirst.length).toBe(11); // second player lost everything but its Archwizard
    expect(c.bySecond.length).toBe(11);
    const won = Game.initial().play(parseAction('c2-c3'));
    expect(won.ok && outcomeText(won.value)).toBe('');
    const g = game('6/6/6/2a3/2A3/6 1 2-2 0 0').play(parseAction('c2xc3'));
    expect(g.ok && outcomeText(g.value)).toMatch(/Ember captured/);
  });
});
