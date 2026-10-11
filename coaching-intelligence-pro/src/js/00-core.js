/* ==========================================================================
   00-core: constants, DOM helpers, text helpers
   ========================================================================== */

const APP_VERSION = '1.0.0';
const META = DATA.meta;
const GUIDES = DATA.guides;
const CATS = META.categories;
const CAT_MAP = Object.fromEntries(CATS.map((c) => [c.id, c]));
const CAT_ICON = { com: 'chat', dis: 'compass', hold: 'pause', own: 'shield', tech: 'router', bill: 'receipt', sales: 'trend' };
const CAT_DESC = {
  com: 'Empathy, acknowledgement, tone, listening, and call structure.',
  dis: 'Asking the right questions before acting on the concern.',
  hold: 'Hold etiquette, mute, dead air, research time, and call control.',
  own: 'Owning the concern through resolution, transfers, follow-up, and expectations.',
  tech: 'Troubleshooting accuracy, ITG use, tools, scheduling, and process knowledge.',
  bill: 'Accurate billing explanations, credits, payments, and customer education.',
  sales: 'Needs-based offers, transitions, objections, pricing disclosure, and retention.',
};
const CAT_DEFAULT_THEME = { com: 'connect', dis: 'discover', hold: 'control', own: 'own', tech: 'tech', bill: 'billing', sales: 'sales' };
const THEMES = META.themes;
const FALLBACK_THEME = {
  label: 'Additional Focus',
  lead: 'You also {list}.',
  plan: 'You will also {list}.',
  impact: 'affect the overall customer experience',
};
const KPIS = META.kpis;
const KPI_MAP = Object.fromEntries(KPIS.map((k) => [k.id, k]));
const S_GROUPS = META.strengthGroups;
const S_GROUP_MAP = Object.fromEntries(S_GROUPS.map((g) => [g.id, g]));
const OPPOSITES = META.opposites || {};
const BUILDER_FIELDS = [
  { key: 'progress', title: 'What Progress Has Been Made Since Last Coaching Session?' },
  { key: 'challenges', title: 'What Challenges or Obstacles Has the Teammate Experienced?' },
  { key: 'plan', title: 'Action Plan: What Actions Will the Teammate Commit to After This Conversation?' },
  { key: 'followup', title: 'Supervisor Follow-Up Plan' },
];
const DURATION_OPTIONS = [7, 10, 14, 21, 28, 30];

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
}
deepFreeze(DATA);

/* ---------- DOM ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function append(el, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) append(el, kid);
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }
  return el;
}

/** Create an element. Strings are always inserted as text, never parsed as HTML. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  if (props) {
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (v == null || v === false) continue;
      if (key === 'class') el.className = v;
      else if (key === 'text') el.textContent = v;
      else if (key === 'value') value = v;
      else if (key === 'checked') el.checked = !!v;
      else if (key === 'dataset') Object.assign(el.dataset, v);
      else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2), v);
      else if (v === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(v));
    }
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

function icon(name, cls) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVGNS, 'use');
  setUseHref(use, '#i-' + name);
  svg.appendChild(use);
  return svg;
}
function setUseHref(use, href) {
  use.setAttribute('href', href);
  use.setAttributeNS(XLINK, 'xlink:href', href);
}
function setIcon(svg, name) {
  const use = svg && svg.querySelector('use');
  if (use) setUseHref(use, '#i-' + name);
}

function logoSvg() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'brand__mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const rect = document.createElementNS(SVGNS, 'rect');
  rect.setAttribute('width', '32'); rect.setAttribute('height', '32'); rect.setAttribute('rx', '9'); rect.setAttribute('fill', '#34C3B5'); rect.setAttribute('class', 'logo-bg');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', 'M20.6 11.2a6.6 6.6 0 1 0 0 9.6');
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#0B1630'); path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('class', 'logo-fg');
  const dot = document.createElementNS(SVGNS, 'circle');
  dot.setAttribute('cx', '23'); dot.setAttribute('cy', '16'); dot.setAttribute('r', '2.1'); dot.setAttribute('fill', '#0B1630'); dot.setAttribute('class', 'logo-dot');
  svg.append(rect, path, dot);
  return svg;
}

/** Focus an element that may still be finishing a visibility transition; retries for a few frames. */
function focusSoon(el, tries = 12) {
  if (!el || !el.isConnected) return;
  el.focus({ preventScroll: true });
  if (document.activeElement === el || tries <= 0) return;
  requestAnimationFrame(() => focusSoon(el, tries - 1));
}

function cssEscape(value) {
  if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}

function focusableIn(root) {
  return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => !el.closest('[hidden]') && !el.closest('[inert]') && el.getClientRects().length > 0);
}

