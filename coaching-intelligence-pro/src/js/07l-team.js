/* ==========================================================================
   07l-team: Team Pulse (one card per agent code: recognition, one-on-ones,
   coaching balance) and earned recognition built from logged results
   ========================================================================== */

const sameCode = (a, b) => normalizeText(a) === normalizeText(b);
/** The name the supervisor gave this person (kept only in this browser), or the code. */
const memberLabel = (m) => (m ? m.name || m.code : '');
const firstName = (m) => (m && m.name ? m.name.split(/\s+/)[0] : '');
function initialsOf(m) {
  if (m.name) return m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return m.code.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w, i, a) => (i === a.length - 1 && /^\d+$/.test(w) ? w : w[0])).join('').slice(0, 4).toUpperCase() || '#';
}
/** Who a tracker plan belongs to, shown by name when the plan's code matches a team member. */
function planWho(p) {
  const m = memberByCode(p.label);
  return m ? memberLabel(m) : p.label;
}

/** A searchable grid of avatar cards for choosing a team member (radio group with arrow keys). */
function memberPicker({ value, onChange, label = 'Team member' }) {
  const members = state.team.members;
  let current = value;
  const search = members.length > 8 ? h('input', { class: 'input mp__search', type: 'search', placeholder: 'Search by name, code, or ID', 'aria-label': 'Search your team', autocomplete: 'off' }) : null;
  const grid = h('div', { class: 'mp__grid', role: 'radiogroup', 'aria-label': label });
  const visible = () => {
    const q = search ? normalizeText(search.value) : '';
    return members.filter((m) => !q || normalizeText(`${memberLabel(m)} ${m.code} ${m.hrid} ${m.bpid}`).includes(q));
  };
  const choose = (m, focus) => {
    current = m.id;
    draw();
    onChange(m);
    if (focus) {
      const b = grid.querySelector('[aria-checked="true"]');
      if (b) b.focus();
    }
  };
  function draw() {
    const list = visible();
    const hasCurrent = list.some((m) => m.id === current);
    grid.replaceChildren(
      ...(list.length
        ? list.map((m, i) =>
            h(
              'button',
              { type: 'button', class: `mp__opt${m.id === current ? ' is-on' : ''}`, role: 'radio', 'aria-checked': String(m.id === current), tabindex: m.id === current || (!hasCurrent && i === 0) ? '0' : '-1', 'data-id': m.id, onclick: () => choose(m, true) },
              h('span', { class: 'mp__av', 'aria-hidden': 'true' }, initialsOf(m)),
              h('span', { class: 'mp__text' }, h('span', { class: 'mp__name' }, memberLabel(m)), m.name ? h('span', { class: 'mp__code' }, m.code) : null),
              m.id === current ? h('span', { class: 'mp__check', 'aria-hidden': 'true' }, icon('check', 'icon--sm')) : null
            )
          )
        : [h('p', { class: 'mp__empty' }, 'No one matches that search.')])
    );
  }
  grid.addEventListener('keydown', (e) => {
    const list = visible();
    if (!list.length) return;
    const i = Math.max(0, list.findIndex((m) => m.id === (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : current)));
    const cols = Math.max(1, Math.round(grid.clientWidth / 170));
    const step = { ArrowRight: 1, ArrowDown: cols, ArrowLeft: -1, ArrowUp: -cols }[e.key];
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.min(list.length - 1, Math.max(0, i + step));
    choose(list[next], true);
  });
  if (search) search.addEventListener('input', draw);
  draw();
  return { el: h('div', { class: 'mp' }, search, grid), get value() { return current; } };
}

/** Small segmented choice used inside dialogs. */
function choiceGroup({ label, options, value, onChange }) {
  let current = value;
  const wrap = h('div', { class: 'segmented choice', role: 'radiogroup', 'aria-label': label });
  const draw = () =>
    wrap.replaceChildren(
      ...options.map((o) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === current), 'aria-pressed': String(o.value === current), tabindex: o.value === current ? '0' : '-1', onclick: () => { current = o.value; draw(); onChange(o.value); wrap.querySelector('[aria-checked="true"]').focus(); } }, o.icon ? icon(o.icon) : null, o.label)
      )
    );
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === current);
    const n = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
    current = n.value;
    draw();
    onChange(n.value);
    wrap.querySelector('[aria-checked="true"]').focus();
  });
  draw();
  return { el: wrap, get value() { return current; }, set(v) { current = v; draw(); } };
}
const daysAgo = (d) => (d ? -daysFromToday(d) : null);

function memberByCode(code) {
  return state.team.members.find((m) => sameCode(m.code, code)) || null;
}
function memberPlans(m) {
  return state.tracker.plans.filter((p) => sameCode(p.label, m.code));
}
function lastTouch(m, kinds) {
  return state.team.touches.filter((t) => t.member === m.id && kinds.includes(t.kind)).map((t) => t.date).sort().pop() || null;
}

