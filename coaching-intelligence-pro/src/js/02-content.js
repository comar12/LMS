/* ==========================================================================
   02-content: merged content model (built-in + overrides + custom) and search
   ========================================================================== */

const content = { opps: [], strengths: [], oppMap: new Map(), strengthMap: new Map() };

function rebuildContent() {
  const opps = [];
  for (const o of DATA.opps) {
    const ov = state.overrides.opps[o.id];
    if (ov) opps.push({ ...o, ...ov, id: o.id, builtin: true, customized: true, custom: false });
    else opps.push({ ...o, builtin: true, customized: false, custom: false });
  }
  for (const c of state.custom.opps) opps.push({ ...c, builtin: false, customized: false, custom: true });
  content.opps = opps;
  content.oppMap = new Map(opps.map((o) => [o.id, o]));

  const strengths = [];
  for (const s of DATA.strengths) {
    const ov = state.overrides.strengths[s.id];
    if (ov) strengths.push({ ...s, ...ov, id: s.id, builtin: true, customized: true, custom: false });
    else strengths.push({ ...s, builtin: true, customized: false, custom: false });
  }
  for (const c of state.custom.strengths) strengths.push({ ...c, builtin: false, customized: false, custom: true });
  content.strengths = strengths;
  content.strengthMap = new Map(strengths.map((s) => [s.id, s]));

  opps.forEach(indexOpp);
  strengths.forEach(indexStrength);
}

const getOpp = (id) => content.oppMap.get(id) || null;
const getStrength = (id) => content.strengthMap.get(id) || null;

/* ---------- Search index ---------- */
function wordsOf(text) {
  return [...new Set(normalizeText(text).split(' ').filter(Boolean))];
}

// Category names a supervisor might type; matching one boosts every entry in that category.
const CAT_BOOST_WORDS = { com: ['communication'], dis: ['probing', 'discovery'], hold: ['hold', 'mute'], own: ['ownership', 'resolution'], tech: ['technical'], bill: ['billing'], sales: ['sales', 'retention'] };
const GROUP_BOOST_WORDS = { com: ['communication'], dis: ['discovery', 'probing'], hold: ['hold', 'control'], own: ['ownership'], tech: ['technical'], bill: ['billing'], sales: ['sales', 'retention'] };

function indexOpp(o) {
  const kw = (o.kw || []).map(normalizeText).filter(Boolean);
  const exampleText = (o.example || []).map((e) => e.say).join(' ');
  o._title = normalizeText(o.title);
  o._kw = kw;
  o._desc = normalizeText(o.desc);
  o._boost = CAT_BOOST_WORDS[o.cat] || [];
  o._idx = [
    { w: 12, words: wordsOf(o.title) },
    { w: 8, words: wordsOf(kw.join(' ')), text: ' ' + kw.join(' | ') + ' ' },
    { w: 5, words: wordsOf((o.tags || []).join(' ')) },
    { w: 4, words: wordsOf(o.desc), text: ' ' + o._desc + ' ' },
    { w: 3, words: wordsOf(((CAT_MAP[o.cat] || {}).label || '') + ' ' + ((THEMES[o.theme] || {}).label || '')) },
    { w: 1, words: wordsOf([o.feedback, o.impact, o.plan, (o.questions || []).join(' '), exampleText].join(' ')) },
  ];
}

function indexStrength(s) {
  const kw = (s.kw || []).map(normalizeText).filter(Boolean);
  s._title = normalizeText(s.title);
  s._kw = kw;
  s._desc = normalizeText(s.desc);
  s._boost = GROUP_BOOST_WORDS[s.group] || [];
  s._idx = [
    { w: 12, words: wordsOf(s.title) },
    { w: 8, words: wordsOf(kw.join(' ')), text: ' ' + kw.join(' | ') + ' ' },
    { w: 4, words: wordsOf(s.desc) },
    { w: 3, words: wordsOf((S_GROUP_MAP[s.group] || {}).label || '') },
    { w: 1, words: wordsOf((s.v || []).join(' ')) },
  ];
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'or', 'for', 'with', 'in', 'on', 'at', 'is', 'was', 'be', 'by', 'my', 'i', 'it', 'not', 'no', 'did', 'does', 'do', 'when', 'how', 'what', 'me', 'your', 'you', 'agent', 'agents']);

// Query expansion: what supervisors type -> words used in the library.
const SYNONYMS = {
  angry: ['frustrat', 'upset', 'irate', 'escalat'],
  mad: ['angry', 'frustrat', 'upset'],
  irate: ['angry', 'escalat', 'upset'],
  upset: ['frustrat', 'angry'],
  yelling: ['angry', 'escalat'],
  sleepy: ['energy', 'flat', 'monotone'],
  tired: ['energy', 'flat'],
  monotone: ['flat', 'energy'],
  boring: ['flat', 'energy', 'monotone'],
  bored: ['flat', 'energy'],
  robotic: ['generic', 'scripted', 'flat'],
  scripted: ['generic', 'robotic'],
  silent: ['silence', 'dead', 'quiet'],
  silence: ['silent', 'dead', 'quiet'],
  quiet: ['silence', 'silent'],
  muted: ['mute'],
  pause: ['silence', 'dead'],
  questions: ['probing', 'discovery'],
  question: ['probing', 'discovery'],
  probe: ['probing'],
  ask: ['probing', 'questions'],
  rude: ['tone', 'condescending'],
  attitude: ['tone'],
  fast: ['pace', 'rushed'],
  rushed: ['pace', 'rush'],
  rush: ['pace', 'rushed'],
  slow: ['pace', 'delay'],
  sorry: ['empathy', 'apology'],
  apology: ['empathy'],
  care: ['empathy'],
  feelings: ['empathy'],
  callback: ['call back', 'follow'],
  dropped: ['disconnect'],
  disconnected: ['dropped', 'disconnect'],
  upsell: ['sales', 'offer'],
  sell: ['sales', 'offer'],
  selling: ['sales', 'offer'],
  pitch: ['offer', 'sales'],
  promo: ['promotion'],
  cancel: ['cancellation', 'retention'],
  cancelling: ['cancellation', 'retention'],
  canceling: ['cancellation', 'retention'],
  tech: ['technical', 'technician'],
  truck: ['technician', 'dispatch'],
  fix: ['resolution', 'resolve'],
  fixed: ['resolution', 'resolve'],
  bill: ['billing'],
  money: ['billing', 'payment'],
};

