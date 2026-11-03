/**
 * Perft timing CLI (Node, no build step):
 *   node --experimental-strip-types tools/perft-cli.ts [maxDepth=5] [notation]
 * Prints raw and terminal-aware perft per depth with wall time and leaves/s.
 * Timing depends on machine and load; record hardware alongside results.
 */
import { initialPosition } from '../src/rules/position.ts';
import { parsePositionUnchecked } from '../src/rules/serialize.ts';
import { perft, perftTerminal } from '../src/rules/perft.ts';

const maxDepth = Number(process.argv[2] ?? 5);
const start = process.argv[3] ? parsePositionUnchecked(process.argv[3]) : initialPosition();
for (let d = 1; d <= maxDepth; d++) {
  const t0 = performance.now();
  const raw = perft(start, d);
  const t1 = performance.now();
  const term = perftTerminal(start, d);
  const t2 = performance.now();
  const rate = raw / Math.max((t1 - t0) / 1000, 1e-9);
  console.log(JSON.stringify({
    depth: d, raw, rawMs: Math.round(t1 - t0), rawLeavesPerSec: Math.round(rate),
    terminalAware: term, terminalMs: Math.round(t2 - t1),
  }));
}