/** Behaviors logged as Met since the agent was last recognized: the raw material for earned recognition. */
function earnedFor(m) {
  const since = lastTouch(m, ['recognition']) || '';
  const out = [];
  memberPlans(m).forEach((p) => {
    const fresh = p.logs.filter((l) => l.date > since);
    planFocus(p).forEach((o) => {
      const kind = isPeopleOpp(o) ? 'checkin' : 'call';
      if (!fresh.some((l) => l.kind === kind && l.results[o.id] === 'met')) return;
      const t = focusTally(p, o, kind);
      if (t.met) out.push({ plan: p, opp: o, kind, met: t.met, n: t.n });
    });
  });
  return out;
}

function earnedText(m) {
  const items = earnedFor(m);
  if (!items.length) return '';
  const lines = items.map(({ opp, kind, met, n }) => {
    const f = focusPhrase(opp);
    const unit = kind === 'call' ? 'calls I reviewed' : 'check-ins we held';
    if (n === 1) return kind === 'call' ? `On the call I reviewed after our coaching session, you met the expected standard for ${f}.` : `At our check-in, you met the expected standard for ${f}.`;
    if (met === n) return `You met the expected standard for ${f} on ${n === 2 ? 'both' : 'all ' + numWord(n)} ${unit} since our coaching session.`;
    return `You met the expected standard for ${f} on ${numWord(met)} of the ${numWord(n)} ${unit} since our coaching session.`;
  });
  lines.push('That is exactly what we worked on together, and it makes a real difference for the customers and the team. Thank you.');
  return lines.join(' ');
}

function memberPulse(m) {
  const since30 = addDays(todayDay(), -29);
  const lastRec = lastTouch(m, ['recognition']);
  const lastTalk = lastTouch(m, ['oneonone', 'stay']);
  const plans = memberPlans(m);
  const coached30 = plans.filter((p) => p.start >= since30).length;
  const rec30 = state.team.touches.filter((t) => t.member === m.id && t.kind === 'recognition' && t.date >= since30).length;
  const earned = earnedFor(m);
  const dRec = daysAgo(lastRec);
  const dTalk = daysAgo(lastTalk);
  const flags = [];
  if (earned.length) flags.push({ level: 'good', text: 'Earned recognition ready' });
  if (dRec === null) flags.push({ level: 'alert', text: 'No recognition logged yet' });
  else if (dRec >= 14) flags.push({ level: 'alert', text: `No recognition in ${dRec} days` });
  if (coached30 >= 2 && rec30 < coached30) flags.push({ level: 'warn', text: `Coached ${coached30} times, recognized ${rec30} in 30 days` });
  if (dTalk === null) flags.push({ level: 'warn', text: 'No one-on-one logged yet' });
  else if (dTalk >= 30) flags.push({ level: 'warn', text: `No one-on-one in ${dTalk} days` });
  const active = plans.filter((p) => p.status === 'active');
  const due = active.filter((p) => ['overdue', 'due'].includes(planDue(p).level)).length;
  // Higher = needs attention sooner.
  const need = (earned.length ? 1000 : 0) + (dRec === null ? 500 : dRec * 10) + (flags.some((f) => f.level === 'warn') ? 50 : 0);
  return { lastRec, lastTalk, dRec, dTalk, coached30, rec30, earned, flags, active: active.length, due, need };
}

function teamNeedsCount() {
  return state.team.members.filter((m) => memberPulse(m).flags.some((f) => f.level === 'alert' || f.level === 'good')).length;
}

function saveTeam() {
  persist('team');
  renderSidebar();
}

function logTouch(memberId, kind, extra = {}) {
  const t = { id: uid('touch'), member: memberId, kind, date: todayDay(), earned: !!extra.earned, strength: extra.strength || null };
  state.team.touches.push(t);
  saveTeam();
  const sel = `.pulse[aria-labelledby="mem-${memberId}"] .pulse__avatar`;
  const el = document.querySelector(sel);
  const before = el ? el.getBoundingClientRect() : null;
  state.ui.flash = `mem:${memberId}`;
  refresh({ panel: false });
  state.ui.flash = null;
  // Burst where the card is now, or where it was if it moved off screen.
  if (kind === 'recognition') celebrateAt(sel, before);
  const m = state.team.members.find((x) => x.id === memberId);
  const label = { recognition: 'Recognition', oneonone: 'One-on-one', stay: 'Stay conversation' }[kind];
  toast(`${label} logged for ${m ? memberLabel(m) : 'this agent'}`, {
    action: { label: 'Undo', fn: () => { state.team.touches = state.team.touches.filter((x) => x.id !== t.id); saveTeam(); refresh({ panel: false }); } },
  });
}

