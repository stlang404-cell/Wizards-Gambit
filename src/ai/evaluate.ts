/**
 * Static evaluation for the M1 baseline AI. Integer centi-units, from the
 * perspective of the side to move. Weights are hand-set seeds (research/04:
 * W=5 H=4 S=3 F=1), not tuned or measured exchange values.
 */
import { SQUARE_COUNT, type PieceType, type Side } from '../rules/constants.ts';
import { RAYS, fileOf, rankOf } from '../rules/geometry.ts';
import type { Position } from '../rules/position.ts';

export const PIECE_VALUE: readonly number[] = [0, 0, 500, 400, 300, 100];
export const SEAL_VALUE = 35;
const MOBILITY = 4;
const CENTRE = 6;
const ROYAL_ATTACKED = 60; // side to move must spend its turn answering
const ROYAL_ESCAPE = 8;

/** True if any piece of `by` can capture on `sq` with an ordinary move. */
export function isAttacked(board: Int8Array, by: Side, sq: number): boolean {
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = board[i]!;
    if (piece * by <= 0) continue;
    const rays = RAYS[(piece * by) as PieceType]![i]!;
    for (let r = 0; r < rays.length; r++) {
      const ray = rays[r]!;
      for (let k = 0; k < ray.length; k++) {
        const j = ray[k]!;
        if (j === sq) return true;
        if (board[j] !== 0) break;
      }
    }
  }
  return false;
}

export function findRoyal(board: Int8Array, side: Side): number {
  for (let i = 0; i < SQUARE_COUNT; i++) if (board[i] === side) return i;
  return -1;
}

/** Number of ordinary moves (not Concords) available to `side`. */
export function countMoves(board: Int8Array, side: Side): number {
  let n = 0;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = board[i]!;
    if (piece * side <= 0) continue;
    const rays = RAYS[(piece * side) as PieceType]![i]!;
    for (let r = 0; r < rays.length; r++) {
      const ray = rays[r]!;
      for (let k = 0; k < ray.length; k++) {
        const t = board[ray[k]!]!;
        if (t * side > 0) break;
        n++;
        if (t !== 0) break;
      }
    }
  }
  return n;
}

function centrality(sq: number): number {
  const dx = Math.abs(fileOf(sq) * 2 - 5); // 1,3,5
  const dy = Math.abs(rankOf(sq) * 2 - 5);
  return 10 - dx - dy; // 0..8
}

function royalEscapes(board: Int8Array, side: Side, sq: number): number {
  let n = 0;
  for (const ray of RAYS[1]![sq]!) {
    const j = ray[0]!;
    if (board[j]! * side > 0) continue;
    if (!isAttacked(board, -side as Side, j)) n++;
  }
  return n;
}

/** Score for one side (positive = good for `side`), excluding tempo terms. */
function sideScore(p: Position, side: Side): number {
  const b = p.board;
  let s = 0;
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const piece = b[i]!;
    if (piece * side <= 0) continue;
    const t = piece * side;
    if (t === 1) continue;
    s += PIECE_VALUE[t]! + CENTRE * centrality(i) / 2;
  }
  s += MOBILITY * countMoves(b, side);
  s += SEAL_VALUE * p.seals[side === 1 ? 0 : 1]!;
  const royal = findRoyal(b, side);
  if (royal >= 0) s += ROYAL_ESCAPE * royalEscapes(b, side, royal);
  return s;
}

/**
 * Evaluation from the side to move's perspective. Assumes a non-terminal
 * position (both Archwizards present).
 */
export function evaluate(p: Position): number {
  const me = p.side;
  const them = -me as Side;
  let score = sideScore(p, me) - sideScore(p, them);
  const myRoyal = findRoyal(p.board, me);
  if (myRoyal >= 0 && isAttacked(p.board, them, myRoyal)) score -= ROYAL_ATTACKED;
  return score;
}
