/**
 * Original pixel-art piece sprites (16×16 art pixels), authored here as
 * left halves and mirrored, then lit from the left: in the right half,
 * highlight becomes base and base becomes shade. Silhouettes follow
 * research/09: A split spire, W square gate, H tapered loom, S crossed
 * blades, F squat lantern creature.
 *
 * Keys: . transparent, o outline, b base, s shade, h highlight, g glow, e dark detail.
 */
import type { PieceType } from '../rules/constants.ts';

const HALVES: Record<PieceType, readonly string[]> = {
  1: [ // Archwizard: split spire, orb, rune band, robed base
    '........',
    '.....o..',
    '....ogo.',
    '....obo.',
    '....obbo',
    '.....obb',
    '.....ohb',
    '....obbb',
    '....oggg',
    '....ohbb',
    '...ohbbb',
    '...obbbb',
    '..oggggg',
    '.ohbbbbb',
    '.osssss',
    '..oooooo',
  ],
  2: [ // Warden: crenellated gate with glowing portcullis
    '........',
    '.ooo..oo',
    '.obo..ob',
    '.obooooh',
    '.ohbbbbb',
    '.ohbbbbb',
    '.obbbooo',
    '.obboeee',
    '.obboegg',
    '.obboege',
    '.obboegg',
    '.obboege',
    '.obboeee',
    '.ossoooo',
    'osssssss',
    'oooooooo',
  ],
  3: [ // Hexweaver: tapered loom / spindle with glowing waist
    '........',
    '..oooooo',
    '..ohbbbb',
    '..oooooo',
    '...ohbbb',
    '....ohbb',
    '.....obg',
    '......og',
    '.....obg',
    '....ohbb',
    '...ohbbb',
    '..ohbbbb',
    '..oooooo',
    '..ohbbbb',
    '.ossssss',
    '.ooooooo',
  ],
  4: [ // Spellblade: crossed blades with glowing crossing and hilts
    '........',
    'oo......',
    'oho.....',
    '.ohbo...',
    '..ohbo..',
    '...ohbo.',
    '....ohbo',
    '.....ogg',
    '.....obg',
    '....obo.',
    '..oooboo',
    '..oggo..',
    '.oeo....',
    'oeo.....',
    'oo......',
    '........',
  ],
  5: [ // Familiar: squat lantern creature
    '........',
    '......oo',
    '.....o..',
    '......oo',
    '.....ogg',
    '......og',
    '...ooooo',
    '..ohbbbb',
    '.ohbbbbb',
    '.obeebbb',
    '.obeebbb',
    '.obbbbbb',
    '.obbbbgg',
    '..obbbbb',
    '..oo.ooo',
    '........',
  ],
};

export interface Palette {
  readonly o: string; readonly b: string; readonly s: string; readonly h: string; readonly g: string; readonly e: string;
}
/** Ember (first player): gold and ivory with ember glow. Umbral (second): violet and silver with spectral cyan. */
export const PALETTES: Readonly<Record<1 | -1, Palette>> = {
  1: { o: '#2b1608', b: '#e9c56b', s: '#b0812f', h: '#fff3c4', g: '#ff8a2a', e: '#4a2a10' },
  [-1]: { o: '#0e0820', b: '#9277dd', s: '#5a3f9c', h: '#e2d6ff', g: '#5ff2e2', e: '#1c1238' },
};

/** Full 16×16 grid for a type (mirror + left lighting). */
export function spriteGrid(type: PieceType): string[] {
  return HALVES[type].map((row) => {
    const left = row.padEnd(8, '.').slice(0, 8);
    const right = [...left].reverse().map((c) => (c === 'h' ? 'b' : c === 'b' ? 's' : c)).join('');
    return left + right;
  });
}

export const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  1: 'Archwizard', 2: 'Warden', 3: 'Hexweaver', 4: 'Spellblade', 5: 'Familiar',
};
export const ARMY_NAMES: Readonly<Record<1 | -1, string>> = { 1: 'Ember', [-1]: 'Umbral' };
