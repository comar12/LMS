/* ==========================================================================
   07m-practice: Practice Lab (role-play scenarios scored against the Call
   Review steps) and the shared stopwatch used by Practice Lab and Live Listen
   ========================================================================== */

const PRACTICE = DATA.practice.scenarios;
const PRACTICE_MAP = Object.fromEntries(PRACTICE.map((s) => [s.id, s]));
const STAGE_LABEL = { brief: 'Brief', play: 'Role-play', score: 'Score', debrief: 'Debrief' };
const PRACTICE_MARK = { met: 'Met', gap: 'Practice more' };

/* ---------- Stopwatch ---------- */
const clockMs = (o) => (o ? o.acc + (o.runAt ? Date.now() - o.runAt : 0) : 0);
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}
const clockSource = (key) => (key === 'listen' ? state.listen : key === 'practice' ? state.practice.current : null);
function startClock(o) {
  if (o && !o.runAt) o.runAt = Date.now();
}
function pauseClock(o) {
  if (o && o.runAt) {
    o.acc += Date.now() - o.runAt;
    o.runAt = 0;
  }
}
/** Running clocks update in place twice a second; nothing else re-renders. */
function tickClocks() {
  document.querySelectorAll('[data-clock]').forEach((el) => {
    const o = clockSource(el.getAttribute('data-clock'));
    if (o) el.textContent = fmtClock(clockMs(o));
  });
  if (typeof tickListenTrack === 'function') tickListenTrack();
}
setInterval(tickClocks, 500);

function clockFace(key, o) {
  return h('span', { class: `clock${o && o.runAt ? ' is-running' : ''}`, role: 'timer', 'aria-label': 'Elapsed time', 'data-clock': key }, fmtClock(clockMs(o)));
}
/** Animated sound bars that move while a clock runs. */
function waveBars(on) {
  return h('span', { class: `wave${on ? ' is-on' : ''}`, 'aria-hidden': 'true' }, Array.from({ length: 7 }, (_, i) => h('span', { style: `--i:${i}` })));
}

/* ---------- Data helpers ---------- */
const practiceType = (sc) => REVIEW_TYPE_MAP[sc.type];
const rubricItem = (sc, r) => reviewItems(sc.type).find((x) => x.id === r.step) || { title: r.step, gaps: [], strength: null };
const practiceTimes = (id) => state.practice.history.filter((x) => x.scenario === id).length;
function practiceWho(memberId) {
  if (!memberId) return 'Whole team';
  const m = state.team.members.find((x) => x.id === memberId);
  return m ? memberLabel(m) : 'Former team member';
}
function practiceScore(sc, marks) {
  const met = sc.rubric.filter((r) => marks[r.step] === 'met').length;
  return { met, gap: sc.rubric.filter((r) => marks[r.step] === 'gap').length, total: sc.rubric.length };
}
function savePractice() {
  persist('practice');
}

/* ---------- Actions ---------- */
function startPractice(id) {
  state.practice.current = { id, stage: 'brief', who: 'team', member: '', marks: {}, said: [], acc: 0, runAt: 0, saved: false };
  savePractice();
  state.ui.tabAnim = true;
  refresh({ panel: false });
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  focusByKey('pr-stage');
}

function setPracticeStage(stage) {
  const c = state.practice.current;
  if (!c || c.stage === stage) return;
  if (stage === 'play') startClock(c);
  else pauseClock(c);
  c.stage = stage;
  savePractice();
  state.ui.tabAnim = true;
  refresh({ panel: false });
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  focusByKey('pr-stage');
}

async function exitPractice() {
  const c = state.practice.current;
  if (!c) return;
  const dirty = !c.saved && (Object.keys(c.marks).length || c.said.length);
  if (dirty && !(await confirmDialog({ title: 'Leave this role-play?', message: 'The scores you marked are not saved to the practice history yet.', confirmLabel: 'Leave without saving' }))) return;
  state.practice.current = null;
  savePractice();
  state.ui.enterAnim = true;
  refresh({ panel: false });
}

