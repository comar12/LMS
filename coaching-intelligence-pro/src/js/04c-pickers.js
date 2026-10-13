/* ==========================================================================
   04c-pickers: app-styled date, number, and color pickers. Every
   <input type="date">, <input type="number"> and <input type="color"> is
   enhanced automatically (see initFx), so new screens get them for free.
   The native input stays underneath with its value, events, and label, so
   the code that reads it does not change.
   ========================================================================== */

const INPUT_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

/** Keeps a visible label in step with a native input whose value is also set from code. */
function watchValue(input, sync) {
  Object.defineProperty(input, 'value', { configurable: true, get() { return INPUT_VALUE.get.call(this); }, set(v) { INPUT_VALUE.set.call(this, v); sync(); } });
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['min', 'max', 'disabled'] });
}
function setNativeValue(input, v, events = ['input', 'change']) {
  INPUT_VALUE.set.call(input, v);
  events.forEach((t) => input.dispatchEvent(new Event(t, { bubbles: true })));
}
/** A label pointing at the hidden input sends focus (and a click) to the visible button. */
function relabel(input, btn) {
  const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
  if (label) {
    if (!label.id) label.id = uid('lbl');
    btn.setAttribute('aria-labelledby', `${label.id} ${btn.id}`);
    label.addEventListener('click', (e) => {
      e.preventDefault();
      btn.focus();
    });
  } else if (input.getAttribute('aria-label')) btn.setAttribute('aria-label', input.getAttribute('aria-label'));
  return label;
}

