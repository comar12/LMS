/* ==========================================================================
   05-library: sidebar, topbar, library views, cards, reference cards
   ========================================================================== */

function builderCount() {
  const b = state.builder;
  return b.opps.filter((id) => getOpp(id)).length + b.strengths.filter((s) => getStrength(s.id)).length;
}

function navItem({ view, cat, label, iconName, count, badge, dotCat }) {
  const href = view === 'cat' ? `#/cat/${cat}` : `#/${view}`;
  const current = state.ui.view === view && (view !== 'cat' || state.ui.cat === cat);
  return h(
    'a',
    { class: 'nav__item', href, 'aria-current': current ? 'page' : null, 'data-fk': `nav:${view}:${cat || ''}` },
    dotCat ? h('span', { class: `nav__dot cat-${dotCat}`, style: 'background:var(--cc)' }) : icon(iconName),
    h('span', { class: 'nav__label' }, label),
    badge ? h('span', { class: 'nav__badge', 'aria-label': `${badge} selected` }, String(badge)) : count != null ? h('span', { class: 'nav__count' }, String(count)) : null
  );
}

function renderSidebar() {
  const counts = {};
  content.opps.forEach((o) => (counts[o.cat] = (counts[o.cat] || 0) + 1));
  const customCount = state.custom.opps.length + state.custom.strengths.length + Object.keys(state.overrides.opps).length + Object.keys(state.overrides.strengths).length;
  const bc = builderCount();
  els.sidebar.replaceChildren(
    h(
      'div',
      { class: 'brand' },
      logoSvg(),
      h('div', { class: 'brand__text' }, h('div', { class: 'brand__name' }, 'Coaching Intelligence Pro'), h('div', { class: 'brand__sub' }, 'VXI · Supervisor Toolkit'))
    ),
    h(
      'nav',
      { class: 'nav', 'aria-label': 'Coaching library' },
      navItem({ view: 'home', label: 'Home', iconName: 'home' }),
      navItem({ view: 'all', label: 'All Opportunities', iconName: 'layers', count: content.opps.length }),
      h('div', { class: 'nav__section', role: 'presentation' }, 'Categories'),
      CATS.map((c) => navItem({ view: 'cat', cat: c.id, label: c.nav, iconName: CAT_ICON[c.id], count: counts[c.id] || 0 })),
      h('div', { class: 'nav__section', role: 'presentation' }, 'Coaching'),
      navItem({ view: 'call-review', label: 'Call Review', iconName: 'checklist' }),
      navItem({ view: 'strengths', label: 'Things Went Well', iconName: 'thumb', count: content.strengths.length }),
      navItem({ view: 'sales-toolkit', label: 'Sales Toolkit', iconName: 'tag' }),
      navItem({ view: 'people-toolkit', label: 'ABS & Attrition Toolkit', iconName: 'users' }),
      navItem({ view: 'favorites', label: 'Favorites', iconName: 'star', count: state.favorites.size }),
      navItem({ view: 'builder', label: 'Coaching Builder', iconName: 'clipboard', badge: bc || null, count: bc ? null : 0 }),
      h('div', { class: 'nav__section', role: 'presentation' }, 'Personal'),
      navItem({ view: 'links', label: 'Quick Links', iconName: 'link', count: state.links.items.length }),
      navItem({ view: 'templates', label: 'My Templates', iconName: 'folder', count: customCount }),
      navItem({ view: 'settings', label: 'Settings & Data', iconName: 'sliders' })
    ),
    h(
      'div',
      { class: 'sidebar__foot' },
      h('button', { type: 'button', class: 'sidebar__guide', 'data-fk': 'guide', onclick: openGuide }, icon('book'), 'Quick Guide'),
      h(
        'p',
        { class: 'sidebar__status' },
        icon(store.ok ? 'lock' : 'alert'),
        store.ok ? 'Works offline. Saved only in this browser.' : 'Browser storage unavailable. Changes last until this tab closes.'
      )
    )
  );
}

