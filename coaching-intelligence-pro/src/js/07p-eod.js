/* ==========================================================================
   07p-eod: End-of-day summary for the manager, in the same format the
   manager uses on WhatsApp. Values are typed (or filled from what the app
   already knows), previewed live, and copied or opened in WhatsApp.
   ========================================================================== */

const EOD_BULLET = '・';
const has = (x) => x !== undefined && x !== null && String(x).trim() !== '';
const plur = (n, one, many) => (String(n).trim() === '1' ? one : many);

/** One line per item of the manager's template. Each line is left out while it is empty. */
const EOD_ITEMS = [
  { id: 'shared', label: 'Performance shared on WhatsApp', fields: [{ k: 'ans', type: 'choice', options: ['Yes', 'No'] }], text: (v) => v.ans },
  {
    id: 'alerts',
    label: 'Closed Alerts',
    fields: [{ k: 'closed', type: 'num', label: 'Closed' }, { k: 'total', type: 'num', label: 'Out of' }, { k: 'owner', type: 'text', label: 'Pending ones closed by', placeholder: 'Who will close them' }],
    text: (v) => {
      if (!has(v.closed) && !has(v.total)) return '';
      const pend = Math.max(0, (Number(v.total) || 0) - (Number(v.closed) || 0));
      return `${v.closed || 0} closed out of ${v.total || 0}${pend ? ` > Pending ${pend}${has(v.owner) ? ` ${v.owner} will close ${pend === 1 ? 'it' : 'them'}` : ''}` : ''}`;
    },
  },
  { id: 'detractors', label: 'Detractors attainment', fields: [{ k: 'pct', type: 'pct', label: 'Attainment' }, { k: 'left', type: 'num', label: 'Detractors left' }], text: (v) => [has(v.pct) ? `${v.pct}%` : '', has(v.left) ? `${v.left} ${plur(v.left, 'Detractor', 'Detractors')} left` : ''].filter(Boolean).join(' ') },
  { id: 'abs', label: 'ABS Performance', fields: [{ k: 'mtd', type: 'pct', label: 'MTD' }, { k: 'today', type: 'pct', label: 'Today' }], text: (v) => [has(v.mtd) ? `${v.mtd}% MTD` : '', has(v.today) ? `${v.today}% Today` : ''].filter(Boolean).join(' Vs ') },
  { id: 'participation', label: 'Sales Participation', fields: [{ k: 'mtd', type: 'pct', label: 'MTD', fill: 'participation' }], text: (v) => (has(v.mtd) ? `${v.mtd}% MTD` : '') },
  { id: 'gsr', label: 'GSR', fields: [{ k: 'rate', type: 'pct', label: 'GSR %' }, { k: 'today', type: 'num', label: 'Submitted today', fill: 'gsrDay' }], text: (v) => [has(v.rate) ? `${v.rate}%` : '', has(v.today) ? `${v.today} GSR Submitted for today` : ''].filter(Boolean).join(' Vs ') },
  { id: 'ztps', label: 'QA ZTPS Action VS Incident', fields: [{ k: 'pct', type: 'pct', label: 'Action rate' }], text: (v) => (has(v.pct) ? `${v.pct}%` : '') },
  { id: 'breaks', label: 'Action Vs Incident Breaks & Lateness', fields: [{ k: 'pct', type: 'pct', label: 'Action rate' }, { k: 'note', type: 'text', label: 'Note', placeholder: 'For example: Pending HR Actions (EXP)' }], text: (v) => [has(v.pct) ? `${v.pct}%` : '', v.note].filter(has).join(' - ') },
  { id: 'coaching', label: 'Coaching sessions', fields: [{ k: 'n', type: 'num', label: 'Sessions', fill: 'coaching' }, { k: 'st', type: 'choice', options: ['Done', 'Pending'] }], line: (v) => (has(v.n) ? `${v.n} Coaching ${plur(v.n, 'session', 'sessions')} : ${v.st || 'Done'}` : '') },
  { id: 'scrub', label: 'aICR and Outbound', fields: [{ k: 'aicr', type: 'num', label: 'aICR', fill: 'aicr' }, { k: 'ob', type: 'num', label: 'Outbound' }, { k: 'st', type: 'choice', options: ['Done', 'Pending'] }], line: (v) => (has(v.aicr) || has(v.ob) ? `${[has(v.aicr) ? `${v.aicr} aICR` : '', has(v.ob) ? `${v.ob} Outbound` : ''].filter(Boolean).join(' & ')} : ${v.st || 'Done'}` : '') },
  { id: 'attendance', label: 'Expected Attendance', fields: [{ k: 'st', type: 'choice', options: ['Updated', 'Pending'] }], text: (v) => v.st },
  { id: 'integrity', label: 'Integrity Report', fields: [{ k: 'st', type: 'choice', options: ['Done', 'Pending'] }], text: (v) => v.st },
];

