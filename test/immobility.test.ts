/**
 * Is the "no legal actions -> side to move loses" rule reachable in v0.1?
 *
 * A side with a seal is never stuck: if its Archwizard cannot move, every
 * on-board neighbour of the A is friendly, so a Concord exists. With zero
 * seals, enemy pieces never block (they can be captured) and slides are
 * blocked only by their first square, so the side is stuck iff its piece set
 * P is "closed": every first-step target of every piece in P is in P.
 * This test exhaustively searches all closed sets containing an Archwizard
 * whose type counts fit the army (A1 W2 H2 S1 F6) and asserts there are none,
 * i.e. the immobility branch cannot fire from any validated position. The
 * rule stays implemented (it is normative and future variants may reach it).
 */
import { describe, expect, it } from 'vitest';
import { ARMY_COUNT, type PieceType } from '../src/rules/constants.ts';
import { RAYS } from '../src/rules/geometry.ts';

function closedSetExists(army: Readonly<Record<PieceType, number>>): { found: boolean; nodes: number } {
  let nodes = 0;
  const firstSteps = (t: PieceType, sq: number): number[] => RAYS[t]![sq]!.map((ray) => ray[0]!);
  const assigned = new Map<number, PieceType>();
  const left: Record<PieceType, number> = { ...army };
  const dfs = (frontier: number[]): boolean => {
    nodes++;
    const pending = [...new Set(frontier.filter((s) => !assigned.has(s)))];
    if (pending.length === 0) return true;
    const remaining = left[1] + left[2] + left[3] + left[4] + left[5];
    if (pending.length > remaining) return false;
    const [s, ...rest] = pending as [number, ...number[]];
    for (const t of [1, 2, 3, 4, 5] as PieceType[]) {
      if (left[t] === 0) continue;
      left[t]--;
      assigned.set(s, t);
      if (dfs([...rest, ...firstSteps(t, s)])) return true;
      assigned.delete(s);
      left[t]++;
    }
    return false;
  };
  for (let a = 0; a < 36; a++) {
    left[1] = 0;
    assigned.set(a, 1);
    if (dfs(firstSteps(1, a))) return { found: true, nodes };
    assigned.delete(a);
    left[1] = army[1];
  }
  return { found: false, nodes };
}

describe('immobility reachability', () => {
  it('no valid army subset with an Archwizard and zero seals can be without legal actions', () => {
    const r = closedSetExists(ARMY_COUNT);
    expect(r.found).toBe(false);
    expect(r.nodes).toBeGreaterThan(36);
  });

  it('search sanity: with unlimited pieces a closed (stuck) set does exist', () => {
    expect(closedSetExists({ 1: 1, 2: 36, 3: 36, 4: 36, 5: 36 }).found).toBe(true);
  });
});
