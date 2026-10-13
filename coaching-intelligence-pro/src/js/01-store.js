/* ==========================================================================
   01-store: local storage, application state, sanitizers
   ========================================================================== */

const STORAGE_PREFIX = 'cip.v1.';
const STATE_KEYS = ['settings', 'prefs', 'favorites', 'custom', 'overrides', 'builder', 'combos', 'drafts', 'review', 'links', 'tracker', 'huddle', 'today', 'observe', 'calib', 'team', 'practice', 'listen', 'eod'];

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

const SALES_TAB_IDS = ['review', 'flow', 'offers', 'objections', 'signals'];
const SALES_OFFER_IDS = ['xm', 'upgrade', 'tv', 'retention'];
const PEOPLE_TAB_IDS = ['attendance', 'return', 'stay', 'signs', 'recognition'];

function defaultPrefs() {
  return {
    theme: 'system',
    layout: 'grid',
    sort: 'relevance',
    kpi: '',
    sGroup: '',
    fullCopy: { ...DEFAULT_FULLCOPY },
    refOpen: { hold: true, sales: true, people: true },
    salesTab: 'review',
    salesOffer: 'xm',
    peopleTab: 'attendance',
    trackerFilter: 'active',
    brand: null,
    hideIds: false,
    salesTarget: 10,
  };
}
/** Call reviews are kept per call type, so a Technical review and a Sales review can be in progress together. */
function defaultReview() {
  return { type: 'tech', byType: {} };
}
/** The daily routine. Defaults come from a supervisor's own list and can all be edited or removed. */
function defaultRoutines() {
  return [
    { id: 'rt-aicr', title: 'AICR scrubbing', kind: 'count', target: 4, freq: 'daily', day: 4, note: '4 calls per day', link: 'Scrubbing' },
    { id: 'rt-nps', title: 'NPS scrubbing', kind: 'check', target: 1, freq: 'daily', day: 4, note: 'Submit at least 70% of detractors', link: 'Scrubbing' },
    { id: 'rt-calib', title: 'Internal calibration form', kind: 'check', target: 1, freq: 'weekly', day: 4, note: 'Every Thursday by 9:00 PM', link: 'Calibration' },
  ];
}
function defaultToday() {
  return { routines: defaultRoutines(), progress: {} };
}
function defaultHuddle() {
  return { opp: null, strength: null, minutes: 10, history: [] };
}
/** Quick Links start from the preset built into this copy of the app (empty in the shared copy). */
function initialLinks() {
  return sanitizeLinks({ items: DATA.seedLinks || [] });
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
    style: 'points',
    nums: {},
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
  review: defaultReview(),
  links: { items: [] },
  tracker: { plans: [] },
  huddle: defaultHuddle(),
  today: defaultToday(),
  observe: { label: '', marks: {} },
  calib: { type: 'tech', a: {}, b: {} },
  team: { members: [], touches: [] },
  ui: { view: 'all', cat: null, query: '', linkQuery: '', openId: null, sVersion: {}, visibleIds: [], returnFocusKey: null },
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
    for (const k of ['hold', 'sales', 'people']) if (typeof src.refOpen[k] === 'boolean') p.refOpen[k] = src.refOpen[k];
  }
  if (SALES_TAB_IDS.includes(src.salesTab)) p.salesTab = src.salesTab;
  if (SALES_OFFER_IDS.includes(src.salesOffer)) p.salesOffer = src.salesOffer;
  if (PEOPLE_TAB_IDS.includes(src.peopleTab)) p.peopleTab = src.peopleTab;
  if (['active', 'done', 'all'].includes(src.trackerFilter)) p.trackerFilter = src.trackerFilter;
  if (typeof src.hideIds === 'boolean') p.hideIds = src.hideIds;
  if (typeof src.salesTarget === 'number' && src.salesTarget >= 0.5 && src.salesTarget <= 100) p.salesTarget = src.salesTarget;
  if (src.brand && typeof src.brand === 'object') {
    const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);
    const primary = hex(src.brand.primary);
    const sidebar = hex(src.brand.sidebar);
    if (primary && sidebar) p.brand = { primary, sidebar };
  }
  return p;
}