function surprisePractice() {
  const pool = PRACTICE.filter((s) => state.practice.filter === 'all' || s.type === state.practice.filter);
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const cards = [...document.querySelectorAll('.pr-card')];
  if (reducedMotion() || cards.length < 2) return startPractice(pick.id);
  // A short "roll" across the cards before landing on the pick.
  let n = 0;
  const steps = 12;
  const roll = () => {
    cards.forEach((c) => c.classList.remove('is-roll'));
    if (n < steps) {
      cards[Math.floor(Math.random() * cards.length)].classList.add('is-roll');
      n++;
      setTimeout(roll, 60 + n * 12);
      return;
    }
    const target = document.querySelector(`.pr-card[data-id="${pick.id}"]`);
    if (target) target.classList.add('is-picked');
    setTimeout(() => startPractice(pick.id), 520);
  };
  roll();
}

function markPractice(step, mark) {
  const c = state.practice.current;
  if (!c) return;
  if (c.marks[step] === mark) delete c.marks[step];
  else c.marks[step] = mark;
  c.saved = false;
  savePractice();
  state.ui.flash = `pr:${step}`;
  refresh({ panel: false });
  state.ui.flash = null;
  const sc = PRACTICE_MAP[c.id];
  const r = sc.rubric.find((x) => x.step === step);
  if (r) announce(c.marks[step] ? `${rubricItem(sc, r).title}: ${PRACTICE_MARK[c.marks[step]]}` : `${rubricItem(sc, r).title}: cleared`);
}

function toggleSaid(i) {
  const c = state.practice.current;
  const k = c.said.indexOf(i);
  if (k >= 0) c.said.splice(k, 1);
  else c.said.push(i);
  savePractice();
  state.ui.flash = `said:${i}`;
  refresh({ panel: false });
  state.ui.flash = null;
}

function logPractice() {
  const c = state.practice.current;
  if (!c || c.saved) return;
  const before = document.querySelector('[data-fk="pr-save"]');
  const rect = before ? before.getBoundingClientRect() : null;
  state.practice.history.push({ id: uid('prx'), date: todayDay(), scenario: c.id, member: c.who === 'one' ? c.member : '', marks: { ...c.marks }, secs: Math.round(clockMs(c) / 1000) });
  c.saved = true;
  savePractice();
  refresh({ panel: false });
  celebrateAt('[data-fk="pr-save"]', rect);
  toast(`Practice saved for ${practiceWho(c.who === 'one' ? c.member : '')}`);
}

function practiceToBuilder() {
  const c = state.practice.current;
  const sc = PRACTICE_MAP[c.id];
  const opps = [];
  const strengths = [];
  sc.rubric.forEach((r) => {
    const it = rubricItem(sc, r);
    if (c.marks[r.step] === 'gap' && it.gaps[0] && getOpp(it.gaps[0]) && !opps.includes(it.gaps[0])) opps.push(it.gaps[0]);
    if (c.marks[r.step] === 'met' && it.strength && getStrength(it.strength) && !strengths.includes(it.strength)) strengths.push(it.strength);
  });
  if (!opps.length && !strengths.length) {
    toast('Score at least one step first.', { type: 'warn' });
    return;
  }
  const newOpps = opps.filter((id) => !state.builder.opps.includes(id));
  state.builder.opps.push(...newOpps);
  const have = new Set(state.builder.strengths.map((s) => s.id));
  const newStr = strengths.filter((id) => !have.has(id));
  newStr.forEach((id) => state.builder.strengths.push({ id, v: 0 }));
  persist('builder');
  refresh({ panel: false });
  toast(newOpps.length || newStr.length ? `Added ${plural(newOpps.length, 'opportunity', 'opportunities')} and ${plural(newStr.length, 'strength')} to the Coaching Builder` : 'Those are already in the Coaching Builder', { action: { label: 'Open Builder', fn: () => navigate('builder') } });
}

function practiceDebriefText() {
  const c = state.practice.current;
  const sc = PRACTICE_MAP[c.id];
  const t = practiceType(sc);
  const well = sc.rubric.filter((r) => c.marks[r.step] === 'met').map((r) => rubricItem(sc, r).title);
  const more = sc.rubric.filter((r) => c.marks[r.step] === 'gap').map((r) => rubricItem(sc, r).title);
  const out = [`Practice: ${sc.title}`, `Call type: ${t.label}`];
  if (well.length) out.push('', 'Went well', ...well);
  if (more.length) out.push('', 'Practice more', ...more);
  out.push('', 'What great sounds like', ...sc.model.map((m) => `"${m}"`));
  out.push('', 'Questions to reflect on', ...sc.debrief);
  return out.join('\n');
}

