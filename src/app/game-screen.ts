/** The match screen: board, side panel, controls, result dialog. */
import { BoardView } from './board-view.ts';
import { h, clear } from './dom.ts';
import { spriteDataUrl, ARMY_NAMES, PIECE_NAMES } from './sprites.ts';
import { WorkerAi } from './ai-client.ts';
import { MatchController, moveList, SPEEDS, type MatchEvent, type MatchSetup, type Speed } from '../match/controller.ts';
import { NO_SELECTION, capturedPieces, click, highlights, outcomeText, threatenedRoyals, toggleCast, type Selection } from '../play/interaction.ts';
import { formatAction, encodeAction, type Action } from '../rules/actions.ts';
import { squareName } from '../rules/geometry.ts';
import type { Game } from '../rules/game.ts';
import type { MatchRecord } from '../match/record.ts';
import type { Settings } from '../persistence/save.ts';
import type { PieceType } from '../rules/constants.ts';

export interface GameScreenHost {
  settings(): Settings;
  onRecord(rec: MatchRecord, setup: MatchSetup): void;
  onFinished(rec: MatchRecord): void;
  toMenu(): void;
  newMatch(setup: MatchSetup): void;
  humanId: string;
}

export class GameScreen {
  readonly root: HTMLElement;
  readonly controller: MatchController;
  readonly view: BoardView;
  #ai = new WorkerAi();
  #hintAi = new WorkerAi();
  #host: GameScreenHost;
  #sel: Selection = NO_SELECTION;
  #flipped = false;
  #cursor = 14;
  #showCursor = false;
  #hint: number[] = [];
  #hintToken = 0;
  #message = '';
  #els: Record<string, HTMLElement> = {};
  #dialog: HTMLDialogElement;
  #resizeObs: ResizeObserver;

