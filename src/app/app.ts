/** Application shell: screens, persistence wiring, menus, tutorial, rules, archive. */
import { h, clear } from './dom.ts';
import { GameScreen } from './game-screen.ts';
import { BoardView } from './board-view.ts';
import { spriteDataUrl, PIECE_NAMES } from './sprites.ts';
import { Game } from '../rules/game.ts';
import { parseAction, type Action } from '../rules/actions.ts';
import { parseSquare } from '../rules/geometry.ts';
import { LESSONS, type Lesson } from '../tutorial/lessons.ts';
import { NO_SELECTION, click, highlights, outcomeText, threatenedRoyals, toggleCast, type Selection } from '../play/interaction.ts';
import { LEVELS, type LevelId } from '../ai/search.ts';
import { validateMatchRecord, type MatchRecord } from '../match/record.ts';
import type { MatchSetup, Seat } from '../match/controller.ts';
import {
  archiveRecord, exportArchive, importArchive, loadSave, writeSave, DEFAULT_SETTINGS, type KeyValueStore, type SaveFile, type Settings,
} from '../persistence/save.ts';
import type { PieceType } from '../rules/constants.ts';

const AI_NAMES: Record<LevelId, string> = { novice: 'Pip the Novice', adept: 'Adept Corvina', magister: 'Magister Thorne' };
const AI_BLURB: Record<LevelId, string> = {
  novice: 'Looks two actions ahead with a playful streak. Never misses an open Archwizard.',
  adept: 'Looks three actions ahead with tactical follow-up. A solid sparring partner.',
  magister: 'Searches up to six actions deep. The strongest M1 baseline. Not a grandmaster.',
};

