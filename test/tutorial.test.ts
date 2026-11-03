import { describe, expect, it } from 'vitest';
import { Game, parseAction } from '../src/rules/index.ts';
import { LESSONS, royalSafeAfter } from '../src/tutorial/lessons.ts';

describe('tutorial lessons', () => {
  it('ids are unique', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it.each(LESSONS.filter((l) => l.position).map((l) => [l.id, l] as const))('%s: position valid, solution legal and satisfies the goal', (_id, l) => {
    const g = Game.fromPosition(l.position);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.value.isOver).toBe(false);
    const a = parseAction(l.solution!);
    expect(a).not.toBeNull();
    const r = g.value.play(a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(l.goal!(g.value, a!, r.value)).toBe(true);
  });

  it('danger and concord goals reject unsafe moves', () => {
    const danger = LESSONS.find((l) => l.id === 'danger')!;
    const g = Game.fromPosition(danger.position)!;
    if (!g.ok) throw new Error('bad');
    const unsafe = g.value.play(parseAction('c3-c4'));
    expect(unsafe.ok && danger.goal!(g.value, parseAction('c3-c4')!, unsafe.value)).toBe(false);
    const concord = LESSONS.find((l) => l.id === 'concord')!;
    const c = Game.fromPosition(concord.position);
    if (!c.ok) throw new Error('bad');
    // every ordinary move fails the Concord lesson
    for (const act of c.value.legalActions().filter((x) => x.kind === 'move')) {
      const after = c.value.play(act);
      expect(after.ok && concord.goal!(c.value, act, after.value)).toBe(false);
      expect(after.ok && royalSafeAfter(after.value)).toBe(false);
    }
  });

  it('the fork lesson solution attacks both targets', () => {
    const l = LESSONS.find((x) => x.id === 'fork')!;
    const g = Game.fromPosition(l.position);
    if (!g.ok) throw new Error('bad');
    const after = g.value.play(parseAction('b2-d4'));
    if (!after.ok) throw new Error('bad');
    // pass the turn hypothetically by checking the Hexweaver's targets from a first-to-move copy
    const copy = Game.fromPosition({ ...after.value.position(), side: 1 });
    if (!copy.ok) throw new Error('bad');
    const targets = copy.value.legalActions().filter((a) => a.kind === 'move' && a.from === 21).map((a) => (a.kind === 'move' ? a.to : -1));
    expect(targets).toContain(35); // f6
    expect(targets).toContain(31); // b6
  });
});