/* ---------- The chosen day ---------- */
const eodDate = () => state.eod.day || todayDay();
/** Values for the chosen date (an empty record until something is typed). */
function eodDay() {
  const d = eodDate();
  return state.eod.days[d] || (state.eod.days[d] = { v: {}, cv: {}, tomorrow: '' });
}
const eodHasValues = (d) => !!d && (Object.keys(d.v).length > 0 || Object.keys(d.cv).length > 0 || !!d.tomorrow.trim());

const eodVals = (item) => Object.fromEntries(item.fields.map((f) => [f.k, eodDay().v[`${item.id}.${f.k}`] || '']));
function eodLine(item) {
  const v = eodVals(item);
  if (item.line) return item.line(v);
  const t = item.text(v);
  return has(t) ? `${item.label} : ${t}` : '';
}

function eodHeader() {
  const d = parseDay(eodDate());
  return `EOD Summary | ${d.toLocaleDateString('en-US', { weekday: 'long' })} | ${String(d.getDate()).padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`;
}

/** The message, exactly in the manager's format. */
function eodText() {
  const e = state.eod;
  const day = eodDay();
  const lines = EOD_ITEMS.filter((it) => !e.off[it.id]).map(eodLine).filter(has);
  e.lines.forEach((c) => {
    if (has(day.cv[c.id])) lines.push(`${c.label} : ${day.cv[c.id]}`);
  });
  const tomorrow = day.tomorrow.split('\n').map((l) => l.replace(/^[\s・•*-]+/, '').trim()).filter(Boolean);
  if (!lines.length && !tomorrow.length) return '';
  const out = [eodHeader(), '', ...lines.map((l) => `${EOD_BULLET}${l}`)];
  if (tomorrow.length) out.push('', 'Tomorrow:', ...tomorrow.map((l) => `${EOD_BULLET}${l}`));
  return out.join('\n');
}

const saveEodSoon = debounce(() => persist('eod'), 300);
const EOD_EMPTY = 'Fill in the numbers to see your summary here.';
/** Updates the preview, the counter, and each row's tick in place, so typing never loses focus. */
function syncEodPreview() {
  const text = eodText();
  const box = document.querySelector('.eod-bubble__text');
  if (box) box.textContent = text || EOD_EMPTY;
  const wa = document.querySelector('[data-fk="eod-wa"]');
  if (wa) {
    wa.setAttribute('href', `https://wa.me/?text=${encodeURIComponent(text)}`);
    wa.classList.toggle('is-disabled', !text);
    wa.setAttribute('aria-disabled', text ? 'false' : 'true');
  }
  const on = EOD_ITEMS.filter((it) => !state.eod.off[it.id]);
  const n = document.querySelector('.eod-count');
  if (n) n.textContent = `${on.filter((it) => has(eodLine(it))).length} of ${on.length} lines filled`;
  EOD_ITEMS.forEach((it) => {
    const row = document.querySelector(`.eod-row[data-id="${it.id}"]`);
    if (!row) return;
    row.classList.toggle('is-filled', has(eodLine(it)));
    const vals = eodVals(it);
    const clr = row.querySelector('.eod-row__clear');
    if (clr) clr.hidden = !Object.keys(vals).some((k) => has(vals[k]));
  });
  const clearAll = document.querySelector('[data-fk="eod-clear"]');
  if (clearAll) clearAll.disabled = !eodHasValues(eodDay());
}

function setEodValue(key, value) {
  const day = eodDay();
  if (has(value)) day.v[key] = String(value).trim().slice(0, 120);
  else delete day.v[key];
  saveEodSoon();
  syncEodPreview();
}

function clearEodLine(item) {
  const day = eodDay();
  item.fields.forEach((f) => delete day.v[`${item.id}.${f.k}`]);
  persist('eod');
  refresh({ panel: false });
  focusByKey(`eod-inc-${item.id}`);
  announce(`${item.label} cleared`);
}

