import { describe, expect, it } from 'vitest';
import { Game, internal, validatePosition } from '../src/rules/index.ts';
import { createPosition } from '../src/rules/position.ts';
import { cc, legalStrings, mv, pos, sq } from './helpers.ts';

const { adjudicate, canonicalBytes, positionDigest } = internal;
const START = 'whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0';

function play(g: Game, ...actions: Parameters<Game['play']>[0][]): Game {
  for (const a of actions) {
    const r = g.play(a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)}: ${r.error.message}`);
    g = r.value;
  }
  return g;
}
function game(text: string): Game {
  const r = Game.fromPosition(text);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
/** Moves of the piece on `from` (destinations sorted), in an otherwise given position. */
function targets(text: string, from: string): string[] {
  return legalStrings(pos(text)).filter((s) => s.startsWith(`${from}-`)).map((s) => s.slice(3)).sort();
}

describe('setup and notation', () => {
  it('initial notation and canonical bytes are pinned', () => {
    const g = Game.initial();
    expect(g.notation()).toBe(START);
    const bytes = Array.from(canonicalBytes(pos(START)));
    expect(bytes.slice(0, 2)).toEqual([1, 1]);
    expect(bytes.slice(2, 8)).toEqual([2, 3, 1, 4, 3, 2]); // rank 1: W H A S H W
    expect(bytes.slice(32, 38)).toEqual([254, 253, 252, 255, 253, 254]); // rank 6 a..f: w h s a h w
    expect(bytes.slice(38)).toEqual([1, 2, 2, 0, 0, 0]);
    // Same value is produced independently by tools/gen_golden.py from the Python prototype.
    expect(g.digest()).toBe('9491c5fa1844f17f359fb21d456dc79b34983791646a29b2ddffb460750ebbb8');
  });

  it('notation round-trips', () => {
    for (const t of [START, '6/2a3/6/3W2/1A4/6 2 0-1 17 99', 'A5/6/6/6/6/5a 1 0-0 0 0']) {
      expect(internal.formatPosition(pos(t))).toBe(t);
    }
  });

  it('opening has exactly 34 actions: 6 Familiar advances, 2 Spellblade jumps, 26 Concords', () => {
    const l = legalStrings(pos(START));
    expect(l.length).toBe(34);
    expect(l.filter((s) => s.includes('~')).length).toBe(26);
    expect(l.filter((s) => s.startsWith('d1-'))).toEqual(['d1-c3', 'd1-e3']);
  });
});

describe('movement geometry and board boundaries', () => {
  // Lone piece + both Archwizards tucked away on the far side.
  const lone = (letter: string, at: string): string => {
    const b = new Array<string>(36).fill('.');
    b[sq('f6')] = 'a';
    b[sq(at)] = letter;
    if (letter !== 'A') b[sq('a6')] = 'A';
    const ranks: string[] = [];
    for (let r = 5; r >= 0; r--) {
      let s = '';
      let e = 0;
      for (let f = 0; f < 6; f++) {
        const c = b[r * 6 + f]!;
        if (c === '.') { e++; continue; }
        if (e) { s += e; e = 0; }
        s += c;
      }
      if (e) s += e;
      ranks.push(s);
    }
    return `${ranks.join('/')} 1 0-0 0 0`;
  };

  it('central reach on c3 (empty surroundings): W 8, H 8, S 8, F 4, A 8', () => {
    expect(targets(lone('W', 'c3'), 'c3')).toEqual(['a3', 'b3', 'c1', 'c2', 'c4', 'c5', 'd3', 'e3']);
    expect(targets(lone('H', 'c3'), 'c3')).toEqual(['a1', 'a5', 'b2', 'b4', 'd2', 'd4', 'e1', 'e5']);
    expect(targets(lone('S', 'c3'), 'c3')).toEqual(['a2', 'a4', 'b1', 'b5', 'd1', 'd5', 'e2', 'e4']);
    expect(targets(lone('F', 'c3'), 'c3')).toEqual(['b3', 'c2', 'c4', 'd3']);
    expect(targets(lone('A', 'c3'), 'c3')).toEqual(['b2', 'b3', 'b4', 'c2', 'c4', 'd2', 'd3', 'd4']);
  });

  it('corner and edge squares lose off-board targets without wrapping', () => {
    expect(targets(lone('W', 'a1'), 'a1')).toEqual(['a2', 'a3', 'b1', 'c1']);
    expect(targets(lone('H', 'a1'), 'a1')).toEqual(['b2', 'c3']);
    expect(targets(lone('S', 'a1'), 'a1')).toEqual(['b3', 'c2']);
    expect(targets(lone('F', 'a1'), 'a1')).toEqual(['a2', 'b1']);
    expect(targets(lone('A', 'a1'), 'a1')).toEqual(['a2', 'b1', 'b2']);
    expect(targets(lone('W', 'f1'), 'f1')).toEqual(['d1', 'e1', 'f2', 'f3']); // no wrap to a2
    expect(targets(lone('S', 'f2'), 'f2')).toEqual(['d1', 'd3', 'e4']);
    expect(targets(lone('H', 'e5'), 'e5')).toEqual(['c3', 'd4', 'd6', 'f4', 'f6']); // f6 holds the enemy A: capture
  });

  it('length-two slides need an empty intermediate; friends and enemies both block, enemy is capturable', () => {
    // W a1, friendly F a2: cannot reach a3 (04 example)
    expect(targets('a4a/6/6/6/F5/W5 1 0-0 0 0', 'a1')).toEqual(['b1', 'c1']);
    // enemy f on a2: capture a2, but not beyond
    expect(targets('a4a/6/6/6/f5/W4A 1 0-0 0 0', 'a1')).toEqual(['a2', 'b1', 'c1']);
    // H c1 with enemy on d2: captures d2 but cannot pass to e3; b2 empty so a3 reachable
    expect(targets('a5/6/6/6/3f2/2H2A 1 0-0 0 0', 'c1')).toEqual(['a3', 'b2', 'd2']);
  });

  it('Spellblade jumps over a full second rank (04 example: d1 to c3 or e3)', () => {
    expect(targets(START, 'd1')).toEqual(['c3', 'e3']);
  });

  it('friendly destinations are forbidden; Familiars may retreat and capture sideways', () => {
    expect(targets('5a/6/6/1fFF2/2F3/A5 1 0-0 0 0', 'c3')).toEqual(['b3', 'c4']);
    expect(targets('5a/6/6/1fFF2/2F3/A5 1 0-0 0 0', 'c2')).toEqual(['b2', 'c1', 'd2']);
  });

  it('second player moves only negative pieces', () => {
    const l = legalStrings(pos('whsahw/ffffff/6/6/FFFFFF/WHASHW 2 2-2 0 0'));
    expect(l.length).toBe(34);
    expect(l.every((s) => Number(s[1]) >= 5)).toBe(true);
  });
});

describe('Concord (exact spell semantics)', () => {
  // A c3, F d3, enemy W c5 with c4 open (04 example)
  const EX = '2a3/2w3/6/2AF2/6/6 1 2-2 5 20';

  it('04 example: A c3 exchanges with F d3; seal spent, nothing captured, quiet increments, turn ends', () => {
    const g = play(game(EX), cc('c3', 'd3'));
    const p = g.position();
    expect(p.board[sq('d3')]).toBe(1);
    expect(p.board[sq('c3')]).toBe(5);
    expect(p.seals).toEqual([1, 2]);
    expect(p.quietPly).toBe(6);
    expect(p.totalPly).toBe(21);
    expect(p.side).toBe(-1);
    expect(p.board.filter((v) => v !== 0).length).toBe(4);
    // the enemy Warden can now capture the Familiar on c3 (evacuation does not guarantee safety elsewhere)
    expect(g.isLegal(mv('c5', 'c3'))).toBe(true);
  });

  it('click order is insignificant: concord(d3,c3) equals concord(c3,d3)', () => {
    expect(cc('d3', 'c3')).toEqual(cc('c3', 'd3'));
    expect(internal.parseAction('d3~c3')).toEqual(internal.parseAction('c3~d3'));
  });

  it('diagonal adjacency is allowed; distance two, enemy partner, empty partner, same square are not', () => {
    const g = game('a5/6/6/1F1f2/2A3/6 1 2-2 0 0'); // A c2, F b3 (diag), f d3 enemy (diag)
    expect(g.isLegal(cc('b3', 'c2'))).toBe(true);
    expect(g.isLegal(cc('c2', 'd3'))).toBe(false); // enemy
    expect(g.isLegal(cc('c2', 'c3'))).toBe(false); // empty
    const far = game('a5/6/6/6/A1F3/6 1 2-2 0 0'); // A a2, F c2: distance 2
    expect(far.isLegal(cc('a2', 'c2'))).toBe(false);
    expect(far.play({ kind: 'concord', lo: sq('a2'), hi: sq('a2') }).ok).toBe(false);
  });

  it('identical piece types may exchange; it still costs a seal and is a quiet action', () => {
    const g = play(game('a5/6/6/6/FF4/A5 1 2-2 3 3'), cc('a2', 'b2'));
    expect(g.position().seals).toEqual([1, 2]);
    expect(g.position().quietPly).toBe(4);
    // board unchanged, but identity differs by seals, so this is not a repetition
    expect(g.position().board).toEqual(game('a5/6/6/6/FF4/A5 1 2-2 3 3').position().board);
    expect(g.repetitionCount()).toBe(1);
  });

  it('seals run out: after two casts no Concord is legal; second player spends its own seals', () => {
    let g = game('a4f/5f/6/6/FF4/A5 1 2-2 0 0');
    g = play(g, cc('a2', 'b2'), cc('f5', 'f6'), cc('a1', 'a2'), cc('f6', 'f5'));
    expect(g.position().seals).toEqual([0, 0]);
    expect(g.legalActions().some((a) => a.kind === 'concord')).toBe(false);
    expect(g.play(cc('a1', 'b2')).ok).toBe(false);
  });

  it('a capture of the Archwizard wins immediately even if the loser still holds seals', () => {
    const g = play(game('6/6/6/2a3/2A3/6 1 2-2 0 0'), mv('c2', 'c3'));
    expect(g.outcome).toEqual({ winner: 1, reason: 'royal-capture' });
    expect(g.legalActions()).toEqual([]);
  });

  it('A on c3 may capture an enemy A on c4 immediately (04 example)', () => {
    const g = play(game('6/6/2a3/2A3/6/6 1 2-2 0 0'), mv('c3', 'c4'));
    expect(g.outcome).toEqual({ winner: 1, reason: 'royal-capture' });
  });
});

describe('termination and draw priority', () => {
  it('third occurrence draws; the start position counts as the first occurrence', () => {
    let g = game('5a/6/6/6/6/A5 1 2-2 0 0');
    const cycle = [mv('a1', 'b1'), mv('f6', 'e6'), mv('b1', 'a1'), mv('e6', 'f6')];
    g = play(g, ...cycle);
    expect(g.repetitionCount()).toBe(2);
    expect(g.outcome).toBeNull();
    g = play(g, ...cycle.slice(0, 3));
    expect(g.outcome).toBeNull();
    g = play(g, cycle[3]!);
    expect(g.repetitionCount()).toBe(3);
    expect(g.outcome).toEqual({ winner: 0, reason: 'repetition' });
    expect(g.ply).toBe(8);
  });

  it('same board with different seals or side to move is a different identity', () => {
    let g = game('5a/5f/6/6/F5/A5 1 1-1 0 0');
    g = play(g, cc('a1', 'a2'), cc('f5', 'f6')); // seals 0-0
    g = play(g, mv('a2', 'b2'), mv('f5', 'e5'), mv('b2', 'a2'), mv('e5', 'f5')); // board back to post-cast board
    expect(g.repetitionCount()).toBe(2);
    // starting board (pre-casts) identity is not counted as the same
    const start = game('5a/5f/6/6/F5/A5 1 1-1 0 0');
    expect(internal.repetitionKey(pos(start.notation()))).not.toBe(internal.repetitionKey(pos(g.notation())));
  });

  it('quiet limit: 60 consecutive non-capture plies draw; Concord does not reset; capture resets', () => {
    let g = game('5a/6/6/6/F5/A5 1 2-2 58 58');
    g = play(g, cc('a1', 'a2'));
    expect(g.position().quietPly).toBe(59);
    g = play(g, mv('f6', 'e6'));
    expect(g.outcome).toEqual({ winner: 0, reason: 'quiet-limit' });
    const c = play(game('5a/6/6/6/6/Af4 1 2-2 59 59'), mv('a1', 'b1'));
    expect(c.position().quietPly).toBe(0);
    expect(c.outcome).toBeNull();
  });

  it('ply cap: the 180th ply draws unless it captures the Archwizard', () => {
    expect(play(game('5a/6/6/6/6/A5 1 2-2 0 179'), mv('a1', 'b1')).outcome).toEqual({ winner: 0, reason: 'ply-cap' });
    expect(play(game('6/6/6/6/a5/A5 1 2-2 0 179'), mv('a1', 'a2')).outcome).toEqual({ winner: 1, reason: 'royal-capture' });
  });

  it('priority order: repetition > quiet > ply cap > no legal actions', () => {
    const p = (q: number, t: number) => createPosition(pos('5a/6/6/6/6/A5 1 2-2 0 0').board, 1, [2, 2], q, t);
    expect(adjudicate(p(60, 180), 3)).toEqual({ winner: 0, reason: 'repetition' });
    expect(adjudicate(p(60, 180), 2)).toEqual({ winner: 0, reason: 'quiet-limit' });
    expect(adjudicate(p(59, 180), 2)).toEqual({ winner: 0, reason: 'ply-cap' });
    expect(adjudicate(p(59, 179), 2)).toBeNull();
  });

  it('no legal actions: side to move loses; ply cap outranks it (internal adjudicator, over-army board)', () => {
    // Every square is first-player except a negative A on f6 that nothing can reach:
    // e6/f5/e5 are Spellblades (cannot hit f6), d5/e4 are Hexweavers, rest Hexweavers, A on a1.
    const b = new Array<number>(36).fill(3);
    b[sq('a1')] = 1;
    b[sq('f6')] = -1;
    for (const s of ['e6', 'f5', 'e5']) b[sq(s)] = 4;
    const stuck = createPosition(b, 1, [0, 0], 0, 0);
    expect(internal.hasLegalAction(stuck)).toBe(false);
    expect(adjudicate(stuck, 1)).toEqual({ winner: -1, reason: 'no-legal-actions' });
    expect(adjudicate(createPosition(b, 1, [0, 0], 0, 180), 1)).toEqual({ winner: 0, reason: 'ply-cap' });
    // with a seal, a Concord is available, so not stuck
    expect(internal.hasLegalAction(createPosition(b, 1, [1, 0], 0, 0))).toBe(true);
    // and the public API rejects the board (exceeds the army)
    expect(validatePosition({ board: b, side: 1, seals: [0, 0], quietPly: 0, totalPly: 0 }).ok).toBe(false);
  });

  it('play is refused after any terminal outcome', () => {
    const g = game('5a/6/6/6/6/A5 1 2-2 60 60');
    expect(g.outcome?.reason).toBe('quiet-limit');
    const r = g.play(mv('a1', 'b1'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('game-over');
  });
});

describe('public API rejects invalid positions', () => {
  const base = { board: Array.from(pos(START).board), side: 1, seals: [2, 2], quietPly: 0, totalPly: 0 };
  const bad: [string, unknown][] = [
    ['not an object', 42],
    ['null', null],
    ['short board', { ...base, board: base.board.slice(1) }],
    ['non-integer piece', { ...base, board: base.board.map((v, i) => (i === 20 ? 1.5 : v)) }],
    ['piece code 6', { ...base, board: base.board.map((v, i) => (i === 20 ? 6 : v)) }],
    ['string piece', { ...base, board: base.board.map((v, i) => (i === 20 ? '5' : v)) }],
    ['both Archwizards missing', { ...base, board: base.board.map((v) => (Math.abs(v) === 1 ? 0 : v)) }],
    ['two first-player Archwizards', { ...base, board: base.board.map((v, i) => (i === 20 ? 1 : v)) }],
    ['three Wardens', { ...base, board: base.board.map((v, i) => (i === 20 ? 2 : v)) }],
    ['seventh second-player Familiar', { ...base, board: base.board.map((v, i) => (i === 20 ? -5 : v)) }],
    ['side 0', { ...base, side: 0 }],
    ['side "1"', { ...base, side: '1' }],
    ['seals 3', { ...base, seals: [3, 2] }],
    ['seals negative', { ...base, seals: [2, -1] }],
    ['seals one entry', { ...base, seals: [2] }],
    ['quiet above limit', { ...base, quietPly: 61, totalPly: 100 }],
    ['ply above cap', { ...base, totalPly: 181 }],
    ['quiet above total', { ...base, quietPly: 5, totalPly: 4 }],
    ['negative ply', { ...base, totalPly: -1 }],
    ['fractional ply', { ...base, totalPly: 1.5 }],
    ['wrong rules version', { ...base, rulesVersion: 'ember-six/0.2' }],
    ['notation: 7 files', 'whsahwf/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0'],
    ['notation: bad letter', 'whsahq/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0'],
    ['notation: side 3', 'whsahw/ffffff/6/6/FFFFFF/WHASHW 3 2-2 0 0'],
    ['notation: missing field', 'whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0'],
    ['notation: 5 ranks', 'whsahw/ffffff/6/FFFFFF/WHASHW 1 2-2 0 0'],
  ];
  it.each(bad)('rejects %s', (_label, input) => {
    expect(validatePosition(input).ok).toBe(false);
    const r = Game.fromPosition(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-position');
  });

  it('accepts a terminal-but-valid position (one Archwizard missing) and reports it', () => {
    const g = game('6/6/6/6/6/A5 2 0-0 0 31');
    expect(g.outcome).toEqual({ winner: 1, reason: 'royal-capture' });
  });

  it('accepts PositionData round trip with rulesVersion', () => {
    const g = Game.initial();
    const again = Game.fromPosition(g.position());
    expect(again.ok && again.value.digest()).toBe(g.digest());
  });
});

describe('public API rejects invalid actions', () => {
  const g = Game.initial();
  const bad: [string, unknown][] = [
    ['null', null],
    ['string', 'c2-c3'],
    ['unknown kind', { kind: 'blink', from: 8, to: 20 }],
    ['missing to', { kind: 'move', from: 8 }],
    ['extra field', { kind: 'move', from: 8, to: 14, promote: 2 }],
    ['off-board square 36', { kind: 'move', from: 8, to: 36 }],
    ['negative square', { kind: 'move', from: -1, to: 5 }],
    ['fractional square', { kind: 'move', from: 8.5, to: 14 }],
    ['from === to', { kind: 'move', from: 8, to: 8 }],
    ['non-canonical concord lo>hi', { kind: 'concord', lo: 7, hi: 6 }],
    ['concord lo===hi', { kind: 'concord', lo: 6, hi: 6 }],
  ];
  it.each(bad)('malformed: %s', (_l, a) => {
    const r = g.play(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('malformed-action');
  });

  const illegal: [string, unknown][] = [
    ['move from empty square', mv('c3', 'c4')],
    ['move enemy piece', mv('c5', 'c4')],
    ['move onto friend', mv('a1', 'a2')],
    ['blocked Warden', mv('a1', 'a3')],
    ['Familiar two squares', mv('c2', 'c4')],
    ['Familiar diagonal', mv('c2', 'd3')],
    ['Spellblade non-jump shape', mv('d1', 'd3')],
    ['concord with enemy', cc('a2', 'a5')],
    ['concord not adjacent', cc('a1', 'c1')],
    ['concord with empty square', cc('a2', 'a3')],
  ];
  it.each(illegal)('illegal: %s', (_l, a) => {
    const r = g.play(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('illegal-action');
    expect(g.isLegal(a)).toBe(false);
  });

  it('isLegal agrees with legalActions on the opening', () => {
    const legal = new Set(g.legalActions().map((a) => JSON.stringify(a)));
    for (let from = 0; from < 36; from++) {
      for (let to = 0; to < 36; to++) {
        if (from === to) continue;
        expect(g.isLegal(mv(...([from, to].map((i) => 'abcdef'[i % 6]! + (Math.floor(i / 6) + 1)) as [string, string]))))
          .toBe(legal.has(JSON.stringify({ kind: 'move', from, to })));
        if (from < to) {
          expect(g.isLegal({ kind: 'concord', lo: from, hi: to })).toBe(legal.has(JSON.stringify({ kind: 'concord', lo: from, hi: to })));
        }
      }
    }
  });

  it('input objects are not retained or mutated; returned positions are copies', () => {
    const a = { kind: 'move', from: sq('d1'), to: sq('c3') } as const;
    const next = g.play(a);
    expect(next.ok).toBe(true);
    const p = g.position();
    (p.board as number[])[0] = 0;
    expect(g.position().board[0]).toBe(2);
    expect(g.digest()).toBe(positionDigest(pos(START)));
  });
});

describe('records and undo', () => {
  it('toRecord/fromRecord round trip preserves digest, outcome and repetition counts', () => {
    let g = game('5a/6/6/6/6/A5 1 2-2 0 0');
    g = play(g, mv('a1', 'b1'), mv('f6', 'e6'), mv('b1', 'a1'), mv('e6', 'f6'), mv('a1', 'b1'));
    const rec = g.toRecord();
    expect(rec.actions).toEqual(['a1-b1', 'f6-e6', 'b1-a1', 'e6-f6', 'a1-b1']);
    const r = Game.fromRecord(JSON.parse(JSON.stringify(rec)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.digest()).toBe(g.digest());
      expect(r.value.repetitionCount()).toBe(g.repetitionCount());
      expect(r.value.repetitionCount()).toBe(2);
    }
  });

  it('records with illegal, malformed or post-terminal actions are rejected', () => {
    const cases: [string, unknown[]][] = [
      [START, ['a1-a3']],
      [START, ['zz-a3']],
      [START, [5]],
      ['6/6/6/2a3/2A3/6 1 2-2 0 0', ['c2xc3', 'c3-c4']], // second action after royal capture
    ];
    for (const [start, actions] of cases) {
      const r = Game.fromRecord({ rulesVersion: 'ember-six/0.1', start, actions });
      if (r.ok) throw new Error(`accepted ${JSON.stringify(actions)}`);
      expect(r.error.code).toBe('invalid-record');
    }
    expect(Game.fromRecord({ rulesVersion: 'ember-six/9', start: START, actions: [] }).ok).toBe(false);
  });

  it('undo returns the exact parent, including repetition context', () => {
    const a = Game.initial();
    const b = play(a, mv('c2', 'c3'));
    expect(b.undo()).toBe(a);
    expect(b.undo()!.digest()).toBe(a.digest());
    expect(Game.initial().undo()).toBeNull();
  });
});