/** Call review marks: only known call types and steps, only met/gap/na, and coaching picks limited to that step's related entries. */
function sanitizeReview(o) {
  const src = o && typeof o === 'object' ? o : {};
  const out = defaultReview();
  // Reviews saved before call types existed were Sales reviews.
  const byType = src.byType && typeof src.byType === 'object' ? src.byType : src.marks ? { sales: { marks: src.marks, picks: src.picks } } : {};
  for (const t of REVIEW_TYPES) {
    const slot = byType[t.id] && typeof byType[t.id] === 'object' ? byType[t.id] : {};
    const marks = slot.marks && typeof slot.marks === 'object' ? slot.marks : {};
    const picks = slot.picks && typeof slot.picks === 'object' ? slot.picks : {};
    const clean = { marks: {}, picks: {} };
    for (const it of t.steps.concat(t.skills)) {
      if (['met', 'gap', 'na'].includes(marks[it.id])) clean.marks[it.id] = marks[it.id];
      if (Array.isArray(picks[it.id])) clean.picks[it.id] = picks[it.id].filter((id) => it.gaps.includes(id));
    }
    if (Object.keys(clean.marks).length) out.byType[t.id] = clean;
  }
  if (REVIEW_TYPE_IDS.includes(src.type)) out.type = src.type;
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (v) => typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(new Date(v + 'T00:00:00').getTime());

/** Follow-up plans: a label the supervisor chooses (never a name), the focus entries, the plan settings, and logged results. */
/** A plan's KPI numbers: where the agent started and the target, both typed by the supervisor. */
function sanitizePlanKpis(v) {
  const out = [];
  for (const x of Array.isArray(v) ? v.slice(0, 6) : []) {
    if (!x || typeof x !== 'object' || !KPI_MEASURE[x.k] || out.some((y) => y.k === x.k)) continue;
    const base = numOrNull(x.base);
    const target = numOrNull(x.target);
    if (base === null && target === null) continue;
    out.push({ k: x.k, base, target, unit: NUM_UNITS.includes(x.unit) ? x.unit : KPI_MEASURE[x.k].unit, asOf: isIsoDate(x.asOf) ? x.asOf : todayDay() });
  }
  return out;
}

function sanitizeTracker(o) {
  const src = o && typeof o === 'object' ? o : {};
  const plans = [];
  const seen = new Set();
  for (const p of Array.isArray(src.plans) ? src.plans.slice(0, 300) : []) {
    if (!p || typeof p !== 'object') continue;
    let id = isId(p.id) ? p.id : uid('plan');
    if (seen.has(id)) id = uid('plan');
    seen.add(id);
    const focus = [...new Set(strList(p.focus, 40, 80).filter(isId))];
    if (!focus.length) continue;
    const settings = sanitizeSettings({ duration: p.duration, calls: p.calls, followup: p.followup });
    const logs = [];
    for (const l of Array.isArray(p.logs) ? p.logs.slice(0, 200) : []) {
      if (!l || typeof l !== 'object' || !isIsoDate(l.date)) continue;
      const results = {};
      const raw = l.results && typeof l.results === 'object' ? l.results : {};
      for (const fid of focus) if (['met', 'miss', 'na'].includes(raw[fid])) results[fid] = raw[fid];
      // A numbers update carries only KPI values typed from the dashboard.
      const kv = {};
      const rawK = l.kpis && typeof l.kpis === 'object' ? l.kpis : {};
      for (const k of Object.keys(KPI_MEASURE)) if (numOrNull(rawK[k]) !== null) kv[k] = numOrNull(rawK[k]);
      const kind = l.kind === 'checkin' ? 'checkin' : l.kind === 'kpi' ? 'kpi' : 'call';
      if (kind === 'kpi' ? !Object.keys(kv).length : !Object.keys(results).length) continue;
      logs.push({ id: isId(l.id) ? l.id : uid('log'), kind, date: l.date, results: kind === 'kpi' ? {} : results, kpis: kind === 'kpi' ? kv : {}, note: str(l.note, 300).trim() });
    }
    logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    plans.push({
      id,
      label: str(p.label, 40).trim() || 'Agent',
      start: isIsoDate(p.start) ? p.start : isoDay(new Date()),
      duration: settings.duration,
      calls: settings.calls,
      followup: settings.followup,
      focus,
      status: p.status === 'done' ? 'done' : 'active',
      created: num(p.created) || Date.now(),
      kpis: sanitizePlanKpis(p.kpis),
      logs,
    });
  }
  return { plans };
}

function sanitizeHuddle(o) {
  const src = o && typeof o === 'object' ? o : {};
  const out = defaultHuddle();
  if (isId(src.opp)) out.opp = src.opp;
  if (isId(src.strength)) out.strength = src.strength;
  if ([5, 10, 15].includes(src.minutes)) out.minutes = src.minutes;
  for (const r of Array.isArray(src.history) ? src.history.slice(0, 50) : []) {
    if (r && isIsoDate(r.date) && isId(r.opp)) out.history.push({ date: r.date, opp: r.opp, minutes: [5, 10, 15].includes(r.minutes) ? r.minutes : 10 });
  }
  return out;
}

function sanitizeRoutines(v) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(v) ? v.slice(0, 40) : []) {
    if (!r || typeof r !== 'object') continue;
    const title = str(r.title, 60).trim();
    if (!title) continue;
    let id = isId(r.id) ? r.id : uid('rt');
    if (seen.has(id)) id = uid('rt');
    seen.add(id);
    const kind = r.kind === 'count' ? 'count' : 'check';
    out.push({ id, title, kind, target: kind === 'count' ? clampInt(r.target, 1, 50, 1) : 1, freq: r.freq === 'weekly' ? 'weekly' : 'daily', day: clampInt(r.day, 0, 6, 4), note: str(r.note, 120).trim(), link: str(r.link, 80).trim() });
  }
  return out;
}

