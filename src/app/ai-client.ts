/** Main-thread wrapper around the AI Web Worker (implements the controller's AiPort). */
import type { AiPort, AiReply } from '../match/controller.ts';
import type { ThinkRequest, ThinkResponse } from '../ai/protocol.ts';
import type { GameRecord } from '../rules/game.ts';
import type { LevelId } from '../ai/search.ts';

export class WorkerAi implements AiPort {
  #worker: Worker | null = null;
  #next = 1;
  #pending = new Map<number, { resolve: (r: AiReply) => void; reject: (e: Error) => void }>();

  #spawn(): Worker {
    const w = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<ThinkResponse>) => {
      const res = ev.data;
      const p = this.#pending.get(res.requestId);
      if (!p) return; // stale (cancelled) request
      this.#pending.delete(res.requestId);
      if (res.type === 'move') p.resolve({ action: res.action, stats: res.stats });
      else p.reject(new Error(res.message));
    };
    w.onerror = (ev) => {
      const err = new Error(ev.message || 'AI worker crashed');
      for (const p of this.#pending.values()) p.reject(err);
      this.#pending.clear();
      this.#worker = null;
    };
    return w;
  }

  think(record: GameRecord, level: LevelId, seed: number): Promise<AiReply> {
    this.#worker ??= this.#spawn();
    const requestId = this.#next++;
    const req: ThinkRequest = { type: 'think', requestId, record, level, seed };
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      this.#worker!.postMessage(req);
    });
  }

  /** Hard cancel: the search is synchronous inside the worker, so terminate it. */
  cancel(): void {
    if (this.#pending.size === 0) return;
    this.#worker?.terminate();
    this.#worker = null;
    const err = new Error('cancelled');
    for (const p of this.#pending.values()) p.reject(err);
    this.#pending.clear();
  }

  dispose(): void { this.cancel(); this.#worker?.terminate(); this.#worker = null; }
}
