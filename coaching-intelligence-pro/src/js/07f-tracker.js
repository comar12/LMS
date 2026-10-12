/* ==========================================================================
   07f-tracker: Follow-Up Tracker (plans started from the Builder, logged
   call reviews and check-ins, due dates, and progress written only from
   what was logged)
   ========================================================================== */

const RESULT_LABEL = { met: 'Met', miss: 'Not met', na: 'N/A' };

function planFocus(p) {
  return p.focus.map(getOpp).filter(Boolean);
}
const planCallFocus = (p) => planFocus(p).filter((o) => !isPeopleOpp(o));
const planCheckinFocus = (p) => planFocus(p).filter(isPeopleOpp);
const focusPhrase = (o) => (o.b && o.b.focus) || lowerTitle(o.title);

function planTitle(p) {
  const titles = planFocus(p).map((o) => o.title);
  if (!titles.length) return 'Coaching plan';
  return titles.length <= 2 ? titles.join(' and ') : `${titles.slice(0, 2).join(', ')} and ${plural(titles.length - 2, 'more')}`;
}

/** Targets and dates promised in the plan. Call behaviors are reviewed on calls; attendance and engagement in weekly check-ins. */
function planCounts(p) {
  const callFocus = planCallFocus(p);
  const checkFocus = planCheckinFocus(p);
  const calls = p.logs.filter((l) => l.kind === 'call').length;
  const checkins = p.logs.filter((l) => l.kind === 'checkin').length;
  const callTarget = callFocus.length ? p.calls : 0;
  const checkinTarget = checkFocus.length ? Math.max(1, Math.ceil(p.duration / 7)) : 0;
  return {
    calls,
    checkins,
    callTarget,
    checkinTarget,
    done: Math.min(calls, callTarget) + Math.min(checkins, checkinTarget),
    target: callTarget + checkinTarget,
    reviewBy: addDays(p.start, p.followup),
    end: addDays(p.start, p.duration),
  };
}

/** What is due next for an active plan, and how urgent it is. */
function planDue(p) {
  if (p.status === 'done') return { level: 'done', text: 'Completed', date: null };
  const c = planCounts(p);
  const items = [];
  if (c.calls < c.callTarget) items.push({ date: c.reviewBy, what: `${plural(c.callTarget - c.calls, 'call review')} to log` });
  if (c.checkins < c.checkinTarget) items.push({ date: addDays(p.start, Math.min(p.duration, 7 * (c.checkins + 1))), what: 'weekly check-in' });
  if (!items.length || daysFromToday(c.end) <= 0) items.push({ date: c.end, what: 'end-of-plan review' });
  items.sort((a, b) => (a.date < b.date ? -1 : 1));
  const next = items[0];
  const d = daysFromToday(next.date);
  if (d < 0) return { level: 'overdue', text: `Overdue: ${next.what} (was due ${fmtDay(next.date)})`, date: next.date };
  if (d === 0) return { level: 'due', text: `Due today: ${next.what}`, date: next.date };
  if (d <= 2) return { level: 'soon', text: `Due ${d === 1 ? 'tomorrow' : 'in two days'}: ${next.what}`, date: next.date };
  return { level: 'ok', text: `On track · next: ${next.what} by ${fmtDay(next.date)}`, date: next.date };
}

function trackerDueCount() {
  return state.tracker.plans.filter((p) => ['overdue', 'due'].includes(planDue(p).level)).length;
}

/* ---------- Progress text: only what was logged ---------- */
function resultSentence(o, met, n, unit) {
  const f = focusPhrase(o);
  const nw = numWord(n);
  if (met === n) return n === 1 ? `The expected standard for ${f} was met on the ${unit} reviewed.` : n === 2 ? `The expected standard for ${f} was met on both ${unit}s reviewed.` : `The expected standard for ${f} was met on all ${nw} ${unit}s reviewed.`;
  if (met === 0) return n === 1 ? `The expected standard for ${f} was not yet met on the ${unit} reviewed.` : `The expected standard for ${f} was not yet met on the ${nw} ${unit}s reviewed.`;
  return `The expected standard for ${f} was met on ${numWord(met)} of the ${nw} ${unit}s reviewed.`;
}

