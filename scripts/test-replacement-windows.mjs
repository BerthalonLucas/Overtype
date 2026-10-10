// Banc de remplacement réel sous Windows (QA-03). Il pilote de vraies fenêtres (Edge par
// Playwright, VS Code, LibreOffice Writer) sur des documents synthétiques, et un pilote natif
// (src-tauri/src/replacement_tests.rs, compilé seulement en test, test ignoré par défaut) qui
// appelle les vraies fonctions de capture, de collage et d'annulation de l'application :
// SendInput, UI Automation et presse-papiers réels, aucune API simulée, aucun remplacement en JS.
// Il prend le clavier, la souris et le presse-papiers : un bureau dédié (VM, runner CI).
//
// Usage : npm run test:replacement [-- --only id1,id2] [-- --report fichier.json]
// Sortie : une ligne par scénario (PASS, FAIL, XFAIL, XPASS, SKIP), puis le bilan. Code 0 tant
// qu'aucun scénario n'échoue hors de la liste EXPECTED_FAIL et qu'aucun de cette liste ne passe.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Risques ouverts que le banc prouve (audit Elio NATIVE-xxx ; QA-03-x : trouvés par ce banc) : ces
// scénarios DOIVENT échouer tant que le correctif n'est pas livré. Ils comptent alors « XFAIL
// (attendu) » sans faire échouer le banc. Un correctif qui en fait passer un donne « XPASS » et un
// code 1 : retirer alors sa ligne ici.
const EXPECTED_FAIL = {
  // La capture UIA d'une sélection aux bornes d'un élément déborde sur le texte qui suit.
  'contenteditable-bornes-element': 'QA-03-A',
  // Dans un contenteditable riche, le texte collé n'est pas retrouvé : Annuler n'est pas proposé.
  'annulation-ctrl-z-contenteditable': 'QA-03-B',
  'uia-muette-revalidation': 'NATIVE-001',
  'fermeture-urgence-collage-engage': 'NATIVE-006',
  'collage-bloque-resultat-deja-present': 'NATIVE-010',
  'selection-multiple-uia-simulee': 'NATIVE-012',
};

