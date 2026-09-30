// Builds the lab into ONE self-contained page: labo-reglages.html (all JS and CSS inline, no
// network except optional Google Fonts — none used today).
//   node build.mjs           build once
//   node build.mjs --watch   rebuild on every change in src/
// Steps: 1. Tailwind (tw: prefix, no preflight) → dist/tw.css
//        2. HeroUI CSS (no preflight) → scoped under .heroui-scope → dist/heroui.css
//        3. esbuild bundles src/main.jsx (+ imported CSS) → dist/app.js, dist/app.css
//        4. assemble labo-reglages.html (full document, opens from file://) and
//           dist/labo-reglages.artifact.html (same page without doctype/html/head wrappers).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, watch, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { scopeCss } from './scripts/scope-css.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const r = p => join(root, p);
mkdirSync(r('dist'), { recursive: true });
const tailwindCli = r('node_modules/@tailwindcss/cli/dist/index.mjs');

function tailwind(input, output) {
  execFileSync(process.execPath, [tailwindCli, '-i', r(input), '-o', r(output), '--minify'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
}

let heroCache = null;
async function build() {
  const t0 = Date.now();
  // 1. Tailwind for shadcn-style components
  tailwind('src/tailwind.css', 'dist/tw.css');
  // 2. HeroUI (only rebuilt when its sources change: slow-ish and rarely touched)
  const heroKey = readFileSync(r('src/heroui/heroui.css'), 'utf8') + readFileSync(r('src/heroui/HeroDemo.jsx'), 'utf8');
  if (!heroCache || heroCache.key !== heroKey || !existsSync(r('dist/heroui.css'))) {
    tailwind('src/heroui/heroui.css', 'dist/heroui.raw.css');
    writeFileSync(r('dist/heroui.css'), scopeCss(readFileSync(r('dist/heroui.raw.css'), 'utf8'), 'heroui-scope'));
    heroCache = { key: heroKey };
  }
  // 3. App bundle
  await esbuild.build({
    entryPoints: [r('src/main.jsx')],
    bundle: true, format: 'iife', target: ['chrome110', 'edge110', 'safari16', 'firefox115'],
    jsx: 'automatic', minify: true, legalComments: 'none', charset: 'utf8',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.js': 'jsx' },
    outdir: r('dist'), entryNames: 'app', logLevel: 'warning',
  });
  // 4. Assemble
  const css = ['dist/tw.css', 'dist/heroui.css', 'dist/app.css'].map(f => readFileSync(r(f), 'utf8')).join('\n');
  const js = readFileSync(r('dist/app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  const body = `<title>Labo Réglages</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Labo de design des Réglages et du premier lancement : directions, palettes, animations, parcours complet.">
<style>
${safeCss}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;
  const full = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
${body.replace('<div id="root"></div>', '</head>\n<body>\n<div id="root"></div>')}</body>
</html>
`;
  writeFileSync(r('labo-reglages.html'), full);
  writeFileSync(r('dist/labo-reglages.artifact.html'), body);
  const kb = (Buffer.byteLength(full) / 1024).toFixed(0);
  console.log(`labo-reglages.html ${kb} KB (${Date.now() - t0} ms)`);
}

await build();
if (process.argv.includes('--watch')) {
  let timer = null, busy = false;
  watch(r('src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (busy) return; busy = true;
      try { await build(); } catch (e) { console.error(e.message); }
      busy = false;
    }, 150);
  });
  console.log('watching src/ …');
}
