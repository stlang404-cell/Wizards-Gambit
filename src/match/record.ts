/**
 * Versioned match records. Every finished (or abandoned / in-progress) match
 * is described by a self-contained, replayable record. M3 ratings,
 * standings and career histories are meant to be computed from these
 * records alone; nothing here computes ratings.
 */
import { RULES_VERSION } from '../rules/constants.ts';
import { Game, type Result, type RulesError } from '../rules/game.ts';
import type { Outcome } from '../rules/terminal.ts';
import { LEVELS, type LevelId } from '../ai/search.ts';

export const MATCH_SCHEMA = 'wg.match/1' as const;
export const APP_VERSION = '0.1.0-m1';

export type MatchMode = 'human-vs-ai' | 'human-vs-human' | 'ai-vs-ai';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type ResultCode = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface PlayerInfo {
  /** Stable identity: 'human:<uuid>' for the local profile, 'ai:<level>@<engine>' for engines. */
  readonly id: string;
  readonly kind: 'human' | 'ai';
  readonly name: string;
  /** Present for AI seats: exact policy needed to reproduce its choices. */
  readonly ai?: { readonly engine: string; readonly level: LevelId };
}

export interface MatchRecord {
  readonly schema: typeof MATCH_SCHEMA;
  readonly matchId: string;
  readonly appVersion: string;
  readonly rulesVersion: typeof RULES_VERSION;
  readonly mode: MatchMode;
  /** M1 has no rated play. Future pools: 'standard', 'fast', 'forge'. */
  readonly ratingPool: 'unrated';
  readonly ranked: false;
  readonly timeControl: { readonly kind: 'untimed' };
  readonly createdAt: string;
  readonly endedAt: string | null;
  readonly players: { readonly first: PlayerInfo; readonly second: PlayerInfo };
  /** Start position notation and every action actually in the final line (undone actions removed). */
  readonly start: string;
  readonly actions: readonly string[];
  readonly status: MatchStatus;
  readonly outcome: Outcome | null;
  readonly result: ResultCode;
  readonly plies: number;
  /** SHA-256 of the canonical bytes of the final position. */
  readonly finalDigest: string;
  /** Number of undo operations; any undo marks the match as practice. */
  readonly undoCount: number;
  readonly practice: boolean;
  /** Match seed; AI move seeds are moveSeed(seed, ply). */
  readonly seed: number;
}

export function resultCode(o: Outcome | null): ResultCode {
  if (!o) return '*';
  return o.winner === 1 ? '1-0' : o.winner === -1 ? '0-1' : '1/2-1/2';
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (message: string, details?: string[]): { ok: false; error: RulesError } => ({
  ok: false, error: details ? { code: 'invalid-record', message, details } : { code: 'invalid-record', message },
});

function checkPlayer(x: unknown, label: string, errors: string[]): void {
  if (typeof x !== 'object' || x === null) { errors.push(`${label} missing`); return; }
  const p = x as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) errors.push(`${label}.id must be a non-empty string`);
  if (p.kind !== 'human' && p.kind !== 'ai') errors.push(`${label}.kind must be human or ai`);
  if (typeof p.name !== 'string') errors.push(`${label}.name must be a string`);
  if (p.kind === 'ai') {
    const ai = p.ai as Record<string, unknown> | undefined;
    if (!ai || typeof ai.engine !== 'string' || typeof ai.level !== 'string' || !(ai.level in LEVELS)) {
      errors.push(`${label}.ai must name an engine and a known level`);
    }
  }
}

/**
 * Validates a record's structure and replays it with the rules engine.
 * Consistency checks: outcome/result/plies/digest must match the replay;
 * 'completed' requires a terminal outcome and 'in-progress' forbids one.
 */
export function validateMatchRecord(input: unknown): Result<{ record: MatchRecord; game: Game }> {
  if (typeof input !== 'object' || input === null) return bad('record must be an object');
  const r = input as Record<string, unknown>;
  if (r.schema !== MATCH_SCHEMA) return bad(`unsupported match schema ${JSON.stringify(r.schema)}`);
  const errors: string[] = [];
  if (r.rulesVersion !== RULES_VERSION) errors.push(`unsupported rulesVersion ${JSON.stringify(r.rulesVersion)}`);
  if (typeof r.matchId !== 'string' || !r.matchId) errors.push('matchId must be a non-empty string');
  if (!['human-vs-ai', 'human-vs-human', 'ai-vs-ai'].includes(r.mode as string)) errors.push('unknown mode');
  if (!['in-progress', 'completed', 'abandoned'].includes(r.status as string)) errors.push('unknown status');
  if (r.ranked !== false || r.ratingPool !== 'unrated') errors.push('M1 records must be unranked');
  if (typeof r.seed !== 'number' || !Number.isInteger(r.seed)) errors.push('seed must be an integer');
  if (typeof r.undoCount !== 'number' || !Number.isInteger(r.undoCount) || r.undoCount < 0) errors.push('undoCount must be a non-negative integer');
  if (typeof r.createdAt !== 'string') errors.push('createdAt must be an ISO string');
  const players = r.players as Record<string, unknown> | undefined;
  checkPlayer(players?.first, 'players.first', errors);
  checkPlayer(players?.second, 'players.second', errors);
  if (errors.length) return bad('record failed validation', errors);
  const replay = Game.fromRecord({ rulesVersion: r.rulesVersion, start: r.start, actions: r.actions });
  if (!replay.ok) return bad(`replay failed: ${replay.error.message}`);
  const g = replay.value;
  const outcome = g.outcome;
  if (JSON.stringify(outcome) !== JSON.stringify(r.outcome ?? null)) errors.push('outcome does not match replay');
  if (r.result !== resultCode(outcome)) errors.push('result does not match replay');
  if (r.plies !== g.actions().length) errors.push('plies does not match replay');
  if (r.finalDigest !== g.digest()) errors.push('finalDigest does not match replay');
  if (r.status === 'completed' && !outcome) errors.push('completed record has no terminal outcome');
  if (r.status === 'in-progress' && outcome) errors.push('in-progress record is already terminal');
  if (r.practice !== (r.undoCount as number) > 0) errors.push('practice flag must equal undoCount > 0');
  if (errors.length) return bad('record is inconsistent with its replay', errors);
  return ok({ record: input as MatchRecord, game: g });
}