if (process.platform !== 'win32') {
  console.error('Banc de remplacement : Windows uniquement (SendInput, UI Automation et presse-papiers réels).');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = name => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const only = argument('only')?.split(',');
const reportPath = argument('report');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scratch = await mkdtemp(join(tmpdir(), 'replacement-bench-'));

const ORIGINAL = 'Début 🚀 café 😀 fin';
const SELECTED = 'café 😀';
const VALUE = 'équipe 🚀';
const SEED = 'presse-papiers riche du banc ✓';
const UNKEEPABLE = 'texte copié avec une image Office 🖼️';
const WRITER = 'copie d’un écrivain autonome ✍️';
const PAGE = `<title>Banc de remplacement</title>
<style>body{font:16px "Segoe UI",sans-serif;margin:16px}input,textarea,[contenteditable]{display:block;width:560px;margin:8px 0;font:16px "Segoe UI",sans-serif}</style>
<input id="input" aria-label="champ"><textarea id="textarea" rows="3" aria-label="zone"></textarea>
<div id="rich" contenteditable="true" role="textbox" aria-label="riche"></div>
<input id="other" aria-label="autre"><input id="readonly" readonly aria-label="lecture seule">
<input id="password" type="password" aria-label="mot de passe">
<iframe srcdoc="<textarea id=frame aria-label=cadre></textarea>"></iframe><div id="shadow"></div>`;

// ---------------------------------------------------------------- pilote natif
let port;
let driverProcess;
let driverErrors = '';
const driver = payload => new Promise((resolvePromise, reject) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.setTimeout(60_000, () => socket.destroy(Error(`pilote natif muet (${payload.op})`)));
  let data = '';
  socket.on('connect', () => socket.write(`${JSON.stringify(payload)}\n`));
  socket.on('error', reject);
  socket.on('data', chunk => {
    data += chunk;
    if (data.includes('\n')) { socket.end(); resolvePromise(JSON.parse(data)); }
  });
});
const cargo = ['--locked', '--manifest-path', join(root, 'src-tauri', 'Cargo.toml'), '--lib'];
const startDriver = async () => {
  console.error('Compilation du pilote natif (cargo test --no-run)…');
  execFileSync('cargo', ['test', ...cargo, '--no-run'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  const portFile = join(scratch, 'port');
  driverProcess = spawn('cargo', ['test', ...cargo, 'replacement_tests::replacement_desktop_driver', '--',
    '--ignored', '--exact', '--nocapture', '--test-threads=1'], {
    cwd: root, env: { ...process.env, FLOWTRANSLATE_REPLACEMENT_PORT_FILE: portFile }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  driverProcess.stderr.on('data', chunk => { driverErrors = (driverErrors + chunk).slice(-4000); });
  for (let attempt = 0; attempt < 240 && !port; attempt++) {
    if (driverProcess.exitCode !== null) throw Error(`pilote natif arrêté avant d'écouter :\n${driverErrors}`);
    try { port = Number(await readFile(portFile, 'utf8')) || undefined; } catch {}
    if (!port) await sleep(250);
  }
  assert.ok(port, 'pilote natif à l’écoute');
};
const stopDriver = async () => {
  if (port) await driver({ op: 'quit' }).catch(() => {});
  if (driverProcess && driverProcess.exitCode === null) {
    await sleep(300);
    if (driverProcess.exitCode === null) {
      try { execFileSync('taskkill', ['/PID', String(driverProcess.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    }
  }
};

// ---------------------------------------------------------------- applications
const findApp = (envName, candidates) => [process.env[envName], ...candidates.flatMap(([base, path]) =>
  process.env[base] ? [join(process.env[base], path)] : [])].find(p => p && existsSync(p)) ?? null;
const codePath = findApp('FLOWTRANSLATE_BENCH_VSCODE', [
  ['LOCALAPPDATA', 'Programs\\Microsoft VS Code\\Code.exe'], ['ProgramFiles', 'Microsoft VS Code\\Code.exe']]);
const sofficePath = findApp('FLOWTRANSLATE_BENCH_SOFFICE', [
  ['ProgramFiles', 'LibreOffice\\program\\soffice.exe'], ['ProgramFiles(x86)', 'LibreOffice\\program\\soffice.exe']]);
const launched = [];
const launch = (path, args) => {
  const child = spawn(path, args, { stdio: 'ignore', detached: false });
  launched.push(child.pid);
  return child.pid;
};
const kill = pid => {
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
};

class Skip extends Error {}
// Une précondition non remplie (fenêtre absente, capture impossible…) n'est jamais le risque
// qu'un scénario prouve : elle compte FAIL, même pour un scénario attendu en échec.
class Setup extends Error {}
const need = (condition, message) => {
  if (!condition) throw new Setup(message);
};

// ---------------------------------------------------------------- Edge
let browser;
let page;
const focusEdge = async () => {
  const front = await driver({ op: 'focus', title: 'Banc de remplacement' });
  need(front.ok, `Edge au premier plan : ${front.message}`);
};
const field = id => (id === 'frame' ? page.frameLocator('iframe').locator('#frame')
  : id === 'shadow' ? page.locator('#shadow-input') : page.locator(`#${id}`));
// `rich` : la sélection tient dans le nœud texte du <span>, comme un glisser à la souris ;
// `elementBounds` : ses bornes sont celles de l'élément (selectNodeContents, un éditeur riche qui
// sélectionne un nœud, un triple clic).
const prepare = async (locator, { text = ORIGINAL, selected = SELECTED, rich = false, elementBounds = false, occurrence = 0 } = {}) => {
  await focusEdge();
  await locator.evaluate((el, { text, selected, rich, elementBounds, occurrence }) => {
    delete el.dataset.nativeInput;
    if (rich) {
      el.innerHTML = `<b>Début 🚀 </b><span>${selected}</span><i> fin</i>`;
      el.focus();
      const range = document.createRange();
      const span = el.querySelector('span');
      if (elementBounds) range.selectNodeContents(span);
      else {
        range.setStart(span.firstChild, 0);
        range.setEnd(span.firstChild, span.firstChild.length);
      }
      const selection = el.ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    el.value = text;
    el.focus();
    let start = -1;
    for (let i = 0; i <= occurrence; i++) start = text.indexOf(selected, start + 1);
    el.setSelectionRange(start, start + selected.length);
  }, { text, selected, rich, elementBounds, occurrence });
  await sleep(300);
};
const content = locator => locator.evaluate(el => ('value' in el ? el.value : el.innerText.replace(/\u00a0/g, ' ')));
const select = (locator, start, end) => locator.evaluate((el, [s, e]) => el.setSelectionRange(s, e), [start, end]);
const seed = async (kind = 'rich', text = SEED) => need((await driver({ op: 'clipboard-seed', kind, text })).ok, 'presse-papiers semé');
const capture = async (details, options = {}) => {
  const result = await driver({ op: 'capture', expect: options.expect ?? SELECTED, copy: options.copy ?? false, writer: options.writer });
  details.capture = result;
  return result;
};
const captureReplaceable = async (details, options = {}) => {
  const result = await capture(details, options);
  need(result.ok, `capture : ${result.kind} ${result.reason ?? ''}`);
  need(result.replaceable, 'capture remplaçable');
  const wanted = [...(options.expect ?? SELECTED)].length;
  need(result.matches, `la capture est exactement la sélection (${result.selectedLength} caractères lus pour ${wanted} sélectionnés)`);
  return result;
};
const replace = async (details, value = VALUE, extra = {}) => {
  const result = await driver({ op: 'replace', value, ...extra });
  details.replace = result;
  return result;
};
const refusedUnchanged = async (details, locator, before) => {
  const result = await replace(details);
  assert.equal(result.ok, false, `remplacement refusé (obtenu : ${JSON.stringify(result)})`);
  assert.equal(await content(locator), before, 'texte inchangé');
};

// ---------------------------------------------------------------- scénarios
const scenarios = [];
const scenario = (id, title, run) => scenarios.push({ id, title, run });

for (const [id, name, fieldId, options] of [
  ['unicode-input', '<input>', 'input', {}],
  ['unicode-textarea-multiligne', '<textarea>, résultat sur deux lignes', 'textarea', { multiline: true }],
  ['unicode-contenteditable-riche', 'contenteditable riche (gras, italique autour)', 'rich', { rich: true }],
  ['unicode-iframe', '<textarea> dans une iframe', 'frame', { noInputEvent: true }],
  ['unicode-shadow-dom', '<textarea> dans un shadow DOM', 'shadow', { noInputEvent: true }],
  ['unicode-input-par-copie', '<input> par la copie synthétique (route sans UIA)', 'input', { copy: true }],
]) {
  scenario(id, `Remplacement Unicode réussi : ${name}`, async details => {
    const locator = field(fieldId);
    await seed();
    const text = options.multiline ? `${ORIGINAL}\nSeconde ligne` : ORIGINAL;
    await prepare(locator, { text, rich: options.rich });
    const before = await content(locator);
    await captureReplaceable(details, { copy: options.copy });
    const value = options.multiline ? `${VALUE}\nmerci` : VALUE;
    const result = await replace(details, value);
    assert.equal(result.ok, true, `collage : ${result.kind} ${result.reason ?? ''}`);
    assert.equal(await content(locator), before.replace(SELECTED, value), 'texte autour intact, sélection remplacée');
    if (!options.noInputEvent) assert.equal(await locator.getAttribute('data-native-input'), 'insertFromPaste', 'événement de collage de l’éditeur');
    if (options.rich) {
      assert.equal((await locator.locator('b').textContent()).replace(/\u00a0/g, ' '), 'Début 🚀 ', 'gras intact');
      assert.equal(await locator.locator('i').textContent(), ' fin', 'italique intact');
    }
    const clip = await driver({ op: 'clipboard-state', text: SEED });
    details.clipboard = clip;
    assert.ok(clip.textMatches && clip.benchFormat, 'presse-papiers riche rendu entier (texte et format privé)');
    return `${details.capture.route}, ${result.confirmed ? 'relu' : 'supposé'}, presse-papiers rendu`;
  });
}

scenario('contenteditable-bornes-element', 'contenteditable riche, sélection aux bornes de l’élément (selectNodeContents)', async details => {
  const locator = field('rich');
  await prepare(locator, { rich: true, elementBounds: true });
  const before = await content(locator);
  const captured = await capture(details);
  const result = captured.ok && captured.replaceable ? await replace(details) : null;
  const after = await content(locator);
  details.after = after;
  if (captured.ok) assert.ok(captured.matches, `la capture est exactement la sélection (${captured.selectedLength} caractères lus pour ${[...SELECTED].length} sélectionnés ; collage ${result?.ok ? 'fait' : 'non fait'}, texte devenu « ${after} »)`);
  assert.ok([before, before.replace(SELECTED, VALUE)].includes(after), 'rien d’autre que la sélection n’est remplacé');
  return captured.ok ? `${captured.route}, capture exacte` : `capture refusée (${captured.kind})`;
});

for (const [id, name, rich] of [['annulation-ctrl-z-input', '<input>', false], ['annulation-ctrl-z-contenteditable', 'contenteditable riche', true]]) {
  scenario(id, `Annulation (Ctrl+Z de l’app) après remplacement : ${name}`, async details => {
    const locator = field(rich ? 'rich' : 'input');
    await seed();
    await prepare(locator, { rich });
    const before = await content(locator);
    await captureReplaceable(details);
    const result = await replace(details);
    need(result.ok, `collage : ${result.kind}`);
    assert.equal(result.undoable, true, 'Annuler proposé (le texte collé est retrouvé avant le curseur)');
    need((await content(locator)) === before.replace(SELECTED, VALUE), 'sélection remplacée');
    const undone = await driver({ op: 'undo' });
    details.undo = undone;
    assert.equal(undone.ok, true, `annulation : ${undone.status} ${undone.kind ?? ''} ${undone.reason ?? ''}`);
    await sleep(200);
    assert.equal(await content(locator), before, 'texte d’origine revenu');
    return `annulé, ${undone.confirmed ? 'relu' : 'supposé'}`;
  });
}

scenario('lecture-seule', 'Champ en lecture seule : rien n’est écrit', async details => {
  const locator = field('readonly');
  await prepare(locator);
  const before = await content(locator);
  const result = await capture(details);
  assert.notEqual(result.ok && result.replaceable, true, 'capture non remplaçable');
  await refusedUnchanged(details, locator, before);
  return `capture ${result.ok ? `${result.origin}, non remplaçable` : result.kind}; collage refusé (${details.replace.kind})`;
});

scenario('mot-de-passe', 'Champ mot de passe : ni lu, ni copié, ni écrit', async details => {
  const locator = field('password');
  await seed();
  await prepare(locator, { text: 'secret 🔒 mot', selected: 'secret 🔒 mot' });
  const result = await capture(details, { expect: 'secret 🔒 mot' });
  assert.equal(result.ok, false, 'capture refusée');
  assert.equal(result.kind, 'protected_field', 'refus « champ protégé »');
  assert.equal(result.clipboardMoved, false, 'aucune copie tentée');
  const clip = await driver({ op: 'clipboard-state', text: SEED });
  assert.ok(clip.textMatches && clip.benchFormat, 'presse-papiers intact');
  return 'refusé avant toute copie';
});

scenario('cible-changee-champ', 'Cible changée entre capture et collage : un autre champ a le focus', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  await field('other').focus();
  await sleep(200);
  await refusedUnchanged(details, locator, before);
  return `refusé (${details.replace.kind}, ${details.replace.reason})`;
});

scenario('cible-changee-fenetre', 'Cible changée entre capture et collage : une autre fenêtre devant', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.setContent('<title>Autre fenêtre du banc</title><textarea autofocus>autre</textarea>');
    const front = await driver({ op: 'focus', title: 'Autre fenêtre du banc' });
    need(front.ok, 'autre fenêtre au premier plan');
    const result = await replace(details);
    assert.equal(result.ok, false, 'remplacement refusé');
  } finally {
    await other.close();
  }
  assert.equal(await content(locator), before, 'texte inchangé');
  return `refusé (${details.replace.kind}, ${details.replace.reason})`;
});

scenario('selection-deplacee', 'Sélection modifiée entre-temps : un autre texte sélectionné', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  await select(locator, 0, 5);
  await sleep(150);
  await refusedUnchanged(details, locator, before);
  return `refusé (${details.replace.reason})`;
});

scenario('selection-reduite-au-curseur', 'Sélection modifiée entre-temps : réduite au curseur', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  await select(locator, 3, 3);
  await sleep(150);
  await refusedUnchanged(details, locator, before);
  return `refusé (${details.replace.reason})`;
});

scenario('selection-meme-texte-ailleurs', 'Sélection modifiée entre-temps : le même texte, une autre occurrence', async details => {
  const locator = field('textarea');
  const text = `${SELECTED} au début\n\n\n${SELECTED} plus bas`;
  await prepare(locator, { text, occurrence: 1 });
  const before = await content(locator);
  await captureReplaceable(details);
  await select(locator, 0, SELECTED.length);
  await sleep(150);
  await refusedUnchanged(details, locator, before);
  return `refusé (${details.replace.reason})`;
});

scenario('presse-papiers-reecrit-pendant-collage', 'Presse-papiers réécrit par une autre application pendant le collage : la copie la plus récente gagne', async details => {
  const locator = field('input');
  await seed();
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  const result = await replace(details, VALUE, { race: true });
  assert.equal(result.ok, true, `collage : ${result.kind}`);
  assert.equal(result.raced, true, 'l’autre application a copié pendant que notre texte était au presse-papiers');
  assert.equal(await content(locator), before.replace(SELECTED, VALUE));
  const clip = await driver({ op: 'clipboard-state', text: SEED });
  details.clipboard = clip;
  assert.equal(clip.newerCopy, true, 'la copie plus récente reste au presse-papiers');
  return 'collé, copie plus récente conservée';
});

scenario('collage-bloque-par-la-page', 'Collage bloqué par la page (handler paste qui annule) : aucune fausse réussite', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  await locator.evaluate(el => el.addEventListener('paste', event => event.preventDefault(), { once: true }));
  await refusedUnchanged(details, locator, before);
  return `refusé (${details.replace.kind}, ${details.replace.reason})`;
});

scenario('collage-bloque-resultat-deja-present', 'NATIVE-010 : collage bloqué alors que le champ contient déjà le résultat ailleurs', async details => {
  const locator = field('input');
  await prepare(locator, { text: `${VALUE} — ${ORIGINAL}` });
  const before = await content(locator);
  await captureReplaceable(details);
  await locator.evaluate(el => el.addEventListener('paste', event => event.preventDefault(), { once: true }));
  const result = await replace(details);
  need((await content(locator)) === before, 'texte inchangé (la page a bloqué le collage)');
  assert.equal(result.ok, false, `aucune réussite annoncée pour un champ inchangé (obtenu : ok, ${result.confirmed ? 'confirmed=true' : 'supposé'})`);
  return `refusé (${result.kind})`;
});

scenario('uia-muette-revalidation', 'NATIVE-001 : UI Automation ne répond plus au moment du collage', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  // La sélection change pendant l'inférence, et le fournisseur UIA ne répond plus (panne injectée).
  await select(locator, 0, 5);
  await sleep(150);
  await driver({ op: 'uia-silent', silent: true });
  let result;
  try {
    result = await replace(details);
  } finally {
    await driver({ op: 'uia-silent', silent: false });
  }
  const after = await content(locator);
  details.after = after;
  assert.equal(result.ok, false, `remplacement refusé faute de revalidation (obtenu : ok, ${result.confirmed ? 'relu' : 'supposé'} ; texte devenu « ${after} »)`);
  assert.equal(after, before, 'texte inchangé');
  return `refusé (${result.kind})`;
});

scenario('presse-papiers-non-conservable-collage', 'NATIVE-004 : presse-papiers non conservable (texte + image Office) au moment du collage', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  await seed('unkeepable', UNKEEPABLE);
  const result = await replace(details);
  const clip = await driver({ op: 'clipboard-state', text: UNKEEPABLE });
  details.clipboard = clip;
  const after = await content(locator);
  assert.ok(clip.textMatches && clip.metafile, `presse-papiers rendu entier (texte ${clip.textMatches ? 'rendu' : 'perdu'}, image ${clip.metafile ? 'rendue' : 'perdue'})`);
  assert.equal(result.ok, false, 'rien n’est écrit tant que le presse-papiers ne peut pas être conservé');
  assert.equal(after, before, 'texte inchangé');
  return `refusé (${result.kind}), presse-papiers intact`;
});

scenario('presse-papiers-non-conservable-copie', 'NATIVE-004 : presse-papiers non conservable au moment de la copie synthétique', async details => {
  const locator = field('input');
  await prepare(locator);
  await seed('unkeepable', UNKEEPABLE);
  const result = await capture(details, { copy: true });
  const clip = await driver({ op: 'clipboard-state', text: UNKEEPABLE });
  details.clipboard = clip;
  assert.ok(clip.textMatches && clip.metafile, `presse-papiers rendu entier (texte ${clip.textMatches ? 'rendu' : 'perdu'}, image ${clip.metafile ? 'rendue' : 'perdue'})`);
  assert.notEqual(result.ok && result.replaceable, true, 'pas de copie synthétique remplaçable sur un presse-papiers non conservable');
  return `capture ${result.ok ? 'acceptée' : `refusée (${result.kind})`}, presse-papiers intact`;
});

// L'écrivain autonome (NATIVE-003) : une autre application (une fenêtre du pilote, jamais celle de la
// source) écrit le presse-papiers pendant la copie synthétique, ou juste après son attente, alors que
// la source n'a rien copié (curseur sans sélection). Son texte n'est jamais pris pour la sélection,
// et sa copie, plus récente, n'est jamais écrasée par la restauration.
for (const [id, delayMs, when] of [
  ['ecrivain-autonome-pendant-copie', 120, 'pendant l’attente de la copie synthétique'],
  ['ecrivain-autonome-tardif', 700, 'juste après l’attente de la copie (copie tardive surveillée)'],
]) {
  scenario(id, `NATIVE-003 : une autre application écrit le presse-papiers ${when}, rien de sélectionné`, async details => {
    const locator = field('input');
    await seed();
    await prepare(locator, { selected: '' });
    const result = await capture(details, { copy: true, expect: WRITER, writer: { text: WRITER, delayMs } });
    await sleep(2600);
    const clip = await driver({ op: 'clipboard-state', text: WRITER });
    details.clipboard = clip;
    need(clip.ok, 'presse-papiers lisible');
    assert.ok(!(result.ok && result.matches), `le texte d’une autre application n’est jamais pris pour la sélection (capture ${result.ok ? `${result.origin}, ${result.replaceable ? 'remplaçable' : 'non remplaçable'}` : `refusée ${result.kind} ${result.reason ?? ''}`})`);
    assert.ok(clip.textMatches && clip.benchFormat, `la copie de l’autre application reste au presse-papiers (il contient ${clip.textLength} caractères${clip.textLength === [...SEED].length ? ' : l’ancien presse-papiers, remis par-dessus' : ''})`);
    return `capture ${result.ok ? 'acceptée sans le texte étranger' : `refusée (${result.kind}, ${result.reason})`}, copie étrangère conservée`;
  });
}

scenario('sendinput-partiel-copie', 'NATIVE-007 : SendInput coupé pendant la copie synthétique (panne injectée)', async details => {
  const locator = field('input');
  await seed();
  await prepare(locator);
  const result = await driver({ op: 'copy-partial', taken: 2 });
  details.copy = result;
  details.clipboard = await driver({ op: 'clipboard-state', text: SEED });
  need(!result.ok, 'capture refusée');
  assert.deepEqual(result.held, [], `touches relâchées (encore enfoncées : ${result.held.join(', ')})`);
  return `refusée (${result.reason}), touches relâchées`;
});

scenario('sendinput-partiel-copie-presse-papiers', 'SendInput coupé pendant la copie synthétique : le presse-papiers de l’utilisateur revient', async details => {
  const locator = field('input');
  await seed();
  await prepare(locator);
  const result = await driver({ op: 'copy-partial', taken: 2 });
  details.copy = result;
  await sleep(500);
  const clip = await driver({ op: 'clipboard-state', text: SEED });
  details.clipboard = clip;
  assert.ok(clip.textMatches && clip.benchFormat, `presse-papiers de l’utilisateur rendu (il contient maintenant ${clip.textLength} caractères${clip.textLength === [...SELECTED].length ? ' : la sélection, copiée par la moitié de raccourci partie' : ''})`);
  return 'presse-papiers rendu';
});

scenario('sendinput-partiel-collage', 'SendInput coupé pendant le collage (panne injectée) : touches relâchées, rien d’écrit', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  const result = await driver({ op: 'paste-partial', value: VALUE, taken: 1 });
  details.paste = result;
  assert.equal(result.ok, false, 'collage refusé');
  assert.deepEqual(result.held, [], `touches relâchées (encore enfoncées : ${result.held.join(', ')})`);
  assert.equal(await content(locator), before, 'texte inchangé');
  return `refusé (${result.reason}), touches relâchées`;
});

