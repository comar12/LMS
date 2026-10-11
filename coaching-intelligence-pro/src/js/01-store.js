/* ==========================================================================
   01-store: local storage, application state, sanitizers
   ========================================================================== */

const STORAGE_PREFIX = 'cip.v1.';
const STATE_KEYS = ['settings', 'prefs', 'favorites', 'custom', 'overrides', 'builder', 'combos', 'drafts'];

const store = (() => {
  let ok = false;
  const memory = new Map();
  try {
    const probe = STORAGE_PREFIX + '__probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    ok = true;
  } catch (e) {
    ok = false;
  }
  let warned = false;
  return {
    get ok() {
      return ok;
    },
    get(key, fallback) {
      try {
        const raw = ok ? window.localStorage.getItem(STORAGE_PREFIX + key) : memory.get(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      memory.set(key, raw);
      if (!ok) return false;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, raw);
        return true;
      } catch (e) {
        if (!warned) {
          warned = true;
          setTimeout(() => toast('Browser storage is full or blocked. Export a backup from Settings & Data.', { type: 'error', duration: 6000 }), 0);
        }
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      if (!ok) return;
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + key);
      } catch (e) {
        /* ignore */
      }
    },
    usage() {
      if (!ok) return 0;
      let chars = 0;
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) chars += k.length + (window.localStorage.getItem(k) || '').length;
        }
      } catch (e) {
        return 0;
      }
      return chars * 2;
    },
  };
})();

/* ---------- Defaults ---------- */
const DEFAULT_SETTINGS = Object.freeze({ duration: 14, calls: 5, followup: 7 });
const DEFAULT_FULLCOPY = Object.freeze({ strengths: true, feedback: true, impact: true, plan: true, followup: true, example: true, questions: false });

function defaultPrefs() {
  return { theme: 'system', layout: 'grid', sort: 'relevance', kpi: '', sGroup: '', fullCopy: { ...DEFAULT_FULLCOPY }, refOpen: { hold: true, sales: true } };
}
function emptyEdits() {
  return { progress: null, challenges: null, plan: null, followup: null };
}
function defaultBuilder() {
  return {
    opps: [],
    strengths: [],
    tone: 'balanced',
    scope: 'single',
    notes: { progress: '', evidence: '', includeEvidence: true, private: '' },
    edited: emptyEdits(),
    base: emptyEdits(),
    draftId: null,
  };
}

const state = {
  settings: { ...DEFAULT_SETTINGS },
  prefs: defaultPrefs(),
  favorites: new Set(),
  custom: { opps: [], strengths: [] },
  overrides: { opps: {}, strengths: {} },
  builder: defaultBuilder(),
  combos: [],
  drafts: [],
  ui: { view: 'all', cat: null, query: '', openId: null, sVersion: {}, visibleIds: [], returnFocusKey: null },
};