function updateTopbar() {
  const n = builderCount();
  els.builderCount.textContent = String(n);
  els.builderCount.classList.toggle('is-active', n > 0);
  els.builderCount.setAttribute('aria-label', `${plural(n, 'item')} in the Coaching Builder`);
  els.builderBtn.setAttribute('aria-current', state.ui.view === 'builder' ? 'page' : 'false');
  if (els.searchInput.value !== state.ui.query) els.searchInput.value = state.ui.query;
  const placeholder = window.innerWidth < 720 ? 'Search behaviors' : 'Search behaviors: dead air, sleepy tone, customer angry...';
  if (els.searchInput.placeholder !== placeholder) els.searchInput.placeholder = placeholder;
  els.search.classList.toggle('has-value', !!state.ui.query);
  const t = state.prefs.theme;
  setIcon(els.themeBtn.querySelector('svg'), t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'monitor');
  els.themeBtn.setAttribute('aria-label', `Theme: ${t}. Change theme`);
  els.themeBtn.title = `Theme: ${t}`;
}

/* ---------- Actions ---------- */
function toggleFavorite(id) {
  const o = getOpp(id);
  if (!o) return;
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    announce(`${o.title} removed from favorites.`);
  } else {
    state.favorites.add(id);
    announce(`${o.title} added to favorites.`);
  }
  persist('favorites');
  refresh();
}

function toggleBuilderOpp(id) {
  const o = getOpp(id);
  if (!o) return;
  const b = state.builder;
  const i = b.opps.indexOf(id);
  if (i >= 0) {
    b.opps.splice(i, 1);
    toast(`Removed "${o.title}" from the Coaching Builder`);
  } else {
    b.opps.push(id);
    toast(`Added "${o.title}" to the Coaching Builder`, { action: { label: 'Open Builder', fn: () => navigate('builder') } });
  }
  persist('builder');
  refresh();
}

/* ---------- Cards ---------- */
function oppCard(o, tokens) {
  const fav = state.favorites.has(o.id);
  const added = state.builder.opps.includes(o.id);
  const open = (e) => {
    if (e && e.target.closest('button:not(.opp-card__open), a, input, label')) return;
    openOpp(o.id);
  };
  const card = h(
    'article',
    { class: `opp-card cat-${o.cat}${state.ui.openId === o.id ? ' is-active' : ''}`, 'data-id': o.id, onclick: open },
    h(
      'div',
      { class: 'opp-card__top' },
      catChip(o.cat),
      o.custom ? h('span', { class: 'badge badge--custom' }, 'Custom') : o.customized ? h('span', { class: 'badge badge--edited' }, 'Edited') : null,
      h(
        'div',
        { class: 'opp-card__actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn icon-btn--sm is-fav',
            'aria-pressed': String(fav),
            'aria-label': `${fav ? 'Remove' : 'Add'} ${o.title} ${fav ? 'from' : 'to'} favorites`,
            title: fav ? 'Remove from favorites' : 'Add to favorites',
            'data-fk': `fav:${o.id}`,
            onclick: (e) => {
              e.stopPropagation();
              toggleFavorite(o.id);
            },
          },
          icon('star', fav ? 'is-filled' : '')
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn icon-btn--sm is-added',
            'aria-pressed': String(added),
            'aria-label': `${added ? 'Remove' : 'Add'} ${o.title} ${added ? 'from' : 'to'} the Coaching Builder`,
            title: added ? 'Remove from Coaching Builder' : 'Add to Coaching Builder',
            'data-fk': `add:${o.id}`,
            onclick: (e) => {
              e.stopPropagation();
              toggleBuilderOpp(o.id);
            },
          },
          icon(added ? 'check' : 'plus')
        )
      )
    ),
    h(
      'div',
      { class: 'opp-card__body' },
      h('h3', { class: 'opp-card__title' }, h('button', { type: 'button', class: 'opp-card__open', 'data-fk': `open:${o.id}`, 'aria-label': `Open coaching for ${o.title}` }, highlight(o.title, tokens))),
      h('p', { class: 'opp-card__desc' }, highlight(o.desc || '', tokens))
    ),
    (o.tags || []).length ? h('div', { class: 'opp-card__meta', 'aria-label': 'Tags' }, (o.tags || []).map((t) => h('span', { class: 'tag' }, t))) : null,
    h(
      'div',
      { class: 'opp-card__foot' },
      h('div', { class: 'opp-card__kpis', 'aria-label': 'Related KPIs' }, (o.kpi || []).map(kpiChip)),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', tabindex: '-1', 'aria-hidden': 'true', onclick: (e) => { e.stopPropagation(); openOpp(o.id); } }, 'Open', icon('arrow-right'))
    )
  );
  return card;
}

function cardGrid(items, tokens) {
  return h('div', { class: `grid${state.prefs.layout === 'list' ? ' is-list' : ''}` }, items.map((o) => oppCard(o, tokens)));
}