function focusTally(p, o, kind) {
  let met = 0;
  let n = 0;
  p.logs.forEach((l) => {
    if (l.kind !== kind) return;
    const r = l.results[o.id];
    if (r === 'met') met++;
    if (r === 'met' || r === 'miss') n++;
  });
  return { met, n };
}

function planProgressText(p) {
  const callLogs = p.logs.filter((l) => l.kind === 'call');
  const checkLogs = p.logs.filter((l) => l.kind === 'checkin');
  if (!callLogs.length && !checkLogs.length) return '';
  const out = [];
  const since = `Since our coaching session on ${fmtDay(p.start, true)}`;
  if (callLogs.length) {
    out.push(`${since}, I reviewed ${numWord(callLogs.length)} of your calls.`);
    planCallFocus(p).forEach((o) => {
      const t = focusTally(p, o, 'call');
      if (t.n) out.push(resultSentence(o, t.met, t.n, 'call'));
    });
  }
  if (checkLogs.length) {
    out.push(callLogs.length ? `We also held ${plural(checkLogs.length, 'check-in').replace(/^\d+/, numWord(checkLogs.length))}.` : `${since}, we held ${plural(checkLogs.length, 'check-in').replace(/^\d+/, numWord(checkLogs.length))}.`);
    planCheckinFocus(p).forEach((o) => {
      const t = focusTally(p, o, 'checkin');
      if (t.n) out.push(resultSentence(o, t.met, t.n, 'check-in').replace('check-ins reviewed', 'check-ins').replace('check-in reviewed', 'check-in'));
    });
  }
  return out.join(' ');
}

/* ---------- Actions ---------- */
function savePlans() {
  persist('tracker');
  renderSidebar();
}

function findPlan(id) {
  return state.tracker.plans.find((p) => p.id === id);
}

function labelField(value) {
  const input = h('input', { class: 'input', id: 'tr-label', type: 'text', value: value || '', maxlength: '40', autocomplete: 'off', placeholder: state.team.members.length ? `Choose a team code, such as ${state.team.members[0].code}` : 'Agent 3, Seat 12, or another code', list: 'tr-label-codes' });
  const codes = h('datalist', { id: 'tr-label-codes' }, state.team.members.map((m) => h('option', { value: m.code })));
  const warn = h('div');
  const check = () => {
    warn.replaceChildren();
    const n = piiNote(input.value);
    if (n) warn.appendChild(n);
  };
  input.addEventListener('input', check);
  check();
  return {
    input,
    node: h(
      'div',
      { class: 'field' },
      h('label', { class: 'field__label', for: 'tr-label' }, 'Who is this plan for?', h('span', { class: 'field__req', 'aria-hidden': 'true' }, '*')),
      input,
      codes,
      h('p', { class: 'field__hint' }, 'Use a code you will recognize, not a name. Never enter BPIDs, HRIDs, Avaya IDs, or other identifiers.'),
      warn
    ),
  };
}