/* ---------- Recognition dialog ---------- */
function openRecognize(memberId) {
  const members = state.team.members;
  if (!members.length) return;
  let m = members.find((x) => x.id === memberId) || members[0];
  const strength = h('select', { class: 'select', id: 'rc-strength' }, S_GROUPS.map((g) => h('optgroup', { label: g.label }, content.strengths.filter((s) => s.group === g.id).map((s) => h('option', { value: s.id }, s.title)))));
  const strengthField = h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rc-strength' }, 'Strength you observed'), strength);
  const greet = h('input', { type: 'checkbox', id: 'rc-greet', checked: true });
  const greetField = h('label', { class: 'check' }, greet, 'Start with their first name');
  const text = h('textarea', { class: 'textarea', id: 'rc-text', rows: '6' });
  const hint = h('p', { class: 'field__hint' });
  const sourceOptions = () => [earnedText(m) ? { value: 'earned', label: 'Earned results', icon: 'award' } : null, { value: 'strength', label: 'A strength', icon: 'thumb' }, { value: 'own', label: 'My own words', icon: 'edit' }].filter(Boolean);
  const sourceBox = h('div');
  let source = null;
  const fillText = () => {
    const kind = source.value;
    strengthField.hidden = kind !== 'strength';
    greetField.hidden = !m.name;
    let body = '';
    if (kind === 'earned') {
      body = earnedText(m);
      hint.textContent = 'Written only from the results you logged. Edit it before sending if you like.';
    } else if (kind === 'strength') {
      const s = getStrength(strength.value);
      body = s ? s.v[0] : '';
      hint.textContent = 'Only send this if you actually observed it. Choose the strength that matches what you saw.';
    } else {
      hint.textContent = 'Be specific: what they did and why it mattered.';
    }
    text.value = m.name && greet.checked && body ? `Hi ${firstName(m)}, ${body.charAt(0).toLowerCase() + body.slice(1)}` : body;
  };
  const buildSource = () => {
    const opts = sourceOptions();
    const keep = source && opts.some((o) => o.value === source.value) ? source.value : opts[0].value;
    source = choiceGroup({ label: 'Based on', options: opts, value: keep, onChange: fillText });
    sourceBox.replaceChildren(source.el);
  };
  const picker = memberPicker({
    value: m.id,
    label: 'Who are you recognizing?',
    onChange: (x) => {
      m = x;
      buildSource();
      fillText();
    },
  });
  buildSource();
  fillText();
  strength.addEventListener('change', fillText);
  greet.addEventListener('change', fillText);
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const copy = copyButton(() => text.value.trim(), { label: 'Copy message', srLabel: 'Copy recognition message', size: 'md', fk: 'rc-copy', emptyMessage: 'Write the message first.' });
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('award'), 'Log as recognized');
  const dlg = openModal({
    title: 'Recognize',
    size: 'lg',
    body: h(
      'div',
      { class: 'tr-form' },
      h('p', { class: 'field__label' }, 'Who are you recognizing?'),
      picker.el,
      h('p', { class: 'field__label', style: 'margin-top:16px' }, 'Based on'),
      sourceBox,
      h('div', { style: 'margin-top:12px' }, strengthField),
      h('div', { class: 'field', style: 'margin-top:12px' }, h('label', { class: 'field__label', for: 'rc-text' }, 'Message'), text, hint, greetField),
      h('p', { class: 'hint' }, icon('lock'), 'Only the date is saved, never the message.')
    ),
    footer: [cancel, h('span', { class: 'spacer' }), copy, save],
    initialFocus: '.mp__opt.is-on',
  });
  cancel.addEventListener('click', () => dlg.close());
  save.addEventListener('click', () => {
    dlg.close();
    logTouch(m.id, 'recognition', { earned: source.value === 'earned', strength: source.value === 'strength' ? strength.value : null });
  });
}

/* ---------- Members ---------- */
function openAddMembers() {
  const count = h('input', { class: 'input', id: 'tm-count', type: 'number', min: '1', max: '40', value: state.team.members.length ? '1' : '16' });
  const prefix = h('input', { class: 'input', id: 'tm-prefix', type: 'text', value: 'Agent', maxlength: '20', autocomplete: 'off' });
  const warn = h('div');
  prefix.addEventListener('input', () => {
    warn.replaceChildren();
    const n = piiNote(prefix.value);
    if (n) warn.appendChild(n);
  });
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const add = h('button', { type: 'button', class: 'btn btn--primary' }, icon('plus'), 'Add codes');
  const m = openModal({
    title: 'Add team members',
    size: 'sm',
    body: h(
      'div',
      { class: 'tr-form' },
      h('p', { class: 'prose' }, 'Each agent gets a numbered code such as Agent 01. Add names, HRIDs, and BP-IDs afterwards with Paste roster or Edit details.'),
      h('div', { class: 'form-grid', style: 'margin-top:12px' }, h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'tm-count' }, 'How many'), count), h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'tm-prefix' }, 'Code prefix'), prefix)),
      warn
    ),
    footer: [cancel, h('span', { class: 'spacer' }), add],
    initialFocus: count,
  });
  cancel.addEventListener('click', () => m.close());
  add.addEventListener('click', () => {
    const n = clampInt(count.value, 1, 40, 1);
    const pre = prefix.value.trim().slice(0, 20) || 'Agent';
    const used = new Set(state.team.members.map((x) => normalizeText(x.code)));
    let k = 1;
    const added = [];
    while (added.length < n && state.team.members.length + added.length < 60) {
      const code = `${pre} ${String(k).padStart(2, '0')}`;
      if (!used.has(normalizeText(code))) added.push({ id: uid('mem'), code, since: '' });
      k++;
    }
    state.team.members.push(...added);
    saveTeam();
    m.close();
    refresh({ panel: false });
    toast(`Added ${plural(added.length, 'team member')}`);
  });
}

