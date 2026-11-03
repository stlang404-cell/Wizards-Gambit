#!/usr/bin/env node
/**
 * End-to-end browser test of the BUILT game (dist/) with Playwright + Chromium.
 *   npm run build && node tools/e2e.mjs [--port 4311] [--shots docs/screenshots] [--log docs/m1-logs/e2e.json]
 *
 * Playwright is NOT a project dependency: this uses a Playwright install
 * available on the machine (require('playwright')). Inputs are real pointer
 * clicks on the canvas at square centres; the ?e2e hook only READS state
 * (legal actions, notation, records) to choose clicks and verify results.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', '4311'));
// --root <dir>: test an unpacked release (uses <dir>/tools/serve.mjs and <dir>/dist)
const ROOT = arg('root', join(here, '..'));
const SHOTS = arg('shots', join(here, '..', 'docs', 'screenshots'));
const LOG = arg('log', join(here, '..', 'docs', 'm1-logs', 'e2e.json'));
const BASE = `http://127.0.0.1:${PORT}/`;
mkdirSync(SHOTS, { recursive: true });
mkdirSync(dirname(LOG), { recursive: true });

const results = [];
const consoleErrors = [];
let seed = 20261103;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const decode = (c) => (c >= 1296 ? { kind: 'concord', lo: Math.floor((c - 1296) / 36), hi: (c - 1296) % 36 } : { kind: 'move', from: Math.floor(c / 36), to: c % 36 });
const sq = (n) => (Number(n[1]) - 1) * 6 + 'abcdef'.indexOf(n[0]);

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, ...(detail ? { detail } : {}) });
    console.log(`PASS ${name}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(e && e.stack || e) });
    console.log(`FAIL ${name}: ${e}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

async function clickSquare(page, s) {
  const p = await page.evaluate((x) => window.__wgBoard.squareCenterClient(x), s);
  await page.mouse.click(p.x, p.y);
}
async function performAction(page, a, concordBtn = '#btn-concord') {
  if (a.kind === 'move') { await clickSquare(page, a.from); await clickSquare(page, a.to); return; }
  await clickSquare(page, a.lo);
  await page.click(concordBtn);
  await clickSquare(page, a.hi);
}
async function waitNewMatch(page) {
  await page.waitForFunction(() => window.__wg && window.__wg.ply() === 0 && !window.__wg.outcome(), null, { timeout: 10000 });
}
async function waitHumanTurn(page, timeout = 60000) {
  await page.waitForFunction(() => window.__wg && (window.__wg.outcome() || (window.__wg.humanTurn() && !window.__wg.thinking())), null, { timeout });
}

const server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => { if (String(d).includes('running at')) resolve(); });
  server.stderr.on('data', (d) => process.stderr.write(d));
  server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

try {
  await check('menu loads', async () => {
    await page.goto(`${BASE}?e2e=1`);
    await page.waitForSelector('#start-hva');
    await page.screenshot({ path: join(SHOTS, '01-menu.png') });
  });

  await check('tutorial: every lesson completed by real clicks', async () => {
    await page.goto(`${BASE}?e2e=1#/tutorial`);
    await page.waitForSelector('.lesson');
    const lessons = await page.$$eval('.lesson-list li', (l) => l.length);
    let completed = 0;
    for (let i = 0; i < lessons; i++) {
      const text = await page.textContent('.lesson');
      if (await page.$('#lesson-continue')) { await page.click('#lesson-continue'); completed++; continue; }
      const sol = /Hint: (\S+)/;
      await page.click('text=Show hint');
      const hint = (await page.textContent('.lesson .status')).match(sol)?.[1];
      assert(hint, `no hint for lesson ${i}: ${text?.slice(0, 40)}`);
      const a = hint.includes('~') ? { kind: 'concord', lo: Math.min(sq(hint.slice(0, 2)), sq(hint.slice(3))), hi: Math.max(sq(hint.slice(0, 2)), sq(hint.slice(3))) }
        : { kind: 'move', from: sq(hint.slice(0, 2)), to: sq(hint.slice(3)) };
      if (i === 8) await page.screenshot({ path: join(SHOTS, '05-tutorial-concord-before.png') });
      await performAction(page, a, '#lesson-concord');
      await page.waitForFunction(() => document.querySelector('.lesson .status')?.textContent?.startsWith('Well done'), null, { timeout: 5000 });
      completed++;
      if (i === 8) { await page.waitForTimeout(600); await page.screenshot({ path: join(SHOTS, '06-tutorial-concord-after.png') }); }
      if (await page.$('#lesson-next')) await page.click('#lesson-next');
    }
    const done = await page.$$eval('.lesson-list li.done', (l) => l.length);
    assert(done === lessons, `done ${done}/${lessons}`);
    return { lessons, completed };
  });

  await check('human vs AI (Novice): complete match by clicks, record + archive', async () => {
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.selectOption('#hva-level', 'novice');
    await page.selectOption('#hva-side', 'first');
    await page.click('#start-hva');
    await waitNewMatch(page);
    let humanMoves = 0;
    let casts = 0;
    for (let i = 0; i < 200; i++) {
      await waitHumanTurn(page);
      if (await page.evaluate(() => window.__wg.outcome())) break;
      const legal = await page.evaluate(() => window.__wg.legal());
      const caps = legal.filter((c) => c < 1296); // prefer moves, but use a Concord now and then
      const pick = (humanMoves === 3 && legal.some((c) => c >= 1296)) ? legal.find((c) => c >= 1296) : caps[Math.floor(rand() * caps.length)] ?? legal[0];
      const before = await page.evaluate(() => window.__wg.ply());
      await performAction(page, decode(pick));
      await page.waitForFunction((b) => window.__wg.ply() > b, before, { timeout: 5000 });
      humanMoves++;
      if (pick >= 1296) casts++;
      if (humanMoves === 2) await page.screenshot({ path: join(SHOTS, '02-hva-midgame.png') });
    }
    const outcome = await page.evaluate(() => window.__wg.outcome());
    assert(outcome, 'match did not finish');
    await page.waitForSelector('dialog.result-dialog[open]', { timeout: 5000 });
    await page.screenshot({ path: join(SHOTS, '03-hva-result.png') });
    const rec = await page.evaluate(() => window.__wg.record());
    assert(rec.status === 'completed' && rec.result !== '*' && rec.plies === rec.actions.length, 'bad record');
    assert(rec.players.second.ai && rec.players.second.ai.level === 'novice', 'AI policy missing in record');
    await page.click('text=Main menu');
    await page.goto(`${BASE}?e2e=1#/archive`);
    const rows = await page.$$eval('.archive-table tbody tr', (r) => r.length);
    assert(rows >= 1, 'archive empty');
    return { humanMoves, casts, outcome, plies: rec.plies, result: rec.result };
  });

  await check('archive replay viewer steps through a stored match', async () => {
    await page.click('.archive-table tbody tr >> text=Replay');
    await page.waitForSelector('.replay canvas');
    await page.click('text=⏮ Start');
    const t0 = await page.textContent('.replay .status');
    await page.click('text=Forward ▶');
    const t1 = await page.textContent('.replay .status');
    assert(t0.startsWith('Action 0') && t1.startsWith('Action 1'), `${t0} / ${t1}`);
    await page.screenshot({ path: join(SHOTS, '09-archive.png'), fullPage: true });
  });

  await check('undo in human-vs-AI returns to the human turn', async () => {
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.selectOption('#hva-level', 'novice');
    await page.click('#start-hva');
    await waitNewMatch(page);
    await waitHumanTurn(page);
    await performAction(page, { kind: 'move', from: sq('c2'), to: sq('c3') });
    await page.waitForFunction(() => window.__wg.ply() === 2 && window.__wg.humanTurn(), null, { timeout: 15000 });
    await page.click('#btn-undo');
    await page.waitForFunction(() => window.__wg.ply() === 0);
    const rec = await page.evaluate(() => window.__wg.record());
    assert(rec.undoCount === 1 && rec.practice === true, 'undo not recorded');
  });

  await check('restart mid-game archives the old match as abandoned', async () => {
    await performAction(page, { kind: 'move', from: sq('d1'), to: sq('e3') });
    await page.waitForFunction(() => window.__wg.ply() === 2 && window.__wg.humanTurn(), null, { timeout: 15000 });
    const oldId = await page.evaluate(() => window.__wg.record().matchId);
    await page.click('#btn-restart');
    await page.waitForFunction(() => window.__wg.ply() === 0);
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('wizards-gambit.save')));
    const old = save.archive.find((r) => r.matchId === oldId);
    assert(old && old.status === 'abandoned', 'abandoned record missing');
  });

  await check('pass-and-play: Concord, save/restore across reload, repetition draw', async () => {
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.click('#start-hvh');
    await waitNewMatch(page);
    // Concord a2~b2 by Ember (visual check), then Umbral replies
    await clickSquare(page, sq('a2'));
    await page.click('#btn-concord');
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, '04-concord-targets.png') });
    await clickSquare(page, sq('b2'));
    await page.waitForFunction(() => window.__wg.ply() === 1);
    const n1 = await page.evaluate(() => window.__wg.notation());
    assert(n1.includes(' 2 1-2 '), `seal not spent: ${n1}`);
    await performAction(page, { kind: 'move', from: sq('c6'), to: sq('b4') });
    await page.waitForFunction(() => window.__wg.ply() === 2);
    const before = await page.evaluate(() => window.__wg.notation());
    await page.reload();
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.click('#resume');
    await page.waitForFunction(() => window.__wg && window.__wg.ply() === 2);
    const after = await page.evaluate(() => window.__wg.notation());
    assert(after === before, `restore mismatch ${before} vs ${after}`);
    // Spellblade shuffles to a threefold repetition
    const cycle = [['d1', 'c3'], ['b4', 'c6'], ['c3', 'd1'], ['c6', 'b4']];
    for (let k = 0; k < 2; k++) {
      for (const [f, t] of cycle) {
        const b = await page.evaluate(() => window.__wg.ply());
        await performAction(page, { kind: 'move', from: sq(f), to: sq(t) });
        await page.waitForFunction((x) => window.__wg.ply() > x || window.__wg.outcome(), b);
        if (await page.evaluate(() => window.__wg.outcome())) break;
      }
    }
    const o = await page.evaluate(() => window.__wg.outcome());
    assert(o && o.winner === 0 && o.reason === 'repetition', `expected repetition draw, got ${JSON.stringify(o)}`);
    await page.waitForSelector('dialog.result-dialog[open]');
    await page.screenshot({ path: join(SHOTS, '07-hvh-draw.png') });
    return { outcome: o };
  });

  await check('AI exhibition (Novice vs Adept): pause/resume, finishes legally', async () => {
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.selectOption('#ava-first', 'novice');
    await page.selectOption('#ava-second', 'adept');
    await page.click('#start-ava');
    await waitNewMatch(page);
    await page.selectOption('#speed', 'fast');
    await page.waitForFunction(() => window.__wg.ply() >= 4, null, { timeout: 30000 });
    await page.click('#btn-pause');
    const p1 = await page.evaluate(() => window.__wg.ply());
    await page.waitForTimeout(1500);
    const p2 = await page.evaluate(() => window.__wg.ply());
    assert(p2 - p1 <= 1, `kept playing while paused (${p1} -> ${p2})`);
    await page.screenshot({ path: join(SHOTS, '08-exhibition-paused.png') });
    await page.click('#btn-pause');
    await page.selectOption('#speed', 'instant');
    await page.waitForFunction(() => window.__wg.outcome(), null, { timeout: 240000 });
    const rec = await page.evaluate(() => window.__wg.record());
    assert(rec.status === 'completed' && rec.mode === 'ai-vs-ai', 'bad exhibition record');
    return { plies: rec.plies, result: rec.result, reason: rec.outcome.reason };
  });

  await check('corrupt save is reported and backed up, app still starts', async () => {
    await page.evaluate(() => localStorage.setItem('wizards-gambit.save', '{broken'));
    await page.goto(`${BASE}?e2e=1#/menu`);
    await page.reload();
    await page.waitForSelector('.notices');
    const txt = await page.textContent('.notices');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    assert(/damaged/.test(txt) && keys.some((k) => k.startsWith('wizards-gambit.backup.')), 'no warning/backup');
  });

  await check('rules and settings pages render', async () => {
    await page.goto(`${BASE}?e2e=1#/rules`);
    await page.waitForSelector('.rules');
    await page.screenshot({ path: join(SHOTS, '10-rules.png'), fullPage: true });
    await page.goto(`${BASE}?e2e=1#/settings`);
    await page.waitForSelector('input[type=checkbox]');
  });

  await check('mobile viewport 390×844: no horizontal overflow, board fits, tap to move', async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const mp = await m.newPage();
    mp.on('pageerror', (e) => consoleErrors.push(String(e)));
    await mp.goto(`${BASE}?e2e=1#/menu`);
    await mp.screenshot({ path: join(SHOTS, '11-mobile-menu.png') });
    await mp.click('#start-hvh');
    await waitNewMatch(mp);
    await mp.waitForTimeout(300);
    const dims = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, cw: document.querySelector('canvas.board').getBoundingClientRect().width }));
    assert(dims.sw <= dims.iw, `horizontal overflow ${JSON.stringify(dims)}`);
    assert(dims.cw >= 300 && dims.cw <= dims.iw, `board size ${dims.cw}`);
    const c2 = await mp.evaluate(() => window.__wgBoard.squareCenterClient(8));
    const c3 = await mp.evaluate(() => window.__wgBoard.squareCenterClient(14));
    await mp.touchscreen.tap(c2.x, c2.y);
    await mp.touchscreen.tap(c3.x, c3.y);
    await mp.waitForFunction(() => window.__wg.ply() === 1);
    await mp.screenshot({ path: join(SHOTS, '12-mobile-game.png'), fullPage: true });
    await m.close();
    return dims;
  });

  await check('no console errors or uncaught exceptions', async () => {
    assert(consoleErrors.length === 0, consoleErrors.join('\n'));
  });
} finally {
  await browser.close();
  server.kill();
}

const summary = {
  tool: 'tools/e2e.mjs', when: new Date().toISOString(), browser: `chromium ${browser.version?.() ?? ''}`.trim(),
  passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, consoleErrors,
};
writeFileSync(LOG, JSON.stringify(summary, null, 1) + '\n');
console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
process.exit(summary.failed ? 1 : 0);
