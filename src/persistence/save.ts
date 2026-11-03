/**
 * Versioned local save (M1). One JSON document in a key-value store
 * (window.localStorage in the app, an in-memory map in tests):
 *   current match (record + seat setup), an archive of finished match
 *   records, the local profile id and UI settings.
 *
 * Loading never trusts the stored bytes: every record is re-validated by
 * replaying it through the rules engine. Damaged or unknown-version data
 * is copied to a backup key and reported, never silently overwritten.
 * Browser storage can be cleared by the user or the browser; this is not a
 * permanent archive (use Export).
 */
import { validateMatchRecord, type MatchRecord } from '../match/record.ts';
import type { MatchSetup, Seat } from '../match/controller.ts';
import { LEVELS } from '../ai/search.ts';
import type { Game } from '../rules/game.ts';

export const SAVE_SCHEMA = 'wg.save/1' as const;
export const SAVE_KEY = 'wizards-gambit.save';
export const BACKUP_PREFIX = 'wizards-gambit.backup.';
export const ARCHIVE_LIMIT = 200;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Settings {
  readonly showCoordinates: boolean;
  readonly letterOverlay: boolean;
  readonly hints: boolean;
  readonly animations: boolean;
  readonly autoRotate: boolean;
}
export const DEFAULT_SETTINGS: Settings = { showCoordinates: true, letterOverlay: false, hints: true, animations: true, autoRotate: false };

export interface SaveFile {
  readonly schema: typeof SAVE_SCHEMA;
  readonly savedAt: string;
  readonly profileId: string;
  readonly settings: Settings;
  readonly current: { readonly setup: MatchSetup; readonly record: MatchRecord } | null;
  readonly archive: readonly MatchRecord[];
  readonly tutorialDone: readonly string[];
}

export interface LoadedSave {
  readonly file: SaveFile;
  /** The validated current game, if one was restored. */
  readonly currentGame: Game | null;
  readonly warnings: readonly string[];
}

export function emptySave(profileId: string, now: string): SaveFile {
  return { schema: SAVE_SCHEMA, savedAt: now, profileId, settings: DEFAULT_SETTINGS, current: null, archive: [], tutorialDone: [] };
}

function validSeat(x: unknown): x is Seat {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  if (typeof s.name !== 'string') return false;
  if (s.kind === 'human') return true;
  return s.kind === 'ai' && typeof s.level === 'string' && s.level in LEVELS;
}
function validSetup(x: unknown): x is MatchSetup {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return ['human-vs-ai', 'human-vs-human', 'ai-vs-ai'].includes(s.mode as string)
    && validSeat(s.first) && validSeat(s.second) && typeof s.allowUndo === 'boolean';
}
function readSettings(x: unknown): Settings {
  const out: Record<string, boolean> = { ...DEFAULT_SETTINGS };
  if (typeof x === 'object' && x !== null) {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const v = (x as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out as unknown as Settings;
}

function backup(store: KeyValueStore, raw: string, now: string): string {
  const key = `${BACKUP_PREFIX}${now.replace(/[^0-9]/g, '')}`;
  try { store.setItem(key, raw); } catch { /* storage full: report only */ }
  return key;
}

export function loadSave(store: KeyValueStore, freshProfileId: () => string, now: string): LoadedSave {
  const warnings: string[] = [];
  let raw: string | null = null;
  try { raw = store.getItem(SAVE_KEY); } catch { warnings.push('Browser storage is unavailable; progress will not be saved.'); }
  if (raw === null) return { file: emptySave(freshProfileId(), now), currentGame: null, warnings };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    const k = backup(store, raw, now);
    warnings.push(`The save data was damaged and could not be read. A copy was kept under "${k}". Starting fresh.`);
    return { file: emptySave(freshProfileId(), now), currentGame: null, warnings };
  }
  const o = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>;
  if (o.schema !== SAVE_SCHEMA) {
    const k = backup(store, raw, now);
    warnings.push(`The save uses an unsupported format (${JSON.stringify(o.schema)}), possibly from a newer version. A copy was kept under "${k}". Starting fresh.`);
    return { file: emptySave(freshProfileId(), now), currentGame: null, warnings };
  }
  const profileId = typeof o.profileId === 'string' && o.profileId ? o.profileId : freshProfileId();
  const archive: MatchRecord[] = [];
  let dropped = 0;
  if (Array.isArray(o.archive)) {
    for (const rec of o.archive) {
      const v = validateMatchRecord(rec);
      if (v.ok && v.value.record.status !== 'in-progress') archive.push(v.value.record);
      else dropped++;
    }
  }
  if (dropped) warnings.push(`${dropped} archived match record(s) failed validation and were skipped.`);
  let current: SaveFile['current'] = null;
  let currentGame: Game | null = null;
  const cur = o.current as Record<string, unknown> | null | undefined;
  if (cur) {
    const v = validateMatchRecord(cur.record);
    if (v.ok && validSetup(cur.setup) && cur.setup.mode === v.value.record.mode) {
      current = { setup: cur.setup, record: v.value.record };
      currentGame = v.value.game;
    } else {
      const k = backup(store, raw, now);
      warnings.push(`The saved match could not be restored (${v.ok ? 'seat setup invalid' : v.error.message}). A copy was kept under "${k}".`);
    }
  }
  const tutorialDone = Array.isArray(o.tutorialDone) ? o.tutorialDone.filter((x): x is string => typeof x === 'string') : [];
  const file: SaveFile = {
    schema: SAVE_SCHEMA, savedAt: typeof o.savedAt === 'string' ? o.savedAt : now, profileId,
    settings: readSettings(o.settings), current, archive, tutorialDone,
  };
  return { file, currentGame, warnings };
}

/** Writes the save. Returns an error message if storage refused it. */
export function writeSave(store: KeyValueStore, file: SaveFile): string | null {
  const trimmed: SaveFile = { ...file, archive: file.archive.slice(-ARCHIVE_LIMIT) };
  try {
    store.setItem(SAVE_KEY, JSON.stringify(trimmed));
    return null;
  } catch (e) {
    return `Could not save: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Adds a finished record to the archive (idempotent by matchId). */
export function archiveRecord(file: SaveFile, rec: MatchRecord): SaveFile {
  if (rec.status === 'in-progress') return file;
  const rest = file.archive.filter((r) => r.matchId !== rec.matchId);
  return { ...file, archive: [...rest, rec] };
}

/** Export document for manual backup / sharing of match records. */
export function exportArchive(file: SaveFile, now: string): string {
  return JSON.stringify({ schema: 'wg.archive/1', exportedAt: now, profileId: file.profileId, matches: file.archive }, null, 1);
}

/** Import: validate every record by replay; returns accepted records and problems. */
export function importArchive(text: string): { records: MatchRecord[]; problems: string[] } {
  const problems: string[] = [];
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return { records: [], problems: ['File is not valid JSON.'] }; }
  const d = doc as Record<string, unknown>;
  if (d?.schema !== 'wg.archive/1' || !Array.isArray(d.matches)) return { records: [], problems: ['Not a Wizard’s Gambit archive (wg.archive/1).'] };
  const records: MatchRecord[] = [];
  d.matches.forEach((m, i) => {
    const v = validateMatchRecord(m);
    if (v.ok && v.value.record.status !== 'in-progress') records.push(v.value.record);
    else problems.push(`match ${i}: ${v.ok ? 'in-progress records are not archived' : v.error.message}`);
  });
  return { records, problems };
}

/** In-memory store for tests and storage-less browsers. */
export class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, v); }
  removeItem(k: string): void { this.map.delete(k); }
}
