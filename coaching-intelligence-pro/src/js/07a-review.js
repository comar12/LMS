/* ==========================================================================
   07a-review: call reviews for every call type (Technical Support, Billing,
   Customer Service, Sales & Retention) and the Call Review page
   ========================================================================== */

const REVIEW_TYPES = DATA.callReviews.types
  .map((t) => ({ ...t, icon: { tech: 'router', billing: 'receipt', service: 'chat' }[t.id] || 'checklist', cat: { tech: 'tech', billing: 'bill', service: 'com' }[t.id] || 'com' }))
  .concat([
    {
      id: 'sales',
      label: 'Sales & Retention',
      short: 'Sales',
      intro: 'Follow the ten-step sales flow, from understanding the reason for the call to confirming the customer understands the offer and pricing.',
      icon: 'tag',
      cat: 'sales',
      steps: DATA.salesToolkit.steps,
      skills: DATA.salesToolkit.skills,
    },
  ]);
const REVIEW_TYPE_MAP = Object.fromEntries(REVIEW_TYPES.map((t) => [t.id, t]));
const REVIEW_TYPE_IDS = REVIEW_TYPES.map((t) => t.id);
const MARK_LABEL = { met: 'Met', gap: 'Opportunity', na: 'Not applicable' };
const reviewItemCache = {};

/** A tab panel fades in once after its tab is chosen; later re-renders stay still. */
function takeTabAnim() {
  const on = !!state.ui.tabAnim;
  state.ui.tabAnim = false;
  return on ? ' anim-panel' : '';
}

function reviewItems(typeId) {
  if (!reviewItemCache[typeId]) {
    const t = REVIEW_TYPE_MAP[typeId];
    reviewItemCache[typeId] = t.steps.map((s, i) => ({ ...s, group: 'flow', n: i + 1 })).concat(t.skills.map((s) => ({ ...s, group: 'skill' })));
  }
  return reviewItemCache[typeId];
}

/** The marks and coaching picks for one call type (created on first use). */
function reviewSlot(typeId) {
  if (!state.review.byType[typeId]) state.review.byType[typeId] = { marks: {}, picks: {} };
  return state.review.byType[typeId];
}
const reviewMarks = (typeId) => (state.review.byType[typeId] || { marks: {} }).marks;
const reviewPicks = (typeId, it) => (state.review.byType[typeId] && state.review.byType[typeId].picks[it.id]) || [it.gaps[0]];

function reviewCounts(typeId) {
  const counts = { met: 0, gap: 0, na: 0, total: reviewItems(typeId).length };
  Object.values(reviewMarks(typeId)).forEach((m) => counts[m]++);
  counts.reviewed = counts.met + counts.gap + counts.na;
  return counts;
}

function setReviewMark(typeId, id, mark) {
  const marks = reviewSlot(typeId).marks;
  if (marks[id] === mark) delete marks[id];
  else marks[id] = mark;
  persist('review');
  state.ui.flash = `${typeId}:${id}`;
  refresh({ panel: false });
  state.ui.flash = null;
  const it = reviewItems(typeId).find((x) => x.id === id);
  if (it) announce(marks[id] ? `${it.title}: ${MARK_LABEL[marks[id]]}` : `${it.title}: cleared`);
}

function toggleReviewPick(typeId, item, oppId, on) {
  const picks = reviewPicks(typeId, item).slice();
  const i = picks.indexOf(oppId);
  if (on && i < 0) picks.push(oppId);
  if (!on && i >= 0) picks.splice(i, 1);
  reviewSlot(typeId).picks[item.id] = picks;
  persist('review');
}

