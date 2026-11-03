/**
 * Ember Six v0.1 — normative constants.
 * Source of truth: research/04_FINAL_GAME_RULES.md plus the common rules and
 * Ember row of research/02_RULESET_CANDIDATES.md. Any change here is a rules
 * change and requires a new RULES_VERSION and fresh fixtures.
 */

export const RULES_VERSION = 'ember-six/0.1' as const;
export type RulesVersion = typeof RULES_VERSION;
/** One-byte identifier for RULES_VERSION inside canonical serialized bytes. */
export const RULES_VERSION_ID = 1;

export const BOARD_SIZE = 6;
export const SQUARE_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Piece codes. Sign encodes the owner: positive = first player, negative = second player. */
export const ARCHWIZARD = 1;
export const WARDEN = 2;
export const HEXWEAVER = 3;
export const SPELLBLADE = 4;
export const FAMILIAR = 5;
export type PieceType = 1 | 2 | 3 | 4 | 5;
export const PIECE_TYPES: readonly PieceType[] = [1, 2, 3, 4, 5];

/** Uppercase letter per piece type (index = type code). */
export const PIECE_LETTERS = ['', 'A', 'W', 'H', 'S', 'F'] as const;

/** Army composition per side: A×1 W×2 H×2 S×1 F×6 (12 pieces). */
export const ARMY_COUNT: Readonly<Record<PieceType, number>> = { 1: 1, 2: 2, 3: 2, 4: 1, 5: 6 };

export const INITIAL_SEALS = 2;
/** 60 consecutive non-capture plies draw. */
export const QUIET_LIMIT = 60;
/** 180 total plies draw. */
export const PLY_CAP = 180;
/** Third occurrence of an identical (board, side, seals) draws. */
export const REPETITION_LIMIT = 3;

export type Side = 1 | -1;
export const FIRST: Side = 1;
export const SECOND: Side = -1;

/** Seal index for a side: 0 = first player, 1 = second player. */
export function sideIndex(side: Side): 0 | 1 {
  return side === 1 ? 0 : 1;
}
