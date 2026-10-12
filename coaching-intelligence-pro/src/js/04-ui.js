/* ==========================================================================
   04-ui: clipboard, announcements, toasts, modals, shared controls
   ========================================================================== */

const els = {};

/* ---------- Clipboard ---------- */
function cleanCopy(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function legacyCopy(text) {
  const active = document.activeElement;
  const selection = document.getSelection();
  const ranges = [];
  if (selection) for (let i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i));
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.tabIndex = -1;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  ta.remove();
  try {
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((r) => selection.addRange(r));
    }
  } catch (e) {
    /* ignore */
  }
  if (active && typeof active.focus === 'function' && active !== document.body) active.focus({ preventScroll: true });
  return ok;
}

async function writeClipboard(text) {
  const api = navigator.clipboard;
  if (api && typeof api.writeText === 'function' && window.isSecureContext) {
    try {
      await api.writeText(text);
      return true;
    } catch (e) {
      /* fall back below */
    }
  }
  return legacyCopy(text);
}

/** Copy plain text. Shows "Copied" on the button, or a selectable fallback if the browser blocks it. */
async function copyText(text, opts = {}) {
  const clean = cleanCopy(text);
  if (!clean) {
    toast(opts.emptyMessage || 'There is nothing to copy yet.', { type: 'warn' });
    return false;
  }
  const ok = await writeClipboard(clean);
  if (ok) {
    if (opts.button) flashCopied(opts.button);
    else toast(`${opts.label || 'Text'} copied`);
    announce(`${opts.label || 'Text'} copied to clipboard.`);
    if (opts.afterCopy) opts.afterCopy();
    return true;
  }
  showCopyFallback(clean, opts.label);
  return false;
}

function flashCopied(btn) {
  const label = btn.querySelector('.btn__label');
  const svg = btn.querySelector('svg');
  if (!btn._orig) btn._orig = { label: label ? label.textContent : '', icon: svg ? svg.querySelector('use').getAttribute('href') : '' };
  clearTimeout(btn._copyTimer);
  btn.classList.add('is-copied');
  if (label) label.textContent = 'Copied';
  if (svg) setIcon(svg, 'check');
  btn._copyTimer = setTimeout(() => {
    btn.classList.remove('is-copied');
    if (label) label.textContent = btn._orig.label;
    if (svg) setUseHref(svg.querySelector('use'), btn._orig.icon);
  }, 1800);
}

function showCopyFallback(text, label) {
  const ta = h('textarea', { class: 'textarea copy-fallback', readonly: true, 'aria-label': 'Text to copy', value: text });
  const selectBtn = h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { ta.focus(); ta.select(); } }, icon('copy'), 'Select all');
  const m = openModal({
    title: 'Copy manually',
    size: 'md',
    body: [
      h('p', { class: 'notice', role: 'alert' }, icon('info'), h('span', { class: 'notice__body' }, `Your browser blocked automatic copying${label ? ' of ' + label : ''}. The text is selected below. Press Ctrl+C (or Cmd+C on a Mac) to copy it.`)),
      h('div', { style: 'margin-top:12px' }, ta),
    ],
    footer: [h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Done'), selectBtn],
    initialFocus: ta,
  });
  setTimeout(() => ta.select(), 30);
}

function copyButton(getText, opts = {}) {
  const { label = 'Copy', srLabel, primary = false, size = 'sm', fk, emptyMessage } = opts;
  const btn = h(
    'button',
    {
      type: 'button',
      class: `btn copy-btn${size === 'sm' ? ' btn--sm' : ''}${size === 'lg' ? ' btn--lg' : ''}${primary ? ' btn--primary' : ''}`,
      'aria-label': srLabel || label,
      'data-fk': fk,
    },
    icon('copy'),
    h('span', { class: 'btn__label', text: label })
  );
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = typeof getText === 'function' ? getText() : getText;
    copyText(text, { button: btn, label: srLabel || label, emptyMessage });
  });
  return btn;
}

/* ---------- Announcements & toasts ---------- */
function announce(msg) {
  const el = els.announcer;
  if (!el) return;
  el.textContent = '';
  setTimeout(() => {
    el.textContent = msg;
  }, 40);
}

