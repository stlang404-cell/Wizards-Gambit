# The Grand Arcane Championship
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
