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

function setSalesTab(id) {
  state.prefs.salesTab = id;
  persist('prefs');
  state.ui.tabAnim = true;
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

/* ---------- Sales flow ---------- */
function renderFlowTab(panel) {
  put(panel, 
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
  put(panel, 
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
  put(panel, 
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
  put(panel, 
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
  put(main, 
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-sales', style: 'width:22px;height:22px;border-radius:6px' }, icon('tag', 'icon--sm')), 'Sales & Retention'],
      title: 'Sales Toolkit',
      sub: SALES.intro,
      actions: h('a', { class: 'btn btn--sm', href: '#/cat/sales', 'data-fk': 'tk-to-sales' }, icon('trend'), 'Sales coaching entries'),
    }),
    h('p', { class: 'notice', role: 'note', style: 'margin-bottom:16px' }, icon('alert'), h('span', { class: 'notice__body' }, SALES.notOffer)),
    salesTabs()
  );
  const panel = h('div', { class: `tk-panel${takeTabAnim()}`, role: 'tabpanel', id: 'tk-panel', 'aria-labelledby': `tk-tab-${tab}`, tabindex: '-1' });
  if (tab === 'flow') renderFlowTab(panel);
  else if (tab === 'offers') renderOffersTab(panel);
  else if (tab === 'objections') renderObjectionsTab(panel);
  else if (tab === 'signals') renderSignalsTab(panel);
  else renderReviewTab(panel, 'sales');
  put(main, panel);
}
