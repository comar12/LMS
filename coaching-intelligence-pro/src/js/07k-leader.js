/* ==========================================================================
   07k-leader: Coach the Coach (observe a team leader's coaching session and
   calibrate a call review side by side)
   ========================================================================== */

const OBSERVE = DATA.leader.observe;

function observeFeedbackText() {
  const marks = state.observe.marks;
  const good = OBSERVE.filter((it) => marks[it.id] === 'met').map((it) => it.good);
  const gaps = OBSERVE.filter((it) => marks[it.id] === 'gap').map((it) => it.gap);
  if (!good.length && !gaps.length) return '';
  const parts = ['Coaching Observation'];
  if (good.length) parts.push(`What went well\n${good.join(' ')}`);
  if (gaps.length) parts.push(`Focus for your next session\n${gaps.join(' ')}`);
  parts.push('Next step\nI will observe another of your coaching sessions so we can look at these points together again.');
  return parts.join('\n\n');
}

function markRow(id, title, sub, current, onMark, fkPrefix) {
  const btn = (v, label) => h('button', { type: 'button', class: `rv-btn rv-btn--${v}`, 'aria-pressed': String(current === v), 'data-fk': `${fkPrefix}:${id}:${v}`, onclick: () => onMark(current === v ? null : v) }, label);
  const titleId = `${fkPrefix}-${id}`;
  return h(
    'li',
    { class: `rv-row${current ? ' is-' + current : ''}` },
    h('div', { class: 'rv-row__num', 'aria-hidden': 'true' }, current === 'met' ? icon('check', 'icon--sm') : '•'),
    h('div', { class: 'rv-row__main' }, h('h3', { class: 'rv-row__title', id: titleId }, title), sub ? h('p', { class: 'rv-row__good' }, sub) : null),
    h('div', { class: 'rv-row__marks', role: 'group', 'aria-labelledby': titleId }, btn('met', 'Met'), btn('gap', 'Opportunity'), btn('na', 'N/A'))
  );
}

function renderObserveTab(panel) {
  const marks = state.observe.marks;
  const n = Object.keys(marks).length;
  const label = h('input', { class: 'input', id: 'ob-label', type: 'text', maxlength: '40', value: state.observe.label, placeholder: 'TL 1 or another code (optional)', autocomplete: 'off', 'data-fk': 'ob-label' });
  label.addEventListener('change', () => {
    state.observe.label = label.value.trim().slice(0, 40);
    persist('observe');
  });
  const setMark = (id, v) => {
    if (v) state.observe.marks[id] = v;
    else delete state.observe.marks[id];
    persist('observe');
    refresh({ panel: false });
  };
  put(
    panel,
    h('div', { class: 'pk-bar' }, h('p', { class: 'pk-bar__text' }, 'Sit in on a team leader\'s coaching session and mark what you see. The feedback is written to the leader, ready to share in your one-on-one.'), h('div', { class: 'field ob-label' }, h('label', { class: 'field__label', for: 'ob-label' }, 'Leader'), label)),
    h('section', { class: 'card rv-card', 'aria-labelledby': 'obTitle' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'obTitle' }, icon('checklist'), 'Session checklist')), h('div', { class: 'card__body' }, h('ol', { class: 'rv-list' }, OBSERVE.map((it) => markRow(it.id, it.title, it.gap, marks[it.id], (v) => setMark(it.id, v), 'ob'))))),
    h(
      'div',
      { class: `selection-bar selection-bar--review${n ? '' : ' is-empty'}`, role: 'region', 'aria-label': 'Observation summary' },
      h('span', { class: 'selection-bar__text' }, n ? `${Object.values(marks).filter((v) => v === 'met').length} met · ${Object.values(marks).filter((v) => v === 'gap').length} to work on` : 'Nothing marked yet'),
      copyButton(() => observeFeedbackText(), { label: 'Copy feedback', srLabel: 'Copy feedback for the leader', primary: true, fk: 'ob-copy', emptyMessage: 'Mark at least one item as Met or Opportunity first.' }),
      h('button', { type: 'button', class: 'btn btn--sm', disabled: !n, 'data-fk': 'ob-clear', onclick: () => { state.observe = { label: state.observe.label, marks: {} }; persist('observe'); refresh({ panel: false }); } }, 'Clear')
    )
  );
}

