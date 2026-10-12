/* ==========================================================================
   07n-listen: Live Listen. Tap what you hear during a live or side-by-side
   call; each tap is time-stamped and flows into Call Review and the Builder
   ========================================================================== */

const LISTEN_KIND = { good: 'Good', gap: 'Opportunity', note: 'Note' };
const listenSecs = () => Math.floor(clockMs(state.listen) / 1000);
const listenItem = (id) => reviewItems(state.listen.type).find((x) => x.id === id);
function saveListen() {
  persist('listen');
}

/** Moves the marks along the timeline as the call gets longer. */
function tickListenTrack() {
  const track = document.querySelector('.ls-track');
  if (!track) return;
  const now = listenSecs();
  const span = Math.max(60, now);
  track.querySelectorAll('[data-t]').forEach((el) => {
    el.style.left = `${Math.min(100, (Number(el.getAttribute('data-t')) / span) * 100)}%`;
  });
  const fill = track.querySelector('.ls-track__fill');
  if (fill) fill.style.width = `${Math.min(100, (now / span) * 100)}%`;
  const end = document.querySelector('.ls-track__end');
  if (end) end.textContent = fmtClock(span * 1000);
}

function toggleListenClock() {
  const l = state.listen;
  if (l.runAt) pauseClock(l);
  else startClock(l);
  saveListen();
  refresh({ panel: false });
  announce(l.runAt ? 'Timer started' : 'Timer paused');
}

function addListenMark(kind, item, note = '') {
  const l = state.listen;
  const first = !l.runAt && !l.acc && !l.marks.length;
  if (first) startClock(l);
  const m = { id: uid('mk'), t: listenSecs(), kind, item, note };
  l.marks.push(m);
  saveListen();
  state.ui.flash = `ls:${item || 'note'}:${kind}`;
  refresh({ panel: false });
  state.ui.flash = null;
  const it = listenItem(item);
  announce(`${LISTEN_KIND[kind]} at ${fmtClock(m.t * 1000)}${it ? `: ${it.title}` : ''}`);
  if (first) toast('Timer started with your first tap');
  return m;
}

async function addListenNote() {
  const t = listenSecs();
  const text = await promptDialog({ title: `Note at ${fmtClock(t * 1000)}`, label: 'What happened at this moment?', hint: 'Describe the behavior, not the person. No names or account details.', confirmLabel: 'Add note', maxLength: 200, emptyText: 'Type a short note.' });
  if (!text) return;
  const m = addListenMark('note', '', text);
  m.t = t;
  saveListen();
  refresh({ panel: false });
}

async function editListenNote(id) {
  const m = state.listen.marks.find((x) => x.id === id);
  if (!m) return;
  const text = await promptDialog({ title: `Note at ${fmtClock(m.t * 1000)}`, label: 'What happened at this moment?', value: m.note, hint: 'Describe the behavior, not the person. No names or account details.', confirmLabel: 'Save note', maxLength: 200, emptyText: 'Type a short note.' });
  if (text === null) return;
  m.note = text;
  saveListen();
  refresh({ panel: false });
}

function removeListenMark(id) {
  const l = state.listen;
  const i = l.marks.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [m] = l.marks.splice(i, 1);
  saveListen();
  refresh({ panel: false });
  toast('Moment removed', { action: { label: 'Undo', fn: () => { l.marks.splice(i, 0, m); saveListen(); refresh({ panel: false }); } } });
}

async function resetListen() {
  const l = state.listen;
  if ((l.marks.length || clockMs(l) > 0) && !(await confirmDialog({ title: 'Start a new call?', message: 'The timer and every moment you tapped on this call are cleared. Anything already sent to Call Review or the Builder stays there.', confirmLabel: 'Start a new call', danger: true }))) return;
  state.listen = { ...defaultListen(), type: l.type, member: l.member };
  saveListen();
  refresh({ panel: false });
}

async function setListenType(type) {
  const l = state.listen;
  if (l.type === type) return;
  if (l.marks.some((m) => m.kind !== 'note') && !(await confirmDialog({ title: 'Switch the call type?', message: 'Moments tapped on the current call type are cleared. Notes are kept.', confirmLabel: 'Switch call type' }))) return;
  l.type = type;
  l.marks = l.marks.filter((m) => m.kind === 'note');
  saveListen();
  refresh({ panel: false });
}

/** Each step becomes Met, or an Opportunity if anything was missed on it. */
function listenVerdicts() {
  const out = {};
  state.listen.marks.forEach((m) => {
    if (!m.item || m.kind === 'note') return;
    if (m.kind === 'gap') out[m.item] = 'gap';
    else if (!out[m.item]) out[m.item] = 'met';
  });
  return out;
}

