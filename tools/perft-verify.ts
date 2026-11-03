/**
 * Long-running perft verification outside Vitest (synchronous work this long
 * starves the Vitest worker RPC). Compares the start position to the Python
 * oracle values at depth 5, raw and terminal-aware. Exits non-zero on mismatch.
 *   node --experimental-strip-types tools/perft-verify.ts
 */
import { readFileSync } from 'node:fs';
import { initialPosition } from '../src/rules/position.ts';
import { perft, perftTerminal } from '../src/rules/perft.ts';

const oracle = JSON.parse(readFileSync(new URL('../fixtures/perft_d5_python_v0.1.json', import.meta.url), 'utf8')) as {
  raw: number; royalPruned: number;
};
const raw = perft(initialPosition(), 5);
const pruned = perftTerminal(initialPosition(), 5);
const ok = raw === oracle.raw && pruned === oracle.royalPruned;
console.log(JSON.stringify({ depth: 5, raw, expectedRaw: oracle.raw, pruned, expectedPruned: oracle.royalPruned, ok }));
process.exit(ok ? 0 : 1);
