/* ==========================================================================
   07b-sales: Sales Toolkit (call review, sales flow, offer guides,
   objection handling, buying signals)
   ========================================================================== */

const SALES = DATA.salesToolkit;
const SALES_TABS = [
  { id: 'review', label: 'Call review', icon: 'clipboard' },
  { id: 'flow', label: 'Sales flow', icon: 'trend' },
  { id: 'offers', label: 'Offer guides', icon: 'tag' },
  { id: 'objections', label: 'Objections', icon: 'chat' },
  { id: 'signals', label: 'Buying signals', icon: 'sparkle' },
];
const REVIEW_ITEMS = SALES.steps.map((s, i) => ({ ...s, group: 'flow', n: i + 1 })).concat(SALES.skills.map((s) => ({ ...s, group: 'skill' })));
const MARK_LABEL = { met: 'Met', gap: 'Opportunity', na: 'Not applicable' };

function setSalesTab(id) {
  state.prefs.salesTab = id;
  persist('prefs');
  refresh({ panel: false });
}

function salesTabs() {
  const current = state.prefs.salesTab;
  const list = h('div', { class: 'tk-tabs', role: 'tablist', 'aria-label': 'Sales Toolkit sections' });
  SALES_TABS.forEach((t, i) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'tk-tab',
        role: 'tab',
        id: `tk-tab-${t.id}`,
        'aria-selected': String(t.id === current),
        'aria-controls': 'tk-panel',
        tabindex: t.id === current ? '0' : '-1',
        'data-fk': `tk-tab:${t.id}`,
        onclick: () => setSalesTab(t.id),
      },
      icon(t.icon),
      t.label
    );
    btn.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = SALES_TABS[(i + 1) % SALES_TABS.length];
      else if (e.key === 'ArrowLeft') next = SALES_TABS[(i - 1 + SALES_TABS.length) % SALES_TABS.length];
      else if (e.key === 'Home') next = SALES_TABS[0];
      else if (e.key === 'End') next = SALES_TABS[SALES_TABS.length - 1];
      if (next) {
        e.preventDefault();
        setSalesTab(next.id);
        focusByKey(`tk-tab:${next.id}`);
      }
    });
    list.appendChild(btn);
  });
  return list;
}

/** A line of model language with its own copy button. */
function scriptLine(text, { label, fk, srLabel } = {}) {
  return h(
    'div',
    { class: 'tk-line' },
    h('div', { class: 'tk-line__body' }, label ? h('span', { class: 'tk-line__label' }, label) : null, h('p', { class: 'tk-line__text' }, `“${text}”`)),
    copyButton(text, { srLabel: srLabel || `Copy: ${text.slice(0, 60)}`, fk })
  );
}

function oppChips(ids, fkPrefix) {
  return h(
    'div',
    { class: 'tk-chips' },
    ids
      .map(getOpp)
      .filter(Boolean)
      .map((o) =>
        h(
          'button',
          {
            type: 'button',
            class: `tk-chip cat-${o.cat}`,
            'data-fk': `${fkPrefix}:${o.id}`,
            onclick: () => {
              state.ui.returnFocusKey = `${fkPrefix}:${o.id}`;
              navigate(state.ui.view, { open: o.id });
            },
          },
          h('span', { class: 'chip__dot' }),
          o.title
        )
      )
  );
}

/* ---------- Call review ---------- */
function setReviewMark(id, mark) {
  const marks = state.review.marks;
  if (marks[id] === mark) delete marks[id];
  else marks[id] = mark;
  persist('review');
  refresh({ panel: false });
}

function toggleReviewPick(item, oppId, on) {
  const picks = (state.review.picks[item.id] || [item.gaps[0]]).slice();
  const i = picks.indexOf(oppId);
  if (on && i < 0) picks.push(oppId);
  if (!on && i >= 0) picks.splice(i, 1);
  state.review.picks[item.id] = picks;
  persist('review');
}

