/** Dedicated AI Web Worker: validated replay of the record, then search. */
import { Game } from '../rules/game.ts';
import { think } from './search.ts';
import type { ThinkRequest, ThinkResponse } from './protocol.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (ev: MessageEvent<ThinkRequest>) => {
  const req = ev.data;
  let res: ThinkResponse;
  try {
    const g = Game.fromRecord(req.record);
    if (!g.ok) throw new Error(`invalid record: ${g.error.message}`);
    const t0 = performance.now();
    const r = think(g.value, req.level, req.seed);
    res = {
      type: 'move', requestId: req.requestId, action: r.action, digest: g.value.digest(),
      stats: { depth: r.depth, nodes: r.nodes, score: r.score, ms: Math.round(performance.now() - t0), engine: r.engine },
    };
  } catch (e) {
    res = { type: 'error', requestId: req.requestId, message: e instanceof Error ? e.message : String(e) };
  }
  scope.postMessage(res);
};