function calibItems() {
  const t = REVIEW_TYPE_MAP[state.calib.type] || REVIEW_TYPES[0];
  return t.steps.concat(t.skills);
}

function calibStats() {
  const items = calibItems();
  const both = items.filter((it) => state.calib.a[it.id] && state.calib.b[it.id]);
  const agree = both.filter((it) => state.calib.a[it.id] === state.calib.b[it.id]);
  return { items, both, agree, diff: both.filter((it) => state.calib.a[it.id] !== state.calib.b[it.id]) };
}

function calibText() {
  const s = calibStats();
  if (!s.both.length) return '';
  const t = REVIEW_TYPE_MAP[state.calib.type];
  const lines = [`Calibration: ${t.label} call`, `Agreement: ${s.agree.length} of ${s.both.length} steps marked by both reviewers`];
  if (s.diff.length) {
    lines.push('', 'Differences to discuss:');
    s.diff.forEach((it) => lines.push(`${it.title}: supervisor ${MARK_LABEL[state.calib.a[it.id]]}, team leader ${MARK_LABEL[state.calib.b[it.id]]}`));
  } else lines.push('', 'Both reviewers marked every shared step the same way.');
  return lines.join('\n');
}

function renderCalibTab(panel) {
  const s = calibStats();
  const pct = s.both.length ? Math.round((s.agree.length / s.both.length) * 100) : 0;
  const set = (who, id, v) => {
    if (v) state.calib[who][id] = v;
    else delete state.calib[who][id];
    persist('calib');
    refresh({ panel: false });
  };
  const pick = (who, it) => {
    const cur = state.calib[who][it.id];
    return h(
      'div',
      { class: 'rv-row__marks', role: 'group', 'aria-label': `${who === 'a' ? 'Your mark' : 'Team leader mark'} for ${it.title}` },
      ['met', 'gap', 'na'].map((v) => h('button', { type: 'button', class: `rv-btn rv-btn--${v}`, 'aria-pressed': String(cur === v), 'data-fk': `cal:${who}:${it.id}:${v}`, onclick: () => set(who, it.id, cur === v ? null : v) }, v === 'met' ? 'Met' : v === 'gap' ? 'Opp' : 'N/A'))
    );
  };
  const typeSel = h('select', { class: 'select', id: 'cal-type', 'data-fk': 'cal-type', onchange: (e) => { state.calib = { type: e.target.value, a: {}, b: {} }; persist('calib'); refresh({ panel: false }); } }, REVIEW_TYPES.map((t) => h('option', { value: t.id, selected: t.id === state.calib.type }, t.label)));
  put(
    panel,
    h('div', { class: 'pk-bar' }, h('p', { class: 'pk-bar__text' }, 'You and a team leader review the same call separately, then enter both sets of marks here. Differences show what to align on before your calibration meeting.'), h('div', { class: 'field ob-label' }, h('label', { class: 'field__label', for: 'cal-type' }, 'Call type'), typeSel)),
    h(
      'div',
      { class: 'scorecard' },
      progressRing(s.agree.length, Math.max(s.both.length, 1), `${s.agree.length} of ${s.both.length} shared steps agree`, 'calib'),
      h('div', { class: 'scorecard__body' }, h('p', { class: 'scorecard__title' }, s.both.length ? `${pct}% agreement on ${plural(s.both.length, 'step')} marked by both` : 'Enter both reviewers’ marks to compare'), s.diff.length ? h('div', { class: 'scorecard__risk' }, h('span', { class: 'scorecard__risk-label' }, 'Discuss'), s.diff.map((it) => h('span', { class: 'risk-chip is-hot' }, it.title))) : null)
    ),
    h(
      'section',
      { class: 'card', 'aria-labelledby': 'calTitle' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'calTitle' }, icon('checklist'), 'Side-by-side marks'), copyButton(() => calibText(), { label: 'Copy summary', srLabel: 'Copy calibration summary', fk: 'cal-copy', emptyMessage: 'Mark at least one step for both reviewers first.' })),
      h(
        'div',
        { class: 'cal-table', role: 'table', 'aria-label': 'Calibration marks' },
        h('div', { class: 'cal-row cal-row--head', role: 'row' }, h('span', { role: 'columnheader' }, 'Step'), h('span', { role: 'columnheader' }, 'You'), h('span', { role: 'columnheader' }, 'Team leader'), h('span', { role: 'columnheader', class: 'sr-only' }, 'Match')),
        s.items.map((it) => {
          const a = state.calib.a[it.id];
          const b = state.calib.b[it.id];
          const st = a && b ? (a === b ? 'agree' : 'diff') : '';
          return h(
            'div',
            { class: `cal-row${st ? ' is-' + st : ''}`, role: 'row' },
            h('span', { role: 'cell', class: 'cal-row__title' }, it.title),
            h('span', { role: 'cell' }, pick('a', it)),
            h('span', { role: 'cell' }, pick('b', it)),
            h('span', { role: 'cell', class: 'cal-row__match' }, st === 'agree' ? icon('check') : st === 'diff' ? icon('alert') : null, st ? h('span', { class: 'sr-only' }, st === 'agree' ? 'Agree' : 'Different') : null)
          );
        })
      ),
      h('div', { class: 'card__body', style: 'padding-top:12px' }, h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'cal-clear', disabled: !Object.keys(state.calib.a).length && !Object.keys(state.calib.b).length, onclick: () => { state.calib = { type: state.calib.type, a: {}, b: {} }; persist('calib'); refresh({ panel: false }); } }, 'Clear marks'))
    )
  );
}

