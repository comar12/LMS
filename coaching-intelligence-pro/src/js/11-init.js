/* ==========================================================================
   11-init: hash routing, global events, startup
   ========================================================================== */

const VIEWS = ['home', 'today', 'all', 'session', 'snapshot', 'leader', 'team', 'practice', 'listen', 'call-review', 'strengths', 'sales-toolkit', 'people-toolkit', 'favorites', 'builder', 'tracker', 'huddle', 'links', 'templates', 'settings'];

function parseHash() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');
  // With no hash the app opens on the Home dashboard.
  let view = parts.length ? 'all' : 'home';
  let cat = null;
  if (parts[0] === 'cat' && CAT_MAP[parts[1]]) {
    view = 'cat';
    cat = parts[1];
  } else if (VIEWS.includes(parts[0])) {
    view = parts[0];
  }
  return { view, cat, open: params.get('open') };
}

function hashFor(view, cat, open) {
  let hash = view === 'cat' && cat ? `#/cat/${cat}` : `#/${view || 'all'}`;
  if (open) hash += `?open=${encodeURIComponent(open)}`;
  return hash;
}

function navigate(view, opts = {}) {
  const { cat = null, open = null, replace = false } = opts;
  const target = hashFor(view, view === 'cat' ? cat || state.ui.cat : null, open);
  if (window.location.hash === target) {
    route();
    return;
  }
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

function route() {
  const r = parseHash();
  const viewChanged = r.view !== state.ui.view || r.cat !== state.ui.cat;
  state.ui.view = r.view;
  state.ui.cat = r.cat;
  if (viewChanged) {
    state.ui.enterAnim = true;
    renderSidebar();
    updateTopbar();
    renderMain();
    window.scrollTo(0, 0);
    closeNav();
  }
  const openId = r.open && getOpp(r.open) ? r.open : null;
  if (openId !== state.ui.openId) {
    state.ui.openId = openId;
    if (openId) showPanel();
    else hidePanel();
  } else if (viewChanged && openId) {
    renderPanel({ keepScroll: true });
  }
  if (viewChanged && !openId && !initialRoute && document.activeElement !== els.searchInput) {
    // Move focus to the new page heading for screen reader and keyboard users.
    const heading = document.getElementById('pageTitle');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
  initialRoute = false;
}
let initialRoute = true;

/* ---------- Mobile navigation ---------- */
function openNav() {
  els.app.classList.add('nav-open');
  els.menuBtn.setAttribute('aria-expanded', 'true');
  syncInert();
  focusSoon(els.sidebar.querySelector('[aria-current="page"]') || els.sidebar.querySelector('a, button'));
}
function closeNav(restoreFocus) {
  if (!els.app.classList.contains('nav-open')) return;
  els.app.classList.remove('nav-open');
  els.menuBtn.setAttribute('aria-expanded', 'false');
  syncInert();
  if (restoreFocus) els.menuBtn.focus({ preventScroll: true });
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onGlobalKeydown(e) {
  if (modalStack.length) return; // dialogs handle their own keys
  const typing = isTypingTarget(e.target);
  if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
    e.preventDefault();
    closeNav();
    els.searchInput.focus();
    els.searchInput.select();
    return;
  }
  if (e.key === 'Escape') {
    if (els.app.classList.contains('nav-open')) {
      e.preventDefault();
      closeNav(true);
      return;
    }
    if (e.target === els.searchInput && els.searchInput.value) {
      e.preventDefault();
      setQuery('');
      return;
    }
    if (state.ui.openId && !(typing && e.target.closest && !e.target.closest('#panel'))) {
      e.preventDefault();
      closePanel();
    }
    return;
  }
  if (!typing && state.ui.openId && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === '[') {
      e.preventDefault();
      stepPanel(-1);
    } else if (e.key === ']') {
      e.preventDefault();
      stepPanel(1);
    }
  }
  if (e.key === 'Tab' && isPanelOverlay() && els.panel.contains(document.activeElement)) trapTab(e, els.panel);
}

/* ---------- Search ---------- */
function setQuery(value) {
  state.ui.query = value;
  els.searchInput.value = value;
  els.search.classList.toggle('has-value', !!value);
  const v = state.ui.view;
  if (value.trim() && !['all', 'cat', 'favorites', 'strengths'].includes(v)) {
    navigate('all');
    return;
  }
  renderMain();
  renderSidebar();
}
const onSearchInput = debounce(() => setQuery(els.searchInput.value), 110);

/* ---------- Startup ---------- */
function bindElements() {
  els.app = $('#app');
  els.sidebar = $('#sidebar');
  els.workspace = $('#workspace');
  els.main = $('#main');
  els.panel = $('#panel');
  els.panelScrim = $('#panelScrim');
  els.navScrim = $('#navScrim');
  els.menuBtn = $('#menuBtn');
  els.search = $('.search');
  els.searchInput = $('#searchInput');
  els.searchClear = $('#searchClear');
  els.builderBtn = $('#builderBtn');
  els.builderCount = $('#builderCount');
  els.themeBtn = $('#themeBtn');
  els.guideBtn = $('#guideBtn');
  els.modalRoot = $('#modalRoot');
  els.toasts = $('#toasts');
  els.announcer = $('#announcer');
}

function bindEvents() {
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('keydown', onListenKeys);
  els.searchInput.addEventListener('input', () => {
    els.search.classList.toggle('has-value', !!els.searchInput.value);
    onSearchInput();
  });
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchInput.flush();
      const first = els.main.querySelector('.opp-card__open, .observe-btn');
      if (first) first.focus();
    }
  });
  els.searchClear.addEventListener('click', () => {
    setQuery('');
    els.searchInput.focus();
  });
  els.menuBtn.addEventListener('click', () => (els.app.classList.contains('nav-open') ? closeNav(true) : openNav()));
  els.navScrim.addEventListener('click', () => closeNav(true));
  els.panelScrim.addEventListener('click', closePanel);
  els.sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a.nav__item')) closeNav();
  });
  els.guideBtn.addEventListener('click', openGuide);
  els.themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(state.prefs.theme) + 1) % order.length];
    setTheme(next);
    toast(`Theme: ${next}`);
  });
  const onMode = () => {
    syncInert();
    if (!mqNarrow.matches) closeNav();
  };
  if (mqDock.addEventListener) {
    mqDock.addEventListener('change', onMode);
    mqNarrow.addEventListener('change', onMode);
  } else if (mqDock.addListener) {
    mqDock.addListener(onMode);
    mqNarrow.addListener(onMode);
  }
  window.addEventListener(
    'resize',
    debounce(() => {
      $$('.out-sec__text').forEach(autosize);
      updateTopbar();
    }, 150)
  );
  window.addEventListener('pagehide', () => {
    persistBuilderSoon.flush();
    persistPrefsSoon.flush();
  });
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
    const key = e.key.slice(STORAGE_PREFIX.length);
    if (!STATE_KEYS.includes(key) || key === 'builder') return;
    loadSlice(key);
    if (key === 'prefs') {
      applyTheme();
      applyBrand();
    }
    rebuildContent();
    refresh();
  });
}

function init() {
  bindElements();
  loadState();
  applyTheme();
  applyBrand();
  rebuildContent();
  bindEvents();
  initFx();
  initHub();
  const r = parseHash();
  state.ui.view = r.view;
  state.ui.enterAnim = true;
  state.ui.cat = r.cat;
  renderSidebar();
  updateTopbar();
  renderMain();
  if (r.open && getOpp(r.open)) {
    state.ui.openId = r.open;
    showPanel();
  }
  syncInert();
  initialRoute = false;
  document.documentElement.classList.add('is-ready');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