async function removeMember(id) {
  const m = state.team.members.find((x) => x.id === id);
  if (!m) return;
  if (!(await confirmDialog({ title: `Remove ${memberLabel(m)}?`, message: 'Their recognition and one-on-one dates are removed from Team Pulse. Follow-up plans in the tracker are kept.', confirmLabel: 'Remove', danger: true }))) return;
  state.team.members = state.team.members.filter((x) => x.id !== id);
  state.team.touches = state.team.touches.filter((t) => t.member !== id);
  saveTeam();
  refresh({ panel: false });
}

function editMember(id) {
  const m = state.team.members.find((x) => x.id === id);
  if (!m) return;
  const name = h('input', { class: 'input', id: 'tm-name', type: 'text', value: m.name || '', maxlength: '60', autocomplete: 'off', placeholder: 'First and family name' });
  const code = h('input', { class: 'input', id: 'tm-code', type: 'text', value: m.code, maxlength: '30', autocomplete: 'off' });
  const hrid = h('input', { class: 'input', id: 'tm-hrid', type: 'text', value: m.hrid || '', maxlength: '30', autocomplete: 'off', spellcheck: 'false' });
  const bpid = h('input', { class: 'input', id: 'tm-bpid', type: 'text', value: m.bpid || '', maxlength: '30', autocomplete: 'off', spellcheck: 'false' });
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('save'), 'Save');
  const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { class: 'field__label', for: id }, label), input, hint ? h('p', { class: 'field__hint' }, hint) : null);
  const dlg = openModal({
    title: 'Edit team member',
    size: 'sm',
    body: h(
      'div',
      { class: 'tr-form' },
      field('tm-name', 'Name shown in the app', name),
      field('tm-code', 'Code', code, 'Connects this person to their follow-up plans.'),
      h('div', { class: 'form-grid' }, field('tm-hrid', 'HRID', hrid), field('tm-bpid', 'BP-ID', bpid)),
      h('p', { class: 'field__hint' }, icon('lock', 'icon--sm'), ' Names and IDs stay only in this browser. They are never copied into coaching text or a team pack.')
    ),
    footer: [cancel, h('span', { class: 'spacer' }), save],
    initialFocus: name,
  });
  cancel.addEventListener('click', () => dlg.close());
  save.addEventListener('click', () => {
    const old = m.code;
    m.name = name.value.trim().slice(0, 60);
    m.code = code.value.trim().slice(0, 30) || old;
    m.hrid = cleanStaffId(hrid.value);
    m.bpid = cleanStaffId(bpid.value);
    // Keep tracker plans connected to a renamed code.
    state.tracker.plans.forEach((p) => {
      if (sameCode(p.label, old)) p.label = m.code;
    });
    persist('tracker');
    saveTeam();
    dlg.close();
    refresh({ panel: false });
    toast('Team member saved');
  });
}