function reviewGapOpps(typeId) {
  const out = [];
  const marks = reviewMarks(typeId);
  for (const it of reviewItems(typeId)) {
    if (marks[it.id] !== 'gap') continue;
    for (const id of reviewPicks(typeId, it)) if (getOpp(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function reviewMetStrengths(typeId) {
  const out = [];
  const marks = reviewMarks(typeId);
  for (const it of reviewItems(typeId)) if (marks[it.id] === 'met' && it.strength && getStrength(it.strength) && !out.includes(it.strength)) out.push(it.strength);
  return out;
}

/** KPIs touched by the steps marked as opportunities, e.g. { aiCR: 2, Transfer: 1 }. */
function reviewKpiRisk(typeId) {
  const risk = {};
  const marks = reviewMarks(typeId);
  reviewItems(typeId).forEach((it) => {
    if (marks[it.id] === 'gap') (it.kpi || []).forEach((k) => (risk[k] = (risk[k] || 0) + 1));
  });
  return risk;
}

function reviewSummaryText(typeId) {
  const t = REVIEW_TYPE_MAP[typeId];
  const marks = reviewMarks(typeId);
  const lines = [`${t.id === 'sales' ? 'Sales' : t.label} Call Review`];
  const add = (it) => {
    if (marks[it.id]) lines.push(`${it.title}: ${MARK_LABEL[marks[it.id]]}`);
  };
  reviewItems(typeId).filter((i) => i.group === 'flow').forEach(add);
  const skills = reviewItems(typeId).filter((i) => i.group === 'skill' && marks[i.id]);
  if (skills.length) {
    lines.push('');
    skills.forEach(add);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function addReviewGaps(typeId) {
  const ids = reviewGapOpps(typeId);
  if (!ids.length) {
    toast('Mark at least one step as an opportunity first.', { type: 'warn' });
    return;
  }
  const added = ids.filter((id) => !state.builder.opps.includes(id));
  state.builder.opps.push(...added);
  persist('builder');
  refresh({ panel: false });
  toast(added.length ? `Added ${plural(added.length, 'opportunity', 'opportunities')} to the Coaching Builder` : 'Those opportunities are already in the Coaching Builder', {
    action: { label: 'Open Builder', fn: () => navigate('builder') },
  });
}

function addReviewStrengths(typeId) {
  const ids = reviewMetStrengths(typeId);
  if (!ids.length) {
    toast('Mark at least one step as met first.', { type: 'warn' });
    return;
  }
  const have = new Set(state.builder.strengths.map((s) => s.id));
  const added = ids.filter((id) => !have.has(id));
  added.forEach((id) => state.builder.strengths.push({ id, v: 0 }));
  persist('builder');
  refresh({ panel: false });
  toast(added.length ? `Marked ${plural(added.length, 'strength')} as observed` : 'Those strengths are already marked as observed', {
    action: { label: 'Open Builder', fn: () => navigate('builder') },
  });
}

async function clearReview(typeId) {
  if (!Object.keys(reviewMarks(typeId)).length) return;
  if (!(await confirmDialog({ title: 'Clear this call review?', message: 'All marks on this review will be cleared. Anything already added to the Coaching Builder stays there.', confirmLabel: 'Clear review' }))) return;
  delete state.review.byType[typeId];
  persist('review');
  refresh({ panel: false });
}

/* ---------- Scorecard (progress ring, stacked bar, KPI risk) ---------- */
const ringMemory = {};
const ringSeen = {};
function progressRing(value, total, label, key) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const bar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  [track, bar].forEach((el) => {
    el.setAttribute('cx', '32');
    el.setAttribute('cy', '32');
    el.setAttribute('r', String(r));
  });
  track.setAttribute('class', 'ring__track');
  bar.setAttribute('class', 'ring__bar');
  // Gradient stroke, plus a small marker that travels around the ring.
  const gid = uid('ring-g');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad.setAttribute('id', gid);
  [['0%', 'ring__stop-a'], ['100%', 'ring__stop-b']].forEach(([off, cls]) => {
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    st.setAttribute('offset', off);
    st.setAttribute('class', cls);
    grad.appendChild(st);
  });
  defs.appendChild(grad);
  bar.style.stroke = `url(#${gid})`;
  const orbit = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  orbit.setAttribute('class', 'ring__orbit');
  const moon = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  moon.setAttribute('cx', '32');
  moon.setAttribute('cy', String(32 - r - 6));
  moon.setAttribute('r', '1.8');
  moon.setAttribute('class', 'ring__moon');
  orbit.appendChild(moon);
  bar.style.strokeDasharray = `${c}`;
  // Start from the previous value so the ring fills smoothly after each mark.
  const from = key in ringMemory ? ringMemory[key] : 0;
  ringMemory[key] = pct;
  bar.style.strokeDashoffset = `${c * (1 - from)}`;
  if (from !== pct) {
    requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.strokeDashoffset = `${c * (1 - pct)}`)));
  }
  svg.append(defs, track, bar, orbit);
  const full = total > 0 && value >= total;
  const wrap = h('div', { class: `ring-wrap${full ? ' is-full' : ''}`, role: 'img', 'aria-label': label }, svg, h('span', { class: 'ring__value' }, h('strong', null, String(value)), h('span', null, `/${total}`)));
  // Celebrate the moment a ring fills up (not when a full ring is simply shown again).
  if (full && from < 1 && key in ringSeen) requestAnimationFrame(() => setTimeout(() => wrap.isConnected && celebrate(wrap.getBoundingClientRect()), 450));
  ringSeen[key] = true;
  return wrap;
}

function reviewScorecard(typeId) {
  const c = reviewCounts(typeId);
  const risk = reviewKpiRisk(typeId);
  const seg = (k) => h('span', { class: `rv-stack__seg rv-stack__seg--${k}`, style: `flex-grow:${c[k]}` });
  const legend = (k, label) => h('span', { class: `legend legend--${k}` }, h('span', { class: 'legend__dot' }), h('strong', null, String(c[k])), ` ${label}`);
  const riskChips = Object.keys(risk)
    .sort((a, b) => risk[b] - risk[a])
    .map((k) => h('span', { class: `risk-chip${k === 'aiCR' || k === 'Transfer' ? ' is-hot' : ''}` }, icon('alert', 'icon--sm'), `${(KPI_MAP[k] || { label: k }).label}: ${plural(risk[k], 'step')}`));
  return h(
    'div',
    { class: 'scorecard' },
    progressRing(c.reviewed, c.total, `${c.reviewed} of ${c.total} steps marked`, typeId),
    h(
      'div',
      { class: 'scorecard__body' },
      h('p', { class: 'scorecard__title' }, c.reviewed ? (c.reviewed === c.total ? 'Review complete' : 'Review in progress') : 'Ready to review'),
      h('div', { class: `rv-stack${c.reviewed ? '' : ' is-empty'}`, 'aria-hidden': 'true' }, seg('met'), seg('gap'), seg('na')),
      h('div', { class: 'scorecard__legend' }, legend('met', 'met'), legend('gap', c.gap === 1 ? 'opportunity' : 'opportunities'), legend('na', 'N/A')),
      riskChips.length ? h('div', { class: 'scorecard__risk' }, h('span', { class: 'scorecard__risk-label' }, 'KPI risk from opportunities'), riskChips) : null
    )
  );
}

/* ---------- Rows ---------- */
function reviewRow(typeId, it) {
  const mark = reviewMarks(typeId)[it.id] || '';
  const picks = reviewPicks(typeId, it);
  const titleId = `rv-${typeId}-${it.id}`;
  const btn = (value, label) =>
    h(
      'button',
      {
        type: 'button',
        class: `rv-btn rv-btn--${value}`,
        'aria-pressed': String(mark === value),
        'data-fk': `rv:${typeId}:${it.id}:${value}`,
        onclick: () => setReviewMark(typeId, it.id, value),
      },
      label
    );
  const kpis = (it.kpi || []).filter((k) => k !== 'QA');
  return h(
    'li',
    { class: `rv-row${mark ? ' is-' + mark : ''}${state.ui.flash === `${typeId}:${it.id}` ? ' is-flash' : ''}` },
    h('div', { class: 'rv-row__num', 'aria-hidden': 'true' }, mark === 'met' ? icon('check', 'icon--sm') : it.n ? String(it.n) : '•'),
    h(
      'div',
      { class: 'rv-row__main' },
      h('div', { class: 'rv-row__head' }, h('h3', { class: 'rv-row__title', id: titleId }, it.title), kpis.map((k) => h('span', { class: 'rv-kpi', title: (KPI_MAP[k] || {}).hint || '' }, (KPI_MAP[k] || { label: k }).label))),
      h('p', { class: 'rv-row__good' }, it.good),
      it.say && typeId !== 'sales'
        ? h('div', { class: 'rv-row__say' }, h('p', null, `“${it.say}”`), copyButton(it.say, { label: 'Copy', srLabel: `Copy model line for ${it.title}`, fk: `rv-say:${typeId}:${it.id}` }))
        : null
    ),
    h('div', { class: 'rv-row__marks', role: 'group', 'aria-labelledby': titleId }, btn('met', 'Met'), btn('gap', 'Opportunity'), btn('na', 'N/A')),
    mark === 'gap'
      ? h(
          'fieldset',
          { class: 'rv-row__picks' },
          h('legend', null, 'Coach with:'),
          it.gaps
            .map(getOpp)
            .filter(Boolean)
            .map((o) =>
              h(
                'label',
                { class: 'check' },
                h('input', { type: 'checkbox', checked: picks.includes(o.id), 'data-fk': `rvp:${typeId}:${it.id}:${o.id}`, onchange: (e) => toggleReviewPick(typeId, it, o.id, e.target.checked) }),
                o.title
              )
            )
        )
      : null
  );
}

/** The call review itself: scorecard, flow steps, skills, and the action bar. Used by the Call Review page and the Sales Toolkit. */
function renderReviewTab(panel, typeId) {
  const c = reviewCounts(typeId);
  const items = reviewItems(typeId);
  const flowTitleId = `rvFlowTitle-${typeId}`;
  const skillTitleId = `rvSkillTitle-${typeId}`;
  put(panel, 
    h('p', { class: 'hint', style: 'margin-bottom:14px' }, icon('info'), 'Mark each step as you listen to the call. Opportunities can be sent to the Coaching Builder, and steps you mark as met can be added as observed strengths. Nothing is added until you choose.'),
    reviewScorecard(typeId),
    h(
      'section',
      { class: 'card rv-card', 'aria-labelledby': flowTitleId },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: flowTitleId }, icon('trend'), typeId === 'sales' ? 'Sales flow' : 'Call flow')),
      h('div', { class: 'card__body' }, h('ol', { class: 'rv-list' }, items.filter((i) => i.group === 'flow').map((it) => reviewRow(typeId, it))))
    ),
    h(
      'section',
      { class: 'card rv-card', style: 'margin-top:16px', 'aria-labelledby': skillTitleId },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: skillTitleId }, icon('target'), typeId === 'sales' ? 'Sales skills' : 'Skills'), h('span', { class: 'sec__sub' }, 'mark N/A when it did not come up')),
      h('div', { class: 'card__body' }, h('ul', { class: 'rv-list' }, items.filter((i) => i.group === 'skill').map((it) => reviewRow(typeId, it))))
    ),
    h(
      'div',
      { class: `selection-bar selection-bar--review${c.reviewed ? '' : ' is-empty'}`, role: 'region', 'aria-label': 'Call review summary' },
      h('span', { class: 'selection-bar__text' }, c.reviewed ? `${c.met} met · ${c.gap} ${c.gap === 1 ? 'opportunity' : 'opportunities'} · ${c.na} N/A` : 'No steps marked yet'),
      h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': `rv-add-gaps:${typeId}`, disabled: !c.gap, onclick: () => addReviewGaps(typeId) }, icon('plus'), h('span', { class: 'lbl-long' }, 'Add opportunities to Builder'), h('span', { class: 'lbl-short' }, 'Add to Builder')),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `rv-add-strengths:${typeId}`, disabled: !c.met, onclick: () => addReviewStrengths(typeId) }, icon('thumb'), h('span', { class: 'lbl-long' }, 'Add met steps as strengths'), h('span', { class: 'lbl-short' }, 'Add strengths')),
      copyButton(() => reviewSummaryText(typeId), { label: 'Copy review', srLabel: 'Copy review summary', fk: `rv-copy:${typeId}`, emptyMessage: 'Mark at least one step first.' }),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `rv-clear:${typeId}`, disabled: !c.reviewed, onclick: () => clearReview(typeId) }, 'Clear')
    )
  );
}

