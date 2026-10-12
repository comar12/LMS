/* ==========================================================================
   07l-team: Team Pulse (one card per agent code: recognition, one-on-ones,
   coaching balance) and earned recognition built from logged results
   ========================================================================== */

const sameCode = (a, b) => normalizeText(a) === normalizeText(b);
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
  state.ui.flash = `mem:${memberId}`;
  refresh({ panel: false });
  state.ui.flash = null;
  const m = state.team.members.find((x) => x.id === memberId);
  const label = { recognition: 'Recognition', oneonone: 'One-on-one', stay: 'Stay conversation' }[kind];
  toast(`${label} logged for ${m ? m.code : 'this agent'}`, {
    action: { label: 'Undo', fn: () => { state.team.touches = state.team.touches.filter((x) => x.id !== t.id); saveTeam(); refresh({ panel: false }); } },
  });
}

/* ---------- Recognition dialog ---------- */
function openRecognize(memberId) {
  const members = state.team.members;
  if (!members.length) return;
  let m = members.find((x) => x.id === memberId) || members[0];
  const who = h('select', { class: 'select', id: 'rc-member' }, members.map((x) => h('option', { value: x.id, selected: x.id === m.id }, x.code)));
  const source = h('select', { class: 'select', id: 'rc-source' });
  const strength = h('select', { class: 'select', id: 'rc-strength' }, S_GROUPS.map((g) => h('optgroup', { label: g.label }, content.strengths.filter((s) => s.group === g.id).map((s) => h('option', { value: s.id }, s.title)))));
  const strengthField = h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rc-strength' }, 'Strength you observed'), strength);
  const text = h('textarea', { class: 'textarea', id: 'rc-text', rows: '6' });
  const hint = h('p', { class: 'field__hint' });
  const fillSources = () => {
    const earned = earnedText(m);
    source.replaceChildren(
      earned ? h('option', { value: 'earned' }, 'Earned: results logged in the tracker') : null,
      h('option', { value: 'strength' }, 'A strength you observed'),
      h('option', { value: 'own' }, 'Write my own')
    );
  };
  const fillText = () => {
    strengthField.hidden = source.value !== 'strength';
    if (source.value === 'earned') {
      text.value = earnedText(m);
      hint.textContent = 'Written only from the results you logged. Edit it before sending if you like.';
    } else if (source.value === 'strength') {
      const s = getStrength(strength.value);
      text.value = s ? s.v[0] : '';
      hint.textContent = 'Only send this if you actually observed it. Choose the strength that matches what you saw.';
    } else {
      text.value = '';
      hint.textContent = 'Be specific: what they did and why it mattered.';
    }
  };
  fillSources();
  fillText();
  who.addEventListener('change', () => {
    m = members.find((x) => x.id === who.value) || m;
    fillSources();
    fillText();
  });
  source.addEventListener('change', fillText);
  strength.addEventListener('change', fillText);
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const copy = copyButton(() => text.value.trim(), { label: 'Copy message', srLabel: 'Copy recognition message', size: 'md', fk: 'rc-copy', emptyMessage: 'Write the message first.' });
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('award'), 'Log as recognized');
  const dlg = openModal({
    title: 'Recognize',
    size: 'md',
    body: h(
      'div',
      { class: 'tr-form' },
      h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rc-member' }, 'Agent'), who), h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rc-source' }, 'Based on'), source)),
      strengthField,
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rc-text' }, 'Message'), text, hint),
      h('p', { class: 'hint' }, icon('lock'), 'Only the date is saved, never the message. Add the agent’s name when you send it, outside this app.')
    ),
    footer: [cancel, h('span', { class: 'spacer' }), copy, save],
    initialFocus: text,
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
      h('p', { class: 'prose' }, 'Each agent gets a numbered code such as Agent 01. Keep the list of who is who in your own records. Never type names, HRIDs, or BP-IDs here.'),
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
  if (!(await confirmDialog({ title: `Remove ${m.code}?`, message: 'Their recognition and one-on-one dates are removed from Team Pulse. Follow-up plans in the tracker are kept.', confirmLabel: 'Remove', danger: true }))) return;
  state.team.members = state.team.members.filter((x) => x.id !== id);
  state.team.touches = state.team.touches.filter((t) => t.member !== id);
  saveTeam();
  refresh({ panel: false });
}

