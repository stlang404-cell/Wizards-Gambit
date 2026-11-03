import {
  BOARD_SIZE, INITIAL_SEALS, SQUARE_COUNT, sideIndex, type Side,
} from './constants.ts';

/**
 * Internal mutable position. Rules-core functions that take a Position assume
 * it already passed validation (see validate.ts); they do not re-check.
 *
 * keyLo/keyHi hold a 64-bit Zobrist key (two uint32 halves) over board, side
 * and seals — the same fields as the repetition identity. Counters are not
 * part of it. It is maintained incrementally by make/unmake.
 */
export interface Position {
  readonly board: Int8Array; // length 36, index = rank*6 + file
  side: Side;
  readonly seals: Uint8Array; // [first, second]
  quietPly: number;
  totalPly: number;
  keyLo: number;
  keyHi: number;
}

/** First player's rank 1 (a..f): W H A S H W; rank 2: six Familiars. */
const BACK_ROW = [2, 3, 1, 4, 3, 2];

export function initialBoard(): Int8Array {
  const b = new Int8Array(SQUARE_COUNT);
  for (let x = 0; x < BOARD_SIZE; x++) {
    b[x] = BACK_ROW[x]!;
    b[BOARD_SIZE + x] = 5;
  }
  // Second army is the 180-degree rotation with opposite sign.
  for (let i = 0; i < 2 * BOARD_SIZE; i++) b[SQUARE_COUNT - 1 - i] = -b[i]!;
  return b;
}

export function createPosition(
  board: ArrayLike<number>, side: Side, seals: readonly [number, number], quietPly: number, totalPly: number,
): Position {
  const pos: Position = {
    board: Int8Array.from(board), side, seals: Uint8Array.from(seals), quietPly, totalPly, keyLo: 0, keyHi: 0,
  };
  refreshKey(pos);
  return pos;
}

export function initialPosition(): Position {
  return createPosition(initialBoard(), 1, [INITIAL_SEALS, INITIAL_SEALS], 0, 0);
}

export function clonePosition(p: Position): Position {
  return {
    board: p.board.slice(), side: p.side, seals: p.seals.slice(),
    quietPly: p.quietPly, totalPly: p.totalPly, keyLo: p.keyLo, keyHi: p.keyHi,
  };
}

/** Byte-level equality of every field, including the Zobrist key. */
export function positionsEqual(a: Position, b: Position): boolean {
  if (a.side !== b.side || a.quietPly !== b.quietPly || a.totalPly !== b.totalPly) return false;
  if (a.keyLo !== b.keyLo || a.keyHi !== b.keyHi) return false;
  if (a.seals[0] !== b.seals[0] || a.seals[1] !== b.seals[1]) return false;
  for (let i = 0; i < SQUARE_COUNT; i++) if (a.board[i] !== b.board[i]) return false;
  return true;
}

// ---------------------------------------------------------------- Zobrist
// Deterministic table from a fixed-seed splitmix32 so keys are stable across
// runs, machines and builds. Changing the seed changes every key (not rules).

const ZOBRIST_SEED = 0x57475a31; // "WGZ1"
const MAX_SEALS_KEYED = 8; // validated positions never exceed INITIAL_SEALS

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** Piece keys at index ((piece + 5) * 36 + sq) * 2 (+0 lo, +1 hi). piece 0 unused. */
export const Z_PIECE = new Uint32Array(11 * SQUARE_COUNT * 2);
/** Seal keys at index ((sideIdx * (MAX+1)) + count) * 2. */
export const Z_SEALS = new Uint32Array(2 * (MAX_SEALS_KEYED + 1) * 2);
export const Z_SIDE = new Uint32Array(2); // xored in when second player to move
{
  const rnd = splitmix32(ZOBRIST_SEED);
  for (let i = 0; i < Z_PIECE.length; i++) Z_PIECE[i] = rnd();
  for (let i = 0; i < Z_SEALS.length; i++) Z_SEALS[i] = rnd();
  Z_SIDE[0] = rnd();
  Z_SIDE[1] = rnd();
}
export function zPieceIndex(piece: number, sq: number): number {
  return ((piece + 5) * SQUARE_COUNT + sq) * 2;
}
export function zSealIndex(side: Side, count: number): number {
  return (sideIndex(side) * (MAX_SEALS_KEYED + 1) + count) * 2;
}

/** Recompute the Zobrist key from scratch (reference for the incremental one). */
export function computeKey(p: Position): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let sq = 0; sq < SQUARE_COUNT; sq++) {
    const piece = p.board[sq]!;
    if (piece !== 0) {
      const k = zPieceIndex(piece, sq);
      lo ^= Z_PIECE[k]!;
      hi ^= Z_PIECE[k + 1]!;
    }
  }
  const s0 = zSealIndex(1, p.seals[0]!);
  const s1 = zSealIndex(-1, p.seals[1]!);
  lo ^= Z_SEALS[s0]! ^ Z_SEALS[s1]!;
  hi ^= Z_SEALS[s0 + 1]! ^ Z_SEALS[s1 + 1]!;
  if (p.side === -1) {
    lo ^= Z_SIDE[0]!;
    hi ^= Z_SIDE[1]!;
  }
  return [lo >>> 0, hi >>> 0];
}

export function refreshKey(p: Position): void {
  const [lo, hi] = computeKey(p);
  p.keyLo = lo;
  p.keyHi = hi;
}
