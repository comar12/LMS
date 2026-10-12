/* ==========================================================================
   07j-snapshot: Weekly Snapshot (what was logged in the tracker, plan
   status, huddles held, and routine completion, with a copyable summary)
   ========================================================================== */

function snapshotData(days) {
  const today = todayDay();
  const since = addDays(today, -(days - 1));
  const behaviors = {};
  let calls = 0;
  let checkins = 0;
  state.tracker.plans.forEach((p) =>
    p.logs.forEach((l) => {
      if (l.date < since || l.date > today) return;
      if (l.kind === 'call') calls++;
      else if (l.kind === 'checkin') checkins++;
      Object.entries(l.results).forEach(([id, r]) => {
        if (r === 'na' || !getOpp(id)) return;
        const b = behaviors[id] || (behaviors[id] = { id, met: 0, miss: 0, kind: l.kind });
        if (r === 'met') b.met++;
        else b.miss++;
      });
    })
  );
  const rows = Object.values(behaviors).sort((a, b) => b.miss - a.miss || b.met + b.miss - (a.met + a.miss));
  const active = state.tracker.plans.filter((p) => p.status === 'active');
  const status = { ok: 0, soon: 0, overdue: 0 };
  active.forEach((p) => {
    const lv = planDue(p).level;
    if (lv === 'overdue') status.overdue++;
    else if (lv === 'due' || lv === 'soon') status.soon++;
    else status.ok++;
  });
  const huddles = state.huddle.history.filter((r) => r.date >= since && r.date <= today);
  // Routine: days in the period (since the first day anything was ticked) when the daily target was met.
  const ticked = Object.keys(state.today.progress).filter((d) => d >= since && d <= today).sort();
  const firstDay = ticked[0];
  const dayList = [];
  if (firstDay) for (let d = firstDay; d <= today; d = addDays(d, 1)) dayList.push(d);
  const routine = state.today.routines
    .filter((r) => r.freq === 'daily')
    .map((r) => ({ r, done: dayList.filter((d) => ((state.today.progress[d] || {})[r.id] || 0) >= r.target).length, of: dayList.length }));
  return { since, today, rows, calls, checkins, active: active.length, done: state.tracker.plans.length - active.length, status, huddles, routine };
}

function snapshotText(days) {
  const d = snapshotData(days);
  const lines = [`Team Snapshot: ${fmtDay(d.since, true)} to ${fmtDay(d.today, true)}`, ''];
  lines.push(`Follow-up plans: ${d.active} active (${d.status.ok} on track, ${d.status.soon} due soon, ${d.status.overdue} overdue), ${d.done} completed.`);
  lines.push(`Logged: ${plural(d.calls, 'call review')} and ${plural(d.checkins, 'check-in')}.`);
  if (d.rows.length) {
    lines.push('', 'Behaviors reviewed (met / reviewed):');
    d.rows.slice(0, 8).forEach((b) => lines.push(`${getOpp(b.id).title}: ${b.met} of ${b.met + b.miss}`));
  }
  if (d.huddles.length) lines.push('', `Huddles held: ${d.huddles.map((r) => `${getOpp(r.opp) ? getOpp(r.opp).title : 'Removed entry'} (${fmtDay(r.date)})`).join('; ')}.`);
  const rt = d.routine.filter((x) => x.of);
  if (rt.length) lines.push('', `Routine: ${rt.map((x) => `${x.r.title} done on ${x.done} of ${plural(x.of, 'day')}`).join('; ')}.`);
  lines.push('', 'Counts come only from what was logged in Coaching Intelligence Pro on this computer.');
  return lines.join('\n');
}

function snapBar(b) {
  const total = b.met + b.miss;
  const o = getOpp(b.id);
  return h(
    'li',
    { class: 'snap-row', title: `${o.title}: ${b.met} met, ${b.miss} not met (${plural(total, b.kind === 'call' ? 'call' : 'check-in')} reviewed)` },
    h('span', { class: 'snap-row__name' }, h('span', { class: `chip__dot cat-${o.cat}`, style: 'background:var(--cc)' }), o.title),
    h(
      'span',
      { class: 'snap-bar', 'aria-hidden': 'true' },
      b.met ? h('span', { class: 'snap-bar__met', style: `flex-grow:${b.met}` }) : null,
      b.miss ? h('span', { class: 'snap-bar__miss', style: `flex-grow:${b.miss}` }) : null
    ),
    h('span', { class: 'snap-row__num' }, `${b.met} of ${total} met`)
  );
}

