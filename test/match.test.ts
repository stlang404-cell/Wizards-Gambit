import { describe, expect, it } from 'vitest';
import { Game, internal, parseAction } from '../src/rules/index.ts';
import { think, type LevelId } from '../src/ai/search.ts';
import { MatchController, type AiPort, type MatchEvent, type MatchSetup } from '../src/match/controller.ts';
import { validateMatchRecord, type MatchRecord } from '../src/match/record.ts';
import {
  BACKUP_PREFIX, MemoryStore, SAVE_KEY, type SaveFile, archiveRecord, emptySave, exportArchive, importArchive, loadSave, writeSave,
} from '../src/persistence/save.ts';
import type { GameRecord } from '../src/rules/game.ts';

/** Manual scheduler: timers run only when flush() is called. */
class Clock {
  queue: { fn: () => void; cancelled: boolean }[] = [];
  schedule = (fn: () => void): (() => void) => {
    const t = { fn, cancelled: false };
    this.queue.push(t);
    return () => { t.cancelled = true; };
  };
  async flush(rounds = 1000): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      const t = this.queue.shift();
      if (!t) { await Promise.resolve(); await Promise.resolve(); if (!this.queue.length) return; continue; }
      if (!t.cancelled) t.fn();
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

/** In-process AI port; optionally holds replies until release() to simulate a slow worker. */
class InProcessAi implements AiPort {
  cancels = 0;
  held: (() => void)[] = [];
  hold = false;
  think(record: GameRecord, level: LevelId, seed: number) {
    const g = Game.fromRecord(record);
    if (!g.ok) return Promise.reject(new Error(g.error.message));
    const r = think(g.value, level, seed);
    return new Promise<{ action: typeof r.action }>((resolve) => {
      const go = () => resolve({ action: r.action });
      if (this.hold) this.held.push(go); else go();
    });
  }
  cancel(): void { this.cancels++; }
  release(): void { const h = this.held; this.held = []; h.forEach((f) => f()); }
}

let ids = 0;
function controller(ai = new InProcessAi(), clock = new Clock()) {
  const c = new MatchController({ ai, newId: () => `m${++ids}`, now: () => '2026-11-03T00:00:00.000Z', humanId: 'human:test', schedule: clock.schedule });
  const events: MatchEvent[] = [];
  c.on((e) => events.push(e));
  return { c, ai, clock, events };
}
const HVA: MatchSetup = { mode: 'human-vs-ai', first: { kind: 'human', name: 'You' }, second: { kind: 'ai', level: 'novice', name: 'Novice' }, allowUndo: true };
const HVH: MatchSetup = { mode: 'human-vs-human', first: { kind: 'human', name: 'P1' }, second: { kind: 'human', name: 'P2' }, allowUndo: true };
const AVA: MatchSetup = { mode: 'ai-vs-ai', first: { kind: 'ai', level: 'novice', name: 'A' }, second: { kind: 'ai', level: 'adept', name: 'B' }, allowUndo: true };
const a = (t: string) => parseAction(t)!;

describe('match controller', () => {
  it('human vs AI: human moves, AI replies legally, turn returns to human', async () => {
    const { c, clock, events } = controller();
    c.start(HVA, 42);
    expect(c.isHumanTurn()).toBe(true);
    expect(c.play(a('c2-c3'))).toBeNull();
    expect(c.isHumanTurn()).toBe(false);
    expect(c.play(a('d2-d3'))).toBe('It is not your turn.');
    await clock.flush();
    expect(c.game.ply).toBe(2);
    expect(c.isHumanTurn()).toBe(true);
    expect(events.filter((e) => e.type === 'move').map((e) => (e as { by: string }).by)).toEqual(['human', 'ai']);
  });

  it('rejects illegal human actions with a message and changes nothing', () => {
    const { c } = controller();
    c.start(HVA, 1);
    expect(c.play(a('a1-a3'))).toMatch(/not legal/);
    expect(c.play({ kind: 'teleport' })).toMatch(/expected/);
    expect(c.game.ply).toBe(0);
  });

  it('AI vs AI completes a legal game, producing a valid completed record', async () => {
    const { c, clock } = controller();
    c.start({ ...AVA, second: { kind: 'ai', level: 'novice', name: 'B' } }, 7);
    c.setSpeed('instant');
    await clock.flush(5000);
    expect(c.game.isOver).toBe(true);
    const rec = c.record();
    expect(rec.status).toBe('completed');
    const v = validateMatchRecord(JSON.parse(JSON.stringify(rec)));
    expect(v.ok).toBe(true);
    expect(rec.players.first.ai).toEqual({ engine: 'wg-baseline/1', level: 'novice' });
    expect(rec.result).not.toBe('*');
    expect(c.canUndo()).toBe(false); // exhibitions never allow undo
  });

  it('AI vs AI is reproducible from the match seed', async () => {
    const run = async () => {
      const { c, clock } = controller();
      c.start({ ...AVA, second: { kind: 'ai', level: 'novice', name: 'B' } }, 123);
      await clock.flush(5000);
      return c.record().actions.join(' ');
    };
    expect(await run()).toBe(await run());
  });

  it('pause stops exhibitions; resume continues', async () => {
    const { c, clock } = controller();
    c.start(AVA, 9);
    c.pause();
    await clock.flush();
    expect(c.game.ply).toBe(0);
    c.resumePlay();
    await clock.flush(3);
    expect(c.game.ply).toBeGreaterThan(0);
  });

  it('stale AI replies after undo or restart are discarded', async () => {
    const { c, ai, clock } = controller();
    ai.hold = true;
    c.start(HVA, 5);
    c.play(a('c2-c3'));
    await clock.flush(); // AI request issued and held
    expect(ai.held.length).toBe(1);
    expect(c.undo()).toBe(true); // back to start, human to move
    ai.release(); // late reply arrives
    await clock.flush();
    expect(c.game.ply).toBe(0);
    expect(c.isHumanTurn()).toBe(true);
    expect(ai.cancels).toBeGreaterThan(0);
    c.play(a('c2-c3'));
    await clock.flush();
    c.restart(6);
    ai.release();
    await clock.flush();
    expect(c.game.ply).toBe(0);
  });

  it('undo in human-vs-ai returns to the human turn; hot-seat undo is one ply; counts mark practice', async () => {
    const { c, clock } = controller();
    c.start(HVA, 3);
    c.play(a('c2-c3'));
    await clock.flush();
    expect(c.game.ply).toBe(2);
    expect(c.undo()).toBe(true);
    expect(c.game.ply).toBe(0);
    expect(c.record().practice).toBe(true);
    const h = controller();
    h.c.start(HVH, 1);
    h.c.play(a('c2-c3'));
    h.c.play(a('d5-d4'));
    h.c.undo();
    expect(h.c.game.ply).toBe(1);
    expect(h.c.record().undoCount).toBe(1);
  });

  it('undo disabled when allowUndo is false', () => {
    const { c } = controller();
    c.start({ ...HVH, allowUndo: false }, 1);
    c.play(a('c2-c3'));
    expect(c.undo()).toBe(false);
  });

  it('hot-seat game to a repetition draw records the right outcome', () => {
    const { c } = controller();
    const start = Game.fromPosition('5a/6/6/6/6/A5 1 2-2 0 0');
    if (!start.ok) throw new Error('bad');
    c.start(HVH, 1, start.value);
    for (const m of ['a1-b1', 'f6-e6', 'b1-a1', 'e6-f6', 'a1-b1', 'f6-e6', 'b1-a1', 'e6-f6']) expect(c.play(a(m))).toBeNull();
    const rec = c.record();
    expect(rec.outcome).toEqual({ winner: 0, reason: 'repetition' });
    expect(rec.result).toBe('1/2-1/2');
    expect(rec.start).toBe('5a/6/6/6/6/A5 1 2-2 0 0');
    expect(validateMatchRecord(rec).ok).toBe(true);
    expect(c.play(a('a1-b1'))).toBe('The match is over.');
  });

  it('human vs AI royal capture victory is adjudicated and recorded', () => {
    const { c } = controller();
    const s = Game.fromPosition('6/6/6/2a3/2A3/6 1 2-2 0 0');
    if (!s.ok) throw new Error('bad');
    c.start(HVA, 1, s.value);
    expect(c.play(a('c2xc3'))).toBeNull();
    expect(c.record().outcome).toEqual({ winner: 1, reason: 'royal-capture' });
    expect(c.record().result).toBe('1-0');
  });
});

describe('match records', () => {
  const sample = (): MatchRecord => {
    const { c } = controller();
    c.start(HVH, 77);
    c.play(a('c2-c3'));
    c.play(a('d5~d6'));
    return c.record();
  };
  it('contains every required field', () => {
    const r = sample();
    expect(r).toMatchObject({
      schema: 'wg.match/1', rulesVersion: 'ember-six/0.1', mode: 'human-vs-human', ranked: false, ratingPool: 'unrated',
      timeControl: { kind: 'untimed' }, status: 'in-progress', result: '*', plies: 2, seed: 77,
      actions: ['c2-c3', 'd5~d6'], start: 'whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0',
    });
    expect(r.players.first.id).toBe('human:test#1');
    expect(r.finalDigest).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each([
    ['tampered action', (r: MatchRecord) => ({ ...r, actions: ['c2-c4'] })],
    ['tampered outcome', (r: MatchRecord) => ({ ...r, outcome: { winner: 1, reason: 'royal-capture' } })],
    ['tampered digest', (r: MatchRecord) => ({ ...r, finalDigest: '0'.repeat(64) })],
    ['wrong schema', (r: MatchRecord) => ({ ...r, schema: 'wg.match/9' })],
    ['wrong rules', (r: MatchRecord) => ({ ...r, rulesVersion: 'ember-six/0.2' })],
    ['ranked claim', (r: MatchRecord) => ({ ...r, ranked: true })],
    ['completed but not terminal', (r: MatchRecord) => ({ ...r, status: 'completed' })],
    ['unknown AI level', (r: MatchRecord) => ({ ...r, players: { ...r.players, second: { id: 'ai:x', kind: 'ai', name: 'x', ai: { engine: 'e', level: 'grandmaster' } } } })],
    ['practice mismatch', (r: MatchRecord) => ({ ...r, practice: true })],
  ])('rejects %s', (_l, mutate) => {
    expect(validateMatchRecord(mutate(sample()) as unknown).ok).toBe(false);
  });
});

describe('save / restore', () => {
  const setupRecord = () => {
    const { c } = controller();
    c.start(HVA, 11);
    c.play(a('c2-c3'));
    return { setup: HVA, record: c.record() };
  };
  it('round trips a current match and archive through storage', () => {
    const store = new MemoryStore();
    const fin = (() => {
      const { c } = controller();
      const s = Game.fromPosition('6/6/6/2a3/2A3/6 1 2-2 0 0');
      if (!s.ok) throw new Error('x');
      c.start(HVH, 1, s.value);
      c.play(a('c2xc3'));
      return c.record();
    })();
    let file: SaveFile = { ...emptySave('human:p', 'now'), current: setupRecord() };
    file = archiveRecord(file, fin);
    file = archiveRecord(file, fin); // idempotent
    expect(writeSave(store, file)).toBeNull();
    const loaded = loadSave(store, () => 'human:new', 'later');
    expect(loaded.warnings).toEqual([]);
    expect(loaded.file.profileId).toBe('human:p');
    expect(loaded.file.archive.length).toBe(1);
    expect(loaded.currentGame?.ply).toBe(1);
    expect(loaded.currentGame?.digest()).toBe(file.current!.record.finalDigest);
    // controller resumes and the AI then moves
    const { c, clock } = controller();
    c.resume(loaded.file.current!.setup, loaded.file.current!.record, loaded.currentGame!);
    expect(c.matchId).toBe(file.current!.record.matchId);
    return clock.flush().then(() => expect(c.game.ply).toBe(2));
  });

  it('missing save gives an empty file without warnings', () => {
    const l = loadSave(new MemoryStore(), () => 'human:x', 'now');
    expect(l.file.current).toBeNull();
    expect(l.warnings).toEqual([]);
  });

  it('corrupt JSON is backed up and reported, never silently lost', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{"schema": "wg.save/1", oops');
    const l = loadSave(store, () => 'human:x', '2026-11-03T01:02:03Z');
    expect(l.warnings[0]).toMatch(/damaged/);
    const backups = [...store.map.keys()].filter((k) => k.startsWith(BACKUP_PREFIX));
    expect(backups.length).toBe(1);
    expect(store.getItem(backups[0]!)).toContain('oops');
  });

  it('a save from an unknown/newer schema is preserved and reported', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, JSON.stringify({ schema: 'wg.save/2' }));
    const l = loadSave(store, () => 'human:x', 't');
    expect(l.warnings[0]).toMatch(/unsupported format/);
    expect([...store.map.keys()].some((k) => k.startsWith(BACKUP_PREFIX))).toBe(true);
  });

  it('a tampered current match is rejected with a warning; good archive records survive, bad ones are skipped', () => {
    const store = new MemoryStore();
    const cur = setupRecord();
    const bad = { ...cur, record: { ...cur.record, actions: ['a1-a3'] } };
    const file = { ...emptySave('human:p', 'now'), current: bad, archive: [{ broken: true } as unknown as MatchRecord] };
    store.setItem(SAVE_KEY, JSON.stringify(file));
    const l = loadSave(store, () => 'human:x', 't');
    expect(l.file.current).toBeNull();
    expect(l.warnings.join(' ')).toMatch(/could not be restored/);
    expect(l.warnings.join(' ')).toMatch(/1 archived match record/);
  });

  it('storage that throws is reported, not fatal', () => {
    const store = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const l = loadSave(store, () => 'human:x', 't');
    expect(l.warnings[0]).toMatch(/unavailable/);
    expect(writeSave(store, l.file)).toMatch(/Could not save/);
  });

  it('export / import validates every record by replay', () => {
    const { c } = controller();
    const s = Game.fromPosition('6/6/6/2a3/2A3/6 1 2-2 0 0');
    if (!s.ok) throw new Error('x');
    c.start(HVH, 1, s.value);
    c.play(a('c2xc3'));
    const file = archiveRecord(emptySave('human:p', 'now'), c.record());
    const text = exportArchive(file, 'now');
    expect(importArchive(text).records.length).toBe(1);
    const tampered = text.replace('c2xc3', 'c2-c4');
    const r = importArchive(tampered);
    expect(r.records.length).toBe(0);
    expect(r.problems.length).toBe(1);
    expect(importArchive('nope').problems[0]).toMatch(/JSON/);
  });

  it('record digest uses the shared canonical hash', () => {
    const r = setupRecord().record;
    const g = Game.fromRecord({ rulesVersion: r.rulesVersion, start: r.start, actions: r.actions });
    expect(g.ok && g.value.digest()).toBe(r.finalDigest);
    expect(internal.CANONICAL_LENGTH).toBe(44);
  });
});