function reviewGapOpps() {
  const out = [];
  for (const it of REVIEW_ITEMS) {
    if (state.review.marks[it.id] !== 'gap') continue;
    for (const id of state.review.picks[it.id] || [it.gaps[0]]) if (getOpp(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function reviewMetStrengths() {
  const out = [];
  for (const it of REVIEW_ITEMS) if (state.review.marks[it.id] === 'met' && it.strength && getStrength(it.strength) && !out.includes(it.strength)) out.push(it.strength);
  return out;
}

function reviewSummaryText() {
  const lines = ['Sales Call Review'];
  const add = (it) => {
    const m = state.review.marks[it.id];
    if (m) lines.push(`${it.title}: ${MARK_LABEL[m]}`);
  };
  REVIEW_ITEMS.filter((i) => i.group === 'flow').forEach(add);
  const skills = REVIEW_ITEMS.filter((i) => i.group === 'skill' && state.review.marks[i.id]);
  if (skills.length) {
    lines.push('');
    skills.forEach(add);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function addReviewGaps() {
  const ids = reviewGapOpps();
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

function addReviewStrengths() {
  const ids = reviewMetStrengths();
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

async function clearReview() {
  if (!Object.keys(state.review.marks).length) return;
  if (!(await confirmDialog({ title: 'Clear this call review?', message: 'All marks on this review will be cleared. Anything already added to the Coaching Builder stays there.', confirmLabel: 'Clear review' }))) return;
  state.review = defaultReview();
  persist('review');
  refresh({ panel: false });
}

function reviewRow(it) {
  const mark = state.review.marks[it.id] || '';
  const picks = state.review.picks[it.id] || [it.gaps[0]];
  const titleId = `rv-${it.id}`;
  const btn = (value, label) =>
    h(
      'button',
      {
        type: 'button',
        class: `rv-btn rv-btn--${value}`,
        'aria-pressed': String(mark === value),
        'data-fk': `rv:${it.id}:${value}`,
        onclick: () => setReviewMark(it.id, value),
      },
      label
    );
  return h(
    'li',
    { class: `rv-row${mark ? ' is-' + mark : ''}` },
    h('div', { class: 'rv-row__num', 'aria-hidden': 'true' }, it.n ? String(it.n) : '•'),
    h('div', { class: 'rv-row__main' }, h('h3', { class: 'rv-row__title', id: titleId }, it.title), h('p', { class: 'rv-row__good' }, it.good)),
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
                h('input', { type: 'checkbox', checked: picks.includes(o.id), 'data-fk': `rvp:${it.id}:${o.id}`, onchange: (e) => toggleReviewPick(it, o.id, e.target.checked) }),
                o.title
              )
            )
        )
      : null
  );
}

function renderReviewTab(panel) {
  const counts = { met: 0, gap: 0, na: 0 };
  Object.values(state.review.marks).forEach((m) => counts[m]++);
  const reviewed = counts.met + counts.gap + counts.na;
  panel.append(
    h('p', { class: 'hint', style: 'margin-bottom:14px' }, icon('info'), 'Mark each step as you listen to a sales or retention call. Opportunities can be sent to the Coaching Builder, and steps you mark as met can be added as observed strengths. Nothing is added until you choose.'),
    h(
      'section',
      { class: 'card', 'aria-labelledby': 'rvFlowTitle' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'rvFlowTitle' }, icon('trend'), 'Sales flow')),
      h('div', { class: 'card__body' }, h('ol', { class: 'rv-list' }, REVIEW_ITEMS.filter((i) => i.group === 'flow').map(reviewRow)))
    ),
    h(
      'section',
      { class: 'card', style: 'margin-top:16px', 'aria-labelledby': 'rvSkillTitle' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'rvSkillTitle' }, icon('target'), 'Sales skills'), h('span', { class: 'sec__sub' }, 'mark N/A when it did not come up')),
      h('div', { class: 'card__body' }, h('ul', { class: 'rv-list' }, REVIEW_ITEMS.filter((i) => i.group === 'skill').map(reviewRow)))
    ),
    h(
      'div',
      { class: `selection-bar selection-bar--review${reviewed ? '' : ' is-empty'}`, role: 'region', 'aria-label': 'Call review summary' },
      h('span', { class: 'selection-bar__text' }, reviewed ? `${counts.met} met · ${counts.gap} ${counts.gap === 1 ? 'opportunity' : 'opportunities'} · ${counts.na} N/A` : 'No steps marked yet'),
      h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': 'rv-add-gaps', disabled: !counts.gap, onclick: addReviewGaps }, icon('plus'), h('span', { class: 'lbl-long' }, 'Add opportunities to Builder'), h('span', { class: 'lbl-short' }, 'Add to Builder')),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'rv-add-strengths', disabled: !counts.met, onclick: addReviewStrengths }, icon('thumb'), h('span', { class: 'lbl-long' }, 'Add met steps as strengths'), h('span', { class: 'lbl-short' }, 'Add strengths')),
      copyButton(() => reviewSummaryText(), { label: 'Copy review', srLabel: 'Copy review summary', fk: 'rv-copy', emptyMessage: 'Mark at least one step first.' }),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'rv-clear', disabled: !reviewed, onclick: clearReview }, 'Clear')
    )
  );
}