/** Shared floating panel: top layer when the browser supports it, fixed under (or above) its button. */
function floatPanel(anchor, panel, { onClose }) {
  const wrap = anchor.parentNode;
  if (HAS_POPOVER) panel.setAttribute('popover', 'manual');
  wrap.appendChild(panel);
  if (HAS_POPOVER) panel.showPopover();
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth;
    const hgt = panel.offsetHeight;
    const below = window.innerHeight - r.bottom - 12;
    const up = below < hgt && r.top - 12 > below;
    panel.classList.toggle('is-up', up);
    panel.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - w - 12))}px`;
    panel.style.top = `${up ? Math.max(12, r.top - hgt - 6) : r.bottom + 6}px`;
  };
  place();
  let closed = false;
  const outside = (e) => {
    if (!wrap.contains(e.target) && !panel.contains(e.target)) close(false);
  };
  const onWin = (e) => {
    if (e.type === 'scroll' && panel.contains(e.target)) return;
    const r = anchor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) close(false);
    else place();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };
  function close(focusBack) {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', onWin);
    window.removeEventListener('scroll', onWin, true);
    panel.classList.add('is-leaving');
    setTimeout(() => {
      if (HAS_POPOVER && panel.matches(':popover-open')) panel.hidePopover();
      panel.remove();
    }, reducedMotion() ? 0 : 140);
    if (onClose) onClose();
    if (focusBack) anchor.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', onWin);
  window.addEventListener('scroll', onWin, true);
  panel.addEventListener('keydown', onKey);
  return { close, place };
}

/* ---------- Date ---------- */
const longDay = (iso) => parseDay(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fullDay = (iso) => parseDay(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function enhanceDate(input) {
  if (input._dpick || !input.isConnected) return;
  const hadFocus = document.activeElement === input;
  const valueEl = h('span', { class: 'dpick__value' });
  const btn = h('button', { type: 'button', class: 'dpick__btn', id: uid('dpick'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-fk': input.getAttribute('data-fk') || undefined }, h('span', { class: 'dpick__icon', 'aria-hidden': 'true' }, icon('calendar')), valueEl, icon('chev-down', 'pick__chev'));
  const wrap = h('span', { class: `dpick${input.classList.contains('eod-date') ? ' dpick--auto' : ''}` });
  input.parentNode.insertBefore(wrap, input);
  wrap.append(btn, input);
  input.classList.add('dpick__native');
  input.setAttribute('tabindex', '-1');
  input.setAttribute('aria-hidden', 'true');
  relabel(input, btn);
  const sync = () => {
    const v = INPUT_VALUE.get.call(input);
    valueEl.textContent = isIsoDate(v) ? longDay(v) : 'Choose a date';
    btn.disabled = input.disabled;
  };
  watchValue(input, sync);
  let panel = null;
  const inRange = (iso) => (!input.min || iso >= input.min) && (!input.max || iso <= input.max);
  const choose = (iso) => {
    if (!inRange(iso)) return;
    const changed = INPUT_VALUE.get.call(input) !== iso;
    if (panel) panel.close(true);
    if (changed) {
      setNativeValue(input, iso);
      wrap.classList.remove('is-picked');
      void wrap.offsetWidth;
      wrap.classList.add('is-picked');
    }
  };
  const open = () => {
    if (panel || input.disabled) return;
    const cur = INPUT_VALUE.get.call(input);
    let focus = isIsoDate(cur) ? cur : todayDay();
    if (!inRange(focus)) focus = input.max && focus > input.max ? input.max : input.min || focus;
    let month = focus.slice(0, 7);
    const titleId = uid('dp-title');
    const el = h('div', { class: 'dpick__pop', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': titleId });
    const draw = (dir) => {
      const first = parseDay(`${month}-01`);
      const start = addDays(`${month}-01`, -first.getDay());
      const sel = INPUT_VALUE.get.call(input);
      const today = todayDay();
      const prevMonth = isoDay(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7);
      const nextMonth = isoDay(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7);
      const canPrev = !input.min || `${prevMonth}-31` >= input.min;
      const canNext = !input.max || `${nextMonth}-01` <= input.max;
      const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
      const quick = [
        { label: 'Today', iso: today },
        { label: 'Yesterday', iso: addDays(today, -1) },
      ].filter((q) => inRange(q.iso));
      el.replaceChildren(
        h(
          'div',
          { class: 'dpick__head' },
          h('button', { type: 'button', class: 'dpick__nav', 'aria-label': 'Previous month', disabled: !canPrev, onclick: () => go(-1) }, icon('chev-left')),
          h('p', { class: 'dpick__title', id: titleId, 'aria-live': 'polite' }, first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
          h('button', { type: 'button', class: 'dpick__nav', 'aria-label': 'Next month', disabled: !canNext, onclick: () => go(1) }, icon('chev-right'))
        ),
        h(
          'div',
          { class: `dpick__grid${dir ? ` is-slide-${dir > 0 ? 'next' : 'prev'}` : ''}`, role: 'grid', 'aria-labelledby': titleId },
          h('div', { class: 'dpick__row dpick__row--wd', role: 'row' }, ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => h('span', { class: 'dpick__wd', role: 'columnheader', 'aria-label': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i] }, d))),
          Array.from({ length: 6 }, (_, w) =>
            h(
              'div',
              { class: 'dpick__row', role: 'row' },
              days.slice(w * 7, w * 7 + 7).map((iso) =>
                h(
                  'span',
                  { role: 'gridcell' },
                  h(
                    'button',
                    {
                      type: 'button',
                      class: `dpick__day${iso.slice(0, 7) !== month ? ' is-out' : ''}${iso === today ? ' is-today' : ''}${iso === sel ? ' is-sel' : ''}`,
                      tabindex: iso === focus ? '0' : '-1',
                      disabled: !inRange(iso),
                      'aria-label': fullDay(iso),
                      'aria-pressed': String(iso === sel),
                      'aria-current': iso === today ? 'date' : undefined,
                      'data-iso': iso,
                      onclick: () => choose(iso),
                    },
                    String(parseDay(iso).getDate())
                  )
                )
              )
            )
          )
        ),
        quick.length ? h('div', { class: 'dpick__foot' }, quick.map((q) => h('button', { type: 'button', class: `dpick__quick${q.iso === sel ? ' is-on' : ''}`, onclick: () => choose(q.iso) }, q.label)), h('span', { class: 'dpick__sel' }, isIsoDate(sel) ? longDay(sel) : '')) : null
      );
    };
    const focusDay = () => {
      const b = el.querySelector(`[data-iso="${focus}"]`);
      if (b) b.focus({ preventScroll: true });
    };
    const go = (n) => {
      const d = parseDay(`${month}-01`);
      month = isoDay(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7);
      const day = Math.min(parseDay(focus).getDate(), new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate());
      focus = `${month}-${String(day).padStart(2, '0')}`;
      draw(n);
    };
    const move = (iso) => {
      if ((input.min && iso < input.min) || (input.max && iso > input.max)) return;
      const dir = iso.slice(0, 7) > month ? 1 : iso.slice(0, 7) < month ? -1 : 0;
      focus = iso;
      month = iso.slice(0, 7);
      draw(dir);
      focusDay();
    };
    el.addEventListener('keydown', (e) => {
      if (!e.target.classList || !e.target.classList.contains('dpick__day')) return;
      const d = parseDay(focus);
      const keys = {
        ArrowLeft: () => move(addDays(focus, -1)),
        ArrowRight: () => move(addDays(focus, 1)),
        ArrowUp: () => move(addDays(focus, -7)),
        ArrowDown: () => move(addDays(focus, 7)),
        Home: () => move(addDays(focus, -d.getDay())),
        End: () => move(addDays(focus, 6 - d.getDay())),
        PageUp: () => move(isoDay(new Date(d.getFullYear() - (e.shiftKey ? 1 : 0), d.getMonth() - (e.shiftKey ? 0 : 1), Math.min(d.getDate(), 28)))),
        PageDown: () => move(isoDay(new Date(d.getFullYear() + (e.shiftKey ? 1 : 0), d.getMonth() + (e.shiftKey ? 0 : 1), Math.min(d.getDate(), 28)))),
      };
      if (keys[e.key]) {
        e.preventDefault();
        keys[e.key]();
      }
    });
    draw(0);
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    panel = floatPanel(btn, el, {
      onClose: () => {
        panel = null;
        btn.setAttribute('aria-expanded', 'false');
        wrap.classList.remove('is-open');
      },
    });
    focusDay();
  };
  btn.addEventListener('click', () => (panel ? panel.close(true) : open()));
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !panel) {
      e.preventDefault();
      open();
    }
  });
  input._dpick = { btn, sync };
  sync();
  if (hadFocus) btn.focus({ preventScroll: true });
}

/* ---------- Number ---------- */
function enhanceNumber(input) {
  if (input._nstep || !input.isConnected || input.closest('.stepper')) return;
  const hadFocus = document.activeElement === input;
  const name = (() => {
    const l = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    return (l && l.textContent.trim()) || input.getAttribute('aria-label') || 'value';
  })();
  const step = (dir) => {
    const before = INPUT_VALUE.get.call(input);
    try {
      if (before === '') INPUT_VALUE.set.call(input, input.min || '0');
      else if (dir > 0) input.stepUp();
      else input.stepDown();
    } catch (e) {
      return;
    }
    if (INPUT_VALUE.get.call(input) !== before) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      wrap.classList.remove('is-bump');
      void wrap.offsetWidth;
      wrap.classList.add('is-bump');
    }
    sync();
    // A button that just reached its limit is disabled: keep focus in the field instead of losing it.
    if (document.activeElement === document.body || (document.activeElement && document.activeElement.disabled)) input.focus({ preventScroll: true });
  };
  const minus = h('button', { type: 'button', class: 'nstep__btn', tabindex: '-1', 'aria-label': `Decrease ${name}`, onclick: () => step(-1) }, h('span', { 'aria-hidden': 'true' }, '−'));
  const plus = h('button', { type: 'button', class: 'nstep__btn', tabindex: '-1', 'aria-label': `Increase ${name}`, onclick: () => step(1) }, icon('plus'));
  const wrap = h('span', { class: `nstep${input.classList.contains('hub-target') ? ' nstep--sm' : ''}` });
  input.parentNode.insertBefore(wrap, input);
  wrap.append(minus, input, plus);
  input.classList.add('nstep__input');
  const sync = () => {
    const v = Number(INPUT_VALUE.get.call(input));
    minus.disabled = input.disabled || (input.min !== '' && v <= Number(input.min));
    plus.disabled = input.disabled || (input.max !== '' && v >= Number(input.max));
  };
  watchValue(input, sync);
  input._nstep = true;
  sync();
  if (hadFocus) input.focus({ preventScroll: true });
}

/* ---------- Color ---------- */
const COLOR_SWATCHES = ['#c8102e', '#e4002b', '#d9480f', '#f59f00', '#ffd100', '#2b8a3e', '#0f766e', '#0e7490', '#1f69ff', '#1d4ed8', '#4338ca', '#6138f5', '#7c3aed', '#a21caf', '#1d1d1b', '#334155', '#64748b', '#f2f2f2'];
function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (hue * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h: hh, s, v }) {
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function enhanceColor(input) {
  if (input._cpick || !input.isConnected) return;
  const hadFocus = document.activeElement === input;
  const chip = h('span', { class: 'cpick__chip', 'aria-hidden': 'true' });
  const hexEl = h('span', { class: 'cpick__hex' });
  const btn = h('button', { type: 'button', class: 'cpick__btn', id: uid('cpick'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-fk': input.getAttribute('data-fk') || undefined }, chip, hexEl, icon('chev-down', 'pick__chev'));
  const wrap = h('span', { class: 'cpick' });
  input.parentNode.insertBefore(wrap, input);
  wrap.append(btn, input);
  input.classList.add('cpick__native');
  input.setAttribute('tabindex', '-1');
  input.setAttribute('aria-hidden', 'true');
  relabel(input, btn);
  if (input.getAttribute('aria-describedby')) btn.setAttribute('aria-describedby', input.getAttribute('aria-describedby'));
  const sync = () => {
    const v = INPUT_VALUE.get.call(input) || '#000000';
    chip.style.background = v;
    hexEl.textContent = v.toUpperCase();
  };
  watchValue(input, sync);
  let panel = null;
  const open = () => {
    if (panel || input.disabled) return;
    let hsv = hexToHsv(INPUT_VALUE.get.call(input) || '#000000');
    const start = INPUT_VALUE.get.call(input);
    const svThumb = h('span', { class: 'cpick__thumb' });
    const sv = h('div', { class: 'cpick__sv', role: 'slider', tabindex: '0', 'aria-label': 'Saturation and brightness', 'aria-valuetext': '' }, svThumb);
    const hueThumb = h('span', { class: 'cpick__thumb cpick__thumb--hue' });
    const hue = h('div', { class: 'cpick__hue', role: 'slider', tabindex: '0', 'aria-label': 'Hue', 'aria-valuemin': '0', 'aria-valuemax': '360' }, hueThumb);
    const hexIn = h('input', { class: 'input cpick__hexin', type: 'text', maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Hex code' });
    const preview = h('span', { class: 'cpick__preview', 'aria-hidden': 'true' });
    const apply = (live = true) => {
      const hex = hsvToHex(hsv);
      sv.style.setProperty('--hue', String(Math.round(hsv.h)));
      svThumb.style.left = `${hsv.s * 100}%`;
      svThumb.style.top = `${(1 - hsv.v) * 100}%`;
      svThumb.style.background = hex;
      hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
      hue.setAttribute('aria-valuenow', String(Math.round(hsv.h)));
      sv.setAttribute('aria-valuetext', `Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`);
      preview.style.background = hex;
      if (document.activeElement !== hexIn) hexIn.value = hex.toUpperCase();
      if (live && hex !== INPUT_VALUE.get.call(input)) setNativeValue(input, hex, ['input']);
    };
    const drag = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const at = (ev) => {
          const r = el.getBoundingClientRect();
          fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
          apply();
        };
        at(e);
        const mv = (ev) => at(ev);
        const up = () => {
          el.removeEventListener('pointermove', mv);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', mv);
        el.addEventListener('pointerup', up);
        el.focus({ preventScroll: true });
      });
    };
    drag(sv, (x, y) => {
      hsv = { ...hsv, s: x, v: 1 - y };
    });
    drag(hue, (x) => {
      hsv = { ...hsv, h: x * 360 };
    });
    sv.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 0.1 : 0.02;
      const k = { ArrowLeft: ['s', -d], ArrowRight: ['s', d], ArrowUp: ['v', d], ArrowDown: ['v', -d] }[e.key];
      if (!k) return;
      e.preventDefault();
      hsv = { ...hsv, [k[0]]: Math.max(0, Math.min(1, hsv[k[0]] + k[1])) };
      apply();
    });
    hue.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 30 : 5;
      const k = { ArrowLeft: -d, ArrowDown: -d, ArrowRight: d, ArrowUp: d }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      hsv = { ...hsv, h: (hsv.h + k + 360) % 360 };
      apply();
    });
    hexIn.addEventListener('input', () => {
      const v = hexIn.value.trim();
      const m = /^#?([0-9a-f]{6})$/i.exec(v);
      hexIn.classList.toggle('is-invalid', !m && v.length >= 6);
      if (m) {
        hsv = hexToHsv(`#${m[1].toLowerCase()}`);
        apply();
      }
    });
    hexIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        panel.close(true);
      }
    });
    const swatches = h(
      'div',
      { class: 'cpick__swatches', role: 'group', 'aria-label': 'Preset colors' },
      COLOR_SWATCHES.map((c) =>
        h('button', {
          type: 'button',
          class: 'cpick__sw',
          style: `--c:${c}`,
          'aria-label': `Use ${c.toUpperCase()}`,
          onclick: () => {
            hsv = hexToHsv(c);
            apply();
          },
        })
      )
    );
    const eye =
      typeof window.EyeDropper === 'function'
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn btn--sm btn--icon cpick__eye',
              'aria-label': 'Pick a color from the screen',
              title: 'Pick a color from the screen',
              onclick: async () => {
                try {
                  const res = await new window.EyeDropper().open();
                  if (res && /^#[0-9a-f]{6}$/i.test(res.sRGBHex)) {
                    hsv = hexToHsv(res.sRGBHex.toLowerCase());
                    apply();
                  }
                } catch (e) {
                  /* cancelled */
                }
              },
            },
            icon('pipette')
          )
        : null;
    const el = h(
      'div',
      { class: 'cpick__pop', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Choose a color' },
      sv,
      hue,
      swatches,
      h('div', { class: 'cpick__row' }, preview, hexIn, eye),
      h('div', { class: 'cpick__foot' }, h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: () => { hsv = hexToHsv(start); apply(); panel.close(true); } }, 'Cancel'), h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: () => panel.close(true) }, icon('check'), 'Done'))
    );
    apply(false);
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    panel = floatPanel(btn, el, {
      onClose: () => {
        panel = null;
        btn.setAttribute('aria-expanded', 'false');
        wrap.classList.remove('is-open');
        if (INPUT_VALUE.get.call(input) !== start) input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    sv.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => (panel ? panel.close(true) : open()));
  input._cpick = true;
  sync();
  if (hadFocus) btn.focus({ preventScroll: true });
}

function enhancePickers(root) {
  if (!root.querySelectorAll) return;
  const all = (sel, fn) => {
    if (root.matches && root.matches(sel)) fn(root);
    root.querySelectorAll(sel).forEach(fn);
  };
  all('input[type="date"]', enhanceDate);
  all('input[type="number"]', enhanceNumber);
  all('input[type="color"]', enhanceColor);
}
