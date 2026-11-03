# M0 report: Ember Six v0.1 rules core (TypeScript)

Date: 2026-11-03. Scope: M0 only (research/11 roadmap). There is no UI, AI, persistence, world or market code.

## Acceptance gates (research/11, M0 row)

| Gate | Status | Evidence |
|---|---|---|
| TS port matches 100 golden replays | **Pass**: 106 of 106 | `test/golden.test.ts`, `fixtures/golden_replays_v0.1.json` |
| Independent perft at depth ≤ 3 | **Pass** (also depth 4) | `test/perft.test.ts`; Python oracle plus a separate TS reference generator |
| All edge and draw fixtures pass | **Pass** | `test/rules.test.ts`, `test/python-port.test.ts`, `test/immobility.test.ts` |
| Invalid public actions rejected | **Pass**: 11 malformed, 10 illegal, post-terminal, bad records | `test/rules.test.ts` |
| make/unmake restores bytes | **Pass**: every legal action at every position of 120 seeded games (>30k checks) and all golden games | `test/make-unmake.test.ts`, `test/golden.test.ts` |

## Test output

```
$ npm run check
> tsc -p tsconfig.json && tsc -p tsconfig.test.json
> vitest run
 Test Files  7 passed (7)
      Tests  212 passed | 2 skipped (214)
   Duration  12.80s

$ npm run test:slow        # WG_SLOW=1, runs the 2 skipped depth-4 reference perfts
 Test Files  7 passed (7)
      Tests  214 passed (214)
   Duration  13.20s
```

## What was built