function sanitizeToday(o) {
  const src = o && typeof o === 'object' ? o : {};
  const routines = Array.isArray(src.routines) ? sanitizeRoutines(src.routines) : defaultRoutines();
  const progress = {};
  const raw = src.progress && typeof src.progress === 'object' ? src.progress : {};
  // Keep only the last few weeks of ticks.
  Object.keys(raw)
    .filter(isIsoDate)
    .sort()
    .slice(-21)
    .forEach((d) => {
      const day = {};
      Object.entries(raw[d] || {}).forEach(([id, n]) => {
        if (routines.some((r) => r.id === id)) day[id] = clampInt(n, 0, 50, 0);
      });
      progress[d] = day;
    });
  return { routines, progress };
}

function sanitizeObserve(o) {
  const src = o && typeof o === 'object' ? o : {};
  const ids = (DATA.leader.observe || []).map((x) => x.id);
  const marks = {};
  Object.entries(src.marks && typeof src.marks === 'object' ? src.marks : {}).forEach(([k, v]) => {
    if (ids.includes(k) && ['met', 'gap', 'na'].includes(v)) marks[k] = v;
  });
  return { label: str(src.label, 40).trim(), marks };
}

function sanitizeCalib(o) {
  const src = o && typeof o === 'object' ? o : {};
  const type = REVIEW_TYPE_IDS.includes(src.type) ? src.type : 'tech';
  const ok = new Set(REVIEW_TYPES.find((t) => t.id === type).steps.concat(REVIEW_TYPES.find((t) => t.id === type).skills).map((x) => x.id));
  const clean = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).filter(([k, v]) => ok.has(k) && ['met', 'gap', 'na'].includes(v)));
  return { type, a: clean(src.a), b: clean(src.b) };
}

/**
 * End-of-day summary for the manager. Each date keeps its own values (the last 45 days);
 * the setup (lines switched off and extra line names) is shared by every day.
 */
