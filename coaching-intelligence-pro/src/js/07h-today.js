/* ==========================================================================
   07h-today: My Day (daily and weekly routine with counters, follow-ups due,
   and today's huddle suggestion)
   ========================================================================== */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weeks start on Monday, so a Thursday item is due once per Monday-to-Sunday week. */
function weekStart(day) {
  const d = parseDay(day);
  return addDays(day, -((d.getDay() + 6) % 7));
}
const routineKey = (r) => (r.freq === 'weekly' ? weekStart(todayDay()) : todayDay());
const routineCount = (r) => (state.today.progress[routineKey(r)] || {})[r.id] || 0;
const routineDone = (r) => routineCount(r) >= r.target;

/** Resolves a routine's link by Quick Link id or by part of its name. */
function routineLink(r) {
  if (!r.link) return null;
  const needle = normalizeText(r.link);
  const l = state.links.items.find((x) => x.id === r.link) || state.links.items.find((x) => normalizeText(x.name).includes(needle));
  return l && linkTarget(l.url) ? l : null;
}

function routineDue(r) {
  if (routineDone(r)) return { level: 'done', text: r.freq === 'weekly' ? 'Done this week' : 'Done today' };
  if (r.freq === 'daily') return { level: 'due', text: 'Due today' };
  const today = (parseDay(todayDay()).getDay() + 6) % 7;
  const due = (r.day + 6) % 7;
  if (today === due) return { level: 'due', text: 'Due today' };
  if (today > due) return { level: 'overdue', text: `Was due ${WEEKDAYS[r.day]}` };
  return { level: 'later', text: `Due ${WEEKDAYS[r.day]}` };
}

function todayOpenCount() {
  return state.today.routines.filter((r) => ['due', 'overdue'].includes(routineDue(r).level)).length;
}

function setRoutineCount(r, n) {
  const key = routineKey(r);
  const day = state.today.progress[key] || (state.today.progress[key] = {});
  day[r.id] = Math.max(0, Math.min(50, n));
  persist('today');
  const sel = `[data-fk="rt-${r.kind === 'count' ? 'plus' : 'check'}:${r.id}"]`;
  const el = document.querySelector(sel);
  const before = el ? el.getBoundingClientRect() : null;
  state.ui.flash = `rt:${r.id}`;
  refresh({ panel: false });
  state.ui.flash = null;
  if (n >= r.target && n - 1 < r.target) {
    announce(`${r.title} done`);
    celebrateAt(sel, before);
  }
}

