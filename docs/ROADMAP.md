# Wizard's Gambit milestone roadmap (updated after M1)

Each milestone must pass its acceptance gates before the next one starts. A gate that needs humans or physical devices stays **pending** until real people or devices complete it. Effort estimates come from research/11 and remain uncertain.

| Milestone | Status | Acceptance gate |
|---|---|---|
| **M0 Rules core** | ✅ complete | 106 golden replays; independent perft (depth ≤ 4; depth 5 against Python); edge, draw and invalid-input fixtures; make/unmake byte restore |
| **M1 First Playable Edition** | ✅ software complete; ⏳ human gate pending | Automated: board, three modes, baseline AI, tutorial, records, save/restore, launcher, release ZIP, e2e 12/12. **Pending:** 10 newcomers (≥ 8 complete legal games and can explain danger; ≥ 6 ask for another game without rewards); Windows `.cmd` run on a real PC |
| **M2 Competitive Intelligence** | not started | Transposition table with draw context, PVS/aspiration, threat-aware quiescence, PV and cancellation; difficulty claims backed by paired 200-game benchmarks at equal time and equal nodes; IndexedDB transactional saves, crash tests, service worker; frame budget on Windows and iPhone |
| **Core gate** (before any world content) | pending | 50 human colour pairs; opening-diversity study; zero/one/two-seal ablations with stronger engines; no known forced opening win; draw-rate review (equal M1 baselines draw 61–70%); royal-loss frustration assessed. Rules may change here, under a new rules version with fresh fixtures |
| **M3 Grand Arcane Championship** | not started | Glicko-2 matching the reference vector [research R1]; separate pools (standard, fast, Forge); 4,096 deterministic competitors whose styles map to measurably different engine policies (not cosmetic names); titles (Initiate … Eternal Grandmaster) kept separate from rating, so permanent achievements survive rating loss; leagues, knockouts, round-robins, archives; one-season deterministic replay; ratings computed only from `wg.match/1` records |
| **M4 Grand Exchange** | not started | Fictional Greenbacks; three-outcome LMSR with fixed b per market; covered holdings; micro-G ledger; reserved subsidy; atomic state-versioned quotes; idempotent W/D/L/void settlement; no trading on player-controlled matches; live markets only on committed full engine simulations; prices move only by trading; 100k-order stress |
| **M5 Wizarding Empire** | not started | Prize money, estates, clubs, sponsorship, ownership; zero-cash full play loop and recovery after failure; 100-season ledger stress; nothing bought affects ranked strength |
| **M6+ Living Competitive World** | not started | Deeper AI diversity, optional Forge League (rated separately), richer tournaments and history, profiling, accessibility audit |
| **M7 Release candidate** | not started | ≥ 100k diverse core games, endgame audit, migration fixtures, offline reboot and backup-restore tests on devices |

## Interfaces already prepared for later milestones
- **M3 ratings**: `wg.match/1` records carry stable player IDs, AI policy and version, rules version, mode, result, termination reason, seed, practice flag and a replay-verifiable digest. `ratingPool` and `ranked` are reserved fields (today always `unrated` / `false`).
- **M4 markets**: AI exhibitions are deterministic from (match seed, levels, engine version), so a market can commit to a full simulation before opening. The controller accepts any `AiPort`, so a headless world simulator can drive matches without the UI.
- **Engine boundary**: `src/rules` is pure; the AI sees positions only through validated records; the UI never decides legality.
