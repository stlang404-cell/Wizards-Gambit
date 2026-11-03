/**
 * Color-paired AI level benchmark (Node, worker_threads, no build step):
 *   node --experimental-strip-types tools/ai-bench.ts <levelA> <levelB> <pairs> <seedBase> <out.json> [threads=4] [openingPlies=2] [startNotation]
 *
 * startNotation (optional) replaces the standard start, e.g. a seal-budget
 * ablation 'whsahw/ffffff/6/6/FFFFFF/WHASHW 1 0-0 0 0' (a research variant,
 * NOT the v0.1 rules).
 *
 * Each pair uses one seeded random opening (`openingPlies` uniformly random
 * legal actions) played twice with colors swapped. Both sides then use their
 * level with per-move seeds moveSeed(seedBase+pair, ply). Equal openings,
 * alternate colors; budgets are the levels' fixed node budgets (NOT equal compute).
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism, cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Game } from '../src/rules/game.ts';
import { encodeAction } from '../src/rules/actions.ts';
import { LEVELS, moveSeed, think, type LevelId } from '../src/ai/search.ts';

interface GameOut {
  pair: number; aIsFirst: boolean; winner: number; reason: string; plies: number;
  casts: { a: number; b: number }; aScore: number; actions: number[]; ms: number;
}

function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playOne(a: LevelId, b: LevelId, pair: number, seedBase: number, aIsFirst: boolean, openingPlies: number, start?: string): GameOut {
  const t0 = performance.now();
  let g = Game.initial();
  if (start) {
    const s = Game.fromPosition(start);
    if (!s.ok) throw new Error(`bad start: ${s.error.message}`);
    g = s.value;
  }
  const r = rngOf(seedBase * 7919 + pair);
  for (let i = 0; i < openingPlies && !g.isOver; i++) {
    const legal = g.legalActions();
    const nx = g.play(legal[Math.floor(r() * legal.length)]!);
    if (!nx.ok) throw new Error(nx.error.message);
    g = nx.value;
  }
  const casts = { a: 0, b: 0 };
  while (!g.isOver) {
    const aToMove = (g.side === 1) === aIsFirst;
    const res = think(g, aToMove ? a : b, moveSeed(seedBase + pair, g.ply));
    if (res.action.kind === 'concord') casts[aToMove ? 'a' : 'b']++;
    const nx = g.play(res.action);
    if (!nx.ok) throw new Error(`AI produced illegal action: ${nx.error.message}`);
    g = nx.value;
  }
  const o = g.outcome!;
  const aSide = aIsFirst ? 1 : -1;
  return {
    pair, aIsFirst, winner: o.winner, reason: o.reason, plies: g.ply, casts,
    aScore: o.winner === 0 ? 0.5 : o.winner === aSide ? 1 : 0,
    actions: g.actions().map(encodeAction), ms: Math.round(performance.now() - t0),
  };
}

if (!isMainThread) {
  const { a, b, pairs, seedBase, shard, shards, openingPlies, start } = workerData as {
    a: LevelId; b: LevelId; pairs: number; seedBase: number; shard: number; shards: number; openingPlies: number; start?: string;
  };
  for (let p = shard; p < pairs; p += shards) {
    for (const aIsFirst of [true, false]) parentPort!.postMessage(playOne(a, b, p, seedBase, aIsFirst, openingPlies, start));
  }
} else {
  const [a, b, pairsS, seedS, out, threadsS, openS, start] = process.argv.slice(2);
  if (!a || !b || !(a in LEVELS) || !(b in LEVELS) || !pairsS || !seedS || !out) {
    console.error('usage: ai-bench.ts <levelA> <levelB> <pairs> <seedBase> <out.json> [threads] [openingPlies]');
    process.exit(2);
  }
  const pairs = Number(pairsS);
  const seedBase = Number(seedS);
  const shards = Math.min(Number(threadsS ?? availableParallelism()), pairs);
  const openingPlies = Number(openS ?? 2);
  const t0 = Date.now();
  const games: GameOut[] = [];
  await Promise.all(Array.from({ length: shards }, (_, shard) => new Promise<void>((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), {
      workerData: { a, b, pairs, seedBase, shard, shards, openingPlies, start }, execArgv: ['--experimental-strip-types', '--no-warnings'],
    });
    w.on('message', (g: GameOut) => { games.push(g); process.stderr.write('.'); });
    w.on('error', reject);
    w.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker exit ${code}`))));
  })));
  games.sort((x, y) => x.pair - y.pair || Number(y.aIsFirst) - Number(x.aIsFirst));
  const n = games.length;
  const wins = games.filter((g) => g.aScore === 1).length;
  const draws = games.filter((g) => g.aScore === 0.5).length;
  const pairScores = Array.from({ length: pairs }, (_, p) => games.filter((g) => g.pair === p).reduce((s, g) => s + g.aScore, 0));
  // Pair-level bootstrap 95% interval for A's mean score (seeded, 4000 resamples).
  const br = rngOf(12345);
  const boots: number[] = [];
  for (let k = 0; k < 4000; k++) {
    let s = 0;
    for (let i = 0; i < pairs; i++) s += pairScores[Math.floor(br() * pairs)]!;
    boots.push(s / (2 * pairs));
  }
  boots.sort((x, y) => x - y);
  const reasons: Record<string, number> = {};
  for (const g of games) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
  const firstScore = games.reduce((s, g) => s + (g.winner === 1 ? 1 : g.winner === 0 ? 0.5 : 0), 0) / n;
  const summary = {
    tool: 'tools/ai-bench.ts', levelA: a, levelB: b, pairs, games: n, seedBase, openingPlies, start: start ?? 'standard',
    budgets: { [a]: LEVELS[a as LevelId], [b]: LEVELS[b as LevelId] },
    aWins: wins, draws, aLosses: n - wins - draws,
    aScore: (wins + draws / 2) / n, aScoreCI95: [boots[Math.floor(0.025 * boots.length)], boots[Math.floor(0.975 * boots.length)]],
    firstPlayerScore: firstScore, reasons,
    meanPlies: games.reduce((s, g) => s + g.plies, 0) / n,
    castsPerGame: { a: games.reduce((s, g) => s + g.casts.a, 0) / n, b: games.reduce((s, g) => s + g.casts.b, 0) / n },
    gamesWithAnyCast: games.filter((g) => g.casts.a + g.casts.b > 0).length,
    wallSeconds: (Date.now() - t0) / 1000, threads: shards, cpu: cpus()[0]?.model, node: process.version,
    gamesDetail: games,
  };
  writeFileSync(out, JSON.stringify(summary, null, 1) + '\n');
  const { gamesDetail: _omit, budgets: _b, ...brief } = summary;
  console.error('');
  console.log(JSON.stringify(brief));
}
