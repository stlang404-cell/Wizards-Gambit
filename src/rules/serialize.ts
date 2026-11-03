import { BOARD_SIZE, PIECE_LETTERS, RULES_VERSION_ID, SQUARE_COUNT } from './constants.ts';
import { createPosition, type Position } from './position.ts';
import { sha256Hex } from './sha256.ts';
import type { ActionCode } from './actions.ts';

/**
 * Canonical position bytes, format 1 (44 bytes, explicit integer layout):
 *   [0]      format version = 1
 *   [1]      rules version id (1 = ember-six/0.1)
 *   [2..37]  board, square index order (rank*6+file), int8 two's complement
 *   [38]     side to move, int8 (1 or -1 => 0x01 / 0xFF)
 *   [39]     first player's seals, uint8
 *   [40]     second player's seals, uint8
 *   [41]     quietPly, uint8
 *   [42..43] totalPly, uint16 big-endian
 * Bytes [2..40] are exactly the repetition identity (board, side, seals).
 * tools/gen_golden.py reproduces this layout from the Python prototype.
 */
export const CANONICAL_FORMAT = 1;
export const CANONICAL_LENGTH = 44;

export function canonicalBytes(p: Position): Uint8Array {
  const out = new Uint8Array(CANONICAL_LENGTH);
  out[0] = CANONICAL_FORMAT;
  out[1] = RULES_VERSION_ID;
  for (let i = 0; i < SQUARE_COUNT; i++) out[2 + i] = p.board[i]! & 0xff;
  out[38] = p.side & 0xff;
  out[39] = p.seals[0]!;
  out[40] = p.seals[1]!;
  out[41] = p.quietPly;
  out[42] = (p.totalPly >>> 8) & 0xff;
  out[43] = p.totalPly & 0xff;
  return out;
}

/** Stable SHA-256 hex digest of the canonical bytes (full state incl. counters). */
export function positionDigest(p: Position): string {
  return sha256Hex(canonicalBytes(p));
}

/** Exact repetition identity (board, side, seals) as a compact string Map key. */
export function repetitionKey(p: Position): string {
  const codes = new Array<number>(SQUARE_COUNT + 3);
  for (let i = 0; i < SQUARE_COUNT; i++) codes[i] = p.board[i]! + 6; // 1..11, avoids control chars meaning
  codes[SQUARE_COUNT] = p.side === 1 ? 1 : 2;
  codes[SQUARE_COUNT + 1] = p.seals[0]! + 48;
  codes[SQUARE_COUNT + 2] = p.seals[1]! + 48;
  return String.fromCharCode(...codes);
}

/** SHA-256 hex over the comma-joined decimal action codes (golden fixture check). */
export function actionListDigest(codes: readonly ActionCode[]): string {
  return sha256Hex(codes.join(','));
}

// ------------------------------------------------------------ text notation
// "<ranks 6..1 separated by '/'> <side 1|2> <seals1>-<seals2> <quietPly> <totalPly>"
// Uppercase = first player, lowercase = second player, digits = empty runs.
// Initial: "whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0"

export function formatPosition(p: Position): string {
  const ranks: string[] = [];
  for (let r = BOARD_SIZE - 1; r >= 0; r--) {
    let s = '';
    let empty = 0;
    for (let f = 0; f < BOARD_SIZE; f++) {
      const v = p.board[r * BOARD_SIZE + f]!;
      if (v === 0) { empty++; continue; }
      if (empty) { s += String(empty); empty = 0; }
      const letter = PIECE_LETTERS[Math.abs(v) as 1 | 2 | 3 | 4 | 5];
      s += v > 0 ? letter : letter.toLowerCase();
    }
    if (empty) s += String(empty);
    ranks.push(s);
  }
  return `${ranks.join('/')} ${p.side === 1 ? 1 : 2} ${p.seals[0]}-${p.seals[1]} ${p.quietPly} ${p.totalPly}`;
}

/**
 * Parses notation into raw position fields. Performs syntax checks only;
 * semantic validation (piece counts, royals, counters) is validate.ts's job.
 */
export function parsePositionFields(text: string): {
  board: number[]; side: 1 | -1; seals: [number, number]; quietPly: number; totalPly: number;
} | string {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 5) return 'expected 5 space-separated fields';
  const [boardText, sideText, sealText, quietText, plyText] = parts as [string, string, string, string, string];
  const rows = boardText.split('/');
  if (rows.length !== BOARD_SIZE) return 'board must have 6 ranks';
  const board = new Array<number>(SQUARE_COUNT).fill(0);
  for (let i = 0; i < BOARD_SIZE; i++) {
    const rank = BOARD_SIZE - 1 - i;
    let file = 0;
    for (const ch of rows[i]!) {
      if (ch >= '1' && ch <= '6') { file += Number(ch); continue; }
      const t = PIECE_LETTERS.indexOf(ch.toUpperCase() as 'A');
      if (t <= 0) return `unknown piece letter '${ch}'`;
      if (file >= BOARD_SIZE) return `rank ${rank + 1} overflows`;
      board[rank * BOARD_SIZE + file] = ch === ch.toUpperCase() ? t : -t;
      file++;
    }
    if (file !== BOARD_SIZE) return `rank ${rank + 1} must describe exactly 6 files`;
  }
  if (sideText !== '1' && sideText !== '2') return 'side must be 1 or 2';
  const sm = /^(\d)-(\d)$/.exec(sealText);
  if (!sm) return 'seals must look like 2-2';
  if (!/^\d+$/.test(quietText) || !/^\d+$/.test(plyText)) return 'counters must be non-negative integers';
  return {
    board, side: sideText === '1' ? 1 : -1, seals: [Number(sm[1]), Number(sm[2])],
    quietPly: Number(quietText), totalPly: Number(plyText),
  };
}

/** INTERNAL: parse without semantic validation (tests/tools). Throws on syntax error. */
export function parsePositionUnchecked(text: string): Position {
  const f = parsePositionFields(text);
  if (typeof f === 'string') throw new Error(f);
  return createPosition(f.board, f.side, f.seals, f.quietPly, f.totalPly);
}