/** Start tracking the plan currently in the Coaching Builder. */
function openTrackFromBuilder() {
  const opps = builderOpps();
  if (!opps.length) {
    toast('Add at least one opportunity to the Builder first.', { type: 'warn' });
    return;
  }
  const s = state.settings;
  const label = labelField('');
  const team = state.team.members.length > 0;
  // With a team set up, choose the person from the avatar grid; a code can still be typed for anyone else.
  const picker = team ? memberPicker({ value: null, label: 'Who is this plan for?', onChange: (x) => { label.input.value = x.code; err.hidden = true; } }) : null;
  const other = team
    ? h('details', { class: 'tr-other' }, h('summary', null, 'Someone not on your team? Type a code instead'), label.node)
    : null;
  const start = h('input', { class: 'input', id: 'tr-start', type: 'date', value: todayDay(), max: todayDay() });
  const err = h('p', { class: 'field__error', hidden: true }, 'Enter a code for this plan.');
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('calendar'), 'Start tracking');
  const hasCall = opps.some((o) => !isPeopleOpp(o));
  const hasPeople = opps.some(isPeopleOpp);
  const promise = [hasCall ? `review ${numWord(s.calls)} calls within ${followupPhrase(s.followup)}` : null, hasPeople ? 'hold a weekly check-in' : null].filter(Boolean);
  const m = openModal({
    title: 'Track this coaching plan',
    size: team ? 'lg' : 'md',
    body: h(
      'div',
      { class: 'tr-form' },
      team ? h('p', { class: 'field__label' }, 'Who is this plan for?') : label.node,
      team ? picker.el : null,
      other,
      err,
      h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { class: 'field__label', for: 'tr-start' }, 'Coaching session date'), start),
      h(
        'div',
        { class: 'tr-summary' },
        h('p', { class: 'tk-label' }, 'This plan'),
        h('ul', { class: 'tr-summary__list' }, opps.map((o) => h('li', null, h('span', { class: `chip__dot cat-${o.cat}`, style: 'background:var(--cc)' }), o.title))),
        h('p', { class: 'field__hint' }, `${durationTitle(s.duration)} plan. You committed to ${joinList(promise)}. The tracker reminds you when each is due.`)
      )
    ),
    footer: [cancel, h('span', { class: 'spacer' }), save],
    initialFocus: team ? '.mp__opt' : label.input,
  });
  cancel.addEventListener('click', () => m.close());
  save.addEventListener('click', () => {
    const text = label.input.value.trim();
    err.hidden = !!text;
    if (!text) {
      if (team) err.textContent = 'Choose a team member, or type a code.';
      (team ? m.el.querySelector('.mp__opt') : label.input).focus();
      return;
    }
    const plan = sanitizeTracker({ plans: [{ id: uid('plan'), label: text, start: isIsoDate(start.value) ? start.value : todayDay(), duration: s.duration, calls: s.calls, followup: s.followup, focus: opps.map((o) => o.id), logs: [] }] }).plans[0];
    state.tracker.plans.unshift(plan);
    savePlans();
    m.close();
    refresh({ panel: false });
    toast(`Tracking started for ${planWho(plan)}`, { action: { label: 'Open tracker', fn: () => navigate('tracker') } });
  });
}