const EOD_KEEP_DAYS = 45;
function defaultEod() {
  return { day: todayDay(), off: {}, lines: [], days: {} };
}
function sanitizeEodDay(d, lineIds) {
  const src = d && typeof d === 'object' ? d : {};
  const out = { v: {}, cv: {}, tomorrow: str(src.tomorrow, 1200) };
  const v = src.v && typeof src.v === 'object' ? src.v : {};
  for (const [k, x] of Object.entries(v).slice(0, 60)) if (/^[a-z]+\.[a-z]+$/.test(k) && (typeof x === 'string' || typeof x === 'number') && String(x).trim()) out.v[k] = str(String(x), 120).trim();
  const cv = src.cv && typeof src.cv === 'object' ? src.cv : {};
  for (const [k, x] of Object.entries(cv)) if (lineIds.has(k) && typeof x === 'string' && x.trim()) out.cv[k] = str(x, 160).trim();
  return out;
}
function sanitizeEod(o) {
  const src = o && typeof o === 'object' ? o : {};
  const e = defaultEod();
  const off = src.off && typeof src.off === 'object' ? src.off : {};
  for (const [k, x] of Object.entries(off).slice(0, 40)) if (/^[a-z0-9-]{1,40}$/.test(k) && x === true) e.off[k] = true;
  // Earlier versions kept one day with extra lines as {id, label, value}.
  const legacy = !src.days && Array.isArray(src.custom);
  for (const c of (legacy ? src.custom : Array.isArray(src.lines) ? src.lines : []).slice(0, 12)) {
    if (!c || typeof c !== 'object') continue;
    const label = str(c.label, 80).trim();
    if (label) e.lines.push({ id: isId(c.id) ? c.id : uid('eod'), label });
  }
  const ids = new Set(e.lines.map((l) => l.id));
  const days = legacy && isIsoDate(src.day) ? { [src.day]: { v: src.v, cv: Object.fromEntries((src.custom || []).filter((c) => c && isId(c.id)).map((c) => [c.id, c.value || ''])), tomorrow: src.tomorrow } } : src.days && typeof src.days === 'object' ? src.days : {};
  const oldest = addDays(todayDay(), -EOD_KEEP_DAYS);
  for (const [d, x] of Object.entries(days)) {
    if (!isIsoDate(d) || d < oldest || d > todayDay()) continue;
    const day = sanitizeEodDay(x, ids);
    if (Object.keys(day.v).length || Object.keys(day.cv).length || day.tomorrow.trim()) e.days[d] = day;
  }
  // The summary opens on today; another date is chosen with the date picker.
  e.day = todayDay();
  return e;
}

/** Practice Lab: the role-play in progress and a history of dates, scenarios, and scored steps. No notes are kept. */
const PRACTICE_STAGES = ['brief', 'play', 'score', 'debrief'];
function defaultPractice() {
  return { filter: 'all', current: null, history: [] };
}
function sanitizePractice(o) {
  const src = o && typeof o === 'object' ? o : {};
  const p = defaultPractice();
  const scen = Object.fromEntries(DATA.practice.scenarios.map((s) => [s.id, s]));
  if (src.filter === 'all' || REVIEW_TYPE_IDS.includes(src.filter)) p.filter = src.filter;
  const member = (v) => (isId(v) ? v : '');
  const marks = (sc, m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).filter(([k, v]) => sc.rubric.some((r) => r.step === k) && (v === 'met' || v === 'gap')));
  const c = src.current;
  if (c && typeof c === 'object' && scen[c.id]) {
    const sc = scen[c.id];
    p.current = {
      id: c.id,
      stage: PRACTICE_STAGES.includes(c.stage) ? c.stage : 'brief',
      who: c.who === 'one' ? 'one' : 'team',
      member: member(c.member),
      marks: marks(sc, c.marks),
      said: [...new Set(Array.isArray(c.said) ? c.said : [])].filter((i) => Number.isInteger(i) && i >= 0 && i < sc.lines.length),
      acc: clampInt(c.acc, 0, 4 * 3600000, 0),
      // A role-play is paused after a reload; the time so far is kept.
      runAt: 0,
      saved: c.saved === true,
    };
  }
  for (const x of Array.isArray(src.history) ? src.history.slice(-500) : []) {
    if (!x || typeof x !== 'object' || !scen[x.scenario] || !isIsoDate(x.date)) continue;
    p.history.push({ id: isId(x.id) ? x.id : uid('prx'), date: x.date, scenario: x.scenario, member: member(x.member), marks: marks(scen[x.scenario], x.marks), secs: clampInt(x.secs, 0, 4 * 3600, 0) });
  }
  return p;
}

