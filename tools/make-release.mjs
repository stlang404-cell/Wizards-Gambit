#!/usr/bin/env node
/**
 * Packages the built game into release/wizards-gambit-<version>-windows.zip:
 *   dist/ (built game), tools/serve.mjs (local server), Launch-WizardsGambit.cmd, PLAY-FIRST.txt
 * Players need only Node.js 20+; no npm install. Pure Node zip writer (deflate + CRC-32).
 *   npm run release
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!existsSync(join(root, 'dist', 'index.html'))) { console.error('Run "npm run build" first.'); process.exit(1); }
const name = `wizards-gambit-${pkg.version}-m1`;

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const files = [
  ...walk(join(root, 'dist')).map((p) => [p, relative(root, p)]),
  [join(root, 'tools', 'serve.mjs'), 'tools/serve.mjs'],
  [join(root, 'Launch-WizardsGambit.cmd'), 'Launch-WizardsGambit.cmd'],
];
const readme = Buffer.from([
  "WIZARD'S GAMBIT - First Playable Edition (M1), rules Ember Six v0.1",
  '',
  '1. Install Node.js LTS (version 20 or newer) from https://nodejs.org/ if you do not have it.',
  '2. Unzip this folder anywhere (for example Documents\\WizardsGambit).',
  '3. Double-click Launch-WizardsGambit.cmd. Your browser opens http://127.0.0.1:4173/',
  '   Keep the black window open while playing; close it to stop.',
  '',
  'If Windows Smart App Control or SmartScreen blocks the .cmd file, start it by hand:',
  '   Open the folder, click the address bar, type  cmd  and press Enter, then run:',
  '   node tools\\serve.mjs --open',
  '',
  'Port 4173 busy? Run:  set WG_PORT=4321  then  node tools\\serve.mjs --open',
  '(saves are kept per address, so a different port has separate saves).',
  '',
  'Everything runs locally and offline after unzipping. No account, no payments, unrated play only.',
  'Saves live in your browser for this address; use Archive > Export to back up finished matches.',
  '',
].join('\r\n'));

const local = []; const central = []; let offset = 0;
const add = (zipPath, data) => {
  const nameBuf = Buffer.from(`${name}/${zipPath.split(sep).join('/')}`);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); // fixed DOS date 1980-01-01 for reproducible zips
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(nameBuf.length, 26); h.writeUInt16LE(0, 28);
  local.push(h, nameBuf, comp);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, nameBuf);
  offset += h.length + nameBuf.length + comp.length;
};
for (const [abs, rel] of files.sort((a, b) => a[1].localeCompare(b[1]))) add(rel, readFileSync(abs));
add('PLAY-FIRST.txt', readme);
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length + 1, 8); end.writeUInt16LE(files.length + 1, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...local, cd, end]);
mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `${name}-windows.zip`);
writeFileSync(out, zip);
console.log(`${relative(root, out)}  ${zip.length} bytes  ${files.length + 1} files  sha256 ${createHash('sha256').update(zip).digest('hex')}`);
