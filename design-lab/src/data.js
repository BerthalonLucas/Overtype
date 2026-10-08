// Mock data for the lab: actions, the e-mail's paragraphs with canned outputs per action,
// errors, and presets for motion and material. Nothing here reaches a model.
import { fromDampingRatio, toAppleDurationBounce } from './motion.js';

export const ACTIONS = [
  { id: 'fix', key: 'F', icon: 'fix', en: 'Fix grammar', fr: 'Corriger', shortEn: 'Fix', shortFr: 'Corriger' },
  { id: 'translate', key: 'T', icon: 'translate', en: 'Translate', fr: 'Traduire', shortEn: 'Translate', shortFr: 'Traduire' },
  { id: 'pro', key: 'P', icon: 'professional', en: 'Make professional', fr: 'Rendre professionnel', shortEn: 'Pro', shortFr: 'Pro' },
  { id: 'shorten', key: 'S', icon: 'shorten', en: 'Shorten', fr: 'Raccourcir', shortEn: 'Shorten', shortFr: 'Raccourcir' },
  { id: 'email', key: 'E', icon: 'email', en: 'Write email', fr: 'Rédiger un mail', shortEn: 'Email', shortFr: 'Mail' },
  { id: 'custom', key: '␣', icon: 'custom', en: 'Custom…', fr: 'Consigne…', shortEn: 'Ask', shortFr: 'Consigne' },
];
export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
export const label = (a, lang, short = false) => short ? (lang === 'fr' ? a.shortFr : a.shortEn) : (lang === 'fr' ? a.fr : a.en);

export const UI = {
  en: { describe: 'Describe your change…', orType: 'or type an instruction', undo: 'Undo', done: 'Done', apply: 'Apply', next: 'Next', working: 'Working', retry: 'Try again', copy: 'Copy', settings: 'Open settings', revert: 'Revert', original: 'Original', more: 'More', casual: 'casual', formal: 'formal', short: 'shorter', long: 'longer', modifiers: 'Add', fixIt: 'Fix it' },
  fr: { describe: 'Décrivez la modification…', orType: 'ou tapez une consigne', undo: 'Annuler', done: 'Terminé', apply: 'Appliquer', next: 'Suivant', working: 'En cours', retry: 'Réessayer', copy: 'Copier', settings: 'Ouvrir les réglages', revert: 'Rétablir', original: 'Original', more: 'Plus', casual: 'familier', formal: 'soutenu', short: 'plus court', long: 'plus long', modifiers: 'Ajouter', fixIt: 'Corriger' },
};

// The e-mail. Each paragraph has canned outputs (translate goes FR↔EN automatically).
export const PARAGRAPHS = [
  { id: 'p1', lang: 'en', text: 'Hi Claire, thanks for you notes on the draft, I has read them all yesterday evening.',
    out: {
      fix: 'Hi Claire, thanks for your notes on the draft; I read them all yesterday evening.',
      translate: 'Bonjour Claire, merci pour tes remarques sur le brouillon ; je les ai toutes lues hier soir.',
      pro: 'Hello Claire, thank you for your comments on the draft. I reviewed all of them yesterday evening.',
      shorten: 'Hi Claire, thanks for your notes — I read them all last night.',
      email: 'Hi Claire,\n\nThank you for your notes on the draft. I went through all of them yesterday evening.\n\nBest,\nLucas',
      custom: 'Hey Claire! Thanks a lot for the notes on the draft — I went through every one of them last night.',
    } },
  { id: 'p2', lang: 'fr', text: 'reunion demain 10h avec l\'equipe infra pour parler du budget gpu, prevoir les chiffres du trimestre et la liste des serveurs',
    out: {
      fix: 'Réunion demain à 10 h avec l’équipe infra pour parler du budget GPU ; prévoir les chiffres du trimestre et la liste des serveurs.',
      translate: 'Meeting tomorrow at 10 a.m. with the infrastructure team about the GPU budget; bring the quarter’s figures and the server list.',
      pro: 'Une réunion est prévue demain à 10 h avec l’équipe Infrastructure afin d’aborder le budget GPU. Merci de préparer les chiffres du trimestre ainsi que la liste des serveurs.',
      shorten: 'Demain 10 h : budget GPU avec l’infra (chiffres du trimestre + liste des serveurs).',
      email: 'Bonjour à tous,\n\nJe vous propose une réunion demain à 10 h avec l’équipe infra pour faire le point sur le budget GPU. Pensez à apporter les chiffres du trimestre et la liste des serveurs.\n\nMerci,\nLucas',
      custom: 'Petit point demain à 10 h avec l’équipe infra sur le budget GPU 🙂 Si vous pouvez, ramenez les chiffres du trimestre et la liste des serveurs !',
    } },
  { id: 'p3', lang: 'en', text: 'The appendix will follow on monday, we still waiting for the final numbers from finance and i dont want to send something wrong.',
    out: {
      fix: 'The appendix will follow on Monday; we are still waiting for the final numbers from finance, and I don’t want to send anything wrong.',
      translate: 'L’annexe suivra lundi : nous attendons encore les chiffres définitifs de la finance et je ne veux rien envoyer d’inexact.',
      pro: 'The appendix will follow on Monday. We are still awaiting the final figures from Finance and would prefer not to share anything inaccurate.',
      shorten: 'Appendix on Monday — still waiting on final numbers from finance.',
      email: 'Hi team,\n\nA quick heads-up: the appendix will follow on Monday. We are still waiting for the final numbers from finance, and I would rather not send anything inaccurate.\n\nThanks for your patience,\nLucas',
      custom: 'The appendix is coming Monday! We’re just waiting on finance’s final numbers — better right than rushed.',
    } },
];