function toast(msg, opts = {}) {
  const { type = 'ok', duration = 2600, action } = opts;
  const region = els.toasts;
  if (!region) return;
  const el = h('div', { class: `toast toast--${type}` }, icon(type === 'error' ? 'alert' : type === 'warn' ? 'info' : 'check'), h('span', null, msg));
  const remove = () => {
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  if (action) {
    el.appendChild(
      h('button', { type: 'button', onclick: () => { action.fn(); remove(); } }, action.label)
    );
  }
  region.appendChild(el);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(remove, action ? Math.max(duration, 6000) : duration);
}

/* ---------- Inert management (modals, overlay panel, mobile navigation) ---------- */
const modalStack = [];
const mqDock = window.matchMedia('(min-width: 1360px)');
const mqNarrow = window.matchMedia('(max-width: 1023px)');

function isPanelOverlay() {
  return !!state.ui.openId && !mqDock.matches;
}

function syncInert() {
  const modal = modalStack.length > 0;
  const navOpen = els.app && els.app.classList.contains('nav-open') && mqNarrow.matches;
  const overlay = isPanelOverlay();
  const setInert = (el, on) => {
    if (!el) return;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  };
  setInert(els.app, modal);
  if (modal) return;
  setInert(els.sidebar, overlay && !navOpen);
  setInert(els.workspace, overlay || navOpen);
  setInert(els.panel, navOpen);
  if (els.panel) {
    if (overlay) {
      els.panel.setAttribute('role', 'dialog');
      els.panel.setAttribute('aria-modal', 'true');
    } else {
      els.panel.setAttribute('role', 'region');
      els.panel.removeAttribute('aria-modal');
    }
  }
}

function trapTab(e, container) {
  const items = focusableIn(container);
  if (!items.length) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Modals ---------- */
function openModal({ title, body, footer, size = 'md', onClose, initialFocus, backdropClose = true }) {
  const previous = document.activeElement;
  const titleId = uid('modal-title');
  const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close dialog' }, icon('x'));
  const dialog = h(
    'div',
    { class: `modal modal--${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('div', { class: 'modal__head' }, h('h2', { class: 'modal__title', id: titleId, text: title }), closeBtn),
    h('div', { class: 'modal__body' }, body),
    footer ? h('div', { class: 'modal__foot' }, footer) : null
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);
  let closed = false;
  const api = {
    el: dialog,
    close(result) {
      if (closed) return;
      closed = true;
      backdrop.remove();
      const i = modalStack.indexOf(api);
      if (i >= 0) modalStack.splice(i, 1);
      syncInert();
      if (onClose) onClose(result);
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    },
  };
  closeBtn.addEventListener('click', () => api.close());
  if (backdropClose) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) api.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      api.close();
    } else if (e.key === 'Tab') trapTab(e, dialog);
  });
  els.modalRoot.appendChild(backdrop);
  // Text-only dialogs need a focusable scroll area so keyboard users can scroll them.
  const bodyEl = dialog.querySelector('.modal__body');
  if (bodyEl && !focusableIn(bodyEl).length) {
    bodyEl.setAttribute('tabindex', '0');
    bodyEl.setAttribute('role', 'document');
  }
  modalStack.push(api);
  syncInert();
  requestAnimationFrame(() => {
    let target = typeof initialFocus === 'string' ? dialog.querySelector(initialFocus) : initialFocus;
    if (!target) target = focusableIn(dialog.querySelector('.modal__body'))[0] || closeBtn;
    (target || dialog).focus({ preventScroll: true });
  });
  return api;
}

function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
    const ok = h('button', { type: 'button', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}` }, confirmLabel);
    const m = openModal({
      title,
      size: 'sm',
      body: h('p', { class: 'prose' }, message),
      footer: [cancel, ok],
      initialFocus: danger ? cancel : ok,
      onClose: () => resolve(result),
    });
    cancel.addEventListener('click', () => m.close());
    ok.addEventListener('click', () => {
      result = true;
      m.close();
    });
  });
}

