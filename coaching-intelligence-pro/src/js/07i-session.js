/* ==========================================================================
   07i-session: Run the Session (a step-by-step guide for delivering the
   coaching written in the Builder, with a session timer)
   ========================================================================== */

const SESSION_STEPS = DATA.leader.session;
const sessionClock = { start: 0, elapsed: 0, running: false, timer: null };

function sessionElapsed() {
  return Math.floor((sessionClock.elapsed + (sessionClock.running ? Date.now() - sessionClock.start : 0)) / 1000);
}
function drawSessionClock() {
  const el = document.getElementById('sessClock');
  if (!el) {
    clearInterval(sessionClock.timer);
    sessionClock.timer = null;
    return;
  }
  const s = sessionElapsed();
  el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function toggleSessionClock() {
  if (sessionClock.running) {
    sessionClock.elapsed += Date.now() - sessionClock.start;
    sessionClock.running = false;
  } else {
    sessionClock.start = Date.now();
    sessionClock.running = true;
  }
  refresh({ panel: false });
}

/** What the leader can read or say at each step, taken from the Builder output. */
function sessionContent(step) {
  const gen = composeBuilder();
  const opps = builderOpps();
  const s = state.settings;
  const blocks = [];
  if (step.source === 'strength') {
    const t = builderSectionText('progress', gen).trim();
    blocks.push(t ? { kind: 'read', label: 'From the Builder: what went well', text: t } : { kind: 'empty', text: 'No strengths or progress notes were added in the Builder, so there is nothing to claim here. Move on to the next step.' });
  }
  if (step.source === 'questions') {
    const qs = opps.map((o) => (o.questions || [])[0]).filter(Boolean).slice(0, 3);
    if (qs.length) blocks.push({ kind: 'questions', label: 'Then ask', items: qs });
  }
  if (step.source === 'challenges') {
    const t = builderSectionText('challenges', gen).trim();
    if (t) blocks.push({ kind: 'read', label: 'From the Builder: what you observed', text: t });
  }
  if (step.source === 'plan') {
    const t = builderSectionText('plan', gen).trim();
    if (t) blocks.push({ kind: 'read', label: 'From the Builder: the action plan', text: t });
  }
  if (step.source === 'followup') {
    const t = builderSectionText('followup', gen).trim();
    const today = todayDay();
    blocks.push({ kind: 'dates', items: [`First review by ${fmtDay(addDays(today, s.followup), true)}`, `Plan ends ${fmtDay(addDays(today, s.duration), true)}`] });
    if (t) blocks.push({ kind: 'read', label: 'From the Builder: follow-up plan', text: t });
  }
  return blocks;
}

function setSessionStep(i) {
  state.ui.sessionStep = Math.max(0, Math.min(SESSION_STEPS.length - 1, i));
  state.ui.tabAnim = true;
  refresh({ panel: false });
  focusByKey('sess-next');
}

function renderSession(main) {
  const opps = builderOpps();
  const hasAny = opps.length > 0;
  const head = pageHead({
    eyebrow: [h('span', { class: 'group__icon cat-own', style: 'width:22px;height:22px;border-radius:6px' }, icon('chat', 'icon--sm')), 'Coaching'],
    title: 'Run the Session',
    sub: 'A step-by-step guide for delivering the coaching you wrote in the Builder: open well, ask before you tell, agree on the plan in the agent’s own words, and set the follow-up.',
    actions: h('a', { class: 'btn btn--sm', href: '#/builder', 'data-fk': 'sess-builder' }, icon('clipboard'), 'Coaching Builder'),
  });
  if (!hasAny) {
    put(main, head, emptyState({ iconName: 'chat', title: 'Build the coaching first', text: 'Add the opportunities you observed in the Coaching Builder, then come back here to deliver the session step by step.', action: h('a', { class: 'btn btn--primary btn--sm', href: '#/builder', 'data-fk': 'sess-empty' }, icon('clipboard'), 'Open the Coaching Builder') }));
    return;
  }
  const i = Math.min(state.ui.sessionStep || 0, SESSION_STEPS.length - 1);
  const step = SESSION_STEPS[i];
  const last = i === SESSION_STEPS.length - 1;
  const steps = h(
    'ol',
    { class: 'sess-steps' },
    SESSION_STEPS.map((st, k) =>
      h(
        'li',
        null,
        h('button', { type: 'button', class: `sess-step${k === i ? ' is-on' : k < i ? ' is-done' : ''}`, 'aria-current': k === i ? 'step' : null, 'data-fk': `sess-step:${k}`, onclick: () => setSessionStep(k) }, h('span', { class: 'sess-step__num', 'aria-hidden': 'true' }, k < i ? icon('check', 'icon--sm') : String(k + 1)), st.title)
      )
    )
  );
  const blocks = sessionContent(step);
  const card = h(
    'section',
    { class: `sess-card${takeTabAnim()}`, 'aria-labelledby': 'sessTitle' },
    h('p', { class: 'sess-card__meta' }, `Step ${i + 1} of ${SESSION_STEPS.length}`),
    h('h2', { class: 'sess-card__title', id: 'sessTitle' }, step.title),
    h('p', { class: 'sess-tip' }, icon('bulb'), h('span', null, step.tip)),
    (step.say || []).map((line, k) => scriptLine(line, { label: k ? 'You could add' : 'You could say', fk: `sess-say:${step.id}:${k}`, srLabel: `Copy line ${k + 1} for ${step.title}` })),
    blocks.map((b, k) => {
      if (b.kind === 'empty') return h('p', { class: 'notice notice--info' }, icon('info'), h('span', { class: 'notice__body' }, b.text));
      if (b.kind === 'dates') return h('div', { class: 'sess-dates' }, b.items.map((t) => h('span', { class: 'sess-date' }, icon('calendar', 'icon--sm'), t)));
      if (b.kind === 'questions') return h('div', { class: 'sess-block' }, h('p', { class: 'tk-label' }, b.label), h('ul', { class: 'hd-seg__list' }, b.items.map((q) => h('li', null, q))));
      return h('div', { class: 'sess-block' }, h('div', { class: 'sess-block__head' }, h('p', { class: 'tk-label' }, b.label), copyButton(b.text, { label: 'Copy', srLabel: `Copy: ${b.label}`, fk: `sess-copy:${step.id}:${k}` })), h('p', { class: 'sess-read' }, b.text));
    }),
    last
      ? h(
          'div',
          { class: 'sess-finish' },
          h('p', { class: 'sess-finish__text' }, 'When the session is done, paste the coaching into your form and start tracking the follow-up so it does not slip.'),
          h(
            'div',
            { class: 'sess-finish__actions' },
            copyButton(() => builderAllText(), { label: 'Copy all sections', srLabel: 'Copy all four coaching sections', primary: true, size: 'md', fk: 'sess-copyall' }),
            h('button', { type: 'button', class: 'btn', 'data-fk': 'sess-track', onclick: openTrackFromBuilder }, icon('calendar'), 'Track this plan')
          )
        )
      : null
  );
  const s = sessionElapsed();
  const nav = h(
    'div',
    { class: 'sess-nav' },
    h('span', { class: 'sess-clock', id: 'sessClock', 'aria-label': 'Session time' }, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`),
    h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'sess-timer', onclick: toggleSessionClock }, icon(sessionClock.running ? 'pause' : 'pulse'), sessionClock.running ? 'Pause timer' : 'Start timer'),
    h('span', { class: 'toolbar__spacer' }),
    h('button', { type: 'button', class: 'btn', disabled: i === 0, 'data-fk': 'sess-back', onclick: () => setSessionStep(i - 1) }, icon('chev-left'), 'Back'),
    last ? null : h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'sess-next', onclick: () => setSessionStep(i + 1) }, 'Next step', icon('chev-right'))
  );
  put(
    main,
    head,
    h('p', { class: 'sess-for' }, icon('target'), `Coaching on ${joinList(opps.map((o) => o.title))}`),
    h('div', { class: 'sess-layout' }, steps, h('div', { class: 'sess-main' }, card, nav))
  );
  if (sessionClock.running && !sessionClock.timer) sessionClock.timer = setInterval(drawSessionClock, 1000);
}