function listenToReview() {
  const v = listenVerdicts();
  const n = Object.keys(v).length;
  if (!n) {
    toast('Tap Good or Miss on at least one step first.', { type: 'warn' });
    return;
  }
  const type = state.listen.type;
  Object.assign(reviewSlot(type).marks, v);
  state.review.type = type;
  persist('review');
  refresh({ panel: false });
  toast(`Sent ${plural(n, 'step')} to the ${REVIEW_TYPE_MAP[type].label} review`, { action: { label: 'Open Call Review', fn: () => navigate('call-review') } });
}

function listenEvidenceText() {
  const lines = state.listen.marks
    .filter((m) => m.kind !== 'good' || m.note)
    .sort((a, b) => a.t - b.t)
    .map((m) => {
      const it = listenItem(m.item);
      const at = `At ${fmtClock(m.t * 1000)}`;
      const end = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
      if (!it) return end(`${at}: ${m.note}`);
      if (m.kind === 'good') return end(`${at}, ${it.title} went well: ${m.note}`);
      return end(m.note ? `${at}, ${it.title}: ${m.note}` : `${at}, missed step: ${it.title}`);
    });
  return lines.length ? `Moments from the call:\n${lines.join('\n')}` : '';
}

function listenToBuilder() {
  const v = listenVerdicts();
  const opps = [];
  const strengths = [];
  Object.entries(v).forEach(([id, mark]) => {
    const it = listenItem(id);
    if (!it) return;
    if (mark === 'gap' && it.gaps[0] && getOpp(it.gaps[0]) && !opps.includes(it.gaps[0])) opps.push(it.gaps[0]);
    if (mark === 'met' && it.strength && getStrength(it.strength) && !strengths.includes(it.strength)) strengths.push(it.strength);
  });
  const evidence = listenEvidenceText();
  if (!opps.length && !strengths.length && !evidence) {
    toast('Tap at least one moment first.', { type: 'warn' });
    return;
  }
  const newOpps = opps.filter((id) => !state.builder.opps.includes(id));
  state.builder.opps.push(...newOpps);
  const have = new Set(state.builder.strengths.map((s) => s.id));
  const newStr = strengths.filter((id) => !have.has(id));
  newStr.forEach((id) => state.builder.strengths.push({ id, v: 0 }));
  if (evidence && !state.builder.notes.evidence.includes(evidence)) {
    state.builder.notes.evidence = [state.builder.notes.evidence.trim(), evidence].filter(Boolean).join('\n\n').slice(0, 4000);
    state.builder.notes.includeEvidence = true;
  }
  persist('builder');
  refresh({ panel: false });
  toast(`Added ${plural(newOpps.length, 'opportunity', 'opportunities')}, ${plural(newStr.length, 'strength')}${evidence ? ', and the time-stamped moments' : ''} to the Coaching Builder`, { action: { label: 'Open Builder', fn: () => navigate('builder') } });
}

function listenMomentsText() {
  const t = REVIEW_TYPE_MAP[state.listen.type];
  const lines = state.listen.marks
    .slice()
    .sort((a, b) => a.t - b.t)
    .map((m) => {
      const it = listenItem(m.item);
      return `${fmtClock(m.t * 1000)}  ${LISTEN_KIND[m.kind]}${it ? `: ${it.title}` : ''}${m.note ? ` (${m.note})` : ''}`;
    });
  return lines.length ? [`Live Listen: ${t.label} call, ${fmtClock(clockMs(state.listen))}`, '', ...lines].join('\n') : '';
}

/* ---------- Page ---------- */
function listenPad(it, counts) {
  const c = counts[it.id] || { good: 0, gap: 0 };
  const flash = state.ui.flash && state.ui.flash.startsWith(`ls:${it.id}:`) ? state.ui.flash.split(':')[2] : '';
  return h(
    'li',
    { class: `ls-pad${c.gap ? ' has-gap' : c.good ? ' has-good' : ''}${flash ? ` is-flash is-flash--${flash}` : ''}` },
    h('div', { class: 'ls-pad__head' }, it.group === 'flow' ? h('span', { class: 'ls-pad__n', 'aria-hidden': 'true' }, String(it.n)) : h('span', { class: 'ls-pad__n ls-pad__n--skill', 'aria-hidden': 'true' }, icon('sparkle', 'icon--sm')), h('span', { class: 'ls-pad__title' }, it.title)),
    h(
      'div',
      { class: 'ls-pad__btns' },
      h('button', { type: 'button', class: 'ls-btn ls-btn--good', 'aria-label': `Good: ${it.title}${c.good ? ` (${c.good} so far)` : ''}`, 'data-fk': `ls-good:${it.id}`, onclick: () => addListenMark('good', it.id) }, icon('thumb'), h('span', null, 'Good'), c.good ? h('span', { class: 'ls-btn__n' }, String(c.good)) : null),
      h('button', { type: 'button', class: 'ls-btn ls-btn--gap', 'aria-label': `Miss: ${it.title}${c.gap ? ` (${c.gap} so far)` : ''}`, 'data-fk': `ls-gap:${it.id}`, onclick: () => addListenMark('gap', it.id) }, icon('flag'), h('span', null, 'Miss'), c.gap ? h('span', { class: 'ls-btn__n' }, String(c.gap)) : null)
    ),
    flash ? h('span', { class: `ls-plus ls-plus--${flash}`, 'aria-hidden': 'true' }, '+1') : null
  );
}