// Recipe (chips) and tone pad resolve to one of the canned outputs.
export function resolveAction(actionId, mods = []) {
  if (actionId === 'custom') return 'custom';
  if (mods.includes('email')) return 'email';
  if (mods.includes('translate')) return 'translate';
  if (mods.includes('short')) return 'shorten';
  if (mods.includes('pro')) return 'pro';
  if (mods.includes('casual')) return 'custom';
  return actionId;
}

// Outcomes of a run. Config errors deep-link to a settings field.
export const OUTCOMES = [
  { id: 'success', label: 'Succès' },
  { id: 'endpoint', label: 'Serveur injoignable', kind: 'config', field: 'endpoint', short: { en: 'Can’t reach the server', fr: 'Serveur injoignable' }, detail: { en: 'Nothing answered at http://localhost:8003/v1. Check the address or start the server.', fr: 'Rien ne répond à http://localhost:8003/v1. Vérifiez l’adresse ou démarrez le serveur.' }, action: { en: 'Open endpoint', fr: 'Voir l’adresse' }, fieldError: 'Aucune réponse (connexion refusée).' },
  { id: 'key', label: 'Clé API refusée (401/403)', kind: 'config', field: 'key', short: { en: 'API key rejected', fr: 'Clé API refusée' }, detail: { en: 'The server answered 401 Unauthorized. The key may be wrong or expired.', fr: 'Le serveur a répondu 401 (non autorisé). La clé est peut-être fausse ou expirée.' }, action: { en: 'Fix key', fr: 'Corriger la clé' }, fieldError: '401 Unauthorized.' },
  { id: 'model', label: 'Modèle introuvable (404)', kind: 'config', field: 'model', short: { en: 'Model not found: gemma-4-12b', fr: 'Modèle introuvable : gemma-4-12b' }, detail: { en: 'The server has no model named “gemma-4-12b”. Pick one from the list it returns.', fr: 'Le serveur n’a pas de modèle « gemma-4-12b ». Choisissez-en un dans sa liste.' }, action: { en: 'Choose model', fr: 'Choisir le modèle' }, fieldError: '404 : modèle inconnu du serveur.' },
  { id: 'busy', label: 'Serveur occupé (503, transitoire)', kind: 'transient', short: { en: 'Server busy — try again', fr: 'Serveur occupé, réessayez' }, detail: { en: 'The server is overloaded (503). Nothing to change on your side.', fr: 'Le serveur est surchargé (503). Rien à changer de votre côté.' }, action: { en: 'Try again', fr: 'Réessayer' } },
  { id: 'paste', label: 'Collage refusé par l’app', kind: 'paste', short: { en: 'Can’t edit this app’s text', fr: 'Impossible de modifier ce texte' }, detail: { en: 'This window refused the paste. The result is ready to copy.', fr: 'Cette fenêtre a refusé le collage. Le résultat est prêt à copier.' }, action: { en: 'Copy result', fr: 'Copier le résultat' } },
  { id: 'changed', label: 'Sélection modifiée entre-temps', kind: 'paste', short: { en: 'Text changed — not replaced', fr: 'Texte modifié, rien remplacé' }, detail: { en: 'The selection changed while the model worked, so nothing was replaced.', fr: 'La sélection a changé pendant le travail : rien n’a été remplacé.' }, action: { en: 'Copy result', fr: 'Copier le résultat' } },
  { id: 'long', label: 'Sélection trop longue', kind: 'content', short: { en: 'Selection too long (max 200,000 characters)', fr: 'Sélection trop longue (200 000 caractères max)' }, detail: { en: 'Select less text or split it in parts.', fr: 'Sélectionnez moins de texte ou découpez-le.' } },
];
export const OUTCOME_BY_ID = Object.fromEntries(OUTCOMES.map(o => [o.id, o]));

