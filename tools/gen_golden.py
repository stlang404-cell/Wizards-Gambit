"""Generate cross-language golden replays from the Python research prototype.

Usage (from repo root):  python3 tools/gen_golden.py fixtures/golden_replays_v0.1.json

The prototype (research/prototype/engine.py) is the reference oracle for
Ember Six v0.1. Its repr-based digest() is Python-only, so this tool re-encodes
every state with the canonical byte layout documented in src/rules/serialize.ts
and hashes it with SHA-256. Action codes: move = from*36+to, Concord (prototype
'swap', lo<hi) = 1296 + lo*36 + hi. legal lists keep prototype order.

Research tooling only; never shipped. Re-running with the same prototype and
seed plan reproduces the file byte-for-byte (no timestamps are written).
"""
import collections, hashlib, json, platform, random, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
PROTO = ROOT / 'research' / 'prototype'
sys.path.insert(0, str(PROTO))
import engine as E  # noqa: E402

C = E.CONFIGS[0]
assert C.name == 'Ember Six'

REASONS = {'capture': 'royal-capture', 'repetition': 'repetition', 'quiet': 'quiet-limit',
           'cap': 'ply-cap', 'immobile': 'no-legal-actions'}


def canonical(s):
    return bytes([1, 1] + [v & 0xff for v in s.board] +
                 [s.turn & 0xff, s.charges[0], s.charges[1], s.quiet, s.ply >> 8, s.ply & 0xff])


def sha(b):
    return hashlib.sha256(b).hexdigest()


def code(a):
    kind, i, j = a
    if kind == 'move':
        return i * 36 + j
    assert kind == 'swap' and i < j
    return 1296 + i * 36 + j


def legal_digest(s):
    return sha(','.join(str(code(a)) for a in E.actions(C, s)).encode())[:16]


def play(first, second, seed):
    rng = random.Random(seed)
    s = E.initial(C)
    hist = collections.Counter({E.key(s): 1})
    acts, counts, ldig, digs = [], [], [], []
    while not (t := E.terminal(C, s, hist)):
        aa = E.actions(C, s)
        counts.append(len(aa))
        ldig.append(legal_digest(s))
        a = E.choose(C, s, first if s.turn == 1 else second, rng)
        acts.append(code(a))
        s = E.apply(C, s, a)
        hist[E.key(s)] += 1
        digs.append(sha(canonical(s))[:16])
    return dict(seed=seed, first=first, second=second, actions=acts, legalCounts=counts,
                legalDigests=ldig, digests=digs, winner=t[0], reason=REASONS[t[1]],
                finalPly=s.ply, finalQuiet=s.quiet, finalSeals=list(s.charges),
                finalBoard=list(s.board), finalDigest=sha(canonical(s)),
                finalRepetitionCount=hist[E.key(s)])


def main(out):
    plan = []  # (first, second, seed)
    base = 700000
    plan += [('random', 'random', base + i) for i in range(50)]
    plan += [(('random', 'greedy') if i % 2 == 0 else ('greedy', 'random')) + (base + 100 + i,) for i in range(15)]
    plan += [('greedy', 'greedy', base + 200 + i) for i in range(10)]
    plan += [(('positional', 'greedy') if i % 2 == 0 else ('greedy', 'positional')) + (base + 300 + i,) for i in range(10)]
    plan += [('tactical', 'tactical', base + 400 + i) for i in range(8)]
    plan += [(('tactical', 'positional') if i % 2 == 0 else ('positional', 'tactical')) + (base + 500 + i,) for i in range(7)]
    games = [play(*p) for p in plan]
    # Targeted extras: first random-v-random seeds (from base+1000) ending by quiet limit or ply cap.
    want = {'quiet-limit': 3, 'ply-cap': 3}
    seed = base + 1000
    while any(want.values()):
        g = play('random', 'random', seed)
        if want.get(g['reason'], 0) > 0:
            want[g['reason']] -= 1
            games.append(g)
        seed += 1
    for i, g in enumerate(games):
        g['id'] = i
    s0 = E.initial(C)
    meta = dict(
        generator='tools/gen_golden.py', rulesVersion='ember-six/0.1', canonicalFormat=1,
        actionCode='move=from*36+to; concord=1296+lo*36+hi', squareIndex='rank*6+file',
        digestNote='digests/legalDigests are the first 16 hex chars of SHA-256; finalDigest is full',
        engineSha256=sha((PROTO / 'engine.py').read_bytes()),
        python=platform.python_version(), initialDigest=sha(canonical(s0)),
        reasonCounts=dict(collections.Counter(g['reason'] for g in games)),
        castCount=sum(1 for g in games for a in g['actions'] if a >= 1296),
    )
    Path(out).write_text(json.dumps(dict(meta=meta, games=games), separators=(',', ':')) + '\n')
    print(json.dumps(dict(games=len(games), **{k: meta[k] for k in ('reasonCounts', 'castCount', 'initialDigest')})))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'fixtures/golden_replays_v0.1.json')