/* ---------- Sales flow ---------- */
function renderFlowTab(panel) {
  panel.append(
    h(
      'ol',
      { class: 'tk-steps' },
      SALES.steps.map((s, i) =>
        h(
          'li',
          { class: 'tk-step' },
          h('span', { class: 'tk-step__num', 'aria-hidden': 'true' }, String(i + 1)),
          h(
            'div',
            { class: 'tk-step__main' },
            h('h2', { class: 'tk-step__title' }, s.title),
            h('p', { class: 'tk-step__good' }, s.good),
            scriptLine(s.say, { label: 'Sounds like', fk: `tk-say:${s.id}`, srLabel: `Copy example for ${s.title}` }),
            h('div', { class: 'tk-step__coach' }, h('span', { class: 'tk-label' }, 'Coach with'), oppChips(s.gaps, `tk-flow-opp:${s.id}`))
          )
        )
      )
    )
  );
}

/* ---------- Offer guides ---------- */
function renderOffersTab(panel) {
  const current = SALES.offers.find((o) => o.id === state.prefs.salesOffer) || SALES.offers[0];
  const o = current;
  const bullets = (items, iconName) => h('ul', { class: 'tk-bullets' }, items.map((t) => h('li', null, icon(iconName || 'check'), t)));
  const block = (title, ...kids) => h('section', { class: 'tk-block' }, h('h3', { class: 'tk-block__title' }, title), ...kids);
  const objectionText = [o.objection.acknowledge, o.objection.clarify, o.objection.respond].filter(Boolean).join(' ');
  panel.append(
    segmented({
      label: 'Offer type',
      value: o.id,
      fkPrefix: 'tk-offer',
      options: SALES.offers.map((x) => ({ value: x.id, label: x.short })),
      onChange: (v) => {
        state.prefs.salesOffer = v;
        persist('prefs');
        refresh({ panel: false });
      },
    }),
    h(
      'article',
      { class: 'card tk-guide', 'aria-labelledby': 'tkGuideTitle', style: 'margin-top:14px' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'tkGuideTitle' }, icon('tag'), o.title)),
      h(
        'div',
        { class: 'card__body' },
        h('p', { class: 'prose' }, o.summary),
        h(
          'div',
          { class: 'tk-guide__grid' },
          block('When it fits', bullets(o.fits, 'target')),
          block(
            'Discovery questions',
            h('div', { class: 'tk-stack' }, o.questions.map((q, i) => scriptLine(q, { fk: `tk-q:${o.id}:${i}`, srLabel: `Copy discovery question ${i + 1}` })))
          ),
          block(o.id === 'retention' ? 'Opening the conversation' : 'Plant the seed', scriptLine(o.seed, { fk: `tk-seed:${o.id}`, srLabel: 'Copy opening line' })),
          block('Bridge into the offer', scriptLine(o.bridge, { fk: `tk-bridge:${o.id}`, srLabel: 'Copy bridge line' })),
          block('Explain the value', bullets(o.value, 'sparkle')),
          block('Pricing disclosure checklist', bullets(o.disclosure, 'check')),
          block(
            'Common objection',
            h('p', { class: 'tk-objection__says' }, `“${o.objection.says}”`),
            h(
              'dl',
              { class: 'tk-acr' },
              h('dt', null, 'Acknowledge'),
              h('dd', null, o.objection.acknowledge),
              h('dt', null, 'Clarify'),
              h('dd', null, o.objection.clarify),
              h('dt', null, 'Respond'),
              h('dd', null, o.objection.respond)
            ),
            h('div', null, copyButton(objectionText, { label: 'Copy response', srLabel: `Copy response to: ${o.objection.says}`, fk: `tk-objcopy:${o.id}` }))
          )
        ),
        h('p', { class: 'sec--note tk-note' }, icon('note'), h('span', null, h('strong', null, 'Supervisor note (not copied). '), o.note))
      )
    )
  );
}

