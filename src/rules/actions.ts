import { SQUARE_COUNT, sideIndex, type PieceType } from './constants.ts';
import { CONCORD_PARTNERS, RAYS, chebyshev, isSquare, parseSquare, squareName } from './geometry.ts';
import { Z_PIECE, Z_SEALS, Z_SIDE, zPieceIndex, zSealIndex, type Position } from './position.ts';

/** Public action shapes. A Concord is canonical only when lo < hi. */
export interface MoveAction { readonly kind: 'move'; readonly from: number; readonly to: number }
export interface ConcordAction { readonly kind: 'concord'; readonly lo: number; readonly hi: number }
export type Action = MoveAction | ConcordAction;

// ------------------------------------------------------------ int encoding
// Internal compact code: move = from*36 + to  (0..1295)
//                        concord = 1296 + lo*36 + hi
// Same encoding is used by tools/gen_golden.py for cross-language fixtures.
export const CONCORD_BASE = SQUARE_COUNT * SQUARE_COUNT;
export type ActionCode = number;

export function encodeAction(a: Action): ActionCode {
  return a.kind === 'move' ? a.from * SQUARE_COUNT + a.to : CONCORD_BASE + a.lo * SQUARE_COUNT + a.hi;
}
export function decodeAction(code: ActionCode): Action {
  if (code >= CONCORD_BASE) {
    const c = code - CONCORD_BASE;
    return { kind: 'concord', lo: (c / SQUARE_COUNT) | 0, hi: c % SQUARE_COUNT };
  }
  return { kind: 'move', from: (code / SQUARE_COUNT) | 0, to: code % SQUARE_COUNT };
}

/** Structural check only (shape, integer squares, canonical concord). Not legality. */
export function isWellFormedAction(x: unknown): x is Action {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o.kind === 'move') {
    return isSquare(o.from) && isSquare(o.to) && o.from !== o.to && Object.keys(o).length === 3;
  }
  if (o.kind === 'concord') {
    return isSquare(o.lo) && isSquare(o.hi) && o.lo < o.hi && Object.keys(o).length === 3;
  }
  return false;
}

/** Build a canonical Concord from two squares in any click order. */
export function concord(a: number, b: number): ConcordAction {
  return a < b ? { kind: 'concord', lo: a, hi: b } : { kind: 'concord', lo: b, hi: a };
}
export function move(from: number, to: number): MoveAction {
  return { kind: 'move', from, to };
}

/** Text form: "d1-c3" (move), "c3xc4" (capture, needs position), "c3~d3" (Concord, lo first). */
export function formatAction(a: Action, board?: ArrayLike<number>): string {
  if (a.kind === 'concord') return `${squareName(a.lo)}~${squareName(a.hi)}`;
  const sep = board && board[a.to] !== 0 ? 'x' : '-';
  return `${squareName(a.from)}${sep}${squareName(a.to)}`;
}
/** Parses "a1-b2", "a1xb2" or "c3~d3"/"d3~c3" (Concord order is insignificant). */
export function parseAction(text: string): Action | null {
  const m = /^([a-f][1-6])([-x~])([a-f][1-6])$/.exec(text.trim());
  if (!m) return null;
  const a = parseSquare(m[1]!);
  const b = parseSquare(m[3]!);
  if (a === null || b === null || a === b) return null;
  return m[2] === '~' ? concord(a, b) : move(a, b);
}

// ------------------------------------------------------- legal generation

/**
 * Appends every legal action code for the side to move, in canonical order:
 * squares ascending; for each friendly piece, its moves in direction order,
 * then (if the side has a seal) Concords with friendly partners j > i ascending.
 * Does not check for terminal positions (callers adjudicate first).
 */
export function generateActions(p: Position, out: ActionCode[]): ActionCode[] {
  const b = p.board;
  const side = p.side;
  const canCast = p.seals[sideIndex(side)]! > 0;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = b[i]!;
    if (piece * side <= 0) continue;
    const rays = RAYS[(piece * side) as PieceType]![i]!;
    for (let r = 0; r < rays.length; r++) {
      const ray = rays[r]!;
      for (let k = 0; k < ray.length; k++) {
        const j = ray[k]!;
        const target = b[j]!;
        if (target * side > 0) break; // friendly blocker
        out.push(i * SQUARE_COUNT + j);
        if (target !== 0) break; // capture ends the ray
      }
    }
    if (canCast) {
      const partners = CONCORD_PARTNERS[i]!;
      for (let k = 0; k < partners.length; k++) {
        const j = partners[k]!;
        if (b[j]! * side > 0) out.push(CONCORD_BASE + i * SQUARE_COUNT + j);
      }
    }
  }
  return out;
}

export function legalActionCodes(p: Position): ActionCode[] {
  return generateActions(p, []);
}

