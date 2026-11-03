/**
 * M1 baseline AI: negamax alpha-beta with iterative deepening, capture
 * quiescence (with full evasions when the side to move's Archwizard is
 * attacked), killer-move ordering, and DRAW-AWARE terminal handling inside
 * the tree (royal capture, threefold repetition including game history,
 * 60-quiet, 180-ply cap, no legal action). Node budgets, not wall clock, so
 * results are deterministic for a given (game, level, seed).
 *
 * This is deliberately simple: no transposition table, no PVS/aspiration,
 * no pruning heuristics. The competitive engine is M2 work (research/05).
 */
import { decodeAction, encodeAction, generateActions, makeUnchecked, unmakeUnchecked, CONCORD_BASE, type Action, type ActionCode, type Undo } from '../rules/actions.ts';
import { PLY_CAP, QUIET_LIMIT, REPETITION_LIMIT, SQUARE_COUNT } from '../rules/constants.ts';
import type { Game } from '../rules/game.ts';
import { clonePosition, type Position } from '../rules/position.ts';
import { validatePosition } from '../rules/validate.ts';
import { PIECE_VALUE, evaluate, findRoyal, isAttacked } from './evaluate.ts';

export const AI_ENGINE_VERSION = 'wg-baseline/1';

export type LevelId = 'novice' | 'adept' | 'magister';
export interface Level {
  readonly id: LevelId;
  readonly label: string;
  readonly maxDepth: number;
  readonly nodeBudget: number;
  readonly qDepth: number;
  /** Uniform +/- noise (centi-units) added to non-decisive root scores. */
  readonly noise: number;
}
export const LEVELS: Readonly<Record<LevelId, Level>> = {
  novice: { id: 'novice', label: 'Novice', maxDepth: 2, nodeBudget: 40_000, qDepth: 2, noise: 150 },
  adept: { id: 'adept', label: 'Adept', maxDepth: 3, nodeBudget: 120_000, qDepth: 4, noise: 0 },
  magister: { id: 'magister', label: 'Magister', maxDepth: 6, nodeBudget: 600_000, qDepth: 4, noise: 0 },
};

export const MATE = 1_000_000;
const INF = 2_000_000;
const MAX_PLY = 96;
const DECISIVE = MATE - 1000;