// ——— Motion presets (Apple springs are duration + bounce; see research) ———
const m3 = (zeta, k) => { const a = toAppleDurationBounce(fromDampingRatio(zeta, k)); return { type: 'spring', duration: +a.duration.toFixed(3), bounce: +a.bounce.toFixed(3) }; };
export const MOTION_PRESETS = {
  'apple-snappy': { label: 'Apple « snappy »', desc: 'Ressort vif avec un soupçon de rebond (SwiftUI .snappy).', enter: { type: 'spring', duration: 0.3, bounce: 0.15 }, morph: { type: 'spring', duration: 0.35, bounce: 0.15 }, exit: { type: 'curve', curve: 'emil-out', ms: 140 }, content: { type: 'curve', curve: 'emil-out', ms: 160 }, fromScale: 0.96, travel: 4, stagger: 18 },
  'apple-smooth': { label: 'Apple « smooth »', desc: 'Aucun rebond, arrivée très douce (SwiftUI .smooth).', enter: { type: 'spring', duration: 0.4, bounce: 0 }, morph: { type: 'spring', duration: 0.45, bounce: 0 }, exit: { type: 'curve', curve: 'emil-out', ms: 170 }, content: { type: 'curve', curve: 'emil-out', ms: 200 }, fromScale: 0.97, travel: 4, stagger: 22 },
  'apple-bouncy': { label: 'Apple « bouncy »', desc: 'Rebond visible (SwiftUI .bouncy). Joueur.', enter: { type: 'spring', duration: 0.4, bounce: 0.3 }, morph: { type: 'spring', duration: 0.45, bounce: 0.3 }, exit: { type: 'curve', curve: 'emil-out', ms: 150 }, content: { type: 'curve', curve: 'emil-out', ms: 180 }, fromScale: 0.94, travel: 6, stagger: 24 },
  'fluent': { label: 'Windows 11 (Fluent)', desc: 'Courbes officielles : entrée « Fast In » 167 ms, déplacement « Point to Point » 250 ms, sortie « Soft Out ».', enter: { type: 'curve', curve: 'fluent-in', ms: 167 }, morph: { type: 'curve', curve: 'fluent-p2p', ms: 250 }, exit: { type: 'curve', curve: 'fluent-out', ms: 167 }, content: { type: 'curve', curve: 'fluent-in', ms: 167 }, fromScale: 0.96, travel: 8, stagger: 20 },
  'm3': { label: 'Material 3 Expressive', desc: 'Ressorts « expressive » de Google (ζ 0,8, raideur 380).', enter: m3(0.8, 380), morph: m3(0.6, 800), exit: { type: 'curve', curve: 'm3-standard', ms: 150 }, content: { type: 'curve', curve: 'm3-decel', ms: 200 }, fromScale: 0.92, travel: 6, stagger: 24 },
  'emil': { label: 'Vif (Emil Kowalski)', desc: 'Courbes « sortie douce » courtes, sortie plus rapide que l’entrée.', enter: { type: 'curve', curve: 'emil-out', ms: 180 }, morph: { type: 'spring', duration: 0.3, bounce: 0.08 }, exit: { type: 'curve', curve: 'emil-out', ms: 120 }, content: { type: 'curve', curve: 'emil-out', ms: 150 }, fromScale: 0.95, travel: 4, stagger: 16 },
  'soft': { label: 'Lent et mou (à éviter)', desc: 'Pour sentir la différence : tout traîne.', enter: { type: 'curve', curve: 'ease', ms: 600 }, morph: { type: 'curve', curve: 'ease', ms: 700 }, exit: { type: 'curve', curve: 'ease', ms: 500 }, content: { type: 'curve', curve: 'ease', ms: 450 }, fromScale: 0.9, travel: 12, stagger: 40 },
  'none': { label: 'Aucune animation (Raycast)', desc: 'Tout apparaît net. Pour comparer avec « l’app actuelle sans effets ».', enter: { type: 'curve', curve: 'linear', ms: 1 }, morph: { type: 'curve', curve: 'linear', ms: 1 }, exit: { type: 'curve', curve: 'linear', ms: 1 }, content: { type: 'curve', curve: 'linear', ms: 1 }, fromScale: 1, travel: 0, stagger: 0 },
};

