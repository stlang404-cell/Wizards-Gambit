# WIZARD'S GAMBIT

An original wizarding strategy game. The current core ruleset is **Ember Six v0.1**: a 6×6 board, five piece types, 12 pieces per side, capture-the-Archwizard victory, and two nonrenewable **Concord** exchanges per side. It is a *provisional research baseline*, chosen for prototyping. It is not balanced, and its magic has not been shown to be useful (see `research/03_SIMULATION_RESULTS.md`).

**Status: milestone M0 (rules core) is complete.** There is no UI, AI, world or economy yet. See [`docs/M0_REPORT.md`](docs/M0_REPORT.md) for test output, verification evidence, findings and remaining risks.

## Layout

| Path | What |
|---|---|
| `src/rules/` | Pure TypeScript rules module (no DOM/Node dependencies) |
| `test/` | Vitest suites; `test/reference/spec-rules.ts` is an independent move generator used to cross-check perft |
| `fixtures/` | Cross-language golden replays and perft oracle values generated from the Python prototype |
| `tools/` | Fixture generators (Python, research only) and a perft timing CLI |
| `research/` | Imported research package: design docs 01–12, Python prototype, results. Cached third-party source files are left out (only `results/sources.json` is kept) |
| `docs/` | Milestone reports |

## Commands

Requires Node ≥ 20 (tested on 22.23.4). Python 3.12+ is needed only to regenerate fixtures.

```bash
npm ci
```

```bash
npm run check
```

```bash
npm run test:slow
```

```bash
npm run perft -- 5
```

```bash
npm run fixtures:golden
```

`check` runs the strict typecheck (sources and tests) and the full test suite. `test:slow` adds the depth-4 independent-reference perft. Fixture generation is deterministic, so a rerun reproduces the committed file byte for byte.

## Rules API (summary)

```ts
import { Game, parseAction } from './src/rules/index.ts';

let g = Game.initial();                 // standard start
g.legalActions();                       // canonical order; [] once over
const r = g.play(parseAction('d1-c3')); // validated; returns Result<Game>
if (r.ok) g = r.value; else console.log(r.error.code, r.error.message);
g.outcome;                              // null | { winner: 1 | -1 | 0, reason }
g.undo();                               // exact parent (analysis only)
g.digest();                             // SHA-256 of canonical bytes
Game.fromRecord(g.toRecord());          // replay-validated reload
```

Actions are `{kind:'move', from, to}` or `{kind:'concord', lo, hi}` with `lo < hi`. Squares are numbered `rank*6 + file` (a1 = 0, f6 = 35). Position notation looks like `whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0`: ranks 6 down to 1, then side to move, seals, quiet plies and total plies.