scenario('fermeture-urgence-collage-engage', 'NATIVE-006 : fermeture d’urgence pendant un collage engagé, UIA ralentie (panne injectée)', async details => {
  const locator = field('input');
  await prepare(locator);
  const before = await content(locator);
  await captureReplaceable(details);
  const result = await driver({ op: 'close-during-paste', value: VALUE, stallMs: 1500, closeAfterMs: 300 });
  details.close = result;
  const after = await content(locator);
  details.after = after;
  assert.equal(after, before, `aucune écriture après la demande de fermeture (fermeture demandée à ${result.closeRequestedMs} ms, faite à ${result.closeDoneMs} ms ; le collage a rendu la main à ${result.pasteReturnedMs} ms, ${result.ok ? 'réussi' : result.kind} ; texte devenu « ${after} »)`);
  return `rien d’écrit après la fermeture (${result.kind ?? 'ok'})`;
});

scenario('selection-multiple-uia-simulee', 'NATIVE-012 : sélection en plusieurs plages, fournisseur UIA simulé (deux plages)', async details => {
  const result = await driver({ op: 'multi-range-sim' });
  details.sim = result;
  need(result.single, 'une plage unique reste acceptée');
  assert.equal(result.multipleRefused, true, 'deux plages : sélection refusée (aujourd’hui la première est prise pour le tout)');
  return 'refusée';
});