/* ---------- Landing ---------- */
function levelDots(n) {
  return h('span', { class: 'pr-level', role: 'img', 'aria-label': `Difficulty ${n} of 3` }, [1, 2, 3].map((i) => h('span', { class: i <= n ? 'is-on' : '' })));
}

function practiceCard(sc, i) {
  const t = practiceType(sc);
  const times = practiceTimes(sc.id);
  return h(
    'article',
    { class: `pr-card cat-${t.cat}`, 'data-id': sc.id, style: `--d:${Math.min(i, 12) * 40}ms`, 'aria-labelledby': `prc-${sc.id}` },
    h('div', { class: 'pr-card__top' }, h('span', { class: 'pr-card__icon', 'aria-hidden': 'true' }, icon(t.icon)), h('span', { class: 'pr-card__type' }, t.id === 'sales' ? 'Sales' : t.label), times ? h('span', { class: 'pr-card__badge' }, icon('check', 'icon--sm'), `Practiced ${times}x`) : null),
    h('h3', { class: 'pr-card__title', id: `prc-${sc.id}` }, sc.title),
    h('p', { class: 'pr-card__brief' }, sc.brief),
    h('div', { class: 'pr-card__meta' }, levelDots(sc.level), h('span', { class: 'pr-card__min' }, icon('pause', 'icon--sm'), `${sc.minutes} min`), sc.kpi.map(kpiChip)),
    h('button', { type: 'button', class: 'btn btn--primary btn--sm pr-card__go', 'data-fk': `pr-start:${sc.id}`, 'aria-label': `Start practice: ${sc.title}`, onclick: () => startPractice(sc.id) }, icon('arrow-right'), 'Start')
  );
}

function renderPracticeLanding(main) {
  const f = state.practice.filter;
  const list = PRACTICE.filter((s) => f === 'all' || s.type === f);
  const recent = state.practice.history.slice(-6).reverse();
  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('chat', 'icon--sm')), 'Team'],
      title: 'Practice Lab',
      sub: DATA.practice.intro,
      actions: h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': 'pr-surprise', onclick: surprisePractice }, icon('sparkle'), 'Surprise me'),
    }),
    h(
      'div',
      { class: 'pr-filter' },
      segmented({
        label: 'Call type',
        value: f,
        fkPrefix: 'pr-filter',
        options: [{ value: 'all', label: 'All' }].concat(REVIEW_TYPES.map((t) => ({ value: t.id, label: t.id === 'sales' ? 'Sales' : t.short || t.label.split(' ')[0], icon: t.icon }))),
        onChange: (v) => {
          state.practice.filter = v;
          savePractice();
          refresh({ panel: false });
        },
      }),
      h('span', { class: 'sec__sub' }, plural(list.length, 'scenario'))
    ),
    h('h2', { class: 'sr-only' }, 'Scenarios'),
    h('div', { class: 'pr-grid' }, list.map(practiceCard)),
    h(
      'section',
      { class: 'card pr-recent', 'aria-labelledby': 'prRecent' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prRecent' }, icon('calendar'), 'Recent practice')),
      recent.length
        ? h(
            'ul',
            { class: 'rt-list' },
            recent.map((x) => {
              const sc = PRACTICE_MAP[x.scenario];
              const s = practiceScore(sc, x.marks);
              return h(
                'li',
                { class: 'rt-row' },
                h('span', { class: 'rt-row__icon', 'aria-hidden': 'true' }, icon(practiceType(sc).icon)),
                h('div', { class: 'rt-row__main' }, h('div', { class: 'rt-row__head' }, h('span', { class: 'rt-row__title' }, sc.title), h('span', { class: 'rt-due rt-due--later' }, fmtDay(x.date))), h('p', { class: 'rt-row__note' }, `${practiceWho(x.member)} · ${s.met} of ${s.total} steps met${x.secs ? ` · ${fmtClock(x.secs * 1000)}` : ''}`)),
                h('span', { class: 'pr-mini', role: 'img', 'aria-label': `${s.met} of ${s.total} met` }, h('span', { style: `width:${s.total ? Math.round((s.met / s.total) * 100) : 0}%` }))
              );
            })
          )
        : h('p', { class: 'day-empty' }, icon('info'), 'Practices you save show up here, with who practiced and how it went.')
    )
  );
}

