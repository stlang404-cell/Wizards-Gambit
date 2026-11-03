/**
 * Tutorial lessons. Pure data + goal predicates evaluated with the real
 * rules engine (no duplicated movement logic). Each interactive lesson has a
 * start position, a goal, and a known solution that test/tutorial.test.ts
 * proves is legal and satisfies the goal.
 */
import { Game } from '../rules/game.ts';
import type { Action } from '../rules/actions.ts';
import { formatAction } from '../rules/actions.ts';

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  /** Position notation; omitted for read-only lessons. */
  readonly position?: string;
  readonly task?: string;
  /** Solution in action notation (also used as the hint). */
  readonly solution?: string;
  readonly hint?: string;
  readonly goal?: (before: Game, action: Action, after: Game) => boolean;
  /** Pieces/squares to mention visually. */
  readonly focus?: readonly string[];
}

/** After `after`, can the opponent capture the mover's Archwizard immediately? */
export function royalSafeAfter(after: Game): boolean {
  if (after.outcome) return after.outcome.winner !== 0 ? after.outcome.winner === -after.side : true;
  for (const reply of after.legalActions()) {
    const r = after.play(reply);
    if (r.ok && r.value.outcome?.reason === 'royal-capture') return false;
  }
  return true;
}

const exact = (notation: string) => (before: Game, action: Action): boolean =>
  formatAction(action, before.position().board).replace('x', '-') === notation.replace('x', '-');