async function clearEodDay() {
  if (!eodHasValues(eodDay())) return;
  if (!(await confirmDialog({ title: `Clear the summary for ${fmtDay(eodDate(), true)}?`, message: 'Every value and the Tomorrow list for this day are cleared. Your lines and extra line names stay.', confirmLabel: 'Clear summary', danger: true }))) return;
  delete state.eod.days[eodDate()];
  persist('eod');
  refresh({ panel: false });
  toast('Summary cleared');
}

function setEodDate(d) {
  if (!isIsoDate(d) || d > todayDay()) return;
  state.eod.day = d;
  // Days without values are not kept.
  Object.keys(state.eod.days).forEach((k) => {
    if (k !== d && !eodHasValues(state.eod.days[k])) delete state.eod.days[k];
  });
  persist('eod');
  state.ui.flash = 'eod';
  refresh({ panel: false });
  state.ui.flash = null;
}

/** What the app already knows about the chosen day: coaching plans started, AICR scrubbing logged, and team sales from the hub. Zeros are left blank. */
function eodFillValues() {
  const day = eodDate();
  const out = {};
  const coached = state.tracker.plans.filter((p) => p.start === day).length;
  if (coached) out.coaching = coached;
  const aicr = state.today.routines.find((r) => r.id === 'rt-aicr' || /aicr/i.test(r.title));
  const n = aicr ? (state.today.progress[aicr.freq === 'weekly' ? weekStart(day) : day] || {})[aicr.id] || 0 : 0;
  if (n) out.aicr = n;
  const since = hub.aux && hub.aux.fiscal && hub.aux.fiscal <= day ? hub.aux.fiscal : `${day.slice(0, 8)}01`;
  const sales = hubTeamSales(day, since);
  if (sales) {
    if (sales.gsrDay) out.gsrDay = sales.gsrDay;
    if (sales.sold) out.participation = sales.participation;
  }
  return out;
}

const EOD_FILL_NAME = { participation: 'sales participation', gsrDay: 'GSR submitted', aicr: 'aICR scrubbing', coaching: 'coaching sessions' };
function eodFill() {
  const vals = eodFillValues();
  const day = eodDay();
  const filled = [];
  EOD_ITEMS.forEach((it) =>
    it.fields.forEach((f) => {
      if (f.fill && vals[f.fill] !== undefined) {
        day.v[`${it.id}.${f.k}`] = String(vals[f.fill]);
        filled.push(EOD_FILL_NAME[f.fill]);
      }
    })
  );
  persist('eod');
  state.ui.flash = 'eod';
  refresh({ panel: false });
  state.ui.flash = null;
  toast(filled.length ? `Filled ${joinList(filled)}. Check them before sending.` : `Nothing logged in the app for ${fmtDay(eodDate(), true)} yet.`);
}

function eodTomorrowSuggestions() {
  const tomorrow = addDays(eodDate(), 1);

  const out = [];
  const plans = state.tracker.plans.filter((p) => p.status === 'active');
  const dueSoon = plans.filter((p) => {
    const d = planDue(p);
    return d.date && d.date <= tomorrow && d.level !== 'done';
  });
  if (dueSoon.length) out.push(`${plural(dueSoon.length, 'coaching follow-up')} to complete`);
  const wd = (parseDay(tomorrow).getDay() + 6) % 7;
  state.today.routines.filter((r) => r.freq === 'weekly' && r.day === wd).forEach((r) => out.push(`${r.title}${r.note ? ` (${r.note})` : ''}`));
  state.today.routines.filter((r) => r.freq === 'daily').forEach((r) => out.push(r.kind === 'count' ? `${r.title}: ${r.target}` : r.title));
  return out;
}

/* ---------- UI ---------- */
function eodField(item, f) {
  const key = `${item.id}.${f.k}`;
  const id = `eod-${item.id}-${f.k}`;
  const value = eodDay().v[key] || '';
  if (f.type === 'choice') {
    return h(
      'div',
      { class: 'eod-choice', role: 'group', 'aria-label': `${item.label}: ${f.options.join(' or ')}` },
      f.options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `eod-chip${value === o ? ' is-on' : ''}${/^(Yes|Done|Updated)$/i.test(o) ? ' is-yes' : ' is-no'}`,
            'aria-pressed': String(value === o),
            'data-fk': `${id}-${o}`,
            onclick: () => {
              setEodValue(key, value === o ? '' : o);
              refresh({ panel: false });
            },
          },
          icon(/^(Yes|Done|Updated)$/i.test(o) ? 'check' : 'x', 'icon--sm'),
          o
        )
      )
    );
  }
  const input = h('input', { class: `input eod-input eod-input--${f.type}`, id, type: 'text', inputmode: f.type === 'text' ? 'text' : 'decimal', autocomplete: 'off', value, placeholder: f.placeholder || '', 'data-fk': id, maxlength: f.type === 'text' ? '80' : '8' });
  input.addEventListener('input', () => {
    let v = input.value;
    if (f.type !== 'text') v = v.replace('%', '').replace(',', '.').trim();
    const bad = f.type !== 'text' && has(v) && !/^\d+(\.\d+)?$/.test(v);
    input.classList.toggle('is-invalid', bad);
    input.setAttribute('aria-invalid', String(bad));
    if (!bad) setEodValue(key, v);
  });
  return h('div', { class: `eod-field eod-field--${f.type}` }, h('label', { class: 'eod-field__label', for: id }, f.label), h('span', { class: 'eod-field__box' }, input, f.type === 'pct' ? h('span', { class: 'eod-field__unit', 'aria-hidden': 'true' }, '%') : null));
}