function openRoutineEditor(existing) {
  const src = existing || { title: '', kind: 'check', target: 1, freq: 'daily', day: 4, note: '', link: '' };
  const title = h('input', { class: 'input', id: 'rt-title', type: 'text', value: src.title, maxlength: '60', autocomplete: 'off' });
  const kind = h('select', { class: 'select', id: 'rt-kind' }, h('option', { value: 'check', selected: src.kind === 'check' }, 'Done or not done'), h('option', { value: 'count', selected: src.kind === 'count' }, 'Count up to a target'));
  const target = h('input', { class: 'input', id: 'rt-target', type: 'number', min: '1', max: '50', value: String(src.target) });
  const freq = h('select', { class: 'select', id: 'rt-freq' }, h('option', { value: 'daily', selected: src.freq === 'daily' }, 'Every day'), h('option', { value: 'weekly', selected: src.freq === 'weekly' }, 'Once a week'));
  const day = h('select', { class: 'select', id: 'rt-day' }, WEEKDAYS.map((w, i) => h('option', { value: String(i), selected: i === src.day }, w)));
  const note = h('input', { class: 'input', id: 'rt-note', type: 'text', value: src.note, maxlength: '120', autocomplete: 'off', placeholder: 'For example: 4 calls per day' });
  const link = h('select', { class: 'select', id: 'rt-link' }, h('option', { value: '' }, 'No link'), state.links.items.filter((l) => linkTarget(l.url)).map((l) => h('option', { value: l.id, selected: routineLink(src) && routineLink(src).id === l.id }, l.name)));
  const targetField = h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rt-target' }, 'Target'), target);
  const dayField = h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rt-day' }, 'Due on'), day);
  const sync = () => {
    targetField.hidden = kind.value !== 'count';
    dayField.hidden = freq.value !== 'weekly';
  };
  kind.addEventListener('change', sync);
  freq.addEventListener('change', sync);
  sync();
  const err = h('p', { class: 'field__error', hidden: true }, 'Enter a name.');
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('save'), existing ? 'Save' : 'Add to routine');
  const m = openModal({
    title: existing ? 'Edit routine item' : 'Add a routine item',
    size: 'md',
    body: h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'field span-2' }, h('label', { class: 'field__label', for: 'rt-title' }, 'Name', h('span', { class: 'field__req', 'aria-hidden': 'true' }, '*')), title, err),
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rt-kind' }, 'Type'), kind),
      targetField,
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rt-freq' }, 'How often'), freq),
      dayField,
      h('div', { class: 'field span-2' }, h('label', { class: 'field__label', for: 'rt-note' }, 'Note'), note),
      h('div', { class: 'field span-2' }, h('label', { class: 'field__label', for: 'rt-link' }, 'Open from Quick Links'), link, state.links.items.length ? null : h('p', { class: 'field__hint' }, 'Add the form or dashboard in Quick Links to open it from here.'))
    ),
    footer: [cancel, h('span', { class: 'spacer' }), save],
    initialFocus: title,
  });
  cancel.addEventListener('click', () => m.close());
  save.addEventListener('click', () => {
    if (!title.value.trim()) {
      err.hidden = false;
      title.focus();
      return;
    }
    const item = sanitizeRoutines([{ id: existing ? existing.id : uid('rt'), title: title.value, kind: kind.value, target: Number(target.value), freq: freq.value, day: Number(day.value), note: note.value, link: link.value }])[0];
    const i = existing ? state.today.routines.findIndex((r) => r.id === existing.id) : -1;
    if (i >= 0) state.today.routines[i] = item;
    else state.today.routines.push(item);
    persist('today');
    m.close();
    refresh({ panel: false });
    renderSidebar();
    toast(existing ? 'Routine item saved' : `Added ${item.title}`);
  });
}

function deleteRoutine(id) {
  const list = state.today.routines;
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return;
  const [removed] = list.splice(i, 1);
  persist('today');
  refresh({ panel: false });
  renderSidebar();
  toast(`Removed ${removed.title}`, { action: { label: 'Undo', fn: () => { state.today.routines.splice(i, 0, removed); persist('today'); refresh({ panel: false }); renderSidebar(); } } });
}