function openLogDialog(planId, kind) {
  const p = findPlan(planId);
  if (!p) return;
  const focus = kind === 'call' ? planCallFocus(p) : planCheckinFocus(p);
  const picks = {};
  const date = h('input', { class: 'input', id: 'tr-date', type: 'date', value: todayDay(), min: p.start, max: todayDay() });
  const note = h('textarea', { class: 'textarea', id: 'tr-note', rows: '2', maxlength: '300', placeholder: 'Optional and private. Never copied into coaching text.' });
  const noteWarn = h('div');
  note.addEventListener('input', () => {
    noteWarn.replaceChildren();
    const n = piiNote(note.value);
    if (n) noteWarn.appendChild(n);
  });
  const err = h('p', { class: 'field__error', hidden: true }, 'Choose Met, Not met, or N/A for each behavior.');
  const rows = focus.map((o) => {
    const group = h('div', { class: 'tr-pick', role: 'group', 'aria-label': o.title });
    const draw = () =>
      group.replaceChildren(
        ...['met', 'miss', 'na'].map((v) =>
          h(
            'button',
            {
              type: 'button',
              class: `rv-btn rv-btn--${v === 'miss' ? 'gap' : v}`,
              'aria-pressed': String(picks[o.id] === v),
              onclick: () => {
                picks[o.id] = v;
                draw();
                group.querySelector(`[aria-pressed="true"]`).focus();
              },
            },
            RESULT_LABEL[v]
          )
        )
      );
    draw();
    return h('div', { class: 'tr-logrow' }, h('span', { class: 'tr-logrow__title' }, h('span', { class: `chip__dot cat-${o.cat}`, style: 'background:var(--cc)' }), o.title), group);
  });
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('check'), kind === 'call' ? 'Save call review' : 'Save check-in');
  const m = openModal({
    title: kind === 'call' ? `Log a call review · ${planWho(p)}` : `Log a check-in · ${planWho(p)}`,
    size: 'md',
    body: h(
      'div',
      { class: 'tr-form' },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'tr-date' }, kind === 'call' ? 'Call date' : 'Check-in date'), date),
      h('p', { class: 'field__label', style: 'margin-top:14px' }, kind === 'call' ? 'On this call, did you see the expected behavior?' : 'Since the last check-in, was the expected standard met?'),
      h('div', { class: 'tr-logrows' }, rows),
      err,
      h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { class: 'field__label', for: 'tr-note' }, 'Note'), note, noteWarn)
    ),
    footer: [cancel, h('span', { class: 'spacer' }), save],
    initialFocus: '.tr-pick button',
  });
  cancel.addEventListener('click', () => m.close());
  save.addEventListener('click', () => {
    const missing = focus.filter((o) => !picks[o.id]);
    err.hidden = !missing.length;
    if (missing.length) return;
    if (!isIsoDate(date.value) || date.value < p.start || date.value > todayDay()) {
      date.focus();
      toast('Choose a date between the coaching session and today.', { type: 'warn' });
      return;
    }
    p.logs.push({ id: uid('log'), kind, date: date.value, results: { ...picks }, note: note.value.trim().slice(0, 300) });
    p.logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    state.ui.flash = `plan:${p.id}`;
    savePlans();
    m.close();
    refresh({ panel: false });
    state.ui.flash = null;
    const c = planCounts(p);
    const mem = memberByCode(p.label);
    const anyMet = Object.values(picks).includes('met');
    toast(kind === 'call' ? `Call review logged (${Math.min(c.calls, c.callTarget)} of ${c.callTarget})` : 'Check-in logged', mem && anyMet ? { duration: 6000, action: { label: 'Recognize it', fn: () => openRecognize(mem.id) } } : {});
  });
}

function deleteLog(planId, logId) {
  const p = findPlan(planId);
  if (!p) return;
  const i = p.logs.findIndex((l) => l.id === logId);
  if (i < 0) return;
  const [removed] = p.logs.splice(i, 1);
  savePlans();
  refresh({ panel: false });
  toast('Entry deleted', { action: { label: 'Undo', fn: () => { p.logs.splice(i, 0, removed); savePlans(); refresh({ panel: false }); } } });
}

function setPlanStatus(planId, status) {
  const p = findPlan(planId);
  if (!p) return;
  p.status = status;
  savePlans();
  refresh({ panel: false });
  toast(status === 'done' ? `Plan for ${planWho(p)} marked complete` : `Plan for ${planWho(p)} reopened`);
}

function extendPlan(planId) {
  const p = findPlan(planId);
  if (!p) return;
  p.duration = Math.min(60, p.duration * 2);
  p.status = 'active';
  savePlans();
  refresh({ panel: false });
  toast(`Plan extended to ${durationPhrase(p.duration)}`);
}

async function deletePlan(planId) {
  const p = findPlan(planId);
  if (!p) return;
  if (!(await confirmDialog({ title: `Delete the plan for ${planWho(p)}?`, message: 'The plan and everything logged on it will be removed from this browser. Export a backup first if you might need it.', confirmLabel: 'Delete plan', danger: true }))) return;
  state.tracker.plans = state.tracker.plans.filter((x) => x.id !== planId);
  savePlans();
  refresh({ panel: false });
  toast('Plan deleted');
}

