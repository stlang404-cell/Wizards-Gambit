from pathlib import Path
root=Path(__file__).parent
files={
'01_RESEARCH_FOUNDATIONS.md':'''# Research foundations
Status: preproduction, 2 November 2026. “Verified” below describes source-backed mechanics or mathematics, never demonstrated enjoyment of this invention. Cached retrieved sources and HTTP failures are in results/sources.json. Web-search tool failed; direct HTTP retrieval succeeded selectively. Unretrieved references are reading leads, not claimed reviewed evidence.

## Comparative study
|Game/system|Established mechanism|Strength and risk|Design inference (hypothesis)|
|---|---|---|---|
|Chess|Asymmetric movement, blocking sliders, royal safety, promotion|Threats combine through shared geometry; opening memorization and draws|Short sliders preserve blocking combinations on a small board|
|Miniature chess|Reduced board and armies|Fast contact; reduced opening space can simplify solving|Do not equate speed with depth; require solver/opening audit|
|Shogi|Captured pieces return as drops; promotion zones|Material remains available; drop branching complicates defense|Reserve drops for a later variant, not beginner core|
|Xiangqi|Palaces, river, cannon screens, facing generals|Geometry creates recognizable constraints; exceptions cost teaching time|Special squares need visible, simple semantics|
|Go|Placement, liberties, territory and ko|Local tactics interact with global investment; scoring requires teaching|Measure influence and tempo, not just material|
|Hive|No board, connected hive, movement-specific insects|Constraints create emergent locks; sliding rules can surprise|Connectivity is interesting but hard to read on phones|
|Onitama|Public rotating movement cards|Very few pieces; changing moves create planning|Fixed movement is a project constraint; do not import card movement|
|Arimaa [R3]|Four steps, stronger-piece pushing/pulling, traps, freezing, rabbit goal|Coordinated displacement; many composite turns|One atomic action per turn controls branching|
|Stratego|Hidden ranks and combat information|Bluffing and inference; imperfect-information fairness differs from determinism|Keep ranked positions fully public|
|Tak [R4]|Road construction, stacks, flat/standing stones and capstones|Shared material supports blocking and connection|Test alternative objectives separately from capture|
|Territorial abstracts|Control emerges from adjacency/connectivity|Influence can matter without capture; stalling/scoring disputes possible|Control magic needs explicit clocks and no resource farming|
|Deterministic tactics|Action budgets, displacement, visible threats|Readable combinations; optimal combos may become scripts|Limited magic budget is an irreversible strategic commitment|
|Deck building / drafting|Opportunity cost, synergies, public/private availability|Build variety; matchups and knowledge burden|Pre-match spells belong in Forge League initially|

The uncited game rows summarize familiar published mechanics, not newly verified page research. Consult official FIDE Laws https://handbook.fide.com/chapter/E012023 ; Japan Shogi Association https://www.shogi.or.jp/ ; International Go Federation https://www.intergofed.org/ ; publisher rules for Onitama, Stratego and Hive before production. No complete ruleset is copied here.

## Why depth might persist
Threats with several answers, scarce tempi, interdependent pieces, irreversible choices and incomplete calculation can create durable learning. Those are explanatory hypotheses, not a theorem that these rules are deep. Large state counts provide upper bounds, not evidence of quality. Hidden information does not inherently reduce fairness, but changes the skill being measured. Fixed starts aid teaching; symmetry does not eliminate first-player advantage. Promotions/drops may reduce sterile endings but can amplify initiative. Resource income tied to already winning positions risks positive feedback.

## Sources actually retrieved
[R1] Mark Glickman, Example of the Glicko-2 system (2022), https://www.glicko.net/glicko/glicko2.pdf . Rating, RD, volatility; period updates; author suggests roughly 10–15 games per player per period. Use uncertainty in matchmaking, validate tau rather than assume a value.
[R2] Robin Hanson, Logarithmic Market Scoring Rules (2002), https://mason.gmu.edu/~rhanson/mktscore.pdf . Proper scoring and information aggregation; LMSR cost-function implementation below is a standard formulation derived from this family.
[R3] Official Arimaa rules, https://arimaa.com/arimaa/learn/rulesIntro.html . Retrieved rules include four-step turns, trap support, freezing, repetition illegality and goal priority.
[R4] US Tak Association, https://ustak.org/play-beautiful-game-tak/ . Official introductory rules source, cached HTML.
[R5] WebKit, Web Push for Web Apps on iOS and iPadOS (2023), https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ . Documents Home Screen installation and standalone manifest; not a storage-retention guarantee.

## Further technical references (not fetched successfully here)
Knuth & Moore, An Analysis of Alpha-Beta Pruning (Artificial Intelligence, 1975), DOI 10.1016/0004-3702(75)90019-3. Browne et al., A Survey of Monte Carlo Tree Search Methods (2012), DOI 10.1109/TCIAIG.2012.2186810. Shannon, Programming a Computer for Playing Chess (1950), DOI 10.1080/14786445008521796. Chessprogramming Alpha-Beta request returned 403. Hive PDF URL returned 404. Ryan, Rigby & Przybylski, motivational pull of video games (2006), DOI 10.1007/s11031-006-9051-8 is a follow-up lead for competence/autonomy, not evidence that our onboarding works.

## Magic model comparison (hypotheses)
Shared renewable mana introduces bookkeeping and farming; per-piece charges create identity but many counters; cooldowns reward cycling and enlarge state; limited-use global seals are legible and guarantee no spell-only infinite loop; positional energy risks snowballing; spell-instead-of-move has clear tempo cost; integrated magic is simplest but risks being just movement flavor; drafting multiplies matchup testing. Start with two global, nonrenewable swaps and compare against zero/one/three seals before freezing rules. Shield, rebirth, summon, interruption and mana theft are rejected from baseline: too many timing and loop obligations. No claim that the preferred model is empirically optimal yet.
''',
'02_RULESET_CANDIDATES.md':'''# Candidate systems and decision model
All five candidates are executable, deliberately constrained screening designs. Their movement vocabulary is shared to isolate some geometry effects; army size, geometry, objective and magic still confound causal comparisons. They are not five independently perfected games.

## Common exact rules
Coordinates x,y start at 0 on the first player's near-left corner. Positive army moves first. A square holds at most one piece. Archwizard A steps one square in any of eight directions. Warden W slides orthogonally 1 or 2 squares, stopping at blockers. Hexweaver H slides diagonally 1 or 2, stopping at blockers. Spellblade S jumps by (±2,±1) or (±1,±2), ignoring intervening squares. Familiar F steps one orthogonal square in any direction. Each captures an enemy on its destination with its ordinary move; friendly destinations forbidden. No promotion, en passant, castling, drops, random events or passing. One action ends the turn. Royals may enter attacked squares; actual capture ends play. No check legality or simultaneous responses.

Each side starts with two global seals. Casting replaces the entire move, costs one seal, never captures and has immediate duration. Charges never regenerate; all friendly pieces can initiate casts. Enemy pieces cannot interrupt. All spell endpoints must be legal board squares; an exchange is atomic. No other spell effects exist.

Victory priority: missing positive A loses; missing negative A loses; objective win; third occurrence of identical board/side/seals/objective counters draws; 60 consecutive noncapture actions draw; 180-ply cap draws; no legal actions loses. Captures reset the quiet counter; spells do not. Bare royals remain playable until an ordinary terminal rule fires. An opponent can capture an adjacent royal even if the capturer itself was attacked. All experiments use these priorities. Royal absence of both armies is invalid input, not an attainable state.

## Five systems
|Name|Board/army (first-side rows left to right)|Magic|Additional objective|Hypothesized pace/learning|
|---|---|---|---|---|
|Ember Six|6×6; y0 WHASHW; y1 FFFFFF; 12 per side|Concord: exchange two friendly pieces at Chebyshev distance 1|Capture only|5–10 min; 5-minute teaching|
|Rune Seven|7×7; y0 WHSASHW; y1 FFFFFFF; 14 per side|A piece on central (3,3) may exchange with another friendly piece within Chebyshev distance 2|Capture only|8–15 min; positional spell gate|
|Grand Eight|8×8; y0 WHSASHWF; y1 FFFFFFFF; 16 per side|Blink: any nonroyal moves to an empty square at exactly Chebyshev distance 2, jumping blockers|Capture only|10–20 min; higher branching|
|Nexus Six|6×6, same army as Ember|Central gate exchange within distance 2; central squares (2,2),(2,3),(3,2),(3,3)|Also win by ending three consecutive personal turns with A on any central square|5–12 min; counters need tutorial|
|Astral Cross|7×7 coordinates with abs(x−3)+abs(y−3)≤3; 25 playable squares; A(3,0), W(2,1), H(3,1), S(4,1), F(3,2); five per side|Concord as Ember|Also win when A reaches enemy extreme row|3–8 min; unusual geometry|

Second army in every case is a 180-degree rotation with opposite color, not a reflection. Goal counters in Nexus update only at end of owner's action, increment if A centrally located, otherwise reset to zero; counters are not themselves victory progress in other systems. Gate control grants access, not income. Capturing a controller denies its cast next turn. Reaching an objective resolves before opponent replies. All duration estimates above are untested human hypotheses.

Recommended clocks: casual untimed; ranked 5 minutes + 3 seconds per move; championship two color-swapped 10+5 games. Timeout loses even with low material; no draw by agreement in automated events. Prototype omits wall clocks. No komi; color-paired matches mitigate but do not prove fair first play.

## Likely combinations / weaknesses
Ember: exchange unveils a short ray or evacuates a royal but spends tempo and a seal. Rune: center denial removes spell access; centralized A may become a target. Eight: blink creates forks across screens; high destination count increases search cost. Nexus: a center occupation forces action but may snowball. Cross: narrow lanes allow blocking traps; diagonal parity and edge jumps may make pieces redundant. Every piece usefulness claim requires ablation and human testing; only preliminary heuristic values exist.

## Explicit provisional scoring
Order: learnability, depth, tactics, originality, spectators, fairness, AI feasibility, balance, pacing, replayability, clarity, extensibility. Weights: 14,12,12,8,8,10,8,8,6,6,5,3 (sum 100). Scores 1–5 are expert hypotheses informed by screening, not measured quality.
Ember: 5,3,4,3,4,3,5,3,5,3,5,3.
Rune: 4,4,4,4,4,3,4,3,4,4,4,4.
Eight: 3,4,4,3,3,3,2,3,2,4,3,4.
Nexus: 3,4,4,4,5,2,4,2,4,4,3,4.
Cross: 4,2,3,5,4,2,5,2,5,2,4,2.
Computed ranking/sensitivity is in results/decision.json. Ember is preferred for the next human prototype; Rune is runner-up under baseline weights. A depth-heavy weighting can reverse this. No candidate passes the human fairness/depth gate yet. Reject Eight for present scope (search/UI cost), Nexus for objective snowball risk, Cross for compressed lanes and weak opening variety. Do not claim these are empirically established defects. Eliminate any design with reproducible forced opening win, incomprehensible legality, or unacceptable phone search latency regardless of score.
''',
'04_FINAL_GAME_RULES.md':'''# Ember Six — selected research baseline v0.1
This is a complete frozen rules specification for continued testing, not a release-balanced game. Candidate document common rules plus Ember row are normative; this file expands every player-facing detail. A rules change requires new version and fresh benchmarks.

## Setup and movement
Use a 6×6 board, files a–f and ranks 1–6. First player's back row rank 1: Warden, Hexweaver, Archwizard, Spellblade, Hexweaver, Warden. Rank 2: six Familiars. Second player's rank 6 from a–f: Warden, Hexweaver, Spellblade, Archwizard, Hexweaver, Warden; rank 5 six Familiars. Ranks 3–4 empty. Each army has A×1 W×2 H×2 S×1 F×6.

A moves/captures (dx,dy) where max(abs(dx),abs(dy))=1. W moves (±1,0),(±2,0),(0,±1),(0,±2); a length-two W move requires its intermediate square empty. H moves (±1,±1),(±2,±2) with same intermediate rule. S moves (±2,±1),(±1,±2) and jumps. F moves (±1,0),(0,±1); retreat and sideways capture allowed. Each destination must be inside the board and not occupied by a friend. Captures remove the destination enemy permanently. No promotion, forward bias or resurrection.

## Concord
Two seals per side displayed publicly. Choose two different friendly pieces whose file and rank distances are each at most one. Spend one seal; swap their squares simultaneously; end turn. Both endpoints occupied before and after; nobody captured. A can participate. Which piece is clicked first has no significance. All piece types can cast; there is no caster status, cooldown, duration or replenishment. A swap of identical types is permitted, still costs a seal and counts as a quiet action. This cannot be a resource-neutral repetition. No spell may be added during an opponent turn. Capturing the A with an ordinary move wins immediately regardless of possible future swaps.

Example: A on c3, friendly F on d3 can exchange. If the enemy W on c5 has an open c4, leaving A on c3 would allow a capture; exchanging evacuates A to d3 but does not guarantee d3 safe. W on a1 cannot reach a3 through a friendly F on a2. S on d1 may jump to c3 or e3 through a blocked second rank. A on c3 may capture an enemy A on c4 immediately. This deliberately uses capture-the-royal rather than checkmate; UI must clearly warn of direct capture threats.

## Turn and termination
First side moves. Exactly one ordinary move or Concord is mandatory. Apply action, consume seal if needed, reset quiet count on capture otherwise increment, advance ply and switch side. Then adjudicate royal capture, third repeated position, 60 noncapture plies, 180 total plies, then lack of legal actions (side to move loses), in that order. Repetition identity includes board, side and remaining seals; quiet/ply counters are excluded. No insufficient-material shortcut: A versus A may still have a capture outcome. No voluntary pass or draw offer. Tournament timeout loses, resignation loses; local analysis undo has no ranked result. Clock state is not part of repetition but is saved and logged. Corrupted states with no/both A before play are rejected by the future public API.

## Values and motifs
Prototype values W=5 H=4 S=3 F=1 and A=1000 are evaluation seeds, not measured exchange ratios. A's terminal value must be separate in production. W/H reach up to eight targets on an empty central square; S up to eight, F four, A eight, with different edge losses. H remains on one square color; W needs lines; S is edge-sensitive; F is short-ranged but can screen and trade; A is indispensable and vulnerable. Ablate each piece before concluding usefulness.

Learnable motifs: twin hex (fork), vow pin (moving a blocker exposes A; strategic not legally forced), rune skewer (short-ray target behind another), unveiled ray (Concord moves a blocker), seal sacrifice (spend magic to induce a capture), mirror trap (both swap endpoints threatened), seal zugzwang (a spell is the only safe tempo), anchor fork (both enemy swap endpoints threatened). Names label hypotheses; puzzle positions and forced proofs remain to be curated. No claim that all occur frequently.

Fundamental unresolved concern: standard chess-like moves may make Concord insufficiently distinctive. Human tests must demonstrate interesting exchanges rather than mere emergency royal evacuation. Compare no-spell and one-/three-seal ablations. If that fails, return to Rune rather than adding more abilities to conceal a weak core.
''',
'05_ENGINE_ARCHITECTURE.md':'''# AI architecture
Use deterministic negamax alpha-beta with iterative deepening as the first production engine. Principal variation search after stable move ordering; aspiration windows after stable score distributions. This is a recommendation, not a measured browser speed result.

Rules core is pure and independent of search/UI. Incremental make/unmake stack stores captured piece, seals, clocks/counters and prior hash. Zobrist keys cover pieces, side, seals; repetition is path-sensitive. A TT exact entry cannot ignore draw context: include quiet counter and relevant history signature or avoid reusing exact draw-dependent scores. Validate full state on collisions where practical. Mate/capture terminal scores use distance-to-win outside all heuristic ranges.

Order immediate A captures first, then TT move, threatened-royal evasions (including swaps), profitable captures, forcing swaps, history/killer moves, quiets. Quiescence must extend immediate royal threats and forcing exchanges, not only captures. Limit extensions to prevent branching explosions and always retain legal evasions. Delta pruning, late-move reductions and null-move pruning are disabled until tactical suites show safety: passing is not legal, swaps create unusual zugzwang, reduction can hide the only defense. PVS and aspiration re-search cost must be benchmarked against plain alpha-beta.

Evaluation: material, legal mobility, ray-blocking, royal escape squares, opponent immediate capture threats, piece coordination, seal optionality and endgame distance. Tune using train/validation/test seeds and color pairs. Centrality alone may make A suicidal. Never turn raw centipawn-like scores into probability. Prototype search ignores repetition/quiet limits inside its tree, an explicit tactical limitation to fix at M2.

MCTS handles wide trees and unusual objectives but random rollouts miss royal tactics. Compare equal node/time budgets after adding tactical rollouts. Hybrid policy-guided MCTS or neural evaluation is deferred: offline training, corpus quality, packaging, inference and licensing costs lack justification now. NNUE is a possible later experiment with independently held-out games. No machine learning is implemented.

## Interfaces
Analyze(position, rulesVersion, budgetMs, nodeBudget, style, cancellationToken) returns completed depth, nodes, score, bound, PV, legal root actions and state hash. Worker messages carry request IDs; discard stale results. Hard cancellation when tab suspends; use last completed iteration. Difficulty 0 random, 1 capture-biased, 2 shallow positional, 3 tactical, 4 strongest available budget. Stylistic weights alter preferences, not information access or rules. Analysis shows uncertain evaluations, top alternatives and PV; blunder labels require deeper verification rather than a single shallow score swing.

Run in dedicated Web Worker. Start with TypeScript typed arrays; profile before WASM/Rust port. WASM may improve nodes/sec but does not solve bad ordering and needs identical replay fixtures. Target (not measured): <16 ms main-thread frames, easy AI <100 ms, ordinary strong AI 0.5–2 sec, analysis 5 sec on tested devices. Budget by nodes for repeatable tests; wall clock for user experience. iPhone background tasks are not reliable schedulers.

## Version improvement protocol
Freeze rules, evaluator, opening corpus and hardware. Paired openings, alternate colors, independent seeds, equal time and equal nodes separately; record browser, OS, thermal state, nodes/sec, completed depth, PV legality and energy. Start 200 pairs, use fixed sample before confidence intervals; avoid selecting versions on the same test set. Report W/D/L and score with pair-level bootstrap; use sequential statistical testing only with a predeclared method. Tactical suite, perft, replay and draw regression must pass first. No grandmaster or human rating strength claim without anchored human competition.

Metrics: measured legal branching, distinct hashes per ply, transposition rate, effective branching via N≈b^d, forcing-action proportion, search-rank changes with depth, opening entropy conditional on strength, piece ablation and human explanation accuracy. State-space upper bound for Ember: 13^36 ×2×3², ignoring inventory and legality; deliberately loose. Tree estimate b^L is not a proof of complexity or depth. Track nontrivial best-move margins against stronger search, not simply number of legal choices.
''',
'06_WIZARDING_WORLD.md':'''# The Grand Arcane Championship
Original world: the glass-roofed academy of Vesper Quay, basalt observatory of Thornmere, and itinerant Lantern Collegium. Their symbols are an hourglass arch, split star and open lantern; no franchise references. Rivalries arise from recorded competition, not fabricated claims of learning AI.

Seed 4096 competitors from curated combinatorial names and biographies with collision-checked IDs. Store identity, club/academy, birth-season, debut, rating/RD/volatility, hidden simulation strength, style vector, strengths/weaknesses, availability, last 50 games, lifetime aggregates, titles, trophies, rivalry edges, career stage and seed. Biographies reference actual seeded facts. Hidden simulation strength governs abstract results, not extra powers in played matches. Style maps to engine weights; skill maps to budget/error policy. Deterministic bounded aging/training trajectories are authored simulation, not learning.

Use Glicko-2 [R1], initial 1500/RD350/volatility .06, tau .5 as provisional tuning values. Weekly rating period only where enough games accumulate; sparse cohorts require validation. Update simultaneously from pre-period ratings. Uncertainty grows with inactivity. Elo is simpler but lacks native uncertainty; TrueSkill supports multiplayer/team events but is unnecessary for initial 1v1. Rating and prestige remain separate; titles require results, never wealth.

|Tier|Format/qualification|Movement/prizes (design budgets)|
|School|8-player round robin, open students|Top 2 to club trial; 20–60 G|
|Club|16-player weekly Swiss, 5 rounds|Top 4 regional qualifier; 50–200 G|
|Regional|32-player Swiss 7 rounds|Top 4 national berth; 200–800 G|
|National|16-player group stage then top-8 playoff|Top 2 international; 1,000–4,000 G|
|International|32-player Swiss then top-8|Circuit points; 3,000–12,000 G|
|Elite invitational|8 by circuit rank|Prestige and 5,000–20,000 G|
|Grand circuit|4 seasonal events|Top 8 qualify Worlds; published point table 10/7/5/3/1|
|Worlds|8-player round robin then top-4 two-color matches|World title; 50,000 G subsidy cap|
|Legendary|Unlocked by milestones, exhibition|Cosmetic achievements; no official rating shortcut|

Season 12 in-world weeks; promotions by qualification, never auto-rating gifts. Match draws .5 each. Swiss avoids repeat opponents, balances colors and uses deterministic seeded tiebreaks after score then opponent-score sum; byes score 1 but excluded from rating and paid contracts. Playoff ties: additional color-paired rapid games, at most four pairs; unresolved winner by announced prior seed (tie-break qualification market settles under this explicit rule). Avoid hidden random sudden death.

## Simulation fidelity
Only watched matches, player matches and liquid live markets require full engine replay. Regional background results may use a calibrated three-outcome rating model; far-background cohorts use batched models. Synthetic outcomes have a method flag and cannot be opened as fake engine replays. Once an event is selected for live trading, commit to full-engine simulation before market opens; never switch fidelity mid-event. Abstract history may show score summaries only. Seed event streams by season/event/match ID and rules version. Advance world when user advances time; no mandatory real-time idle grind. Freeze finalized events and ledger transactions.

Career ages, recruitment and clubs change opportunities and style within bounded slopes. No thousands of full searches by default. Target season compute and save budgets must be profiled. Validate abstract/full result calibration by strength/style strata before treating them interchangeable.
''',
'07_GRAND_EXCHANGE.md':'''# Grand Exchange — fictional Greenbacks only
No deposits, withdrawals, cash redemption, accounts or real-money pricing. Market participation is optional and may be disabled. Ranked competitor play is complete without it. No bets by player on any match/event whose participants, lineup or qualification they control; own matches and owned clubs are excluded, including derivatives. Exhibition betting can be a later isolated sandbox without transferable proceeds.

## Mechanisms
Fixed odds: simple, but bookmaker must reserve worst-case liability and reprice atomically. Pari-mutuel: pool less fee split across winning stakes, no known payout until close, thin pools unattractive. Binary contracts: transparent 1 G payoff but W/D/L requires three exhaustive outcomes. LMSR: immediate liquidity and bounded subsidy, price impact can be large. Order books: natural spread and limit orders but thin fictional markets need makers and complex matching. Begin with one three-outcome LMSR per full-engine match; defer order books and correlated derivatives.

For q outstanding outcome shares, C(q)=b log(sum exp(q_i/b)); buy vector d costs C(q+d)−C(q), plus 1% of absolute shares traded. p_i=exp(q_i/b)/sum exp(q/b). Use stable log-sum-exp. Example b=100, uniform prior: maximum maker subsidy 100 log3≈109.861 G before fees. For nonuniform prior initialize virtual q0_i=b log(prior_i); maximum bound becomes b log(1/min prior), not b log3. Virtual shares are not trader claims. Never reset q or overwrite market prices when engine evaluations change. State-dependent beliefs influence trader orders; a new AMM requires explicit migration/reserving liabilities.

No short selling or leverage initially: sellers must own shares. Each unit of winning claim pays 1 G, others 0. Reserve conservative subsidy per market plus covered trader cash; enforce integer micro-G accounting in production (float prototype is research only). Atomic quote contains stateHash, bookVersion, quantity, maxCost, fee and expiry eventIndex. Reject stale version or changed board, never honor a stale favorable price after a move. Buy/sell roundtrip has nonpositive profit after fees with unchanged state; complete sets cost 1 before fee and pay 1. All related events use one settlement source; correlated markets deferred until joint exposure checks exist.

## Settlement registry
Match winner: first/draw/second from final engine result including time forfeits and resignation, as published. Voided/corrupt/aborted game: refund original trade cash flows and revoke shares atomically, not arbitrary 0.5 payouts. Tournament winner: named eligible champion under published tiebreak. Qualification: official final berth list. Underdog: underdog fixed at market creation by pre-event rating, ties excluded. Comeback: defined as eventual win after calibrated displayed win probability ≤10% at a recorded completed ply, evaluator version fixed before market creation. Duration: ≤40 plies versus >40; forfeits before first move void; otherwise terminal ply counted. Tactical milestone: first Concord by ply 20, event log action kind, not visual effects. Promotion: official season transition. Only match W/D/L enabled in initial release; the rest require deterministic fixture tests and full observation logs. No retroactive definition edits or settled-result modifications.

## Priors and live beliefs
Ratings model must estimate W/D/L, not treat Elo expected score as P(win). Calibrate a multinomial outcome model using held-out full-engine games with rating difference, uncertainty, side, style, remaining material and search features. Isotonic/temperature calibration chosen on validation set; report Brier, log loss, reliability bins and sample counts. Draw probabilities depend on rules. Raw evaluation is not probability. Prototype has no validated pricing model.

Traders: rating fundamentalist, shallow tactical analyst, cautious diversified holder, noisy fan and contrarian. Each receives only event-time public board and delayed published analysis, independent seeded belief noise, bounded utility and wealth; no future-result seed or hidden simulator strengths. Orders process serially between completed plies. Advance event time only after trading window closes. Player cannot pause game progression to repeatedly transact against pre-move prices. Offline client cannot cryptographically prevent save editing or inspecting deterministic seeds; this is a local integrity convention, never a security guarantee.

## Actual test and pending work
prototype/market.py executes 10,000 seeded order attempts, conservation, cash/nonnegative holdings and bounded maker-loss assertions; results/markets.json. This tests accounting at fixed b/uniform prior with random traders, not calibration, price discovery, multi-market solvency or the whole economy. Required next tests: outcome-stratified settlement, concurrent quote races, one-unit rounding, void unwind, correlated claims, large q stability, end-to-end no-lookahead and seasonal wealth distribution.
''',
'08_ECONOMY_AND_PROGRESSION.md':'''# Greenbacks and progression
One wallet, integer micro-G, double-entry append-only ledger with transaction ID, source/sink and event ID. Idempotency keys prevent repeated prizes. Starting bankroll 500 G. Price values below are hypotheses requiring simulation and human testing.

|Activity|Income/cost|Purpose|
|Free academy match / puzzle|0 entry; once-per-unique-lesson grant 10 G|Always available practice|
|School event|10 entry, funded prize schedule|First professional route|
|Club event|25 entry, rewards from reserved pool|Risk/reward competition|
|Cosmetics|50–500 G|Robes, wand appearance, board effects|
|Library / lab|1,000–5,000 G plus 10/week optional upkeep|Analysis UI, curated puzzles, Forge experiments|
|Estate|5,000–100,000 G; optional decorating|Ownership and display, no ranked stats|
|Club|10,000+ purchase plus contracts|Recruitment, scouting, team calendar|
|Businesses|2,000+ capital; capped variable fictional revenue|Diversification with capital and upkeep risk|
|Event hosting|Reserved prize budget plus venue fee|Reputation and attendance, no prize minting|
|Syndicate|Allocated cash and risk limits|Delegate eligible market strategies|

Sponsorship rewards participation/season achievements with published caps, not win-rate manipulation. Training facilities improve fictional recruits' bounded career trajectories; player coaching content is available without paid stat advantages. Research unlocks puzzles, visual artifacts and optional Forge rules, never movement powers in ranked. Competitive, investor, club owner, researcher and magnate careers have independent achievements and intersecting opportunity costs.

Entry/prize accounting: reserve pools at event creation from entries plus capped league subsidy; cancel with refunds if not funded. Sponsor issuance and novice grants are explicit faucets. Entry overhead, cosmetics, property purchase, operating costs and market fees are sinks. Secondary sales transfer wealth, not create money. Maintain separate league treasury and market reserve; do not fund prizes with hypothetical future fees.

Safety/recovery: free academy remains accessible at zero; if wallet <50 G and no liquid assets, claim a 100 G stipend once per in-world week, with aggregate 500 G/season cap. No claim during a live market or while hiding liquid wealth in holdings. Alternatively free public league has no cash entry and noncash progress. No debt or seizure of tutorial access. Insolvent clubs pause operations, never block personal play. Prevent transfer-to-club stipend farming by consolidating beneficial assets.

Retention comes from competence, anticipation, rivals and ownership. No loss-chasing prompts, streak penalties, artificial urgency, near-miss effects or betting-required quests. Show realized/unrealized P&L and optional spending limits. A lost match should provide one understandable lesson. Human tests: can 8/10 newcomers make legal moves and explain royal danger after five minutes? Can losing players name a next goal without wagering? Those are proposed gates, not executed studies.

Long-horizon model required: 1,000 households ×100 seasons, competitor/trader/owner/hybrid policies, zero-bankroll recovery, top-1% wealth share, money supply per active character, median real purchasing power and sink coverage. Not executed here. Avoid guaranteed positive-riskless business return plus unlimited scaling; diminishing returns, bounded demand and optional upkeep must be calibrated. Never silently confiscate wealth to fix inflation. Prestige and creative ownership remain meaningful after money becomes abundant.

Forge League deferred: standardized point-budget roster/spell loadouts, public reveal before match, separate rating, no earned-power advantages within a budget. Budget balance requires matchup matrix testing; do not pretend a linear price guarantees balance.
''',
'09_VISUAL_DIRECTION.md':'''# Visual and experience specification
Premium pixel-art gothic academia, warm wood, slate, parchment and restrained spectral cyan/copper. Original architecture and heraldry. Board is the visual center. Silhouette before ornament: A tall split spire, W square gate, H tapered loom, S angular crossed blade, F squat lantern creature. Color and monochrome outline both identify side. Piece letters available as accessible overlay; legal targets never encoded by color alone.

Logical piece sprites 32×32 with 2-pixel contour and fixed baseline; author at native resolution and scale with nearest-neighbor integer steps where possible. Two side palettes, five types, idle 4 frames, select 2, capture 6, Concord 8. Reuse one 8-frame portal atlas tinted per academy; no particle storm. Board tiles 32×32, wood border nine-slice, four highlighted target overlays (move/capture/cast/danger). Portraits 48×48 modular layered hair/face/robe/accessory with seeded composition; 24 authored portraits for major rivals. Three initial academy crests 32×32, eight league badges, six trophy bases, 16 robe palettes. Manifest records dimensions, pivots, animation FPS, palette, license, author and attribution.

Concord animation 250–400 ms, endpoints visibly connected then exchanged; engine state commits atomically and input pauses until display catches up. Captures 150–250 ms; reduced motion instant crossfade. No visual animation determines settlement timing. Victory and promotion ceremonies skippable. Avoid giant video/audio packs; target art/audio compressed download <15 MB initially, total <25 MB (unverified budget).

Phone portrait: at 390 CSS px width with 12 px margins, 366 px board /6 gives 61 px squares. Top: opponent and two seal icons; center board; below selected piece rules, cast button, confirm/cancel. Minimum touch target 44 px. No drag-only interactions; tap piece then destination; cast selects two friendly neighbors and confirms. Font ≥16 px body, scalable. Compact royal-danger banner; optional threat overlay. iPhone safe-area insets respected.

Separate tabs for Play, League, Exchange, Estate, Library. Spectator phone view shows board plus one outcome-price panel; book/chart/history in a sheet. Desktop adds PV, bracket and trade panels. Tournament bracket has accessible list equivalent. Estate/lab are static illustrated rooms with hotspots and list controls; deferred beyond core milestones. Every icon has text alternative, keyboard focus, sufficient contrast and screen-reader board navigation. Test 320px viewport, high text zoom, reduced motion, touch, keyboard and grayscale.

Onboarding: minute 1 move F and capture, minute 2 protect A, minute 3 distinguish W/H/S, minute 4 Concord rescue, minute 5 short guided match with no betting. Allow mistakes, explain the actual capture ray, offer retry and analysis. No forced outcome disguised as genuine AI match. Postgame identifies a verified tactical turning point and replay, not moralized loss text. Test transfer to an unfamiliar position, not just tutorial completion.

Asset generation is not commissioned here. Style guide and production counts are specifications, not supplied art. Commission a five-piece silhouette test before producing hundreds of portraits.
''',
'10_TECHNICAL_BLUEPRINT.md':'''# Technical blueprint
Production stack: TypeScript strict, Vite, Canvas2D board + semantic HTML UI. Canvas2D is enough for 36 squares and a few sprites; PixiJS adds atlasing/WebGL convenience but bundle/context complexity. Benchmark before adding it. No Godot, remote inference, paid APIs or accounts. Python prototype chosen for fast stdlib experimentation; port using replay fixtures rather than embedding Python.

Modules: rules (geometry/actions/apply/undo/terminal); ai (search/evaluation/TT); match (clocks/replay); world (calendar/ratings/careers); exchange (quotes/contracts/settlement); economy (ledger/assets); persistence (schemas/migrations); presentation (Canvas/DOM/audio); workers. Dependency arrows point inward to pure domain types. Rules never imports UI, wallet or unlocked assets.

State {rulesVersion, board:Int8Array(36), side, seals:[u8,u8], quietPly, totalPly}. Action discriminated union Move{from,to}|Concord{lo,hi}; canonical lo<hi. Match history retains repetition counts, initial seed and actions. Public apply validates action and refuses play after terminal; prototype apply is an unchecked internal fast function and must not become the public production API. Research undo retains immutable parent positions; production incremental undo must prove equivalence.

Save {schemaVersion, appVersion, rulesVersion, worldSeed, calendarIndex, ledger, assets, competitors, events, matches, contracts, marketReserves}. Snapshot + write-ahead transactions in IndexedDB, atomic multi-store updates. Monotonic transaction IDs and settlement IDs are idempotent. Compact histories with summaries but preserve traded match logs. JSON export with checksum, documented schema, validation and size limits; checksum detects damage, not cheating. Import into temporary database, validate balances/IDs/rules, then atomically switch active save; retain last known good snapshot. Migration fixtures and crash-injection required. Offer explicit backup reminders and multiple export slots. IndexedDB and persistent-storage requests cannot promise permanent retention.

Offline: static HTTPS origin, manifest and versioned service-worker cache. First load downloads all mandatory assets; test airplane-mode launch after restart. iPhone install via Share → Add to Home Screen on supported Safari [R5], verify current OS behavior on real hardware. A PC localhost server is not iPhone localhost; use a free static HTTPS host for initial install or a trusted LAN HTTPS setup. Subsequent normal play is offline. HTTPS bootstrap does not imply cloud saves. Do not promise file:// service workers.

Windows distribution: static bundle plus documented launcher using an installed Node LTS runtime, binds only 127.0.0.1. Choose an available port from configured range and store chosen URL; do not kill other development servers. Saves are origin/port scoped, so preserve a stable port when possible, warn on collision and offer backup/import. A packaged desktop wrapper is optional later and adds size/signing obligations. Development Vite uses strictPort to fail clearly instead of silently changing save origin.

Testing pyramid: move/edge fixtures, seeded state walks, perft counts independently checked by a second implementation, search tactical suite, golden replay hashes, rating reference vector, ledger conservation, quote races, settlement idempotency, migration/crash fixtures, offline restart and physical-device usability. Current seven tests cover only a subset. Build production hashes on canonical bytes with explicit integer format; Python repr SHA hashes are Python-only fixtures until canonical cross-language serialization is specified.

Performance budgets: initial payload <25MB, saved world <20MB/season before compaction, 60fps input, no main-thread search. These are targets. Real iPhone/Windows tests, storage eviction/recovery, service-worker upgrades and battery benchmarks are pending. Local files/seed inspection and save rollback cannot be prevented against a determined user; isolate imported/debug saves from any future verified ladder rather than invent false anti-cheat guarantees.
''',
'11_DEVELOPMENT_ROADMAP.md':'''# Staged roadmap and release gates
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
''',
'12_CLAUDE_CODE_MASTER_PROMPT.md':'''# Claude Code implementation directive
You are implementing WIZARD’S GAMBIT from this research package. Read README and all 01–11 documents plus raw results before editing. Inspect repository and AGENTS.md; preserve unrelated work. This is an original wizarding universe, no franchise assets. No Godot, paid APIs, remote AI inference, mandatory accounts or real-money gambling.

Recommended baseline is Ember Six v0.1, provisionally selected; do not claim balanced or grandmaster-strength. Exact normative rules are 04, with termination/setup details in 02. Do not silently replace royal capture with checkmate or add promotion. Fixed 12-piece armies, 6×6, five types, two nonrenewable friendly-adjacent Concord exchanges replacing moves. Ranked rules never depend on wallet/unlocks. Clarify real contradictions, but use judgment for reversible implementation choices.

Start ONLY M0. Create strict TypeScript pure rules module with validated public API and unchecked internal apply, canonical actions, terminal adjudication, full repetition context, undo and stable serialized hashes. Port Python fixtures and add missing boundary, exact-spell, draw-priority and invalid-state regressions. Independently verify perft. Python immutable parent undo is intentionally simple. Prototype search ignores draw history; fix before production analysis. Do not copy its float evaluator terminal handling uncritically.

Run exact README research commands to confirm baseline if needed; preserve result versions rather than overwrite history. Record toolchain, seeds, commands, failures, timing and hardware. No invented tests or metrics. Finish M0 with test output and reviewable source, then proceed to M1 only when acceptance gates pass. Avoid implementing world/markets to hide an unfun core. Run human/ablation gates before M3. Final design can change when evidence warrants it, with rules version and fresh fixtures.

Architecture: TypeScript/Vite, Canvas2D + semantic HTML, dedicated AI Worker, IndexedDB transactions, versioned service-worker caches and JSON backups. Separate rules, ai, match, world, exchange, economy, persistence and UI. Do not use Python runtime in shipped app. No uncontrolled localhost port switching or killing other servers. Windows local launcher and iPhone HTTPS-installed offline PWA require actual device tests; never promise permanent browser storage.

At M2 implement iterative deepening alpha-beta, threat-aware quiescence, TT with draw context, PV and cancellation; use completed iteration under budget. Demonstrate stronger policies with equal-budget paired tests; no hidden bonuses. Estimate probabilities only after held-out calibration.

At M3 generate deterministic 4096 competitors, use Glicko-2 reference implementation tests and tiered simulation clearly tagged abstract/full. A visible live market must commit to full engine simulation before opening.

At M4 implement fictional three-outcome LMSR only. Fixed b, covered holdings, micro-G ledger, reserved subsidy, atomic state-version quotes, no shorting/leverage, deterministic idempotent W/D/L/void settlement. No trading on own-controlled events. Never reset AMM q to match engine evaluations. Local save inspection cannot be prevented; do not claim cheat-proof markets.

M5+ follows roadmap, optional Forge separately rated. No fabricated ML careers, calibration or balance claims. Produce small increments with source, commands, tests and remaining risks. Report milestone acceptance failures plainly and fix or revise before advancing.
'''
}
for name,body in files.items():(root/name).write_text(body)
print('Wrote',len(files),'documents')
