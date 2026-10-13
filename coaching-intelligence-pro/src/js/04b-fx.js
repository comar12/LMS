/* ==========================================================================
   04b-fx: app-wide motion (pointer spotlight, button ripple, confetti) and
   the premium dropdown that replaces every native <select class="select">
   ========================================================================== */

const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** A short confetti burst from a screen rectangle (or the bottom of the screen). Skipped when motion is reduced. */
function celebrate(rect) {
  if (reducedMotion()) return;
  const r = rect || { left: window.innerWidth / 2, top: window.innerHeight - 90, width: 0, height: 0 };
  const colors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--indigo)', '#ffb020', '#ff6b8a'];
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true', style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px` });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 70;
    box.appendChild(h('span', { class: `confetti__bit${i % 3 === 0 ? ' confetti__bit--round' : ''}`, style: `--x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist - 30}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--c:${colors[i % colors.length]};--t:${700 + Math.round(Math.random() * 400)}ms` }));
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1300);
}

/** Confetti from wherever `selector` is on screen after a re-render, else from where `before` was. */
function celebrateAt(selector, before) {
  const onScreen = (r) => r && r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  const el = document.querySelector(selector);
  const after = el ? el.getBoundingClientRect() : null;
  celebrate(onScreen(after) ? after : onScreen(before) ? before : null);
}

