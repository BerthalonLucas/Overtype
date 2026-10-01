// Robustness of the Démo (Lucas, 30/09: « rien ne doit rester bloqué »). A page is shaken while it
// plays — play / pause, double clicks, scrubbing, the rail's preview hovered and left, theme,
// speed and reduced motion switched, the section restarted, replay while it runs, Escape, the
// changed-words and spring variants — then seeked to a few instants and compared, pixel by pixel,
// to a fresh page seeked to the same instants. The scene is a pure function of time: any leftover
// (a bubble stuck half-way, a halo that stayed, a pill in two places) shows as a difference.
//   node scripts/demo-chaos.mjs [outDir] [--rounds=3]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve('D:/src/Flow_Translate/node_modules/@playwright/test'));
const args = process.argv.slice(2);
const out = resolve(args.find(a => !a.startsWith('--')) || 'C:/Users/agent/AppData/Local/Temp/claude/D--src/a9e04c7f-6ece-5d86-980b-e4bfe3913ac5/scratchpad/labo-shots-v2/demo/chaos');
const rounds = +((args.find(a => a.startsWith('--rounds=')) || '--rounds=3').slice(9));
mkdirSync(out, { recursive: true });
const url = 'http://127.0.0.1:5180/labo-reglages.html';
const state = { section: 'demo', base: 'porcelaine', pageSet: 'A', theme: 'light', speed: 1, reduced: false, scenario: 'ok', toolbarOpen: true, switchStyle: 'ours', votes: {}, notes: {} };
const CHECK = [4420, 7000, 8300, 8960, 9800, 11200, 12600, 14300, 16800];

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = a => a[Math.floor(rnd() * a.length)];

const browser = await chromium.launch();
async function open() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('ft-labo-reglages-v2', JSON.stringify(s)); localStorage.setItem('ft-labo-demo', JSON.stringify({ marks: 'encre', preset: 'smooth' })); sessionStorage.setItem('seeded', '1'); } } catch {} }, state);
  await page.goto(url);
  await page.waitForFunction(() => window.__demo);
  return { page, errors, context };
}
const clickText = async (page, name) => { const b = page.getByRole('radio', { name, exact: true }).first(); if (await b.count()) await b.click({ timeout: 1500 }).catch(() => {}); else await page.getByRole('button', { name, exact: true }).first().click({ timeout: 1500 }).catch(() => {}); };

const ACTIONS = {
  playPause: async p => p.locator('.dm-controls .dm-ctl').first().click(),
  doubleClickPlay: async p => p.locator('.dm-controls .dm-ctl').first().dblclick(),
  replayControl: async p => p.getByRole('button', { name: 'Recommencer la démo' }).click(),
  scrub: async p => { const r = await p.locator('.dm-range').boundingBox(); await p.mouse.move(r.x + r.width * rnd(), r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + r.width * rnd(), r.y + r.height / 2, { steps: 4 }); await p.mouse.up(); },
  railPreview: async p => { const items = p.locator('.dm-rail-item'); await p.locator('.dm-rail').hover(); await p.waitForTimeout(120); await items.nth(Math.floor(rnd() * 7)).hover(); await p.waitForTimeout(150); await items.nth(Math.floor(rnd() * 7)).hover(); },
  railLeave: async p => p.mouse.move(40, 900),
  escape: async p => p.keyboard.press('Escape'),
  themeDark: async p => clickText(p, 'Sombre'),
  themeLight: async p => clickText(p, 'Clair'),
  speedSlow: async p => clickText(p, '⅒×'),
  speedFast: async p => clickText(p, '1×'),
  reducedToggle: async p => p.getByRole('switch', { name: /Mouvement réduit/ }).first().click({ timeout: 1500 }).catch(() => {}),
  restartSection: async p => p.getByRole('button', { name: 'Recommencer', exact: true }).first().click({ timeout: 1500 }).catch(() => {}),
  marks: async p => clickText(p, pick(['Actuel', 'Encre irisée', 'Éclat', 'Reflet'])),
  preset: async p => clickText(p, pick(['Fluide', 'Rebondi'])),
  wait: async p => p.waitForTimeout(200 + rnd() * 900),
};

async function settle(page) {
  // Back to the reference settings, then let every lab transition end.
  await page.mouse.move(40, 900);
  await clickText(page, 'Clair'); await clickText(page, '1×');
  const reduced = await page.evaluate(() => document.querySelector('.dm-root')?.hasAttribute('data-reduced'));
  if (reduced) await ACTIONS.reducedToggle(page);
  await clickText(page, 'Encre irisée'); await clickText(page, 'Fluide');
  await page.waitForFunction(() => window.__demo);
  await page.waitForTimeout(700);
}
async function frames(page, tag) {
  const shots = [];
  for (const t of CHECK) {
    await page.evaluate(v => window.__demo.seek(v), t);
    await page.waitForTimeout(650);   // the caption's own fade (lab UI) ends
    const clip = await page.evaluate(() => { const r = document.querySelector('.dm-root').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const buf = await page.screenshot({ clip });
    writeFileSync(join(out, `${tag}-t${t}.png`), buf);
    shots.push(buf);
  }
  return shots;
}
// Pixel difference in a page (canvas), threshold 24 per channel.
async function diff(page, a, b) {
  return page.evaluate(async ([A, B]) => {
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${src}`; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, w, h).data;
    x.clearRect(0, 0, w, h); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, w, h).data;
    let n = 0, minX = w, minY = h, maxX = 0, maxY = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) {
        n++; const p = i / 4, px = p % w, py = (p - px) / w;
        if (px < minX) minX = px; if (py < minY) minY = py; if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
    }
    return { n, box: n ? [minX, minY, maxX, maxY] : null, size: [w, h] };
  }, [a.toString('base64'), b.toString('base64')]);
}

const fresh = await open();
await settle(fresh.page);
const ref = await frames(fresh.page, 'fresh');
let bad = 0;
for (let r = 0; r < rounds; r++) {
  const shaken = await open();
  const log = [];
  for (let i = 0; i < 26; i++) {
    const name = pick(Object.keys(ACTIONS));
    log.push(name);
    try { await ACTIONS[name](shaken.page); } catch (e) { log.push(`(${name} failed: ${String(e).split('\n')[0]})`); }
    await shaken.page.waitForTimeout(60 + rnd() * 400);
  }
  await settle(shaken.page);
  const got = await frames(shaken.page, `round${r}`);
  const results = [];
  for (let k = 0; k < CHECK.length; k++) results.push({ t: CHECK[k], ...(await diff(fresh.page, ref[k], got[k])) });
  const worst = results.filter(x => x.n > 40);
  console.log(`round ${r}: ${log.join(' → ')}`);
  console.log(`  ${worst.length ? 'DIFF' : 'same'} ${results.map(x => `${x.t}:${x.n}`).join(' ')}${shaken.errors.length ? `\n  console errors: ${shaken.errors.join(' | ')}` : ''}`);
  if (worst.length || shaken.errors.length) bad++;
  await shaken.context.close();
}
if (fresh.errors.length) { console.log('fresh page errors:', fresh.errors.join(' | ')); bad++; }
await browser.close();
process.exit(bad ? 1 : 0);
