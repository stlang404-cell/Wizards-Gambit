# Candidate systems and decision model
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