/* ---------- Call Review page ---------- */
function setReviewType(id) {
  state.review.type = id;
  persist('review');
  state.ui.tabAnim = true;
  refresh({ panel: false });
}

function reviewTypePicker(current) {
  const list = h('div', { class: 'type-picker', role: 'tablist', 'aria-label': 'Call type' });
  REVIEW_TYPES.forEach((t, i) => {
    const c = reviewCounts(t.id);
    const pct = Math.round((c.reviewed / c.total) * 100);
    const btn = h(
      'button',
      {
        type: 'button',
        class: `type-card cat-${t.cat}`,
        role: 'tab',
        id: `rt-tab-${t.id}`,
        'aria-selected': String(t.id === current),
        'aria-controls': 'rt-panel',
        tabindex: t.id === current ? '0' : '-1',
        'data-fk': `rt-tab:${t.id}`,
        onclick: () => setReviewType(t.id),
      },
      h('span', { class: 'type-card__icon' }, icon(t.icon)),
      h('span', { class: 'type-card__text' }, h('span', { class: 'type-card__label' }, t.label), h('span', { class: 'type-card__meta' }, c.reviewed ? `${c.reviewed} of ${c.total} marked` : `${t.steps.length} steps · ${t.skills.length} skills`)),
      h('span', { class: 'type-card__bar', 'aria-hidden': 'true' }, h('span', { style: `width:${pct}%` }))
    );
    btn.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = REVIEW_TYPES[(i + 1) % REVIEW_TYPES.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = REVIEW_TYPES[(i - 1 + REVIEW_TYPES.length) % REVIEW_TYPES.length];
      else if (e.key === 'Home') next = REVIEW_TYPES[0];
      else if (e.key === 'End') next = REVIEW_TYPES[REVIEW_TYPES.length - 1];
      if (next) {
        e.preventDefault();
        setReviewType(next.id);
        focusByKey(`rt-tab:${next.id}`);
      }
    });
    list.appendChild(btn);
  });
  return list;
}