/* ---------- Reference cards ---------- */
/** Banner at the top of the ABS & Attrition category, pointing to the conversation toolkit. */
function peoplePromo() {
  return h(
    'div',
    { class: 'promo cat-people' },
    h('span', { class: 'promo__icon', 'aria-hidden': 'true' }, icon('users')),
    h('div', { class: 'promo__text' }, h('p', { class: 'promo__title' }, 'Planning an attendance or stay conversation?'), h('p', { class: 'promo__sub' }, 'The toolkit has a step-by-step attendance conversation, return-to-work lines, stay questions, early warning signs, and recognition ideas.')),
    h('a', { class: 'btn btn--primary btn--sm', href: '#/people-toolkit', 'data-fk': 'promo-people' }, 'Open the toolkit', icon('arrow-right'))
  );
}

function refCard(kind) {
  const g = GUIDES[kind];
  if (!g) return null;
  const openState = state.prefs.refOpen[kind] !== false;
  const bodyId = `ref-${kind}`;
  const body = h('div', { class: 'ref__body', id: bodyId, hidden: !openState });
  if (kind === 'sales') {
    const flow = h('div', { class: 'flow', role: 'list', 'aria-label': 'Sales conversation flow' });
    g.flow.forEach((step, i) => {
      if (i) flow.appendChild(icon('chev-right', 'flow__arrow'));
      flow.appendChild(h('span', { class: 'flow__step', role: 'listitem' }, h('span', { class: 'flow__num' }, String(i + 1)), step));
    });
    body.appendChild(flow);
    body.appendChild(h('div', { class: 'ref__grid' }, g.offers.map((it) => h('div', { class: 'ref__item' }, h('p', { class: 'ref__term' }, it.term), h('p', { class: 'ref__text' }, it.text)))));
  } else {
    body.appendChild(h('div', { class: 'ref__grid' }, g.items.map((it) => h('div', { class: 'ref__item' }, h('p', { class: 'ref__term' }, it.term), h('p', { class: 'ref__text' }, it.text)))));
  }
  body.appendChild(h('p', { class: 'ref__caution' }, icon('alert'), h('span', null, g.caution)));
  if (kind === 'sales') {
    body.appendChild(
      h('div', { style: 'margin-top:12px' }, h('a', { class: 'btn btn--primary btn--sm', href: '#/sales-toolkit', 'data-fk': 'ref-toolkit' }, icon('tag'), 'Open the Sales Toolkit'))
    );
  }
  const toggle = h(
    'button',
    {
      type: 'button',
      class: 'ref__toggle',
      'aria-expanded': String(openState),
      'aria-controls': bodyId,
      'data-fk': `ref:${kind}`,
      onclick: () => {
        state.prefs.refOpen[kind] = !openState;
        persist('prefs');
        refresh({ panel: false });
      },
    },
    h('span', { class: `ref__icon cat-${kind === 'sales' ? 'sales' : 'hold'}` }, icon(kind === 'sales' ? 'trend' : 'info')),
    h('span', null, h('span', { class: 'ref__title', style: 'display:block' }, g.title), h('span', { class: 'ref__intro' }, g.intro)),
    icon('chev-down')
  );
  return h('section', { class: `ref cat-${kind === 'sales' ? 'sales' : 'hold'}`, 'aria-label': g.title }, toggle, body);
}

/* ---------- Library view ---------- */
function libraryToolbar() {
  return h(
    'div',
    { class: 'toolbar' },
    h('span', { class: 'toolbar__label', id: 'kpiLabel' }, 'KPI focus'),
    h(
      'div',
      { class: 'filter-chips', role: 'group', 'aria-labelledby': 'kpiLabel' },
      [{ id: '', label: 'All' }].concat(KPIS).map((k) =>
        h(
          'button',
          {
            type: 'button',
            class: 'filter-chip',
            'aria-pressed': String(state.prefs.kpi === k.id),
            title: k.hint || 'Show all opportunities',
            'data-fk': `kpi:${k.id}`,
            onclick: () => {
              state.prefs.kpi = k.id;
              persist('prefs');
              refresh({ panel: false });
            },
          },
          k.label
        )
      )
    ),
    h('span', { class: 'toolbar__spacer' }),
    h('label', { class: 'sr-only', for: 'sortSelect' }, 'Sort opportunities'),
    h(
      'select',
      {
        class: 'select',
        id: 'sortSelect',
        style: 'width:auto;height:34px',
        'data-fk': 'sort',
        value: state.prefs.sort,
        onchange: (e) => {
          state.prefs.sort = e.target.value;
          persist('prefs');
          refresh({ panel: false });
        },
      },
      h('option', { value: 'relevance' }, state.ui.query ? 'Best match' : 'Library order'),
      h('option', { value: 'az' }, 'A to Z'),
      h('option', { value: 'category' }, 'By category')
    ),
    segmented({
      label: 'Layout',
      value: state.prefs.layout,
      fkPrefix: 'layout',
      options: [
        { value: 'grid', label: 'Grid', icon: 'grid', title: 'Card grid' },
        { value: 'list', label: 'List', icon: 'list', title: 'Compact list' },
      ],
      onChange: (v) => {
        state.prefs.layout = v;
        persist('prefs');
        refresh({ panel: false });
      },
    })
  );
}

