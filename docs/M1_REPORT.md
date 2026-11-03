# M1 report: First Playable Edition (Ember Six v0.1)

Date: 2026-11-03. Scope: M1 only. M2 has not been started. The ruleset is **unchanged** (`ember-six/0.1`). This report separates what is **tested** from what is only **implemented**, and both from what is **planned**.

## 1. Audit and M0 re-verification

Before writing any M1 code I re-ran the M0 verification commands on a clean `npm ci`:

| Command | Result |
|---|---|
| `npm ci` | OK (4.0 s) |
| `npm run check` | typecheck OK; 212 passed, 2 skipped (slow) |
| `npm test` | 212 passed, 2 skipped |
| `npm run perft -- 4` | 34 / 1,156 / 40,936 / 1,449,035 (raw); 1,448,971 terminal-aware, matching the fixtures |

Outputs are in `docs/m1-logs/m0-check.txt` and `docs/m1-logs/m0-perft.txt`. No M0 defects were found.

The audit turned up two problems, both fixed:
- `test:slow` used POSIX `WG_SLOW=1 …` syntax, which fails in Windows `cmd`. It now runs through `tools/run-slow.mjs`.
- The Node `--experimental-strip-types` tools reject TypeScript parameter properties. `erasableSyntaxOnly` is now enabled, so the compiler catches these.

## 2. Status by category

### Implemented and tested (automated)
- **Rules engine (M0, unchanged)**: every M0 suite still passes.
- **Baseline AI** (`src/ai/`). Negamax alpha-beta with iterative deepening, capture quiescence, and full evasion search whenever the side to move's Archwizard is attacked. All terminal rules are applied *inside* the search tree: royal capture, threefold repetition (including the game's history before the search began), 60 quiet plies, and the 180-ply cap. Effort is limited by node budgets, so results are deterministic for a given (history, level, seed).
  - Tests: immediate wins taken, immediate royal losses avoided, legal output on 220 random positions, determinism, evaluation symmetry, a repetition move scored exactly 0, a losing side claiming the draw, and quiet/ply-cap draws scored in the tree. (`test/ai.test.ts`, 28 tests)
- **Three difficulty levels**, kept because the benchmarks show they differ (section 4).
- **Web Worker AI** (`src/ai/worker.ts`). The worker rebuilds the game from the record by validated replay, then searches. Cancelling terminates the worker. Browser tests show the UI stays responsive while the AI thinks.
- **Match orchestration** (`src/match/controller.ts`):
  - Seats, turns, AI requests, undo, restart, pause/resume and speed.
  - Stale replies are blocked twice over: every request carries a generation number, and a reply is accepted only if it is legal in the current game.
  - Tests cover replies arriving after undo and after restart (`test/match.test.ts`).
- **Match records** (`wg.match/1`, `src/match/record.ts`), covered in section 5. Validation replays every record, and 9 tampering cases are rejected.
- **Save/restore** (`src/persistence/save.ts`):
  - A versioned `wg.save/1` file in `localStorage`. Every stored record is re-validated by replay when loaded.
  - Corrupt or unknown-version saves are copied to a backup key and reported, never silently discarded.
  - Storage that throws is handled.
  - Archive export/import also validates by replay.
- **Interaction logic** (`src/play/interaction.ts`). Highlights and clicks are derived from the engine's own legal-action list; no movement rule is duplicated. (`test/interaction.test.ts`)
- **Tutorial**: 12 lessons. Every interactive lesson's position is valid, its solution is legal, and the solution meets the lesson goal. Wrong answers are rejected by the engine. (`test/tutorial.test.ts`)
- **Browser end-to-end** (`tools/e2e.mjs`, real pointer clicks and taps in Chromium against the built game; section 3).
- **Local server** (`tools/serve.mjs`), tested on Linux:
  - Binds only to 127.0.0.1 and serves `/__wg_health`. Path traversal returns 403.
  - If the port is busy and our own server holds it, it reuses that server (exit 0).
  - If another program holds the port, it prints a clear message and exits 4. It never switches ports and never kills anything.