/** Live Listen: one call at a time. Moments are a time, a review step, good or a miss, and an optional short note. */
const LISTEN_KINDS = ['good', 'gap', 'note'];
function defaultListen() {
  return { type: 'tech', member: '', acc: 0, runAt: 0, marks: [] };
}
function sanitizeListen(o) {
  const src = o && typeof o === 'object' ? o : {};
  const l = defaultListen();
  if (REVIEW_TYPE_IDS.includes(src.type)) l.type = src.type;
  const ok = new Set(reviewItems(l.type).map((x) => x.id));
  l.member = isId(src.member) ? src.member : '';
  l.acc = clampInt(src.acc, 0, 4 * 3600000, 0);
  // A running timer keeps running across a reload, as long as it started in the last few hours.
  const now = Date.now();
  l.runAt = Number.isFinite(src.runAt) && src.runAt > now - 4 * 3600000 && src.runAt <= now ? src.runAt : 0;
  for (const m of Array.isArray(src.marks) ? src.marks.slice(0, 400) : []) {
    if (!m || typeof m !== 'object' || !LISTEN_KINDS.includes(m.kind)) continue;
    if (m.kind !== 'note' && !ok.has(m.item)) continue;
    l.marks.push({ id: isId(m.id) ? m.id : uid('mk'), t: clampInt(m.t, 0, 4 * 3600, 0), kind: m.kind, item: ok.has(m.item) ? m.item : '', note: str(m.note, 200).trim() });
  }
  return l;
}

/** Team Pulse: agent codes chosen by the supervisor (never names or IDs) and dated touchpoints. Message text is never stored. */
const TOUCH_KINDS = ['recognition', 'oneonone', 'stay'];
/** HRIDs and BP-IDs: letters, digits, and - _ . only. */
function cleanStaffId(v) {
  return str(v, 30).trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30);
}
function sanitizeTeam(o) {
  const src = o && typeof o === 'object' ? o : {};
  const members = [];
  const seen = new Set();
  for (const m of Array.isArray(src.members) ? src.members.slice(0, 60) : []) {
    if (!m || typeof m !== 'object') continue;
    const code = str(m.code, 30).trim();
    if (!code) continue;
    let id = isId(m.id) ? m.id : uid('mem');
    if (seen.has(id)) id = uid('mem');
    seen.add(id);
    members.push({ id, code, name: str(m.name, 60).trim(), hrid: cleanStaffId(m.hrid), bpid: cleanStaffId(m.bpid), since: isIsoDate(m.since) ? m.since : '' });
  }
  const ids = new Set(members.map((m) => m.id));
  const touches = [];
  for (const t of Array.isArray(src.touches) ? src.touches.slice(-2000) : []) {
    if (!t || typeof t !== 'object' || !ids.has(t.member) || !TOUCH_KINDS.includes(t.kind) || !isIsoDate(t.date)) continue;
    touches.push({ id: isId(t.id) ? t.id : uid('touch'), member: t.member, kind: t.kind, date: t.date, earned: t.earned === true, strength: isId(t.strength) ? t.strength : null });
  }
  return { members, touches };
}

