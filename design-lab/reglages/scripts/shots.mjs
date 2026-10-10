// Screenshots of the lab in several combinations (Playwright chromium from the app's
// node_modules). Usage:
//   node scripts/shots.mjs [--out=dir] [--url=http://127.0.0.1:5180/labo-reglages.html] [--only=name,name]
// Each shot = a lab state (localStorage) + an optional action; console errors are reported.
// Default output: design-lab/reglages/shots/shell/ (ignored by Git); pass --out=dir to write elsewhere.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths come from this file's location: the lab is design-lab/reglages/, the repository two levels up.
const lab = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const out = resolve(outArg ? outArg.slice(6) : join(lab, 'shots', 'shell'));
const url = (args.find(a => a.startsWith('--url=')) || '--url=http://127.0.0.1:5180/labo-reglages.html').slice(6);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

const base = { speed: 1, reduced: false, scenario: 'ok', toolbarOpen: true, pageSet: 'A', switchStyle: 'ours', votes: {}, notes: {} };
export const SHOTS = [
  { name: 'reglages-porcelaine-A-light', state: { section: 'reglages', base: 'porcelaine', pageSet: 'A', theme: 'light' } },
  { name: 'reglages-papier-B-dark', state: { section: 'reglages', base: 'papier', pageSet: 'B', theme: 'dark' } },
  { name: 'reglages-porcelaine-A-dark-serveur', state: { section: 'reglages', base: 'porcelaine', pageSet: 'A', theme: 'dark' }, action: async p => { await p.getByRole('tab', { name: 'Serveur' }).click(); await p.waitForTimeout(2600); } },
  { name: 'reglages-hero-switch-light', state: { section: 'reglages', base: 'papier', pageSet: 'A', theme: 'light', switchStyle: 'hero' } },
  { name: 'parcours-porcelaine-light', state: { section: 'parcours', base: 'porcelaine', theme: 'light' } },
  { name: 'parcours-papier-dark', state: { section: 'parcours', base: 'papier', theme: 'dark' } },
  { name: 'composants-porcelaine-light', state: { section: 'composants', base: 'porcelaine', theme: 'light' }, full: true },
  { name: 'composants-papier-dark', state: { section: 'composants', base: 'papier', pageSet: 'B', theme: 'dark' }, full: true },
  { name: 'phone-reglages-dark', state: { section: 'reglages', base: 'porcelaine', theme: 'dark' }, viewport: { width: 390, height: 844 } },
];

const browser = await chromium.launch();
let failures = 0;
for (const shot of SHOTS.filter(s => !only.length || only.includes(s.name))) {
  const context = await browser.newContext({ viewport: shot.viewport || { width: 1440, height: 960 }, deviceScaleFactor: shot.viewport ? 2 : 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(state => { try { localStorage.setItem('ft-labo-reglages-v2', JSON.stringify(state)); } catch {} }, { ...base, ...shot.state });
  await page.goto(url);
  await page.waitForTimeout(900);
  if (shot.action) await shot.action(page);
  await page.waitForTimeout(400);
  const file = join(out, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  if (shot.full) {
    // the page scrolls inside .lab-page: capture it whole
    const h = await page.evaluate(() => document.querySelector('.lab-page')?.scrollHeight || 0);
    if (h) {
      await page.setViewportSize({ width: (shot.viewport || { width: 1440 }).width, height: Math.min(h + 140, 6000) });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${shot.name}-full.png`) });
    }
  }
  console.log(`${errors.length ? 'ERR ' : 'ok  '} ${file}${errors.length ? '\n     ' + errors.join('\n     ') : ''}`);
  if (errors.length) failures++;
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