- **Release ZIP**: `npm run release` produces `release/wizards-gambit-0.1.0-m1-windows.zip` (66 KB, 10 files). The full e2e suite passed against the **unzipped** package (`docs/m1-logs/e2e-release.json`).

### Implemented but not fully tested
- **`Launch-WizardsGambit.cmd`** has **not been run on Windows**; this environment is Linux. Its logic is simple: check Node, check the version, `npm.cmd ci` on first run from source, build, then `node tools\serve.mjs --open`. The server it calls is tested. Smart App Control and SmartScreen behaviour is unknown; the README gives a manual command-line fallback.
- **Opening the browser automatically** (`start ""` on Windows) is untested on Windows.
- **Visual quality** was reviewed only from automated screenshots (`docs/screenshots/`). No human has judged readability or appeal.
- **Keyboard controls** are implemented (arrows, Enter, C, U, H, F, Esc, Space) but are not covered by automated tests.
- **Accessibility**: there is semantic HTML, an `aria-live` status line, labelled controls, a letter overlay and a reduced-motion toggle. No screen-reader audit has been done.
- **PWA**: there is a manifest and icons, but **no service worker**, so this is not an installable offline PWA. iPhone has not been tested at all.
- **Performance** was measured on one Linux container (Xeon 2.8 GHz). Magister takes about 1.5 s per move in Node. Browser and mobile timings were not measured.

### Planned for later (not implemented; nothing here pretends otherwise)
- **M2**:
  - Transposition table with draw context, PVS/aspiration, threat-aware quiescence, killer/history tuning.
  - Equal-compute benchmarks; IndexedDB transactions and a service worker.
- **M3**: Glicko-2, rating pools (standard, fast, forge), the 4,096-competitor world, titles, leagues and tournaments.
- **M4 and later**: the Grand Exchange (three-outcome LMSR in Greenbacks), the economy, and the Forge League.

The menu says plainly that none of these are playable.

### Blocked or failing
- **Human playtest gates** (research/11 M1: 10 newcomers; core gate: 50 colour pairs) remain **pending**. Only humans can complete them.
- **Windows and iPhone device tests** are pending; no device was available.
- Nothing is failing in automated tests.

## 3. Acceptance checklist (directive Part XI)

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | M0 tests still pass | `npm run check`: 287 passed, 2 skipped; `test:slow`: 289/289 (`docs/m1-logs/check.txt`, `test-slow.txt`) | ✅ |
| 2 | Production build succeeds | `npm run build` (`docs/m1-logs/build.txt`) | ✅ |
| 3 | Game opens in a browser | e2e "menu loads" (Chromium, Playwright 1.63) | ✅ Chromium only |
| 4 | Human can play a complete match | e2e: Novice game played by real clicks to royal capture, including a Concord cast | ✅ |
| 5 | AI completes a legal match | e2e exhibition (Novice vs Adept, 84 plies); 140 benchmark games, 0 illegal actions | ✅ |
| 6 | Local two-player mode | e2e pass-and-play to a repetition draw | ✅ |
| 7 | AI exhibitions with pause/resume/speed | e2e: pause holds the position, resume and speed work | ✅ |
| 8 | Concord legal and shown on screen | e2e Concord by click (seal spent, notation checked); screenshot `04-concord-targets.png`; tutorial lesson 9 | ✅ |
| 9 | Wins and draws adjudicated | engine tests plus e2e royal-capture win and repetition draw | ✅ |
| 10 | Restart and undo work | e2e undo (record `undoCount=1`, `practice=true`); restart archives the old match as `abandoned` | ✅ |
| 11 | Match records correct | replay validation of every record; e2e checks the fields | ✅ |
| 12 | Save and restore work | e2e reload mid-game then Continue gives the identical position; corrupt save is reported and backed up | ✅ |
| 13 | Desktop and mobile viewports | 1280×900 and 390×844 (touch): no horizontal overflow, board 373 px, tap-to-move works | ✅ emulated, not a real phone |
| 14 | No critical runtime errors | e2e: zero console errors or uncaught exceptions across all scenarios | ✅ |
| 15 | Windows launch documented and tested where possible | documented; server and package tested on Linux; `.cmd` not run | ⚠️ partially |