function renderSnapshot(main) {
  const days = [7, 14, 30].includes(state.ui.snapDays) ? state.ui.snapDays : 7;
  const d = snapshotData(days);
  const stat = (n, label, iconName, cls) => h('div', { class: `stat${cls ? ' ' + cls : ''}` }, h('span', { class: 'stat__icon', 'aria-hidden': 'true' }, icon(iconName)), h('span', { class: 'stat__num', 'data-count': String(n) }, String(n)), h('span', { class: 'stat__label' }, label));
  const st = d.status;
  const stTotal = st.ok + st.soon + st.overdue;
  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-dis', style: 'width:22px;height:22px;border-radius:6px' }, icon('trend', 'icon--sm')), 'Team'],
      title: 'Weekly Snapshot',
      sub: 'What your team logged: reviews, the behaviors that were met or missed, plan status, huddles, and your routine. Every number comes from what you recorded here, nothing is estimated.',
      actions: copyButton(() => snapshotText(days), { label: 'Copy summary', srLabel: 'Copy snapshot summary', primary: true, size: 'md', fk: 'snap-copy' }),
    }),
    h(
      'div',
      { class: 'toolbar' },
      segmented({ label: 'Period', value: days, fkPrefix: 'snap-days', options: [7, 14, 30].map((n) => ({ value: n, label: `Last ${n} days` })), onChange: (v) => { state.ui.snapDays = v; state.ui.tabAnim = true; refresh({ panel: false }); } }),
      h('span', { class: 'toolbar__label' }, `${fmtDay(d.since)} to ${fmtDay(d.today)}`)
    ),
    h('div', { class: 'stats' }, stat(d.calls, 'call reviews logged', 'checklist'), stat(d.checkins, 'check-ins logged', 'calendar'), stat(d.active, 'active plans', 'target'), stat(d.huddles.length, 'huddles held', 'megaphone')),
    h(
      'div',
      { class: `snap-grid${takeTabAnim()}` },
      h(
        'section',
        { class: 'card snap-card snap-card--wide', 'aria-labelledby': 'snapBeh' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'snapBeh' }, icon('target'), 'Behaviors reviewed'), h('span', { class: 'snap-legend' }, h('span', { class: 'snap-key snap-key--met' }), 'Met', h('span', { class: 'snap-key snap-key--miss' }), 'Not met')),
        d.rows.length ? h('ul', { class: 'snap-list' }, d.rows.slice(0, 10).map(snapBar)) : h('div', { class: 'card__body' }, h('p', { class: 'day-empty' }, icon('info'), 'Nothing logged in this period. Log call reviews and check-ins in the Follow-Up Tracker to fill this chart.'))
      ),
      h(
        'section',
        { class: 'card snap-card', 'aria-labelledby': 'snapPlans' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'snapPlans' }, icon('calendar'), 'Plan status'), h('span', { class: 'sec__sub' }, `${d.done} completed`)),
        h(
          'div',
          { class: 'card__body' },
          stTotal
            ? h('div', { class: 'snap-status', 'aria-hidden': 'true' }, st.ok ? h('span', { class: 'snap-status__ok', style: `flex-grow:${st.ok}` }) : null, st.soon ? h('span', { class: 'snap-status__soon', style: `flex-grow:${st.soon}` }) : null, st.overdue ? h('span', { class: 'snap-status__over', style: `flex-grow:${st.overdue}` }) : null)
            : null,
          h(
            'ul',
            { class: 'snap-keys' },
            h('li', null, h('span', { class: 'snap-key snap-key--met' }), icon('check', 'icon--sm'), h('strong', null, String(st.ok)), ' on track'),
            h('li', null, h('span', { class: 'snap-key snap-key--soon' }), icon('flag', 'icon--sm'), h('strong', null, String(st.soon)), ' due in the next two days'),
            h('li', null, h('span', { class: 'snap-key snap-key--miss' }), icon('alert', 'icon--sm'), h('strong', null, String(st.overdue)), ' overdue')
          )
        )
      ),
      h(
        'section',
        { class: 'card snap-card', 'aria-labelledby': 'snapRoutine' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'snapRoutine' }, icon('checklist'), 'Daily routine')),
        h(
          'div',
          { class: 'card__body' },
          d.routine.some((x) => x.of)
            ? h('ul', { class: 'snap-list snap-list--tight' }, d.routine.map((x) => h('li', { class: 'snap-row', title: `${x.r.title}: target met on ${x.done} of ${x.of} days` }, h('span', { class: 'snap-row__name' }, x.r.title), h('span', { class: 'snap-bar', 'aria-hidden': 'true' }, x.done ? h('span', { class: 'snap-bar__met', style: `flex-grow:${x.done}` }) : null, x.of - x.done ? h('span', { class: 'snap-bar__rest', style: `flex-grow:${x.of - x.done}` }) : null), h('span', { class: 'snap-row__num' }, `${x.done} of ${plural(x.of, 'day')}`))))
            : h('p', { class: 'day-empty' }, icon('info'), 'Tick items in My Day to see how often the daily targets were met.')
        )
      )
    )
  );
}