/* ---------- Pointer spotlight on cards ---------- */
const SPOT_SEL = '.pulse, .stat, .home-tile, .kpi-tile, .cat-tile, .opp-card, .plan, .tk-step, .type-card, .health__item, .snap-card, .rt-row, .lk-card, .pk-card';
let spotRaf = 0;
let spotEvt = null;
function onSpotMove(e) {
  spotEvt = e;
  if (spotRaf) return;
  spotRaf = requestAnimationFrame(() => {
    spotRaf = 0;
    const t = spotEvt.target;
    const card = t && t.closest ? t.closest(SPOT_SEL) : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${spotEvt.clientX - r.left}px`);
    card.style.setProperty('--my', `${spotEvt.clientY - r.top}px`);
  });
}

/* ---------- Ripple on buttons ---------- */
function onRipple(e) {
  if (e.button !== 0 || reducedMotion()) return;
  const btn = e.target.closest ? e.target.closest('.btn, .kpi-tile, .home-tile, .cat-tile, .type-card, .mp__opt, .pick__opt') : null;
  if (!btn || btn.disabled) return;
  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const wave = h('span', { class: 'ripple', 'aria-hidden': 'true', style: `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px` });
  let host = btn.querySelector(':scope > .ripple-host');
  if (!host) {
    host = h('span', { class: 'ripple-host', 'aria-hidden': 'true' });
    btn.appendChild(host);
  }
  host.appendChild(wave);
  setTimeout(() => wave.remove(), 650);
}

/* ---------- Premium dropdown ---------- */
const SEL_VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const SEL_INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
const HAS_POPOVER = typeof HTMLElement.prototype.showPopover === 'function';
let openPick = null;

/**
 * Replace a native select with a button and a styled list. The select stays in place
 * (invisible) and keeps its value, so existing change handlers and labels still work.
 */
function enhanceSelect(sel) {
  if (sel._pick || sel.multiple || !sel.isConnected) return;
  // Moving the select into its wrapper drops focus, so remember it first.
  const hadFocus = document.activeElement === sel;
  const wrap = h('span', { class: 'pick' });
  const valueEl = h('span', { class: 'pick__value' });
  const btn = h('button', { type: 'button', class: 'pick__btn', id: uid('pick'), 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'data-fk': sel.getAttribute('data-fk') || undefined }, valueEl, icon('chev-down', 'pick__chev'));
  if (sel.style.cssText) {
    btn.style.cssText = sel.style.cssText;
    if (sel.style.width === 'auto') wrap.classList.add('pick--auto');
  }
  const label = sel.id ? document.querySelector(`label[for="${CSS.escape(sel.id)}"]`) : null;
  if (label) {
    if (!label.id) label.id = uid('pick-label');
    btn.setAttribute('aria-labelledby', `${label.id} ${btn.id}`);
  }
  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel, btn);
  sel.classList.add('pick__native');
  sel.setAttribute('tabindex', '-1');
  sel.setAttribute('aria-hidden', 'true');

  const sync = () => {
    const opt = sel.options[sel.selectedIndex];
    valueEl.textContent = opt ? opt.textContent : '';
    btn.disabled = sel.disabled;
    if (!label) btn.setAttribute('aria-label', `${sel.getAttribute('aria-label') || 'Choose'}: ${valueEl.textContent}`);
  };
  Object.defineProperty(sel, 'value', { configurable: true, get() { return SEL_VALUE.get.call(this); }, set(v) { SEL_VALUE.set.call(this, v); sync(); } });
  Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return SEL_INDEX.get.call(this); }, set(v) { SEL_INDEX.set.call(this, v); sync(); } });
  sel.addEventListener('change', sync);
  sel.addEventListener('input', sync);
  // Clicking the label (or restoring focus after a re-render) lands on the button.
  sel.addEventListener('focus', () => btn.focus());
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label'] });

  let pop = null;
  let list = null;
  let search = null;
  let items = [];
  let active = -1;
  let typed = '';
  let typedAt = 0;

  const close = (focusBtn) => {
    if (!pop) return;
    const p = pop;
    pop = null;
    openPick = null;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', onWin);
    window.removeEventListener('scroll', onWin, true);
    p.classList.add('is-leaving');
    setTimeout(() => {
      if (HAS_POPOVER && p.matches(':popover-open')) p.hidePopover();
      p.remove();
    }, reducedMotion() ? 0 : 140);
    if (focusBtn) btn.focus({ preventScroll: true });
  };
  const outside = (e) => {
    if (!wrap.contains(e.target) && !(pop && pop.contains(e.target))) close(false);
  };
  // Follow the button while the page scrolls; close only when it leaves the screen.
  const onWin = (e) => {
    if (!pop || (e.type === 'scroll' && pop.contains(e.target))) return;
    const r = btn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) close(false);
    else place();
  };
  const choose = (i) => {
    const it = items[i];
    if (!it || it.opt.disabled) return;
    const changed = sel.value !== it.opt.value;
    close(true);
    if (!changed) return;
    SEL_VALUE.set.call(sel, it.opt.value);
    sync();
    wrap.classList.remove('is-picked');
    void wrap.offsetWidth;
    wrap.classList.add('is-picked');
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const setActive = (i, scroll = true) => {
    const vis = items.filter((x) => !x.el.hidden);
    if (!vis.length) return;
    const idx = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((x, k) => x.el.classList.toggle('is-active', k === idx));
    active = idx;
    const focusEl = search || list;
    focusEl.setAttribute('aria-activedescendant', items[idx].el.id);
    if (scroll) items[idx].el.scrollIntoView({ block: 'nearest' });
  };
  const step = (dir) => {
    const vis = items.map((x, k) => ({ x, k })).filter(({ x }) => !x.el.hidden && !x.opt.disabled);
    if (!vis.length) return;
    const pos = vis.findIndex(({ k }) => k === active);
    const next = dir === 'first' ? 0 : dir === 'last' ? vis.length - 1 : Math.max(0, Math.min(vis.length - 1, (pos < 0 ? (dir > 0 ? -1 : vis.length) : pos) + dir));
    setActive(vis[next].k);
  };
  const filter = () => {
    const q = normalizeText(search.value);
    let any = false;
    items.forEach((x) => {
      x.el.hidden = !!q && !normalizeText(x.opt.textContent).includes(q);
      if (!x.el.hidden) any = true;
    });
    list.querySelectorAll('.pick__group').forEach((g) => {
      g.hidden = ![...g.querySelectorAll('[role="option"]')].some((o) => !o.hidden);
    });
    empty.hidden = any;
    if (items[active] && items[active].el.hidden) step('first');
    else if (active < 0) step('first');
  };
  const empty = h('p', { class: 'pick__empty', hidden: true }, 'No matches');
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home' && !search) { e.preventDefault(); step('first'); }
    else if (e.key === 'End' && !search) { e.preventDefault(); step('last'); }
    else if (e.key === 'PageDown') { e.preventDefault(); for (let k = 0; k < 8; k++) step(1); }
    else if (e.key === 'PageUp') { e.preventDefault(); for (let k = 0; k < 8; k++) step(-1); }
    else if (e.key === 'Enter' || (e.key === ' ' && !search)) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') { close(false); }
    else if (!search && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type to jump, like a native select.
      const now = Date.now();
      typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
      typedAt = now;
      const from = typed.length === 1 ? active + 1 : active;
      const order = items.map((x, k) => (k + Math.max(0, from)) % items.length);
      const hit = order.find((k) => normalizeText(items[k].opt.textContent).startsWith(typed));
      if (hit !== undefined) setActive(hit);
    }
  };
  const place = () => {
    const r = btn.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    pop.style.minWidth = `${width}px`;
    pop.style.maxWidth = `${Math.max(width, Math.min(420, window.innerWidth - 24))}px`;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const want = Math.min(pop.scrollHeight, 340);
    const up = below < Math.min(want, 220) && above > below;
    const room = Math.max(140, (up ? above : below) - 6);
    pop.style.maxHeight = `${Math.min(340, room)}px`;
    pop.classList.toggle('is-up', up);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - pop.offsetWidth - 12);
    pop.style.left = `${Math.max(12, left)}px`;
    pop.style.top = up ? `${Math.max(12, r.top - Math.min(want, room) - 6)}px` : `${r.bottom + 6}px`;
  };
  const open = () => {
    if (pop || sel.disabled) return;
    if (openPick) openPick.close(false);
    const listId = uid('pick-list');
    list = h('div', { class: 'pick__list', role: 'listbox', id: listId, tabindex: '-1', 'aria-labelledby': btn.getAttribute('aria-labelledby') || undefined, 'aria-label': label ? undefined : sel.getAttribute('aria-label') || 'Options' });
    items = [];
    const addOpt = (opt, parent) => {
      const selected = opt.selected;
      const el = h('div', { class: `pick__opt${selected ? ' is-selected' : ''}${opt.disabled ? ' is-disabled' : ''}`, role: 'option', id: uid('pick-opt'), 'aria-selected': String(selected), 'aria-disabled': opt.disabled ? 'true' : undefined }, h('span', { class: 'pick__opt-text' }, opt.textContent), h('span', { class: 'pick__tick', 'aria-hidden': 'true' }, icon('check', 'icon--sm')));
      const k = items.length;
      el.style.setProperty('--i', String(Math.min(k, 12)));
      el.addEventListener('click', () => choose(k));
      el.addEventListener('pointermove', () => { if (active !== k) setActive(k, false); });
      items.push({ opt, el });
      parent.appendChild(el);
    };
    [...sel.children].forEach((c) => {
      if (c.tagName === 'OPTGROUP') {
        const gid = uid('pick-g');
        const g = h('div', { class: 'pick__group', role: 'group', 'aria-labelledby': gid }, h('div', { class: 'pick__group-label', id: gid }, c.label));
        [...c.children].forEach((o) => addOpt(o, g));
        list.appendChild(g);
      } else if (c.tagName === 'OPTION') addOpt(c, list);
    });
    search = items.length > 10 ? h('input', { class: 'pick__search', type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': listId, 'aria-autocomplete': 'list', 'aria-label': 'Search options', placeholder: 'Type to search', autocomplete: 'off', spellcheck: 'false' }) : null;
    pop = h('div', { class: 'pick__pop', popover: HAS_POPOVER ? 'manual' : undefined }, search ? h('div', { class: 'pick__search-wrap' }, icon('search', 'icon--sm'), search) : null, list, empty);
    (search || list).addEventListener('keydown', onKey);
    if (search) search.addEventListener('input', filter);
    wrap.appendChild(pop);
    if (HAS_POPOVER) pop.showPopover();
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', listId);
    wrap.classList.add('is-open');
    place();
    const cur = items.findIndex((x) => x.opt.selected);
    setActive(cur >= 0 ? cur : 0);
    (search || list).focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    openPick = { close };
  };
  btn.addEventListener('click', () => (pop ? close(true) : open()));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !pop) {
      e.preventDefault();
      open();
    }
  });
  wrap.addEventListener('focusout', (e) => {
    if (pop && e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
  });
  sel._pick = { btn, close, sync };
  sync();
  if (hadFocus) btn.focus({ preventScroll: true });
}

/** Every picker in a new piece of the page gets the app's own look: dropdowns, dates, numbers, and colors. */
function enhanceSelects(root) {
  if (root.matches && root.matches('select.select')) enhanceSelect(root);
  if (root.querySelectorAll) root.querySelectorAll('select.select').forEach(enhanceSelect);
  enhancePickers(root);
}

function initFx() {
  enhanceSelects(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && enhanceSelects(n));
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointermove', onSpotMove, { passive: true });
  document.addEventListener('pointerdown', onRipple, { passive: true });
}
