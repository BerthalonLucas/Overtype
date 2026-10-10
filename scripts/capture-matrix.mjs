// Real capture matrix (2026-09-14, 0.1.8): drives real applications on synthetic text and
// reads the packaged overlay through CDP to record which capture path the shortcut took
// (UIA selection, synthetic copy, fresh user copy, notice), whether the clipboard was put
// back and how long the first pixel took. No user document is opened: every application
// starts on text written by this script into a temporary profile. Launch through
// scripts/capture-matrix.ps1 (Overtype started with --simulate-inference and a CDP port).
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = process.env.FLOWTRANSLATE_CDP_URL ?? 'http://127.0.0.1:9227';
if (!['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw Error('Local test endpoint required');
const output = resolve(process.argv[2] ?? 'release/ui-evidence/capture-matrix');
await mkdir(output, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const ps = (action, extra = []) => JSON.parse(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(here, 'capture-matrix-helper.ps1'), '-Action', action, ...extra], { encoding: 'utf8' }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SENTINEL = 'FlowTranslate matrix sentinel 0.1.8';
const SENTENCE = 'The quarterly report is ready for your review.';
const scratch = await mkdtemp(join(tmpdir(), 'flowtranslate-matrix-'));

const browser = await chromium.connectOverCDP(endpoint);
const overlay = () => browser.contexts().flatMap(c => c.pages()).find(p => /tauri\.localhost/.test(p.url()) && new URL(p.url()).searchParams.get('window') === 'overlay');
await expect.poll(() => Boolean(overlay()), { timeout: 10000 }).toBe(true);
const page = overlay();
const report = { status: 'running', version: null, cases: [], notChecked: ['Word, Outlook, Teams, Edge, Slack: not installed on this workstation', 'Discord: installed but signed in to a personal account, not driven', 'real inference (--simulate-inference)'] };
report.version = await page.evaluate(() => navigator.userAgent);

// Read synchronously: a locator getAttribute would wait 30 s for a glass that is not there.
const captureId = () => page.evaluate(() => document.querySelector('.glass-overlay')?.getAttribute('data-capture-id') ?? null);
const closeGlass = async () => {
  if (!(await page.locator('.glass-overlay').count())) return;
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
};
// Presses the shortcut and waits for what the overlay shows: a glass for a new capture
// (its original text is read through the menu) or the notice pill. Latency is measured
// from the injected chord to the first DOM render, CDP polling included (upper bound).
const shoot = async (previousId) => {
  const started = performance.now();
  ps('hotkey');
  const outcome = await page.waitForFunction(previous => {
    const glass = document.querySelector('.glass-overlay');
    const id = glass?.getAttribute('data-capture-id');
    if (id && id !== previous) return { kind: 'glass', id, docked: glass.getAttribute('data-docked'), origin: glass.getAttribute('data-origin') };
    const notice = document.querySelector('.notice-pill')?.textContent;
    if (notice) return { kind: 'notice', notice };
    return null;
  }, previousId, { polling: 10, timeout: 5000 }).then(h => h.jsonValue()).catch(() => ({ kind: 'nothing' }));
  const latencyMs = Math.round(performance.now() - started);
  let original = null;
  if (outcome.kind === 'glass') {
    await expect(page.getByRole('button', { name: 'Copy translation', exact: true })).toBeEnabled({ timeout: 8000 });
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Show original', exact: true }).click();
    original = (await page.locator('.original-copy').textContent())?.replace(/^Original/, '').trim() ?? null;
  }
  return { ...outcome, latencyMs, original };
};
// Applications are looked up on this machine, never at a path tied to one workstation:
// an optional environment variable first, then the standard install locations.
const findApp = (envName, relative) => {
  const candidates = [process.env[envName], ...relative.flatMap(([base, path]) => process.env[base] ? [join(process.env[base], path)] : [])];
  return candidates.find(candidate => candidate && existsSync(candidate)) ?? null;
};
const chromePath = findApp('OVERTYPE_MATRIX_CHROME', [
  ['ProgramFiles', 'Google\\Chrome\\Application\\chrome.exe'],
  ['ProgramFiles(x86)', 'Google\\Chrome\\Application\\chrome.exe'],
  ['LOCALAPPDATA', 'Google\\Chrome\\Application\\chrome.exe'],
]);
const codePath = findApp('OVERTYPE_MATRIX_VSCODE', [
  ['LOCALAPPDATA', 'Programs\\Microsoft VS Code\\Code.exe'],
  ['ProgramFiles', 'Microsoft VS Code\\Code.exe'],
]);
const record = (entry) => { report.cases.push(entry); console.log(JSON.stringify(entry)); };

// `launch` starts the application (the launcher process may differ from the window's:
// Store Notepad, wt.exe, Code.exe), `title` finds the window that owns the text.
// `app` is the executable the case needs: null means it is not installed, the case is skipped.
const run = async (name, launch, title, prepare, expectation, app = 'built-in') => {
  if (!app) { record({ name, expectation, skipped: 'application not found (set its environment variable or install it)' }); return; }
  const entry = { name, expectation, timeline: {} };
  const mark = (step) => { entry.timeline[step] = Math.round(performance.now()); };
  let processId = 0;
  try {
    ps('setClipboard', ['-Text', SENTINEL]); mark('sentinelSet');
    await sleep(3500); // older than the freshness window: only a real copy may count
    launch(); mark('launched');
    processId = ps('find', ['-Text', title]).processId; mark('found');
    expect(processId, `${name}: window`).toBeGreaterThan(0);
    entry.foreground = ps('focus', ['-ProcessId', String(processId)]); mark('focused');
    expect(entry.foreground.focused, `${name}: foreground`).toBe(true);
    await prepare(); mark('prepared');
    const previous = await captureId();
    const shot = await shoot(previous); mark('shot');
    Object.assign(entry, shot);
    entry.clipboardAfter = ps('getClipboard').text === SENTINEL ? 'restored' : 'changed';
    entry.textMatches = shot.original === SENTENCE;
    entry.path = shot.kind === 'notice' ? 'notice' : shot.kind === 'nothing' ? 'nothing shown' : `${shot.origin} (${shot.docked === 'true' ? 'docked' : 'anchored'})`;
    await closeGlass();
  } catch (error) {
    entry.error = String(error.message ?? error);
  } finally {
    if (processId) ps('kill', ['-ProcessId', String(processId)]);
    await sleep(500);
  }
  record(entry);
};
// One command line per launch: PowerShell would otherwise read `--flags` as its own parameters.
const launch = (path, commandLine) => ps('launch', ['-Path', path, '-Arguments', ` ${commandLine}`]);

try {
  const textFile = join(scratch, 'sentence.txt');
  await writeFile(textFile, SENTENCE, 'utf8');
  // Notepad: UIA TextPattern on the focused document (the anchored path).
  await run('Notepad (UIA)', () => launch('notepad.exe', `"${textFile}"`), 'sentence\\.txt',
    async () => { await sleep(1200); ps('keys', ['-Text', '^a']); await sleep(200); }, 'uia (anchored), clipboard untouched');
  // Notepad again, nothing selected: the synthetic chord copies nothing, a copy made 1 s ago counts.
  await run('Notepad (no selection, fresh copy)', () => launch('notepad.exe', `"${textFile}"`), 'sentence\\.txt',
    async () => { await sleep(1200); ps('keys', ['-Text', '{END}']); ps('setClipboard', ['-Text', SENTENCE]); await sleep(800); }, 'fresh clipboard (docked)');
  // Chrome on a data: URL in a throwaway profile: Chromium's UIA or the synthetic copy.
  const chromeProfile = join(scratch, 'chrome');
  await run('Chrome (data: URL)', () => launch(chromePath, `--user-data-dir="${chromeProfile}" --no-first-run --no-default-browser-check --new-window "data:text/html,<title>FlowTranslateMatrix</title><p>${encodeURIComponent(SENTENCE)}</p>"`), 'FlowTranslateMatrix',
    async () => { await sleep(3000); ps('keys', ['-Text', '^a']); await sleep(300); }, 'uia or synthetic copy, clipboard restored', chromePath);
  // VS Code in a throwaway profile on the text file: Monaco has no UIA TextPattern, the synthetic copy must do.
  // Escape first: a fresh profile opens the Copilot sign-in dialog over the editor (seen 2026-09-14).
  const codeProfile = join(scratch, 'code');
  await mkdir(join(codeProfile, 'User'), { recursive: true });
  await writeFile(join(codeProfile, 'User', 'settings.json'), JSON.stringify({ 'workbench.startupEditor': 'none', 'security.workspace.trust.enabled': false, 'telemetry.telemetryLevel': 'off', 'update.mode': 'none' }), 'utf8');
  await run('VS Code', () => launch(codePath, `--user-data-dir "${codeProfile}" --extensions-dir "${join(scratch, 'ext')}" --new-window "${textFile}"`), 'sentence\\.txt',
    async () => { await sleep(2500); ps('keys', ['-Text', '{ESC}']); await sleep(600); ps('keys', ['-Text', '^a']); await sleep(300); }, 'synthetic copy (docked), clipboard restored', codePath);
  // Windows Terminal: no selection, a copy made by hand 1 s ago counts (fresh rule), then nothing after 4 s.
  await run('Windows Terminal (fresh copy < 3 s)', () => launch('wt.exe', 'cmd.exe /k title FlowTranslateMatrix'), 'FlowTranslateMatrix',
    async () => { await sleep(2500); ps('setClipboard', ['-Text', SENTENCE]); await sleep(800); }, 'fresh clipboard (docked), no synthetic effect');
  await run('Windows Terminal (copy older than 3 s)', () => launch('wt.exe', 'cmd.exe /k title FlowTranslateMatrix'), 'FlowTranslateMatrix',
    async () => { await sleep(2500); }, 'notice « Rien à traduire dans la fenêtre active. »');
  report.status = report.cases.every(c => !c.error) ? 'collecte terminée' : 'ERRORS';
  if (report.status !== 'collecte terminée') process.exitCode = 1;
} catch (error) {
  report.status = 'ERRORS';
  process.exitCode = 1;
  throw error;
} finally {
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`Capture matrix written to ${output}: ${report.status}`);
}