function eodRow(item, i) {
  const off = !!state.eod.off[item.id];
  const filled = has(eodLine(item));
  const vals = eodVals(item);
  const any = Object.keys(vals).some((k) => has(vals[k]));
  return h(
    'li',
    { class: `eod-row${off ? ' is-off' : ''}${filled ? ' is-filled' : ''}`, 'data-id': item.id, style: `--i:${i}` },
    h(
      'div',
      { class: 'eod-row__head' },
      h(
        'label',
        { class: 'eod-row__check' },
        h('input', {
          type: 'checkbox',
          checked: !off,
          'aria-label': `Include ${item.label}`,
          'data-fk': `eod-inc-${item.id}`,
          onchange: (e) => {
            if (e.target.checked) delete state.eod.off[item.id];
            else state.eod.off[item.id] = true;
            persist('eod');
            refresh({ panel: false });
          },
        }),
        h('span', { class: 'eod-row__title' }, item.label)
      ),
      h('span', { class: 'eod-row__done', 'aria-hidden': 'true' }, icon('check', 'icon--sm')),
      off ? null : h('button', { type: 'button', class: 'icon-btn icon-btn--sm eod-row__clear', hidden: !any, 'aria-label': `Clear ${item.label}`, 'data-fk': `eod-clr-${item.id}`, onclick: () => clearEodLine(item) }, icon('x'))
    ),
    off ? null : h('div', { class: 'eod-row__fields' }, item.fields.map((f) => eodField(item, f)))
  );
}

