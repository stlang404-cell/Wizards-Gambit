/**
 * Board interaction logic (DOM-free, unit-tested): turns clicks into
 * selections or engine actions, and derives highlights from the engine's own
 * legal-action list. No movement rule is re-implemented here.
 */
import { Game } from '../rules/game.ts';
import { concord, type Action } from '../rules/actions.ts';

export interface Selection {
  readonly selected: number | null;
  readonly castMode: boolean;
}
export const NO_SELECTION: Selection = { selected: null, castMode: false };

export interface Highlights {
  readonly moves: number[];
  readonly captures: number[];
  readonly concord: number[];
  readonly canCast: boolean;
}

export function highlights(game: Game, sel: Selection): Highlights {
  const out: Highlights = { moves: [], captures: [], concord: [], canCast: false };
  if (sel.selected === null || game.isOver) return out;
  const board = game.position().board;
  for (const a of game.legalActions()) {
    if (a.kind === 'move' && a.from === sel.selected) (board[a.to] ? out.captures : out.moves).push(a.to);
    if (a.kind === 'concord' && (a.lo === sel.selected || a.hi === sel.selected)) {
      out.concord.push(a.lo === sel.selected ? a.hi : a.lo);
    }
  }
  return { ...out, canCast: out.concord.length > 0, ...(sel.castMode ? { moves: [], captures: [] } : { concord: [] }) };
}

export interface ClickResult {
  readonly selection: Selection;
  readonly action?: Action;
  readonly message?: string;
}

/** Interprets a click on `sq` for the side to move. */
export function click(game: Game, sel: Selection, sq: number): ClickResult {
  if (game.isOver) return { selection: NO_SELECTION };
  const board = game.position().board;
  const own = board[sq]! * game.side > 0;
  if (sel.selected !== null && sel.castMode) {
    if (own && sq !== sel.selected) {
      const a = concord(sel.selected, sq);
      if (game.isLegal(a)) return { selection: NO_SELECTION, action: a };
      return { selection: sel, message: 'Concord partners must be your own pieces touching the selected piece.' };
    }
    return { selection: NO_SELECTION };
  }
  if (own) {
    if (sel.selected === sq) return { selection: NO_SELECTION };
    return { selection: { selected: sq, castMode: false } };
  }
  if (sel.selected !== null) {
    const a: Action = { kind: 'move', from: sel.selected, to: sq };
    if (game.isLegal(a)) return { selection: NO_SELECTION, action: a };
    return { selection: NO_SELECTION };
  }
  return { selection: NO_SELECTION };
}

/** Toggle Concord casting for the current selection. */
export function toggleCast(game: Game, sel: Selection): ClickResult {
  if (sel.selected === null) return { selection: sel, message: 'Select one of your pieces first.' };
  if (sel.castMode) return { selection: { ...sel, castMode: false } };
  if (!highlights(game, sel).canCast) {
    const seals = game.position().seals[game.side === 1 ? 0 : 1];
    return { selection: sel, message: seals ? 'This piece has no friendly neighbour to exchange with.' : 'No seals remain: Concord is spent.' };
  }
  return { selection: { ...sel, castMode: true } };
}

/**
 * Squares holding an Archwizard of `side` that the opponent could capture
 * immediately (by the engine's own move generation with the turn handed over).
 */
export function threatenedRoyals(game: Game, side: 1 | -1): number[] {
  if (game.isOver) return [];
  const p = game.position();
  const royal = p.board.indexOf(side);
  if (royal < 0) return [];
  const flipped = Game.fromPosition({ ...p, side: -side as 1 | -1 });
  if (!flipped.ok) return [];
  return flipped.value.legalActions().some((a) => a.kind === 'move' && a.to === royal) ? [royal] : [];
}

/** Pieces captured from each side relative to the standard army. */
export function capturedPieces(board: readonly number[]): { byFirst: number[]; bySecond: number[] } {
  const army = [0, 1, 2, 2, 1, 6];
  const byFirst: number[] = []; // second-player pieces captured by the first player
  const bySecond: number[] = [];
  for (let t = 1; t <= 5; t++) {
    const first = board.filter((v) => v === t).length;
    const second = board.filter((v) => v === -t).length;
    for (let i = first; i < army[t]!; i++) bySecond.push(t);
    for (let i = second; i < army[t]!; i++) byFirst.push(-t);
  }
  return { byFirst, bySecond };
}

/** Plain-language outcome text. */
export function outcomeText(game: Game): string {
  const o = game.outcome;
  if (!o) return '';
  const name = (s: number) => (s === 1 ? 'Ember' : 'Umbral');
  switch (o.reason) {
    case 'royal-capture': return `${name(o.winner)} captured the enemy Archwizard.`;
    case 'no-legal-actions': return `${name(-o.winner)} had no legal action.`;
    case 'repetition': return 'Draw: the same position occurred for the third time.';
    case 'quiet-limit': return 'Draw: 60 actions in a row without a capture.';
    case 'ply-cap': return 'Draw: the 180-action limit was reached.';
  }
}
