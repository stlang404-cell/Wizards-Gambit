#!/usr/bin/env node
/**
 * Wizard's Gambit local server (Node built-ins only).
 *
 *   node tools/serve.mjs [--port 4173] [--dir dist] [--open]
 *   (environment variable WG_PORT also sets the port)
 *
 * - Binds 127.0.0.1 only (not reachable from other machines).
 * - Uses ONE fixed port. It never switches ports silently, because browser
 *   saves belong to the exact address (http://127.0.0.1:<port>).
 * - If the port is busy and Wizard's Gambit is already running there, it just
 *   opens the browser. If another program owns the port, it explains how to
 *   pick a different port and exits. It never stops other programs.
 */
import { createServer, get } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_ID = 'wizards-gambit';
const VERSION = '0.1.0-m1';
const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const port = Number(arg('port', process.env.WG_PORT || '4173'));
const root = resolve(arg('dir', existsSync(join(here, '..', 'dist')) ? join(here, '..', 'dist') : join(here, 'dist')));
const shouldOpen = process.argv.includes('--open');
const url = `http://127.0.0.1:${port}/`;

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error(`[Wizard's Gambit] Invalid port "${port}". Use a number between 1024 and 65535.`);
  process.exit(2);
}
if (!existsSync(join(root, 'index.html'))) {
  console.error(`[Wizard's Gambit] No built game found in ${root}.`);
  console.error('Build it first with:  npm run build');
  process.exit(3);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function openBrowser(target) {
  try {
    const opts = { stdio: 'ignore', detached: true, windowsHide: true };
    const child = process.platform === 'win32' ? spawn('cmd', ['/c', 'start', '""', target], opts)
      : process.platform === 'darwin' ? spawn('open', [target], opts) : spawn('xdg-open', [target], opts);
    child.on('error', () => console.log(`Open this address in your browser: ${target}`));
    child.unref();
  } catch {
    console.log(`Open this address in your browser: ${target}`);
  }
}

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path === '/__wg_health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ app: APP_ID, version: VERSION }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(path)) { res.writeHead(404); res.end('Not found'); return; }
    file = join(root, 'index.html');
  }
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(`[Wizard's Gambit] Could not start the server: ${err.message}`);
    process.exit(1);
  }
  // Port busy: is it us?
  const probe = get({ host: '127.0.0.1', port, path: '/__wg_health', timeout: 1500 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      let ours = false;
      try { ours = JSON.parse(body).app === APP_ID; } catch { /* not ours */ }
      if (ours) {
        console.log(`Wizard's Gambit is already running at ${url}`);
        if (shouldOpen) openBrowser(url);
        process.exit(0);
      }
      busy();
    });
  });
  probe.on('timeout', () => { probe.destroy(); busy(); });
  probe.on('error', busy);
});

function busy() {
  console.error('');
  console.error(`[Wizard's Gambit] Port ${port} is already used by another program.`);
  console.error('Nothing was stopped or changed. To use a different port, run for example:');
  console.error(process.platform === 'win32' ? '    set WG_PORT=4321' : '    WG_PORT=4321 node tools/serve.mjs --open');
  console.error(process.platform === 'win32' ? '    Launch-WizardsGambit.cmd' : '');
  console.error('Note: saved games belong to the address, so a different port starts with separate saves');
  console.error('(use Archive > Export / Import to move finished matches).');
  process.exit(4);
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Wizard's Gambit ${VERSION} is running at ${url}`);
  console.log('Keep this window open while you play. Press Ctrl+C to stop the server.');
  if (shouldOpen) openBrowser(url);
});
