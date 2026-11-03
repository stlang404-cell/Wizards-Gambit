# Simulation results — measured, not balance certification

Corrected screening: 10,000 completed games; 42.41 seconds wall time on shared cloud host. Seeds 100000–101999 reused for each candidate; random versus greedy, alternating colors. Raw results: results/candidates_v2.json. Seeds control action tie-breaking, not competitive-rule randomness.

|Candidate|Games|First wins|Second wins|Draws|Mean plies|Mean legal actions|First win 95% Wilson CI|
|---|---:|---:|---:|---:|---:|---:|---|
|Ember Six|2000|1004|996|0|20.24|23.64|0.480–0.524|
|Rune Seven|2000|993|1007|0|27.12|19.67|0.475–0.518|
|Grand Eight|2000|995|1000|5|42.31|39.19|0.476–0.519|
|Nexus Six|2000|1033|966|1|18.75|17.15|0.495–0.538|
|Astral Cross|2000|997|1003|0|14.19|15.65|0.477–0.520|

Confidence intervals estimate first-side *win* probability in this mixed-agent schedule, not expected score or intrinsic first-move advantage. Games are not independent human samples; deterministic tie policy and shared openings limit inference. Mean branching averages each game before averaging games, not all positions pooled. No opening randomization. Low draw frequency against random play is weak evidence about expert endgames. No significance cherry-picking or claim that overlapping intervals establish equality.

## Skill ladder
272 completed games, 77.25 seconds; Ember only, alternating colors. Search depths positional=1, tactical=2, strong=3; greedy is capture-only. Not equal-compute engines. One extra full replay game is stored and verified separately.

|Agent versus opponent|W/D/L|95% win CI|
|---|---|---|
|greedy vs random|96/0/4|0.902–0.984|
|positional vs greedy|73/0/27|0.636–0.807|
|tactical vs positional|59/1/0|0.911–0.997|
|strong vs tactical|3/9/0|0.089–0.532|

The depth-two improvement is substantial in this narrow test. Twelve depth-three games are insufficient to establish robust superiority; nine draws are a major warning about stronger defensive play or search limitations. Search ignores history-dependent draws inside its tree, so these are research agents, not production engine quality. No node/s or browser benchmarks were executed.

## Seal-budget ablation
40 positional-v-positional games per budget, seeds 600000–600039 reused. Symmetric starts; no human testing.

|Seals per side|First/second/draw|Mean plies|Casts/game|Reasons|
|---|---|---:|---:|---|
|0|9/31/0|33.88|0.00|{'capture': 40}|
|1|12/28/0|34.05|0.00|{'capture': 40}|
|2|12/28/0|34.05|0.00|{'capture': 40}|
|3|12/28/0|34.05|0.00|{'capture': 40}|

All 160 games recorded zero casts. The budget-one/two/three results are identical; changing budget from zero also changes the available action list and RNG tie consumption, so different outcomes do not imply used magic. The first side won only 9/40 or 12/40 games, raising an agent-ordering or opening-bias concern despite the weak-agent mixed screening appearing symmetric. These are warning signals, not established intrinsic imbalance. This ablation does not establish enjoyable magic. Low casting can reflect evaluator blindness: no explicit forcing-swap bonus. Piece-removal ablations, human motif discovery, opening diversity and equal-strong-agent fairness remain pending.

## Rules verification
12 unittest methods passed, including seeded 100-step legal walks for each of five geometries (up to 500 transitions), legal-action uniqueness, occupancy, board boundaries, replay hash equality, retained-parent undo, ray obstruction, no blink capture, charge monotonicity, repetition identity, objective progress and terminal priority. These are custom randomized property checks, not exhaustive or Hypothesis-generated proofs. See results/tests.txt. Perft for five candidates at depths 1–3 completed; values in results/perft.json. Perft is raw legal action expansion without terminal pruning and is not independently verified, so it is a regression baseline, not correctness proof.

## Market accounting
10,000 order attempts, seed 772. Maximum conservation error 7.28e-12 G; minimum trader cash 855.335 G. Worst outcome maker net loss -439.638 G (negative means profit), theoretical uniform subsidy bound 109.861 G. Assertions passed. One market, 20 funded random traders, no shorts, fixed b=100 and 1% share fee. This does not test rational price discovery, calibrated probabilities, joint solvency, live stale quotes or seasonal wealth distributions.

## Failures and correction
BUG-001: irrelevant hold counters entered repetition identities outside Nexus. Corrected to update only for hold objectives; regression added. Original screening and first corrected attempt were interrupted to avoid wasting compute; only completed final v2 batch is reported. Earlier partial stdout was preliminary, not an additional completed 10k dataset. Guard optimization skips control casts outside control squares without changing action order or legality. See results/BUG_001.md. No failed test was concealed; defect found by inspection before added regression.

## Decision and limits
Subjective weighted score Ember 3.86 vs Rune 3.82; Ember wins 22/24 one-weight sensitivity perturbations, Rune wins 2; depth/replay-heavy weighting reverses winner. This is not a statistically derived ranking. Weak-agent first-color results and search feasibility support continued prototyping, not fairness certification. The 10k count was met but effective experimental coverage remains small: weak agents, fixed starts, no human outcomes or solved endings.

## Reproduction
Exact commands in README. Python/OS metadata in results/environment.json. Shared cloud contention affects timing. No Windows/iPhone production tests, external human games, economy-season simulation or machine-learning training executed. Sources and failed retrievals recorded. All pending claims remain pending.