function renderLibrary(main) {
  const view = state.ui.view;
  const cat = view === 'cat' ? CAT_MAP[state.ui.cat] : null;
  const q = state.ui.query.trim();
  let base = content.opps;
  if (cat) base = base.filter((o) => o.cat === cat.id);
  if (view === 'favorites') base = base.filter((o) => state.favorites.has(o.id));
  const scopeCount = base.length;
  if (state.prefs.kpi) base = base.filter((o) => (o.kpi || []).includes(state.prefs.kpi));
  const search = q ? searchList(base, q) : { results: base.map((item) => ({ item, score: 0 })), partial: false, tokens: [] };
  let items = search.results.map((r) => r.item);
  if (state.prefs.sort === 'az') items = items.slice().sort((a, b) => a.title.localeCompare(b.title));
  else if (state.prefs.sort === 'category') items = items.slice().sort((a, b) => catOrder(a.cat) - catOrder(b.cat));
  state.ui.visibleIds = items.map((o) => o.id);

  let title = 'All Opportunities';
  let sub = `${content.opps.length} coaching opportunities across ${CATS.length} categories. Open one to copy ready-to-paste feedback, a SMART action plan, and a follow-up plan.`;
  let eyebrow = null;
  if (cat) {
    title = cat.label;
    sub = `${plural(scopeCount, 'opportunity', 'opportunities')}. ${CAT_DESC[cat.id] || ''}`;
    eyebrow = [h('span', { class: `group__icon cat-${cat.id}`, style: 'width:22px;height:22px;border-radius:6px' }, icon(CAT_ICON[cat.id], 'icon--sm')), 'Category'];
  } else if (view === 'favorites') {
    title = 'Favorites';
    sub = 'Your starred opportunities for quick access. Use the star on any card to add or remove one.';
  }
  main.append(pageHead({ eyebrow, title, sub }), libraryToolbar());

  if (cat && (cat.id === 'hold' || cat.id === 'sales')) main.append(refCard(cat.id));
  if (cat && cat.id === 'people') main.append(peoplePromo());

  if (q) {
    const meta = h('p', { class: 'result-meta', role: 'status' });
    if (items.length) {
      meta.append(h('strong', null, plural(items.length, 'result')), ` for “${q}”`, search.partial ? ' (partial matches)' : '');
    } else {
      meta.append(`No results for “${q}”`);
    }
    if (view !== 'all') {
      meta.append(' · ', h('button', { type: 'button', class: 'btn btn--ghost btn--sm', style: 'display:inline-flex;vertical-align:middle', onclick: () => navigate('all') }, 'Search all opportunities'));
    }
    main.append(meta);
  }

  if (!items.length) {
    if (view === 'favorites' && !scopeCount) {
      main.append(emptyState({ iconName: 'star', title: 'No favorites yet', text: 'Star the opportunities you coach most often and they will appear here.', action: h('a', { class: 'btn', href: '#/all' }, 'Browse all opportunities') }));
    } else {
      main.append(
        emptyState({
          iconName: 'search',
          title: 'Nothing matches yet',
          text: q ? 'Try a different word, such as "silence", "probing", "tone", "transfer", or "billing". You can also clear the KPI filter.' : 'No opportunities match the current KPI filter.',
          action: h('button', { type: 'button', class: 'btn', onclick: () => { state.ui.query = ''; state.prefs.kpi = ''; persist('prefs'); refresh(); } }, 'Clear search and filters'),
        })
      );
    }
    return;
  }

  if (view === 'all' && !q && state.prefs.sort === 'relevance') {
    for (const c of CATS) {
      const list = items.filter((o) => o.cat === c.id);
      if (!list.length) continue;
      main.append(
        h(
          'section',
          { class: `group cat-${c.id}`, 'aria-labelledby': `grp-${c.id}` },
          h(
            'div',
            { class: 'group__head' },
            h('span', { class: 'group__icon' }, icon(CAT_ICON[c.id])),
            h('h2', { class: 'group__title', id: `grp-${c.id}` }, c.label),
            h('span', { class: 'group__count' }, String(list.length)),
            h('a', { class: 'btn btn--ghost btn--sm group__link', href: `#/cat/${c.id}`, 'data-fk': `grp:${c.id}` }, 'View category', icon('arrow-right'))
          ),
          cardGrid(list, [])
        )
      );
    }
  } else {
    main.append(h('h2', { class: 'sr-only' }, q ? 'Search results' : 'Coaching opportunities'), cardGrid(items, search.tokens));
  }
}

