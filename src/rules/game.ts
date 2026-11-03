import { RULES_VERSION } from './constants.ts';
import {
  decodeAction, encodeAction, formatAction, isLegalAction, isWellFormedAction, legalActionCodes, makeUnchecked,
  parseAction, type Action, type ActionCode,
} from './actions.ts';
import { clonePosition, initialPosition, type Position } from './position.ts';
import { formatPosition, positionDigest, repetitionKey } from './serialize.ts';
import { adjudicate, type Outcome } from './terminal.ts';
import { toPositionData, validatePosition, type PositionData } from './validate.ts';

export type RulesErrorCode = 'invalid-position' | 'malformed-action' | 'illegal-action' | 'game-over' | 'invalid-record';
export interface RulesError {
  readonly code: RulesErrorCode;
  readonly message: string;
  readonly details?: readonly string[];
}
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RulesError };

const fail = (code: RulesErrorCode, message: string, details?: string[]): { ok: false; error: RulesError } => ({
  ok: false,
  error: details ? { code, message, details } : { code, message },
});

/** Serializable game record: start position plus every action in order. */
export interface GameRecord {
  readonly rulesVersion: typeof RULES_VERSION;
  readonly start: string; // position notation
  readonly actions: readonly string[]; // action notation
}

/**
 * Public, validated, immutable game value. Every successful play returns a
 * new Game that retains its parent (so undo is exact and trivially correct)
 * and its full repetition history. Input from UI, saves or workers should
 * enter through this class; the unchecked make/unmake functions are for
 * internal search and perft only.
 */
export class Game {
  readonly #pos: Position;
  readonly #counts: ReadonlyMap<string, number>;
  readonly #parent: Game | null;
  readonly #last: ActionCode | null;
  readonly #start: string;
  readonly #outcome: Outcome | null;

  private constructor(pos: Position, counts: ReadonlyMap<string, number>, parent: Game | null, last: ActionCode | null, start: string) {
    this.#pos = pos;
    this.#counts = counts;
    this.#parent = parent;
    this.#last = last;
    this.#start = start;
    this.#outcome = adjudicate(pos, counts.get(repetitionKey(pos)) ?? 0);
  }

  /** Standard Ember Six start. */
  static initial(): Game {
    return Game.#fromTrusted(initialPosition());
  }

  /**
   * Start from an arbitrary validated position (notation string or
   * PositionData). Its repetition history begins with this position only.
   */
  static fromPosition(input: unknown): Result<Game> {
    const v = validatePosition(input);
    if (!v.ok) return fail('invalid-position', 'position failed validation', v.errors);
    return { ok: true, value: Game.#fromTrusted(v.position) };
  }

  static #fromTrusted(pos: Position): Game {
    return new Game(pos, new Map([[repetitionKey(pos), 1]]), null, null, formatPosition(pos));
  }

  /** Rebuilds a game by validating the start and replaying every action. */
  static fromRecord(record: unknown): Result<Game> {
    if (typeof record !== 'object' || record === null) return fail('invalid-record', 'record must be an object');
    const r = record as Record<string, unknown>;
    if (r.rulesVersion !== RULES_VERSION) return fail('invalid-record', `unsupported rulesVersion ${JSON.stringify(r.rulesVersion)}`);
    if (typeof r.start !== 'string' || !Array.isArray(r.actions)) return fail('invalid-record', 'record needs start string and actions array');
    const started = Game.fromPosition(r.start);
    if (!started.ok) return started;
    let g = started.value;
    for (let i = 0; i < r.actions.length; i++) {
      const text: unknown = r.actions[i];
      const a = typeof text === 'string' ? parseAction(text) : null;
      if (!a) return fail('invalid-record', `action ${i} is not valid notation`);
      const next = g.play(a);
      if (!next.ok) return fail('invalid-record', `action ${i} (${String(text)}): ${next.error.message}`);
      g = next.value;
    }
    return { ok: true, value: g };
  }

  get rulesVersion(): typeof RULES_VERSION { return RULES_VERSION; }
  /** Null while the game is in progress. */
  get outcome(): Outcome | null { return this.#outcome; }
  get isOver(): boolean { return this.#outcome !== null; }
  get side(): 1 | -1 { return this.#pos.side; }
  get ply(): number { return this.#pos.totalPly; }

  /** Defensive copy of the current position. */
  position(): PositionData { return toPositionData(this.#pos); }
  notation(): string { return formatPosition(this.#pos); }
  /** SHA-256 of the canonical bytes of the current position. */
  digest(): string { return positionDigest(this.#pos); }
  /** Occurrences of the current (board, side, seals) identity in this game, including now. */
  repetitionCount(): number { return this.#counts.get(repetitionKey(this.#pos)) ?? 0; }

  /** Legal actions in canonical order; empty once the game is over. */
  legalActions(): Action[] {
    if (this.#outcome) return [];
    return legalActionCodes(this.#pos).map(decodeAction);
  }

  isLegal(action: unknown): boolean {
    return !this.#outcome && isWellFormedAction(action) && isLegalAction(this.#pos, action);
  }

  /** Validated apply. Rejects malformed, illegal or post-terminal actions. */
  play(action: unknown): Result<Game> {
    if (this.#outcome) return fail('game-over', `game is over (${this.#outcome.reason})`);
    if (!isWellFormedAction(action)) {
      return fail('malformed-action', 'expected {kind:"move",from,to} or {kind:"concord",lo,hi} with integer squares 0..35, from!==to, lo<hi');
    }
    if (!isLegalAction(this.#pos, action)) return fail('illegal-action', `${formatAction(action, this.#pos.board)} is not legal here`);
    const next = clonePosition(this.#pos);
    const code = encodeAction(action);
    makeUnchecked(next, code);
    const key = repetitionKey(next);
    const counts = new Map(this.#counts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { ok: true, value: new Game(next, counts, this, code, this.#start) };
  }

  /** Parent game (local analysis undo; carries no ranked meaning). Null at the start. */
  undo(): Game | null { return this.#parent; }

  /** Actions played since the start position, oldest first. */
  actions(): Action[] {
    const codes: ActionCode[] = [];
    for (let g: Game | null = this; g && g.#last !== null; g = g.#parent) codes.push(g.#last);
    return codes.reverse().map(decodeAction);
  }

  toRecord(): GameRecord {
    const notes: string[] = [];
    const chain: Game[] = [];
    for (let g: Game | null = this; g; g = g.#parent) chain.push(g);
    chain.reverse();
    for (let i = 1; i < chain.length; i++) {
      notes.push(formatAction(decodeAction(chain[i]!.#last!), chain[i - 1]!.#pos.board));
    }
    return { rulesVersion: RULES_VERSION, start: this.#start, actions: notes };
  }
}