async function useProgressInBuilder(planId) {
  const p = findPlan(planId);
  const text = p && planProgressText(p);
  if (!text) return;
  const cur = state.builder.notes.progress.trim();
  if (cur && cur !== text && !(await confirmDialog({ title: 'Replace the progress note?', message: 'The Builder already has a progress note. Replace it with the results logged for this plan?', confirmLabel: 'Replace note' }))) return;
  state.builder.notes.progress = text;
  persist('builder');
  toast('Progress added to the Builder', { action: { label: 'Open Builder', fn: () => navigate('builder') } });
  navigate('builder');
}

/* ---------- Rendering ---------- */
function planTimeline(p) {
  const c = planCounts(p);
  const span = Math.max(1, p.duration);
  const pos = (d) => `${Math.max(0, Math.min(100, ((parseDay(d) - parseDay(p.start)) / 86400000 / span) * 100))}%`;
  const today = todayDay();
  const marks = p.logs.map((l) => {
    const vals = Object.values(l.results).filter((v) => v !== 'na');
    const ok = vals.length && vals.every((v) => v === 'met');
    const some = vals.some((v) => v === 'met');
    return h('span', { class: `tl-dot ${ok ? 'is-met' : some ? 'is-mixed' : 'is-miss'}${l.kind === 'checkin' ? ' is-checkin' : ''}`, style: `left:${pos(l.date)}`, title: `${fmtDay(l.date)} · ${l.kind === 'call' ? 'call review' : 'check-in'}` });
  });
  return h(
    'div',
    { class: 'tl', 'aria-hidden': 'true' },
    h('div', { class: 'tl__track' }, h('span', { class: 'tl__fill', style: `width:${today >= c.end ? '100%' : pos(today)}` })),
    c.callTarget ? h('span', { class: 'tl__flag', style: `left:${pos(c.reviewBy)}` }, h('span', null, `Reviews by ${fmtDay(c.reviewBy)}`)) : null,
    today > p.start && today < c.end ? h('span', { class: 'tl__today', style: `left:${pos(today)}` }) : null,
    marks,
    h('div', { class: 'tl__ends' }, h('span', null, fmtDay(p.start)), h('span', null, fmtDay(c.end)))
  );
}

function focusBars(p) {
  const rows = [];
  planFocus(p).forEach((o) => {
    const kind = isPeopleOpp(o) ? 'checkin' : 'call';
    const t = focusTally(p, o, kind);
    const pct = t.n ? Math.round((t.met / t.n) * 100) : 0;
    rows.push(
      h(
        'li',
        { class: 'fb' },
        h('span', { class: 'fb__name' }, h('span', { class: `chip__dot cat-${o.cat}`, style: 'background:var(--cc)' }), o.title),
        h('span', { class: 'fb__bar', 'aria-hidden': 'true' }, h('span', { class: `fb__fill${t.n && t.met < t.n ? ' is-partial' : ''}`, style: `width:${t.n ? Math.max(pct, 4) : 0}%` })),
        h('span', { class: 'fb__num' }, t.n ? `${t.met}/${t.n} met` : 'not logged')
      )
    );
  });
  return h('ul', { class: 'fb-list' }, rows);
}

