// Frames of the Démo, seeked exactly (window.__demo.seek(t): the scene is a pure function of time).
//   node scripts/demo-shots.mjs [outDir] [--times=6100,6300] [--theme=light|dark] [--marks=encre]
//        [--preset=smooth|bouncy] [--reduced] [--dpr=2] [--crop=ilot|text|full|cursor] [--speed=1]
// Default: a contact set of the key moments, both themes. Console errors fail the run.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve('D:/src/Flow_Translate/node_modules/@playwright/test'));
const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const out = resolve(args.find(a => !a.startsWith('--')) || 'C:/Users/agent/AppData/Local/Temp/claude/D--src/a9e04c7f-6ece-5d86-980b-e4bfe3913ac5/scratchpad/labo-shots-v2/demo/frames');
mkdirSync(out, { recursive: true });
const url = opt('url', 'http://127.0.0.1:5180/labo-reglages.html');
const themes = opt('theme', 'light,dark').split(',');
const times = opt('times', '1600,3400,4420,5700,6120,6200,6400,7400,7700,7800,8400,8920,9000,9100,9300,9800,10950,11100,11400,11800,12600,13500,14100,14300,14700,15200,16500').split(',').map(Number);
const dpr = +opt('dpr', '1');
const crop = opt('crop', 'full');
const reduced = args.includes('--reduced');
const marks = opt('marks', '');
const preset = opt('preset', '');

const browser = await chromium.launch();
let failures = 0;
for (const theme of themes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(([state, demo]) => {
    try { localStorage.setItem('ft-labo-reglages-v2', JSON.stringify(state)); if (demo) localStorage.setItem('ft-labo-demo', JSON.stringify(demo)); } catch {}
  }, [{ section: 'demo', base: 'porcelaine', pageSet: 'A', theme, speed: 1, reduced, scenario: 'ok', toolbarOpen: true, switchStyle: 'ours', votes: {}, notes: {} },
    (marks || preset) ? { ...(marks ? { marks } : {}), ...(preset ? { preset } : {}) } : null]);
  await page.goto(url);
  await page.waitForFunction(() => window.__demo, null, { timeout: 10000 });
  await page.waitForTimeout(600);
  for (const t of times) {
    await page.evaluate(v => window.__demo.seek(v), t);
    await page.waitForTimeout(160);
    const name = `${theme}${reduced ? '-reduced' : ''}${marks ? `-${marks}` : ''}${preset ? `-${preset}` : ''}-t${String(t).padStart(5, '0')}${crop !== 'full' ? `-${crop}` : ''}.png`;
    let clip;
    if (crop === 'ilot') {
      clip = await page.evaluate(() => {
        const el = document.querySelector('.dm-corner .ilot-shape') || document.querySelector('.dm-para');
        const r = el.getBoundingClientRect();
        return { x: r.right - 300, y: r.top - 60, width: 360, height: 200 };
      });
    } else if (crop === 'text') {
      clip = await page.evaluate(() => { const r = document.querySelector('.dm-mail').getBoundingClientRect(); return { x: r.left, y: r.top + r.height * 0.3, width: r.width, height: r.height * 0.55 }; });
    } else if (crop === 'words') {
      clip = await page.evaluate(() => { const r = document.querySelector('.dm-para').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top - 6, width: r.width * 0.56, height: r.height + 12 }; });
    } else if (crop === 'cursor') {
      clip = await page.evaluate(() => { const r = document.querySelector('.dm-cursor').getBoundingClientRect(); return { x: r.left - 40, y: r.top - 40, width: 110, height: 110 }; });
    } else if (crop === 'stage') {
      clip = await page.evaluate(() => { const r = document.querySelector('.dm-root').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    }
    await page.screenshot({ path: join(out, name), clip });
  }
  console.log(`${errors.length ? 'ERR' : 'ok '} ${theme}: ${times.length} frames → ${out}${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
  if (errors.length) failures++;
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