export interface ThinkResult {
  readonly action: Action;
  readonly code: ActionCode;
  /** Score of the chosen action from the mover's perspective (centi-units; ±~1e6 = forced result). */
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
  readonly candidates: number;
  readonly rootScores: readonly { code: ActionCode; score: number }[];
  readonly engine: typeof AI_ENGINE_VERSION;
  readonly level: LevelId;
  readonly seed: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Searcher {
  readonly p: Position;
  readonly keysLo: number[] = [];
  readonly keysHi: number[] = [];
  readonly moves: ActionCode[][] = Array.from({ length: MAX_PLY }, () => []);
  readonly scores: number[][] = Array.from({ length: MAX_PLY }, () => []);
  readonly undos: Undo[] = Array.from({ length: MAX_PLY }, () => ({ code: 0, captured: 0, quietPly: 0, keyLo: 0, keyHi: 0 }));
  readonly killers = new Int32Array(MAX_PLY * 2).fill(-1);
  ply = 0;
  nodes = 0;
  aborted = false;
  canAbort = false;

  readonly budget: number;
  readonly qDepth: number;

  constructor(p: Position, history: { lo: number; hi: number }[], budget: number, qDepth: number) {
    this.p = p;
    this.budget = budget;
    this.qDepth = qDepth;
    for (const k of history) { this.keysLo.push(k.lo); this.keysHi.push(k.hi); }
  }

  repetitions(): number {
    const n = this.keysLo.length;
    const lo = this.p.keyLo;
    const hi = this.p.keyHi;
    let c = 0;
    const stop = Math.max(0, n - 1 - this.p.quietPly);
    for (let i = n - 1; i >= stop; i--) if (this.keysLo[i] === lo && this.keysHi[i] === hi) c++;
    return c;
  }

  /** Terminal score for the side to move, or null. Mirrors rules/terminal.ts priority. */
  terminal(): number | null {
    if (this.ply > 0) {
      const captured = this.undos[this.ply - 1]!.captured;
      if (captured === 1 || captured === -1) return -(MATE - this.ply);
    }
    if (this.repetitions() >= REPETITION_LIMIT) return 0;
    if (this.p.quietPly >= QUIET_LIMIT) return 0;
    if (this.p.totalPly >= PLY_CAP) return 0;
    return null; // "no legal action" is handled where moves are generated
  }

  make(code: ActionCode): void {
    makeUnchecked(this.p, code, this.undos[this.ply]!);
    this.keysLo.push(this.p.keyLo);
    this.keysHi.push(this.p.keyHi);
    this.ply++;
  }
  unmake(): void {
    this.ply--;
    this.keysLo.pop();
    this.keysHi.pop();
    unmakeUnchecked(this.p, this.undos[this.ply]!);
  }

  orderScore(code: ActionCode): number {
    if (code >= CONCORD_BASE) return -1000;
    const b = this.p.board;
    const from = (code / SQUARE_COUNT) | 0;
    const to = code % SQUARE_COUNT;
    const victim = Math.abs(b[to]!);
    if (victim === 1) return 10_000_000;
    if (victim) return 1_000_000 + PIECE_VALUE[victim]! * 10 - PIECE_VALUE[Math.abs(b[from]!)]!;
    if (this.killers[this.ply * 2] === code) return 500_000;
    if (this.killers[this.ply * 2 + 1] === code) return 400_000;
    return 0;
  }

  sortMoves(list: ActionCode[], scores: number[]): void {
    scores.length = list.length;
    for (let i = 0; i < list.length; i++) scores[i] = this.orderScore(list[i]!);
    for (let i = 1; i < list.length; i++) {
      const m = list[i]!;
      const s = scores[i]!;
      let j = i - 1;
      while (j >= 0 && scores[j]! < s) { list[j + 1] = list[j]!; scores[j + 1] = scores[j]!; j--; }
      list[j + 1] = m;
      scores[j + 1] = s;
    }
  }

  tick(): boolean {
    this.nodes++;
    if (this.canAbort && this.nodes > this.budget) this.aborted = true;
    return this.aborted;
  }

  negamax(depth: number, alpha: number, beta: number): number {
    if (this.tick()) return 0;
    const t = this.terminal();
    if (t !== null) return t;
    if (depth <= 0) return this.quiesce(alpha, beta, this.qDepth);
    if (this.ply >= MAX_PLY - 1) return evaluate(this.p);
    const list = this.moves[this.ply]!;
    list.length = 0;
    generateActions(this.p, list);
    if (list.length === 0) return -(MATE - this.ply);
    this.sortMoves(list, this.scores[this.ply]!);
    let best = -INF;
    for (let mi = 0; mi < list.length; mi++) {
      const code = list[mi]!;
      const quiet = code < CONCORD_BASE && this.p.board[code % SQUARE_COUNT] === 0;
      this.make(code);
      const v = -this.negamax(depth - 1, -beta, -alpha);
      this.unmake();
      if (this.aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (quiet && this.killers[this.ply * 2] !== code) {
          this.killers[this.ply * 2 + 1] = this.killers[this.ply * 2]!;
          this.killers[this.ply * 2] = code;
        }
        break;
      }
    }
    return best;
  }

  quiesce(alpha: number, beta: number, qd: number): number {
    if (this.tick()) return 0;
    const t = this.terminal();
    if (t !== null) return t;
    const p = this.p;
    const royal = findRoyal(p.board, p.side);
    const inDanger = royal >= 0 && isAttacked(p.board, -p.side as 1 | -1, royal);
    let best = -INF;
    if (!inDanger) {
      const stand = evaluate(p);
      if (stand >= beta || qd <= 0 || this.ply >= MAX_PLY - 1) return stand;
      best = stand;
      if (stand > alpha) alpha = stand;
    } else if (qd <= 0 || this.ply >= MAX_PLY - 1) {
      return evaluate(p);
    }
    const list = this.moves[this.ply]!;
    list.length = 0;
    generateActions(p, list);
    if (list.length === 0) return -(MATE - this.ply);
    let moves = list;
    if (!inDanger) moves = list.filter((c) => c < CONCORD_BASE && p.board[c % SQUARE_COUNT] !== 0);
    else moves = list.slice();
    this.sortMoves(moves, this.scores[this.ply]!);
    for (const code of moves) {
      this.make(code);
      const v = -this.quiesce(-beta, -alpha, qd - 1);
      this.unmake();
      if (this.aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
}

/** History of Zobrist keys from the game's start through the current position. */
function replayKeys(game: Game): { pos: Position; keys: { lo: number; hi: number }[] } {
  const start = validatePosition(game.toRecord().start);
  if (!start.ok) throw new Error('game start failed validation');
  const pos = start.position;
  const keys = [{ lo: pos.keyLo, hi: pos.keyHi }];
  for (const a of game.actions()) {
    makeUnchecked(pos, encodeAction(a));
    keys.push({ lo: pos.keyLo, hi: pos.keyHi });
  }
  return { pos, keys };
}

/**
 * Chooses an action for the side to move. Throws if the game is over.
 * Deterministic for a given game history, level and seed.
 */
export function think(game: Game, levelId: LevelId, seed: number): ThinkResult {
  if (game.isOver) throw new Error('think() called on a finished game');
  const level = LEVELS[levelId];
  const { pos, keys } = replayKeys(game);
  const s = new Searcher(clonePosition(pos), keys, level.nodeBudget, level.qDepth);
  const root: ActionCode[] = [];
  generateActions(s.p, root);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  // Noise is drawn once per root move so it is stable across iterations.
  const noise = root.map(() => (level.noise ? Math.round((rng() * 2 - 1) * level.noise) : 0));
  let order = root.map((code, i) => ({ code, i, score: 0 }));
  let completed: { code: ActionCode; i: number; score: number }[] = [];
  let completedDepth = 0;
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    s.canAbort = depth > 1;
    let best = -INF;
    const results: { code: ActionCode; i: number; score: number }[] = [];
    for (const m of order) {
      s.make(m.code);
      // Window (best-1, INF): every move scoring >= best gets an exact score,
      // so ties are identified exactly. With noise, all root scores are exact.
      const alpha = level.noise ? -INF : best - 1;
      const v = -s.negamax(depth - 1, -INF, -alpha);
      s.unmake();
      if (s.aborted) break;
      results.push({ code: m.code, i: m.i, score: v + 0 }); // +0 normalises -0
      if (v > best) best = v;
    }
    if (s.aborted) break;
    completed = results;
    completedDepth = depth;
    order = [...results].sort((a, b) => b.score - a.score || a.i - b.i);
    if (best >= DECISIVE) break; // forced win found; deeper search cannot improve
  }
  const adjusted = completed.map((m) => ({
    ...m,
    adj: Math.abs(m.score) >= DECISIVE ? m.score : m.score + noise[m.i]!,
  }));
  const top = Math.max(...adjusted.map((m) => m.adj));
  const candidates = adjusted.filter((m) => m.adj === top).sort((a, b) => a.i - b.i);
  const pick = candidates[Math.floor(rng() * candidates.length)]!;
  return {
    action: decodeAction(pick.code),
    code: pick.code,
    score: pick.score,
    depth: completedDepth,
    nodes: s.nodes,
    candidates: candidates.length,
    rootScores: completed.map((m) => ({ code: m.code, score: m.score })),
    engine: AI_ENGINE_VERSION,
    level: levelId,
    seed,
  };
}

/** Per-move seed derivation so AI play is reproducible from (matchSeed, ply). */
export function moveSeed(matchSeed: number, ply: number): number {
  let h = (matchSeed ^ Math.imul(ply + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
