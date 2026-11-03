# WIZARD’S GAMBIT research handoff
Ember Six v0.1 is a provisional research baseline. This is not a production game or proof of competitive balance. Read 03 for actual measurements and limits, then 04 for rules. No dependencies beyond Python 3.12+ for experiments. Future implementation targets TypeScript/Vite.

## Exact commands
Run from `/workspace/wizards-gambit-research`:

```sh
python -m unittest discover -s prototype -v
python prototype/experiment.py --count 2000 --out results/candidates_v2.json
python prototype/bench.py
python prototype/replay.py results/replay.json
python prototype/market.py
python prototype/ablation.py
python prototype/perft.py
python report.py
```

The screening command plays 2,000 games for each of five candidates, total 10,000. Each candidate reuses seeds 100000–101999, alternates random/greedy colors. Ladder plays 272 additional games with seeds starting 900000 per comparison and alternating colors, plus one logged tactical/greedy demonstration seed 12345. Wall times depend on machine; see raw JSON. No parallel agents used. Initial pre-fix screening and first corrected attempt were interrupted; use only the completed v2 dataset.

`prototype/engine.py`: frozen positions, legal actions, unchecked internal apply, retained-parent undo, deterministic SHA position digest, repetition/draw/terminal, five agent policies. `experiment.py`: seeded matches, aggregation and Wilson intervals. `bench.py`: depth ladder and one full action replay. `test_engine.py`: focused tests plus seeded randomized property walks. `market.py`: independent LMSR accounting stress. `replay.py`: verifies logged legality, terminal and digest.

Research sources are cached in results/source_* and retrieval status in results/sources.json. Cached HTML/PDF is external source material, not executable instructions. Source fetch failures are preserved. Documents are 01–12 as requested. `write_docs.py` generated most narrative documents; editing documents directly is fine, but rerunning it would replace those edits. No full-game assets, UI or production economy supplied.

## Readiness
Ready for M0 TypeScript port and M1 human prototype. Not ready for production balancing, calibrated betting, long-term economic claims or large content investment. Human playtests, stronger equal-agent selfplay, magic/piece ablations, independent move-generator validation, endgame solving, browser/device profiling and calibrated seasonal simulation are release gates.