function promptDialog({ title, label, value = '', hint, confirmLabel = 'Save', maxLength = 80 }) {
  return new Promise((resolve) => {
    let result = null;
    const inputId = uid('prompt');
    const input = h('input', { class: 'input', id: inputId, type: 'text', value, maxlength: String(maxLength), autocomplete: 'off' });
    const warn = h('div');
    const err = h('p', { class: 'field__error', hidden: true }, 'Enter a name.');
    const update = () => {
      warn.replaceChildren();
      const note = piiNote(input.value);
      if (note) warn.appendChild(note);
    };
    input.addEventListener('input', () => {
      err.hidden = true;
      update();
    });
    const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
    const ok = h('button', { type: 'button', class: 'btn btn--primary' }, confirmLabel);
    const submit = () => {
      const v = input.value.trim();
      if (!v) {
        err.hidden = false;
        input.focus();
        return;
      }
      result = v;
      m.close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    const m = openModal({
      title,
      size: 'sm',
      body: h('div', { class: 'field' }, h('label', { class: 'field__label', for: inputId }, label), input, hint ? h('p', { class: 'field__hint' }, hint) : null, err, warn),
      footer: [cancel, ok],
      initialFocus: input,
      onClose: () => resolve(result),
    });
    cancel.addEventListener('click', () => m.close());
    ok.addEventListener('click', submit);
    setTimeout(() => input.select(), 30);
  });
}

/* ---------- Combobox (ARIA 1.2 pattern) ---------- */
function combobox({ id, label, placeholder, getItems, onSelect }) {
  const listId = id + '-list';
  const input = h('input', {
    class: 'input combo__input',
    id,
    type: 'text',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder,
    'data-fk': 'combo:' + id,
  });
  const list = h('ul', { class: 'combo__list', id: listId, role: 'listbox', 'aria-label': label, hidden: true });
  let items = [];
  let active = -1;
  let open = false;

  const optId = (i) => `${id}-opt-${i}`;
  function renderList() {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(h('li', { class: 'combo__empty', role: 'presentation' }, 'No matches'));
      return;
    }
    items.forEach((it, i) => {
      list.appendChild(
        h(
          'li',
          {
            class: 'combo__opt',
            id: optId(i),
            role: 'option',
            'aria-selected': i === active ? 'true' : 'false',
            'aria-disabled': it.disabled ? 'true' : null,
            dataset: { i: String(i) },
          },
          it.dotCat ? h('span', { class: `chip__dot cat-${it.dotCat}`, style: 'color:var(--cc)' }) : null,
          h('span', { class: 'combo__opt-title' }, it.title),
          it.sub ? h('span', { class: 'combo__opt-sub' }, it.sub) : null
        )
      );
    });
  }
  function setActive(i) {
    active = i;
    $$('[role="option"]', list).forEach((li, idx) => li.setAttribute('aria-selected', idx === active ? 'true' : 'false'));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', optId(active));
      const li = document.getElementById(optId(active));
      if (li) li.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function refresh() {
    items = getItems(input.value).slice(0, 60);
    active = items.findIndex((it) => !it.disabled);
    renderList();
    setActive(active);
  }
  function show() {
    if (open) return;
    open = true;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function hide() {
    open = false;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function choose(i) {
    const it = items[i];
    if (!it || it.disabled) return;
    input.value = '';
    hide();
    onSelect(it.id);
  }
  input.addEventListener('focus', () => {
    refresh();
    show();
  });
  input.addEventListener('input', () => {
    refresh();
    show();
  });
  input.addEventListener('blur', () => setTimeout(hide, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        refresh();
        show();
        return;
      }
      let i = active;
      do i = Math.min(items.length - 1, i + 1); while (items[i] && items[i].disabled && i < items.length - 1);
      setActive(i);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let i = active;
      do i = Math.max(0, i - 1); while (items[i] && items[i].disabled && i > 0);
      setActive(i);
    } else if (e.key === 'Enter') {
      if (open && active >= 0) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      }
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li) choose(Number(li.dataset.i));
  });
  return h('div', { class: 'combo' }, h('label', { class: 'sr-only', for: id }, label), icon('search', 'combo__icon'), input, list);
}