/* ---------- Text ---------- */
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numWord = (n) => (Number.isInteger(n) && n >= 0 && n <= 10 ? NUM_WORDS[n] : String(n));
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function durationPhrase(days) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? 'one week' : numWord(weeks) + ' weeks';
  }
  return numWord(days) + ' days';
}
function durationAdj(days) {
  return days % 7 === 0 ? numWord(days / 7) + '-week' : numWord(days) + '-day';
}
function durationTitle(days) {
  return durationAdj(days).split('-').map(capFirst).join('-');
}
function followupPhrase(days) {
  return days === 1 ? 'one day' : numWord(days) + ' days';
}
function durationOptionLabel(days) {
  return days % 7 === 0 ? `${days} days (${durationPhrase(days)})` : `${days} days`;
}

function tokenValues(settings) {
  const s = settings || state.settings;
  return {
    duration: durationPhrase(s.duration),
    durationAdj: durationAdj(s.duration),
    calls: numWord(s.calls),
    followup: followupPhrase(s.followup),
  };
}

/** Replace {duration}, {durationAdj}, {calls}, {followup}; capitalize when a token starts a sentence. */
function fillTokens(text, settings) {
  const tv = tokenValues(settings);
  return String(text || '').replace(/\{(duration|durationAdj|calls|followup)\}/g, (m, key, offset, whole) => {
    const before = whole.slice(0, offset);
    const startsSentence = offset === 0 || /[.?!]\s+$/.test(before) || /\n\s*$/.test(before);
    return startsSentence ? capFirst(tv[key]) : tv[key];
  });
}

/** Oxford-comma list; switches to semicolons when items already contain commas. */
function joinList(items, conj = 'and') {
  const list = items.filter(Boolean).map((s) => String(s).trim());
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return list[0].includes(',') ? `${list[0]}, ${conj} ${list[1]}` : `${list[0]} ${conj} ${list[1]}`;
  const sep = list.some((s) => s.includes(',')) ? '; ' : ', ';
  return list.slice(0, -1).join(sep) + sep + conj + ' ' + list[list.length - 1];
}

function tidySentence(s) {
  let out = String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/([.?!])\.+$/, '$1')
    .trim();
  if (!out) return '';
  out = capFirst(out);
  if (!/[.?!]$/.test(out)) out += '.';
  return out;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item) continue;
    const key = String(item).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(String(item).trim());
  }
  return out;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const PROPER_WORDS = new Set(['Xfinity', 'Comcast', 'Wi-Fi', 'VXI']);
function lowerTitle(title) {
  // "Weak Call Opening" -> "weak call opening", keeping acronyms (ITG, XM) and proper nouns.
  return String(title || '')
    .replace(/\s*\/\s*/g, ' or ')
    .split(' ')
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) || PROPER_WORDS.has(w) ? w : w.toLowerCase()))
    .join(' ');
}

const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Debounce; `flush()` runs a pending call immediately and does nothing when no call is pending. */
function debounce(fn, ms) {
  let t = null;
  let pending = false;
  let lastArgs = [];
  const wrapped = (...args) => {
    lastArgs = args;
    pending = true;
    clearTimeout(t);
    t = setTimeout(() => {
      pending = false;
      fn(...lastArgs);
    }, ms);
  };
  wrapped.flush = () => {
    if (!pending) return;
    clearTimeout(t);
    pending = false;
    fn(...lastArgs);
  };
  return wrapped;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampInt(v, min, max, dflt) {
  const n = typeof v === 'number' ? Math.round(v) : parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function fmtDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

/** Soft privacy check for user-authored text. Returns human-readable reasons. */
function piiWarnings(text) {
  const t = String(text || '');
  const out = [];
  if (!t.trim()) return out;
  if (/\b\d{6,}\b/.test(t) || /\b\d{3,}[-\s]\d{3,}[-\s]?\d{2,}\b/.test(t)) out.push('a long number (account, BPID, HRID, or other ID)');
  if (/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(t)) out.push('a phone number');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t)) out.push('an email address');
  if (/\b(bpid|hrid|avaya|employee id|interaction id|acct\.?\s*#|account\s*(?:number|#))\b/i.test(t)) out.push('an identifier label');
  if (/\b(mr|mrs|ms|miss|dr)\.?\s+[A-Z][a-z]+/.test(t)) out.push('what looks like a personal name');
  return dedupe(out);
}

function piiNote(text) {
  const reasons = piiWarnings(text);
  if (!reasons.length) return null;
  return h('p', { class: 'pii', role: 'status' }, icon('alert'), `Check for identifying information: this text contains ${joinList(reasons)}. Remove names and IDs before saving or copying.`);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}