scenario('vscode-ligne-sans-selection', 'NATIVE-002 : VS Code, curseur sur une ligne SANS sélection, capture par copie puis collage', async details => {
  if (!codePath) throw new Skip('VS Code introuvable (FLOWTRANSLATE_BENCH_VSCODE)');
  const profile = join(scratch, 'vscode');
  await mkdir(join(profile, 'User'), { recursive: true });
  await writeFile(join(profile, 'User', 'settings.json'), JSON.stringify({
    'workbench.startupEditor': 'none', 'security.workspace.trust.enabled': false, 'telemetry.telemetryLevel': 'off',
    'update.mode': 'none', 'files.autoSave': 'off', 'chat.disableAIFeatures': true,
  }));
  const original = 'première ligne\nseconde ligne à garder\ntroisième ligne\n';
  const file = join(scratch, 'vsbench.txt');
  await writeFile(file, original, 'utf8');
  const pid = launch(codePath, ['--user-data-dir', profile, '--extensions-dir', join(scratch, 'vscode-ext'), '--disable-extensions',
    '--new-window', '-g', `${file}:2:8`]);
  try {
    const front = await driver({ op: 'focus', title: 'vsbench.txt' });
    need(front.ok, 'VS Code au premier plan');
    await sleep(1500);
    await driver({ op: 'keys', keys: 'esc' });
    await sleep(500);
    details.uia = await driver({ op: 'uia-selection' });
    await seed();
    const captured = await capture(details, { expect: 'seconde ligne à garder\n' });
    let result = null;
    if (captured.ok && captured.replaceable) {
      result = await replace(details, 'RÉSULTAT');
      await driver({ op: 'keys', keys: 'ctrl+s' });
      await sleep(1000);
    }
    const now = await readFile(file, 'utf8');
    const line = now.split('\n')[1];
    details.file = now;
    const what = now === original ? 'fichier inchangé'
      : line === 'RÉSULTAT' ? 'ligne remplacée'
      : now.split('seconde ligne à garder').length > 2 ? 'ligne dupliquée'
      : `résultat inséré au curseur, ligne devenue « ${line} »`;
    details.observed = what;
    assert.equal(now, original, `aucune écriture sans preuve de sélection (capture ${captured.route ?? captured.kind}${captured.matches ? ' = ligne entière' : ''}, ${captured.replaceable ? 'remplaçable' : 'non remplaçable'} ; collage ${result ? (result.ok ? 'annoncé réussi' : `refusé ${result.kind}`) : 'non tenté'} ; ${what})`);
    return `capture ${captured.ok ? (captured.replaceable ? 'remplaçable' : 'Copier seulement') : captured.kind}, fichier inchangé`;
  } finally {
    kill(pid);
  }
});