function renderLeader(main) {
  const tab = state.ui.leaderTab === 'calib' ? 'calib' : 'observe';
  const tabs = [
    { id: 'observe', label: 'Observe a session', icon: 'eye-off' },
    { id: 'calib', label: 'Calibrate a call', icon: 'sliders' },
  ];
  const list = h('div', { class: 'tk-tabs', role: 'tablist', 'aria-label': 'Coach the Coach sections' });
  tabs.forEach((t, i) => {
    const b = h('button', { type: 'button', class: 'tk-tab', role: 'tab', id: `ld-tab-${t.id}`, 'aria-selected': String(t.id === tab), 'aria-controls': 'ld-panel', tabindex: t.id === tab ? '0' : '-1', 'data-fk': `ld-tab:${t.id}`, onclick: () => { state.ui.leaderTab = t.id; state.ui.tabAnim = true; refresh({ panel: false }); } }, icon(t.icon), t.label);
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        state.ui.leaderTab = next.id;
        refresh({ panel: false });
        focusByKey(`ld-tab:${next.id}`);
      }
    });
    list.appendChild(b);
  });
  const panel = h('div', { class: `tk-panel${takeTabAnim()}`, role: 'tabpanel', id: 'ld-panel', 'aria-labelledby': `ld-tab-${tab}`, tabindex: '-1' });
  if (tab === 'calib') renderCalibTab(panel);
  else renderObserveTab(panel);
  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-own', style: 'width:22px;height:22px;border-radius:6px' }, icon('award', 'icon--sm')), 'Team'],
      title: 'Coach the Coach',
      sub: 'Develop your team leaders: observe how they deliver coaching and give them specific feedback, and calibrate how you each score the same call.',
    }),
    list,
    panel
  );
}