// ——— Material presets ———
export const MATERIAL_PRESETS = {
  'apple-light': { label: 'Verre Apple clair', desc: 'Valeurs lues sur apple.com : fond blanc translucide, flou 20 px, saturation 180 %.', dark: false, bgAlpha: 0.72, blur: 22, saturate: 180, hairline: 0.08, rim: 0.85, shadow: 0.12, shadowY: 8, shadowBlur: 26, radius: 16, noise: 0, tint: 250, sheen: 0.35, liquid: false },
  'frost': { label: 'Verre dépoli', desc: 'Plus transparent, plus flou.', dark: false, bgAlpha: 0.5, blur: 36, saturate: 150, hairline: 0.1, rim: 0.7, shadow: 0.14, shadowY: 10, shadowBlur: 30, radius: 16, noise: 0.05, tint: 252, sheen: 0.5, liquid: false },
  'liquid': { label: 'Verre liquide (expérimental)', desc: 'Réfraction façon Liquid Glass (filtre SVG, Chromium seulement). Dans l’app, demanderait une capture de l’écran.', dark: false, bgAlpha: 0.18, blur: 2, saturate: 150, hairline: 0.1, rim: 0.9, shadow: 0.16, shadowY: 8, shadowBlur: 24, radius: 16, noise: 0, tint: 255, sheen: 0.4, liquid: true },
  'opaque-light': { label: 'Clair sans transparence', desc: 'Ce qui marche partout, sans Acrylic : fond blanc presque opaque, reflets peints.', dark: false, bgAlpha: 0.94, blur: 0, saturate: 100, hairline: 0.09, rim: 0.9, shadow: 0.13, shadowY: 8, shadowBlur: 26, radius: 16, noise: 0, tint: 252, sheen: 0.25, liquid: false },
  'acrylic': { label: 'Acrylic Windows (simulation)', desc: 'Ce que donnerait le vrai verre de Windows : grain, teinte, et coins imposés à 8 px.', dark: false, bgAlpha: 0.6, blur: 30, saturate: 125, hairline: 0.07, rim: 0.4, shadow: 0.2, shadowY: 8, shadowBlur: 22, radius: 8, noise: 0.06, tint: 243, sheen: 0, liquid: false, lockRadius: true },
  'dark-glass': { label: 'Verre sombre', desc: 'Même recette en sombre.', dark: true, bgAlpha: 0.62, blur: 24, saturate: 170, hairline: 0.14, rim: 0.12, shadow: 0.3, shadowY: 10, shadowBlur: 30, radius: 16, noise: 0, tint: 28, sheen: 0.08, liquid: false },
  'graphite': { label: 'Graphite actuel (0.4.0)', desc: 'L’app aujourd’hui : aplat gris presque opaque, contour blanc à 20 %.', dark: true, bgAlpha: 0.96, blur: 0, saturate: 100, hairline: 0.2, rim: 0, shadow: 0.34, shadowY: 12, shadowBlur: 32, radius: 16, noise: 0, tint: 26, sheen: 0, liquid: false, legacy: true },
};

export function materialVars(m) {
  const t = m.tint;
  const bg = m.dark ? `rgb(${t} ${t + 2} ${t + 6} / ${m.bgAlpha})` : `linear-gradient(180deg, rgb(${t} ${t} ${Math.min(255, t + 2)} / ${Math.min(1, m.bgAlpha + 0.08)}), rgb(${t} ${t} ${Math.min(255, t + 2)} / ${m.bgAlpha}))`;
  const border = m.legacy ? `0 0 0 1px rgb(255 255 255 / ${m.hairline})` : m.dark ? `0 0 0 .5px rgb(255 255 255 / ${m.hairline})` : `0 0 0 .5px rgb(0 0 0 / ${m.hairline})`;
  const rim = m.dark ? `inset 0 1px 0 rgb(255 255 255 / ${m.rim}), ${border}` : `inset 0 1px 0 rgb(255 255 255 / ${m.rim}), inset 0 -1px 0 rgb(0 0 0 / .04), ${border}`;
  const shadow = `0 ${m.shadowY}px ${m.shadowBlur}px rgb(0 0 0 / ${m.shadow}), 0 1px 3px rgb(0 0 0 / ${m.shadow * 0.6})`;
  const backdrop = m.liquid ? `url(#ft-liquid) blur(${m.blur}px) saturate(${m.saturate}%) brightness(1.04)` : m.blur > 0 ? `blur(${m.blur}px) saturate(${m.saturate}%)` : 'none';
  const sheen = m.sheen > 0 ? `linear-gradient(135deg, rgb(255 255 255 / ${m.sheen}), rgb(255 255 255 / ${m.sheen * 0.15}) 30%, transparent 60%)` : 'none';
  return { '--s-bg': bg, '--s-rim': rim, '--s-shadow': shadow, '--s-backdrop': backdrop, '--s-sheen': sheen, '--s-noise': m.noise };
}

