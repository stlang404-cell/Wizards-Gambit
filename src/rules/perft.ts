import { generateActions, makeUnchecked, unmakeUnchecked, type ActionCode, type Undo } from './actions.ts';
import { clonePosition, type Position } from './position.ts';
import { repetitionKey } from './serialize.ts';
import { adjudicate } from './terminal.ts';

/**
 * Raw perft: counts leaf action sequences of exactly `depth` plies, expanding
 * every legal action without terminal pruning. This matches the research
 * prototype's perft.py semantics (research/results/perft.json).
 * Uses internal make/unmake on a private copy of `start`.
 */
export function perft(start: Position, depth: number): number {
  const p = clonePosition(start);
  const buffers: ActionCode[][] = Array.from({ length: depth + 1 }, () => []);
  const undos: Undo[] = Array.from({ length: depth + 1 }, () => ({ code: 0, captured: 0, quietPly: 0, keyLo: 0, keyHi: 0 }));
  const rec = (d: number): number => {
    if (d === 0) return 1;
    const list = buffers[d]!;
    list.length = 0;
    generateActions(p, list);
    if (d === 1) return list.length;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const u = makeUnchecked(p, list[i]!, undos[d]!);
      n += rec(d - 1);
      unmakeUnchecked(p, u);
    }
    return n;
  };
  return rec(depth);
}

/**
 * Terminal-aware perft: a position that adjudicates as terminal (royal
 * capture, repetition, quiet limit, ply cap, no legal action) has no
 * children and contributes 0 at depth > 0. Repetition counts use the path
 * from `start`, whose own identity is counted once (pass `priorCounts` to
 * seed earlier history).
 */
export function perftTerminal(start: Position, depth: number, priorCounts?: ReadonlyMap<string, number>): number {
  const p = clonePosition(start);
  const counts = new Map(priorCounts ?? []);
  const k0 = repetitionKey(p);
  if (!priorCounts) counts.set(k0, 1);
  const rec = (d: number): number => {
    if (d === 0) return 1;
    if (adjudicate(p, counts.get(repetitionKey(p)) ?? 0)) return 0;
    const list = generateActions(p, []);
    let n = 0;
    for (const code of list) {
      const u = makeUnchecked(p, code);
      const k = repetitionKey(p);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      n += rec(d - 1);
      counts.set(k, counts.get(k)! - 1);
      unmakeUnchecked(p, u);
    }
    return n;
  };
  return rec(depth);
}

/** Per-root-action raw perft counts (debugging aid), keyed by action code. */
export function perftDivide(start: Position, depth: number): Map<ActionCode, number> {
  const p = clonePosition(start);
  const out = new Map<ActionCode, number>();
  for (const code of generateActions(p, [])) {
    const u = makeUnchecked(p, code);
    out.set(code, depth <= 1 ? 1 : perft(p, depth - 1));
    unmakeUnchecked(p, u);
  }
  return out;
}
