/* ==========================================================================
   10b-brand: brand colors (for example, your official VXI colors).
   Any two colors produce an accessible theme: text and button colors are
   adjusted automatically to keep WCAG AA contrast in light and dark modes.
   ========================================================================== */

const DEFAULT_BRAND = Object.freeze({ primary: '#0b7a75', sidebar: '#0b1630' });
const C_WHITE = { r: 255, g: 255, b: 255 };
const C_BLACK = { r: 0, g: 0, b: 0 };
const C_INK = { r: 14, g: 23, b: 38 };
const C_DARK_SURFACE = { r: 16, g: 26, b: 44 };
const C_DARK_BG = { r: 10, g: 17, b: 32 };

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function toHex(c) {
  return '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function normHex(v) {
  const s = String(v || '').trim().replace(/^#?/, '#');
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
}
function mixRgb(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function rgba(c, a) {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${a})`;
}
function relLum(c) {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrastRatio(a, b) {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** Move a color toward black or white just far enough to reach the target contrast against a background. */
function towardContrast(color, bg, target, dir) {
  for (let i = 0; i <= 40; i++) {
    const c = mixRgb(color, dir, i / 40);
    if (contrastRatio(c, bg) >= target) return c;
  }
  return dir;
}

function sidebarScheme(S, P) {
  const lightText = contrastRatio(C_WHITE, S) >= 4.5;
  if (lightText) {
    const text = towardContrast(mixRgb(C_WHITE, S, 0.18), S, 7, C_WHITE);
    const muted = towardContrast(mixRgb(C_WHITE, S, 0.42), S, 4.6, C_WHITE);
    const accent = towardContrast(P, S, 3.2, C_WHITE);
    return {
      bg: S,
      bg2: mixRgb(S, C_WHITE, 0.05),
      text,
      strong: C_WHITE,
      muted,
      hover: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.08)',
      accent,
      accentInk: contrastRatio(C_INK, accent) >= 4.5 ? C_INK : C_WHITE,
      active: rgba(accent, 0.16),
      focus: '#9cc0ff',
    };
  }
  const muted = towardContrast(mixRgb(C_INK, S, 0.42), S, 4.6, C_BLACK);
  const accent = towardContrast(P, S, 3.2, C_BLACK);
  return {
    bg: S,
    bg2: mixRgb(S, C_BLACK, 0.04),
    text: towardContrast(mixRgb(C_INK, S, 0.12), S, 7, C_BLACK),
    strong: C_INK,
    muted,
    hover: 'rgba(0, 0, 0, 0.05)',
    border: 'rgba(0, 0, 0, 0.08)',
    accent,
    accentInk: contrastRatio(C_WHITE, accent) >= 4.5 ? C_WHITE : C_INK,
    active: rgba(accent, 0.14),
    focus: '#1d4fd8',
  };
}

/** Compute every themed value from the two brand colors. */
function brandTokens(brand) {
  const P = parseHex(brand.primary);
  const S = parseHex(brand.sidebar);
  if (!P || !S) return null;
  // Light theme: keep the brand color for buttons whenever readable text exists for it.
  let accent = P;
  let ink = contrastRatio(C_WHITE, P) >= 4.5 ? C_WHITE : contrastRatio(C_INK, P) >= 4.5 ? C_INK : null;
  if (!ink) {
    accent = towardContrast(P, C_WHITE, 4.5, C_BLACK);
    ink = C_WHITE;
  }
  const soft = mixRgb(accent, C_WHITE, 0.88);
  const light = {
    accent,
    ink,
    hover: ink === C_WHITE ? mixRgb(accent, C_BLACK, 0.15) : mixRgb(accent, C_WHITE, 0.2),
    soft,
    text: towardContrast(P, soft, 4.8, C_BLACK),
    side: sidebarScheme(S, P),
  };
  // Dark theme: lighten the brand color until it reads on dark surfaces; darken the sidebar.
  const dAccent = towardContrast(P, C_DARK_SURFACE, 4.8, C_WHITE);
  const dSide = relLum(S) > 0.2 ? mixRgb(S, C_DARK_BG, 0.82) : mixRgb(S, C_BLACK, 0.3);
  const dark = {
    accent: dAccent,
    ink: contrastRatio(C_INK, dAccent) >= 4.5 ? C_INK : C_WHITE,
    hover: mixRgb(dAccent, C_WHITE, 0.15),
    soft: rgba(dAccent, 0.13),
    text: towardContrast(P, C_DARK_SURFACE, 5.5, C_WHITE),
    side: sidebarScheme(dSide, P),
  };
  return {
    light,
    dark,
    report: {
      button: contrastRatio(light.ink, light.accent),
      link: contrastRatio(light.text, C_WHITE),
      nav: contrastRatio(light.side.text, light.side.bg),
      buttonAdjusted: toHex(accent) !== toHex(P),
    },
  };
}

function tokenBlock(t) {
  const s = t.side;
  const c = (v) => (typeof v === 'string' ? v : toHex(v));
  return [
    `--accent:${c(t.accent)}`,
    `--accent-hover:${c(t.hover)}`,
    `--accent-ink:${c(t.ink)}`,
    `--accent-soft:${c(t.soft)}`,
    `--accent-text:${c(t.text)}`,
    `--sidebar-bg:${c(s.bg)}`,
    `--sidebar-bg-2:${c(s.bg2)}`,
    `--sidebar-text:${c(s.text)}`,
    `--sidebar-strong:${c(s.strong)}`,
    `--sidebar-muted:${c(s.muted)}`,
    `--sidebar-hover:${s.hover}`,
    `--sidebar-border:${s.border}`,
    `--sidebar-accent:${c(s.accent)}`,
    `--sidebar-accent-ink:${c(s.accentInk)}`,
    `--sidebar-active:${s.active}`,
    `--sidebar-focus:${s.focus}`,
  ].join(';');
}

function brandCss(brand) {
  const tokens = brandTokens(brand);
  if (!tokens) return '';
  const light = tokenBlock(tokens.light);
  const dark = tokenBlock(tokens.dark);
  // "html:root" outranks the base ":root" rules regardless of stylesheet order.
  return `html:root{${light}}html:root[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){html:root:not([data-theme="light"]){${dark}}}`;
}

/** Apply (or remove) the brand theme and cache the CSS so the next load starts with it. */
function applyBrand() {
  let el = document.getElementById('brand-style');
  const brand = state.prefs.brand;
  if (!brand) {
    if (el) el.remove();
    store.remove('brandcss');
    return;
  }
  const css = brandCss(brand);
  if (!el) {
    el = document.createElement('style');
    el.id = 'brand-style';
    document.head.appendChild(el);
  }
  el.textContent = css;
  store.set('brandcss', css);
}

const persistPrefsSoon = debounce(() => persist('prefs'), 300);

function brandCard() {
  const current = state.prefs.brand || DEFAULT_BRAND;
  const report = h('div', { class: 'brand-report', role: 'status', 'aria-live': 'polite' });
  const badge = h('span', { class: `badge ${state.prefs.brand ? 'badge--success' : 'badge--custom'}` }, state.prefs.brand ? 'Custom' : 'Default');
  const resetBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--sm',
      'data-fk': 'brand-reset',
      disabled: !state.prefs.brand,
      onclick: () => {
        state.prefs.brand = null;
        applyBrand();
        persist('prefs');
        refresh();
        toast('Default colors restored');
      },
    },
    icon('refresh'),
    'Reset to default colors'
  );
  const drawReport = () => {
    const t = brandTokens(state.prefs.brand || DEFAULT_BRAND);
    if (!t) return;
    const r = t.report;
    const row = (label, ratio) => h('span', { class: 'brand-report__item' }, h('span', { class: 'brand-report__pass' }, ratio >= 4.5 ? 'AA' : 'Low'), `${label} ${ratio.toFixed(1)}:1`);
    const items = [row('Button text', r.button), row('Link text', r.link), row('Navigation text', r.nav)];
    if (r.buttonAdjusted) items.push(h('span', { class: 'brand-report__note' }, 'Buttons use a slightly deeper shade of your primary color so their text stays readable.'));
    report.replaceChildren(...items);
  };
  const update = (key, value) => {
    const v = normHex(value);
    if (!v) return false;
    state.prefs.brand = { ...(state.prefs.brand || DEFAULT_BRAND), [key]: v };
    applyBrand();
    persistPrefsSoon();
    drawReport();
    resetBtn.disabled = false;
    badge.className = 'badge badge--success';
    badge.textContent = 'Custom';
    return true;
  };
  const row = (key, label, hint) => {
    const id = `brand-${key}`;
    const picker = h('input', { type: 'color', class: 'brand-swatch', id, value: current[key], 'aria-describedby': `${id}-hint`, 'data-fk': id });
    const hex = h('input', { type: 'text', class: 'input brand-hex', value: current[key].toUpperCase(), maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': `${label} hex code`, 'data-fk': `${id}-hex` });
    picker.addEventListener('input', () => {
      hex.value = picker.value.toUpperCase();
      hex.classList.remove('is-invalid');
      update(key, picker.value);
    });
    // Save right away when the color picker closes (input events above are debounced).
    picker.addEventListener('change', () => persistPrefsSoon.flush());
    const fromHex = () => {
      const v = normHex(hex.value);
      if (!v) {
        hex.classList.add('is-invalid');
        return;
      }
      hex.classList.remove('is-invalid');
      hex.value = v.toUpperCase();
      picker.value = v;
      update(key, v);
      persistPrefsSoon.flush();
    };
    hex.addEventListener('change', fromHex);
    hex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fromHex();
      }
    });
    const pick =
      typeof window.EyeDropper === 'function'
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn btn--sm',
              'aria-label': `Pick the ${label.toLowerCase()} from anywhere on screen`,
              'data-fk': `${id}-pick`,
              onclick: async () => {
                try {
                  const res = await new window.EyeDropper().open();
                  const v = normHex(res && res.sRGBHex);
                  if (v) {
                    picker.value = v;
                    hex.value = v.toUpperCase();
                    update(key, v);
                    persistPrefsSoon.flush();
                  }
                } catch (e) {
                  /* picker cancelled */
                }
              },
            },
            icon('pipette'),
            'Pick from screen'
          )
        : null;
    return h(
      'div',
      { class: 'brand-row' },
      h('label', { class: 'setting__label', for: id }, label),
      h('div', { class: 'brand-row__controls' }, picker, hex, pick),
      h('p', { class: 'field__hint', id: `${id}-hint` }, hint)
    );
  };
  drawReport();
  return h(
    'section',
    { class: 'card', 'aria-label': 'Brand colors' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title' }, icon('sparkle'), 'Brand colors'), badge),
    h(
      'div',
      { class: 'card__body' },
      h('p', { class: 'prose' }, 'Set your official VXI colors here (from the VXI brand guide, a VXI presentation template, or the logo). The whole app updates as you choose, and text colors adjust automatically so everything stays readable in light and dark mode.'),
      row('primary', 'Primary color', 'Buttons, highlights, and selected items.'),
      row('sidebar', 'Navigation color', 'The navigation sidebar background.'),
      typeof window.EyeDropper === 'function'
        ? h('p', { class: 'hint' }, icon('info'), 'Tip: open the VXI logo on screen (for example, in your email signature or intranet), then use Pick from screen and click the logo color.')
        : h('p', { class: 'hint' }, icon('info'), 'Tip: in Chrome or Edge, the color picker includes an eyedropper, so you can sample the VXI logo directly from the screen.'),
      report,
      h('div', { class: 'data-row' }, resetBtn)
    )
  );
}