function sanitizeLinks(o) {
  const src = o && typeof o === 'object' ? o : {};
  const items = [];
  const seen = new Set();
  for (const l of Array.isArray(src.items) ? src.items.slice(0, 300) : []) {
    if (!l || typeof l !== 'object') continue;
    const name = str(l.name, 80).trim();
    if (!name) continue;
    let id = isId(l.id) ? l.id : uid('link');
    if (seen.has(id)) id = uid('link');
    seen.add(id);
    items.push({
      id,
      name,
      url: str(l.url, 1000).trim(),
      group: str(l.group, 40).trim() || 'Other',
      tag: str(l.tag, 30).trim(),
      note: str(l.note, 300).trim(),
      pinned: l.pinned === true,
    });
  }
  return { items };
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

/** The agent's real KPI numbers, as typed from the dashboard: current value, target, unit, and the date of the current value. */
const NUM_UNITS = ['%', 'points', 'hours', 'count'];
const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : null;
};
function sanitizeNums(o) {
  const src = o && typeof o === 'object' ? o : {};
  const out = {};
  for (const k of Object.keys(KPI_MEASURE)) {
    const v = src[k];
    if (!v || typeof v !== 'object') continue;
    const cur = numOrNull(v.cur);
    const target = numOrNull(v.target);
    if (cur === null && target === null) continue;
    out[k] = { cur, target, unit: NUM_UNITS.includes(v.unit) ? v.unit : KPI_MEASURE[k].unit, asOf: isIsoDate(v.asOf) ? v.asOf : todayDay() };
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
  if (['points', 'paragraphs'].includes(src.style)) b.style = src.style;
  b.nums = sanitizeNums(src.nums);
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
    case 'review': state.review = sanitizeReview(store.get('review', null)); break;
    case 'team': {
      const raw = store.get('team', null);
      // A personal copy can be built with a team size; it starts with numbered codes only.
      // A personal copy can carry a roster (display names only) or just a team size.
      const seed = Array.isArray(DATA.seedTeam) ? DATA.seedTeam : Array.from({ length: clampInt(DATA.seedTeam, 0, 40, 0) }, () => ({}));
      state.team = raw == null && seed.length ? sanitizeTeam({ members: seed.map((r, i) => ({ id: `mem-seed-${i + 1}`, code: `Agent ${String(i + 1).padStart(2, '0')}`, name: r.name || '', hrid: r.hrid || '', bpid: r.bpid || '' })) }) : sanitizeTeam(raw);
      // Members created from an earlier copy pick up the roster's name and IDs where they are still empty.
      if (raw != null) {
        state.team.members.forEach((m) => {
          const k = /^mem-seed-(\d+)$/.exec(m.id);
          const r = k && seed[Number(k[1]) - 1];
          if (!r) return;
          if (!m.name && r.name) m.name = str(r.name, 60);
          if (!m.hrid && r.hrid) m.hrid = cleanStaffId(r.hrid);
          if (!m.bpid && r.bpid) m.bpid = cleanStaffId(r.bpid);
        });
      }
      break;
    }
    case 'today': state.today = sanitizeToday(store.get('today', null)); break;
    case 'observe': state.observe = sanitizeObserve(store.get('observe', null)); break;
    case 'calib': state.calib = sanitizeCalib(store.get('calib', null)); break;
    case 'practice': state.practice = sanitizePractice(store.get('practice', null)); break;
    case 'listen': state.listen = sanitizeListen(store.get('listen', null)); break;
    case 'eod': state.eod = sanitizeEod(store.get('eod', null)); break;
    case 'huddle': state.huddle = sanitizeHuddle(store.get('huddle', null)); break;
    case 'tracker': state.tracker = sanitizeTracker(store.get('tracker', null)); break;
    case 'links': {
      const raw = store.get('links', null);
      state.links = raw == null ? initialLinks() : sanitizeLinks(raw);
      break;
    }
    default: break;
  }
}

function loadState() {
  STATE_KEYS.forEach(loadSlice);
  applyLinkReplacements();
}

/**
 * A personal copy can retire old addresses: a saved link at a retired address becomes the new
 * link (keeping its place and pin), duplicates are removed, and My Day routines follow it.
 */
function applyLinkReplacements() {
  const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
  let changed = false;
  for (const seed of Array.isArray(DATA.seedLinks) ? DATA.seedLinks : []) {
    const old = new Set((Array.isArray(seed.replaces) ? seed.replaces : []).map(norm).filter(Boolean));
    if (!old.size || !seed.url) continue;
    const items = state.links.items;
    const hits = items.filter((l) => old.has(norm(l.url)));
    if (!hits.length) continue;
    const retiredNames = hits.map((l) => normalizeText(l.name));
    let keep = items.find((l) => norm(l.url) === norm(seed.url));
    if (!keep) {
      keep = hits[0];
      Object.assign(keep, { name: str(seed.name, 80).trim(), url: str(seed.url, 1000).trim(), group: str(seed.group, 40).trim() || keep.group, tag: str(seed.tag, 30).trim(), note: str(seed.note, 300).trim(), pinned: keep.pinned || seed.pinned === true });
    }
    const gone = new Set(hits.filter((l) => l !== keep).map((l) => l.id));
    state.links.items = items.filter((l) => !gone.has(l.id));
    // Routines that opened one of the retired links now open the new one.
    state.today.routines.forEach((r) => {
      if (!r.link) return;
      const n = normalizeText(r.link);
      if (gone.has(r.link) || r.link === keep.id || retiredNames.some((x) => x.includes(n))) r.link = keep.id;
    });
    changed = true;
  }
  if (changed) persist('links', 'today');
}

function serialize(key) {
  if (key === 'favorites') return [...state.favorites];
  return state[key];
}

function persist(...keys) {
  for (const k of keys) store.set(k, serialize(k));
}

const persistBuilderSoon = debounce(() => persist('builder'), 300);