function renderListen(main) {
  const l = state.listen;
  const items = reviewItems(l.type);
  const running = !!l.runAt;
  const secs = listenSecs();
  const span = Math.max(60, secs);
  const counts = {};
  l.marks.forEach((m) => {
    if (!m.item) return;
    counts[m.item] = counts[m.item] || { good: 0, gap: 0 };
    if (m.kind === 'good' || m.kind === 'gap') counts[m.item][m.kind]++;
  });
  const n = (k) => l.marks.filter((m) => m.kind === k).length;
  const sorted = l.marks.slice().sort((a, b) => b.t - a.t);
  const memberSel = state.team.members.length
    ? h(
        'div',
        { class: 'field ls-who' },
        h('label', { class: 'field__label', for: 'ls-member' }, 'Listening to'),
        h(
          'select',
          {
            class: 'select',
            id: 'ls-member',
            'data-fk': 'ls-member',
            onchange: (e) => {
              l.member = e.target.value;
              saveListen();
            },
          },
          h('option', { value: '', selected: !l.member }, 'Not set'),
          state.team.members.map((m) => h('option', { value: m.id, selected: m.id === l.member }, memberLabel(m)))
        )
      )
    : null;
  put(
    main,
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-tech', style: 'width:22px;height:22px;border-radius:6px' }, icon('pulse', 'icon--sm')), 'Coaching'],
      title: 'Live Listen',
      sub: 'Tap what you hear during a live or side-by-side call. Every tap is time-stamped, so your coaching can point to the exact moment. Then send it all to Call Review and the Builder.',
    }),
    h(
      'div',
      { class: 'ls-setup' },
      segmented({ label: 'Call type', value: l.type, fkPrefix: 'ls-type', options: REVIEW_TYPES.map((t) => ({ value: t.id, label: t.id === 'sales' ? 'Sales' : t.label, icon: t.icon })), onChange: setListenType }),
      memberSel
    ),
    h(
      'section',
      { class: `card ls-hero${running ? ' is-live' : ''}`, 'aria-labelledby': 'lsClockT' },
      h('h2', { class: 'sr-only', id: 'lsClockT' }, 'Call timer'),
      h(
        'div',
        { class: 'ls-hero__top' },
        h('div', { class: 'ls-hero__clock' }, h('span', { class: 'ls-live' }, h('span', { class: 'ls-live__dot', 'aria-hidden': 'true' }), running ? 'Live' : secs ? 'Paused' : 'Ready'), clockFace('listen', l), waveBars(running)),
        h(
          'div',
          { class: 'ls-hero__stats' },
          h('span', { class: 'ls-stat ls-stat--good' }, h('strong', null, String(n('good'))), 'good'),
          h('span', { class: 'ls-stat ls-stat--gap' }, h('strong', null, String(n('gap'))), 'missed'),
          h('span', { class: 'ls-stat' }, h('strong', null, String(n('note'))), 'notes')
        ),
        h(
          'div',
          { class: 'ls-hero__actions' },
          h('button', { type: 'button', class: `btn${running ? '' : ' btn--primary'}`, 'data-fk': 'ls-clock', 'aria-keyshortcuts': 'K', onclick: toggleListenClock }, icon(running ? 'pause' : 'pulse'), running ? 'Pause' : secs ? 'Resume' : 'Start call'),
          h('button', { type: 'button', class: 'btn', 'data-fk': 'ls-note', 'aria-keyshortcuts': 'N', onclick: addListenNote }, icon('note'), 'Add note'),
          h('button', { type: 'button', class: 'btn btn--ghost', 'data-fk': 'ls-reset', onclick: resetListen }, icon('refresh'), 'New call')
        )
      ),
      h(
        'div',
        { class: 'ls-track', role: 'img', 'aria-label': `Timeline with ${plural(l.marks.length, 'moment')}` },
        h('span', { class: 'ls-track__fill', style: `width:${Math.min(100, (secs / span) * 100)}%` }),
        l.marks.map((m) => h('span', { class: `ls-dot ls-dot--${m.kind}`, 'data-t': String(m.t), style: `left:${Math.min(100, (m.t / span) * 100)}%`, title: `${fmtClock(m.t * 1000)} ${LISTEN_KIND[m.kind]}${listenItem(m.item) ? `: ${listenItem(m.item).title}` : ''}` }))
      ),
      h('div', { class: 'ls-track__scale', 'aria-hidden': 'true' }, h('span', null, '0:00'), h('span', { class: 'ls-track__end' }, fmtClock(span * 1000))),
      h('p', { class: 'ls-keys' }, icon('info', 'icon--sm'), 'Shortcuts: press K to start or pause, and N to add a note.')
    ),
    h(
      'section',
      { class: 'ls-sec', 'aria-labelledby': 'lsPadsT' },
      h('div', { class: 'home-sec__head' }, h('h2', { class: 'home-sec__title', id: 'lsPadsT' }, icon('target'), 'Tap what you hear'), h('span', { class: 'sec__sub' }, `${REVIEW_TYPE_MAP[l.type].label} steps and skills`)),
      h('ul', { class: 'ls-pads' }, items.map((it) => listenPad(it, counts)))
    ),
    h(
      'div',
      { class: 'pr-two ls-bottom' },
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'lsMomT' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'lsMomT' }, icon('calendar'), 'Moments'), h('span', { class: 'sec__sub' }, plural(l.marks.length, 'moment'))),
        sorted.length
          ? h(
              'ul',
              { class: 'ls-moments' },
              sorted.map((m) => {
                const it = listenItem(m.item);
                return h(
                  'li',
                  { class: `ls-moment ls-moment--${m.kind}` },
                  h('span', { class: 'ls-moment__t' }, fmtClock(m.t * 1000)),
                  h('span', { class: 'ls-moment__icon', 'aria-hidden': 'true' }, icon(m.kind === 'good' ? 'thumb' : m.kind === 'gap' ? 'flag' : 'note', 'icon--sm')),
                  h('div', { class: 'ls-moment__main' }, h('span', { class: 'ls-moment__title' }, it ? `${LISTEN_KIND[m.kind]}: ${it.title}` : 'Note'), m.note ? h('span', { class: 'ls-moment__note' }, m.note) : null),
                  h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `${m.note ? 'Edit' : 'Add'} note at ${fmtClock(m.t * 1000)}`, 'data-fk': `ls-edit:${m.id}`, onclick: () => editListenNote(m.id) }, icon('edit')),
                  h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove moment at ${fmtClock(m.t * 1000)}`, 'data-fk': `ls-del:${m.id}`, onclick: () => removeListenMark(m.id) }, icon('trash'))
                );
              })
            )
          : h('p', { class: 'day-empty' }, icon('info'), 'Start the call and tap Good or Miss as you hear each step. Your first tap starts the timer.')
      ),
      h(
        'section',
        { class: 'card ls-send', 'aria-labelledby': 'lsSendT' },
        h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'lsSendT' }, icon('arrow-right'), 'After the call')),
        h(
          'div',
          { class: 'card__body ls-send__body' },
          h('p', { class: 'sec__sub' }, 'Steps with any miss become Opportunities, and steps with only good taps become Met. Your notes go to the Builder as time-stamped evidence.'),
          h('button', { type: 'button', class: 'btn btn--primary', disabled: !Object.keys(listenVerdicts()).length, 'data-fk': 'ls-review', onclick: listenToReview }, icon('checklist'), 'Send to Call Review'),
          h('button', { type: 'button', class: 'btn', disabled: !l.marks.length, 'data-fk': 'ls-builder', onclick: listenToBuilder }, icon('clipboard'), 'Add to Builder'),
          copyButton(listenMomentsText, { label: 'Copy moments', srLabel: 'Copy moments', fk: 'ls-copy', emptyMessage: 'Tap at least one moment first.' })
        )
      )
    )
  );
}

/** K starts or pauses the call timer and N adds a note, only on the Live Listen page and never while typing. */
function onListenKeys(e) {
  if (state.ui.view !== 'listen' || modalStack.length || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
  if (e.target && e.target.closest && e.target.closest('.pick__pop')) return;
  const k = e.key.toLowerCase();
  if (k === 'k') {
    e.preventDefault();
    toggleListenClock();
  } else if (k === 'n') {
    e.preventDefault();
    addListenNote();
  }
}
