# WIZARD'S GAMBIT

An original wizarding strategy game. Two Archwizards and their armies duel on a 6×6 board of enchanted stone. **Capture the rival Archwizard to win.** Each side may also cast Concord twice per game; it swaps two of your own touching pieces.

**Edition: M1, First Playable Edition** (`0.1.0`). The rules are **Ember Six v0.1**, a *provisional research baseline*: frozen for testing, not claimed to be balanced. All play is local, offline and unrated. Ratings, the AI wizard world, tournaments, the Grand Exchange and the economy are planned for later milestones and are **not playable yet** (see [`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Play on Windows

### Option A: release ZIP (no build needed)
1. Install **Node.js LTS** (version 20 or newer) from <https://nodejs.org/>. Default options are fine.
2. Unzip `wizards-gambit-0.1.0-m1-windows.zip` anywhere, for example `Documents\WizardsGambit`.
3. Double-click **`Launch-WizardsGambit.cmd`**. Your browser opens **http://127.0.0.1:4173/**.
4. Keep the black window open while you play. Close it to stop the game server.

To build the ZIP yourself from this repository, run `npm.cmd run release`. The output is `release\wizards-gambit-0.1.0-m1-windows.zip`.

### Option B: from this source folder
Double-click `Launch-WizardsGambit.cmd` in the repository folder. The first run installs dependencies (`npm.cmd ci`, which needs internet once). It then builds the game and opens it.

### If Smart App Control or SmartScreen blocks the `.cmd` file
Start the game by hand. Open the game folder in File Explorer, click the address bar, type `cmd` and press Enter. Then run:

```bat
node tools\serve.mjs --open
```

From a source checkout, run these first (once, then after updates):

```bat
npm.cmd ci
```

```bat
npm.cmd run build
```

The launcher never changes PowerShell execution policy and never stops other programs.

### Port already in use?
The game always uses one fixed address, because browser saves belong to that exact address.
- If port 4173 is already serving Wizard's Gambit, the launcher simply opens it.
- If another program owns port 4173, the launcher explains the problem and stops. To choose another port:

```bat
set WG_PORT=4321
```

```bat
Launch-WizardsGambit.cmd
```

A different port starts with **separate saves**. Use **Archive → Export / Import** to move finished matches between addresses.

## What you can do
- **Duel the AI** at three levels: Novice, Adept and Magister. Undo and hints are available in practice mode.
- **Pass and Play**: two people share one device.
- **AI Exhibition**: watch two AIs play a whole match, with pause, resume and four speeds.
- **Tutorial**: 12 interactive lessons covering every piece, captures, royal capture, danger, Concord, seals, how games end, and a first tactic.
- **Rules reference**, a **match archive** with a replay viewer and JSON export/import, and **settings**: coordinates, piece letters, hints, animations.
- **Saving**: your match is saved after every action and can be continued after closing the browser.

**Controls.** Click or tap a piece, then a glowing square. Red brackets mark captures. To cast Concord, select a piece, press **Concord** (or `C`), then pick a partner marked with a violet rune ring.

Keyboard:

| Key | Action |
|---|---|
| Arrow keys | Move the cursor |
| Enter | Select the square under the cursor |
| C | Concord |
| U | Undo |
| H | Hint |
| F | Rotate the board |
| Esc | Cancel |
| Space | Pause or resume an exhibition |

## Developer commands
Requires Node ≥ 20. The TypeScript CLI tools (`perft`, `bench`, `icons`) need Node ≥ 22.6 for `--experimental-strip-types`.

| Command | What it does |
|---|---|
| `npm ci` | Install pinned dependencies (TypeScript, Vite, Vitest) |
| `npm run dev` | Vite dev server on 127.0.0.1:5173 (`strictPort`) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve `dist/` on 127.0.0.1:4173 and open the browser |
| `npm run check` | Strict typecheck (rules, tests, app, worker) plus all unit tests |
| `npm run test:slow` | Also runs the depth-4 independent perft |
| `npm run e2e` | Build, then run browser end-to-end tests (needs a local Playwright + Chromium; writes `docs/screenshots/`) |
| `npm run bench -- adept magister 20 810000 out.json 4` | Colour-paired AI level benchmark |
| `npm run release` | Build plus the Windows release ZIP in `release/` |
| `npm run perft -- 5`, `npm run perft:verify` | Rules engine perft timing and verification |

## Layout

| Path | What |
|---|---|
| `src/rules/` | Pure rules engine (M0). Validated `Game` API plus an unchecked internal fast path |
| `src/ai/` | Baseline search AI (`search.ts`, `evaluate.ts`) and its Web Worker |
| `src/match/` | Match controller (seats, turns, undo, exhibitions, stale-reply protection) and `wg.match/1` records |
| `src/persistence/` | Versioned save file, validation, backups, archive export/import |
| `src/play/` | DOM-free UI logic (selection, highlights, danger detection) and pixel-art sprite data |
| `src/tutorial/` | Lesson data with engine-checked goals |
| `src/app/` | Browser app: Canvas2D board, screens, styles, worker client |
| `tools/` | Local server, launcher support, e2e tests, benchmarks, release packager, fixture generators |
| `test/` | Vitest suites |
| `docs/` | M0 and M1 reports, roadmap, logs, benchmark results, screenshots |
| `research/` | The original research package (historical; do not edit results) |

## Reports
- [`docs/M1_REPORT.md`](docs/M1_REPORT.md): what was built, test evidence, AI benchmarks, the Concord and draw study, and known risks.
- [`docs/M0_REPORT.md`](docs/M0_REPORT.md): rules engine verification.