`src/rules/` is a strict TypeScript module with no platform dependencies. It compiles with `lib: ES2022`, `types: []`, `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

- **Validated public API.** `Game` is an immutable value. `play()` checks the action's shape, then its legality, and refuses play once the game is terminal. It returns a `Result` with error codes `malformed-action`, `illegal-action`, `game-over`, `invalid-position` or `invalid-record`. `validatePosition()` accepts untrusted `PositionData` or notation. `Game.fromRecord()` rebuilds a game by validating the start position and replaying every action.
- **Unchecked internal path** (`internal.*`): typed-array `Position`, `generateActions`, `makeUnchecked`/`unmakeUnchecked` with an `Undo` record, and `perft`/`perftTerminal`/`perftDivide`. This path is for the future AI worker. It is not the public API.
- **Canonical actions.** `Move{from,to}` and `Concord{lo,hi}` with `lo<hi`. `concord(a,b)` and `parseAction('d3~c3')` normalise click order; raw objects with `lo>=hi` are rejected. Internal codes: move = `from*36+to`, Concord = `1296+lo*36+hi`. Legal actions come out in the same order as the prototype: squares ascending; each piece's moves in the prototype's direction order, then its Concords with partners `j>i` ascending.
- **Terminal adjudication**, in this priority order: first-player A missing, second-player A missing, third repetition, 60 quiet plies, 180 total plies, no legal action (side to move loses). Both A missing throws, and the validator rejects it.
- **Full repetition context.** Each `Game` carries the count of every (board, side, seals) identity seen since its start, with the start position counted once. That context survives `undo()`, `toRecord()` and `fromRecord()`.
- **Stable serialized hashes.** Canonical bytes are 44 bytes with an explicit integer layout, documented in `serialize.ts`. `digest()` is SHA-256 of those bytes, using a pure-TS SHA-256 verified against node:crypto. `tools/gen_golden.py` reproduces the same bytes from the Python prototype. A 64-bit Zobrist key (two uint32 halves, fixed seed, pinned by a snapshot test) is kept up to date incrementally by make/unmake for use by a future transposition table.

## Verification method

1. **Golden replays.** `tools/gen_golden.py` plays 106 Ember games with the Python prototype as the oracle. Pairings: random-random (50), random-greedy (15), greedy-greedy (10), positional-greedy (10), tactical-tactical (8), tactical-positional (7), plus 6 targeted random-random games that end by the quiet limit or the ply cap. Seeds start at 700000 (extras from 701000). Reasons covered: royal-capture 92, repetition 8, quiet-limit 3, ply-cap 3. The games contain 342 Concords. Each ply checks the legal-action count, a digest of the full ordered legal list, and the canonical state digest. Each game end checks outcome, board, seals, counters and repetition count. Regenerating the fixture is byte-identical (sha256 `90a646a2…2574`).
2. **Perft against two sources.**
   - Python prototype (`fixtures/perft_v0.1.json`, and `research/results/perft.json` for depths 1–3).
   - `test/reference/spec-rules.ts`, written from the rules prose and sharing no code with `src/rules`. It uses algebraic-string squares and tests each piece against every destination with a displacement predicate instead of ray tables.
   - The comparisons: start position at depths 1–4 (depth 4 under `test:slow`); 10 mid-game positions at depths 1–3; exact legal-action sets at every position of 300 seeded random games (>5,000 positions); and 2,000 random valid placements with mixed seal counts.
3. **Make/unmake equivalence with retained-parent undo.** For every legal action at every visited position: make gives the same digest as the public immutable path, the incremental Zobrist key equals a fresh recomputation, and unmake restores all bytes and the key.
4. **Ported Python tests.** 10 of the 12 prototype tests are ported. `test_hold_objective` (Nexus Six) and `test_blink_no_capture` (Grand Eight) don't apply because only Ember is implemented. The mapping is documented at the top of `test/python-port.test.ts`.
5. **Regressions added.** Every rules-04 example; centre and corner reach for each piece type, including a no-wraparound check; slide blocking; all Concord constraints (diagonal partner allowed, distance 2 / enemy / empty / same square rejected, identical types allowed, seals run out, second player spends its own seals, seal state separates repetition identities); repetition at the third occurrence; quiet-limit (Concord doesn't reset it, a capture does); ply-cap versus royal capture on ply 180; the full draw-priority chain; 26 invalid-state inputs; 21 invalid actions; bad records; and a test that inputs and outputs are not shared or mutated.

### Perft values

| Depth | Raw (prototype semantics) | Terminal-aware | Python oracle | Reference TS |
|---:|---:|---:|---|---|
| 1 | 34 | 34 | 34 / 34 | ✓ |
| 2 | 1,156 | 1,156 | 1,156 / 1,156 | ✓ |
| 3 | 40,936 | 40,936 | 40,936 / 40,936 | ✓ |
| 4 | 1,449,035 | 1,448,971 | 1,449,035 / 1,448,971 (royal-pruned) | ✓ (slow) |
| 5 | 31,631,115 | 31,625,446 | 31,631,115 / 31,625,446 (161.7 s + 180.8 s) | not run |

"Raw" expands every legal action with no terminal pruning, which is what `research/prototype/perft.py` does. "Terminal-aware" gives a terminal position no children.

## Findings

- **F1: the two perft definitions diverge at depth 4, not deeper.** My working assumption was that no royal capture could happen in the first 3 plies, and the first test run disproved it. Example line: `d1-c3`, then `d5~d6` (Concord moves the second Archwizard forward), then `c3xd5`. Raw perft keeps counting moves after such a capture, so raw minus pruned is 64 at depth 4. This is a property of the prototype's perft definition, not a bug in it. Future perft tables must say which definition they use. The line is pinned as a regression test.
- **F2: the "no legal actions" rule cannot fire in v0.1.** A side with a seal always has a move: if its A is stuck, every on-board neighbour is friendly, so a Concord is legal. With zero seals, a side is stuck only if every first-step target of every one of its pieces is a friendly square. An exhaustive search in `test/immobility.test.ts` shows no such set exists within the army limits. A sanity case shows the search does find one when piece counts are unlimited. The rule stays implemented and is tested through the internal adjudicator with an over-army board. Implication: the last terminal priority is dead code for this ruleset. That is harmless, but it is a design fact worth knowing.
- **F3: the Concord distinctiveness concern is unchanged.** M0 only verifies the rules. The zero-cast seal ablation (research/03) still stands, and nothing here shows that magic is useful.

## Implementation choices (reversible, flagged for review)

- The validator does **not** enforce that the side to move matches the parity of `totalPly`, nor that seals spent fit within the plies elapsed. This keeps puzzle and test positions possible, as in the prototype tests. It does enforce piece counts within the army, at most one A per side, at least one A on the board, seals in 0..2, `quiet ≤ 60`, `ply ≤ 180` and `quiet ≤ ply`.
- A validated position may already be terminal (for example, one A missing). `Game` reports the outcome and refuses play.
- A game loaded from a bare position starts its repetition history at that position. Full history comes only from `fromRecord`.
- Concord text notation is written lowest square index first. Parsing accepts either order.
- `research/` is stored minus the cached third-party HTML/PDF/TXT sources (about 470 KB of external copyrighted material); `results/sources.json` still records the URLs and retrieval status. The rest of the research package is unchanged. The research commands were rerun in a scratch copy, so no committed result was overwritten: 12 tests OK, perft identical to `results/perft.json`, `replay.json` verified (5 plies, hash `1a2c7cad…`).

## Toolchain, hardware, timing

- Linux 6.18.44 container (shared cloud host), Intel Xeon @ 2.80 GHz, 4 vCPU, 15 GB RAM. Timings are noisy and say nothing about browser or device performance.
- Node 22.23.4, npm 10.9.9, TypeScript 5.9.3, Vitest 3.2.4, Python 3.13.18. The research package recorded Python 3.12.14; the prototype results reproduced identically on 3.13.
- Full test suite takes about 13 s. Golden fixture generation takes 17.5 s. Python perft to depth 4 takes 7.6 s. TS raw perft (`npm run perft -- 5`): depth 4 in 37 ms, depth 5 in about 1.0 s (about 31M leaves/s, bulk-counted at the last ply). TS terminal-aware perft: depth 4 in 1.3 s, depth 5 in 34 s. It is slow because it builds a string repetition key and scans for royals at every node; the M2 search should key repetition by Zobrist instead.
- No browser, Windows or iPhone runs. No parallel agents.

## Remaining risks / not done

- The golden replays and the reference generator both come from the same rules interpretation (research/04 as read by the prototype author and by me). They catch porting bugs, not misreadings of the rules. A human rules review and paper play are still needed.
- Depth-5 perft has only been checked against the Python prototype (`fixtures/perft_d5_python_v0.1.json`; raw checked in every test run, pruned under `test:slow`); the TS reference generator was not run that deep.
- Clocks, timeouts and resignation are match-layer concerns and are not implemented (planned for M1/M2). The rules have no draw offers or passing, by design.
- Draw-aware search, TT draw context, and benchmarks belong to M2. The prototype agents were not ported.
- Next step is **M1** (playable board): Canvas2D plus semantic HTML, keyboard and touch, a complete local game. Its acceptance gate needs 10 newcomer playtests, which only a human can run.
