/**
 * Generates public/icon-192.png and public/icon-512.png from the Archwizard
 * sprite (no image dependencies: minimal PNG encoder over node:zlib).
 *   node --experimental-strip-types tools/make-icons.ts
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PALETTES, spriteGrid } from '../src/play/sprite-data.ts';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size: number, px: (x: number, y: number) => [number, number, number, number]): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(px(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]);
}
const hex = (s: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];

const grid = spriteGrid(1);
const pal = PALETTES[1] as unknown as Record<string, string>;
for (const size of [192, 512]) {
  const scale = Math.floor((size * 0.7) / 16);
  const off = Math.floor((size - 16 * scale) / 2);
  const buf = png(size, (x, y) => {
    const gx = Math.floor((x - off) / scale);
    const gy = Math.floor((y - off) / scale);
    const k = gx >= 0 && gx < 16 && gy >= 0 && gy < 16 ? grid[gy]![gx]! : '.';
    if (k !== '.' && pal[k]) return [...hex(pal[k]), 255];
    // midnight background with a subtle radial glow and gold border
    const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
    if (x < size * 0.03 || y < size * 0.03 || x > size * 0.97 || y > size * 0.97) return [214, 169, 69, 255];
    const g = Math.max(0, 1 - d);
    return [Math.round(13 + 40 * g), Math.round(11 + 20 * g), Math.round(38 + 60 * g), 255];
  });
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), buf);
  console.log(`public/icon-${size}.png`, buf.length, 'bytes');
}