function renderCallReview(main) {
  const typeId = REVIEW_TYPE_IDS.includes(state.review.type) ? state.review.type : 'tech';
  const t = REVIEW_TYPE_MAP[typeId];
  put(main, 
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-tech', style: 'width:22px;height:22px;border-radius:6px' }, icon('checklist', 'icon--sm')), 'Coaching'],
      title: 'Call Review',
      sub: 'Listen to a call, mark each step, and turn what you heard into coaching in one click. Steps linked to repeat contacts (aiCR) and transfers are labeled, so you can see where KPI risk came from.',
      actions: h('a', { class: 'btn btn--sm', href: '#/builder', 'data-fk': 'rt-to-builder' }, icon('clipboard'), 'Coaching Builder'),
    }),
    reviewTypePicker(typeId)
  );
  const panel = h('div', { class: `tk-panel rt-panel${takeTabAnim()}`, role: 'tabpanel', id: 'rt-panel', 'aria-labelledby': `rt-tab-${typeId}`, tabindex: '-1' });
  put(panel, h('p', { class: 'rt-intro' }, t.intro));
  if (typeId === 'sales') {
    put(panel, h('p', { class: 'notice', role: 'note', style: 'margin-bottom:16px' }, icon('alert'), h('span', { class: 'notice__body' }, DATA.salesToolkit.notOffer, ' ', h('a', { href: '#/sales-toolkit', 'data-fk': 'rt-to-toolkit' }, 'Open the Sales Toolkit'))));
  }
  renderReviewTab(panel, typeId);
  put(main, panel);
}