The e2e run, `node tools/e2e.mjs --root <unzipped release> --port 4312`, reported **12 passed, 0 failed** (`docs/m1-logs/e2e-release.json`). The same suite against the repo build also gave 12/12.

## 4. AI levels: measured differences

Command: `npm run bench -- <A> <B> <pairs> <seed> <out> 4`.
- Each pair uses one seeded 2-ply random opening, played twice with colours swapped.
- Each level keeps its own node budget, so these are **not equal-compute** comparisons; the levels are meant to differ in effort.
- Score intervals use a pair-level bootstrap (4,000 resamples).
- Hardware: 4-thread Xeon 2.8 GHz, Node 22.23.4.

| Match-up | Games | A wins / draws / A losses | A score (95% CI) | Mean plies | Concords per game (A, B) | Wall time |
|---|---:|---|---|---:|---|---:|
| Novice vs Adept (seed 800000) | 100 | 0 / 0 / 100 | 0.00 (0.00–0.00) | 82.1 | 1.27, 0.95 | 21.6 s |
| Adept vs Magister (seed 810000) | 40 | 0 / 16 / 24 | 0.20 (0.125–0.275) | 114.1 | 0.93, 1.03 | 385 s |

| Level | Search | Budget | Measured cost (Node, opening 40 plies) |
|---|---|---|---|
| Novice | depth 2 + quiescence 2, ±150 root noise | 40k nodes | ~10 ms/move |
| Adept | depth 3 + quiescence 4 | 120k nodes | ~35 ms/move |
| Magister | iterative deepening to depth 6 + quiescence 4 | 600k nodes | ~1.5 s/move (max 1.8 s) |

Conclusion: the levels differ measurably. Magister is not "strong" in any absolute sense; these are research baselines, with no human rating anchor and no grandmaster claim.

## 5. Match records (`wg.match/1`)

Every match produces a self-contained record. The M3 ratings, standings and career histories are meant to be computed from these records alone. Fields:
- `matchId` (UUID), `schema`, `appVersion`, `rulesVersion`
- `mode` (`human-vs-ai`, `human-vs-human` or `ai-vs-ai`)
- `ratingPool: "unrated"` and `ranked: false`
- `timeControl: {kind:"untimed"}`
- `createdAt`, `endedAt`
- `players.first` and `players.second`, each with a stable `id` (`human:<uuid>` or `ai:<level>@wg-baseline/1`), `kind`, `name`, and for AI seats `{engine, level}`
- `start` (position notation) and `actions` (the full legal action list, with undone actions removed)
- `status` (`in-progress`, `completed` or `abandoned`), `outcome` (winner and termination reason), `result` (`1-0` / `0-1` / `1/2-1/2` / `*`)
- `plies`, `finalDigest` (SHA-256 of the canonical position bytes)
- `undoCount`, `practice` (true exactly when `undoCount > 0`)
- `seed` (AI move seeds are `moveSeed(seed, ply)`, so AI choices can be reproduced)

`validateMatchRecord` replays the record and rejects any mismatch in outcome, result, plies, digest, status, practice flag, schema, rules version, ranked claim, or AI level.

Rating changes are **not** computed anywhere. The "unrated" pool is the only one that exists.

## 6. Gameplay quality research: Concord and draws

### Concord test positions (all three levels; `test/ai.test.ts`)
- **Beneficial**: `5a/6/3h2/w5/6/AF4 1 1-0 0 10`. The Archwizard on a1 is attacked through a2, and b2 is covered by the Hexweaver. **Every ordinary move loses the Archwizard; only `a1~b1` survives.** All levels find it. With zero seals, the same position is lost.
- **Harmful**: `5a/6/3h2/6/1F4/A5 1 2-0 0 10`. Here `a1~b2` swaps the Archwizard onto an attacked square and scores as a forced loss. No level plays it.
- **Neutral but costly**: an identical-type swap in the opening (`a2~b2`) scores below the best move, because seals carry evaluation value. Neither Novice nor Adept plays it.

