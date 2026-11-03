# Agent / contributor notes

- Normative rules: `research/04_FINAL_GAME_RULES.md` + common rules and Ember row of `research/02_RULESET_CANDIDATES.md`. Ember Six v0.1 is a provisional research baseline: never describe it as balanced or the AI as grandmaster-strength.
- Do not replace royal capture with checkmate, add promotion, or change counts/limits without bumping `RULES_VERSION` and regenerating fixtures (`tools/gen_golden.py`, `tools/gen_perft.py`) under a new versioned filename. Keep old fixture/result versions.
- `src/rules` is pure: no DOM, Node, UI, wallet or unlock imports (enforced by `tsconfig.json` `types: []`, `lib: ES2022`). Untrusted input goes through `Game` / `validatePosition`; `internal.*` (make/unmake, generation, perft) is unchecked.
- Ranked rules never depend on wallet/unlocks. No Godot, paid APIs, remote AI inference, mandatory accounts or real-money gambling. Python is research tooling only, never shipped.
- `research/` is the imported research package (history). Do not rewrite its results; add new result files instead.
- Module boundaries: `rules` ← `ai` ← `match` ← `persistence` / `play` / `tutorial` ← `app`. Only `src/app` and `src/ai/worker.ts` may touch the DOM/worker globals (separate tsconfigs enforce this). The UI never decides legality; it asks `Game`.
- Never invent rating changes: no rating code exists until a validated Glicko-2 lands (M3). Match records (`wg.match/1`) are the source of truth for future ratings/markets; change their schema only with a new schema version.
- AI difficulty claims must come from `tools/ai-bench.ts` results committed under `docs/results/`.
- Before pushing: `npm run check` (typecheck + tests). `npm run test:slow` adds the depth-4 independent-reference perft. UI changes: `npm run e2e` (needs local Playwright/Chromium).
- Report measurements with commands, seeds, toolchain and hardware. No invented metrics.
