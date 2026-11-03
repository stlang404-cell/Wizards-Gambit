# Staged roadmap and release gates
No production game implemented in this package. Estimates assume one experienced developer and part-time art/QA; uncertain 5–10 months, revise after M1. Later systems must not conceal a failed core.

|Milestone|Dependencies / indicative effort|Objective acceptance|
|M0 rules|1–2 weeks|TS port matches 100 golden replays and independent perft at depth≤3; all edge and draw fixtures pass; invalid public actions rejected; make/unmake restores bytes|
|M1 playable board|M0, 2–4 weeks|Readable five-piece art; complete local game; keyboard/touch; 10 newcomers: ≥8 legal independent games and danger explanation; ≥6 request another game without rewards|
|M2 AI/save|M1, 3–5 weeks|Five difficulty policies; search draw-aware; paired 200-game benchmark shows measurable improvement or difficulty claims revised; export/import and crash tests pass; frame budget on Windows+iPhone|
|Core gate|M2|50 human color pairs, opening diversity study and one-/two-/zero-seal ablations; no known forced opening win; royal-loss frustration assessed; rules may change before world expansion|
|M3 world|Core gate, 3–5 weeks|4096 identities unique; one season deterministic replay; Glicko reference vector passes; abstract/full calibration documented; no unbounded full searches|
|M4 Exchange|M3, 3–5 weeks|Atomic/versioned quotes, escrow, exhaustive W/D/L/void fixtures; 100k order stress; no own-controlled events; held-out calibration improves naive base rate or label estimates experimental|
|M5 ownership|M4, 4–6 weeks|100-season economy stress, asset-consolidated recovery, no ledger imbalance, no ranked stat purchases, zero-cash complete play loop|
|M6 advanced/polish|M5, 3–6 weeks|Profiled engine gains, mobile thermal/battery test, screen-reader/reduced-motion audit; optional Forge only if balanced separately|
|M7 release candidate|all, 3–5 weeks|≥100k diverse core games, endgame audit, 30-day save/migration fixtures, offline reboot tests, backup restore, no critical unresolved bugs|

Predeclare fairness acceptance: stronger equal agents in color-paired games should show first-side expected score interval within provisional .45–.55; sample and adjust thresholds based on intended competition format, not observed convenience. Current random-v-greedy results do not meet this evidentiary requirement. If fails: test starting tempo, board or army changes; do not quietly give black hidden bonuses.

Core quality rejection: if best legal moves overwhelmingly amount to one-move royal blunders, human games feel like shortened chess with emergency swaps, or deeper search fails to differentiate skill, return to candidate design. Prototype a paper revision before buying assets. Build content after readable tactical motifs actually emerge.

## Adversarial audit register
|Risk/severity|Reproduction/evidence|Correction / retest status|
|Renewable spell loops, high|Design analysis only|Nonrenewable seals; charge monotonicity tested; ordinary move cycles still draw|
|Repetition identity, high|Same board different seals must differ|key includes seals; need dedicated regression beyond walk test|
|Magic ignored, high|160 seal-budget selfplay games, zero casts|Spell-aware evaluation and human tests pending; no claim of useful magic|
|Royal tactical blindness, high|Shallow agents ignore imminent captures|Depth ladder measured; threat quiescence pending|
|Capture-only search ignores draws, medium|Search omits terminal history by inspection|Production draw-aware search; not fixed in research harness|
|Quiet ending truncation, medium|60 quiet plies may stop useful pursuit|Record reason distribution; endgame tablebase audit pending|
|Center snowball/first play, high|Nexus design risk, not proven exploit|Defer selection, strong selfplay pending|
|Stale odds, critical|Quote old state after engine move|Versioned atomic quote spec; concurrency tests pending|
|Maker insolvency, critical|Unreserved LMSR worst-case claims|Reserve subsidy; uniform single-market stress passed; nonuniform/joint exposure pending|
|Prize/stipend farming, high|Repeat settlement or transfer wealth before stipend|Idempotency + consolidated assets specified, not implemented|
|Save corruption, critical|Crash between debit and asset award|Transactional stores/restore specified, fault tests pending|
|Search cost, high|Eight-board blink adds destinations|Smaller baseline; physical-device benchmark pending|
|Rating inflation, medium|Sparse mismatched cohorts|Reference tests, anchors and cohort audit pending|

A correction specified in a document is not a passed retest. Do not relabel pending work as resolved.
