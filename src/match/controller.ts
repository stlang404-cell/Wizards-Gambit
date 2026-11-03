/**
 * Match orchestration: seats (human / AI), turn flow, AI requests, undo,
 * pause/speed for exhibitions, and record production. Framework-free and
 * deterministic given its injected ports, so it is unit-tested in Node.
 *
 * Stale-response protection: every AI request captures `generation`. Undo,
 * restart, load and pause bump it, so a late worker reply is discarded. A
 * reply is also rejected unless it is legal in the CURRENT game.
 */
import { RULES_VERSION } from '../rules/constants.ts';
import { Game, type GameRecord } from '../rules/game.ts';
import { formatAction, type Action } from '../rules/actions.ts';
import { AI_ENGINE_VERSION, LEVELS, moveSeed, type LevelId } from '../ai/search.ts';
import {
  APP_VERSION, MATCH_SCHEMA, resultCode, type MatchMode, type MatchRecord, type PlayerInfo,
} from './record.ts';

export type Seat = { readonly kind: 'human'; readonly name: string } | { readonly kind: 'ai'; readonly level: LevelId; readonly name: string };

export interface MatchSetup {
  readonly mode: MatchMode;
  readonly first: Seat;
  readonly second: Seat;
  /** Undo permitted (practice). Never allowed in ai-vs-ai. */
  readonly allowUndo: boolean;
}

export interface AiReply {
  readonly action: Action;
  readonly stats?: { readonly depth: number; readonly nodes: number; readonly score: number; readonly ms: number };
}
export interface AiPort {
  think(record: GameRecord, level: LevelId, seed: number): Promise<AiReply>;
  /** Abandon any in-flight computation (e.g. terminate and respawn a worker). */
  cancel(): void;
}

export interface ControllerPorts {
  readonly ai: AiPort;
  readonly newId: () => string;
  readonly now: () => string;
  readonly humanId: string;
  /** Schedules fn after ms; returns a cancel function. */
  readonly schedule: (fn: () => void, ms: number) => () => void;
}

export type MatchEvent =
  | { readonly type: 'move'; readonly action: Action; readonly before: Game; readonly after: Game; readonly by: 'human' | 'ai' }
  | { readonly type: 'undo'; readonly game: Game }
  | { readonly type: 'reset'; readonly game: Game }
  | { readonly type: 'thinking'; readonly side: 1 | -1 }
  | { readonly type: 'over'; readonly game: Game }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'paused'; readonly paused: boolean };

export const SPEEDS = { slow: 1400, normal: 700, fast: 250, instant: 0 } as const;
export type Speed = keyof typeof SPEEDS;

export class MatchController {
  #ports: ControllerPorts;
  #listeners = new Set<(e: MatchEvent) => void>();
  #setup!: MatchSetup;
  #game!: Game;
  #matchId = '';
  #createdAt = '';
  #endedAt: string | null = null;
  #seed = 0;
  #undoCount = 0;
  #generation = 0;
  #thinking = false;
  #paused = false;
  #cancelTimer: (() => void) | null = null;
  #speed: Speed = 'normal';
  #lastStats: AiReply['stats'] | null = null;

  constructor(ports: ControllerPorts) {
    this.#ports = ports;
  }