function planCard(p) {
  const c = planCounts(p);
  const due = planDue(p);
  const history = p.logs.slice().reverse();
  const text = planProgressText(p);
  const mem = memberByCode(p.label);
  const initials = mem ? initialsOf(mem) : p.label.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '#';
  return h(
    'article',
    { class: `plan plan--${due.level}${state.ui.flash === `plan:${p.id}` ? ' is-flash' : ''}`, 'aria-labelledby': `plan-${p.id}` },
    h(
      'div',
      { class: 'plan__head' },
      h('span', { class: 'plan__avatar', 'aria-hidden': 'true' }, initials),
      h('div', { class: 'plan__who' }, h('h2', { class: 'plan__label', id: `plan-${p.id}` }, planWho(p)), h('p', { class: 'plan__title' }, mem && mem.name ? `${mem.code} · ${planTitle(p)}` : planTitle(p))),
      h('span', { class: `due-chip due-chip--${due.level}` }, icon(due.level === 'done' ? 'check' : due.level === 'ok' ? 'calendar' : 'alert', 'icon--sm'), due.text)
    ),
    h(
      'div',
      { class: 'plan__body' },
      progressRing(c.done, c.target, `${c.done} of ${c.target} follow-ups logged`, `plan:${p.id}`),
      h(
        'div',
        { class: 'plan__main' },
        planTimeline(p),
        h(
          'p',
          { class: 'plan__meta' },
          `${durationTitle(p.duration)} plan from ${fmtDay(p.start)}`,
          c.callTarget ? ` · ${c.calls} of ${c.callTarget} call reviews` : '',
          c.checkinTarget ? ` · ${plural(c.checkins, 'check-in')}` : ''
        ),
        focusBars(p)
      )
    ),
    h(
      'div',
      { class: 'plan__actions' },
      p.status === 'active' && c.callTarget ? h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `tr-log:${p.id}`, onclick: () => openLogDialog(p.id, 'call') }, icon('plus'), 'Log call review') : null,
      p.status === 'active' && c.checkinTarget ? h('button', { type: 'button', class: `btn btn--sm${c.callTarget ? '' : ' btn--primary'}`, 'data-fk': `tr-check:${p.id}`, onclick: () => openLogDialog(p.id, 'checkin') }, icon('calendar'), 'Log check-in') : null,
      copyButton(() => planProgressText(p), { label: 'Copy progress', srLabel: `Copy progress for ${planWho(p)}`, fk: `tr-copy:${p.id}`, emptyMessage: 'Log at least one call review or check-in first. Progress is written only from what you log.' }),
      h('button', { type: 'button', class: 'btn btn--sm', disabled: !text, 'data-fk': `tr-use:${p.id}`, onclick: () => useProgressInBuilder(p.id) }, icon('clipboard'), 'Use in Builder'),
      h('span', { class: 'toolbar__spacer' }),
      menuButton({
        label: 'Plan',
        fk: `tr-menu:${p.id}`,
        items: [
          p.status === 'active' ? { label: 'Mark plan complete', icon: 'check', onSelect: () => setPlanStatus(p.id, 'done') } : { label: 'Reopen plan', icon: 'refresh', onSelect: () => setPlanStatus(p.id, 'active') },
          { label: 'Extend plan (double the length)', icon: 'calendar', onSelect: () => extendPlan(p.id) },
          { label: 'Delete plan', icon: 'trash', onSelect: () => deletePlan(p.id) },
        ],
      })
    ),
    history.length
      ? h(
          'details',
          { class: 'plan__history' },
          h('summary', null, `History (${history.length})`),
          h(
            'ul',
            null,
            history.map((l) => {
              const vals = Object.entries(l.results);
              const met = vals.filter(([, v]) => v === 'met').length;
              const miss = vals.filter(([, v]) => v === 'miss').length;
              return h(
                'li',
                { class: 'hist' },
                icon(l.kind === 'call' ? 'checklist' : 'calendar', 'icon--sm'),
                h('span', { class: 'hist__date' }, fmtDay(l.date)),
                h('span', { class: 'hist__what' }, `${l.kind === 'call' ? 'Call review' : 'Check-in'}: ${met} met${miss ? `, ${miss} not met` : ''}`),
                l.note ? h('span', { class: 'hist__note' }, l.note) : null,
                h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Delete ${l.kind === 'call' ? 'call review' : 'check-in'} from ${fmtDay(l.date)}`, onclick: () => deleteLog(p.id, l.id) }, icon('trash'))
              );
            })
          )
        )
      : null
  );
}

function renderTracker(main) {
  const plans = state.tracker.plans;
  const active = plans.filter((p) => p.status === 'active');
  const dues = active.map(planDue);
  const weekAgo = addDays(todayDay(), -6);
  const loggedWeek = plans.reduce((n, p) => n + p.logs.filter((l) => l.date >= weekAgo).length, 0);
  const filter = state.prefs.trackerFilter;
  const shown = plans
    .filter((p) => (filter === 'all' ? true : filter === 'done' ? p.status === 'done' : p.status === 'active'))
    .slice()
    .sort((a, b) => {
      const order = { overdue: 0, due: 1, soon: 2, ok: 3, done: 4 };
      const da = planDue(a);
      const db = planDue(b);
      return order[da.level] - order[db.level] || String(da.date).localeCompare(String(db.date));
    });
  const stat = (n, label, iconName, cls) => h('div', { class: `stat${cls ? ' ' + cls : ''}` }, h('span', { class: 'stat__icon', 'aria-hidden': 'true' }, icon(iconName)), h('span', { class: 'stat__num', 'data-count': String(n) }, String(n)), h('span', { class: 'stat__label' }, label));
  put(main, 
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-own', style: 'width:22px;height:22px;border-radius:6px' }, icon('calendar', 'icon--sm')), 'Coaching'],
      title: 'Follow-Up Tracker',
      sub: 'Every coaching plan promises reviews and check-ins. Log what you actually see, and the tracker shows what is due and writes the progress section from your results only.',
      actions: h('a', { class: 'btn btn--sm', href: '#/builder', 'data-fk': 'tr-to-builder' }, icon('clipboard'), 'Start a plan in the Builder'),
    }),
    h('p', { class: 'notice notice--privacy', role: 'note', style: 'margin-bottom:16px' }, icon('lock'), h('span', { class: 'notice__body' }, 'Plans are saved only in this browser. Label them with a code such as Agent 3 or Seat 12, never a name or an ID. Labels and notes are never copied into coaching text.')),
    h(
      'div',
      { class: 'stats' },
      stat(active.length, 'active plans', 'calendar'),
      stat(dues.filter((d) => d.level === 'overdue').length, 'overdue', 'alert', dues.some((d) => d.level === 'overdue') ? 'stat--alert' : ''),
      stat(dues.filter((d) => d.level === 'due' || d.level === 'soon').length, 'due in the next two days', 'flag'),
      stat(loggedWeek, 'logged in the last 7 days', 'check')
    ),
    plans.length
      ? h(
          'div',
          { class: 'toolbar', style: 'margin-top:20px' },
          segmented({
            label: 'Show plans',
            value: filter,
            fkPrefix: 'tr-filter',
            options: [
              { value: 'active', label: `Active (${active.length})` },
              { value: 'done', label: `Completed (${plans.length - active.length})` },
              { value: 'all', label: 'All' },
            ],
            onChange: (v) => {
              state.prefs.trackerFilter = v;
              persist('prefs');
              refresh({ panel: false });
            },
          })
        )
      : null,
    plans.length
      ? shown.length
        ? h('div', { class: 'plans' }, shown.map(planCard))
        : emptyState({ iconName: 'check', title: filter === 'done' ? 'No completed plans yet' : 'No active plans', text: 'Change the filter to see other plans.' })
      : h(
          'div',
          { style: 'margin-top:20px' },
          emptyState({
            iconName: 'calendar',
            title: 'No plans tracked yet',
            text: 'Build the coaching in the Coaching Builder, then choose Track this plan. The tracker will remind you when call reviews and check-ins are due.',
            action: h('a', { class: 'btn btn--primary btn--sm', href: '#/builder', 'data-fk': 'tr-empty' }, icon('clipboard'), 'Open the Coaching Builder'),
          })
        )
  );
  if (main.classList.contains('anim-enter')) countUp(main);
}