/* ---------- Small controls ---------- */
function segmented({ label, options, value, onChange, fkPrefix }) {
  return h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': label },
    options.map((opt) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(opt.value === value),
          'data-fk': fkPrefix ? `${fkPrefix}:${opt.value}` : null,
          title: opt.title || null,
          onclick: () => {
            if (opt.value !== value) onChange(opt.value);
          },
        },
        opt.icon ? icon(opt.icon) : null,
        opt.label
      )
    )
  );
}

function stepper({ id, label, value, min, max, onChange }) {
  const input = h('input', { type: 'number', id, inputmode: 'numeric', min: String(min), max: String(max), value: String(value), 'data-fk': 'step:' + id, 'aria-label': label });
  let current = value;
  const commit = (v) => {
    const n = clampInt(v, min, max, current);
    input.value = String(n);
    if (n !== current) {
      current = n;
      onChange(n);
    }
  };
  input.addEventListener('change', () => commit(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(input.value);
    }
  });
  return h(
    'div',
    { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': `Decrease ${label}`, 'data-fk': `step-dec:${id}`, disabled: value <= min, onclick: () => commit(current - 1) }, icon('chev-left', 'icon--sm')),
    input,
    h('button', { type: 'button', 'aria-label': `Increase ${label}`, 'data-fk': `step-inc:${id}`, disabled: value >= max, onclick: () => commit(current + 1) }, icon('chev-right', 'icon--sm'))
  );
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight + 2, 96) + 'px';
}

function catChip(catId) {
  const c = CAT_MAP[catId];
  return h('span', { class: `chip cat-chip cat-${catId}` }, h('span', { class: 'chip__dot' }), c ? c.nav : 'Custom');
}

function kpiChip(id) {
  const k = KPI_MAP[id];
  return k ? h('span', { class: 'kpi', title: k.hint }, k.label) : null;
}

function emptyState({ iconName, title, text, action }) {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__icon' }, icon(iconName || 'info')),
    h('p', { class: 'empty__title' }, title),
    text ? h('p', { class: 'empty__text' }, text) : null,
    action || null
  );
}

function pageHead({ eyebrow, title, sub, actions }) {
  return h(
    'div',
    { class: 'page-head' },
    h(
      'div',
      { class: 'page-head__text' },
      eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null,
      h('h1', { class: 'page-title', id: 'pageTitle' }, title),
      sub ? h('p', { class: 'page-sub' }, sub) : null
    ),
    actions ? h('div', { class: 'toolbar', style: 'margin:0' }, actions) : null
  );
}

/* Simple disclosure menu */
function menuButton({ label, iconName = 'more', items, fk, iconOnly = false }) {
  const menuId = uid('menu');
  const btn = iconOnly
    ? h('button', { type: 'button', class: 'btn btn--sm btn--icon', 'aria-label': label, title: label, 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': menuId, 'data-fk': fk }, icon(iconName))
    : h('button', { type: 'button', class: 'btn btn--sm', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': menuId, 'data-fk': fk }, icon(iconName), h('span', { class: 'btn__label' }, label));
  const menu = h('div', { class: 'menu', id: menuId, hidden: true });
  const wrap = h('div', { class: 'menu-wrap' }, btn, menu);
  const close = (focusBtn) => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside, true);
    if (focusBtn) btn.focus();
  };
  const outside = (e) => {
    if (!wrap.contains(e.target)) close(false);
  };
  items.forEach((it) => {
    const b = h('button', { type: 'button', class: 'menu__item' }, it.icon ? icon(it.icon) : null, it.label);
    b.addEventListener('click', () => {
      close(true);
      it.onSelect(btn);
    });
    menu.appendChild(b);
  });
  btn.addEventListener('click', () => {
    if (!menu.hidden) return close(false);
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', outside, true);
    const first = menu.querySelector('.menu__item');
    if (first) first.focus();
  });
  menu.addEventListener('keydown', (e) => {
    const list = $$('.menu__item', menu);
    const i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length].focus();
    } else if (e.key === 'Tab') close(false);
  });
  return wrap;
}