function eodCard() {
  const e = state.eod;
  if (!isIsoDate(e.day) || e.day > todayDay()) e.day = todayDay();
  const day = eodDay();
  const text = eodText();
  const isToday = eodDate() === todayDay();
  const tomorrow = h('textarea', { class: 'textarea', id: 'eod-tomorrow', rows: '4', 'data-fk': 'eod-tomorrow', value: day.tomorrow, placeholder: 'One item per line, for example: Close the last alert by 2 PM' });
  tomorrow.addEventListener('input', () => {
    eodDay().tomorrow = tomorrow.value.slice(0, 1200);
    saveEodSoon();
    syncEodPreview();
  });
  const saved = Object.keys(e.days).filter((d) => d !== eodDate() && eodHasValues(e.days[d])).sort().reverse().slice(0, 6);
  const dateInput = h('input', { class: 'input eod-date', id: 'eod-date', type: 'date', value: eodDate(), max: todayDay(), min: addDays(todayDay(), -EOD_KEEP_DAYS), 'data-fk': 'eod-date', onchange: (ev) => setEodDate(ev.target.value) });
  return h(
    'section',
    { class: `card day-sec eod${state.ui.flash === 'eod' ? ' is-flash' : ''}`, id: 'eod', 'aria-labelledby': 'eodTitle' },
    h(
      'div',
      { class: 'card__head' },
      h('h2', { class: 'card__title', id: 'eodTitle' }, icon('megaphone'), 'End-of-day summary', h('span', { class: 'sec__sub eod-count' }, '')),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'eod-fill', onclick: eodFill }, icon('refresh'), 'Fill from app'),
      h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'eod-clear', disabled: !eodHasValues(day), onclick: clearEodDay }, icon('trash'), 'Clear')
    ),
    h(
      'div',
      { class: 'eod-daybar' },
      h('label', { class: 'eod-daybar__label', for: 'eod-date' }, icon('calendar', 'icon--sm'), 'Summary for'),
      dateInput,
      isToday ? h('span', { class: 'eod-daybar__today' }, 'Today') : h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'eod-today', onclick: () => setEodDate(todayDay()) }, 'Back to today'),
      saved.length ? h('span', { class: 'eod-daybar__saved' }, 'Saved:', saved.map((d) => h('button', { type: 'button', class: 'eod-daychip', 'data-fk': `eod-day-${d}`, onclick: () => setEodDate(d) }, fmtDay(d)))) : null
    ),
    h(
      'div',
      { class: 'eod-grid' },
      h(
        'div',
        { class: 'eod-form' },
        h('ol', { class: 'eod-list' }, EOD_ITEMS.map(eodRow)),
        h(
          'div',
          { class: 'eod-custom' },
          h('h3', { class: 'eod-sub' }, 'Extra lines'),
          e.lines.length
            ? h(
                'ul',
                { class: 'eod-custom__list' },
                e.lines.map((c) => {
                  const lab = h('input', { class: 'input', type: 'text', value: c.label, maxlength: '80', 'aria-label': 'Line name', 'data-fk': `eod-cl-${c.id}` });
                  const val = h('input', { class: 'input', type: 'text', value: day.cv[c.id] || '', maxlength: '160', 'aria-label': `Value for ${c.label}`, 'data-fk': `eod-cv-${c.id}` });
                  lab.addEventListener('input', () => {
                    c.label = lab.value.trim().slice(0, 80) || c.label;
                    saveEodSoon();
                    syncEodPreview();
                  });
                  val.addEventListener('input', () => {
                    const d = eodDay();
                    if (val.value.trim()) d.cv[c.id] = val.value.slice(0, 160);
                    else delete d.cv[c.id];
                    saveEodSoon();
                    syncEodPreview();
                  });
                  return h('li', { class: 'eod-custom__row' }, lab, val, h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove line ${c.label}`, onclick: () => { e.lines = e.lines.filter((x) => x !== c); Object.values(e.days).forEach((d) => delete d.cv[c.id]); persist('eod'); refresh({ panel: false }); } }, icon('trash')));
                })
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--sm btn--ghost',
              'data-fk': 'eod-add',
              onclick: async () => {
                const label = await promptDialog({ title: 'Add a line', label: 'Line name', hint: 'It stays in your summary every day; only the value resets.', confirmLabel: 'Add line', maxLength: 80, emptyText: 'Type a name for the line.' });
                if (!label) return;
                e.lines.push({ id: uid('eod'), label });
                persist('eod');
                refresh({ panel: false });
              },
            },
            icon('plus'),
            'Add a line'
          )
        ),
        h(
          'div',
          { class: 'field eod-tomorrow' },
          h('div', { class: 'eod-tomorrow__head' }, h('label', { class: 'eod-sub', for: 'eod-tomorrow' }, 'Tomorrow'), h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'eod-plan', onclick: () => { const d = eodDay(); const add = eodTomorrowSuggestions().filter((l) => !d.tomorrow.includes(l)); d.tomorrow = [d.tomorrow.trim(), ...add].filter(Boolean).join('\n'); persist('eod'); refresh({ panel: false }); toast(add.length ? `Added ${plural(add.length, 'item')} from your plans and routine` : 'Nothing new to add'); } }, icon('calendar'), 'Add from my plans')),
          tomorrow
        )
      ),
      h(
        'div',
        { class: 'eod-preview' },
        h('p', { class: 'eod-sub' }, 'Preview'),
        h('div', { class: 'eod-bubble' }, h('p', { class: 'eod-bubble__text' }, text || EOD_EMPTY), h('span', { class: 'eod-bubble__time', 'aria-hidden': 'true' }, new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))),
        h(
          'div',
          { class: 'eod-actions' },
          copyButton(eodText, { label: 'Copy for WhatsApp', srLabel: 'Copy end-of-day summary', primary: true, size: 'md', fk: 'eod-copy', emptyMessage: 'Fill in at least one line first.' }),
          h('a', { class: `btn${text ? '' : ' is-disabled'}`, href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener noreferrer', 'data-fk': 'eod-wa', 'aria-disabled': text ? 'false' : 'true', 'aria-label': 'Open WhatsApp with this summary (new tab)', onclick: (ev) => { if (!eodText()) { ev.preventDefault(); toast('Fill in at least one line first.', { type: 'warn' }); } } }, icon('external'), 'Open WhatsApp')
        ),
        h('p', { class: 'field__hint' }, 'Each day keeps its own summary for 45 days. Pick a date to see or change another day. Your lines and extra lines are the same every day.')
      )
    )
  );
}
