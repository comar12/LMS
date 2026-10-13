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

const eodVals = (item) => Object.fromEntries(item.fields.map((f) => [f.k, state.eod.v[`${item.id}.${f.k}`] || '']));
function eodLine(item) {
  const v = eodVals(item);
  if (item.line) return item.line(v);
  const t = item.text(v);
  return has(t) ? `${item.label} : ${t}` : '';
}

function eodHeader() {
  const d = parseDay(todayDay());
  return `EOD Summary | ${d.toLocaleDateString('en-US', { weekday: 'long' })} | ${String(d.getDate()).padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`;
}

/** The message, exactly in the manager's format. */
function eodText() {
  const e = state.eod;
  const lines = EOD_ITEMS.filter((it) => !e.off[it.id]).map(eodLine).filter(has);
  e.custom.forEach((c) => {
    if (has(c.value)) lines.push(`${c.label} : ${c.value}`);
  });
  const tomorrow = e.tomorrow.split('\n').map((l) => l.replace(/^[\s・•*-]+/, '').trim()).filter(Boolean);
  if (!lines.length && !tomorrow.length) return '';
  const out = [eodHeader(), '', ...lines.map((l) => `${EOD_BULLET}${l}`)];
  if (tomorrow.length) out.push('', 'Tomorrow:', ...tomorrow.map((l) => `${EOD_BULLET}${l}`));
  return out.join('\n');
}

const saveEodSoon = debounce(() => persist('eod'), 300);
function syncEodPreview() {
  const text = eodText();
  const box = document.querySelector('.eod-bubble__text');
  if (box) box.textContent = text || 'Fill in today’s numbers to see your summary here.';
  const wa = document.querySelector('[data-fk="eod-wa"]');
  if (wa) {
    wa.setAttribute('href', `https://wa.me/?text=${encodeURIComponent(text)}`);
    wa.classList.toggle('is-disabled', !text);
    wa.setAttribute('aria-disabled', text ? 'false' : 'true');
  }
  const n = document.querySelector('.eod-count');
  if (n) n.textContent = `${EOD_ITEMS.filter((it) => !state.eod.off[it.id] && has(eodLine(it))).length} of ${EOD_ITEMS.filter((it) => !state.eod.off[it.id]).length} lines filled`;
}

function setEodValue(key, value) {
  state.eod.day = todayDay();
  if (has(value)) state.eod.v[key] = String(value).trim().slice(0, 120);
  else delete state.eod.v[key];
  saveEodSoon();
  syncEodPreview();
}

/** What the app already knows about today: coaching plans started, AICR scrubbing logged, and team sales from the hub. */
function eodFillValues() {
  const today = todayDay();
  const out = {};
  out.coaching = state.tracker.plans.filter((p) => p.start === today).length;
  const aicr = state.today.routines.find((r) => r.id === 'rt-aicr' || /aicr/i.test(r.title));
  if (aicr) out.aicr = routineCount(aicr);
  const since = hub.aux && hub.aux.fiscal ? hub.aux.fiscal : `${today.slice(0, 8)}01`;
  const sales = hubTeamSales(today, since);
  if (sales) {
    out.gsrDay = sales.gsrDay;
    out.participation = sales.participation;
  }
  return out;
}

function eodFill() {
  const vals = eodFillValues();
  const filled = [];
  EOD_ITEMS.forEach((it) =>
    it.fields.forEach((f) => {
      if (f.fill && vals[f.fill] !== undefined) {
        state.eod.v[`${it.id}.${f.k}`] = String(vals[f.fill]);
        filled.push(f.fill === 'participation' ? 'sales participation' : f.fill === 'gsrDay' ? 'GSR submitted today' : f.fill === 'aicr' ? 'aICR scrubbing' : 'coaching sessions');
      }
    })
  );
  state.eod.day = todayDay();
  persist('eod');
  state.ui.flash = 'eod';
  refresh({ panel: false });
  state.ui.flash = null;
  toast(filled.length ? `Filled ${joinList(filled)}. Check them before sending.` : 'Nothing to fill yet.');
}

function eodTomorrowSuggestions() {
  const tomorrow = addDays(todayDay(), 1);
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
  const value = state.eod.v[key] || '';
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
  return h(
    'li',
    { class: `eod-row${off ? ' is-off' : ''}${filled ? ' is-filled' : ''}`, style: `--i:${i}` },
    h(
      'label',
      { class: 'eod-row__head' },
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
      h('span', { class: 'eod-row__title' }, item.label),
      filled && !off ? h('span', { class: 'eod-row__done', 'aria-hidden': 'true' }, icon('check', 'icon--sm')) : null
    ),
    off ? null : h('div', { class: 'eod-row__fields' }, item.fields.map((f) => eodField(item, f)))
  );
}

