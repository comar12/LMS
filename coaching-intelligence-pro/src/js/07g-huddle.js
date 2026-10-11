/* ==========================================================================
   07g-huddle: Team Huddle Builder (one behavior, a timed agenda written from
   the library entry, team-chat recap, and a full-screen present mode)
   ========================================================================== */

// Individual attendance and wellbeing conversations belong in private, never in a team huddle.
const HUDDLE_PRIVATE = new Set(['people-unplanned-absence', 'people-no-call-no-show', 'people-absence-pattern', 'people-disengagement', 'people-stress-fatigue', 'people-low-confidence', 'people-growth-goals', 'people-team-connection']);
const HUDDLE_STARTERS = ['hold-dead-air', 'com-missing-empathy', 'own-confirm-resolution', 'own-unnecessary-transfer', 'people-break-overrun'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function firstSentences(text, n) {
  const parts = String(text || '').match(/[^.!?]+[.!?]+/g) || [];
  return parts.slice(0, n).map((x) => x.trim()).join(' ');
}

const huddleOk = (o) => o && !HUDDLE_PRIVATE.has(o.id) && o.b && o.b.commit;

/** Behaviors most often logged as "Not met" in the tracker over the last two weeks. */
function huddleSuggestions() {
  const since = addDays(todayDay(), -13);
  const misses = {};
  state.tracker.plans.forEach((p) =>
    p.logs.forEach((l) => {
      if (l.date < since) return;
      Object.entries(l.results).forEach(([id, r]) => {
        if (r === 'miss') misses[id] = (misses[id] || 0) + 1;
      });
    })
  );
  const ranked = Object.keys(misses)
    .filter((id) => huddleOk(getOpp(id)))
    .sort((a, b) => misses[b] - misses[a])
    .slice(0, 5)
    .map((id) => ({ id, misses: misses[id] }));
  return { fromTracker: ranked.length > 0, items: ranked.length ? ranked : HUDDLE_STARTERS.filter((id) => huddleOk(getOpp(id))).map((id) => ({ id, misses: 0 })) };
}

function huddleTiming(minutes, withWin) {
  const t = minutes === 5 ? { open: 1, win: 1, good: 2, discuss: 0, practice: 0, commit: 1 } : minutes === 15 ? { open: 2, win: 1, good: 3, discuss: 3, practice: 5, commit: 1 } : { open: 1, win: 1, good: 2, discuss: 2, practice: 3, commit: 1 };
  if (!withWin) {
    t.win = 0;
    if (minutes === 5) t.good += 1;
    else t.practice += 1;
  }
  return t;
}

/** The agenda, written only from the library entry and the chosen strength. */
function huddleSegments(o, s, minutes) {
  const people = isPeopleOpp(o);
  const unit = people ? 'shift' : 'call';
  const focus = focusPhrase(o);
  const t = huddleTiming(minutes, !!s);
  const examples = exampleLines(o);
  const segs = [];
  segs.push({ key: 'open', title: 'Why it matters', min: t.open, lines: [`Today's focus: ${focus}.`, firstSentences(o.impact, 2)] });
  if (s) segs.push({ key: 'win', title: 'Team win', min: t.win, lines: [`Shout-out to the team for ${s.title.toLowerCase()}.`, `${s.title}: ${s.desc}`] });
  segs.push({ key: 'good', title: 'What good looks like', min: t.good, lines: [`The goal: ${o.b.commit}.`], quotes: examples });
  if (t.discuss)
    segs.push({
      key: 'discuss',
      title: 'Talk it through',
      min: t.discuss,
      list: [`Where on our ${unit}s does ${focus} get hardest?`, `What has worked for you with ${focus} on a busy day?`, `What will you try on your next ${unit}?`],
    });
  if (t.practice)
    segs.push({
      key: 'practice',
      title: 'Practice in pairs',
      min: t.practice,
      lines: people
        ? ['Pair up. Take turns saying the example line out loud, then talk about when you would use it.', 'Share one reminder or habit that helps you with this.']
        : ['Pair up. One person plays the customer and the other uses the example line. Then switch.', `Listen for ${focus}, and give each other one specific tip.`],
    });
  segs.push({
    key: 'commit',
    title: 'Commit',
    min: t.commit,
    lines: [`On your next ${unit}, ${o.b.commit}.`, people ? `I will check in with each of you on ${focus} this week.` : `I will listen for ${focus} in call reviews this week.`],
  });
  let at = 0;
  segs.forEach((sg, i) => {
    sg.n = i + 1;
    sg.at = at;
    at += sg.min;
  });
  return segs;
}

function segText(sg) {
  const out = [...(sg.lines || [])];
  (sg.quotes || []).forEach((q) => out.push(q.label ? `${q.label}: "${q.say}"` : `"${q.say}"`));
  (sg.list || []).forEach((q) => out.push(q));
  return out.join('\n');
}

function huddlePlanText(o, s, minutes) {
  const segs = huddleSegments(o, s, minutes);
  return [`Team Huddle: ${o.title} (${minutes} minutes)`].concat(segs.map((sg) => `${sg.n}. ${sg.title} (${plural(sg.min, 'min', 'min')})\n${segText(sg)}`)).join('\n\n');
}

function huddleRecapText(o) {
  const ex = exampleLines(o)[0];
  const people = isPeopleOpp(o);
  return [`Huddle recap: ${focusPhrase(o)}.`, `The goal: ${o.b.commit}.`, ex ? `Try this line: "${ex.say}"` : null, people ? 'Reach out to me if anything gets in the way.' : 'I will be listening for it in call reviews this week.'].filter(Boolean).join(' ');
}

function setHuddle(patch) {
  Object.assign(state.huddle, patch);
  persist('huddle');
  state.ui.tabAnim = true;
  refresh({ panel: false });
}

function markHuddleHeld(o) {
  state.huddle.history.unshift({ date: todayDay(), opp: o.id, minutes: state.huddle.minutes });
  state.huddle.history = state.huddle.history.slice(0, 50);
  persist('huddle');
  refresh({ panel: false });
  toast(`Huddle on ${focusPhrase(o)} saved to your history`);
}

/* ---------- Present mode ---------- */
function presentHuddle(o, s, minutes) {
  const segs = huddleSegments(o, s, minutes);
  let i = 0;
  let left = segs[0].min * 60;
  let timer = null;
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const stage = h('div', { class: 'present', 'aria-live': 'polite' });
  const clock = h('span', { class: 'present__clock' });
  const playBtn = h('button', { type: 'button', class: 'btn present__play' });
  const prev = h('button', { type: 'button', class: 'btn', 'aria-label': 'Previous part' }, icon('chev-left'), 'Back');
  const next = h('button', { type: 'button', class: 'btn btn--primary', 'aria-label': 'Next part' }, 'Next', icon('chev-right'));
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const drawClock = () => {
    clock.textContent = fmt(Math.max(0, left));
    clock.classList.toggle('is-over', left <= 0);
    playBtn.replaceChildren(icon(timer ? 'pause' : 'pulse'), timer ? 'Pause timer' : 'Start timer');
  };
  const draw = () => {
    const sg = segs[i];
    stage.replaceChildren(
      h('div', { class: 'present__dots', 'aria-hidden': 'true' }, segs.map((x, k) => h('span', { class: `present__dot${k === i ? ' is-on' : k < i ? ' is-done' : ''}` }))),
      h('p', { class: 'present__meta' }, `Part ${sg.n} of ${segs.length} · ${plural(sg.min, 'minute')}`),
      h('h3', { class: 'present__title' }, sg.title),
      h(
        'div',
        { class: 'present__body' },
        (sg.lines || []).map((l) => h('p', null, l)),
        (sg.quotes || []).map((q) => h('blockquote', null, q.label ? h('span', null, q.label) : null, `“${q.say}”`)),
        sg.list ? h('ul', null, sg.list.map((q) => h('li', null, q))) : null
      )
    );
    prev.disabled = i === 0;
    next.replaceChildren(i === segs.length - 1 ? 'Finish' : 'Next', icon(i === segs.length - 1 ? 'check' : 'chev-right'));
    drawClock();
  };
  const go = (d) => {
    if (i + d < 0) return;
    if (i + d >= segs.length) {
      m.close();
      return;
    }
    i += d;
    left = segs[i].min * 60;
    draw();
  };
  playBtn.addEventListener('click', () => {
    if (timer) stop();
    else
      timer = setInterval(() => {
        left -= 1;
        drawClock();
      }, 1000);
    drawClock();
  });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  const m = openModal({
    title: `Huddle: ${o.title}`,
    size: 'present',
    body: h('div', null, stage, h('div', { class: 'present__bar' }, clock, playBtn, h('span', { class: 'spacer' }), prev, next)),
    initialFocus: next,
    onClose: stop,
  });
  m.el.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(-1);
    }
  });
  draw();
}

