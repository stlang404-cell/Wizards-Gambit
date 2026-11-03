# Claude Code implementation directive
You are implementing WIZARD’S GAMBIT from this research package. Read README and all 01–11 documents plus raw results before editing. Inspect repository and AGENTS.md; preserve unrelated work. This is an original wizarding universe, no franchise assets. No Godot, paid APIs, remote AI inference, mandatory accounts or real-money gambling.

Recommended baseline is Ember Six v0.1, provisionally selected; do not claim balanced or grandmaster-strength. Exact normative rules are 04, with termination/setup details in 02. Do not silently replace royal capture with checkmate or add promotion. Fixed 12-piece armies, 6×6, five types, two nonrenewable friendly-adjacent Concord exchanges replacing moves. Ranked rules never depend on wallet/unlocks. Clarify real contradictions, but use judgment for reversible implementation choices.

The 160-game seal ablation produced ZERO casts from shallow positional agents. Treat magic utility as unvalidated and investigate spell-aware search plus human/paper tests before any world expansion. The depth-three sample also had nine draws in twelve games.

Start ONLY M0. Create strict TypeScript pure rules module with validated public API and unchecked internal apply, canonical actions, terminal adjudication, full repetition context, undo and stable serialized hashes. Port Python fixtures and add missing boundary, exact-spell, draw-priority and invalid-state regressions. Independently verify perft. Python immutable parent undo is intentionally simple. Prototype search ignores draw history; fix before production analysis. Do not copy its float evaluator terminal handling uncritically.

Run exact README research commands to confirm baseline if needed; preserve result versions rather than overwrite history. Record toolchain, seeds, commands, failures, timing and hardware. No invented tests or metrics. Finish M0 with test output and reviewable source, then proceed to M1 only when acceptance gates pass. Avoid implementing world/markets to hide an unfun core. Run human/ablation gates before M3. Final design can change when evidence warrants it, with rules version and fresh fixtures.

Architecture: TypeScript/Vite, Canvas2D + semantic HTML, dedicated AI Worker, IndexedDB transactions, versioned service-worker caches and JSON backups. Separate rules, ai, match, world, exchange, economy, persistence and UI. Do not use Python runtime in shipped app. No uncontrolled localhost port switching or killing other servers. Windows local launcher and iPhone HTTPS-installed offline PWA require actual device tests; never promise permanent browser storage.

At M2 implement iterative deepening alpha-beta, threat-aware quiescence, TT with draw context, PV and cancellation; use completed iteration under budget. Demonstrate stronger policies with equal-budget paired tests; no hidden bonuses. Estimate probabilities only after held-out calibration.

At M3 generate deterministic 4096 competitors, use Glicko-2 reference implementation tests and tiered simulation clearly tagged abstract/full. A visible live market must commit to full engine simulation before opening.

At M4 implement fictional three-outcome LMSR only. Fixed b, covered holdings, micro-G ledger, reserved subsidy, atomic state-version quotes, no shorting/leverage, deterministic idempotent W/D/L/void settlement. No trading on own-controlled events. Never reset AMM q to match engine evaluations. Local save inspection cannot be prevented; do not claim cheat-proof markets.

M5+ follows roadmap, optional Forge separately rated. No fabricated ML careers, calibration or balance claims. Produce small increments with source, commands, tests and remaining risks. Report milestone acceptance failures plainly and fix or revise before advancing.
