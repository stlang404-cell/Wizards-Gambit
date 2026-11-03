import {
  ARMY_COUNT, INITIAL_SEALS, PLY_CAP, QUIET_LIMIT, RULES_VERSION, SQUARE_COUNT, type PieceType, type Side,
} from './constants.ts';
import { createPosition, type Position } from './position.ts';
import { parsePositionFields } from './serialize.ts';

/** Plain, JSON-safe position description used at public API boundaries. */
export interface PositionData {
  readonly rulesVersion: typeof RULES_VERSION;
  readonly board: readonly number[]; // 36 entries, index = rank*6 + file
  readonly side: Side;
  readonly seals: readonly [number, number];
  readonly quietPly: number;
  readonly totalPly: number;
}

export function toPositionData(p: Position): PositionData {
  return {
    rulesVersion: RULES_VERSION,
    board: Array.from(p.board),
    side: p.side,
    seals: [p.seals[0]!, p.seals[1]!],
    quietPly: p.quietPly,
    totalPly: p.totalPly,
  };
}

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/**
 * Validates untrusted position input (PositionData-like object or notation
 * string) and returns an internal Position, or the list of problems.
 *
 * Enforced invariants (each one is attainable-state necessary for v0.1):
 *  - rulesVersion, when present, equals RULES_VERSION
 *  - board: 36 integers in [-5, 5]
 *  - per side: at most the starting army count of each type (no promotion/drops)
 *  - at least one Archwizard (both missing is unattainable)
 *  - side is 1 or -1; seals are integers in [0, 2]
 *  - 0 <= quietPly <= QUIET_LIMIT, 0 <= totalPly <= PLY_CAP, quietPly <= totalPly
 * Deliberately NOT enforced (reversible choice, allows puzzles/tests):
 *  side-to-move vs totalPly parity, and seals spent vs plies elapsed.
 * A validated position may already be terminal (one Archwizard missing,
 * counters at their limit); Game refuses play from it.
 */
export function validatePosition(input: unknown): { ok: true; position: Position } | { ok: false; errors: string[] } {
  let raw: unknown = input;
  if (typeof input === 'string') {
    const parsed = parsePositionFields(input);
    if (typeof parsed === 'string') return { ok: false, errors: [parsed] };
    raw = parsed;
  }
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['position must be an object or notation string'] };
  const o = raw as Record<string, unknown>;

  if ('rulesVersion' in o && o.rulesVersion !== RULES_VERSION) {
    errors.push(`unsupported rulesVersion ${JSON.stringify(o.rulesVersion)}; expected ${RULES_VERSION}`);
  }

  const boardIn = o.board;
  const board: number[] = [];
  if (!(Array.isArray(boardIn) || boardIn instanceof Int8Array) || boardIn.length !== SQUARE_COUNT) {
    errors.push('board must be an array of 36 integers');
  } else {
    for (let i = 0; i < SQUARE_COUNT; i++) {
      const v: unknown = boardIn[i];
      if (!isInt(v) || v < -5 || v > 5) {
        errors.push(`board[${i}] must be an integer in [-5, 5]`);
        board.push(0);
      } else board.push(v);
    }
    for (const side of [1, -1] as const) {
      const name = side === 1 ? 'first' : 'second';
      for (const t of [1, 2, 3, 4, 5] as PieceType[]) {
        const n = board.filter((v) => v === t * side).length;
        if (n > ARMY_COUNT[t]) errors.push(`${name} player has ${n} pieces of type ${t}; maximum is ${ARMY_COUNT[t]}`);
      }
    }
    if (!board.includes(1) && !board.includes(-1)) errors.push('both Archwizards missing');
  }

  if (o.side !== 1 && o.side !== -1) errors.push('side must be 1 or -1');

  const seals = o.seals;
  const sealsArr = Array.isArray(seals) || seals instanceof Uint8Array ? Array.from(seals as ArrayLike<unknown>) : null;
  if (!sealsArr || sealsArr.length !== 2 || !sealsArr.every((s) => isInt(s) && s >= 0 && s <= INITIAL_SEALS)) {
    errors.push(`seals must be two integers in [0, ${INITIAL_SEALS}]`);
  }

  const q = o.quietPly;
  const t = o.totalPly;
  if (!isInt(q) || q < 0 || q > QUIET_LIMIT) errors.push(`quietPly must be an integer in [0, ${QUIET_LIMIT}]`);
  if (!isInt(t) || t < 0 || t > PLY_CAP) errors.push(`totalPly must be an integer in [0, ${PLY_CAP}]`);
  if (isInt(q) && isInt(t) && q > t) errors.push('quietPly cannot exceed totalPly');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    position: createPosition(board, o.side as Side, [sealsArr![0] as number, sealsArr![1] as number], q as number, t as number),
  };
}