function safeStore(): KeyValueStore {
  try {
    const k = '__wg_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  }
}

export class App {
  readonly #root: HTMLElement;
  readonly #store = safeStore();
  #save: SaveFile;
  #screen: { destroy?: () => void } | null = null;
  #notices: string[] = [];

  constructor(root: HTMLElement) {
    this.#root = root;
    const loaded = loadSave(this.#store, () => `human:${crypto.randomUUID()}`, new Date().toISOString());
    this.#save = loaded.file;
    this.#notices = [...loaded.warnings];
    this.#persist();
    window.addEventListener('hashchange', () => this.#route());
    this.#route();
  }

  #persist(): void {
    const err = writeSave(this.#store, { ...this.#save, savedAt: new Date().toISOString() });
    if (err && !this.#notices.includes(err)) this.#notices.push(err);
  }

  #route(): void {
    const route = location.hash.replace(/^#\/?/, '') || 'menu';
    this.#screen?.destroy?.();
    this.#screen = null;
    clear(this.#root);
    const [name] = route.split('/');
    switch (name) {
      case 'play': return this.#showGame();
      case 'tutorial': return this.#showTutorial();
      case 'rules': return this.#showRules();
      case 'archive': return this.#showArchive();
      case 'settings': return this.#showSettings();
      default: return this.#showMenu();
    }
  }
  #go(route: string): void {
    if (location.hash === `#/${route}`) this.#route();
    else location.hash = `#/${route}`;
  }

  #frame(title: string, ...content: (Node | string)[]): HTMLElement {
    const notices = this.#notices.length
      ? h('div', { class: 'notices', role: 'alert' }, ...this.#notices.map((n) => h('p', {}, n)),
        h('button', { class: 'btn small', type: 'button', onclick: () => { this.#notices = []; this.#route(); } }, 'Dismiss'))
      : null;
    const page = h('div', { class: 'page' },
      h('header', { class: 'topbar' },
        h('a', { class: 'brand', href: '#/menu' }, h('img', { src: spriteDataUrl(1, 2), alt: '', width: 32, height: 32 }), h('span', {}, 'Wizard’s Gambit')),
        h('nav', { class: 'nav' },
          h('a', { href: '#/menu' }, 'Play'), h('a', { href: '#/tutorial' }, 'Tutorial'), h('a', { href: '#/rules' }, 'Rules'),
          h('a', { href: '#/archive' }, 'Archive'), h('a', { href: '#/settings' }, 'Settings'))),
      notices ?? '',
      h('main', { class: 'content', 'aria-label': title }, ...content));
    this.#root.append(page);
    return page;
  }

  // ------------------------------------------------------------------ menu
  #showMenu(): void {
    const cur = this.#save.current;
    const levelSelect = (id: string, value: LevelId) => h('select', { id },
      ...(Object.keys(LEVELS) as LevelId[]).map((l) => h('option', { value: l, selected: l === value }, LEVELS[l].label)));
    const hvaLevel = levelSelect('hva-level', 'adept');
    const hvaSide = h('select', { id: 'hva-side' }, h('option', { value: 'first' }, 'Ember (move first)'), h('option', { value: 'second' }, 'Umbral (move second)'), h('option', { value: 'random' }, 'Random'));
    const hvaUndo = h('input', { type: 'checkbox', id: 'hva-undo', checked: true });
    const blurb = h('p', { class: 'small blurb' }, AI_BLURB.adept);
    hvaLevel.addEventListener('change', () => { blurb.textContent = AI_BLURB[hvaLevel.value as LevelId]; });
    const hvhUndo = h('input', { type: 'checkbox', id: 'hvh-undo', checked: true });
    const avaA = levelSelect('ava-first', 'adept');
    const avaB = levelSelect('ava-second', 'magister');
    const ai = (l: LevelId): Seat => ({ kind: 'ai', level: l, name: AI_NAMES[l] });

    this.#frame('Main menu',
      h('section', { class: 'hero' },
        h('div', { class: 'hero-pieces', 'aria-hidden': 'true' },
          ...[2, -3, 1, -4, 5, -1, 3, -2].map((p) => h('img', { src: spriteDataUrl(p, 4), alt: '', width: 64, height: 64 }))),
        h('h1', {}, 'Wizard’s Gambit'),
        h('p', { class: 'tagline' }, 'Ember Six · a duel of wardens, hexweavers and spellblades on a six-by-six board'),
        h('p', { class: 'small muted' }, 'Rules: Ember Six v0.1, a provisional research ruleset. All play is local and unrated.')),
      cur ? h('section', { class: 'card resume' },
        h('h2', {}, 'Continue'),
        h('p', {}, `${cur.record.players.first.name} vs ${cur.record.players.second.name} · ${cur.record.plies} actions played`),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', id: 'resume', type: 'button', onclick: () => this.#go('play') }, 'Resume match'),
          h('button', { class: 'btn', type: 'button', onclick: () => { this.#abandon(); this.#route(); } }, 'Abandon'))) : '',
      h('div', { class: 'mode-grid' },
        h('section', { class: 'card' },
          h('h2', {}, 'Duel the AI'),
          h('label', {}, 'Opponent ', hvaLevel), blurb,
          h('label', {}, 'Your army ', hvaSide),
          h('label', { class: 'check' }, hvaUndo, ' Practice: allow undo'),
          h('button', { class: 'btn primary', id: 'start-hva', type: 'button', onclick: () => {
            const lvl = hvaLevel.value as LevelId;
            const side = hvaSide.value === 'random' ? (Math.random() < 0.5 ? 'first' : 'second') : hvaSide.value;
            const you: Seat = { kind: 'human', name: 'You' };
            this.#newMatch({ mode: 'human-vs-ai', first: side === 'first' ? you : ai(lvl), second: side === 'first' ? ai(lvl) : you, allowUndo: hvaUndo.checked });
          } }, 'Begin duel')),
        h('section', { class: 'card' },
          h('h2', {}, 'Pass and Play'),
          h('p', { class: 'small' }, 'Two players share this device and take turns.'),
          h('label', { class: 'check' }, hvhUndo, ' Allow undo'),
          h('button', { class: 'btn primary', id: 'start-hvh', type: 'button', onclick: () => this.#newMatch({
            mode: 'human-vs-human', first: { kind: 'human', name: 'Player 1' }, second: { kind: 'human', name: 'Player 2' }, allowUndo: hvhUndo.checked,
          }) }, 'Start local match')),
        h('section', { class: 'card' },
          h('h2', {}, 'Exhibition'),
          h('p', { class: 'small' }, 'Watch two AI wizards play a complete match. Pause and change speed at any time.'),
          h('label', {}, 'Ember ', avaA), h('label', {}, 'Umbral ', avaB),
          h('button', { class: 'btn primary', id: 'start-ava', type: 'button', onclick: () => this.#newMatch({
            mode: 'ai-vs-ai', first: ai(avaA.value as LevelId), second: { ...ai(avaB.value as LevelId), name: `${AI_NAMES[avaB.value as LevelId]} II`.replace(/ II$/, avaA.value === avaB.value ? ' II' : '') }, allowUndo: false,
          }) }, 'Watch exhibition')),
        h('section', { class: 'card' },
          h('h2', {}, 'Learn'),
          h('p', { class: 'small' }, 'New to Ember Six? The tutorial teaches every piece, Concord and how games end, in a few minutes.'),
          h('div', { class: 'row' },
            h('a', { class: 'btn primary', href: '#/tutorial' }, 'Tutorial'),
            h('a', { class: 'btn', href: '#/rules' }, 'Rules reference')))),
      h('section', { class: 'card future' },
        h('h2', {}, 'Coming in later editions'),
        h('p', { class: 'small' }, 'The Grand Arcane Championship (ratings, thousands of rival wizards, leagues and tournaments), the Grand Exchange prediction markets and the wizarding economy are planned for later milestones. None of them is playable yet.')),
    );
  }

  #abandon(): void {
    const cur = this.#save.current;
    if (!cur) return;
    const v = validateMatchRecord(cur.record);
    if (v.ok) {
      const rec: MatchRecord = { ...cur.record, status: 'abandoned', endedAt: new Date().toISOString() };
      this.#save = archiveRecord({ ...this.#save, current: null }, rec);
    } else this.#save = { ...this.#save, current: null };
    this.#persist();
  }

  #newMatch(setup: MatchSetup): void {
    if (this.#save.current && this.#save.current.record.status === 'in-progress') this.#abandon();
    this.#pendingSetup = setup;
    this.#go('play');
  }
  #pendingSetup: MatchSetup | null = null;

  // ------------------------------------------------------------------ game
  #showGame(): void {
    const page = this.#frame('Match');
    const content = page.querySelector('main')!;
    const screen = new GameScreen({
      settings: () => this.#save.settings,
      humanId: this.#save.profileId,
      onRecord: (record, setup) => { this.#save = { ...this.#save, current: { record, setup } }; this.#persist(); },
      onFinished: (rec) => { this.#save = archiveRecord({ ...this.#save, current: null }, rec); this.#persist(); },
      onAbandon: (rec) => { this.#save = archiveRecord({ ...this.#save, current: null }, rec); this.#persist(); },
      toMenu: () => this.#go('menu'),
      newMatch: (setup) => this.#newMatch(setup),
    });
    content.append(screen.root);
    this.#screen = { destroy: () => screen.destroy() };
    const setup = this.#pendingSetup;
    this.#pendingSetup = null;
    if (setup) {
      screen.start(setup, (Math.random() * 2 ** 32) >>> 0);
    } else if (this.#save.current) {
      const v = validateMatchRecord(this.#save.current.record);
      if (v.ok) screen.resume(this.#save.current.setup, v.value.record, v.value.game);
      else { this.#notices.push('The saved match could not be restored.'); this.#go('menu'); return; }
    } else {
      this.#go('menu');
      return;
    }
    requestAnimationFrame(() => (screen.view.canvas as HTMLCanvasElement).focus({ preventScroll: true }));
  }

  // ------------------------------------------------------------------ tutorial
  #showTutorial(): void {
    let index = Math.max(0, LESSONS.findIndex((l) => !this.#save.tutorialDone.includes(l.id)));
    let view: BoardView | null = null;
    const list = h('ol', { class: 'lesson-list' });
    const body = h('div', { class: 'lesson-body' });
    const boardWrap = h('div', { class: 'board-wrap lesson-board' });
    const feedback = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    const actions = h('div', { class: 'row' });
    this.#frame('Tutorial', h('div', { class: 'tutorial' }, h('nav', { class: 'lesson-nav', 'aria-label': 'Lessons' }, list), h('section', { class: 'lesson' }, body, boardWrap, feedback, actions)));
    const obs = new ResizeObserver(() => view?.resize(Math.min(boardWrap.clientWidth, 520)));
    obs.observe(boardWrap);
    this.#screen = { destroy: () => { view?.destroy(); obs.disconnect(); } };

    const renderList = () => {
      clear(list);
      LESSONS.forEach((l, i) => list.append(h('li', { class: `${i === index ? 'current' : ''} ${this.#save.tutorialDone.includes(l.id) ? 'done' : ''}` },
        h('button', { type: 'button', class: 'link', onclick: () => { index = i; open(); } }, `${this.#save.tutorialDone.includes(l.id) ? '✓ ' : ''}${l.title}`))));
    };
    const complete = (l: Lesson) => {
      if (!this.#save.tutorialDone.includes(l.id)) { this.#save = { ...this.#save, tutorialDone: [...this.#save.tutorialDone, l.id] }; this.#persist(); }
      renderList();
    };
    const nextButton = () => index < LESSONS.length - 1
      ? h('button', { class: 'btn primary', id: 'lesson-next', type: 'button', onclick: () => { index++; open(); } }, 'Next lesson')
      : h('a', { class: 'btn primary', href: '#/menu' }, 'Play your first match');

    const open = () => {
      const l = LESSONS[index]!;
      renderList();
      clear(body); clear(actions); feedback.textContent = '';
      body.append(h('h2', {}, `${index + 1}. ${l.title}`), ...l.body.map((p) => h('p', {}, p)));
      const pieceMatch = /archwizard|warden|hexweaver|spellblade|familiar/.exec(l.id);
      if (pieceMatch) {
        const t = (['', 'archwizard', 'warden', 'hexweaver', 'spellblade', 'familiar'].indexOf(pieceMatch[0])) as PieceType;
        body.prepend(h('div', { class: 'lesson-sprites' }, h('img', { src: spriteDataUrl(t, 4), alt: `Ember ${PIECE_NAMES[t]}`, width: 64, height: 64 }), h('img', { src: spriteDataUrl(-t, 4), alt: `Umbral ${PIECE_NAMES[t]}`, width: 64, height: 64 })));
      }
      view?.destroy(); view = null; clear(boardWrap);
      if (!l.position) {
        boardWrap.hidden = true;
        actions.append(h('button', { class: 'btn primary', id: 'lesson-continue', type: 'button', onclick: () => { complete(l); if (index < LESSONS.length - 1) { index++; open(); } else this.#go('menu'); } }, index < LESSONS.length - 1 ? 'Continue' : 'Finish'));
        return;
      }
      boardWrap.hidden = false;
      const start = Game.fromPosition(l.position);
      if (!start.ok) { feedback.textContent = 'Lesson position failed validation.'; return; }
      let game = start.value;
      let sel: Selection = NO_SELECTION;
      let solved = false;
      let hint: number[] = [];
      const canvas = h('canvas', { class: 'board', tabindex: 0, 'aria-label': 'Lesson board' });
      boardWrap.append(canvas);
      const s = this.#save.settings;
      const focus = (l.focus ?? []).map((n) => parseSquare(n)!).filter((x) => x !== null);
      view = new BoardView(canvas, { board: game.position().board, flipped: false, selected: null, moves: [], captures: [], concord: [], lastMove: [], danger: [], hint: [], focus, cursor: null, showCursor: false, showCoordinates: s.showCoordinates, letters: s.letterOverlay, animations: s.animations });
      view.resize(Math.min(boardWrap.clientWidth || 400, 520));
      const paint = () => {
        const hl = solved ? { moves: [], captures: [], concord: [] } : highlights(game, sel);
        view!.setState({ board: game.position().board, selected: sel.selected, moves: hl.moves, captures: hl.captures, concord: hl.concord, hint, danger: threatenedRoyals(game, 1), focus: solved ? [] : focus });
        castBtn.disabled = solved || (!highlights(game, sel).canCast && !sel.castMode);
        castBtn.classList.toggle('active', sel.castMode);
      };
      const attempt = (a: Action) => {
        const before = game;
        const r = game.play(a);
        if (!r.ok) return;
        view!.animate(a, before.position().board);
        game = r.value;
        hint = [];
        if (l.goal!(before, a, game)) {
          solved = true;
          feedback.textContent = game.outcome ? `Well done! ${outcomeText(game)}` : 'Well done!';
          complete(l);
          clear(actions);
          actions.append(nextButton(), retry);
        } else {
          feedback.textContent = 'Not quite. Watch the result, then try again.';
          window.setTimeout(() => { if (!solved) { game = start.value; sel = NO_SELECTION; paint(); } }, 1100);
        }
        paint();
      };
      view.onSquare = (sq) => {
        if (solved || game !== start.value) return;
        const r = click(game, sel, sq);
        sel = r.selection;
        if (r.message) feedback.textContent = r.message;
        if (r.action) attempt(r.action);
        paint();
      };
      const castBtn = h('button', { class: 'btn', id: 'lesson-concord', type: 'button', onclick: () => { const r = toggleCast(game, sel); sel = r.selection; feedback.textContent = r.message ?? (sel.castMode ? 'Choose a glowing partner.' : ''); paint(); } }, 'Concord');
      const hintBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
        const a = parseAction(l.solution!)!;
        hint = a.kind === 'move' ? [a.from, a.to] : [a.lo, a.hi];
        feedback.textContent = `Hint: ${l.solution}`;
        paint();
      } }, 'Show hint');
      const retry = h('button', { class: 'btn', type: 'button', onclick: () => open() }, 'Replay lesson');
      body.append(h('p', { class: 'task' }, h('strong', {}, 'Task: '), l.task ?? ''));
      actions.append(castBtn, hintBtn);
      paint();
      canvas.addEventListener('keydown', (e) => { if (e.key === 'c' || e.key === 'C') castBtn.click(); });
    };
    open();
  }

  // ------------------------------------------------------------------ rules
  #showRules(): void {
    const piece = (t: PieceType, move: string, notes: string) => h('div', { class: 'rule-piece' },
      h('img', { src: spriteDataUrl(t, 4), alt: '', width: 64, height: 64 }), h('img', { src: spriteDataUrl(-t, 4), alt: '', width: 64, height: 64 }),
      h('div', {}, h('h3', {}, PIECE_NAMES[t]), h('p', {}, move), h('p', { class: 'small' }, notes)));
    this.#frame('Rules reference', h('article', { class: 'rules card' },
      h('h1', {}, 'Rules of Ember Six (v0.1)'),
      h('p', { class: 'small muted' }, 'Provisional research ruleset. These rules are frozen for testing and are not claimed to be balanced.'),
      h('h2', {}, 'Setup'),
      h('p', {}, 'A 6×6 board with files a–f and ranks 1–6. Ember (first player) starts on ranks 1–2: Warden, Hexweaver, Archwizard, Spellblade, Hexweaver, Warden on rank 1 and six Familiars on rank 2. Umbral mirrors this by a half-turn on ranks 5–6. Each side has two seals.'),
      h('h2', {}, 'Pieces'),
      piece(1, 'Steps one square in any of the eight directions.', 'Capturing it wins the game. There is no check: it may move into danger.'),
      piece(2, 'Slides one or two squares orthogonally.', 'A two-square slide needs an empty square in between.'),
      piece(3, 'Slides one or two squares diagonally.', 'Same blocking rule; stays on one square colour.'),
      piece(4, 'Leaps two squares one way and one square sideways (an L).', 'Jumps over pieces; cannot be blocked.'),
      piece(5, 'Steps one square orthogonally, forward, backward or sideways.', 'Never promotes.'),
      h('p', {}, 'All pieces capture by moving onto an enemy piece. You may not move onto your own piece. No promotion, no drops, no passing.'),
      h('h2', {}, 'Concord (spell)'),
      h('p', {}, 'Instead of moving, swap two of your own pieces that touch, orthogonally or diagonally. It costs one seal and ends your turn. Concord never captures. Any piece may take part, including the Archwizard. Seals never return.'),
      h('h2', {}, 'How the game ends (checked in this order after every action)'),
      h('ol', {},
        h('li', {}, 'An Archwizard has been captured: its owner loses.'),
        h('li', {}, 'The same position (pieces, player to move, seals) occurs for the third time: draw.'),
        h('li', {}, '60 consecutive actions without a capture: draw. Concord does not reset the count.'),
        h('li', {}, '180 total actions: draw.'),
        h('li', {}, 'The player to move has no legal action: that player loses. (Unreachable with these armies, but part of the rules.)')),
      h('p', {}, 'There are no draw offers. In M1, all matches are untimed and unrated.'),
      h('h2', {}, 'Notation'),
      h('p', {}, 'Moves are written d1-c3 (or d1xc3 for a capture). Concord is written a1~b1. Positions use rows from rank 6 down to rank 1, uppercase for Ember, lowercase for Umbral, then the side to move, seals, quiet count and action count.'),
      h('h2', {}, 'Controls'),
      h('ul', {},
        h('li', {}, 'Click or tap a piece, then a glowing square. Red brackets mark captures.'),
        h('li', {}, 'Concord: select a piece, press Concord (or C), then choose a partner marked with a rune ring.'),
        h('li', {}, 'Keyboard: arrow keys move the cursor, Enter selects, C Concord, U undo, H hint, F rotate, Esc cancel, Space pause (exhibitions).')),
      h('p', {}, h('a', { class: 'btn primary', href: '#/tutorial' }, 'Open the tutorial'))));
  }

  // ------------------------------------------------------------------ archive
  #showArchive(): void {
    const recs = [...this.#save.archive].reverse();
    const viewer = h('section', { class: 'card replay', hidden: true });
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'visually-hidden' });
    const msg = h('p', { class: 'status', role: 'status' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const { records, problems } = importArchive(await f.text());
      for (const r of records) this.#save = archiveRecord(this.#save, r);
      this.#persist();
      this.#notices.push(`Imported ${records.length} match record(s).${problems.length ? ` Rejected ${problems.length}: ${problems.slice(0, 3).join('; ')}` : ''}`);
      this.#route();
    });
    let view: BoardView | null = null;
    this.#screen = { destroy: () => view?.destroy() };
    const openReplay = (rec: MatchRecord) => {
      const v = validateMatchRecord(rec);
      if (!v.ok) { msg.textContent = `Record failed validation: ${v.error.message}`; return; }
      const games: Game[] = [];
      for (let g: Game | null = v.value.game; g; g = g.undo()) games.unshift(g);
      let i = games.length - 1;
      clear(viewer); viewer.hidden = false;
      const wrap = h('div', { class: 'board-wrap lesson-board' });
      const canvas = h('canvas', { class: 'board' });
      wrap.append(canvas);
      const info = h('p', { class: 'status' });
      view?.destroy();
      const s = this.#save.settings;
      view = new BoardView(canvas, { board: games[i]!.position().board, flipped: false, selected: null, moves: [], captures: [], concord: [], lastMove: [], danger: [], hint: [], focus: [], cursor: null, showCursor: false, showCoordinates: s.showCoordinates, letters: s.letterOverlay, animations: s.animations });
      const show = (animate: boolean) => {
        const g = games[i]!;
        const last = g.actions().at(-1);
        if (animate && last && i > 0) view!.animate(last, games[i - 1]!.position().board);
        view!.setState({ board: g.position().board, lastMove: last ? (last.kind === 'move' ? [last.from, last.to] : [last.lo, last.hi]) : [] });
        info.textContent = `Action ${i} of ${games.length - 1}${g.outcome ? ` · ${outcomeText(g)}` : ''}`;
      };
      viewer.append(h('h2', {}, `Replay: ${rec.players.first.name} vs ${rec.players.second.name}`), wrap, info,
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => { i = 0; show(false); } }, '⏮ Start'),
          h('button', { class: 'btn', type: 'button', onclick: () => { if (i > 0) { i--; show(false); } } }, '◀ Back'),
          h('button', { class: 'btn', type: 'button', onclick: () => { if (i < games.length - 1) { i++; show(true); } } }, 'Forward ▶'),
          h('button', { class: 'btn', type: 'button', onclick: () => { i = games.length - 1; show(false); } }, 'End ⏭')));
      requestAnimationFrame(() => { view!.resize(Math.min(wrap.clientWidth || 360, 480)); show(false); });
      viewer.scrollIntoView({ behavior: 'smooth' });
    };
    this.#frame('Match archive',
      h('section', { class: 'card' },
        h('h1', {}, 'Match archive'),
        h('p', { class: 'small' }, 'Every finished or abandoned match is kept as a versioned, replay-verified record (wg.match/1). Browser storage can be cleared by the browser or by you, so export a backup now and then.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', id: 'export', disabled: recs.length === 0, onclick: () => {
            const blob = new Blob([exportArchive(this.#save, new Date().toISOString())], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `wizards-gambit-archive-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a); a.click(); a.remove();
          } }, 'Export archive (JSON)'),
          h('label', { class: 'btn', for: 'import-file' }, 'Import archive'), fileInput),
        msg,
        recs.length === 0 ? h('p', {}, 'No matches yet.') : h('table', { class: 'archive-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Ember'), h('th', {}, 'Umbral'), h('th', {}, 'Result'), h('th', {}, 'Ending'), h('th', {}, 'Actions'), h('th', {}, ''))),
          h('tbody', {}, ...recs.map((r) => h('tr', {},
            h('td', {}, (r.endedAt ?? r.createdAt).slice(0, 16).replace('T', ' ')),
            h('td', {}, r.players.first.name), h('td', {}, r.players.second.name),
            h('td', {}, r.status === 'abandoned' ? 'abandoned' : r.result + (r.practice ? ' (practice)' : '')),
            h('td', {}, r.outcome?.reason ?? '-'), h('td', {}, String(r.plies)),
            h('td', {}, h('button', { class: 'btn small', type: 'button', onclick: () => openReplay(r) }, 'Replay'))))))),
      viewer);
  }

  // ------------------------------------------------------------------ settings
  #showSettings(): void {
    const opts: [keyof Settings, string, string][] = [
      ['showCoordinates', 'Show coordinates', 'Files a–f and ranks 1–6 around the board.'],
      ['letterOverlay', 'Piece letters', 'Overlay A/W/H/S/F on each piece for extra legibility.'],
      ['hints', 'Practice hints', 'Allow the Hint button in duels against the AI.'],
      ['animations', 'Animations', 'Move, capture and Concord effects. Turn off for reduced motion.'],
    ];
    this.#frame('Settings', h('section', { class: 'card' }, h('h1', {}, 'Settings'),
      ...opts.map(([k, label, help]) => {
        const box = h('input', { type: 'checkbox', checked: this.#save.settings[k] });
        box.addEventListener('change', () => { this.#save = { ...this.#save, settings: { ...this.#save.settings, [k]: box.checked } }; this.#persist(); });
        return h('label', { class: 'check setting' }, box, h('span', {}, h('strong', {}, label), h('br'), h('span', { class: 'small' }, help)));
      }),
      h('button', { class: 'btn', type: 'button', onclick: () => { this.#save = { ...this.#save, settings: DEFAULT_SETTINGS }; this.#persist(); this.#route(); } }, 'Restore defaults'),
      h('h2', {}, 'Saved data'),
      h('p', { class: 'small' }, `Profile ${this.#save.profileId}. ${this.#save.archive.length} archived match(es). Data is stored in this browser for this address only.`),
      h('button', { class: 'btn danger', type: 'button', onclick: () => {
        if (!confirm('Delete the current match, archive, tutorial progress and settings from this browser?')) return;
        this.#store.removeItem('wizards-gambit.save');
        location.hash = '#/menu';
        location.reload();
      } }, 'Erase all local data')));
  }
}
