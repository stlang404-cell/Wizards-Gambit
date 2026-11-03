import { PLY_CAP, QUIET_LIMIT, REPETITION_LIMIT, type Side } from './constants.ts';
import { hasLegalAction } from './actions.ts';
import type { Position } from './position.ts';

export type WinReason = 'royal-capture' | 'no-legal-actions';
export type DrawReason = 'repetition' | 'quiet-limit' | 'ply-cap';
export type Outcome =
  | { readonly winner: Side; readonly reason: WinReason }
  | { readonly winner: 0; readonly reason: DrawReason };

export class InvalidPositionError extends Error {
  override name = 'InvalidPositionError';
}

/**
 * Adjudicates the position reached after an action (or a loaded start).
 * Priority (research/04 §Turn and termination, research/02 common rules):
 *   1. first player's Archwizard missing  -> second player wins
 *   2. second player's Archwizard missing -> first player wins
 *   3. this (board, side, seals) seen REPETITION_LIMIT times -> draw
 *   4. quietPly >= QUIET_LIMIT -> draw
 *   5. totalPly >= PLY_CAP -> draw
 *   6. side to move has no legal action -> side to move loses
 * `repetitionCount` is how many times the current repetition identity has
 * occurred in this game's history, including the current occurrence.
 * Both Archwizards missing is unreachable and throws.
 */
export function adjudicate(p: Position, repetitionCount: number): Outcome | null {
  let firstRoyal = false;
  let secondRoyal = false;
  const b = p.board;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 1) firstRoyal = true;
    else if (b[i] === -1) secondRoyal = true;
  }
  if (!firstRoyal && !secondRoyal) throw new InvalidPositionError('both Archwizards missing');
  if (!firstRoyal) return { winner: -1, reason: 'royal-capture' };
  if (!secondRoyal) return { winner: 1, reason: 'royal-capture' };
  if (repetitionCount >= REPETITION_LIMIT) return { winner: 0, reason: 'repetition' };
  if (p.quietPly >= QUIET_LIMIT) return { winner: 0, reason: 'quiet-limit' };
  if (p.totalPly >= PLY_CAP) return { winner: 0, reason: 'ply-cap' };
  if (!hasLegalAction(p)) return { winner: p.side === 1 ? -1 : 1, reason: 'no-legal-actions' };
  return null;
}