export const LESSONS: readonly Lesson[] = [
  {
    id: 'goal',
    title: 'The Board and the Goal',
    body: [
      'Ember Six is played on a 6×6 board. You command the Ember army (gold, starting at the bottom). Your rival commands the Umbral army (violet, at the top). Ember moves first.',
      'Each turn you take exactly one action: move one piece, or cast a Concord exchange. There is no passing.',
      'You win by capturing the enemy Archwizard. There is no check and no checkmate: an Archwizard may step into danger, and if it can be captured, the opponent simply takes it and wins.',
    ],
    position: 'whsahw/ffffff/6/6/FFFFFF/WHASHW 1 2-2 0 0',
    task: 'Make any legal move to begin. Click a piece, then click a glowing square.',
    solution: 'c2-c3',
    goal: () => true,
  },
  {
    id: 'archwizard',
    title: 'The Archwizard',
    body: [
      'The Archwizard (tall split spire) steps one square in any of the eight directions, and captures the same way.',
      'It is your most precious piece: lose it and you lose the game. It is also a capable fighter in close quarters.',
    ],
    position: '5a/6/6/2A3/6/6 1 0-0 0 0',
    task: 'Step your Archwizard one square in any direction.',
    solution: 'c3-d4',
    goal: (b, a) => a.kind === 'move' && Math.abs(b.position().board[a.from]!) === 1,
    focus: ['c3'],
  },
  {
    id: 'warden',
    title: 'The Warden',
    body: [
      'The Warden (square gate) slides one or two squares straight: up, down, left or right.',
      'A two-square slide needs the square in between to be empty. Any piece, friend or foe, blocks it. Pieces capture by moving onto an enemy.',
    ],
    position: '5a/6/6/2F3/2W1f1/A5 1 0-0 0 0',
    task: 'Your Familiar on c3 blocks the Warden upward. Slide the Warden two squares right to capture the Familiar on e2.',
    solution: 'c2xe2',
    goal: exact('c2xe2'),
    focus: ['c2', 'e2'],
  },
  {
    id: 'hexweaver',
    title: 'The Hexweaver',
    body: [
      'The Hexweaver (tapered loom) slides one or two squares diagonally, with the same blocking rule as the Warden.',
      'Because it only moves diagonally, a Hexweaver stays on squares of one colour for the whole game.',
    ],
    position: '5a/6/4f1/6/2H3/A5 1 0-0 0 0',
    task: 'Capture the Familiar on e4 with your Hexweaver.',
    solution: 'c2xe4',
    goal: exact('c2xe4'),
    focus: ['c2', 'e4'],
  },
  {
    id: 'spellblade',
    title: 'The Spellblade',
    body: [
      'The Spellblade (crossed blades) leaps in an L: two squares one way and one square sideways.',
      'It jumps over anything in between, so it is the one piece that cannot be blocked.',
    ],
    position: '5a/6/6/4f1/FFFFFF/3S1A 1 0-0 0 0',
    task: 'Leap over your own Familiars and capture on e3.',
    solution: 'd1xe3',
    goal: exact('d1xe3'),
    focus: ['d1', 'e3'],
  },
  {
    id: 'familiar',
    title: 'The Familiar',
    body: [
      'The Familiar (lantern creature) steps one square straight: forward, backward or sideways, and captures the same way.',
      'Familiars never promote. They screen, trade, and quietly take away squares from the enemy.',
    ],
    position: '5a/6/6/2Ff2/6/A5 1 0-0 0 0',
    task: 'Capture the enemy Familiar beside yours.',
    solution: 'c3xd3',
    goal: exact('c3xd3'),
    focus: ['c3', 'd3'],
  },
  {
    id: 'royal-capture',
    title: 'Capturing the Archwizard',
    body: [
      'Capturing the enemy Archwizard ends the game at once, whatever else is on the board, even if your rival still has seals left.',
    ],
    position: '6/6/3a2/6/3W2/A5 1 0-0 0 0',
    task: 'The Umbral Archwizard on d4 is exposed. Win the game.',
    solution: 'd2xd4',
    goal: (_b, _a, after) => after.outcome?.reason === 'royal-capture' && after.outcome.winner === 1,
    focus: ['d2', 'd4'],
  },
  {
    id: 'danger',
    title: 'Danger!',
    body: [
      'Because there is no check, the game will not stop you leaving your Archwizard where it can be captured. The board marks a threatened Archwizard in red. Always look at what your opponent can take next turn.',
    ],
    position: '5a/2w3/6/2A3/6/6 1 0-0 0 0',
    task: 'The Warden on c5 threatens your Archwizard through c4. Move the Archwizard to a square the enemy cannot capture.',
    solution: 'c3-b2',
    goal: (_b, _a, after) => royalSafeAfter(after),
    focus: ['c3', 'c5'],
  },
  {
    id: 'concord',
    title: 'Concord: the Exchange Spell',
    body: [
      'Instead of moving, you may cast Concord: two of your own pieces that touch (including diagonally) swap squares. This uses your whole turn and spends one seal.',
      'Concord never captures. Any two of your pieces may swap, the Archwizard included. To cast, select a piece and press Concord (or the C key), then choose a glowing partner.',
    ],
    position: '5a/6/3h2/w5/6/AF4 1 1-0 0 10',
    task: 'Your Archwizard on a1 is attacked by the Warden through a2, and b2 is covered by the Hexweaver. No ordinary move saves it. Cast Concord to swap the Archwizard with the Familiar on b1.',
    solution: 'a1~b1',
    goal: (_b, a, after) => a.kind === 'concord' && royalSafeAfter(after),
    focus: ['a1', 'b1'],
  },
  {
    id: 'seals',
    title: 'Seals Are Precious',
    body: [
      'Each side begins with two seals, shown beside the board. Seals never come back. Once both are spent, Concord is gone for the rest of the game.',
      'A seal kept in reserve is a threat in itself: your rival must respect a possible escape or regrouping. Spending one on a meaningless swap wastes it.',
    ],
  },
  {
    id: 'draws',
    title: 'How Games End',
    body: [
      'Victory: capture the enemy Archwizard.',
      'Draw by repetition: the same position (same pieces, same player to move, same seals left) occurs for the third time.',
      'Draw by quiet play: 60 actions in a row without a capture. Concord does not reset this count; a capture does.',
      'Draw by length: the game reaches 180 actions in total.',
      'There are no draw offers and no passing. A side with no legal action would lose, but with these armies that cannot actually happen.',
    ],
  },
  {
    id: 'fork',
    title: 'Tactic: the Twin Hex',
    body: [
      'A fork attacks two targets at once. Your rival can save only one. Forks that include the Archwizard are deadly, because the Archwizard must be saved.',
    ],
    position: '1w3a/6/6/6/1H4/A5 1 0-0 0 0',
    task: 'Find the Hexweaver move that attacks both the enemy Archwizard (f6) and the enemy Warden (b6).',
    solution: 'b2-d4',
    goal: exact('b2-d4'),
    focus: ['b2', 'd4', 'b6', 'f6'],
  },
];