  on(fn: (e: MatchEvent) => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
  #emit(e: MatchEvent): void {
    for (const fn of this.#listeners) fn(e);
  }

  get game(): Game { return this.#game; }
  get setup(): MatchSetup { return this.#setup; }
  get thinking(): boolean { return this.#thinking; }
  get paused(): boolean { return this.#paused; }
  get speed(): Speed { return this.#speed; }
  get undoCount(): number { return this.#undoCount; }
  get matchId(): string { return this.#matchId; }
  get lastAiStats(): AiReply['stats'] | null { return this.#lastStats; }

  seatFor(side: 1 | -1): Seat { return side === 1 ? this.#setup.first : this.#setup.second; }
  isHumanTurn(): boolean { return !this.#game.isOver && this.seatFor(this.#game.side).kind === 'human'; }
  canUndo(): boolean {
    if (!this.#setup.allowUndo || this.#setup.mode === 'ai-vs-ai') return false;
    return this.#game.undo() !== null && this.#lastHumanUndoTarget() !== null;
  }

  /** Begin a fresh match from the standard start (or a given validated game). */
  start(setup: MatchSetup, seed: number, from: Game = Game.initial()): void {
    this.#invalidate();
    this.#setup = setup.mode === 'ai-vs-ai' ? { ...setup, allowUndo: false } : setup;
    this.#game = from;
    this.#matchId = this.#ports.newId();
    this.#createdAt = this.#ports.now();
    this.#endedAt = null;
    this.#seed = seed >>> 0;
    this.#undoCount = 0;
    this.#paused = false;
    this.#lastStats = null;
    this.#emit({ type: 'reset', game: this.#game });
    this.#afterChange();
  }

  /** Resume a saved, validated in-progress (or finished) match. */
  resume(setup: MatchSetup, record: MatchRecord, game: Game): void {
    this.#invalidate();
    this.#setup = setup;
    this.#game = game;
    this.#matchId = record.matchId;
    this.#createdAt = record.createdAt;
    this.#endedAt = record.endedAt;
    this.#seed = record.seed;
    this.#undoCount = record.undoCount;
    this.#paused = setup.mode === 'ai-vs-ai'; // exhibitions resume paused
    this.#lastStats = null;
    this.#emit({ type: 'reset', game });
    if (this.#paused) this.#emit({ type: 'paused', paused: true });
    this.#afterChange();
  }

  restart(seed: number): void {
    this.start(this.#setup, seed);
  }

  /** Human action. Returns an error string, or null on success. */
  play(action: unknown): string | null {
    if (this.#game.isOver) return 'The match is over.';
    if (!this.isHumanTurn()) return 'It is not your turn.';
    const before = this.#game;
    const r = before.play(action);
    if (!r.ok) return r.error.message;
    this.#apply(before, r.value, r.value.actions().at(-1)!, 'human');
    return null;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    const target = this.#lastHumanUndoTarget()!;
    this.#invalidate();
    this.#game = target;
    this.#undoCount++;
    this.#endedAt = null;
    this.#emit({ type: 'undo', game: target });
    this.#afterChange();
    return true;
  }

  pause(): void {
    if (this.#paused) return;
    this.#paused = true;
    this.#invalidate();
    this.#emit({ type: 'paused', paused: true });
  }
  resumePlay(): void {
    if (!this.#paused) return;
    this.#paused = false;
    this.#emit({ type: 'paused', paused: false });
    this.#afterChange();
  }
  setSpeed(s: Speed): void { this.#speed = s; }

  /** Ends this controller's involvement (e.g. leaving the screen). */
  dispose(): void { this.#invalidate(); this.#listeners.clear(); }

  /** Undo target: pop one ply in hot-seat; in human-vs-ai pop until a human seat is to move. */
  #lastHumanUndoTarget(): Game | null {
    let g = this.#game.undo();
    if (!g) return null;
    if (this.#setup.mode === 'human-vs-human') return g;
    while (g && this.seatFor(g.side).kind !== 'human') g = g.undo();
    return g;
  }

  #invalidate(): void {
    this.#generation++;
    if (this.#cancelTimer) { this.#cancelTimer(); this.#cancelTimer = null; }
    if (this.#thinking) { this.#ports.ai.cancel(); this.#thinking = false; }
  }

  #apply(before: Game, after: Game, action: Action, by: 'human' | 'ai'): void {
    this.#game = after;
    if (after.isOver) this.#endedAt = this.#ports.now();
    this.#emit({ type: 'move', action, before, after, by });
    if (after.isOver) this.#emit({ type: 'over', game: after });
    this.#afterChange();
  }

  #afterChange(): void {
    const g = this.#game;
    if (g.isOver || this.#paused) return;
    const seat = this.seatFor(g.side);
    if (seat.kind !== 'ai') return;
    const gen = this.#generation;
    const delay = this.#setup.mode === 'ai-vs-ai' ? SPEEDS[this.#speed] : 250;
    this.#cancelTimer = this.#ports.schedule(() => {
      this.#cancelTimer = null;
      if (gen !== this.#generation) return;
      this.#thinking = true;
      this.#emit({ type: 'thinking', side: g.side });
      this.#ports.ai.think(g.toRecord(), seat.level, moveSeed(this.#seed, g.ply)).then(
        (reply) => {
          if (gen !== this.#generation || this.#game !== g) return; // stale
          this.#thinking = false;
          this.#lastStats = reply.stats ?? null;
          const r = g.play(reply.action);
          if (!r.ok) { this.#emit({ type: 'error', message: `AI proposed an illegal action: ${r.error.message}` }); return; }
          this.#apply(g, r.value, reply.action, 'ai');
        },
        (err: unknown) => {
          if (gen !== this.#generation) return;
          this.#thinking = false;
          this.#emit({ type: 'error', message: `AI failed: ${err instanceof Error ? err.message : String(err)}` });
        },
      );
    }, delay);
  }

  playerInfo(side: 1 | -1): PlayerInfo {
    const seat = this.seatFor(side);
    if (seat.kind === 'human') {
      const id = this.#setup.mode === 'human-vs-human' ? `${this.#ports.humanId}#${side === 1 ? 1 : 2}` : this.#ports.humanId;
      return { id, kind: 'human', name: seat.name };
    }
    return { id: `ai:${seat.level}@${AI_ENGINE_VERSION}`, kind: 'ai', name: seat.name, ai: { engine: AI_ENGINE_VERSION, level: seat.level } };
  }

  /** Versioned record of the current line (undone actions excluded). */
  record(status?: 'abandoned'): MatchRecord {
    const g = this.#game;
    const rec = g.toRecord();
    return {
      schema: MATCH_SCHEMA, matchId: this.#matchId, appVersion: APP_VERSION, rulesVersion: RULES_VERSION,
      mode: this.#setup.mode, ratingPool: 'unrated', ranked: false, timeControl: { kind: 'untimed' },
      createdAt: this.#createdAt, endedAt: status === 'abandoned' ? this.#ports.now() : this.#endedAt,
      players: { first: this.playerInfo(1), second: this.playerInfo(-1) },
      start: rec.start, actions: rec.actions,
      status: g.isOver ? 'completed' : status ?? 'in-progress',
      outcome: g.outcome, result: resultCode(g.outcome), plies: rec.actions.length, finalDigest: g.digest(),
      undoCount: this.#undoCount, practice: this.#undoCount > 0, seed: this.#seed,
    };
  }
}

/** Human-readable move list entries ("1. d1-c3  d5~d6"). */
export function moveList(game: Game): string[] {
  const out: string[] = [];
  const chain: Game[] = [];
  for (let g: Game | null = game; g; g = g.undo()) chain.unshift(g);
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i]!.actions().at(-1)!;
    out.push(formatAction(a, chain[i - 1]!.position().board));
  }
  return out;
}

export function levelLabel(level: LevelId): string { return LEVELS[level].label; }