function routineRow(r) {
  const n = routineCount(r);
  const due = routineDue(r);
  const link = routineLink(r);
  const done = due.level === 'done';
  const control =
    r.kind === 'count'
      ? h(
          'div',
          { class: 'rt-counter', role: 'group', 'aria-label': `${r.title} count` },
          h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `One fewer: ${r.title}`, disabled: n <= 0, 'data-fk': `rt-minus:${r.id}`, onclick: () => setRoutineCount(r, n - 1) }, h('span', { 'aria-hidden': 'true', class: 'rt-counter__sign' }, '−')),
          h('span', { class: 'rt-counter__num', 'aria-live': 'polite' }, h('strong', null, String(n)), ` / ${r.target}`),
          h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `One more: ${r.title}`, disabled: n >= 50, 'data-fk': `rt-plus:${r.id}`, onclick: () => setRoutineCount(r, n + 1) }, icon('plus'))
        )
      : h('button', { type: 'button', class: `btn btn--sm rt-check${done ? ' is-done' : ''}`, 'aria-pressed': String(done), 'data-fk': `rt-check:${r.id}`, onclick: () => setRoutineCount(r, done ? 0 : 1) }, icon('check'), done ? 'Done' : 'Mark done');
  const pct = Math.min(100, Math.round((n / r.target) * 100));
  return h(
    'li',
    { class: `rt-row rt-row--${due.level}${state.ui.flash === `rt:${r.id}` ? ' is-flash' : ''}` },
    h('span', { class: 'rt-row__icon', 'aria-hidden': 'true' }, icon(done ? 'check' : r.freq === 'weekly' ? 'calendar' : 'pulse')),
    h(
      'div',
      { class: 'rt-row__main' },
      h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, r.title), h('span', { class: `rt-due rt-due--${due.level}` }, due.text)),
      r.note ? h('p', { class: 'rt-row__note' }, r.note) : null,
      r.kind === 'count' ? h('span', { class: 'rt-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${pct}%` })) : null
    ),
    h(
      'div',
      { class: 'rt-row__actions' },
      control,
      link ? h('a', { class: 'btn btn--sm', href: linkTarget(link.url), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${link.name} (new tab)`, 'data-fk': `rt-open:${r.id}` }, icon('external'), 'Open') : null,
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Edit ${r.title}`, 'data-fk': `rt-edit:${r.id}`, onclick: () => openRoutineEditor(r) }, icon('edit')),
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove ${r.title}`, 'data-fk': `rt-del:${r.id}`, onclick: () => deleteRoutine(r.id) }, icon('trash'))
    )
  );
}

/** Today's list: routine items due today plus follow-ups due soon, and how many are done. */
function dayProgress() {
  const todayItems = state.today.routines.filter((r) => routineDue(r).level !== 'later' || r.freq === 'daily');
  const plans = state.tracker.plans.filter((p) => p.status === 'active').map((p) => ({ p, due: planDue(p) })).filter((x) => ['overdue', 'due', 'soon'].includes(x.due.level));
  return { todayItems, plans, finished: todayItems.filter(routineDone).length, total: todayItems.length + plans.length };
}

function renderToday(main) {
  const routines = state.today.routines;
  const { todayItems, plans, finished: doneN } = dayProgress();
  const sug = huddleSuggestions().items[0];
  const sugOpp = sug && getOpp(sug.id);
  const dateText = parseDay(todayDay()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const total = todayItems.length + plans.length;
  const finished = doneN;
  put(
    main,
    h(
      'section',
      { class: 'day-hero', 'aria-labelledby': 'pageTitle' },
      progressRing(finished, Math.max(total, 1), `${finished} of ${total} items done today`, 'today'),
      h(
        'div',
        { class: 'day-hero__text' },
        h('p', { class: 'day-hero__date' }, dateText),
        h('h1', { class: 'page-title', id: 'pageTitle' }, 'My Day'),
        h('p', { class: 'day-hero__sub' }, total ? (finished >= total ? 'Everything on your list is done. Nice work today.' : `${plural(total - finished, 'item')} left: your routine, plus the follow-ups that are due.`) : 'Add your daily routine below to start your day here.'),
        h('button', { type: 'button', class: 'btn btn--sm day-hero__eod', 'data-fk': 'day-eod', onclick: () => { const t = document.getElementById('eod'); if (t) { t.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); focusByKey('eod-fill'); } } }, icon('megaphone'), 'End-of-day summary')
      )
    ),
    h(
      'section',
      { class: 'card day-sec', 'aria-labelledby': 'dayRoutine' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'dayRoutine' }, icon('checklist'), 'Routine'), h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'rt-add', onclick: () => openRoutineEditor(null) }, icon('plus'), 'Add item')),
      routines.length
        ? h('ul', { class: 'rt-list' }, routines.map(routineRow))
        : h('div', { class: 'card__body' }, emptyState({ iconName: 'checklist', title: 'No routine items', text: 'Add the scrubbing, audits, forms, and checks you do every day or every week.' }))
    ),
    h(
      'section',
      { class: 'card day-sec', 'aria-labelledby': 'dayFollow' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'dayFollow' }, icon('calendar'), 'Follow-ups due'), h('a', { class: 'btn btn--sm btn--ghost', href: '#/tracker', 'data-fk': 'day-tracker' }, 'All plans', icon('arrow-right'))),
      plans.length
        ? h(
            'ul',
            { class: 'rt-list' },
            plans.map(({ p, due }) => {
              const c = planCounts(p);
              return h(
                'li',
                { class: `rt-row rt-row--${due.level === 'overdue' ? 'overdue' : 'due'}` },
                h('span', { class: 'rt-row__icon', 'aria-hidden': 'true' }, icon('calendar')),
                h('div', { class: 'rt-row__main' }, h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, planWho(p)), h('span', { class: `rt-due rt-due--${due.level === 'overdue' ? 'overdue' : 'due'}` }, due.text)), h('p', { class: 'rt-row__note' }, planTitle(p))),
                h(
                  'div',
                  { class: 'rt-row__actions' },
                  c.calls < c.callTarget ? h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `day-log:${p.id}`, onclick: () => openLogDialog(p.id, 'call') }, icon('plus'), 'Log call review') : null,
                  c.checkins < c.checkinTarget ? h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `day-check:${p.id}`, onclick: () => openLogDialog(p.id, 'checkin') }, icon('calendar'), 'Log check-in') : null
                )
              );
            })
          )
        : h('p', { class: 'day-empty' }, icon('check'), 'No follow-ups are due in the next two days.')
    ),
    (() => {
      const list = state.team.members.map((m) => ({ m, pu: memberPulse(m) })).filter((x) => x.pu.earned.length || x.pu.dRec === null || x.pu.dRec >= 14).sort((a, b) => b.pu.need - a.pu.need).slice(0, 3);
      if (!state.team.members.length || !list.length) return null;
      return h(
        'section',
        { class: 'card day-sec', 'aria-labelledby': 'dayRec' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'dayRec' }, icon('award'), 'Recognition today'), h('a', { class: 'btn btn--sm btn--ghost', href: '#/team', 'data-fk': 'day-team' }, 'Team Pulse', icon('arrow-right'))),
        h(
          'ul',
          { class: 'rt-list' },
          list.map(({ m, pu }) =>
            h(
              'li',
              { class: `rt-row rt-row--${pu.earned.length ? 'earned' : 'due'}` },
              h('span', { class: 'rt-row__icon', 'aria-hidden': 'true' }, icon(pu.earned.length ? 'award' : 'heart')),
              h('div', { class: 'rt-row__main' }, h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, memberLabel(m)), h('span', { class: `rt-due rt-due--${pu.earned.length ? 'done' : 'due'}` }, pu.flags[0].text))),
              h('div', { class: 'rt-row__actions' }, h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `day-rec:${m.id}`, onclick: () => openRecognize(m.id) }, icon('award'), 'Recognize'))
            )
          )
        )
      );
    })(),
    sugOpp
      ? h(
          'section',
          { class: 'day-huddle', 'aria-label': "Today's huddle idea" },
          h('span', { class: 'day-huddle__icon', 'aria-hidden': 'true' }, icon('megaphone')),
          h('div', { class: 'day-huddle__text' }, h('p', { class: 'tk-label' }, "Today's huddle idea"), h('p', { class: 'day-huddle__title' }, sugOpp.title), h('p', { class: 'day-huddle__sub' }, sug.misses ? `Not met ${plural(sug.misses, 'time')} in your tracker over the last two weeks.` : 'A starter idea. Log call reviews to get suggestions from your own results.')),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--primary btn--sm',
              'data-fk': 'day-huddle',
              onclick: () => {
                state.huddle.opp = sugOpp.id;
                persist('huddle');
                navigate('huddle');
              },
            },
            'Build the huddle',
            icon('arrow-right')
          )
        )
      : null,
    eodCard()
  );
  syncEodPreview();
}