/* ---------- Sanitizers (used for storage and imports; never trust stored data) ---------- */
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const isId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{1,79}$/.test(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function strList(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => x.slice(0, maxLen).trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeSettings(o) {
  const src = o && typeof o === 'object' ? o : {};
  const s = {
    duration: clampInt(src.duration, 3, 60, DEFAULT_SETTINGS.duration),
    calls: clampInt(src.calls, 2, 20, DEFAULT_SETTINGS.calls),
    followup: clampInt(src.followup, 1, 60, DEFAULT_SETTINGS.followup),
  };
  if (s.followup > s.duration) s.followup = s.duration;
  return s;
}

function sanitizePrefs(o) {
  const src = o && typeof o === 'object' ? o : {};
  const p = defaultPrefs();
  if (['system', 'light', 'dark'].includes(src.theme)) p.theme = src.theme;
  if (['grid', 'list'].includes(src.layout)) p.layout = src.layout;
  if (['relevance', 'az', 'category'].includes(src.sort)) p.sort = src.sort;
  if (typeof src.kpi === 'string' && (src.kpi === '' || KPI_MAP[src.kpi])) p.kpi = src.kpi;
  if (typeof src.sGroup === 'string' && (src.sGroup === '' || S_GROUP_MAP[src.sGroup])) p.sGroup = src.sGroup;
  if (src.fullCopy && typeof src.fullCopy === 'object') {
    for (const k of Object.keys(DEFAULT_FULLCOPY)) if (typeof src.fullCopy[k] === 'boolean') p.fullCopy[k] = src.fullCopy[k];
  }
  if (src.refOpen && typeof src.refOpen === 'object') {
    for (const k of ['hold', 'sales']) if (typeof src.refOpen[k] === 'boolean') p.refOpen[k] = src.refOpen[k];
  }
  return p;
}

function sanitizeExample(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const line of v.slice(0, 6)) {
    if (typeof line === 'string' && line.trim()) out.push({ say: line.trim().slice(0, 1200) });
    else if (line && typeof line === 'object' && typeof line.say === 'string' && line.say.trim()) {
      const item = { say: line.say.trim().slice(0, 1200) };
      if (typeof line.label === 'string' && line.label.trim()) item.label = line.label.trim().slice(0, 60);
      out.push(item);
    }
  }
  return out;
}

function sanitizeFragments(v) {
  const src = v && typeof v === 'object' ? v : {};
  const b = {};
  for (const k of ['obs', 'focus', 'commit', 'm', 'mx', 'coach']) {
    const s = str(src[k], 500).trim();
    if (s) b[k] = s;
  }
  return b;
}

function sanitizeOppFields(o) {
  const src = o && typeof o === 'object' ? o : {};
  const cat = CAT_MAP[src.cat] ? src.cat : 'com';
  const theme = THEMES[src.theme] ? src.theme : CAT_DEFAULT_THEME[cat];
  return {
    title: str(src.title, 120).trim(),
    cat,
    theme,
    desc: str(src.desc, 300).trim(),
    kw: strList(src.kw, 40, 60).map((k) => k.toLowerCase()),
    tags: strList(src.tags, 4, 30),
    kpi: strList(src.kpi, 3, 12).filter((k) => KPI_MAP[k]),
    feedback: str(src.feedback, 3000).trim(),
    impact: str(src.impact, 2500).trim(),
    plan: str(src.plan, 3000).trim(),
    followup: str(src.followup, 2500).trim(),
    example: sanitizeExample(src.example),
    questions: strList(src.questions, 6, 400),
    strengths: strList(src.strengths, 12, 80).filter(isId),
    note: str(src.note, 600).trim(),
    b: sanitizeFragments(src.b),
  };
}

function sanitizeCustomOpp(o) {
  if (!o || typeof o !== 'object') return null;
  const f = sanitizeOppFields(o);
  if (!f.title || !f.feedback) return null;
  const id = isId(o.id) && o.id.startsWith('custom-') ? o.id : uid('custom');
  return { id, ...f, created: num(o.created) || Date.now(), updated: num(o.updated) || Date.now() };
}

function sanitizeStrengthFields(o) {
  const src = o && typeof o === 'object' ? o : {};
  return {
    title: str(src.title, 120).trim(),
    group: S_GROUP_MAP[src.group] ? src.group : 'com',
    desc: str(src.desc, 300).trim(),
    kw: strList(src.kw, 30, 60).map((k) => k.toLowerCase()),
    v: strList(src.v, 4, 1500),
  };
}

function sanitizeCustomStrength(o) {
  if (!o || typeof o !== 'object') return null;
  const f = sanitizeStrengthFields(o);
  if (!f.title || !f.v.length) return null;
  const id = isId(o.id) && o.id.startsWith('cs-') ? o.id : uid('cs');
  return { id, ...f, created: num(o.created) || Date.now(), updated: num(o.updated) || Date.now() };
}

const BUILTIN_OPP_IDS = new Set(DATA.opps.map((o) => o.id));
const BUILTIN_STRENGTH_IDS = new Set(DATA.strengths.map((s) => s.id));

function sanitizeOverrides(o) {
  const src = o && typeof o === 'object' ? o : {};
  const out = { opps: {}, strengths: {} };
  if (src.opps && typeof src.opps === 'object') {
    for (const id of Object.keys(src.opps)) {
      if (!BUILTIN_OPP_IDS.has(id)) continue;
      const f = sanitizeOppFields(src.opps[id]);
      if (f.title && f.feedback) out.opps[id] = { ...f, updated: num(src.opps[id] && src.opps[id].updated) || Date.now() };
    }
  }
  if (src.strengths && typeof src.strengths === 'object') {
    for (const id of Object.keys(src.strengths)) {
      if (!BUILTIN_STRENGTH_IDS.has(id)) continue;
      const f = sanitizeStrengthFields(src.strengths[id]);
      if (f.title && f.v.length) out.strengths[id] = { ...f, updated: num(src.strengths[id] && src.strengths[id].updated) || Date.now() };
    }
  }
  return out;
}

function sanitizeStrengthSelection(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v.slice(0, 600)) {
    const id = item && typeof item === 'object' ? item.id : item;
    if (!isId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, v: clampInt(item && item.v, 0, 3, 0) });
  }
  return out;
}

