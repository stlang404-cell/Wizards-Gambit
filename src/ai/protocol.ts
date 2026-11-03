import type { GameRecord } from '../rules/game.ts';
import type { Action } from '../rules/actions.ts';
import type { LevelId } from './search.ts';

/** Main thread -> worker. The worker rebuilds the game from the record (validated replay). */
export interface ThinkRequest {
  readonly type: 'think';
  readonly requestId: number;
  readonly record: GameRecord;
  readonly level: LevelId;
  readonly seed: number;
}
export interface ThinkStats {
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
  readonly ms: number;
  readonly engine: string;
}
/** Worker -> main thread. */
export type ThinkResponse =
  | { readonly type: 'move'; readonly requestId: number; readonly action: Action; readonly stats: ThinkStats; readonly digest: string }
  | { readonly type: 'error'; readonly requestId: number; readonly message: string };
