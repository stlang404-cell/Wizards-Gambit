/**
 * Public rules API for Ember Six v0.1.
 *
 * Untrusted input (UI clicks, saves, worker messages) goes through `Game`
 * and `validatePosition`. The `internal` namespace exposes the unchecked fast
 * path (make/unmake, generation, perft) for the future AI worker and for
 * tests; it assumes validated, non-terminal positions and legal codes.
 */
export {
  RULES_VERSION, BOARD_SIZE, SQUARE_COUNT, ARMY_COUNT, INITIAL_SEALS, QUIET_LIMIT, PLY_CAP, REPETITION_LIMIT,
  ARCHWIZARD, WARDEN, HEXWEAVER, SPELLBLADE, FAMILIAR, PIECE_LETTERS,
  type Side, type PieceType, type RulesVersion,
} from './constants.ts';
export { squareName, parseSquare, squareIndex, fileOf, rankOf } from './geometry.ts';
export {
  move, concord, formatAction, parseAction, isWellFormedAction,
  type Action, type MoveAction, type ConcordAction,
} from './actions.ts';
export { type Outcome, type WinReason, type DrawReason } from './terminal.ts';
export { validatePosition, type PositionData } from './validate.ts';
export { Game, type GameRecord, type Result, type RulesError, type RulesErrorCode } from './game.ts';
export { CANONICAL_FORMAT, CANONICAL_LENGTH } from './serialize.ts';

import * as actions from './actions.ts';
import * as position from './position.ts';
import * as serialize from './serialize.ts';
import * as terminal from './terminal.ts';
import * as perft from './perft.ts';
/** Unchecked internals. Do not feed untrusted input into these. */
export const internal = { ...actions, ...position, ...serialize, ...terminal, ...perft } as const;