/* ---------- Paste roster ---------- */
/** Split one pasted line into cells: tabs, commas, pipes, or wide gaps; otherwise IDs are the words with digits. */
function rosterCells(line) {
  const parts = line.split(/\t|\s{2,}|,|;|\|/).map((c) => c.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  const out = [];
  line.trim().split(/\s+/).forEach((t) => {
    if (/\d/.test(t) || !out.length || /\d/.test(out[out.length - 1])) out.push(t);
    else out[out.length - 1] += ` ${t}`;
  });
  return out;
}

/** Read a pasted table of HRID, BP-ID, and name, in any column order, with or without a header row. */
function parseRoster(text) {
  let cols = null;
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let cells = rosterCells(line);
    if (!/\d/.test(line)) {
      const byCell = cells.length > 1 ? cells.map((c) => (/^hr\s*-?\s*id/i.test(c) ? 'hrid' : /^bp\s*-?\s*id/i.test(c) ? 'bpid' : /name/i.test(c) ? 'name' : '')) : null;
      const byOrder = [['hrid', /\bhr\s*-?\s*id\b/i], ['bpid', /\bbp\s*-?\s*id\b/i], ['name', /\bname\b/i]].map(([k, re]) => ({ k, at: line.search(re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at).map((x) => x.k);
      const head = byCell && byCell.filter(Boolean).length >= 2 ? byCell : byOrder.length >= 2 ? byOrder : null;
      if (head) {
        cols = head;
        continue;
      }
    }
    if (cols && cells.length === cols.length + 1 && /^\d{1,2}\.?$/.test(cells[0])) cells = cells.slice(1);
    const r = { name: '', hrid: '', bpid: '' };
    if (cols && cells.length === cols.length) {
      cells.forEach((c, i) => {
        if (cols[i]) r[cols[i]] = c;
      });
    } else {
      const ids = [];
      cells.forEach((c) => (/\d/.test(c) ? ids.push(c) : (r.name = r.name ? `${r.name} ${c}` : c)));
      // Without a header: an all-digit ID is the HRID and the other one is the BP-ID.
      const hr = ids.findIndex((c) => /^\d+$/.test(c));
      if (hr >= 0) r.hrid = ids.splice(hr, 1)[0];
      if (ids.length) r.bpid = ids.shift();
    }
    r.name = r.name.replace(/\d/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    r.hrid = cleanStaffId(r.hrid);
    r.bpid = cleanStaffId(r.bpid);
    if (r.name || r.hrid || r.bpid) rows.push(r);
  }
  return rows.slice(0, 60);
}

/** Match pasted rows to cards: same HRID, BP-ID, or name first, then empty cards in order, then new cards. */
function rosterMatches(rows) {
  const taken = new Set();
  const same = (a, b) => a && b && normalizeText(a) === normalizeText(b);
  const free = state.team.members.filter((x) => !x.name && !x.hrid && !x.bpid);
  return rows.map((r) => {
    let m = state.team.members.find((x) => !taken.has(x.id) && (same(x.hrid, r.hrid) || same(x.bpid, r.bpid) || same(x.name, r.name)));
    if (!m) m = free.find((x) => !taken.has(x.id));
    if (m) taken.add(m.id);
    return { r, m };
  });
}

function nextCodes(n) {
  const used = new Set(state.team.members.map((x) => normalizeText(x.code)));
  const out = [];
  for (let k = 1; out.length < n && k < 200; k++) {
    const code = `Agent ${String(k).padStart(2, '0')}`;
    if (!used.has(normalizeText(code))) out.push(code);
  }
  return out;
}

function openPasteRoster() {
  const area = h('textarea', { class: 'textarea', id: 'tm-roster', rows: '7', spellcheck: 'false', placeholder: 'HRID\tBP-ID\tAgent Name\n…' });
  const preview = h('div', { class: 'roster-prev', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const apply = h('button', { type: 'button', class: 'btn btn--primary', disabled: true }, icon('users'), 'Add to my team');
  let matches = [];
  const draw = () => {
    matches = rosterMatches(parseRoster(area.value));
    apply.disabled = !matches.length;
    if (!matches.length) {
      preview.replaceChildren(area.value.trim() ? h('p', { class: 'field__error' }, 'No rows found. Put each person on their own line.') : h('p', { class: 'field__hint' }, 'Copy the table from Excel, Teams, or an email and paste it here. Columns can be in any order.'));
      return;
    }
    const isNew = matches.filter((x) => !x.m).length;
    const codes = nextCodes(isNew);
    let k = 0;
    preview.replaceChildren(
      h('p', { class: 'roster-prev__sum' }, icon('check', 'icon--sm'), `${plural(matches.length, 'person', 'people')} found: ${matches.length - isNew} update existing cards${isNew ? `, ${isNew} new` : ''}.`),
      h(
        'div',
        { class: 'roster-prev__wrap' },
        h(
          'table',
          { class: 'roster-tbl' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Name'), h('th', { scope: 'col' }, 'HRID'), h('th', { scope: 'col' }, 'BP-ID'), h('th', { scope: 'col' }, 'Card'))),
          h('tbody', null, matches.map(({ r, m }) => h('tr', null, h('td', null, r.name || '—'), h('td', null, r.hrid || '—'), h('td', null, r.bpid || '—'), h('td', { class: m ? '' : 'is-new' }, m ? m.code : `${codes[k++] || 'New'} (new)`))))
        )
      )
    );
  };
  area.addEventListener('input', draw);
  const dlg = openModal({
    title: 'Paste your team roster',
    size: 'lg',
    body: h(
      'div',
      { class: 'tr-form' },
      h('p', { class: 'notice notice--privacy', role: 'note' }, icon('lock'), h('span', { class: 'notice__body' }, 'Your roster stays only in this browser. Names and IDs are never copied into coaching text or a team pack. A backup file does include them, so keep backups private.')),
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'tm-roster' }, 'One person per line: HRID, BP-ID, and name'), area),
      preview
    ),
    footer: [cancel, h('span', { class: 'spacer' }), apply],
    initialFocus: area,
  });
  draw();
  cancel.addEventListener('click', () => dlg.close());
  apply.addEventListener('click', () => {
    const codes = nextCodes(matches.filter((x) => !x.m).length);
    let added = 0;
    let k = 0;
    matches.forEach(({ r, m }) => {
      let t = m;
      if (!t) {
        if (state.team.members.length >= 60) return;
        t = { id: uid('mem'), code: codes[k++], name: '', hrid: '', bpid: '', since: '' };
        state.team.members.push(t);
        added++;
      }
      if (r.name) t.name = r.name;
      if (r.hrid) t.hrid = r.hrid;
      if (r.bpid) t.bpid = r.bpid;
    });
    saveTeam();
    dlg.close();
    refresh({ panel: false });
    toast(`Roster saved: ${plural(matches.length - added, 'card')} updated${added ? `, ${added} added` : ''}`);
  });
}

function toggleIds() {
  state.prefs.hideIds = !state.prefs.hideIds;
  persist('prefs');
  refresh({ panel: false });
  announce(state.prefs.hideIds ? 'IDs hidden' : 'IDs shown');
}

/* ---------- Page ---------- */
function memberCard(m, idx = 0) {
  const pu = memberPulse(m);
  const initials = initialsOf(m);
  const top = pu.flags[0];
  const recBar = Math.min(pu.rec30, 6);
  const coBar = Math.min(pu.coached30, 6);
  const ago = (d, none) => (d === null ? none : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
  return h(
    'article',
    { class: `pulse pulse--${top ? top.level : 'ok'}${state.ui.flash === `mem:${m.id}` ? ' is-flash' : ''}`, 'aria-labelledby': `mem-${m.id}`, style: `--d:${Math.min(idx, 14) * 45}ms` },
    h(
      'div',
      { class: 'pulse__head' },
      h('span', { class: 'plan__avatar pulse__avatar', 'aria-hidden': 'true' }, initials || '#', pu.earned.length ? h('span', { class: 'pulse__spark' }, icon('sparkle', 'icon--sm')) : null),
      h('div', { class: 'pulse__who' }, h('h2', { class: 'plan__label', id: `mem-${m.id}` }, memberLabel(m)), h('p', { class: 'plan__title' }, m.name ? `${m.code} · ` : '', pu.active ? `${plural(pu.active, 'active plan')}${pu.due ? `, ${pu.due} due` : ''}` : 'No active plans')),
      menuButton({
        label: `More for ${memberLabel(m)}`,
        iconOnly: true,
        fk: `mem-menu:${m.id}`,
        items: [
          { label: 'Log stay conversation', icon: 'heart', onSelect: () => logTouch(m.id, 'stay') },
          { label: 'Edit details', icon: 'edit', onSelect: () => editMember(m.id) },
          { label: 'Remove from team', icon: 'trash', onSelect: () => removeMember(m.id) },
        ],
      })
    ),
    !state.prefs.hideIds && (m.hrid || m.bpid)
      ? h(
          'div',
          { class: 'pulse__ids' },
          [['HRID', m.hrid], ['BP-ID', m.bpid]].map(([k, v]) => (v ? h('button', { type: 'button', class: 'id-chip', 'aria-label': `Copy ${k} for ${memberLabel(m)}`, 'data-fk': `mem-${k}:${m.id}`, onclick: () => copyText(v, { label: k }) }, h('span', { class: 'id-chip__k' }, k), h('span', { class: 'id-chip__v' }, v), icon('copy', 'icon--sm')) : null))
        )
      : null,
    h(
      'dl',
      { class: 'pulse__facts' },
      h('div', null, h('dt', null, 'Last recognition'), h('dd', { class: pu.dRec === null || pu.dRec >= 14 ? 'is-alert' : '' }, ago(pu.dRec, 'never logged'))),
      h('div', null, h('dt', null, 'Last one-on-one'), h('dd', { class: pu.dTalk === null || pu.dTalk >= 30 ? 'is-warn' : '' }, ago(pu.dTalk, 'never logged')))
    ),
    h(
      'div',
      { class: 'balance', title: `Last 30 days: ${pu.rec30} recognitions, ${pu.coached30} coaching plans` },
      h('span', { class: 'balance__label' }, 'Last 30 days'),
      h('span', { class: 'balance__row' }, h('span', { class: 'balance__name' }, 'Recognized'), h('span', { class: 'balance__pips' }, Array.from({ length: 6 }, (_, i) => h('span', { class: `pip${i < recBar ? ' pip--rec' : ''}`, style: `--i:${i}` }))), h('strong', null, String(pu.rec30))),
      h('span', { class: 'balance__row' }, h('span', { class: 'balance__name' }, 'Coached'), h('span', { class: 'balance__pips' }, Array.from({ length: 6 }, (_, i) => h('span', { class: `pip${i < coBar ? ' pip--co' : ''}`, style: `--i:${i + 3}` }))), h('strong', null, String(pu.coached30)))
    ),
    pu.flags.length ? h('ul', { class: 'pulse__flags' }, pu.flags.slice(0, 3).map((f) => h('li', { class: `flag flag--${f.level}` }, icon(f.level === 'good' ? 'award' : f.level === 'alert' ? 'alert' : 'info', 'icon--sm'), f.text))) : h('p', { class: 'pulse__ok' }, icon('check', 'icon--sm'), 'Recently recognized and talked with'),
    h(
      'div',
      { class: 'pulse__actions' },
      h('button', { type: 'button', class: `btn btn--sm${pu.earned.length || pu.dRec === null || pu.dRec >= 14 ? ' btn--primary' : ''}`, 'data-fk': `mem-rec:${m.id}`, onclick: () => openRecognize(m.id) }, icon('award'), pu.earned.length ? 'Recognize (earned)' : 'Recognize'),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `mem-1on1:${m.id}`, onclick: () => logTouch(m.id, 'oneonone') }, icon('chat'), 'Log one-on-one')
    )
  );
}

const HEALTH = [
  { id: 'good', label: 'Earned praise ready', hint: 'Recognize first' },
  { id: 'alert', label: 'Needs recognition', hint: 'Not recognized in 14 days' },
  { id: 'warn', label: 'Needs a one-on-one', hint: 'No talk in 30 days' },
  { id: 'ok', label: 'In balance', hint: 'Recently recognized and talked with' },
];

/** The ring itself: one segment per agent, colored by what they need next. */
function healthRing(pulses) {
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const level = (pu) => (pu.flags[0] ? pu.flags[0].level : 'ok');
  const groups = HEALTH.map((g) => ({ ...g, n: pulses.filter((x) => level(x.pu) === g.id).length }));
  const total = pulses.length;
  const R = 62;
  const C = 2 * Math.PI * R;
  const gap = total > 1 ? Math.min(6, C / total / 3) : 0;
  const seg = C / total;
  const svg = mk('svg', { viewBox: '0 0 160 160', class: 'health__ring', 'aria-hidden': 'true' });
  svg.appendChild(mk('circle', { cx: '80', cy: '80', r: String(R), class: 'health__track' }));
  const segs = mk('g', { transform: 'rotate(-90 80 80)' });
  let k = 0;
  groups.forEach((g) => {
    for (let j = 0; j < g.n; j++, k++) segs.appendChild(mk('circle', { cx: '80', cy: '80', r: String(R), class: `health__seg health__seg--${g.id}`, style: `--len:${Math.max(0.5, seg - gap)}px;--c:${C}px;--i:${k}`, 'stroke-dasharray': `${Math.max(0.5, seg - gap)} ${C}`, 'stroke-dashoffset': String(-k * seg) }));
  });
  svg.appendChild(segs);
  const orbit = mk('g', { class: 'health__orbit' });
  orbit.appendChild(mk('circle', { cx: '80', cy: String(80 - R - 13), r: '3.5', class: 'health__moon' }));
  svg.appendChild(orbit);
  const recent = pulses.filter((x) => x.pu.dRec !== null && x.pu.dRec < 14).length;
  const pct = total ? Math.round((recent / total) * 100) : 0;
  const viz = h('div', { class: 'health__viz' }, svg, h('div', { class: 'health__center' }, h('span', { class: 'health__pct' }, h('span', { 'data-count': String(pct) }, String(pct)), '%'), h('span', { class: 'health__cap' }, 'recognized in 14 days')));
  return { viz, groups };
}

/** The team at a glance: the ring, one line on where to start, and a legend. */
function teamHealth(pulses) {
  const { viz, groups } = healthRing(pulses);
  const lead = groups[0].n ? `${plural(groups[0].n, 'agent has', 'agents have')} earned praise waiting. Start there.` : groups[1].n ? `${plural(groups[1].n, 'agent has', 'agents have')} not been recognized in 14 days.` : groups[2].n ? `${plural(groups[2].n, 'agent is', 'agents are')} due a one-on-one.` : 'Everyone is recognized and talked with. Keep the rhythm going.';
  return h(
    'section',
    { class: 'card health', 'aria-labelledby': 'healthTitle' },
    viz,
    h(
      'div',
      { class: 'health__body' },
      h('h2', { class: 'card__title', id: 'healthTitle' }, icon('pulse'), 'Team health'),
      h('p', { class: 'health__lead' }, lead),
      h('ul', { class: 'health__legend' }, groups.map((g, i) => h('li', { class: `health__item health__item--${g.id}`, style: `--i:${i}` }, h('span', { class: 'health__dot', 'aria-hidden': 'true' }), h('span', { class: 'health__name' }, g.label, h('span', { class: 'health__hint' }, g.hint)), h('strong', { class: 'health__n', 'data-count': String(g.n) }, String(g.n)))))
    )
  );
}

function renderTeam(main) {
  const members = state.team.members;
  if (!members.length) {
    put(
      main,
      pageHead({ eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('heart', 'icon--sm')), 'Team'], title: 'Team Pulse', sub: 'One card per agent: when they were last recognized, when you last talked one-on-one, and whether coaching and recognition are in balance. People stay with leaders who notice their good work, not only their gaps.' }),
      emptyState({ iconName: 'users', title: 'Set up your team', text: 'Paste your roster (HRID, BP-ID, and name) to make one card per agent, or start with numbered codes such as Agent 01 to Agent 16.', action: h('div', { class: 'toolbar', style: 'margin:0;justify-content:center' }, h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-fk': 'tm-paste0', onclick: openPasteRoster }, icon('clipboard'), 'Paste roster'), h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'tm-setup', onclick: openAddMembers }, icon('plus'), 'Add team members')) })
    );
    return;
  }
  const pulses = members.map((m) => ({ m, pu: memberPulse(m) }));
  const sorted = pulses.slice().sort((a, b) => b.pu.need - a.pu.need);
  const earnedN = pulses.filter((x) => x.pu.earned.length).length;
  const noRec = pulses.filter((x) => x.pu.dRec === null || x.pu.dRec >= 14).length;
  const rec30 = pulses.reduce((n, x) => n + x.pu.rec30, 0);
  const co30 = pulses.reduce((n, x) => n + x.pu.coached30, 0);
  const stat = (n, label, iconName, cls) => h('div', { class: `stat${cls ? ' ' + cls : ''}` }, h('span', { class: 'stat__icon', 'aria-hidden': 'true' }, icon(iconName)), h('span', { class: 'stat__num', 'data-count': String(n) }, String(n)), h('span', { class: 'stat__label' }, label));
  const needList = sorted.filter((x) => x.pu.flags.some((f) => f.level === 'good' || f.level === 'alert')).slice(0, 5);
  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('heart', 'icon--sm')), 'Team'],
      title: 'Team Pulse',
      sub: 'One card per agent: when they were last recognized, when you last talked one-on-one, and whether coaching and recognition are in balance. People stay with leaders who notice their good work, not only their gaps.',
      actions: [
        members.some((m) => m.hrid || m.bpid) ? h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'tm-ids', onclick: toggleIds }, icon(state.prefs.hideIds ? 'eye' : 'eye-off'), state.prefs.hideIds ? 'Show IDs' : 'Hide IDs') : null,
        h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'tm-paste', onclick: openPasteRoster }, icon('clipboard'), 'Paste roster'),
        h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'tm-add', onclick: openAddMembers }, icon('plus'), 'Add members'),
      ],
    }),
    h('p', { class: 'notice notice--privacy', role: 'note', style: 'margin-bottom:16px' }, icon('lock'), h('span', { class: 'notice__body' }, 'Names, HRIDs, and BP-IDs stay only in this browser. They are never copied into coaching text or a team pack. Use Hide IDs before sharing your screen. Only dates are saved, never message text.')),
    teamHealth(pulses),
    h('div', { class: 'stats' }, stat(members.length, 'agents', 'users'), stat(earnedN, 'with earned recognition ready', 'award', earnedN ? 'stat--good' : ''), stat(noRec, 'not recognized in 14 days', 'alert', noRec ? 'stat--alert' : ''), stat(rec30, `recognitions vs ${co30} coachings (30 days)`, 'heart')),
    needList.length
      ? h(
          'section',
          { class: 'card needs', 'aria-labelledby': 'needTitle' },
          h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'needTitle' }, icon('sparkle'), 'Who needs a touchpoint')),
          h(
            'ul',
            { class: 'rt-list' },
            needList.map(({ m, pu }) =>
              h(
                'li',
                { class: `rt-row rt-row--${pu.earned.length ? 'earned' : 'overdue'}` },
                h('span', { class: 'rt-row__icon', 'aria-hidden': 'true' }, icon(pu.earned.length ? 'award' : 'heart')),
                h('div', { class: 'rt-row__main' }, h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, memberLabel(m)), h('span', { class: `rt-due rt-due--${pu.earned.length ? 'done' : 'overdue'}` }, pu.flags[0].text)), pu.earned.length ? h('p', { class: 'rt-row__note' }, `Met: ${joinList(dedupe(pu.earned.map((e) => focusPhrase(e.opp))))}`) : null),
                h('div', { class: 'rt-row__actions' }, h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `need-rec:${m.id}`, onclick: () => openRecognize(m.id) }, icon('award'), 'Recognize'))
              )
            )
          )
        )
      : null,
    h('h2', { class: 'sr-only' }, 'Team members'),
    h('div', { class: 'pulse-grid' }, sorted.map(({ m }, i) => memberCard(m, i)))
  );
}