### Concord usage by the baseline AI
This differs from the research finding: the research package's shallow agents recorded **zero** casts in 160 games, but this baseline casts in almost every game.
- Novice vs Adept: 2.2 Concords per game, in 100 of 100 games.
- Adept vs Magister: 1.95 per game, in 39 of 40 games.
- Adept self-play: 1.95 per game, in 96 of 100 distinct games.

The likely reasons are an evaluation that values seals (+35 each) and full evasion search when the Archwizard is threatened. Many of these casts are probably emergency escapes. This **does not** show that Concord creates interesting decisions; that is exactly the "emergency evacuation" concern in research/04, and it still needs human review of real games.

### Seal-budget ablation (Adept vs Adept, 2-ply seeded openings, seed 820000)
Same-level games are deterministic, so each colour-swapped game exactly repeats the first. Each row is therefore **100 distinct games**, even though the bench tool ran 200. The rows with 1 or 0 seals per side are **research variants** (`fromPosition` with modified seals), not the v0.1 rules.

| Seals per side | Distinct games | Draws | First-player score | Mean plies | Draw reasons (quiet / repetition / cap) |
|---:|---:|---:|---:|---:|---|
| 2 (v0.1) | 100 | 61 | 0.495 | 126.5 | 35 / 11 / 15 |
| 1 | 100 | 69 | 0.525 | 137.3 | 31 / 15 / 23 |
| 0 | 100 | 70 | 0.490 | 136.2 | 46 / 12 / 12 |

Draw reasons are given as distinct games, from the bench JSON divided by 2.

Interpretation, with caveats:
- **Draw rates between equal baseline engines are high (61–70%).** This is consistent with the research's 9-of-12 warning at depth 3, and with the Adept-vs-Magister rate of 40%.
- The difference between 2 seals and 0 seals (61 vs 70 of 100) is **not statistically significant**: a two-proportion z-test gives about 1.3.
- There is no evidence of first-player advantage here (0.49–0.525), but the opening sample is narrow.
- These engines are shallow, so a high draw rate may reflect how they play rather than the rules.

**No rules change is proposed yet.** The evidence is too weak, and it all comes from engine play. If the draw rate stays high with stronger M2 search and in human games, candidate revisions to test under a new rules version are:
- a shorter quiet limit combined with a repetition rule tied to seals;
- a third seal.

Either must come with fresh fixtures, not a quiet edit.

## 7. Windows launch (summary; details in README)

**Option 1, release ZIP (recommended):**
1. Install Node.js LTS.
2. Unzip the release.
3. Double-click `Launch-WizardsGambit.cmd`. It opens `http://127.0.0.1:4173/`.

**Option 2, manual (if Smart App Control blocks `.cmd` files):** open `cmd` in the folder and run `node tools\serve.mjs --open`.

**From the source checkout:** run `npm.cmd ci`, then `npm.cmd run build`, then `node tools\serve.mjs --open`. The `.cmd` launcher does the same steps.

The launcher uses a fixed port: 4173 by default, or `WG_PORT`. It never kills other servers and never changes execution policy.

## 8. Known limitations and remaining risks

- **Core fun is unproven.** No human has played this build. The high draw rate between equal engines and the "Concord as emergency escape" pattern are the main design risks, and the core gate (human pairs plus ablations) must come before any world or economy work.
- **The AI is shallow.** Magister is the strongest level, and it can still be beaten by careful play or lose to tactics beyond 6 plies. The evaluation weights are hand-set seeds, not tuned.
- **Browser storage is not permanent.** Saves depend on the exact address (`127.0.0.1:4173`). Using `localhost` or a different port shows a different, empty save. Export/Import is the backup path.
- **No service worker**, so the game is not offline-installable as a PWA yet. It does work offline when served locally.
- **The `.cmd` launcher and browser auto-open are untested on Windows.**
- **Art**: sprites are 16×16, which is smaller than research/09's 32×32 target, and there are no idle or capture sprite animations beyond procedural effects. There is no sound.
- **Bundle**: 72 KB JS + 19 KB worker + 9 KB CSS (gzip about 29 KB), far under the 25 MB budget.