// Témoin de NATIVE-002 : avec une vraie sélection, VS Code est remplacé exactement, ou bien la capture
// est « Copier seulement » ; jamais une autre écriture.
scenario('vscode-selection-reelle', 'VS Code, une vraie sélection dans une ligne : remplacée exactement, ou Copier seulement', async details => {
  if (!codePath) throw new Skip('VS Code introuvable (FLOWTRANSLATE_BENCH_VSCODE)');
  const profile = join(scratch, 'vscode-sel');
  await mkdir(join(profile, 'User'), { recursive: true });
  await writeFile(join(profile, 'User', 'settings.json'), JSON.stringify({
    'workbench.startupEditor': 'none', 'security.workspace.trust.enabled': false, 'telemetry.telemetryLevel': 'off',
    'update.mode': 'none', 'files.autoSave': 'off', 'chat.disableAIFeatures': true,
  }));
  const original = 'première ligne\nseconde ligne à garder\ntroisième ligne\n';
  const file = join(scratch, 'vssel.txt');
  await writeFile(file, original, 'utf8');
  const pid = launch(codePath, ['--user-data-dir', profile, '--extensions-dir', join(scratch, 'vscode-ext'), '--disable-extensions',
    '--new-window', '-g', `${file}:2:9`]);
  try {
    const front = await driver({ op: 'focus', title: 'vssel.txt' });
    need(front.ok, 'VS Code au premier plan');
    await sleep(1500);
    await driver({ op: 'keys', keys: 'esc' });
    await driver({ op: 'keys', keys: 'shift+end' });
    await sleep(500);
    details.uia = await driver({ op: 'uia-selection' });
    await seed();
    const captured = await capture(details, { expect: 'ligne à garder' });
    need(captured.ok && captured.matches, `capture de la sélection (${captured.kind ?? captured.selectedLength})`);
    let result = null;
    if (captured.replaceable) {
      result = await replace(details, 'RÉSULTAT');
      await driver({ op: 'keys', keys: 'ctrl+s' });
      await sleep(1000);
    }
    const now = await readFile(file, 'utf8');
    details.file = now;
    const replaced = original.replace('ligne à garder', 'RÉSULTAT');
    assert.ok([original, replaced].includes(now), `remplacée exactement ou intacte (fichier devenu « ${now.split('\n')[1]} »)`);
    if (result?.ok) assert.equal(now, replaced, 'collage annoncé réussi : la sélection est remplacée');
    return `${captured.route ?? 'aucune route'}, ${captured.replaceable ? (result?.ok ? `remplacée (${result.confirmed ? 'relu' : 'supposé'})` : `collage refusé ${result?.kind}`) : 'Copier seulement'}`;
  } finally {
    kill(pid);
  }
});

