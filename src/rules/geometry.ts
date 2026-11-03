import { BOARD_SIZE, SQUARE_COUNT, type PieceType } from './constants.ts';

/** Square index = rank * 6 + file; file a..f = 0..5, rank 1..6 = 0..5. */
export function squareIndex(file: number, rank: number): number {
  return rank * BOARD_SIZE + file;
}
export function fileOf(sq: number): number {
  return sq % BOARD_SIZE;
}
export function rankOf(sq: number): number {
  return (sq / BOARD_SIZE) | 0;
}
export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
}
export function isSquare(sq: unknown): sq is number {
  return typeof sq === 'number' && Number.isInteger(sq) && sq >= 0 && sq < SQUARE_COUNT;
}

const FILES = 'abcdef';
export function squareName(sq: number): string {
  return FILES[fileOf(sq)]! + String(rankOf(sq) + 1);
}
export function parseSquare(name: string): number | null {
  if (name.length !== 2) return null;
  const f = FILES.indexOf(name[0]!);
  const r = name.charCodeAt(1) - 49; // '1'
  if (f < 0 || r < 0 || r >= BOARD_SIZE) return null;
  return squareIndex(f, r);
}

export function chebyshev(a: number, b: number): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
}

// Direction orders are part of canonical action ordering. They intentionally
// match research/prototype/engine.py so legal-action lists compare exactly.
const ORTHO: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KING = [...ORTHO, ...DIAG];
const JUMP: readonly (readonly [number, number])[] = [
  [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2],
];

function movementOf(type: PieceType): { dirs: readonly (readonly [number, number])[]; reach: number } {
  switch (type) {
    case 1: return { dirs: KING, reach: 1 }; // Archwizard
    case 2: return { dirs: ORTHO, reach: 2 }; // Warden
    case 3: return { dirs: DIAG, reach: 2 }; // Hexweaver
    case 4: return { dirs: JUMP, reach: 1 }; // Spellblade (jumps)
    case 5: return { dirs: ORTHO, reach: 1 }; // Familiar
  }
}

/**
 * RAYS[type][sq] = list of rays; each ray lists destination squares in order.
 * A ray of length 2 is blocked by any piece on its first square.
 */
export const RAYS: readonly (readonly (readonly (readonly number[])[])[])[] = (() => {
  const all: number[][][][] = [[]];
  for (const type of [1, 2, 3, 4, 5] as const) {
    const perSquare: number[][][] = [];
    const { dirs, reach } = movementOf(type);
    for (let sq = 0; sq < SQUARE_COUNT; sq++) {
      const rays: number[][] = [];
      for (const [dx, dy] of dirs) {
        const ray: number[] = [];
        for (let r = 1; r <= reach; r++) {
          const f = fileOf(sq) + dx * r;
          const k = rankOf(sq) + dy * r;
          if (!onBoard(f, k)) break;
          ray.push(squareIndex(f, k));
        }
        if (ray.length) rays.push(ray);
      }
      perSquare.push(rays);
    }
    all.push(perSquare);
  }
  return all;
})();

/** CONCORD_PARTNERS[sq] = squares j > sq at Chebyshev distance exactly 1, ascending. */
export const CONCORD_PARTNERS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const row: number[] = [];
    for (let j = i + 1; j < SQUARE_COUNT; j++) if (chebyshev(i, j) === 1) row.push(j);
    out.push(row);
  }
  return out;
})();