/* ---------- Main dispatcher ---------- */
function renderMain() {
  const main = els.main;
  main.replaceChildren();
  const v = state.ui.view;
  // Entrance animations run only when a page is opened, not when it re-renders after a click.
  main.classList.remove('anim-enter');
  if (state.ui.enterAnim) {
    void main.offsetWidth;
    main.classList.add('anim-enter');
    state.ui.enterAnim = false;
  }
  if (!store.ok && (v === 'builder' || v === 'templates' || v === 'settings')) {
    main.append(h('p', { class: 'banner', role: 'note' }, icon('alert'), h('span', null, 'Browser storage is unavailable (for example in some private windows or locked-down browsers). Everything works, but changes are lost when this tab closes. Use Export in Settings & Data to keep a copy.')));
  }
  if (v === 'home') renderHome(main);
  else if (v === 'strengths') renderStrengthsView(main);
  else if (v === 'sales-toolkit') renderSalesToolkit(main);
  else if (v === 'call-review') renderCallReview(main);
  else if (v === 'people-toolkit') renderPeopleToolkit(main);
  else if (v === 'links') renderLinks(main);
  else if (v === 'builder') renderBuilder(main);
  else if (v === 'templates') renderTemplates(main);
  else if (v === 'settings') renderSettings(main);
  else renderLibrary(main);
  document.title = `${titleForView()} — Coaching Intelligence Pro — VXI`;
}

function titleForView() {
  const v = state.ui.view;
  if (v === 'cat') return (CAT_MAP[state.ui.cat] || {}).nav || 'Category';
  return { home: 'Home', all: 'All Opportunities', strengths: 'Things Went Well', 'sales-toolkit': 'Sales Toolkit', 'call-review': 'Call Review', 'people-toolkit': 'ABS & Attrition Toolkit', links: 'Quick Links', favorites: 'Favorites', builder: 'Coaching Builder', templates: 'My Templates', settings: 'Settings & Data' }[v] || 'Library';
}

/** Re-render everything that depends on state, keeping focus and scroll where they were. */
let refreshing = false;
let refreshQueued = null;
function refresh(opts = {}) {
  if (refreshing) {
    // A blur/change event fired while the page was being replaced; re-render once the current pass ends.
    refreshQueued = { main: (refreshQueued && refreshQueued.main) || opts.main !== false, panel: true };
    return;
  }
  refreshing = true;
  try {
    refreshNow(opts);
  } finally {
    refreshing = false;
  }
  if (refreshQueued) {
    const next = refreshQueued;
    refreshQueued = null;
    Promise.resolve().then(() => refresh(next));
  }
}

function refreshNow(opts) {
  const { main = true, panel = true } = opts;
  const active = document.activeElement;
  const fk = active && active.getAttribute ? active.getAttribute('data-fk') : null;
  renderSidebar();
  updateTopbar();
  if (main) renderMain();
  if (panel && state.ui.openId) renderPanel({ keepScroll: true });
  if (fk && (!active.isConnected || active !== document.activeElement)) focusByKey(fk);
}

/** Focus the element carrying a focus key; falls back to a sibling input when the button became disabled. */
function focusByKey(fk, root = document) {
  const target = root.querySelector(`[data-fk="${cssEscape(fk)}"]`);
  if (!target) return false;
  if (target.disabled) {
    const alt = target.closest('.stepper') ? target.closest('.stepper').querySelector('input') : null;
    if (alt) alt.focus({ preventScroll: true });
    return !!alt;
  }
  target.focus({ preventScroll: true });
  return true;
}