// Writer n'expose ici ni arbre UI Automation ni caret système : aucune coordonnée fiable des mots
// pour un Ctrl+glisser. La sélection multiple est faite au clavier (Maj+F8, mode Ajout), et la
// capture passe par la copie synthétique.
scenario('writer-selection-multiple', 'NATIVE-012 : LibreOffice Writer, sélection multiple (deux plages, mode Ajout), capture par copie puis collage', async details => {
  if (!sofficePath) throw new Skip('LibreOffice introuvable (FLOWTRANSLATE_BENCH_SOFFICE)');
  const document = join(scratch, 'lobench.fodt');
  const paragraphs = ['alpha premier bloc omega', 'gamma second bloc delta'];
  await writeFile(document, `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
 <office:body><office:text>${paragraphs.map(p => `<text:p>${p}</text:p>`).join('')}</office:text></office:body>
</office:document>`, 'utf8');
  const profile = `file:///${join(scratch, 'lo-profile').replace(/\\/g, '/')}`;
  const pid = launch(sofficePath, [`-env:UserInstallation=${profile}`, '--norestore', '--nologo', '--nofirststartwizard', '--writer', document]);
  const read = async () => [...(await readFile(document, 'utf8')).matchAll(/<text:p[^>]*>(.*?)<\/text:p>/gs)]
    .map(m => m[1].replace(/<[^>]+>/g, ''));
  try {
    const front = await driver({ op: 'focus', title: 'lobench.fodt' });
    need(front.ok, 'Writer au premier plan');
    await sleep(1500);
    // « alpha » puis, en mode Ajout (Maj+F8), « delta » : deux plages disjointes.
    for (const keys of ['ctrl+home', 'ctrl+shift+right', 'shift+f8', 'ctrl+end', 'ctrl+shift+left']) await driver({ op: 'keys', keys });
    await sleep(400);
    details.uia = await driver({ op: 'uia-selection' });
    await seed();
    const captured = await capture(details, { expect: 'alpha delta' });
    let result = null;
    if (captured.ok && captured.replaceable) {
      result = await replace(details, 'RÉSULTAT');
      await driver({ op: 'keys', keys: 'ctrl+s' });
      await sleep(1500);
    }
    const now = await read();
    details.document = now;
    const uia = details.uia.ok ? `UIA voit ${details.uia.ranges} plage(s)` : 'UIA ne voit pas la sélection (pas de TextPattern)';
    assert.deepEqual(now, paragraphs, `sélection multiple jamais remplacée comme une seule (${uia} ; capture ${captured.route ?? captured.kind} de ${captured.selectedLength ?? 0} caractères pour « alpha » + « delta » sélectionnés, ${captured.replaceable ? 'remplaçable' : 'non remplaçable'} ; collage ${result ? (result.ok ? 'annoncé réussi' : `refusé ${result.kind}`) : 'non tenté'} ; document devenu « ${now.join(' ¶ ')} »)`);
    return 'refusée, document inchangé';
  } finally {
    kill(pid);
  }
});