async function renameMember(id) {
  const m = state.team.members.find((x) => x.id === id);
  if (!m) return;
  const code = await promptDialog({ title: 'Edit code', label: 'Code', value: m.code, hint: 'A code you recognize, such as Agent 03 or Seat 12. No names or IDs.', maxLength: 30 });
  if (!code || !code.trim()) return;
  const old = m.code;
  m.code = code.trim();
  // Keep tracker plans connected to the renamed code.
  state.tracker.plans.forEach((p) => {
    if (sameCode(p.label, old)) p.label = m.code;
  });
  persist('tracker');
  saveTeam();
  refresh({ panel: false });
}

/* ---------- Page ---------- */
function memberCard(m) {
  const pu = memberPulse(m);
  const initials = m.code.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w, i, a) => (i === a.length - 1 && /^\d+$/.test(w) ? w : w[0])).join('').slice(0, 4).toUpperCase();
  const top = pu.flags[0];
  const recBar = Math.min(pu.rec30, 6);
  const coBar = Math.min(pu.coached30, 6);
  const ago = (d, none) => (d === null ? none : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
  return h(
    'article',
    { class: `pulse pulse--${top ? top.level : 'ok'}${state.ui.flash === `mem:${m.id}` ? ' is-flash' : ''}`, 'aria-labelledby': `mem-${m.id}` },
    h(
      'div',
      { class: 'pulse__head' },
      h('span', { class: 'plan__avatar pulse__avatar', 'aria-hidden': 'true' }, initials || '#'),
      h('div', { class: 'pulse__who' }, h('h2', { class: 'plan__label', id: `mem-${m.id}` }, m.code), h('p', { class: 'plan__title' }, pu.active ? `${plural(pu.active, 'active plan')}${pu.due ? `, ${pu.due} due` : ''}` : 'No active plans')),
      menuButton({
        label: 'More',
        fk: `mem-menu:${m.id}`,
        items: [
          { label: 'Log stay conversation', icon: 'heart', onSelect: () => logTouch(m.id, 'stay') },
          { label: 'Edit code', icon: 'edit', onSelect: () => renameMember(m.id) },
          { label: 'Remove from team', icon: 'trash', onSelect: () => removeMember(m.id) },
        ],
      })
    ),
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
      h('span', { class: 'balance__row' }, h('span', { class: 'balance__name' }, 'Recognized'), h('span', { class: 'balance__pips' }, Array.from({ length: 6 }, (_, i) => h('span', { class: `pip${i < recBar ? ' pip--rec' : ''}` }))), h('strong', null, String(pu.rec30))),
      h('span', { class: 'balance__row' }, h('span', { class: 'balance__name' }, 'Coached'), h('span', { class: 'balance__pips' }, Array.from({ length: 6 }, (_, i) => h('span', { class: `pip${i < coBar ? ' pip--co' : ''}` }))), h('strong', null, String(pu.coached30)))
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

function renderTeam(main) {
  const members = state.team.members;
  if (!members.length) {
    put(
      main,
      pageHead({ eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('heart', 'icon--sm')), 'Team'], title: 'Team Pulse', sub: 'One card per agent: when they were last recognized, when you last talked one-on-one, and whether coaching and recognition are in balance. People stay with leaders who notice their good work, not only their gaps.' }),
      emptyState({ iconName: 'users', title: 'Set up your team', text: 'Add a numbered code for each agent, such as Agent 01 to Agent 16. Use codes only, never names, HRIDs, or BP-IDs, and keep the list of who is who in your own records.', action: h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-fk': 'tm-setup', onclick: openAddMembers }, icon('plus'), 'Add team members') })
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
      actions: h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'tm-add', onclick: openAddMembers }, icon('plus'), 'Add members'),
    }),
    h('p', { class: 'notice notice--privacy', role: 'note', style: 'margin-bottom:16px' }, icon('lock'), h('span', { class: 'notice__body' }, 'Codes only. Never enter names, HRIDs, or BP-IDs. Only dates are saved, never message text, and Team Pulse is never included in a team pack.')),
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
                h('div', { class: 'rt-row__main' }, h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, m.code), h('span', { class: `rt-due rt-due--${pu.earned.length ? 'done' : 'overdue'}` }, pu.flags[0].text)), pu.earned.length ? h('p', { class: 'rt-row__note' }, `Met: ${joinList(dedupe(pu.earned.map((e) => focusPhrase(e.opp))))}`) : null),
                h('div', { class: 'rt-row__actions' }, h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `need-rec:${m.id}`, onclick: () => openRecognize(m.id) }, icon('award'), 'Recognize'))
              )
            )
          )
        )
      : null,
    h('h2', { class: 'sr-only' }, 'Team members'),
    h('div', { class: 'pulse-grid' }, sorted.map(({ m }) => memberCard(m)))
  );
  if (main.classList.contains('anim-enter')) countUp(main);
}
