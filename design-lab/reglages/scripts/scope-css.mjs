// Scopes a compiled stylesheet under one class (default .heroui-scope).
// 1. lightningcss flattens nesting (targets Chrome 110) so every style rule has a plain prelude;
// 2. a small walker rewrites each selector of each style rule:
//    - :root / html / body → the scope element itself;
//    - a leading theme marker ([data-theme…], .dark, .light, [data-vibrant-palette…]) is merged
//      into the scope element (the HeroUI theme is set on the scope, not on <html>);
//    - :host rules (shadow DOM only) are dropped;
//    - anything else gets the scope as ancestor.
//    Keyframes, @property and @font-face stay global (Tailwind names; ours all start with ft-).
// (lightningcss' own visitor cannot round-trip HeroUI's CSS: "expected Specifier", 4.3.3.)
import { transform } from 'lightningcss';

const BS = String.fromCharCode(92);
const NO_SELECTOR_AT = /^@(keyframes|-webkit-keyframes|property|font-face|counter-style|page)\b/;

function splitTopLevel(text, sep) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of text) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// First compound: up to the first top-level combinator (space, >, +, ~).
function firstCompound(sel) {
  let depth = 0, q = null;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) return [sel.slice(0, i), sel.slice(i)];
  }
  return [sel, ''];
}

const THEME_MARKER = /^(?:\[data-theme(?:[~|^$*]?=[^\]]*)?\]|\[data-vibrant-palette(?:=[^\]]*)?\]|\.dark|\.light|:not\((?:[^()]|\([^()]*\))*\))+$/;

export function scopeSelector(sel, scope) {
  sel = sel.trim();
  if (!sel) return null;
  const [first, rest] = firstCompound(sel);
  if (/^:host\b/.test(first)) return null;
  const rootRe = /^(?::root|html|body)(?![\w-])/;
  if (rootRe.test(first)) return scope + first.replace(rootRe, '') + rest;
  if (THEME_MARKER.test(first) && !/^:not/.test(first)) return scope + first + rest;
  return `${scope} ${sel}`;
}

function rewrite(css, scope) {
  let out = '', i = 0;
  const stack = []; // 'style' | 'at-group' | 'no-selector'
  while (i < css.length) {
    // comments
    if (css.startsWith('/*', i)) { const j = css.indexOf('*/', i + 2); out += css.slice(i, j + 2); i = j + 2; continue; }
    const top = stack[stack.length - 1];
    if (top === 'style' || top === 'no-selector-body' ) {
      // inside declarations: copy until matching close brace (declarations have no braces here
      // except in nested blocks, which lightningcss has flattened)
      let depth = 0, q = null, j = i;
      for (; j < css.length; j++) {
        const ch = css[j];
        if (q) { if (ch === BS) { j++; continue; } if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { if (depth === 0) break; depth--; }
      }
      out += css.slice(i, j + 1); i = j + 1; stack.pop(); continue;
    }
    if (top === 'no-selector') {
      // @keyframes body: copy verbatim until its matching brace
      let depth = 0, j = i;
      for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}') { if (depth === 0) break; depth--; } }
      out += css.slice(i, j + 1); i = j + 1; stack.pop(); continue;
    }
    const ch = css[i];
    if (/\s/.test(ch)) { out += ch; i++; continue; }
    if (ch === '}') { out += ch; i++; stack.pop(); continue; }
    // read a prelude up to { or ; at depth 0
    let depth = 0, q = null, j = i;
    for (; j < css.length; j++) {
      const c = css[j];
      if (q) { if (c === BS) { j++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth === 0 && (c === '{' || c === ';')) break;
    }
    const prelude = css.slice(i, j);
    if (css[j] === ';') { out += prelude + ';'; i = j + 1; continue; } // @import, @layer a, b;
    if (prelude.startsWith('@')) {
      out += prelude + '{'; i = j + 1;
      stack.push(NO_SELECTOR_AT.test(prelude) ? 'no-selector' : 'at-group');
      continue;
    }
    const sels = splitTopLevel(prelude, ',').map(s => scopeSelector(s, scope)).filter(Boolean);
    if (!sels.length) {
      // drop the whole rule
      let d = 0, k = j + 1;
      for (; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}') { if (d === 0) break; d--; } }
      i = k + 1; continue;
    }
    out += sels.join(', ') + ' {'; i = j + 1; stack.push('style');
  }
  return out;
}

export function scopeCss(code, cls = 'heroui-scope', { minify = true } = {}) {
  const flat = transform({ filename: 'in.css', code: Buffer.from(code), minify: false, targets: { chrome: 110 << 16 }, errorRecovery: true }).code.toString();
  const scoped = rewrite(flat, '.' + cls);
  if (!minify) return scoped;
  return transform({ filename: 'scoped.css', code: Buffer.from(scoped), minify: true, targets: { chrome: 110 << 16 }, errorRecovery: true }).code.toString();
}