// ---------------------------------------------------------------- exécution
const results = [];
let exitCode = 0;
try {
  await startDriver();
  assert.equal((await driver({ op: 'ping' })).ok, true);
  // Edge quitte parfois dès son premier lancement (mise à jour en attente) : un second essai.
  const edge = () => chromium.launch({ channel: 'msedge', headless: false, args: ['--force-renderer-accessibility', '--no-first-run', '--no-default-browser-check'] });
  browser = await edge().catch(async error => {
    console.error(`Edge n'a pas démarré (${error.message.split('\n')[0]}) : second essai.`);
    await sleep(3000);
    return edge();
  });
  page = await (await browser.newContext()).newPage();
  await page.setContent(PAGE);
  await page.evaluate(() => {
    document.querySelector('#shadow').attachShadow({ mode: 'open' }).innerHTML = '<textarea id="shadow-input" aria-label="ombre"></textarea>';
    document.addEventListener('input', event => { event.target.dataset.nativeInput = event.inputType ?? 'input'; });
  });
  console.log(`Banc de remplacement réel — Edge ${browser.version()}, VS Code ${codePath ? 'présent' : 'absent'}, LibreOffice ${sofficePath ? 'présent' : 'absent'}`);
  for (const { id, title, run } of scenarios) {
    if (only && !only.includes(id)) continue;
    const risk = EXPECTED_FAIL[id];
    const details = {};
    let status;
    let note;
    try {
      note = await run(details);
      status = risk ? 'XPASS' : 'PASS';
    } catch (error) {
      if (error instanceof Skip) { status = 'SKIP'; note = error.message; }
      else if (error instanceof Setup || !(error instanceof assert.AssertionError)) {
        status = 'FAIL';
        note = `${error instanceof Setup ? 'précondition non remplie' : 'erreur du banc'} : ${error.message.split('\n')[0]}`;
      } else { status = risk ? 'XFAIL' : 'FAIL'; note = error.message.split('\n')[0]; }
    } finally {
      await driver({ op: 'release-keys' }).catch(() => {});
      await driver({ op: 'uia-silent', silent: false }).catch(() => {});
    }
    const label = { PASS: 'PASS ', FAIL: 'FAIL ', XFAIL: 'XFAIL', XPASS: 'XPASS', SKIP: 'SKIP ' }[status];
    const tag = risk ? `[${risk}${status === 'XFAIL' ? ', attendu en échec' : status === 'XPASS' ? ', corrigé ? retirer de EXPECTED_FAIL' : ''}] ` : '';
    console.log(`${label} ${id} — ${tag}${title}\n       ${note}`);
    results.push({ id, title, risk: risk ?? null, status, note, details });
  }
  const count = status => results.filter(r => r.status === status).length;
  console.log(`\nBilan : ${count('PASS')} PASS, ${count('XFAIL')} XFAIL (risques ouverts, attendus), ${count('FAIL')} FAIL, ${count('XPASS')} XPASS, ${count('SKIP')} SKIP`);
  if (count('FAIL') || count('XPASS')) exitCode = 1;
} catch (error) {
  console.error(`Banc interrompu : ${error.stack ?? error}`);
  if (driverErrors) console.error(driverErrors);
  exitCode = 1;
} finally {
  launched.forEach(kill);
  if (browser) await browser.close().catch(() => {});
  await stopDriver();
  if (reportPath) await writeFile(resolve(reportPath), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
process.exit(exitCode);
