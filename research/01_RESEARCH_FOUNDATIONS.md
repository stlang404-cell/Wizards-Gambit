# Research foundations
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