/** True if the side to move has at least one legal action (early exit). */
export function hasLegalAction(p: Position): boolean {
  const b = p.board;
  const side = p.side;
  const canCast = p.seals[sideIndex(side)]! > 0;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = b[i]!;
    if (piece * side <= 0) continue;
    for (const ray of RAYS[(piece * side) as PieceType]![i]!) {
      if (b[ray[0]!]! * side <= 0) return true;
    }
    if (canCast) for (const j of CONCORD_PARTNERS[i]!) if (b[j]! * side > 0) return true;
  }
  return false;
}

/** Direct legality test for one well-formed action (no list generation). */
export function isLegalAction(p: Position, a: Action): boolean {
  const b = p.board;
  const side = p.side;
  if (a.kind === 'concord') {
    return p.seals[sideIndex(side)]! > 0 && b[a.lo]! * side > 0 && b[a.hi]! * side > 0 && chebyshev(a.lo, a.hi) === 1;
  }
  const piece = b[a.from]!;
  if (piece * side <= 0) return false;
  for (const ray of RAYS[(piece * side) as PieceType]![a.from]!) {
    for (const j of ray) {
      const target = b[j]!;
      if (target * side > 0) break;
      if (j === a.to) return true;
      if (target !== 0) break;
    }
  }
  return false;
}

// --------------------------------------------------- unchecked make/unmake

/** Everything needed to restore the parent exactly. */
export interface Undo {
  code: ActionCode;
  captured: number;
  quietPly: number;
  keyLo: number;
  keyHi: number;
}

function xorPiece(p: Position, piece: number, sq: number): void {
  const k = zPieceIndex(piece, sq);
  p.keyLo = (p.keyLo ^ Z_PIECE[k]!) >>> 0;
  p.keyHi = (p.keyHi ^ Z_PIECE[k + 1]!) >>> 0;
}

/**
 * INTERNAL, UNCHECKED: applies a legal action code in place and returns an
 * Undo record. Caller guarantees legality and a non-terminal position.
 * Not part of the public API — use Game.play for untrusted input.
 */
export function makeUnchecked(p: Position, code: ActionCode, undo?: Undo): Undo {
  const u: Undo = undo ?? { code: 0, captured: 0, quietPly: 0, keyLo: 0, keyHi: 0 };
  u.code = code;
  u.quietPly = p.quietPly;
  u.keyLo = p.keyLo;
  u.keyHi = p.keyHi;
  const b = p.board;
  if (code >= CONCORD_BASE) {
    const c = code - CONCORD_BASE;
    const lo = (c / SQUARE_COUNT) | 0;
    const hi = c % SQUARE_COUNT;
    const pl = b[lo]!;
    const ph = b[hi]!;
    xorPiece(p, pl, lo); xorPiece(p, ph, hi);
    b[lo] = ph; b[hi] = pl;
    xorPiece(p, ph, lo); xorPiece(p, pl, hi);
    const si = sideIndex(p.side);
    const before = p.seals[si]!;
    const ka = zSealIndex(p.side, before);
    const kb = zSealIndex(p.side, before - 1);
    p.keyLo = (p.keyLo ^ Z_SEALS[ka]! ^ Z_SEALS[kb]!) >>> 0;
    p.keyHi = (p.keyHi ^ Z_SEALS[ka + 1]! ^ Z_SEALS[kb + 1]!) >>> 0;
    p.seals[si] = before - 1;
    u.captured = 0;
    p.quietPly += 1; // Concord never captures; spells do not reset the quiet counter
  } else {
    const from = (code / SQUARE_COUNT) | 0;
    const to = code % SQUARE_COUNT;
    const mover = b[from]!;
    const captured = b[to]!;
    xorPiece(p, mover, from);
    if (captured !== 0) xorPiece(p, captured, to);
    xorPiece(p, mover, to);
    b[to] = mover;
    b[from] = 0;
    u.captured = captured;
    p.quietPly = captured !== 0 ? 0 : p.quietPly + 1;
  }
  p.totalPly += 1;
  p.side = p.side === 1 ? -1 : 1;
  p.keyLo = (p.keyLo ^ Z_SIDE[0]!) >>> 0;
  p.keyHi = (p.keyHi ^ Z_SIDE[1]!) >>> 0;
  return u;
}

/** INTERNAL, UNCHECKED: exact inverse of makeUnchecked. */
export function unmakeUnchecked(p: Position, u: Undo): void {
  p.side = p.side === 1 ? -1 : 1;
  p.totalPly -= 1;
  p.quietPly = u.quietPly;
  p.keyLo = u.keyLo;
  p.keyHi = u.keyHi;
  const b = p.board;
  const code = u.code;
  if (code >= CONCORD_BASE) {
    const c = code - CONCORD_BASE;
    const lo = (c / SQUARE_COUNT) | 0;
    const hi = c % SQUARE_COUNT;
    const t = b[lo]!;
    b[lo] = b[hi]!;
    b[hi] = t;
    p.seals[sideIndex(p.side)] = p.seals[sideIndex(p.side)]! + 1;
  } else {
    const from = (code / SQUARE_COUNT) | 0;
    const to = code % SQUARE_COUNT;
    b[from] = b[to]!;
    b[to] = u.captured;
  }
}
