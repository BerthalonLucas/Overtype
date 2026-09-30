// « Copier mes choix »: a readable summary + JSON, and a clipboard write that works inside the
// claude.ai artifact frame (write only from a click handler; fallback: execCommand; last
// resort: the caller shows the text in a dialog to copy by hand).
import { DIRECTION_BY_ID, PALETTE_BY_ID, THEMES, SPEEDS } from '../tokens/index.js';
import { SECTIONS } from './store.jsx';
import { SCENARIO_BY_ID } from '../mock/server.js';

const sectionName = id => SECTIONS.find(s => s.id === id)?.short
  || ({ journey: 'Parcours', parcours: 'Parcours', settings: 'Réglages', reglages: 'Réglages', demo: 'Démo', catalog: 'Composants', composants: 'Composants', effects: 'Effets', effets: 'Effets', shell: 'Labo' })[id] || id;

export function buildChoices(lab) {
  const now = new Date();
  const stamp = now.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const theme = THEMES.find(t => t.id === lab.theme)?.name ?? lab.theme;
  const speed = SPEEDS.find(s => s.id === lab.speed)?.name ?? `${lab.speed}`;
  const votes = Object.entries(lab.votes).map(([id, v]) => ({ id, ...v, note: lab.notes[id] || '' }));
  const ups = votes.filter(v => v.v === 'up');
  const downs = votes.filter(v => v.v === 'down');
  const orphanNotes = Object.entries(lab.notes).filter(([id]) => id !== '_general' && !lab.votes[id]);
  const line = v => `- [${sectionName(v.section)}] ${v.label}${v.note ? ` — « ${v.note.trim()} »` : ''}`;

  const text = [
    `Labo Réglages — mes choix (${stamp})`,
    '',
    `Réglage en cours : direction ${DIRECTION_BY_ID[lab.direction]?.name}, palette ${PALETTE_BY_ID[lab.palette]?.name}, thème ${theme}, vitesse ${speed}, mouvement réduit ${lab.reduced ? 'oui' : 'non'}, scénario serveur « ${SCENARIO_BY_ID[lab.scenario]?.label ?? lab.scenario} ».`,
    '',
    `👍 J’aime (${ups.length})`,
    ...(ups.length ? ups.map(line) : ['- (rien encore)']),
    '',
    `👎 Je n’aime pas (${downs.length})`,
    ...(downs.length ? downs.map(line) : ['- (rien encore)']),
    ...(orphanNotes.length ? ['', 'Autres remarques', ...orphanNotes.map(([id, n]) => `- ${id} : « ${n.trim()} »`)] : []),
    ...(lab.notes._general ? ['', 'Notes', lab.notes._general.trim()] : []),
  ].join('\n');

  const json = {
    date: now.toISOString(),
    current: { direction: lab.direction, palette: lab.palette, theme: lab.theme, speed: lab.speed, reducedMotion: !!lab.reduced, scenario: lab.scenario, section: lab.section },
    likes: ups.map(({ id, label, section, note }) => ({ id, label, section, note: note || undefined })),
    dislikes: downs.map(({ id, label, section, note }) => ({ id, label, section, note: note || undefined })),
    notes: lab.notes,
  };
  return `${text}\n\nJSON\n${JSON.stringify(json, null, 2)}\n`;
}

// Returns true when the text reached the clipboard. Call it from a click handler.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* permission refused in the frame: fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