/* ---------- Run ---------- */
function practiceStepper(c) {
  const idx = PRACTICE_STAGES.indexOf(c.stage);
  return h(
    'ol',
    { class: 'pr-steps', style: `--p:${idx / (PRACTICE_STAGES.length - 1)}` },
    PRACTICE_STAGES.map((st, i) =>
      h(
        'li',
        { class: `pr-step${i < idx ? ' is-done' : ''}${i === idx ? ' is-current' : ''}` },
        h('button', { type: 'button', class: 'pr-step__btn', 'aria-current': i === idx ? 'step' : undefined, 'data-fk': `pr-step:${st}`, onclick: () => setPracticeStage(st) }, h('span', { class: 'pr-step__dot', 'aria-hidden': 'true' }, i < idx ? icon('check', 'icon--sm') : String(i + 1)), h('span', { class: 'pr-step__label' }, STAGE_LABEL[st]))
      )
    )
  );
}

function stageBrief(sc, c) {
  const who = choiceGroup({
    label: 'Who is practicing?',
    value: c.who,
    options: [{ value: 'team', label: 'Whole team', icon: 'users' }, { value: 'one', label: 'One agent', icon: 'heart' }],
    onChange: (v) => {
      c.who = v;
      savePractice();
      refresh({ panel: false });
    },
  });
  const picker =
    c.who === 'one' && state.team.members.length
      ? memberPicker({
          value: c.member,
          label: 'Agent practicing',
          onChange: (m) => {
            c.member = m.id;
            savePractice();
          },
        }).el
      : c.who === 'one'
        ? h('p', { class: 'field__hint' }, 'Add your team in Team Pulse to choose who is practicing.')
        : null;
  return [
    h(
      'div',
      { class: 'pr-two' },
      h('section', { class: 'card pr-brief', 'aria-labelledby': 'prBriefT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prBriefT' }, icon('megaphone'), 'Read this to your agent'), copyButton(sc.brief, { label: 'Copy', srLabel: 'Copy the brief', fk: 'pr-copy-brief' })), h('div', { class: 'card__body' }, h('p', { class: 'pr-quote' }, sc.brief))),
      h('section', { class: 'card pr-persona', 'aria-labelledby': 'prPersonaT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prPersonaT' }, icon('lock'), 'How to play the customer'), h('span', { class: 'pr-tag' }, 'Only for you')), h('div', { class: 'card__body' }, h('p', null, sc.persona)))
    ),
    h('section', { class: 'card', 'aria-labelledby': 'prWhoT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prWhoT' }, icon('users'), 'Who is practicing?')), h('div', { class: 'card__body pr-who' }, who.el, picker)),
    h('div', { class: 'pr-next' }, h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'pr-to-play', onclick: () => setPracticeStage('play') }, icon('chat'), 'Start the role-play'))
  ];
}