// ——— Mock rewriting of an arbitrary range (word-precise selection) ———
const FIXES = [
  [/\byou notes\b/g, 'your notes'], [/draft, I has read/g, 'draft; I read'], [/\bI has read\b/g, 'I read'], [/\bhas read\b/g, 'read'],
  [/\breunion\b/g, 'réunion'], [/\b10h\b/g, '10 h'], [/l'equipe/g, 'l’équipe'], [/\bgpu\b/g, 'GPU'], [/gpu,/g, 'GPU ;'], [/\bprevoir\b/g, 'prévoir'],
  [/\bmonday, we\b/g, 'Monday; we'], [/\bmonday\b/g, 'Monday'], [/\bwe still waiting\b/g, 'we are still waiting'], [/\bi dont\b/g, 'I don’t'], [/\bdont\b/g, 'don’t'], [/\bsomething wrong\b/g, 'anything wrong'],
];
const words = t => (t.match(/\S+/g) || []).length;
// The canned output when the whole paragraph is selected; otherwise a plausible slice of it
// (Fix uses a small correction list, so any range gets a real correction).
export function mockRewrite(pid, fullText, start, end, outId) {
  const para = PARAGRAPHS.find(p => p.id === pid);
  const piece = fullText.slice(start, end);
  const lead = piece.match(/^\s*/)[0], trail = piece.match(/\s*$/)[0];
  const core = piece.trim();
  const out = para.out[outId];
  const whole = fullText === para.text && core.length >= para.text.trim().length * 0.95;
  if (whole || outId === 'email') return lead + out + trail;
  if (outId === 'fix') {
    let r = core;
    for (const [re, to] of FIXES) r = r.replace(re, to);
    if (start === 0) r = r.charAt(0).toUpperCase() + r.slice(1);
    return lead + r + trail;
  }
  const total = Math.max(1, words(fullText)), a0 = words(fullText.slice(0, start)), b0 = words(fullText.slice(0, end));
  const ow = out.split(/\s+/);
  const a = Math.min(ow.length - 1, Math.round(a0 / total * ow.length));
  const b = Math.max(a + 1, Math.round(b0 / total * ow.length));
  return lead + ow.slice(a, b).join(' ') + trail;
}

// ——— Defaults (Lucas, 24 septembre : Îlot, Perle, Lucide, verre clair / sombre, Apple smooth, balayage de lumière + pilule, mots changés visibles pendant l’annulation) ———
export const DEFAULTS = {
  lang: 'en',
  iconSet: 'lucide',
  showIcons: true,
  showKeys: true,
  trigger: 'shortcut',
  shortcut: 'ctrl-alt-space',
  menu: 'ilot',
  anchor: 'below',
  rememberLast: true,
  loader: 'perle',
  loaderParams: {},
  placement: 'both',
  textFx: 'sweep',
  textFxParams: {},
  keepSelection: false,
  loaderDelay: 250,
  slowLabel: 'none',
  latency: 1400,
  hold: false,
  outcome: 'success',
  replaceFx: 'fade',
  replaceParams: { stagger: 22, blur: 6, dur: 320 },
  diff: 'undo',
  diffHold: 600,
  diffFade: 1200,
  check: true,
  undo: true,
  undoSeconds: 8,
  errorStyle: 'pill',
  motionPreset: 'apple-smooth',
  motion: MOTION_PRESETS['apple-smooth'],
  theme: 'system',
  materialLightPreset: 'apple-light',
  materialLight: MATERIAL_PRESETS['apple-light'],
  materialDarkPreset: 'dark-glass',
  materialDark: MATERIAL_PRESETS['dark-glass'],
  wall: 'bloom',
};
