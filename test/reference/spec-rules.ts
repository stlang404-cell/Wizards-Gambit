/**
 * Independent reference move generator, written directly from the prose of
 * research/04_FINAL_GAME_RULES.md. It deliberately shares NO code or tables
 * with src/rules: squares are algebraic strings, pieces are letters, and
 * legality is decided by testing every (piece, destination) pair against a
 * displacement predicate instead of walking precomputed rays. It is slow and
 * only used to cross-check perft counts and legal-action sets.
 */

export type RefPiece = string; // 'A','W','H','S','F' (first) or lowercase (second)
export interface RefState {
  cells: Map<string, RefPiece>; // occupied squares only, e.g. 'c3' -> 'A'
  first: boolean; // true when the first player moves
  sealsFirst: number;
  sealsSecond: number;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f'];
const name = (f: number, r: number): string => `${FILES[f]}${r + 1}`;
const coords = (sq: string): [number, number] => [FILES.indexOf(sq[0]!), Number(sq[1]) - 1];
const isFirst = (p: RefPiece): boolean => p === p.toUpperCase();

export function refInitial(): RefState {
  const cells = new Map<string, RefPiece>();
  'WHASHW'.split('').forEach((p, f) => cells.set(name(f, 0), p));
  for (let f = 0; f < 6; f++) cells.set(name(f, 1), 'F');
  'whsahw'.split('').forEach((p, f) => cells.set(name(f, 5), p));
  for (let f = 0; f < 6; f++) cells.set(name(f, 4), 'f');
  return { cells, first: true, sealsFirst: 2, sealsSecond: 2 };
}

/** Rule text: "A moves/captures (dx,dy) where max(|dx|,|dy|)=1" etc. Returns the intermediate square requirement. */
function geometryAllows(type: string, dx: number, dy: number): { ok: boolean; via?: [number, number] } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  switch (type) {
    case 'A':
      return { ok: Math.max(ax, ay) === 1 };
    case 'W': // (±1,0),(±2,0),(0,±1),(0,±2); length two needs empty intermediate
      if ((ay === 0 && ax === 1) || (ax === 0 && ay === 1)) return { ok: true };
      if ((ay === 0 && ax === 2) || (ax === 0 && ay === 2)) return { ok: true, via: [dx / 2, dy / 2] };
      return { ok: false };
    case 'H': // (±1,±1),(±2,±2) with same intermediate rule
      if (ax === 1 && ay === 1) return { ok: true };
      if (ax === 2 && ay === 2) return { ok: true, via: [dx / 2, dy / 2] };
      return { ok: false };
    case 'S': // (±2,±1),(±1,±2), jumps
      return { ok: (ax === 2 && ay === 1) || (ax === 1 && ay === 2) };
    case 'F': // (±1,0),(0,±1)
      return { ok: ax + ay === 1 };
  }
  throw new Error(`unknown piece ${type}`);
}

/** All legal actions as strings: "c3-c4" moves, "c3~d3" Concords (squares sorted by index). */
export function refLegal(s: RefState): string[] {
  const out: string[] = [];
  const mine = [...s.cells.entries()].filter(([, p]) => isFirst(p) === s.first);
  for (const [from, piece] of mine) {
    const [fx, fy] = coords(from);
    for (let tx = 0; tx < 6; tx++) {
      for (let ty = 0; ty < 6; ty++) {
        if (tx === fx && ty === fy) continue;
        const to = name(tx, ty);
        const occupant = s.cells.get(to);
        if (occupant !== undefined && isFirst(occupant) === s.first) continue; // friendly destination forbidden
        const g = geometryAllows(piece.toUpperCase(), tx - fx, ty - fy);
        if (!g.ok) continue;
        if (g.via && s.cells.has(name(fx + g.via[0], fy + g.via[1]))) continue;
        out.push(`${from}-${to}`);
      }
    }
  }
  const seals = s.first ? s.sealsFirst : s.sealsSecond;
  if (seals > 0) {
    // "Choose two different friendly pieces whose file and rank distances are each at most one."
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const [a] = mine[i]!;
        const [b] = mine[j]!;
        const [ax, ay] = coords(a);
        const [bx, by] = coords(b);
        if (Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1) {
          const ia = ay * 6 + ax;
          const ib = by * 6 + bx;
          out.push(ia < ib ? `${a}~${b}` : `${b}~${a}`);
        }
      }
    }
  }
  return out;
}

export function refApply(s: RefState, action: string): RefState {
  const cells = new Map(s.cells);
  const [x, y] = [action.slice(0, 2), action.slice(3, 5)];
  let { sealsFirst, sealsSecond } = s;
  if (action[2] === '~') {
    const px = cells.get(x)!;
    const py = cells.get(y)!;
    cells.set(x, py);
    cells.set(y, px);
    if (s.first) sealsFirst--;
    else sealsSecond--;
  } else {
    cells.set(y, cells.get(x)!);
    cells.delete(x);
  }
  return { cells, first: !s.first, sealsFirst, sealsSecond };
}

/**
 * Perft. With `royalPruned`, a position missing either Archwizard has no
 * children ("Capturing the A with an ordinary move wins immediately"). Other
 * terminal rules (repetition, 60 quiet, 180 plies) are not modelled here, so
 * use royalPruned only where those cannot trigger (shallow depths).
 */
export function refPerft(s: RefState, depth: number, royalPruned = false): number {
  if (depth === 0) return 1;
  if (royalPruned) {
    const pieces = [...s.cells.values()];
    if (!pieces.includes('A') || !pieces.includes('a')) return 0;
  }
  const legal = refLegal(s);
  if (depth === 1) return legal.length;
  let n = 0;
  for (const a of legal) n += refPerft(refApply(s, a), depth - 1, royalPruned);
  return n;
}

/** Convert from a 36-entry signed board (index = rank*6+file). */
export function refFromBoard(board: ArrayLike<number>, side: number, seals: readonly number[]): RefState {
  const cells = new Map<string, RefPiece>();
  const letters = ['', 'A', 'W', 'H', 'S', 'F'];
  for (let i = 0; i < 36; i++) {
    const v = board[i]!;
    if (v !== 0) cells.set(name(i % 6, Math.floor(i / 6)), v > 0 ? letters[v]! : letters[-v]!.toLowerCase());
  }
  return { cells, first: side === 1, sealsFirst: seals[0]!, sealsSecond: seals[1]! };
}