function sanitizeEdits(v) {
  const out = emptyEdits();
  if (v && typeof v === 'object') {
    for (const k of Object.keys(out)) if (typeof v[k] === 'string') out[k] = v[k].slice(0, 12000);
  }
  return out;
}

function sanitizeBuilder(o) {
  const src = o && typeof o === 'object' ? o : {};
  const b = defaultBuilder();
  b.opps = [...new Set(strList(src.opps, 600, 80).filter(isId))];
  b.strengths = sanitizeStrengthSelection(src.strengths);
  if (['supportive', 'balanced', 'direct'].includes(src.tone)) b.tone = src.tone;
  if (['single', 'multiple'].includes(src.scope)) b.scope = src.scope;
  const n = src.notes && typeof src.notes === 'object' ? src.notes : {};
  b.notes = {
    progress: str(n.progress, 4000),
    evidence: str(n.evidence, 4000),
    includeEvidence: typeof n.includeEvidence === 'boolean' ? n.includeEvidence : true,
    private: str(n.private, 4000),
  };
  b.edited = sanitizeEdits(src.edited);
  b.base = sanitizeEdits(src.base);
  b.draftId = isId(src.draftId) ? src.draftId : null;
  return b;
}

function sanitizeCombos(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const c of v.slice(0, 200)) {
    if (!c || typeof c !== 'object') continue;
    const name = str(c.name, 80).trim();
    if (!name) continue;
    out.push({
      id: isId(c.id) ? c.id : uid('combo'),
      name,
      opps: [...new Set(strList(c.opps, 600, 80).filter(isId))],
      strengths: sanitizeStrengthSelection(c.strengths),
      tone: ['supportive', 'balanced', 'direct'].includes(c.tone) ? c.tone : 'balanced',
      scope: ['single', 'multiple'].includes(c.scope) ? c.scope : 'single',
      settings: sanitizeSettings(c.settings),
      created: num(c.created) || Date.now(),
    });
  }
  return out;
}

function sanitizeDrafts(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const d of v.slice(0, 200)) {
    if (!d || typeof d !== 'object') continue;
    const name = str(d.name, 80).trim();
    if (!name) continue;
    out.push({
      id: isId(d.id) ? d.id : uid('draft'),
      name,
      builder: sanitizeBuilder(d.builder),
      settings: sanitizeSettings(d.settings),
      saved: num(d.saved) || Date.now(),
    });
  }
  return out;
}

function sanitizeCustom(v) {
  const src = v && typeof v === 'object' ? v : {};
  const opps = [];
  const seen = new Set();
  for (const o of Array.isArray(src.opps) ? src.opps.slice(0, 500) : []) {
    const clean = sanitizeCustomOpp(o);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      opps.push(clean);
    }
  }
  const strengths = [];
  for (const s of Array.isArray(src.strengths) ? src.strengths.slice(0, 500) : []) {
    const clean = sanitizeCustomStrength(s);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      strengths.push(clean);
    }
  }
  return { opps, strengths };
}

/* ---------- Load & persist ---------- */
function loadSlice(key) {
  switch (key) {
    case 'settings': state.settings = sanitizeSettings(store.get('settings', null)); break;
    case 'prefs': state.prefs = sanitizePrefs(store.get('prefs', null)); break;
    case 'favorites': state.favorites = new Set(strList(store.get('favorites', []), 1000, 80).filter(isId)); break;
    case 'custom': state.custom = sanitizeCustom(store.get('custom', null)); break;
    case 'overrides': state.overrides = sanitizeOverrides(store.get('overrides', null)); break;
    case 'builder': state.builder = sanitizeBuilder(store.get('builder', null)); break;
    case 'combos': state.combos = sanitizeCombos(store.get('combos', [])); break;
    case 'drafts': state.drafts = sanitizeDrafts(store.get('drafts', [])); break;
    default: break;
  }
}

function loadState() {
  STATE_KEYS.forEach(loadSlice);
}

function serialize(key) {
  if (key === 'favorites') return [...state.favorites];
  return state[key];
}

function persist(...keys) {
  for (const k of keys) store.set(k, serialize(k));
}

const persistBuilderSoon = debounce(() => persist('builder'), 300);