/* ---------- Objections ---------- */
function renderObjectionsTab(panel) {
  panel.append(
    h('p', { class: 'notice notice--info', style: 'margin-bottom:16px' }, icon('info'), h('span', { class: 'notice__body' }, SALES.objectionPrinciple)),
    h(
      'div',
      { class: 'tk-grid' },
      SALES.objections.map((ob) => {
        const response = [ob.acknowledge, ob.clarify, ob.respond].filter(Boolean).join(' ');
        return h(
          'article',
          { class: 'card tk-obj' },
          h(
            'div',
            { class: 'card__body', style: 'padding-top:16px' },
            h('h2', { class: 'tk-obj__says' }, `“${ob.says}”`),
            h(
              'dl',
              { class: 'tk-acr' },
              h('dt', null, 'Acknowledge'),
              h('dd', null, ob.acknowledge),
              ob.clarify ? [h('dt', null, 'Clarify'), h('dd', null, ob.clarify)] : null,
              ob.respond ? [h('dt', null, 'Respond'), h('dd', null, ob.respond)] : null,
              ob.guidance ? [h('dt', null, 'Coaching'), h('dd', { class: 'tk-guidance' }, ob.guidance)] : null,
              h('dt', null, 'If they still decline'),
              h('dd', null, ob.close)
            ),
            h(
              'div',
              { class: 'data-row' },
              copyButton(ob.guidance ? [ob.acknowledge, ob.close].join(' ') : response, { label: 'Copy response', srLabel: `Copy response to: ${ob.says}`, fk: `tk-ob:${ob.id}` }),
              ob.guidance ? null : copyButton(ob.close, { label: 'Copy close', srLabel: `Copy closing line for: ${ob.says}`, fk: `tk-obc:${ob.id}` })
            )
          )
        );
      })
    ),
    h('div', { class: 'tk-step__coach', style: 'margin-top:18px' }, h('span', { class: 'tk-label' }, 'Coach with'), oppChips(['sales-weak-objection', 'sales-pitch-after-rejection'], 'tk-ob-opp'))
  );
}

/* ---------- Buying signals ---------- */
function renderSignalsTab(panel) {
  panel.append(
    h('p', { class: 'hint', style: 'margin-bottom:14px' }, icon('info'), 'Buying signals can come up at any point. Follow up with a question right away, but present the offer only after the concern is resolved and confirmed.'),
    h(
      'ul',
      { class: 'tk-signals' },
      SALES.signals.map((sg, i) =>
        h(
          'li',
          { class: 'tk-signal' },
          h('div', { class: 'tk-signal__head' }, h('h2', { class: 'tk-signal__title' }, sg.signal), h('p', { class: 'tk-signal__example' }, `Customer: “${sg.example}”`)),
          scriptLine(sg.next, { label: 'Follow up with', fk: `tk-sig:${i}`, srLabel: `Copy follow-up for: ${sg.signal}` })
        )
      )
    ),
    h('div', { class: 'tk-step__coach', style: 'margin-top:18px' }, h('span', { class: 'tk-label' }, 'Coach with'), oppChips(['sales-buying-signals', 'sales-missing-discovery'], 'tk-sig-opp'))
  );
}

function renderSalesToolkit(main) {
  const tab = SALES_TAB_IDS.includes(state.prefs.salesTab) ? state.prefs.salesTab : 'review';
  main.append(
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-sales', style: 'width:22px;height:22px;border-radius:6px' }, icon('tag', 'icon--sm')), 'Sales & Retention'],
      title: 'Sales Toolkit',
      sub: SALES.intro,
      actions: h('a', { class: 'btn btn--sm', href: '#/cat/sales', 'data-fk': 'tk-to-sales' }, icon('trend'), 'Sales coaching entries'),
    }),
    h('p', { class: 'notice', role: 'note', style: 'margin-bottom:16px' }, icon('alert'), h('span', { class: 'notice__body' }, SALES.notOffer)),
    salesTabs()
  );
  const panel = h('div', { class: 'tk-panel', role: 'tabpanel', id: 'tk-panel', 'aria-labelledby': `tk-tab-${tab}`, tabindex: '-1' });
  if (tab === 'flow') renderFlowTab(panel);
  else if (tab === 'offers') renderOffersTab(panel);
  else if (tab === 'objections') renderObjectionsTab(panel);
  else if (tab === 'signals') renderSignalsTab(panel);
  else renderReviewTab(panel);
  main.append(panel);
}
