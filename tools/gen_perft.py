"""Raw perft oracle values from the Python research prototype (Ember Six).

Usage (from repo root):  python3 tools/gen_perft.py fixtures/perft_v0.1.json

Start position to depth 4, plus depth-3 counts at mid-game positions taken
from golden replays (positions given in canonical board/side/seals form).
Raw perft: no terminal pruning, identical to research/prototype/perft.py.
"""
import json, sys, time
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'research' / 'prototype'))
import engine as E  # noqa: E402

C = E.CONFIGS[0]


def perft(s, d):
    return 1 if not d else sum(perft(E.apply(C, s, a), d - 1) for a in E.actions(C, s))


def perft_terminal(s, d):
    """Royal-capture-pruned perft (only terminal reachable within 4 plies of the start)."""
    if not d:
        return 1
    if 1 not in s.board or -1 not in s.board:
        return 0
    return sum(perft_terminal(E.apply(C, s, a), d - 1) for a in E.actions(C, s))


def decode(code):
    if code >= 1296:
        c = code - 1296
        return ('swap', c // 36, c % 36)
    return ('move', code // 36, code % 36)


def main(out):
    golden = json.loads((ROOT / 'fixtures' / 'golden_replays_v0.1.json').read_text())
    t0 = time.time()
    start = {str(d): perft(E.initial(C), d) for d in range(1, 5)}
    t_start = time.time() - t0
    start_terminal = {str(d): perft_terminal(E.initial(C), d) for d in range(1, 5)}
    mids = []
    for g in golden['games'][:60:6]:
        k = min(12, len(g['actions']) - 1)
        s = E.initial(C)
        for code in g['actions'][:k]:
            s = E.apply(C, s, decode(code))
        if E.terminal(C, s, {}) is not None:
            continue
        mids.append(dict(game=g['id'], afterPly=k, board=list(s.board), side=s.turn, seals=list(s.charges),
                         quiet=s.quiet, ply=s.ply, perft={str(d): perft(s, d) for d in range(1, 4)}))
    Path(out).write_text(json.dumps(dict(
        source='tools/gen_perft.py (research/prototype/engine.py, raw perft, no terminal pruning)',
        start=start, startRoyalPruned=start_terminal, startSeconds=round(t_start, 2), mid=mids), indent=1) + '\n')
    print(start, start_terminal, len(mids), f'{t_start:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'fixtures/perft_v0.1.json')