function eodCard() {
  const e = state.eod;
  if (e.day !== todayDay()) Object.assign(e, sanitizeEod(e));
  const text = eodText();
  const tomorrow = h('textarea', { class: 'textarea', id: 'eod-tomorrow', rows: '4', 'data-fk': 'eod-tomorrow', value: e.tomorrow, placeholder: 'One item per line, for example: Close the last alert by 2 PM' });
  tomorrow.addEventListener('input', () => {
    e.day = todayDay();
    e.tomorrow = tomorrow.value.slice(0, 1200);
    saveEodSoon();
    syncEodPreview();
  });
  return h(
    'section',
    { class: `card day-sec eod${state.ui.flash === 'eod' ? ' is-flash' : ''}`, id: 'eod', 'aria-labelledby': 'eodTitle' },
    h(
      'div',
      { class: 'card__head' },
      h('h2', { class: 'card__title', id: 'eodTitle' }, icon('megaphone'), 'End-of-day summary', h('span', { class: 'sec__sub eod-count' }, '')),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'eod-fill', onclick: eodFill }, icon('refresh'), 'Fill from app')
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
          e.custom.length
            ? h(
                'ul',
                { class: 'eod-custom__list' },
                e.custom.map((c) => {
                  const lab = h('input', { class: 'input', type: 'text', value: c.label, maxlength: '80', 'aria-label': 'Line name', 'data-fk': `eod-cl-${c.id}` });
                  const val = h('input', { class: 'input', type: 'text', value: c.value, maxlength: '160', 'aria-label': `Value for ${c.label}`, 'data-fk': `eod-cv-${c.id}` });
                  lab.addEventListener('input', () => {
                    c.label = lab.value.trim().slice(0, 80) || c.label;
                    saveEodSoon();
                    syncEodPreview();
                  });
                  val.addEventListener('input', () => {
                    e.day = todayDay();
                    c.value = val.value.slice(0, 160);
                    saveEodSoon();
                    syncEodPreview();
                  });
                  return h('li', { class: 'eod-custom__row' }, lab, val, h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove line ${c.label}`, onclick: () => { e.custom = e.custom.filter((x) => x !== c); persist('eod'); refresh({ panel: false }); } }, icon('trash')));
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
                e.custom.push({ id: uid('eod'), label, value: '' });
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
          h('div', { class: 'eod-tomorrow__head' }, h('label', { class: 'eod-sub', for: 'eod-tomorrow' }, 'Tomorrow'), h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'eod-plan', onclick: () => { const add = eodTomorrowSuggestions().filter((l) => !e.tomorrow.includes(l)); e.tomorrow = [e.tomorrow.trim(), ...add].filter(Boolean).join('\n'); e.day = todayDay(); persist('eod'); refresh({ panel: false }); toast(add.length ? `Added ${plural(add.length, 'item')} from your plans and routine` : 'Nothing new to add'); } }, icon('calendar'), 'Add from my plans')),
          tomorrow
        )
      ),
      h(
        'div',
        { class: 'eod-preview' },
        h('p', { class: 'eod-sub' }, 'Preview'),
        h('div', { class: 'eod-bubble' }, h('p', { class: 'eod-bubble__text' }, text || 'Fill in today’s numbers to see your summary here.'), h('span', { class: 'eod-bubble__time', 'aria-hidden': 'true' }, new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))),
        h(
          'div',
          { class: 'eod-actions' },
          copyButton(eodText, { label: 'Copy for WhatsApp', srLabel: 'Copy end-of-day summary', primary: true, size: 'md', fk: 'eod-copy', emptyMessage: 'Fill in at least one line first.' }),
          h('a', { class: `btn${text ? '' : ' is-disabled'}`, href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener noreferrer', 'data-fk': 'eod-wa', 'aria-disabled': text ? 'false' : 'true', 'aria-label': 'Open WhatsApp with this summary (new tab)', onclick: (ev) => { if (!eodText()) { ev.preventDefault(); toast('Fill in at least one line first.', { type: 'warn' }); } } }, icon('external'), 'Open WhatsApp')
        ),
        h('p', { class: 'field__hint' }, 'Values reset each day. The lines you switch off and your extra lines are kept.')
      )
    )
  );
}
