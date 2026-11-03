/** Canvas rendering of the pixel-art sprites defined in src/play/sprite-data.ts. */
import type { PieceType } from '../rules/constants.ts';
import { PALETTES, spriteGrid, type Palette } from '../play/sprite-data.ts';
export { PALETTES, spriteGrid, PIECE_NAMES, ARMY_NAMES, type Palette } from '../play/sprite-data.ts';

const cache = new Map<string, HTMLCanvasElement>();
/** 16×16 canvas for a piece (cached). */
export function spriteCanvas(piece: number): HTMLCanvasElement {
  const key = String(piece);
  const hit = cache.get(key);
  if (hit) return hit;
  const type = Math.abs(piece) as PieceType;
  const pal = PALETTES[piece > 0 ? 1 : -1];
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  const grid = spriteGrid(type);
  grid.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const k = row[x] as keyof Palette | '.';
      if (k === '.' || !(k in pal)) continue;
      ctx.fillStyle = pal[k];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}

/** Data URL of a sprite scaled by an integer factor (for HTML panels). */
export function spriteDataUrl(piece: number, scale = 3): string {
  const src = spriteCanvas(piece);
  const c = document.createElement('canvas');
  c.width = 16 * scale;
  c.height = 16 * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