function stagePlay(sc, c) {
  const running = !!c.runAt;
  return [
    h(
      'section',
      { class: 'card pr-live', 'aria-labelledby': 'prLiveT' },
      h('h2', { class: 'sr-only', id: 'prLiveT' }, 'Role-play timer'),
      h('div', { class: 'pr-live__clock' }, waveBars(running), clockFace('practice', c), h('span', { class: 'pr-live__target' }, `about ${sc.minutes} min`)),
      h(
        'div',
        { class: 'pr-live__actions' },
        h(
          'button',
          {
            type: 'button',
            class: `btn${running ? '' : ' btn--primary'}`,
            'data-fk': 'pr-clock',
            onclick: () => {
              if (c.runAt) pauseClock(c);
              else startClock(c);
              savePractice();
              refresh({ panel: false });
            },
          },
          icon(running ? 'pause' : 'chat'),
          running ? 'Pause' : 'Resume'
        ),
        h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'pr-to-score', onclick: () => setPracticeStage('score') }, icon('checklist'), 'End and score')
      )
    ),
    h(
      'div',
      { class: 'pr-two pr-two--play' },
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'prLinesT' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prLinesT' }, icon('quote'), 'Your lines as the customer'), h('span', { class: 'sec__sub' }, `${c.said.length} of ${sc.lines.length} used`)),
        h(
          'ol',
          { class: 'pr-lines' },
          sc.lines.map((ln, i) => {
            const said = c.said.includes(i);
            return h(
              'li',
              { class: `pr-line${said ? ' is-said' : ''}${state.ui.flash === `said:${i}` ? ' is-flash' : ''}`, style: `--i:${i}` },
              h('span', { class: 'pr-line__when' }, ln.when),
              h('p', { class: 'pr-line__say' }, ln.say),
              h('button', { type: 'button', class: `btn btn--sm${said ? ' is-done' : ''}`, 'aria-pressed': String(said), 'data-fk': `pr-said:${i}`, onclick: () => toggleSaid(i) }, icon('check'), said ? 'Used' : 'Mark used')
            );
          })
        )
      ),
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'prListenT' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prListenT' }, icon('target'), 'Listen for')),
        h('ul', { class: 'pr-looks' }, sc.rubric.map((r, i) => h('li', { style: `--i:${i}` }, h('strong', null, rubricItem(sc, r).title), h('span', null, r.look))))
      )
    ),
  ];
}

function stageScore(sc, c) {
  const s = practiceScore(sc, c.marks);
  return [
    h(
      'section',
      { class: 'scorecard pr-scorecard', 'aria-label': 'Practice score' },
      progressRing(s.met + s.gap, s.total, `${s.met + s.gap} of ${s.total} steps scored`, `practice:${c.id}`),
      h('div', { class: 'pr-scorecard__text' }, h('p', { class: 'pr-scorecard__big' }, `${s.met} met, ${s.gap} to practice`), h('p', { class: 'sec__sub' }, 'Score each step from what you heard. Steps you skip are left out.'))
    ),
    h('h2', { class: 'sr-only' }, 'Score each step'),
    h(
      'ul',
      { class: 'rv-list pr-rubric' },
      sc.rubric.map((r, i) => {
        const it = rubricItem(sc, r);
        const m = c.marks[r.step];
        return h(
          'li',
          { class: `rv-row${m ? ` is-${m}` : ''}${state.ui.flash === `pr:${r.step}` ? ' is-flash' : ''}` },
          h('span', { class: 'rv-row__num', 'aria-hidden': 'true' }, String(i + 1)),
          h('div', { class: 'rv-row__main' }, h('h3', { class: 'rv-row__title' }, it.title), h('p', { class: 'rv-row__good' }, r.look)),
          h(
            'div',
            { class: 'rv-row__marks', role: 'group', 'aria-label': `Score: ${it.title}` },
            h('button', { type: 'button', class: 'rv-btn rv-btn--met', 'aria-pressed': String(m === 'met'), 'data-fk': `pr-met:${r.step}`, onclick: () => markPractice(r.step, 'met') }, icon('check'), 'Met'),
            h('button', { type: 'button', class: 'rv-btn rv-btn--gap', 'aria-pressed': String(m === 'gap'), 'data-fk': `pr-gap:${r.step}`, onclick: () => markPractice(r.step, 'gap') }, icon('flag'), 'Practice more')
          )
        );
      })
    ),
    h('div', { class: 'pr-next' }, h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'pr-to-debrief', onclick: () => setPracticeStage('debrief') }, icon('arrow-right'), 'See the debrief')),
  ];
}