  constructor(host: GameScreenHost) {
    this.#host = host;
    this.controller = new MatchController({
      ai: this.#ai,
      newId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
      humanId: host.humanId,
      schedule: (fn, ms) => { const t = window.setTimeout(fn, ms); return () => window.clearTimeout(t); },
    });
    const canvas = h('canvas', { class: 'board', tabindex: 0, role: 'application', 'aria-label': 'Game board. Use arrow keys to move the cursor and Enter to select.' });
    this.root = h('div', { class: 'game-screen' });
    const s = host.settings();
    this.view = new BoardView(canvas, {
      board: new Array(36).fill(0), flipped: false, selected: null, moves: [], captures: [], concord: [], lastMove: [], danger: [],
      hint: [], focus: [], cursor: null, showCursor: false, showCoordinates: s.showCoordinates, letters: s.letterOverlay, animations: s.animations,
    });
    this.view.onSquare = (sq) => { this.#showCursor = false; this.#cursor = sq; this.#onSquare(sq); };
    canvas.addEventListener('keydown', (e) => this.#onKey(e));
    this.#dialog = h('dialog', { class: 'result-dialog' });
    this.#build(canvas);
    this.#resizeObs = new ResizeObserver(() => this.#fit());
    this.#resizeObs.observe(this.#els.boardWrap!);
    this.controller.on((e) => this.#onEvent(e));
  }

  destroy(): void {
    this.controller.dispose();
    this.#ai.dispose();
    this.#hintAi.dispose();
    this.view.destroy();
    this.#resizeObs.disconnect();
  }

  start(setup: MatchSetup, seed: number): void {
    this.#flipped = setup.mode === 'human-vs-ai' && setup.first.kind === 'ai';
    this.controller.start(setup, seed);
    this.#syncSpeedControls();
  }
  resume(setup: MatchSetup, record: MatchRecord, game: Game): void {
    this.#flipped = setup.mode === 'human-vs-ai' && setup.first.kind === 'ai';
    this.controller.resume(setup, record, game);
    this.#syncSpeedControls();
  }

  // ------------------------------------------------------------------ layout
  #build(canvas: HTMLCanvasElement): void {
    const e = this.#els;
    e.boardWrap = h('div', { class: 'board-wrap' }, canvas);
    e.status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    e.danger = h('p', { class: 'danger-banner', role: 'alert', hidden: true }, 'Your Archwizard can be captured next turn!');
    e.topCard = h('div', { class: 'player-card' });
    e.bottomCard = h('div', { class: 'player-card' });
    e.history = h('ol', { class: 'history-list' });
    e.aiStats = h('p', { class: 'ai-stats' });
    const btn = (id: string, label: string, title: string, fn: () => void) => {
      const b = h('button', { type: 'button', class: 'btn', id: `btn-${id}`, title, onclick: () => { fn(); canvas.focus({ preventScroll: true }); } }, label);
      e[id] = b;
      return b;
    };
    const controls = h('div', { class: 'controls' },
      btn('concord', 'Concord', 'Cast Concord with the selected piece (C)', () => this.#castToggle()),
      btn('undo', 'Undo', 'Take back your last move (U), practice only', () => { if (this.controller.undo()) this.#clearSel(); }),
      btn('hint', 'Hint', 'Ask the Adept for a suggestion (H)', () => this.#requestHint()),
      btn('flip', 'Rotate board', 'Rotate the board 180 degrees (F)', () => { this.#flipped = !this.#flipped; this.#render(); }),
      btn('restart', 'Restart', 'Start this match again', () => this.#restart()),
      btn('menu', 'Menu', 'Return to the main menu (your match is saved)', () => this.#host.toMenu()),
    );
    const speed = h('select', { id: 'speed', 'aria-label': 'Exhibition speed', onchange: (ev: Event) => this.controller.setSpeed((ev.target as HTMLSelectElement).value as Speed) },
      ...Object.keys(SPEEDS).map((k) => h('option', { value: k }, k[0]!.toUpperCase() + k.slice(1))));
    e.speed = speed;
    e.exhibition = h('div', { class: 'exhibition', hidden: true },
      btn('pause', 'Pause', 'Pause or resume the exhibition (Space)', () => (this.controller.paused ? this.controller.resumePlay() : this.controller.pause())),
      h('label', { class: 'speed-label' }, 'Speed ', speed));
    const side = h('aside', { class: 'side-panel' },
      e.topCard, h('div', { class: 'turn-box' }, e.status, e.danger), controls, e.exhibition, e.aiStats, e.bottomCard,
      h('details', { class: 'history', open: true }, h('summary', {}, 'Move history'), e.history));
    this.root.append(h('section', { class: 'board-area' }, e.boardWrap), side, this.#dialog);
  }

  #fit(): void {
    const wrap = this.#els.boardWrap!;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth, 760);
    if (size > 0) this.view.resize(size);
  }

  #syncSpeedControls(): void {
    const isAva = this.controller.setup.mode === 'ai-vs-ai';
    this.#els.exhibition!.hidden = !isAva;
    (this.#els.speed as HTMLSelectElement).value = this.controller.speed;
    this.#render();
  }

  // ------------------------------------------------------------------ events
  #onEvent(e: MatchEvent): void {
    if (e.type === 'move') {
      this.view.animate(e.action, e.before.position().board);
      this.#hint = [];
      this.#hintToken++;
      this.#message = '';
    }
    if (e.type === 'reset' || e.type === 'undo') { this.#clearSel(); this.#hint = []; this.#message = ''; }
    if (e.type === 'error') this.#message = e.message;
    if (e.type === 'move' || e.type === 'undo' || e.type === 'reset') {
      this.#host.onRecord(this.controller.record(), this.controller.setup);
    }
    if (e.type === 'over') {
      const rec = this.controller.record();
      this.#host.onFinished(rec);
      window.setTimeout(() => this.#showResult(), this.#host.settings().animations ? 650 : 0);
    }
    this.#render();
  }

  #onSquare(sq: number): void {
    const g = this.controller.game;
    if (g.isOver) return;
    if (!this.controller.isHumanTurn()) {
      this.#message = this.controller.setup.mode === 'ai-vs-ai' ? 'This is an exhibition between two AIs.' : 'Please wait for your opponent.';
      this.#render();
      return;
    }
    const r = click(g, this.#sel, sq);
    this.#sel = r.selection;
    this.#message = r.message ?? '';
    if (r.action) this.#play(r.action);
    this.#render();
  }

  #play(a: Action): void {
    const err = this.controller.play(a);
    if (err) this.#message = err;
  }

  #castToggle(): void {
    if (!this.controller.isHumanTurn()) return;
    const r = toggleCast(this.controller.game, this.#sel);
    this.#sel = r.selection;
    this.#message = r.message ?? (r.selection.castMode ? 'Concord: choose a glowing partner to swap with.' : '');
    this.#render();
  }

  #clearSel(): void { this.#sel = NO_SELECTION; }

  #restart(): void {
    this.#dialog.close();
    this.controller.restart((Math.random() * 2 ** 32) >>> 0);
  }

  #requestHint(): void {
    if (!this.controller.isHumanTurn() || !this.#host.settings().hints) return;
    const g = this.controller.game;
    const token = ++this.#hintToken;
    this.#message = 'The Adept is considering…';
    this.#render();
    this.#hintAi.think(g.toRecord(), 'adept', 1).then((r) => {
      if (token !== this.#hintToken || this.controller.game !== g) return;
      const a = r.action;
      this.#hint = a.kind === 'move' ? [a.from, a.to] : [a.lo, a.hi];
      this.#message = `Hint: ${formatAction(a, g.position().board)}${a.kind === 'concord' ? ' (Concord)' : ''}`;
      this.#render();
    }, () => { /* cancelled */ });
  }

  #onKey(e: KeyboardEvent): void {
    const k = e.key;
    const dir: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (dir[k]) {
      e.preventDefault();
      let [dx, dy] = dir[k]!;
      if (this.#flipped) { dx = -dx; dy = -dy; }
      const f = Math.min(5, Math.max(0, (this.#cursor % 6) + dx));
      const r = Math.min(5, Math.max(0, Math.floor(this.#cursor / 6) + dy));
      this.#cursor = r * 6 + f;
      this.#showCursor = true;
      this.#message = `Cursor on ${squareName(this.#cursor)}${this.#describe(this.#cursor)}`;
      this.#render();
      return;
    }
    if (k === 'Enter' || (k === ' ' && this.controller.setup.mode !== 'ai-vs-ai')) { e.preventDefault(); this.#showCursor = true; this.#onSquare(this.#cursor); return; }
    if (k === ' ') { e.preventDefault(); this.controller.paused ? this.controller.resumePlay() : this.controller.pause(); return; }
    if (k === 'c' || k === 'C') return this.#castToggle();
    if (k === 'u' || k === 'U') { if (this.controller.undo()) this.#clearSel(); return; }
    if (k === 'h' || k === 'H') return this.#requestHint();
    if (k === 'f' || k === 'F') { this.#flipped = !this.#flipped; this.#render(); return; }
    if (k === 'Escape') { this.#clearSel(); this.#message = ''; this.#render(); }
  }

  #describe(sq: number): string {
    const v = this.controller.game.position().board[sq]!;
    if (!v) return ', empty';
    return `: ${ARMY_NAMES[v > 0 ? 1 : -1]} ${PIECE_NAMES[Math.abs(v) as PieceType]}`;
  }

  // ------------------------------------------------------------------ render
  #render(): void {
    const c = this.controller;
    const g = c.game;
    const pos = g.position();
    const settings = this.#host.settings();
    const hl = c.isHumanTurn() ? highlights(g, this.#sel) : { moves: [], captures: [], concord: [], canCast: false };
    const last = g.actions().at(-1);
    const lastSquares = last ? (last.kind === 'move' ? [last.from, last.to] : [last.lo, last.hi]) : [];
    const mover = g.side;
    const threatened = threatenedRoyals(g, mover);
    const humanThreat = c.isHumanTurn() && threatened.length > 0;
    this.view.setState({
      board: pos.board, flipped: this.#flipped, selected: this.#sel.selected, moves: hl.moves, captures: hl.captures,
      concord: hl.concord, lastMove: lastSquares, danger: threatened, hint: this.#hint, focus: [],
      cursor: this.#cursor, showCursor: this.#showCursor, showCoordinates: settings.showCoordinates,
      letters: settings.letterOverlay, animations: settings.animations,
    });
    const e = this.#els;
    e.danger!.hidden = !humanThreat;
    const seat = c.seatFor(mover);
    let status: string;
    if (g.isOver) status = outcomeText(g);
    else if (c.paused) status = 'Exhibition paused.';
    else if (seat.kind === 'ai') status = `${seat.name} (${ARMY_NAMES[mover]}) is thinking…`;
    else status = c.setup.mode === 'human-vs-human' ? `${seat.name} to move (${ARMY_NAMES[mover]}).` : `Your move (${ARMY_NAMES[mover]}).`;
    e.status!.textContent = this.#message ? `${status} ${this.#message}` : status;
    // Buttons
    (e.concord as HTMLButtonElement).disabled = !c.isHumanTurn() || !hl.canCast && !this.#sel.castMode;
    e.concord!.classList.toggle('active', this.#sel.castMode);
    (e.undo as HTMLButtonElement).disabled = !c.canUndo();
    e.undo!.hidden = c.setup.mode === 'ai-vs-ai' || !c.setup.allowUndo;
    (e.hint as HTMLButtonElement).disabled = !c.isHumanTurn() || !settings.hints;
    e.hint!.hidden = c.setup.mode === 'human-vs-human' || c.setup.mode === 'ai-vs-ai' || !settings.hints;
    e.pause!.textContent = c.paused ? 'Resume' : 'Pause';
    (e.pause as HTMLButtonElement).disabled = g.isOver;
    const st = c.lastAiStats;
    e.aiStats!.textContent = st && c.setup.mode !== 'human-vs-human' ? `Last AI search: depth ${st.depth}, ${st.nodes.toLocaleString()} positions, ${st.ms} ms.` : '';
    // Player cards (top = the side shown at the top of the board)
    const topSide: 1 | -1 = this.#flipped ? 1 : -1;
    this.#card(e.topCard!, topSide, pos.seals, pos.board, mover);
    this.#card(e.bottomCard!, -topSide as 1 | -1, pos.seals, pos.board, mover);
    // History
    const list = moveList(g);
    clear(e.history!);
    for (let i = 0; i < list.length; i += 2) {
      e.history!.append(h('li', {}, h('span', { class: 'mv ember' }, list[i]!), list[i + 1] ? h('span', { class: 'mv umbral' }, list[i + 1]!) : ''));
    }
    e.history!.scrollTop = e.history!.scrollHeight;
    if (this.#isE2E()) this.#exposeDebug();
  }

  #card(el: HTMLElement, side: 1 | -1, seals: readonly number[], board: readonly number[], mover: number): void {
    const seat = this.controller.seatFor(side);
    const cap = capturedPieces(board);
    const taken = side === 1 ? cap.byFirst : cap.bySecond;
    const sealCount = seals[side === 1 ? 0 : 1]!;
    clear(el);
    el.className = `player-card ${side === 1 ? 'ember' : 'umbral'}${mover === side && !this.controller.game.isOver ? ' to-move' : ''}`;
    el.append(
      h('img', { class: 'card-sprite', src: spriteDataUrl(side, 3), alt: '', width: 48, height: 48 }),
      h('div', { class: 'card-body' },
        h('div', { class: 'card-name' }, seat.name, h('span', { class: 'army' }, ` · ${ARMY_NAMES[side]}`)),
        h('div', { class: 'seals', 'aria-label': `${sealCount} of 2 seals remaining` }, 'Seals ',
          ...[0, 1].map((i) => h('span', { class: `seal${i < sealCount ? ' lit' : ''}`, 'aria-hidden': 'true' }, '◆'))),
        h('div', { class: 'captured', 'aria-label': `Captured: ${taken.map((p) => PIECE_NAMES[Math.abs(p) as PieceType]).join(', ') || 'none'}` },
          ...taken.map((p) => h('img', { src: spriteDataUrl(p, 2), alt: '', width: 20, height: 20 }))),
      ),
    );
  }

  #showResult(): void {
    const g = this.controller.game;
    const o = g.outcome;
    if (!o) return;
    const setup = this.controller.setup;
    let title = 'Draw';
    if (o.winner !== 0) {
      const winner = this.controller.seatFor(o.winner);
      if (setup.mode === 'human-vs-ai') title = winner.kind === 'human' ? 'Victory!' : 'Defeat';
      else title = `${winner.name} wins`;
    }
    clear(this.#dialog);
    const rec = this.controller.record();
    this.#dialog.append(
      h('h2', {}, title),
      h('p', {}, outcomeText(g)),
      h('p', { class: 'small' }, `${rec.plies} actions · ${rec.result}${rec.practice ? ' · practice (undo used)' : ''} · unrated`),
      h('div', { class: 'dialog-buttons' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => this.#restart() }, 'Play again'),
        h('button', { class: 'btn', type: 'button', onclick: () => this.#dialog.close() }, 'Review board'),
        h('button', { class: 'btn', type: 'button', onclick: () => { this.#dialog.close(); this.#host.toMenu(); } }, 'Main menu')),
    );
    if (!this.#dialog.open) this.#dialog.showModal();
  }

  #isE2E(): boolean { return location.search.includes('e2e'); }
  #exposeDebug(): void {
    const c = this.controller;
    (window as unknown as { __wg: unknown }).__wg = {
      notation: () => c.game.notation(),
      legal: () => c.game.legalActions().map(encodeAction),
      outcome: () => c.game.outcome,
      humanTurn: () => c.isHumanTurn(),
      ply: () => c.game.ply,
      record: () => c.record(),
      center: (sq: number) => this.view.squareCenterClient(sq),
      thinking: () => c.thinking,
    };
  }
}
