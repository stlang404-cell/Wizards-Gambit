/**
 * Canvas2D board renderer. Draws in "art pixels" (140×140: 6 tiles of 20 plus
 * a 10-pixel frame) scaled by an integer factor, so pixel art stays crisp.
 * Purely presentational: it never decides legality; the game screen passes
 * engine-derived highlights in. Animations only interpolate what is drawn.
 */
import { spriteCanvas, PALETTES } from './sprites.ts';
import type { Action } from '../rules/actions.ts';

const TILE = 20;
const FRAME = 10;
const ART = TILE * 6 + FRAME * 2; // 140

export interface BoardState {
  board: readonly number[];
  flipped: boolean;
  selected: number | null;
  moves: readonly number[];
  captures: readonly number[];
  concord: readonly number[];
  lastMove: readonly number[];
  danger: readonly number[];
  hint: readonly number[];
  focus: readonly number[];
  cursor: number | null;
  showCursor: boolean;
  showCoordinates: boolean;
  letters: boolean;
  animations: boolean;
}

interface Anim {
  kind: 'move' | 'concord' | 'capture';
  start: number;
  duration: number;
  from: number;
  to: number;
  piece: number;
  piece2?: number;
}

// Deterministic hash noise for textures.
function noise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const LETTERS = ['', 'A', 'W', 'H', 'S', 'F'];

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  #scale = 4;
  #staticArt: HTMLCanvasElement;
  #state: BoardState;
  #anims: Anim[] = [];
  #raf = 0;
  #lastDraw = 0;
  onSquare: (sq: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement, initial: BoardState) {
    this.canvas = canvas;
    this.#ctx = canvas.getContext('2d')!;
    this.#state = initial;
    this.#staticArt = BoardView.#paintStatic();
    canvas.addEventListener('pointerdown', (e) => {
      const sq = this.squareAtClient(e.clientX, e.clientY);
      if (sq !== null) { e.preventDefault(); this.onSquare(sq); }
    });
    const loop = (t: number) => {
      this.#raf = requestAnimationFrame(loop);
      if (t - this.#lastDraw < 30 && this.#anims.length === 0) return; // ~30fps idle, full rate while animating
      this.#lastDraw = t;
      this.#draw(t);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  destroy(): void { cancelAnimationFrame(this.#raf); }

  setState(s: Partial<BoardState>): void { this.#state = { ...this.#state, ...s }; }
  get state(): BoardState { return this.#state; }

  /** Fit into a CSS box of `size` px (square). */
  resize(size: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.#scale = Math.max(1, Math.floor((size * dpr) / ART));
    const px = ART * this.#scale;
    this.canvas.width = px;
    this.canvas.height = px;
    this.canvas.style.width = `${px / dpr}px`;
    this.canvas.style.height = `${px / dpr}px`;
  }

  /** Visual position (file, rank from top-left in view) of a square. */
  #view(sq: number): { vx: number; vy: number } {
    const f = sq % 6;
    const r = Math.floor(sq / 6);
    return this.#state.flipped ? { vx: 5 - f, vy: r } : { vx: f, vy: 5 - r };
  }
  #origin(sq: number): { x: number; y: number } {
    const { vx, vy } = this.#view(sq);
    return { x: FRAME + vx * TILE, y: FRAME + vy * TILE };
  }

  squareAtClient(cx: number, cy: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const ax = ((cx - rect.left) / rect.width) * ART;
    const ay = ((cy - rect.top) / rect.height) * ART;
    const vx = Math.floor((ax - FRAME) / TILE);
    const vy = Math.floor((ay - FRAME) / TILE);
    if (vx < 0 || vx > 5 || vy < 0 || vy > 5) return null;
    const f = this.#state.flipped ? 5 - vx : vx;
    const r = this.#state.flipped ? vy : 5 - vy;
    return r * 6 + f;
  }

  /** Client coordinates of a square's centre (used by browser tests). */
  squareCenterClient(sq: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const o = this.#origin(sq);
    return { x: rect.left + ((o.x + TILE / 2) / ART) * rect.width, y: rect.top + ((o.y + TILE / 2) / ART) * rect.height };
  }

  /** Queue a purely visual animation for an action already applied by the engine. */
  animate(action: Action, before: readonly number[]): void {
    if (!this.#state.animations) return;
    const now = performance.now();
    if (action.kind === 'concord') {
      this.#anims.push({ kind: 'concord', start: now, duration: 520, from: action.lo, to: action.hi, piece: before[action.lo]!, piece2: before[action.hi]! });
    } else {
      this.#anims.push({ kind: 'move', start: now, duration: 200, from: action.from, to: action.to, piece: before[action.from]! });
      if (before[action.to]) this.#anims.push({ kind: 'capture', start: now + 120, duration: 520, from: action.to, to: action.to, piece: before[action.to]! });
    }
  }

  // ---------------------------------------------------------------- static art
  static #paintStatic(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = ART;
    c.height = ART;
    const g = c.getContext('2d')!;
    // Wooden frame with grain
    for (let y = 0; y < ART; y++) {
      for (let x = 0; x < ART; x++) {
        const grain = noise(x >> 2, y, 3) * 0.5 + noise(x, y, 4) * 0.5;
        const base = Math.sin((y + noise(x >> 3, 0, 9) * 6) * 0.9) > 0.6 ? 0 : 1;
        g.fillStyle = base ? (grain > 0.7 ? '#4b2b17' : '#3c2213') : '#2e190d';
        g.fillRect(x, y, 1, 1);
      }
    }
    // Gold trim: outer line and inner line
    g.fillStyle = '#d6a945';
    g.fillRect(2, 2, ART - 4, 1); g.fillRect(2, ART - 3, ART - 4, 1);
    g.fillRect(2, 2, 1, ART - 4); g.fillRect(ART - 3, 2, 1, ART - 4);
    g.fillStyle = '#8a6420';
    g.fillRect(FRAME - 2, FRAME - 2, TILE * 6 + 4, 1); g.fillRect(FRAME - 2, FRAME + TILE * 6 + 1, TILE * 6 + 4, 1);
    g.fillRect(FRAME - 2, FRAME - 2, 1, TILE * 6 + 4); g.fillRect(FRAME + TILE * 6 + 1, FRAME - 2, 1, TILE * 6 + 4);
    g.fillStyle = '#f2cf6e';
    g.fillRect(FRAME - 1, FRAME - 1, TILE * 6 + 2, 1); g.fillRect(FRAME - 1, FRAME + TILE * 6, TILE * 6 + 2, 1);
    g.fillRect(FRAME - 1, FRAME - 1, 1, TILE * 6 + 2); g.fillRect(FRAME + TILE * 6, FRAME - 1, 1, TILE * 6 + 2);
    // Corner ornaments (small gold diamonds with a cyan gem)
    for (const [cx, cy] of [[5, 5], [ART - 6, 5], [5, ART - 6], [ART - 6, ART - 6]] as const) {
      g.fillStyle = '#f2cf6e';
      g.fillRect(cx - 1, cy - 3, 3, 7); g.fillRect(cx - 3, cy - 1, 7, 3);
      g.fillStyle = '#8a6420';
      g.fillRect(cx - 2, cy - 2, 1, 1); g.fillRect(cx + 2, cy - 2, 1, 1); g.fillRect(cx - 2, cy + 2, 1, 1); g.fillRect(cx + 2, cy + 2, 1, 1);
      g.fillStyle = '#5ff2e2';
      g.fillRect(cx, cy, 1, 1);
    }
    // Rivets along the frame
    g.fillStyle = '#c99a3a';
    for (let i = 0; i < 6; i++) {
      const p = FRAME + i * TILE + TILE / 2;
      g.fillRect(p, 5, 1, 1); g.fillRect(p, ART - 6, 1, 1); g.fillRect(5, p, 1, 1); g.fillRect(ART - 6, p, 1, 1);
    }
    // Stone tiles: moonstone (light) and midnight (dark), speckled; faint engraved runes
    for (let r = 0; r < 6; r++) {
      for (let f = 0; f < 6; f++) {
        const light = (r + f) % 2 === 1;
        const ox = FRAME + f * TILE;
        const oy = FRAME + (5 - r) * TILE;
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const n = noise(ox + x, oy + y, 1);
            let col: string;
            if (light) col = n > 0.92 ? '#5a6aa3' : n > 0.55 ? '#46558d' : '#3f4d84';
            else col = n > 0.93 ? '#2c3168' : n > 0.5 ? '#1f2350' : '#1b1e47';
            // bevel: top/left lighter, bottom/right darker
            if (y === 0 || x === 0) col = light ? '#5d6db0' : '#2a2f63';
            if (y === TILE - 1 || x === TILE - 1) col = light ? '#2f3a6b' : '#13153a';
            g.fillStyle = col;
            g.fillRect(ox + x, oy + y, 1, 1);
          }
        }
        // engraved rune: tiny glyph from a hashed pattern
        if (noise(f, r, 77) > 0.55) {
          g.fillStyle = light ? 'rgba(160,190,255,0.18)' : 'rgba(120,140,255,0.16)';
          const gx = ox + 3 + Math.floor(noise(f, r, 5) * 12);
          const gy = oy + 13 + Math.floor(noise(f, r, 6) * 4);
          g.fillRect(gx, gy, 3, 1); g.fillRect(gx + 1, gy - 2, 1, 3);
        }
      }
    }
    return c;
  }

  // ---------------------------------------------------------------- frame draw
  #draw(t: number): void {
    const ctx = this.#ctx;
    const s = this.#state;
    const sc = this.#scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.drawImage(this.#staticArt, 0, 0);
    const pulse = 0.5 + 0.5 * Math.sin(t / 260);

    const tint = (sq: number, color: string) => {
      const o = this.#origin(sq);
      ctx.fillStyle = color;
      ctx.fillRect(o.x + 1, o.y + 1, TILE - 2, TILE - 2);
    };
    for (const sq of s.lastMove) tint(sq, 'rgba(255,190,90,0.16)');
    for (const sq of s.focus) tint(sq, `rgba(120,230,255,${0.08 + 0.08 * pulse})`);
    for (const sq of s.danger) tint(sq, `rgba(255,40,60,${0.25 + 0.25 * pulse})`);
    for (const sq of s.hint) {
      const o = this.#origin(sq);
      ctx.fillStyle = 'rgba(120,255,160,0.85)';
      this.#frameRect(o.x + 1, o.y + 1, TILE - 2, TILE - 2);
    }
    if (s.selected !== null) {
      const o = this.#origin(s.selected);
      ctx.fillStyle = `rgba(255,214,102,${0.75 + 0.25 * pulse})`;
      this.#frameRect(o.x, o.y, TILE, TILE);
      this.#frameRect(o.x + 1, o.y + 1, TILE - 2, TILE - 2);
    }

    // Pieces (skip those currently animated)
    const hidden = new Set<number>();
    const now = performance.now();
    this.#anims = this.#anims.filter((a) => now < a.start + a.duration);
    for (const a of this.#anims) {
      if (a.kind === 'move' && now < a.start + a.duration) hidden.add(a.to);
      if (a.kind === 'concord') { hidden.add(a.from); hidden.add(a.to); }
    }
    for (let sq = 0; sq < 36; sq++) {
      const p = s.board[sq]!;
      if (!p || hidden.has(sq)) continue;
      const o = this.#origin(sq);
      this.#drawPiece(p, o.x + 2, o.y + 2, t, sq);
      if (s.letters) this.#drawLetter(p, o.x, o.y);
    }

    // Targets
    for (const sq of s.moves) {
      const o = this.#origin(sq);
      const cx = o.x + TILE / 2 - 2;
      const cy = o.y + TILE / 2 - 2;
      ctx.fillStyle = 'rgba(10,20,40,0.55)';
      ctx.fillRect(cx - 1, cy - 1, 6, 6);
      ctx.fillStyle = `rgba(95,242,226,${0.7 + 0.3 * pulse})`;
      ctx.fillRect(cx, cy + 1, 4, 2); ctx.fillRect(cx + 1, cy, 2, 4);
    }
    for (const sq of s.captures) {
      const o = this.#origin(sq);
      ctx.fillStyle = `rgba(255,80,70,${0.75 + 0.25 * pulse})`;
      const L = 5;
      ctx.fillRect(o.x + 1, o.y + 1, L, 1); ctx.fillRect(o.x + 1, o.y + 1, 1, L);
      ctx.fillRect(o.x + TILE - 1 - L, o.y + 1, L, 1); ctx.fillRect(o.x + TILE - 2, o.y + 1, 1, L);
      ctx.fillRect(o.x + 1, o.y + TILE - 2, L, 1); ctx.fillRect(o.x + 1, o.y + TILE - 1 - L, 1, L);
      ctx.fillRect(o.x + TILE - 1 - L, o.y + TILE - 2, L, 1); ctx.fillRect(o.x + TILE - 2, o.y + TILE - 1 - L, 1, L);
    }
    for (const sq of s.concord) {
      const o = this.#origin(sq);
      // rotating rune ring of 8 dots
      for (let i = 0; i < 8; i++) {
        const ang = t / 500 + (i * Math.PI) / 4;
        const x = Math.round(o.x + TILE / 2 + Math.cos(ang) * 8 - 0.5);
        const y = Math.round(o.y + TILE / 2 + Math.sin(ang) * 8 - 0.5);
        ctx.fillStyle = i % 2 ? 'rgba(200,150,255,0.95)' : 'rgba(95,242,226,0.95)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    if (s.showCursor && s.cursor !== null) {
      const o = this.#origin(s.cursor);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < TILE; i += 4) {
        ctx.fillRect(o.x + i, o.y, 2, 1); ctx.fillRect(o.x + i, o.y + TILE - 1, 2, 1);
        ctx.fillRect(o.x, o.y + i, 1, 2); ctx.fillRect(o.x + TILE - 1, o.y + i, 1, 2);
      }
    }

    // Animations
    for (const a of this.#anims) {
      const k = Math.min(1, Math.max(0, (now - a.start) / a.duration));
      if (now < a.start) continue;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (a.kind === 'move') {
        const f = this.#origin(a.from);
        const d = this.#origin(a.to);
        const lift = Math.round(Math.sin(k * Math.PI) * 3);
        this.#drawPiece(a.piece, Math.round(f.x + (d.x - f.x) * e) + 2, Math.round(f.y + (d.y - f.y) * e) + 2 - lift, t, -1);
      } else if (a.kind === 'concord') {
        const f = this.#origin(a.from);
        const d = this.#origin(a.to);
        // portal rings at both ends
        for (const o of [f, d]) {
          const rad = 3 + Math.round(7 * Math.sin(k * Math.PI));
          for (let i = 0; i < 16; i++) {
            const ang = (i * Math.PI) / 8 + k * 6;
            ctx.fillStyle = i % 2 ? 'rgba(190,140,255,0.9)' : 'rgba(95,242,226,0.9)';
            ctx.fillRect(Math.round(o.x + TILE / 2 + Math.cos(ang) * rad), Math.round(o.y + TILE / 2 + Math.sin(ang) * rad), 1, 1);
          }
        }
        // the two pieces trade places along arcs
        const arc = Math.round(Math.sin(k * Math.PI) * 6);
        this.#drawPiece(a.piece, Math.round(f.x + (d.x - f.x) * e) + 2, Math.round(f.y + (d.y - f.y) * e) + 2 - arc, t, -1);
        this.#drawPiece(a.piece2!, Math.round(d.x + (f.x - d.x) * e) + 2, Math.round(d.y + (f.y - d.y) * e) + 2 + arc, t, -1);
      } else {
        const o = this.#origin(a.to);
        const pal = PALETTES[a.piece > 0 ? 1 : -1];
        for (let i = 0; i < 14; i++) {
          const ang = noise(i, a.to, 11) * Math.PI * 2;
          const dist = 2 + k * (6 + noise(i, a.to, 12) * 8);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = i % 3 === 0 ? pal.g : i % 3 === 1 ? pal.b : '#ffffff';
          ctx.fillRect(Math.round(o.x + TILE / 2 + Math.cos(ang) * dist), Math.round(o.y + TILE / 2 + Math.sin(ang) * dist), 1, 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Candlelight flicker vignette (device resolution)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = this.canvas.width;
    const flick = 0.04 * Math.sin(t / 170) + 0.03 * Math.sin(t / 53);
    const grad = ctx.createRadialGradient(W * 0.5, W * 0.45, W * 0.2, W * 0.5, W * 0.5, W * 0.75);
    grad.addColorStop(0, `rgba(255,190,100,${0.05 + flick})`);
    grad.addColorStop(1, 'rgba(5,4,20,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, W);

    if (s.showCoordinates) {
      ctx.fillStyle = '#f2cf6e';
      ctx.font = `${Math.max(9, Math.round(sc * 5.5))}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) {
        const file = s.flipped ? 5 - i : i;
        const rank = s.flipped ? i + 1 : 6 - i;
        ctx.fillText('abcdef'[file]!, (FRAME + i * TILE + TILE / 2) * sc, (ART - FRAME / 2) * sc);
        ctx.fillText(String(rank), (FRAME / 2) * sc, (FRAME + i * TILE + TILE / 2) * sc);
      }
    }
  }

  #frameRect(x: number, y: number, w: number, h: number): void {
    const ctx = this.#ctx;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  }

  #drawPiece(piece: number, x: number, y: number, t: number, sq: number): void {
    const ctx = this.#ctx;
    const bob = sq >= 0 && Math.abs(piece) === 5 ? Math.round(Math.sin(t / 400 + sq) * 0.6) : 0;
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 3, y + 15, 10, 1);
    ctx.fillRect(x + 4, y + 16, 8, 1);
    ctx.drawImage(spriteCanvas(piece), x, y + bob);
  }

  #drawLetter(piece: number, x: number, y: number): void {
    const ctx = this.#ctx;
    // 3×5 pixel letters for the accessible overlay
    const glyphs: Record<string, string[]> = {
      A: ['010', '101', '111', '101', '101'], W: ['101', '101', '101', '111', '101'],
      H: ['101', '101', '111', '101', '101'], S: ['011', '100', '010', '001', '110'],
      F: ['111', '100', '110', '100', '100'],
    };
    const gl = glyphs[LETTERS[Math.abs(piece)]!]!;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x + TILE - 6, y + 1, 5, 7);
    ctx.fillStyle = piece > 0 ? '#ffe9a8' : '#e2d6ff';
    gl.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '1') ctx.fillRect(x + TILE - 5 + rx, y + 2 + ry, 1, 1); }));
  }
}