function stageDebrief(sc, c) {
  const s = practiceScore(sc, c.marks);
  const well = sc.rubric.filter((r) => c.marks[r.step] === 'met');
  const more = sc.rubric.filter((r) => c.marks[r.step] === 'gap');
  const others = PRACTICE.filter((x) => x.type === sc.type && x.id !== sc.id);
  return [
    h(
      'section',
      { class: 'scorecard pr-scorecard', 'aria-label': 'Practice result' },
      progressRing(s.met, s.total, `${s.met} of ${s.total} steps met`, `practice-met:${c.id}`),
      h('div', { class: 'pr-scorecard__text' }, h('p', { class: 'pr-scorecard__big' }, `${s.met} of ${s.total} steps met`), h('p', { class: 'sec__sub' }, `${practiceWho(c.who === 'one' ? c.member : '')} · ${fmtClock(clockMs(c))} of role-play`))
    ),
    h(
      'div',
      { class: 'pr-two' },
      h('section', { class: 'card pr-well', 'aria-labelledby': 'prWellT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prWellT' }, icon('thumb'), 'Went well')), well.length ? h('ul', { class: 'pr-res' }, well.map((r) => h('li', null, icon('check', 'icon--sm'), rubricItem(sc, r).title))) : h('p', { class: 'day-empty' }, 'No steps marked as met.')),
      h('section', { class: 'card pr-more', 'aria-labelledby': 'prMoreT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prMoreT' }, icon('flag'), 'Practice more')), more.length ? h('ul', { class: 'pr-res' }, more.map((r) => h('li', null, icon('target', 'icon--sm'), rubricItem(sc, r).title))) : h('p', { class: 'day-empty' }, 'No steps marked to practice more.'))
    ),
    h('section', { class: 'card', 'aria-labelledby': 'prModelT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prModelT' }, icon('quote'), 'What great sounds like')), h('div', { class: 'pr-models' }, sc.model.map((m, i) => h('blockquote', { class: 'pr-model', style: `--i:${i}` }, m)))),
    h('section', { class: 'card', 'aria-labelledby': 'prAskT' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'prAskT' }, icon('question'), 'Ask your agent')), h('ol', { class: 'qlist' }, sc.debrief.map((q) => h('li', null, q)))),
    h(
      'div',
      { class: 'pr-finish' },
      h('button', { type: 'button', class: 'btn btn--primary', disabled: c.saved, 'data-fk': 'pr-save', onclick: logPractice }, icon(c.saved ? 'check' : 'save'), c.saved ? 'Saved to history' : 'Save to history'),
      h('button', { type: 'button', class: 'btn', 'data-fk': 'pr-builder', onclick: practiceToBuilder }, icon('clipboard'), 'Add to Builder'),
      copyButton(practiceDebriefText, { label: 'Copy debrief', srLabel: 'Copy debrief', fk: 'pr-copy' }),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn--ghost', 'data-fk': 'pr-again', onclick: () => startPractice(sc.id) }, icon('refresh'), 'Practice again'),
      others.length ? h('button', { type: 'button', class: 'btn btn--ghost', 'data-fk': 'pr-next-sc', onclick: () => startPractice(others[Math.floor(Math.random() * others.length)].id) }, icon('arrow-right'), 'Next scenario') : null
    ),
  ];
}

function renderPracticeRun(main, c) {
  const sc = PRACTICE_MAP[c.id];
  const t = practiceType(sc);
  const body = { brief: stageBrief, play: stagePlay, score: stageScore, debrief: stageDebrief }[c.stage](sc, c);
  put(
    main,
    h(
      'div',
      { class: `pr-hero cat-${t.cat}` },
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm pr-back', 'data-fk': 'pr-back', onclick: exitPractice }, icon('chev-left'), 'All scenarios'),
      h('div', { class: 'pr-hero__row' }, h('span', { class: 'pr-hero__icon', 'aria-hidden': 'true' }, icon(t.icon)), h('div', { class: 'pr-hero__text' }, h('p', { class: 'pr-hero__type' }, `${t.id === 'sales' ? 'Sales' : t.label} practice`), h('h1', { class: 'page-title', id: 'pageTitle' }, sc.title), h('div', { class: 'pr-card__meta' }, levelDots(sc.level), h('span', { class: 'pr-card__min' }, icon('pause', 'icon--sm'), `${sc.minutes} min`), sc.kpi.map(kpiChip)))),
      practiceStepper(c)
    ),
    h('div', { class: `pr-stage${takeTabAnim()}`, tabindex: '-1', 'data-fk': 'pr-stage', 'aria-label': `${STAGE_LABEL[c.stage]} stage` }, ...body)
  );
}

function renderPractice(main) {
  const c = state.practice.current;
  if (c && PRACTICE_MAP[c.id]) renderPracticeRun(main, c);
  else renderPracticeLanding(main);
}