/* ---------- Page ---------- */
function renderHuddle(main) {
  const hd = state.huddle;
  const o = huddleOk(getOpp(hd.opp)) ? getOpp(hd.opp) : null;
  const s = hd.strength ? getStrength(hd.strength) : null;
  const sug = huddleSuggestions();
  const lastHeld = (id) => hd.history.find((r) => r.opp === id);

  const combo = combobox({
    id: 'combo-huddle',
    label: 'Choose a behavior for the huddle',
    placeholder: 'Search any behavior (e.g. dead air, transfer, breaks)',
    getItems: (q) => {
      const pool = (q.trim() ? searchList(content.opps, q).results.map((r) => r.item) : content.opps).filter(huddleOk);
      return pool.map((x) => ({ id: x.id, title: x.title, sub: x.id === hd.opp ? 'Selected' : (CAT_MAP[x.cat] || {}).nav, dotCat: x.cat }));
    },
    onSelect: (id) => setHuddle({ opp: id }),
  });

  const sugCards = h(
    'div',
    { class: 'hd-sugs' },
    sug.items.map(({ id, misses }) => {
      const x = getOpp(id);
      const held = lastHeld(id);
      return h(
        'button',
        { type: 'button', class: `hd-sug cat-${x.cat}`, 'aria-pressed': String(hd.opp === id), 'data-fk': `hd-sug:${id}`, onclick: () => setHuddle({ opp: id }) },
        h('span', { class: 'hd-sug__dot', 'aria-hidden': 'true' }),
        h('span', { class: 'hd-sug__text' }, h('span', { class: 'hd-sug__title' }, x.title), h('span', { class: 'hd-sug__meta' }, misses ? `Not met ${plural(misses, 'time')} in the last two weeks` : (x.kpi || []).map((k) => (KPI_MAP[k] || { label: k }).label).join(' · '), held ? ` · last huddle ${fmtDay(held.date)}` : ''))
      );
    })
  );

  const strengthSelect = h(
    'select',
    { class: 'select', id: 'hd-strength', 'data-fk': 'hd-strength', onchange: (e) => setHuddle({ strength: e.target.value || null }) },
    h('option', { value: '' }, 'No team win this time'),
    S_GROUPS.map((g) => h('optgroup', { label: g.label }, content.strengths.filter((x) => x.group === g.id).map((x) => h('option', { value: x.id, selected: x.id === hd.strength }, x.title))))
  );

  const setup = h(
    'div',
    { class: 'builder__col' },
    h(
      'section',
      { class: 'card', 'aria-labelledby': 'hdPickTitle' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'hdPickTitle' }, icon('target'), 'Focus behavior')),
      h(
        'div',
        { class: 'card__body' },
        h('p', { class: 'tk-label' }, sug.fromTracker ? 'Most missed in your tracker' : 'Starter ideas'),
        sugCards,
        !sug.fromTracker ? h('p', { class: 'hint' }, icon('info'), 'Log call reviews in the Follow-Up Tracker and this list will show the behaviors your team misses most.') : null,
        h('p', { class: 'tk-label', style: 'margin-top:14px' }, 'Or search the library'),
        combo,
        h('p', { class: 'hint' }, icon('lock'), 'Individual attendance and wellbeing topics are left out on purpose. Those conversations belong in private.')
      )
    ),
    h(
      'section',
      { class: 'card', 'aria-labelledby': 'hdSetTitle' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'hdSetTitle' }, icon('sliders'), 'Huddle settings')),
      h(
        'div',
        { class: 'card__body' },
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Length'), segmented({ label: 'Huddle length', value: hd.minutes, fkPrefix: 'hd-min', options: [5, 10, 15].map((n) => ({ value: n, label: `${n} min` })), onChange: (v) => setHuddle({ minutes: v }) })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'hd-strength' }, 'Open with a team win (optional)'), strengthSelect)
      )
    ),
    hd.history.length
      ? h(
          'section',
          { class: 'card', 'aria-labelledby': 'hdHistTitle' },
          h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'hdHistTitle' }, icon('calendar'), 'Recent huddles')),
          h('ul', { class: 'hd-hist' }, hd.history.slice(0, 6).map((r) => h('li', null, h('span', { class: 'hist__date' }, fmtDay(r.date)), getOpp(r.opp) ? getOpp(r.opp).title : 'Removed entry', h('span', { class: 'hd-hist__min' }, `${r.minutes} min`))))
        )
      : null
  );

  let out;
  if (!o) {
    out = h('div', { class: 'builder__col' }, emptyState({ iconName: 'users', title: 'Choose a behavior to build the huddle', text: 'Pick one of the suggestions or search the library. One focus per huddle works best.' }));
  } else {
    const segs = huddleSegments(o, s, hd.minutes);
    const anim = takeTabAnim();
    out = h(
      'div',
      { class: 'builder__col' },
      h(
        'div',
        { class: `hd-hero cat-${o.cat}${anim}` },
        h('div', { class: 'hd-hero__text' }, h('p', { class: 'hd-hero__eyebrow' }, `${hd.minutes}-minute huddle`), h('h2', { class: 'hd-hero__title' }, o.title), h('p', { class: 'hd-hero__sub' }, `${plural(segs.length, 'part')} · built from the library entry`)),
        h(
          'div',
          { class: 'hd-hero__actions' },
          h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'hd-present', onclick: () => presentHuddle(o, s, hd.minutes) }, icon('monitor'), 'Present'),
          copyButton(() => huddlePlanText(o, s, hd.minutes), { label: 'Copy plan', srLabel: 'Copy huddle plan', size: 'md', fk: 'hd-copy' }),
          copyButton(() => huddleRecapText(o), { label: 'Copy team chat recap', srLabel: 'Copy team chat recap', size: 'md', fk: 'hd-recap' })
        )
      ),
      h(
        'ol',
        { class: `hd-agenda${anim}` },
        segs.map((sg) =>
          h(
            'li',
            { class: `hd-seg hd-seg--${sg.key}`, style: `--i:${sg.n - 1}` },
            h('div', { class: 'hd-seg__time' }, h('span', { class: 'hd-seg__at' }, `${sg.at}:00`), h('span', { class: 'hd-seg__min' }, `${sg.min} min`)),
            h(
              'div',
              { class: 'hd-seg__card' },
              h('h3', { class: 'hd-seg__title' }, sg.title),
              (sg.lines || []).map((l) => h('p', { class: 'hd-seg__line' }, l)),
              (sg.quotes || []).map((q, k) => scriptLine(q.say, { label: q.label || 'Example', fk: `hd-say:${k}`, srLabel: `Copy example ${k + 1}` })),
              sg.list ? h('ul', { class: 'hd-seg__list' }, sg.list.map((q) => h('li', null, q))) : null
            )
          )
        )
      ),
      h('div', { class: 'hd-foot' }, h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'hd-held', onclick: () => markHuddleHeld(o) }, icon('check'), 'Mark as held today'), h('a', { class: 'btn btn--sm btn--ghost', href: `#/huddle?open=${o.id}`, 'data-fk': 'hd-entry' }, 'Open the full coaching entry', icon('arrow-right')))
    );
  }

  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('users', 'icon--sm')), 'Team'],
      title: 'Team Huddle Builder',
      sub: 'Turn one behavior into a ready-to-run huddle: why it matters, what good sounds like, a short discussion, practice in pairs, and one commitment. Everything comes from the library entry, so there is nothing to prepare.',
    }),
    h('div', { class: 'builder hd-layout' }, setup, out)
  );
}