function queryParts(q) {
  const phrase = normalizeText(q);
  const all = phrase.split(' ').filter(Boolean);
  const tokens = all.filter((t) => !STOP_WORDS.has(t));
  return { phrase, tokens: tokens.length ? tokens : all };
}

function wordMatch(t, w) {
  if (t === w) return 1;
  if (t.length <= 2) return 0;
  if (w.startsWith(t)) return 0.85;
  if (t.length >= 5 && w.length >= 5) {
    const m = Math.min(t.length, w.length);
    let i = 0;
    while (i < m && t[i] === w[i]) i++;
    if (i >= Math.max(5, m - 2)) return 0.65;
  }
  return 0;
}

function fieldScore(field, alt) {
  if (alt.includes(' ')) {
    const text = field.text || ' ' + field.words.join(' ') + ' ';
    return text.includes(alt) ? 1 : 0;
  }
  let best = 0;
  for (const w of field.words) {
    const s = wordMatch(alt, w);
    if (s > best) {
      best = s;
      if (s === 1) break;
    }
  }
  return best;
}

function scoreItem(item, tokens, mode) {
  const idx = item._idx;
  let total = 0;
  let matched = 0;
  for (const tok of tokens) {
    if (item._boost && item._boost.includes(tok)) total += 6;
    const alts = [tok].concat(SYNONYMS[tok] || []);
    let best = 0;
    for (const field of idx) {
      for (let i = 0; i < alts.length; i++) {
        const s = fieldScore(field, alts[i]);
        if (s) {
          const v = field.w * s * (i === 0 ? 1 : 0.7);
          if (v > best) best = v;
        }
      }
    }
    if (best > 0) {
      total += best;
      matched++;
    } else if (mode === 'and') return 0;
  }
  return mode === 'or' ? total * (matched / tokens.length) : total;
}

function phraseBonus(item, phrase) {
  if (!phrase) return 0;
  let bonus = 0;
  if (item._title === phrase) return 40;
  if (!phrase.includes(' ')) return item._kw.includes(phrase) ? 4 : 0;
  if (item._title.includes(phrase)) bonus += 24;
  if (item._kw.includes(phrase)) bonus += 18;
  else if (item._kw.some((k) => k.includes(phrase))) bonus += 10;
  if (item._desc.includes(phrase)) bonus += 5;
  return bonus;
}

/** Ranked search over opportunities or strengths. AND across terms, falling back to partial matches. */
function searchList(list, q) {
  const { phrase, tokens } = queryParts(q);
  if (!tokens.length) return { results: list.map((item) => ({ item, score: 0 })), partial: false, tokens: [] };
  let results = [];
  for (const item of list) {
    const s = scoreItem(item, tokens, 'and');
    if (s > 0) results.push({ item, score: s + phraseBonus(item, phrase) });
  }
  let partial = false;
  if (!results.length && tokens.length > 1) {
    partial = true;
    for (const item of list) {
      const s = scoreItem(item, tokens, 'or');
      if (s > 0) results.push({ item, score: s + phraseBonus(item, phrase) });
    }
  }
  results.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  const hl = new Set();
  tokens.forEach((t) => {
    hl.add(t);
    (SYNONYMS[t] || []).forEach((s) => s.split(' ').forEach((p) => hl.add(p)));
  });
  return { results, partial, tokens: [...hl].filter((t) => t.length > 2) };
}

/** Wrap matching words in <mark>, built with DOM nodes (no HTML parsing). */
function highlight(text, tokens) {
  const frag = document.createDocumentFragment();
  if (!tokens || !tokens.length) {
    frag.appendChild(document.createTextNode(text));
    return frag;
  }
  const re = /[A-Za-z0-9']+|[^A-Za-z0-9']+/g;
  let m;
  let buffer = '';
  while ((m = re.exec(text))) {
    const part = m[0];
    const isWord = /[A-Za-z0-9]/.test(part[0]);
    const norm = isWord ? normalizeText(part).split(' ')[0] : '';
    if (isWord && norm && tokens.some((t) => wordMatch(t, norm) >= 0.65)) {
      if (buffer) frag.appendChild(document.createTextNode(buffer));
      buffer = '';
      frag.appendChild(h('mark', null, part));
    } else {
      buffer += part;
    }
  }
  if (buffer) frag.appendChild(document.createTextNode(buffer));
  return frag;
}

function catOrder(id) {
  const i = CATS.findIndex((c) => c.id === id);
  return i === -1 ? 99 : i;
}
