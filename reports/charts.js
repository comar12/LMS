/* charts.js — dependency-free inline-SVG chart library (ES2020, no build). Exposes window.Charts.
   Colours come only from host CSS custom properties (--s1…--s5, --other, --good, --bad, --warn,
   --text, --muted, --line, --grid, --card, --soft, --heat1…--heat7).
   Motion: every entrance is a finite Web Animation created synchronously inside the render call
   (fill: backwards, staggered with `delay`), so a host can pause/play them all through
   container.getAnimations({ subtree: true }). Gridlines and axis labels fade in first, then the data;
   each chart settles in about 1.2 s and no stagger spans more than 450 ms. prefers-reduced-motion
   skips all of it — the static render is complete on its own. */
(function () {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SER = ['s1','s2','s3','s4','s5'];
let FONT = 'sans-serif', ctx, UID = 0, LIVE = false;

/* ---------- motion vocabulary ---------- */
/* cubic-bezier easing that JS can evaluate too, so marks can be timed to where a line's pen is */
function bezier(x1, y1, x2, y2) {
  const B = (a, b, u) => ((1 + 3 * a - 3 * b) * u + 3 * b - 6 * a) * u * u + 3 * a * u;
  const inv = (f, v) => { let lo = 0, hi = 1; for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (f(mid) < v) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const X = u => B(x1, x2, u), Y = u => B(y1, y2, u);
  return { css: `cubic-bezier(${x1},${y1},${x2},${y2})`,
    y: t => t <= 0 ? 0 : t >= 1 ? 1 : Y(inv(X, t)),    // eased progress at time fraction t
    t: p => p <= 0 ? 0 : p >= 1 ? 1 : X(inv(Y, p)) };  // time fraction at which progress reaches p
}
const EZ = {
  out: bezier(.22, 1, .36, 1),   // quint-out: grows, pops, slides — quick start, long soft settle, no overshoot
  fade: bezier(.4, 0, .2, 1),    // standard curve for opacity
  draw: bezier(.45, 0, .2, 1),   // gentle in-out: line draws, reference lines, stacked fills
  halo: bezier(.2, .6, .35, 1)   // soft pulse
};
const EASE = EZ.out.css;
/* durations / delays (ms). chrome = gridlines + axis labels; data marks start at `data`. */
const MS = { chrome: 250, data: 200, grow: 420, draw: 640, ref: 480, pop: 240, fade: 240, wash: 420, cell: 380, halo: 720, stagger: 320, hover: 150 };
const DIM = .4;   // opacity of the non-hovered categories

/* ---------- shared helpers ---------- */
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const motion = () => !reduced() && typeof Element !== 'undefined' && !!Element.prototype.animate;
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, x, y, str, o) {
  o = o || {};
  const t = el('text', { x, y, 'font-size': o.size || 11, fill: o.fill || 'var(--muted)', 'text-anchor': o.anchor || 'start',
    'dominant-baseline': o.base, 'font-weight': o.weight, stroke: o.halo ? 'var(--card)' : null, 'stroke-width': o.halo ? 3 : null, 'paint-order': o.halo ? 'stroke' : null }, parent);
  t.textContent = str;
  return t;
}
function measure(str, size, weight) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = (weight || 400) + ' ' + (size || 11) + 'px ' + FONT;
  return ctx.measureText(String(str)).width;
}
/* no colour given: series 0 is the neutral ink (a non-product measure), later series fall back to the old --s ramp */
const col = (c, i) => !c ? (i ? 'var(--' + SER[i % 5] + ')' : 'var(--ink,var(--text))') : /^(var\(|#|rgb|hsl)/.test(c) ? c : 'var(--' + c + ')';
const fmt = v => {
  if (v == null || isNaN(v)) return '–';
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
    : (Math.round(v * 10) / 10).toLocaleString('en-US');
};
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const sd = s => isISO(s) ? s.slice(8, 10) + '-' + MON[+s.slice(5, 7) - 1] : s;   // '16-Oct', like the dashboard's fds
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const tt = s => isISO(s) ? DOW[dow(s)] + ' ' + sd(s) : s;   // tooltip / table title: 'Tue 20-Oct'
/* tick labels: decimals follow the tick step (0.5 -> 1 dp), and a custom format loses a trailing '.0' ('15.0' -> '15') */
const tickFmt = step => { const d = Math.max(0, -Math.floor(Math.log10(Math.abs(step) || 1))); return v => (+v).toLocaleString('en-US', { maximumFractionDigits: d }); };
const tickLab = (f, ticks) => { const tf = tickFmt(ticks.length > 1 ? ticks[1] - ticks[0] : 1); return t => f === fmt && Math.abs(t) < 1e3 ? tf(t) : String(f(t)).replace(/\.0+(?=\D*$)/, ''); };
const heat = t => 'var(--heat' + Math.max(1, Math.min(7, Math.ceil(t * 7))) + ')';
/* nice tick values: steps of 1, 2, 2.5 (only >= 25), 5 × 10^k */
function niceTicks(min, max, n) {
  n = n || 5;
  if (min > max) { const t = min; min = max; max = t; }
  if (min === max) max = min + 1;
  const raw = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : (f <= 2.5 && p >= 10) ? 2.5 : f <= 5 ? 5 : 10) * p;
  const lo = Math.floor(min / step) * step, k = Math.round((Math.ceil(max / step) * step - lo) / step), out = [];
  for (let i = 0; i <= k; i++) out.push(+(lo + i * step).toFixed(10));
  return out;
}
/* push label y positions apart by >= gap within [lo, hi], each staying as near its own anchor as it can: labels that
   would overlap merge into a cluster centred on its anchors' mean (clamped to [lo, hi]), repeated until none overlap */
function pushApart(ys, gap, lo, hi) {
  const out = ys.slice(), C = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]).map(i => ({ m: [i], s: ys[i] }));
  const place = c => { const span = (c.m.length - 1) * gap; c.top = Math.max(lo, Math.min(hi - span, c.s / c.m.length - span / 2)); };
  C.forEach(place);
  for (let k = 1; k < C.length;) {
    const a = C[k - 1], b = C[k];
    if (a.top + a.m.length * gap > b.top + 1e-6) { a.m = a.m.concat(b.m); a.s += b.s; place(a); C.splice(k, 1); k = Math.max(1, k - 1); } else k++;
  }
  C.forEach(c => c.m.forEach((i, j) => { out[i] = c.top + j * gap; }));
  return out;
}
/* bar outline with a 4px rounded data-end and a square baseline end */
function barPath(x, y, w, h, r, end) {
  if (h <= 0 || w <= 0) return '';
  r = Math.min(r, w / 2, h / 2);
  const X = x + w, Y = y + h;
  if (end === 'top') return `M${x},${Y}V${y + r}a${r},${r} 0 0 1 ${r},-${r}H${X - r}a${r},${r} 0 0 1 ${r},${r}V${Y}Z`;
  if (end === 'bottom') return `M${x},${y}H${X}V${Y - r}a${r},${r} 0 0 1 -${r},${r}H${x + r}a${r},${r} 0 0 1 -${r},-${r}Z`;
  if (end === 'right') return `M${x},${y}H${X - r}a${r},${r} 0 0 1 ${r},${r}V${Y - r}a${r},${r} 0 0 1 -${r},${r}H${x}Z`;
  return `M${X},${y}V${Y}H${x + r}a${r},${r} 0 0 1 -${r},-${r}V${y + r}a${r},${r} 0 0 1 ${r},-${r}Z`;
}
/* line path from [x,y] points; null points break the line */
function linePath(pts) {
  let d = '', pen = false;
  pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); pen = true; });
  return d;
}

/* ---------- animation (Web Animations API, created synchronously; skipped under prefers-reduced-motion) ---------- */
function anim(n, frames, o) {
  if (!LIVE || !n.animate) return null;
  try { return n.animate(frames, Object.assign({ duration: 700, easing: EASE, fill: 'backwards' }, o)); } catch (e) { return null; }
}
/* delay of mark i of n: `per` ms apart, but the whole run never spans more than `cap` (MS.stagger) */
const stag = (i, n, per, cap) => n > 1 ? i * Math.min(per, (cap == null ? MS.stagger : cap) / (n - 1)) : 0;
function box(n, origin) { n.style.transformBox = 'fill-box'; n.style.transformOrigin = origin; }
function fade(n, delay, dur, dx, dy) {
  const slide = dx || dy;
  if (LIVE) anim(n, slide ? [{ opacity: 0, transform: `translate(${dx || 0}px,${dy || 0}px)` }, { opacity: 1, transform: 'translate(0px,0px)' }] : [{ opacity: 0 }, { opacity: 1 }],
    { duration: dur || MS.fade, delay: delay || 0, easing: slide ? EZ.out.css : EZ.fade.css });
  return n;
}
const chrome = parent => fade(el('g', null, parent), 0, MS.chrome);   // gridlines + axis labels: first in
function grow(n, origin, axis, delay, dur) {
  if (LIVE) { box(n, origin); anim(n, [{ transform: axis + '(0)' }, { transform: axis + '(1)' }], { duration: dur || MS.grow, delay: delay || 0 }); }
  return n;
}
/* stacked segment: scales from its base while one eased edge sweeps the column from fraction c0 to c1 */
function growSpan(n, origin, delay, dur, c0, c1) {
  if (!LIVE) return n;
  box(n, origin);
  const E = EZ.draw, t0 = E.t(c0), t1 = E.t(c1), fr = [{ transform: 'scaleY(0)', offset: 0 }];
  for (let k = 0; k <= 6; k++) {
    const t = t0 + (t1 - t0) * k / 6, s = Math.max(0, Math.min(1, (E.y(t) - c0) / ((c1 - c0) || 1)));
    fr.push({ transform: `scaleY(${s.toFixed(4)})`, offset: Math.min(1, +t.toFixed(4)) });
  }
  fr.push({ transform: 'scaleY(1)', offset: 1 });
  anim(n, fr, { duration: dur, delay, easing: 'linear' });
  return n;
}
function pop(n, delay, dur) {
  if (LIVE) { box(n, 'center'); anim(n, [{ transform: 'scale(0)', opacity: 0 }, { opacity: 1, offset: .35 }, { transform: 'scale(1)', opacity: 1 }], { duration: dur || MS.pop, delay: delay || 0 }); }
  return n;
}
/* heat cell: scale from its centre plus fade */
function ripple(n, delay) {
  if (LIVE) { box(n, 'center'); anim(n, [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1)' }], { duration: MS.cell, delay }); }
  return n;
}
/* dash list equal to `dash` (or solid) along [0, L] followed by a long gap: stroke-dashoffset L - len shows
   exactly [0, len], so animating it from L+3 to 0 reveals the stroke from its start and lands exactly on the
   static pattern (no dash snap, nothing left to clean up when the animation ends) */
function dashSeq(dash, L) {
  let pat = dash ? String(dash).trim().split(/[\s,]+/).map(Number).filter(v => isFinite(v) && v >= 0) : [];
  if (!pat.some(v => v > 0)) return +L.toFixed(3) + ' ' + +(L + 6).toFixed(3);
  if (pat.length % 2) pat = pat.concat(pat);
  const out = []; let s = 0;
  for (let i = 0; s < L; i++) { const v = Math.min(pat[i % pat.length], L - s); out.push(v); s += v; }
  if (out.length % 2) out.push(L + 6); else out[out.length - 1] += L + 6;
  return out.map(v => +v.toFixed(3)).join(' ');
}
/* draw a stroke of length L in (honours the element's own stroke-dasharray) */
function draw(n, L, delay, dur, ez) {
  if (!LIVE || !(L > 0)) return n;
  const da = dashSeq(n.getAttribute('stroke-dasharray'), L);
  anim(n, [{ strokeDasharray: da, strokeDashoffset: L + 3 }, { strokeDasharray: da, strokeDashoffset: 0 }], { duration: dur, delay: delay || 0, easing: (ez || EZ.draw).css });
  return n;
}
/* x-paced pen: draws a series (points or nulls) so its tip's x follows one eased clock across [xa, xb].
   Lines sharing a clock stay in step; at(x) is when the tip passes x, for syncing markers and labels. */
function pen(g, pts, attrs, xa, xb, delay, dur, dash) {
  const runs = []; let run = [];
  pts.forEach(p => { if (p) run.push([+p[0].toFixed(1), +p[1].toFixed(1)]); else if (run.length) { runs.push(run); run = []; } });
  if (run.length) runs.push(run);
  const span = (xb - xa) || 1, E = EZ.draw;
  const at = xx => delay + E.t(Math.max(0, Math.min(1, (xx - xa) / span))) * dur;
  const paths = runs.map(r => {
    const p = el('path', Object.assign({ d: linePath(r) }, attrs, { 'stroke-dasharray': dash || null }), g);
    if (!LIVE || r.length < 2) return p;
    const cum = [0];
    for (let i = 1; i < r.length; i++) cum.push(cum[i - 1] + Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]));
    const L = cum[cum.length - 1], z = r.length - 1;
    if (!(L > 0)) return p;
    const lenAt = X => {   // run coordinates are rounded to 0.1px, hence the 0.06 tolerance at the ends
      if (X <= r[0][0] + .06) return 0;
      if (X >= r[z][0] - .06) return L;
      let lo = 0, hi = z;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r[mid][0] <= X) lo = mid; else hi = mid; }
      const dx = r[hi][0] - r[lo][0];
      return cum[lo] + (dx ? (X - r[lo][0]) / dx : 0) * (cum[hi] - cum[lo]);
    };
    const K = 40, fr = [];
    for (let k = 0; k <= K; k++) { const len = lenAt(xa + E.y(k / K) * span); fr.push({ strokeDashoffset: len > .01 ? +(L - len).toFixed(3) : L + 3, offset: k / K }); }
    fr[0].strokeDasharray = fr[K].strokeDasharray = dashSeq(dash, L);
    anim(p, fr, { duration: dur, delay, easing: 'linear' });
    return p;
  });
  return { paths, at };
}
/* reveal a fill spanning x0..x1 left-to-right on the same clock as a pen(), easing its opacity in as it goes
   (clip-path is relative to the element's own box; where it can't animate, this is a plain fade) */
function wipe(n, x0, x1, xa, xb, delay, dur) {
  if (!LIVE || !(x1 > x0)) return n;
  const E = EZ.draw, span = (xb - xa) || 1, K = 24, fr = [];
  for (let k = 0; k <= K; k++) { const X = xa + E.y(k / K) * span; fr.push({ clipPath: `inset(0px ${Math.max(0, Math.min(x1 - x0, x1 - X)).toFixed(1)}px 0px 0px)`, offset: k / K }); }
  anim(n, fr, { duration: dur, delay, easing: 'linear' });
  anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: dur * .5, delay, easing: EZ.fade.css });
  return n;
}
/* two soft pulses from a series' end dot once its line has landed (finite; invisible when static) */
function halo(g, cx, cy, c, delay) {
  if (!LIVE) return;
  const n = el('circle', { cx, cy, r: 13, fill: 'none', stroke: c, 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' }, g);
  box(n, 'center');
  anim(n, [{ transform: 'scale(0.3077)', opacity: .35 }, { transform: 'scale(1)', opacity: 0 }], { duration: MS.halo, delay, iterations: 2, fill: 'none', easing: EZ.halo.css });
}
/* hover focus: the hovered category keeps full strength, the others dim */
function focus(groups) {
  if (motion()) groups.forEach(ns => ns.forEach(n => { n.style.transition = 'opacity ' + MS.hover + 'ms ease'; }));
  return {
    on: i => groups.forEach((ns, j) => ns.forEach(n => { n.style.opacity = j === i ? '' : DIM; })),
    off: () => groups.forEach(ns => ns.forEach(n => { n.style.opacity = ''; }))
  };
}
/* vertical area gradient in the series colour: ~.22 at the plot top fading to ~.02 at the baseline */
function wash(B, c, y0, y1) {
  const id = 'cjs-wash-' + (++UID), lg = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: y0, x2: 0, y2: y1 }, B.defs());
  el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': .22 }, lg);
  el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': .02 }, lg);
  return 'url(#' + id + ')';
}

/* ---------- chart scaffolding ---------- */
/* touch: a tap pins the tooltip (PIN = that target's leave); a pointerdown outside any chart or a real scroll unpins it */
let PIN = null, PINY = 0, CUR = null;
function unpin() { if (PIN) { const f = PIN; PIN = null; try { f(); } catch (e) {} } }
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => { if (PIN && !(e.target && e.target.closest && e.target.closest('svg.cjs'))) unpin(); }, true);
  window.addEventListener('scroll', () => { if (PIN && Math.abs((window.scrollY || 0) - PINY) > 24) unpin(); }, { passive: true });
}
const isPtr = e => !!e && (e.pointerType === 'mouse' || e.pointerType === 'pen');
/* hatch fill: a .35 tint of the colour under 2.5px diagonal stripes of it (patterns are per chart, made on first use) */
function hatch(defs, c) {
  const id = 'cjs-hatch-' + (++UID), p = el('pattern', { id, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 6, height: 6, fill: c, 'fill-opacity': .35 }, p);
  el('line', { x1: 1.5, x2: 1.5, y1: 0, y2: 6, stroke: c, 'stroke-width': 2.5 }, p);
  return 'url(#' + id + ')';
}
/* calm update: the previous drawing is laid over the host and fades out while the new one sits underneath, already drawn */
function crossfade(host, old) {
  old.removeAttribute('tabindex'); old.setAttribute('aria-hidden', 'true'); old.classList.add('cjs-old');
  old.style.position = 'absolute'; old.style.left = '0'; old.style.top = '0'; old.style.pointerEvents = 'none';
  host.appendChild(old);
  const rm = () => { if (old.parentNode) old.remove(); };
  try { const a = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EZ.fade.css, fill: 'forwards' }); a.onfinish = rm; } catch (e) { rm(); }
  setTimeout(rm, 400);
}
/* keyboard: arrows / Home / End step through the chart's targets with the anchored tooltip, Escape hides it */
function keys(B) {
  const leave = () => { const S = B.steps[B.ki]; B.ki = -1; if (S) S.leave(); };
  B.svg.addEventListener('keydown', e => {
    const S = B.steps, n = S.length, k = e.key, i = B.ki; if (!n) return;
    if (k === 'Escape') { if (i >= 0) { leave(); e.preventDefault(); } return; }
    const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i < 0 ? 0 : Math.min(n - 1, i + 1)) : k === 'ArrowLeft' || k === 'ArrowUp' ? (i < 0 ? n - 1 : Math.max(0, i - 1)) : k === 'Home' ? 0 : k === 'End' ? n - 1 : null;
    if (j == null) return;
    e.preventDefault();
    if (i >= 0 && i !== j && S[i]) S[i].leave();
    B.ki = j; S[j].enter(S[j].ev());
  });
  B.svg.addEventListener('blur', () => { if (B.ki >= 0) leave(); });
}
/* register a keyboard stop on the chart being built; ev() gives the synthetic pointer the target's handler reads */
function stop(enter, leave, ev) {
  if (!CUR) return;
  CUR.steps.push({ enter, leave, ev });
  CUR.svg.setAttribute('tabindex', '0');
}
function base(host, h, o) {
  FONT = getComputedStyle(host).fontFamily || 'sans-serif';
  const live = motion(), olds = Array.from(host.querySelectorAll(':scope > svg'));
  if (olds.length) unpin();
  olds.forEach(s => { if (s.getAnimations) s.getAnimations({ subtree: true }).forEach(a => a.cancel()); });
  let old = null;
  if (o.update && live && olds.length) { const r = host.getBoundingClientRect(); if (r.width > 0 && r.bottom > 0 && r.top < (window.innerHeight || 800)) old = olds[olds.length - 1]; }
  LIVE = live && !o.update;   // an in-place update draws without entrance animations
  host.innerHTML = '';
  const W = host.clientWidth || 600;
  const pn = host.closest && host.closest('.panel'), hd = pn && pn.querySelector('h2');
  const svg = el('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', role: 'img', class: 'cjs', 'aria-label': o.ariaLabel || ((hd ? hd.textContent.trim() : 'Data') + ' chart') }, host);
  svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible;font-family:inherit';
  if (old) crossfade(host, old);
  const rect = () => svg.getBoundingClientRect();
  let defs = null, desc = null;
  const pats = {};
  const B = {
    W, h, svg, host, steps: [], ki: -1,
    defs: () => defs || (defs = svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild)),
    pattern: c => pats[c] || (pats[c] = hatch(B.defs(), c)),
    describe: t => { if (!desc) desc = svg.insertBefore(document.createElementNS(NS, 'desc'), svg.firstChild); desc.textContent = t; },
    toVB: e => { const r = rect(); return { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * h / (r.height || h) }; },
    toClient: (x, y) => { const r = rect(); return { x: r.left + x * (r.width || W) / W, y: r.top + y * (r.height || h) / h }; },
    /* where a tooltip goes: under the mouse, or anchored to a data point (touch and keyboard), flagged with .a */
    at: (e, x, y) => isPtr(e) ? { x: e.clientX, y: e.clientY, a: false } : Object.assign(B.toClient(x, y), { a: true }),
    tip: (x, y, title, items, a) => { if (o.tip) o.tip(x, y, title, items, a); },
    hide: () => { if (o.hideTip) o.hideTip(); },
    destroy: () => { if (svg.getAnimations) svg.getAnimations({ subtree: true }).forEach(a => a.cancel()); host.innerHTML = ''; }
  };
  CUR = B;
  keys(B);
  return B;
}
function yAxis(g, ticks, y, x0, x1, f) {
  const tl = tickLab(f, ticks);
  ticks.forEach((t, i) => {
    el('line', { x1: x0, x2: x1, y1: y(t), y2: y(t), stroke: i ? 'var(--grid)' : 'var(--line)', 'shape-rendering': 'crispEdges' }, g);
    text(g, x0 - 8, y(t), tl(t), { anchor: 'end', base: 'middle' });
  });
}
/* x labels: the last one is always placed (end-anchored if it would overflow), then the first, then every k-th going
   back from the last, each only where its measured box clears the placed neighbours by 4px; sub[i] adds a second line */
function xLabels(g, labels, x, y, slot, W, sub) {
  const n = labels.length; if (!n) return;
  const ws = labels.map(l => measure(l)), w = Math.max(0, ...ws.slice(0, Math.max(1, n - 1))) + 10, k = Math.max(1, Math.ceil(w / slot)), box = [];
  const order = [n - 1]; if (n > 1) order.push(0); for (let i = n - 1 - k; i > 0; i -= k) order.push(i);
  order.forEach(i => {
    const px = x(i), lw = ws[i], an = px + lw / 2 > W ? 'end' : px - lw / 2 < 0 ? 'start' : 'middle', L = an === 'end' ? px - lw : an === 'start' ? px : px - lw / 2;
    if (box.some(b => L < b[1] + 4 && L + lw > b[0] - 4)) return;
    box.push([L, L + lw]);
    text(g, px, y, labels[i], { anchor: an });
    if (sub && sub[i]) text(g, px, y + 12, sub[i], { anchor: an, size: 9 });
  });
}
/* pointer wiring: mouse/pen hover as before; a touch tap shows and pins (lifting the finger no longer hides it).
   Discrete targets (dots, lines, arcs) are keyboard stops too; rects are hit bands or overlays that register their own */
const centre = n => () => { const r = n.getBoundingClientRect(); return { pointerType: 'kbd', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };
function hover(n, enter, leave) {
  n.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') enter(e); });
  n.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') enter(e); });
  n.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') leave(e); });
  n.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') return; if (PIN !== leave) unpin(); enter(e); PIN = leave; PINY = window.scrollY || 0; });
  if (n.tagName !== 'rect') stop(enter, leave, centre(n));
  return n;
}
/* transparent hit rect, expanded to >= 24px in each dimension; also a keyboard stop */
function hit(g, x, y, w, h, enter, leave) {
  const px = Math.max(0, (24 - w) / 2), py = Math.max(0, (24 - h) / 2);
  const n = hover(el('rect', { x: x - px, y: y - py, width: w + 2 * px, height: h + 2 * py, fill: 'transparent' }, g), enter, leave);
  stop(enter, leave, centre(n));
  return n;
}
/* crosshair overlay: snaps to nearest index, calls onIdx(i, e) with hover dots (r 5.5 + surface ring) to position; every index is a keyboard stop */
function crosshair(B, g, x, step, n, y0, y1, colors, onIdx, off) {
  const ln = el('line', { y1: y0, y2: y1, stroke: 'var(--muted)', opacity: 0 }, g);
  const dots = colors.map(c => el('circle', { r: 5.5, fill: c, stroke: 'var(--card)', 'stroke-width': 2, opacity: 0 }, g));
  const ov = el('rect', { x: x(0) - step / 2, y: y0, width: step * n, height: y1 - y0, fill: 'transparent' }, g);
  const place = (k, cx, cy) => { dots[k].setAttribute('opacity', cy == null ? 0 : 1); if (cy != null) { dots[k].setAttribute('cx', cx); dots[k].setAttribute('cy', cy); } };
  const enter = e => { const i = Math.max(0, Math.min(n - 1, Math.round((B.toVB(e).x - (off || 0) - x(0)) / step))); ln.setAttribute('x1', x(i)); ln.setAttribute('x2', x(i)); ln.setAttribute('opacity', 1); onIdx(i, e, place); };
  const leave = () => { ln.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); B.hide(); };
  hover(ov, enter, leave);
  for (let i = 0; i < n; i++) stop(enter, leave, () => { const p = B.toClient(x(i) + (off || 0), y0); return { pointerType: 'kbd', clientX: p.x, clientY: p.y }; });
}
const dashed = (g, x1, x2, y1, y2, c) => el('line', { x1, x2, y1, y2, stroke: c || 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
const dot = (g, cx, cy, c, r) => el('circle', { cx, cy, r: r || 4, fill: c, stroke: 'var(--card)', 'stroke-width': 2 }, g);
const lastIdx = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };
const sign = v => v > 0 ? '+' : v < 0 ? '−' : '';
const TGT = 'var(--target,var(--warn))';   // every target mark: one token, 1.5px, dash '5 4'
/* a target value in a tooltip prints exactly (0.75, not the axis format's 0.8) */
const tgtVal = (f, t) => { const s = String(f(t)), v = parseFloat(s.replace(/,/g, '').replace('−', '-')); return v === +t ? s : (+t).toLocaleString('en-US', { maximumFractionDigits: 4 }); };
/* legend from what was drawn: a key per series kind (bar / hatch / area rect, line, dashed line, dot), replacing host's content */
function lkey(s) {
  const c = s.color, k = s.kind || 'bar', a = 'class="lg-k" aria-hidden="true" focusable="false"';
  if (k === 'line' || k === 'dashed') return `<svg ${a} width="18" height="10" viewBox="0 0 18 10">${s.wash ? `<rect y="5" width="18" height="5" fill="${c}" fill-opacity=".22"/>` : ''}<line x1="1" x2="17" y1="5" y2="5" stroke="${c}" stroke-width="${s.width || 2}"${k === 'dashed' ? ` stroke-dasharray="${s.dash || '6 4'}"` : ''} stroke-linecap="${s.cap || (k === 'dashed' ? 'butt' : 'round')}"/></svg>`;
  if (k === 'dot') return `<svg ${a} width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${c}"/></svg>`;
  if (k === 'hatch') { const id = 'cjs-lh-' + (++UID); return `<svg ${a} width="10" height="10" viewBox="0 0 10 10"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" fill="${c}" fill-opacity=".35"/><line x1="1.5" x2="1.5" y1="0" y2="6" stroke="${c}" stroke-width="2.5"/></pattern></defs><rect width="10" height="10" rx="2" fill="url(#${id})"/></svg>`; }
  return `<svg ${a} width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" rx="2" fill="${c}"${k === 'area' ? ' fill-opacity=".3"' : ''}/></svg>`;
}
function legend(host, series) {
  if (!host) return;
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  host.classList.add('lg-auto');
  host.innerHTML = (series || []).map(s => `<span class="lg-i" data-kind="${s.kind || 'bar'}">${lkey(s)}<span>${esc(s.name)}</span></span>`).join('');
}
window.ChartsLegend = legend;

/* 1. line — multi-series line/area with target, volume band, weekend shade, crosshair tooltip */
function line(host, o) {
  const h = o.height || 260, B = base(host, h, o), W = B.W, g = el('g', null, B.svg);
  const labels = o.labels || [], n = labels.length, S = (o.series || []).map((s, i) => Object.assign({}, s, { color: col(s.color, i) }));
  const yf = o.yFormat || (o.pctAxis ? v => Math.round(v) + '%' : fmt), vf = v => v == null || isNaN(v) ? '–' : yf(v);
  const vals = S.flatMap(s => s.values.filter(v => v != null)); if (o.target != null) vals.push(o.target);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals); if (o.pctAxis) hi = Math.max(hi, 100);
  const ticks = niceTicks(lo, hi, 4), tl = tickLab(yf, ticks); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const volH = o.volume ? 44 : 0, ends = S.map(s => lastIdx(s.values));
  const endW = Math.max(0, ...ends.map((e, k) => e < 0 ? 0 : measure(yf(S[k].values[e]), 11, 600)));
  const m = { t: 18, r: Math.max(16, endW + 16), b: 24 + (volH ? volH + 8 : 0), l: Math.max(28, Math.max(...ticks.map(t => measure(tl(t)))) + 12) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, step = n > 1 ? pw / (n - 1) : pw;
  const x = i => m.l + (n > 1 ? i * step : pw / 2), y = lin(lo, hi, m.t + ph, m.t), bottom = m.t + ph + (volH ? volH + 8 : 0);
  const ax = chrome(g), T0 = MS.data, xa = x(0), xb = x(Math.max(0, n - 1));
  if (o.weekendShade) labels.forEach((l, i) => { if (isISO(l) && dow(l) % 6 === 0) el('rect', { x: x(i) - step / 2, y: m.t, width: step, height: bottom - m.t, fill: 'var(--soft)' }, ax); });
  yAxis(ax, ticks, y, m.l, m.l + pw, yf);
  xLabels(ax, labels.map(sd), x, h - 6, step, W);
  if (volH) {
    const vy = lin(0, Math.max(...o.volume), bottom, m.t + ph + 8), bw = Math.min(24, step * .6);
    el('line', { x1: m.l, x2: m.l + pw, y1: bottom, y2: bottom, stroke: 'var(--line)' }, ax);
    /* volume grows in the pen's rhythm, trailing it and catching up at the end, within the stagger cap */
    o.volume.forEach((v, i) => grow(el('path', { d: barPath(x(i) - bw / 2, vy(v), bw, bottom - vy(v), 3, 'top'), fill: 'var(--other)', 'fill-opacity': .6 }, g), '50% 100%', 'scaleY', T0 + MS.draw - MS.stagger + EZ.draw.t(n > 1 ? i / (n - 1) : 0) * MS.stagger, MS.grow - 140));
  }
  /* target: the shared target token, labelled at the right end */
  if (o.target != null) { const ty = y(o.target); draw(dashed(g, m.l, m.l + pw, ty, ty, TGT), pw, T0, MS.ref); fade(text(g, m.l + pw - 6, ty - 5, o.targetLabel || 'Target', { size: 10, anchor: 'end', halo: 1 }), T0 + MS.ref - 140, MS.fade); }
  const pens = S.map((s, k) => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]), d0 = T0 + stag(k, S.length, 80, 160);
    if (s.area) {
      let d = '', run = [];
      const flush = () => { if (run.length) d += 'M' + run[0][0].toFixed(1) + ',' + y(lo).toFixed(1) + run.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('') + 'L' + run[run.length - 1][0].toFixed(1) + ',' + y(lo).toFixed(1) + 'Z'; run = []; };
      pts.forEach(p => p ? run.push(p) : flush()); flush();
      const on = pts.filter(Boolean);   // the wash follows its own line's pen
      if (on.length) wipe(el('path', { d, fill: wash(B, s.color, m.t, y(lo)) }, g), on[0][0], on[on.length - 1][0], xa, xb, d0, MS.draw);
    }
    const P = pen(g, pts, { fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, xa, xb, d0, MS.draw, s.dash ? '6 4' : null);
    if (s.markers) pts.forEach((p, i) => { if (p && i !== ends[k]) pop(dot(g, p[0], p[1], s.color), P.at(p[0]), MS.pop); });
    return P;
  });
  /* end dots: land with their line, then two soft halo pulses */
  S.forEach((s, k) => {
    const e = ends[k]; if (e < 0) return;
    const cx = x(e), cy = y(s.values[e]), t = pens[k].at(cx);
    halo(g, cx, cy, s.color, t + 40);
    pop(dot(g, cx, cy, s.color), t - 30, MS.pop);
  });
  /* end labels with leader lines when pushed apart — last in */
  const lab = ends.map((e, k) => e < 0 ? null : { k, e, y: y(S[k].values[e]), t: yf(S[k].values[e]) }).filter(Boolean);
  const ly = pushApart(lab.map(l => l.y), 13, m.t, m.t + ph);
  lab.forEach((l, j) => {
    const ex = x(l.e), t = pens[l.k].at(ex);
    if (Math.abs(ly[j] - l.y) > 2) fade(el('line', { x1: ex + 6, y1: l.y, x2: ex + 9, y2: ly[j], stroke: 'var(--line)' }, g), t, MS.fade);
    fade(text(g, ex + 10, ly[j], l.t, { fill: 'var(--text)', base: 'middle', weight: 600 }), t, MS.fade, -4, 0);
  });
  if (o.labelExtremes) {
    let mx = null, mn = null;
    S.forEach((s, k) => s.values.forEach((v, i) => { if (v == null) return; if (!mx || v > mx.v) mx = { v, i, k }; if (!mn || v < mn.v) mn = { v, i, k }; }));
    [mx, mn].forEach((e, j) => {
      if (!e || e.i === ends[e.k]) return;
      const t = pens[e.k].at(x(e.i));
      pop(dot(g, x(e.i), y(e.v), S[e.k].color), t, MS.pop);
      fade(text(g, x(e.i), y(e.v) + (j ? 17 : -9), yf(e.v), { anchor: 'middle', fill: 'var(--text)', weight: 600, halo: 1 }), t + 100, MS.fade, 0, j ? -3 : 3);
    });
  }
  /* crosshair: the mouse keeps its own height; touch and keyboard anchor the tooltip above the highest point */
  crosshair(B, g, x, step, n, m.t, bottom, S.map(s => s.color), (i, e, place) => {
    const items = S.map((s, k) => { const v = s.values[i]; place(k, x(i), v == null ? null : y(v)); return { label: s.name, value: vf(v), color: s.color }; });
    if (o.target != null) items.push({ label: o.targetLabel || 'Target', value: tgtVal(yf, o.target), color: TGT });
    if (volH) items.push({ label: o.volumeLabel || 'Volume', value: fmt(o.volume[i]), color: 'var(--other)' });
    const top = Math.min(m.t + ph, ...S.map(s => s.values[i]).filter(v => v != null).map(y)), a = B.at(e, x(i), top - 8);
    B.tip(a.a ? a.x : B.toClient(x(i), 0).x, a.y, tt(labels[i]), items, a.a);
  });
  B.describe(S.map(s => s.name).join(', ') + ' · ' + n + ' points' + (n ? ' from ' + tt(labels[0]) + ' to ' + tt(labels[n - 1]) : '') + (lab.length ? ' · latest ' + lab.map(l => S[l.k].name + ' ' + l.t).join(', ') : '') + (o.target != null ? ' · target ' + tgtVal(yf, o.target) : ''));
  const series = S.map(s => s.dash ? { name: s.name, color: s.color, kind: 'dashed', dash: '6 4' } : { name: s.name, color: s.color, kind: 'line', wash: !!s.area });
  if (o.target != null) series.push({ name: o.targetLabel || 'Target', color: TGT, kind: 'dashed', dash: '5 4', width: 1.5 });
  if (volH) series.push({ name: o.volumeLabel || 'Volume', color: 'var(--other)', kind: 'bar' });
  return { series, destroy: B.destroy, tableView: () => [['Label'].concat(S.map(s => s.name))].concat(labels.map((l, i) => [tt(l)].concat(S.map(s => s.values[i] == null ? '' : yf(s.values[i]))))) };
}

/* 2. columns — grouped or stacked columns with selective value labels.
   o.totals[i] is the figure a stacked column stands for (labels, tooltip Total, target checks); o.partial[i] (true or
   {label, tip:[k, v]}) fades an incomplete column and outlines it dashed (hatching stays reserved for the series that use it); null values draw no bar (o.nullLabel stub, o.nullTip);
   o.gapBefore = i opens a half-band gap before column i; valueLabels 'max' | 'max+last' | 'all' | 'none' */
function columns(host, o) {
  const h = o.height || 260, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const cats = o.cats || [], n = cats.length, S = (o.series || []).map((s, i) => Object.assign({}, s, { color: col(s.color, i) }));
  const st = !!o.stacked && S.length > 1, yf = o.yFormat || fmt, vl = o.valueLabels || 'max', PT = o.partial || [], nv = v => v == null || isNaN(v) ? 0 : v;
  const nullTip = o.nullTip || (o.nullLabel ? 'too few calls' : '–'), sub = cats.map((c, i) => PT[i] && PT[i].label || ''), hasSub = sub.some(Boolean);
  const tot = cats.map((c, i) => S.reduce((a, s) => a + nv(s.values[i]), 0)), all = S.flatMap(s => s.values.map(nv));
  const lt = cats.map((c, i) => o.totals && o.totals[i] != null ? o.totals[i] : tot[i]);   // the total a column stands for
  let hi = st ? Math.max(...tot) : Math.max(...all), lo = Math.min(0, ...all); if (o.target != null) hi = Math.max(hi, o.target);
  const ticks = niceTicks(lo, hi, 4), tl = tickLab(yf, ticks); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const m = { t: 22, r: 12, b: 24 + (hasSub ? 12 : 0), l: Math.max(28, Math.max(...ticks.map(t => measure(tl(t)))) + 12) };
  const gp = o.gapBefore != null && o.gapBefore > 0 && o.gapBefore < n ? o.gapBefore : -1;
  const pw = W - m.l - m.r, ph = h - m.t - m.b, band = pw / Math.max(1, n + (gp > 0 ? .5 : 0)), y = lin(lo, hi, m.t + ph, m.t), y0 = y(0);
  const xc = i => m.l + band * (i + .5 + (gp > 0 && i >= gp ? .5 : 0));
  const bw = st ? Math.min(24, band * .6) : Math.min(24, (band * .72 - 2 * (S.length - 1)) / S.length), gw = st ? bw : bw * S.length + 2 * (S.length - 1);
  const bx = (i, j) => st ? xc(i) - bw / 2 : xc(i) - gw / 2 + j * (bw + 2);
  const ax = chrome(g), T0 = MS.data;
  yAxis(ax, ticks, y, m.l, m.l + pw, yf);
  xLabels(ax, cats.map(sd), xc, h - 6 - (hasSub ? 12 : 0), band, W, sub);
  const maxOf = s => Math.max(...s.values.map(nv)), maxLt = Math.max(...lt), bars = [], tags = [];
  const tagged = (i, v, mx) => vl === 'all' || (v === mx && v > 0) || (vl === 'max+last' && i === n - 1 && v > 0);
  /* left-to-right: whole columns when stacked (segments then fill bottom-up), every bar when grouped */
  const nb = st ? n : n * S.length, when = (i, j) => T0 + (st ? stag(i, n, 50) : stag(i * S.length + j, nb, 30));
  cats.forEach((c, i) => {
    let cum = 0; bars[i] = []; tags[i] = [];
    const seq = st && tot[i] > 0 && S.every(s => nv(s.values[i]) >= 0), part = !!PT[i];
    S.forEach((s, j) => {
      const raw = s.values[i];
      if (raw == null || isNaN(raw)) { if (o.nullLabel && !st) tags[i].push(fade(text(g, bx(i, j) + bw / 2, y0 - 5, o.nullLabel, { anchor: 'middle', size: 9 }), when(i, j), MS.fade)); return; }
      const v = raw, up = v >= 0, top = st ? y(cum + v) : up ? y(v) : y0, bot = st ? y(cum) - (j ? 2 : 0) : up ? y0 : y(v);
      const c0 = seq ? cum / tot[i] : j / S.length, c1 = seq ? (cum + v) / tot[i] : (j + 1) / S.length;
      cum += v;
      const d = barPath(bx(i, j), top, bw, bot - top, (!st || j === S.length - 1) ? 4 : 0, up ? 'top' : 'bottom'); if (!d) return;
      const fc = o.highlightMax && S.length === 1 && v !== maxOf(s) ? 'var(--other)' : s.color;
      const ps = [el('path', { d, fill: s.pattern === 'hatch' ? B.pattern(fc) : fc, 'fill-opacity': part ? .45 : null, stroke: part && !st ? 'var(--muted)' : null, 'stroke-dasharray': part && !st ? '3 2' : null }, g)];   // incomplete: faded (a stack gets one dashed outline below)
      ps.forEach(p => { bars[i].push(p); if (st) growSpan(p, up ? '50% 100%' : '50% 0%', when(i, 0), MS.grow, c0, c1); else grow(p, up ? '50% 100%' : '50% 0%', 'scaleY', when(i, j), MS.grow); });
    });
    if (st && part && tot[i] > 0) { const ol = el('path', { d: barPath(xc(i) - bw / 2, y(tot[i]), bw, y0 - y(tot[i]), 4, 'top'), fill: 'none', stroke: 'var(--muted)', 'stroke-dasharray': '3 2', 'pointer-events': 'none' }, g); bars[i].push(ol); fade(ol, when(i, 0) + MS.grow, MS.fade); }
    if (st && o.nullLabel && S.every(s => s.values[i] == null)) tags[i].push(fade(text(g, xc(i), y0 - 5, o.nullLabel, { anchor: 'middle', size: 9 }), when(i, 0), MS.fade));
    if (vl === 'none') return;
    if (st) { if (tagged(i, lt[i], maxLt)) tags[i].push(fade(text(g, xc(i), y(tot[i]) - 6, yf(lt[i]), { anchor: 'middle', fill: 'var(--text)', weight: 600 }), when(i, 0) + MS.grow * .62, MS.fade, 0, 4)); }
    else S.forEach((s, j) => {
      const v = s.values[i]; if (v == null || isNaN(v) || !tagged(i, v, maxOf(s))) return;
      const lw = measure(yf(v), 10, 600); if (lw > band) return;
      if (S.some((s2, j2) => j2 !== j && Math.abs(bx(i, j2) - bx(i, j)) < (lw + bw) / 2 + 2 && y(nv(s2.values[i])) < y(v) - 2)) return;
      tags[i].push(fade(text(g, bx(i, j) + bw / 2, v >= 0 ? y(v) - 6 : y(v) + 13, yf(v), { anchor: 'middle', fill: 'var(--text)', weight: 600, size: 10 }), when(i, j) + MS.grow * .5, MS.fade, 0, v >= 0 ? 4 : -4));
    });
  });
  /* target: one dashed token line, and a 2px miss tick above every complete column that falls short of it */
  let miss = 0;
  if (o.target != null) {
    const ty = y(o.target);
    draw(dashed(g, m.l, m.l + pw, ty, ty, TGT), pw, T0, MS.ref);
    if (st || S.length === 1) cats.forEach((c, i) => { const v = st ? lt[i] : S[0].values[i]; if (v == null || PT[i] || v >= o.target) return; miss++; tags[i].push(fade(el('rect', { x: (st ? xc(i) - bw / 2 : bx(i, 0)) - 1, y: ty - 1, width: (st ? bw : gw) + 2, height: 2, rx: 1, fill: 'var(--bad)' }, g), T0 + MS.ref * .6 + stag(i, n, 30), MS.fade)); });
    fade(text(g, m.l + pw, ty - 5, o.targetLabel || 'Target', { size: 10, anchor: 'end', halo: 1 }), T0 + MS.ref - 140, MS.fade);
  }
  const F = focus(cats.map((c, i) => bars[i].concat(tags[i])));
  cats.forEach((c, i) => hit(hits, xc(i) - band / 2, m.t, band, ph, e => {
    F.on(i);
    let items;
    if (st) {   // stacked: top segment first, zero rows skipped, then the bold total
      items = S.map(s => ({ label: s.name, v: s.values[i], color: s.color })).reverse().filter(r => r.v != null && r.v !== 0).map(r => ({ label: r.label, value: yf(r.v), color: r.color }));
      items.push({ label: 'Total', value: yf(lt[i]), bold: true });
    } else items = S.map(s => ({ label: s.name, value: s.values[i] == null || isNaN(s.values[i]) ? nullTip : yf(s.values[i]), color: s.color }));
    const tv = st ? lt[i] : S.length === 1 ? S[0].values[i] : null;
    if (o.target != null && tv != null && o.target) { const d = tv - o.target; items.push({ label: 'vs target', value: sign(d) + yf(Math.abs(d)) + ' (' + Math.round(tv / o.target * 100) + '%)', vc: d >= 0 ? 'var(--good)' : 'var(--bad)' }); }
    if (PT[i] && PT[i].tip) items.push({ label: PT[i].tip[0], value: PT[i].tip[1] });
    const a = B.at(e, xc(i), Math.min(y0, y(st ? tot[i] : Math.max(0, ...S.map(s => nv(s.values[i]))))) - 6);
    B.tip(a.x, a.y, tt(c), items, a.a);
  }, () => { F.off(); B.hide(); }));
  B.describe(S.map(s => s.name).join(', ') + ' · ' + n + ' columns' + (n ? ' from ' + tt(cats[0]) + ' to ' + tt(cats[n - 1]) : '') + (n ? ' · latest ' + yf(lt[n - 1]) : '') + (o.target != null ? ' · target ' + tgtVal(yf, o.target) : ''));
  const series = S.map(s => ({ name: s.name, color: s.color, kind: s.pattern === 'hatch' ? 'hatch' : 'bar' }));
  if (o.target != null) series.push({ name: o.targetLabel || 'Target', color: TGT, kind: 'dashed', dash: '5 4', width: 1.5 });
  if (miss) series.push({ name: 'missed target', color: 'var(--bad)', kind: 'line', width: 2, cap: 'butt' });
  return { series, destroy: B.destroy, tableView: () => [['Category'].concat(S.map(s => s.name), st ? ['Total'] : [])].concat(cats.map((c, i) => [tt(c)].concat(S.map(s => s.values[i] == null || isNaN(s.values[i]) ? '' : yf(s.values[i])), st ? [yf(lt[i])] : []))) };
}

/* 3. bullet — horizontal bullet bars (track, value bar, target tick). Bands by attainment a = value / target:
   a >= 1 good, a >= .5 a neutral bar, below that bad; the value label carries the attainment ('0.58 · 77%') */
function bullet(host, o) {
  const rows = o.rows || [], f = o.format || fmt;
  /* attainment never rounds up to 100% below target; a value that is itself a percentage keeps its plain label */
  const att = r => r.target ? r.value / r.target : null, ap = r => { const a = att(r); return a < 1 ? Math.min(99, Math.round(a * 100)) : Math.round(a * 100); };
  const vlab = r => f(r.value) + (att(r) != null && !/%$/.test(f(r.value)) ? ' · ' + ap(r) + '%' : '');
  /* narrow hosts (phones): when the labels would leave the track under 45% of the width, each row stacks — name and value on one line, a full-width track, the sub line under it */
  const lw = Math.max(0, ...rows.map(r => Math.max(measure(r.label, 12, 600), r.sub ? measure(r.sub, 10) : 0))) + 14, vw = Math.max(0, ...rows.map(r => measure(vlab(r), 12, 600))) + 12, W0 = host.clientWidth || 600;
  const st = W0 - lw - vw < .45 * W0, rh = st ? (rows.some(r => r.sub) ? 52 : 40) : o.rowHeight || 34, B = base(host, rows.length * rh + 6, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const x0 = st ? 0 : lw, x1 = st ? W : W - vw;
  const ax = chrome(g), T0 = MS.data, marks = [];
  rows.forEach((r, i) => {
    const max = r.max || Math.max(r.value, r.target || 0) * 1.15 || 1, x = lin(0, max, x0, x1), cy = st ? i * rh + 27 : i * rh + rh / 2 + 3, ly = st ? i * rh + 11 : cy, d = T0 + stag(i, rows.length, 70), a = att(r);
    text(ax, 0, st ? ly : r.sub ? cy - 2 : cy, r.label, { fill: 'var(--text)', size: 12, weight: 600, base: st || !r.sub ? 'middle' : 'auto' });
    if (r.sub) text(ax, 0, st ? cy + 18 : cy + 11, r.sub, { size: 10, base: st ? 'middle' : null });
    el('rect', { x: x0, y: cy - 6, width: x1 - x0, height: 12, rx: 4, fill: 'var(--grid)' }, ax);
    const fill = r.target == null ? 'var(--ink,var(--text))' : a >= 1 ? 'var(--good)' : a >= .5 ? 'var(--c-bar,rgba(234,242,247,.42))' : 'var(--bad)';
    const p = el('path', { d: barPath(x0, cy - 6, Math.max(0, x(Math.min(r.value, max)) - x0), 12, 4, 'right'), fill }, g);
    grow(p, '0% 50%', 'scaleX', d, MS.grow + 60);
    marks.push([p]);
    if (r.target != null) marks[i].push(fade(el('rect', { x: x(r.target) - 1, y: cy - 10, width: 2, height: 20, fill: TGT }, g), d + MS.grow * .55, MS.fade, 0, -7));
    fade(text(g, W, ly, vlab(r), { anchor: 'end', fill: 'var(--text)', size: 12, weight: 600, base: 'middle' }), d + MS.grow * .45, MS.fade, -4, 0);
    hit(hits, x0, st ? i * rh : cy - rh / 2, x1 - x0, rh, e => {
      F.on(i);
      const items = [{ label: 'Actual', value: f(r.value), color: fill }];
      if (r.target != null) items.push({ label: 'Target', value: f(r.target), color: TGT }, { label: 'Attainment', value: r.target ? ap(r) + '%' : '–' });
      const at = B.at(e, x(Math.min(r.value, max)), cy - 8);
      B.tip(at.x, at.y, r.label, items, at.a);
    }, () => { F.off(); B.hide(); });
  });
  const F = focus(marks);
  B.describe(rows.length + ' rows: ' + rows.slice(0, 12).map(r => r.label + ' ' + vlab(r)).join(', ') + (rows.length > 12 ? ', …' : ''));
  return { destroy: B.destroy, tableView: () => [['Metric', 'Actual', 'Target', 'Attainment']].concat(rows.map(r => [r.label, f(r.value), r.target == null ? '' : f(r.target), att(r) == null ? '' : ap(r) + '%'])) };
}

/* 5. scatter — quadrant scatter. A string p.group picks the colour (o.groupColors[group], else ink, --other, …; no
   group = ink), p.mine adds a 2px teal ring and p.sub is one more tooltip line (o.subLabel). Points at the same x and y
   merge into one dot (r = 4 + 2√(n−1), labelled '×n', names in its tooltip). Labels (p.labelled, and every merged dot)
   try E, W, N, S at r + 4 (N and S slide sideways to stay in the plot; a '×n' also tries the diagonals and one line
   above N, and on the bottom gridline it sits in two rows below the dots first). A label is dropped when no place
   clears the dots, the placed labels, the quadrant labels and the plot edge.
   The plot is inset by the largest radius so no dot meets an axis label; a reference line at the axis minimum is not drawn. */
function scatter(host, o) {
  const P = o.points || [], h = o.height || 320, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg), xf = o.xFormat || fmt, yf = o.yFormat || fmt;
  const xs = P.map(p => p.x).concat(o.xRef != null ? [o.xRef] : []), ys = P.map(p => p.y).concat(o.yRef != null ? [o.yRef] : []);
  if (!xs.length) xs.push(0, 1); if (!ys.length) ys.push(0, 1);
  const xlo = Math.min(...xs), xhi = Math.max(...xs), xt = niceTicks(xlo === xhi && o.xMax != null && xhi >= o.xMax ? xhi - Math.abs(o.xMax || 1) / 2 : xlo, xhi, 5), yt = niceTicks(Math.min(...ys), Math.max(...ys), 4);   // o.xMax: a ceiling (e.g. 100%) — when every point sits on it the axis extends downward, not past it
  const isG = p => typeof p.group === 'string' && p.group !== '', GK = o.groupColors ? Object.keys(o.groupColors) : [], groups = [];
  P.forEach(p => { if (isG(p) && !groups.includes(p.group)) groups.push(p.group); });
  groups.sort((a, b) => (GK.indexOf(a) + 1 || 99) - (GK.indexOf(b) + 1 || 99));
  const GC = ['var(--ink,var(--text))', 'var(--other)', 'var(--s3)', 'var(--s4)'], gcol = gr => (o.groupColors && o.groupColors[gr]) || GC[Math.max(0, groups.indexOf(gr)) % GC.length];
  const sizes = P.map(p => p.size).filter(v => v != null), sr = sizes.length ? lin(Math.sqrt(Math.min(...sizes)), Math.sqrt(Math.max(...sizes)), 4, 11) : () => 4;
  /* coincident points become one cluster */
  const KC = {}, CL = [];
  P.forEach(p => { const k = p.x + '|' + p.y; if (!KC[k]) CL.push(KC[k] = { x: p.x, y: p.y, m: [] }); KC[k].m.push(p); });
  CL.forEach(c => {
    const n = c.m.length, gs = c.m.map(p => isG(p) ? p.group : '');
    c.r = Math.max(n > 1 ? 4 + 2 * Math.sqrt(n - 1) : 0, ...c.m.map(p => p.size != null ? sr(Math.sqrt(p.size)) : 4));
    c.c = gs[0] && gs.every(s => s === gs[0]) ? gcol(gs[0]) : GC[0];
    c.mine = c.m.some(p => p.mine); c.R = c.r + (c.mine ? 4.5 : 0);
    c.lab = n > 1 ? '×' + n : c.m[0].labelled ? String(c.m[0].label) : null;
  });
  /* inset by the largest radius; merged dots on the bottom gridline also get two rows below them for their '×n' */
  const pad = Math.max(4, ...CL.map(c => c.R)) + 3, eb = CL.some(c => c.m.length > 1 && c.y === yt[0]) ? 30 : 0;
  const m = { t: 10, r: 12, b: o.xLabel ? 40 : 24, l: Math.max(28, Math.max(...yt.map(t => measure(yf(t)))) + 12 + (o.yLabel ? 16 : 0)) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, x = lin(xt[0], xt[xt.length - 1], m.l + pad, m.l + pw - pad), y = lin(yt[0], yt[yt.length - 1], m.t + ph - pad - eb, m.t + pad);
  const ax = chrome(g), T0 = MS.data;
  yAxis(ax, yt, y, m.l, m.l + pw, yf);
  xt.forEach((t, i) => { el('line', { x1: x(t), x2: x(t), y1: m.t, y2: m.t + ph, stroke: i ? 'var(--grid)' : 'var(--line)', 'shape-rendering': 'crispEdges' }, ax); text(ax, x(t), m.t + ph + 16, xf(t), { anchor: 'middle' }); });
  if (o.xLabel) text(ax, m.l + pw / 2, h - 4, o.xLabel, { anchor: 'middle', size: 10 });
  if (o.yLabel) text(ax, 10, m.t + ph / 2, o.yLabel, { anchor: 'middle', size: 10 }).setAttribute('transform', `rotate(-90 10 ${m.t + ph / 2})`);
  const xR = o.xRef != null && o.xRef !== xt[0], yR = o.yRef != null && o.yRef !== yt[0];   // muted medians (dashed()'s default)
  if (xR) draw(dashed(g, x(o.xRef), x(o.xRef), m.t, m.t + ph), ph, T0, MS.ref);
  if (yR) draw(dashed(g, m.l, m.l + pw, y(o.yRef), y(o.yRef)), pw, T0, MS.ref);
  /* collision boxes [x0, y0, x1, y1]: dots (with their ring), then quadrant labels and point labels as they are placed */
  const over = (a, b, s, v) => a[0] < b[2] + s && a[2] > b[0] - s && a[1] < b[3] + (v == null ? s : v) && a[3] > b[1] - (v == null ? s : v), boxes = [];
  const dotB = CL.map(c => [x(c.x) - c.R, y(c.y) - c.R, x(c.x) + c.R, y(c.y) + c.R]);
  const tb = (tx, ty, w, an, fs) => { const L = an === 'end' ? tx - w : an === 'middle' ? tx - w / 2 : tx; return [L, ty - fs * .65, L + w, ty + fs * .65]; };
  const inPlot = b => b[0] >= m.l + 2 && b[2] <= m.l + pw - 2 && b[1] >= m.t + 1 && b[3] <= m.t + ph - 1;
  /* quadrant labels: a pair that cannot sit side by side is left out; each slides inward off the dots, or is dropped */
  const QL = o.quadrantLabels || [], QS = 10, Q = [[m.l + 6, 'start', 0], [m.l + pw - 6, 'end', 0], [m.l + 6, 'start', 1], [m.l + pw - 6, 'end', 1]];
  [[0, 1], [2, 3]].forEach(pr => {
    const ws = pr.map(i => QL[i] ? measure(QL[i], QS, 600) : 0);
    if (ws[0] + ws[1] + 24 > pw) return;
    pr.forEach((i, j) => {
      if (!QL[i]) return;
      for (let s = 0; s <= ph * .3; s += 3) {
        const ty = Q[i][2] ? m.t + ph - 9 - s : m.t + 9 + s, b = tb(Q[i][0], ty, ws[j], Q[i][1], QS);
        if (dotB.some(d => over(b, d, 1)) || boxes.some(d => over(b, d, 2))) continue;
        boxes.push(b);
        text(ax, Q[i][0], ty, QL[i], { anchor: Q[i][1], size: QS, weight: 600, base: 'middle', halo: 1 }).setAttribute('stroke-opacity', .55);
        return;
      }
    });
  });
  /* dots pop in order of x (painting order stays largest-first so small dots sit on top) */
  const rank = [], byX = CL.map((c, i) => i).sort((a, b) => CL[a].x - CL[b].x || CL[b].y - CL[a].y);
  byX.forEach((i, k) => { rank[i] = k; });
  const at = i => T0 + 200 + stag(rank[i], CL.length, 30, 400), dots = [];
  CL.map((c, i) => i).sort((a, b) => CL[b].r - CL[a].r).forEach(i => {
    const c = CL[i], cx = x(c.x), cy = y(c.y);
    if (c.mine) pop(el('circle', { cx, cy, r: c.r + 3.5, fill: 'none', stroke: 'var(--teal)', 'stroke-width': 2 }, g), at(i), MS.pop + 40);
    dots[i] = pop(el('circle', { cx, cy, r: c.r, fill: c.c, 'fill-opacity': .85, stroke: 'var(--card)', 'stroke-width': c.m.length > 1 ? 1.5 : 2 }, g), at(i), MS.pop + 40);
  });
  /* hit targets in x order, so arrow keys walk left to right */
  byX.forEach(i => {
    const c = CL[i], cx = x(c.x), cy = y(c.y), d = dots[i], p = c.m[0], n = c.m.length;
    const show = e => {
      d.setAttribute('fill-opacity', 1); d.setAttribute('r', c.r + 2);
      const items = [{ label: o.xLabel || 'x', value: xf(c.x), color: c.c }, { label: o.yLabel || 'y', value: yf(c.y), color: c.c }];
      let title;
      if (n === 1) {
        title = String(p.label) + (p.mine ? ' · selected' : '');
        if (p.size != null) items.push({ label: o.sizeLabel || 'Size', value: fmt(p.size) });
        if (isG(p)) items.push({ label: o.groupLabel || 'Group', value: p.group });
        if (p.sub != null && p.sub !== '') items.push({ label: o.subLabel || 'Detail', value: String(p.sub) });
      } else {
        title = n + ' ' + (o.noun || 'points') + ' at this point';
        c.m.slice(0, 6).forEach(q => items.push({ label: String(q.label) + (q.mine ? ' · selected' : ''), value: isG(q) ? q.group : q.sub != null ? String(q.sub) : '' }));
        if (n > 6) items.push({ label: '+' + (n - 6) + ' more', value: '' });
      }
      const a = B.at(e, cx, cy - c.r - 6);
      B.tip(a.x, a.y, title, items, a.a);
    };
    hover(el('circle', { cx, cy, r: Math.max(12, c.r + 4), fill: 'transparent' }, hits), show, () => { d.setAttribute('fill-opacity', .85); d.setAttribute('r', c.r); B.hide(); });
  });
  /* labels: merged dots first (left to right), then the selected point, then the rest in the order given */
  const LS = 10, RB = Math.max(0, ...CL.filter(c => c.y === yt[0]).map(c => c.R));   // bottom-row counts share two tidy rows
  CL.map((c, i) => i).filter(i => CL[i].lab).sort((a, b) => (CL[b].m.length > 1) - (CL[a].m.length > 1) || CL[b].mine - CL[a].mine || (CL[a].m.length > 1 ? rank[a] - rank[b] : a - b)).forEach(i => {
    const c = CL[i], cx = x(c.x), cy = y(c.y), bold = c.m.length > 1 || c.mine, fs = c.m.length > 1 && W < 480 ? 9 : LS, w = measure(c.lab, fs, bold ? 700 : 400), off = c.R + 4, dy = off + fs * .65;
    const mid = Math.max(m.l + 2 + w / 2, Math.min(m.l + pw - 2 - w / 2, cx)), E = [cx + off, cy, 'start'], Wc = [cx - off, cy, 'end'], N = [mid, cy - dy, 'middle'], S = [mid, cy + dy, 'middle'];
    const k = c.R + 1, dg = (sx, sy) => [cx + sx * k, cy + sy * (k + fs * .65), sx > 0 ? 'start' : 'end'], sb = cy + RB + 4 + fs * .65;
    const cand = c.m.length < 2 ? [E, Wc, N, S] : eb && c.y === yt[0] ? [[mid, sb, 'middle'], [mid, sb + fs * 1.4, 'middle'], N, E, Wc] : [E, Wc, N, S, dg(1, -1), dg(-1, -1), dg(1, 1), dg(-1, 1), [mid, cy - dy - fs * 1.4, 'middle']];
    for (const [tx, ty, an] of cand) {
      const b = tb(tx, ty, w, an, fs);
      if (!inPlot(b) || dotB.some(d => over(b, d, 0)) || boxes.some(d => over(b, d, 2, 0))) continue;
      boxes.push(b);
      fade(text(g, tx, ty, c.lab, { base: 'middle', anchor: an, fill: 'var(--text)', size: fs, weight: bold ? 700 : null, halo: 1 }), at(i) + 140, MS.fade);
      break;
    }
  });
  const series = groups.map(gr => ({ name: gr, color: gcol(gr), kind: 'dot' }));
  if (xR || yR) series.push({ name: o.refLabel || 'Median', color: 'var(--muted)', kind: 'dashed', dash: '5 4', width: 1.5 });
  const hasSub = P.some(p => p.sub != null && p.sub !== '');
  B.describe(P.length + ' ' + (o.noun || 'points') + (o.xLabel ? ' · x ' + o.xLabel : '') + (o.yLabel ? ' · y ' + o.yLabel : '') + (CL.length < P.length ? ' · ' + (P.length - CL.length + CL.filter(c => c.m.length > 1).length) + ' share a position' : ''));
  return { series, destroy: B.destroy,
    tableView: () => [['Label', o.xLabel || 'x', o.yLabel || 'y'].concat(sizes.length ? [o.sizeLabel || 'Size'] : [], groups.length ? [o.groupLabel || 'Group'] : [], hasSub ? [o.subLabel || 'Detail'] : [])]
      .concat(P.map(p => [String(p.label), xf(p.x), yf(p.y)].concat(sizes.length ? [p.size == null ? '' : fmt(p.size)] : [], groups.length ? [isG(p) ? p.group : ''] : [], hasSub ? [p.sub == null ? '' : String(p.sub)] : []))) };
}

/* 6. calendar — GitHub-style calendar heatmap, weeks as columns. Cells take the panel width (their height stops at
   o.maxCell, 30px); zero or missing days are outlined empty cells; o.from..o.to is outlined and the best day ringed.
   Every day is a keyboard stop. The returned .scale feeds scaleLegend(). */
function calendar(host, o) {
  const days = (o.days || []).slice().sort((a, b) => a.date < b.date ? -1 : 1), f = o.format || fmt, ws = o.weekStart == null ? 1 : o.weekStart, th = 20;
  const map = {}; days.forEach(d => map[d.date] = d.value);
  const d0 = new Date(days[0].date + 'T00:00:00Z'), d1 = new Date(days[days.length - 1].date + 'T00:00:00Z');
  const start = new Date(d0); start.setUTCDate(start.getUTCDate() - ((d0.getUTCDay() - ws + 7) % 7));
  const nW = Math.ceil((Math.round((d1 - start) / 864e5) + 1) / 7), W0 = host.clientWidth || 600, gap = W0 < 480 ? 2 : 3, lw = W0 < 480 ? 26 : 34;
  const cw = Math.max(6, Math.floor((W0 - lw - gap * (nW - 1)) / nW)), cs = Math.min(cw, o.maxCell || 30);
  const h = th + 7 * cs + 6 * gap + 2, B = base(host, h, o), g = el('g', null, B.svg), max = Math.max(1, ...days.map(d => d.value || 0));
  const cx = w => lw + w * (cw + gap), cy = r => th + r * (cs + gap), ax = chrome(g), iso = d => d.toISOString().slice(0, 10);
  const pos = v => v != null && v > 0, col7 = v => pos(v) ? heat(v / max) : 'var(--line)';
  (cs >= 15 ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4]).forEach(r => text(ax, 0, cy(r) + cs / 2, DOW[(ws + r) % 7], { base: 'middle', size: 10 }));
  let lastM = -1, lastX = -99;
  const cells = [], at = {};
  for (let w = 0; w < nW; w++) for (let r = 0; r < 7; r++) {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + w * 7 + r); const k = iso(d), v = map[k], inR = d >= d0 && d <= d1;
    if (inR && d.getUTCMonth() !== lastM && cx(w) - lastX > 28) { lastM = d.getUTCMonth(); lastX = cx(w); text(ax, cx(w), 12, MON[lastM], { size: 10 }); }
    if (!inR) continue;
    /* diagonal ripple: delay by column + row; a day without sales is an outline, not the lowest step */
    ripple(el('rect', pos(v) ? { x: cx(w), y: cy(r), width: cw, height: cs, rx: 3, fill: heat(v / max) } : { x: cx(w) + .5, y: cy(r) + .5, width: cw - 1, height: cs - 1, rx: 2.5, fill: 'none', stroke: 'var(--line)', class: 'cjs-empty' }, g), MS.data + (w + r) / Math.max(1, nW + 5) * MS.stagger);
    cells.push(at[k] = { k, v, w, r });
  }
  const best = days.reduce((b, d) => pos(d.value) && (!b || d.value > b.value) ? d : b, null), T1 = MS.data + MS.stagger;
  const sel = k => !!(o.from && o.to && at[k] && k >= o.from && k <= o.to), nb = (k, n) => { const t = new Date(k + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return iso(t); };
  /* the selected period: one outline around its days (an edge wherever the neighbouring day is outside it) */
  let sp = '';
  cells.forEach(c => {
    if (!sel(c.k)) return;
    const H = gap / 2, L = cx(c.w) - H, R = cx(c.w) + cw + H, T = cy(c.r) - H, D = cy(c.r) + cs + H;
    if (c.r === 0 || !sel(nb(c.k, -1))) sp += `M${L},${T}H${R}`;
    if (c.r === 6 || !sel(nb(c.k, 1))) sp += `M${L},${D}H${R}`;
    if (!sel(nb(c.k, -7))) sp += `M${L},${T}V${D}`;
    if (!sel(nb(c.k, 7))) sp += `M${R},${T}V${D}`;
  });
  if (sp) fade(el('path', { d: sp, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, 'stroke-linecap': 'square', 'pointer-events': 'none' }, g), T1, MS.fade);
  if (best) { const c = at[best.date]; fade(el('circle', { cx: cx(c.w) + cw / 2, cy: cy(c.r) + cs / 2, r: Math.max(2.5, Math.min(cw, cs) / 2 - 4), fill: 'none', stroke: 'var(--card)', 'stroke-width': 1.5, 'pointer-events': 'none' }, g), T1, MS.fade); }
  const hl = el('rect', { width: cw, height: cs, rx: 3, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' }, g);
  const show = (c, e) => {
    hl.setAttribute('x', cx(c.w)); hl.setAttribute('y', cy(c.r)); hl.setAttribute('opacity', 1);
    const a = B.at(e, cx(c.w) + cw / 2, cy(c.r) - 4);
    B.tip(a.x, a.y, tt(c.k) + (best && c.k === best.date ? ' · best day' : ''), [{ label: o.label || 'Value', value: c.v == null ? '–' : f(c.v), color: col7(c.v) }], a.a);
  };
  const leave = () => { hl.setAttribute('opacity', 0); B.hide(); };
  const ov = el('rect', { x: lw, y: th, width: nW * (cw + gap), height: 7 * (cs + gap), fill: 'transparent' }, g);
  hover(ov, e => { const p = B.toVB(e), w = Math.floor((p.x - lw) / (cw + gap)), r = Math.floor((p.y - th) / (cs + gap)), c = cells.find(c => c.w === w && c.r === r); if (!c) { hl.setAttribute('opacity', 0); return B.hide(); } show(c, e); }, leave);
  cells.forEach(c => stop(e => show(c, e), leave, () => { const p = B.toClient(cx(c.w) + cw / 2, cy(c.r) + cs / 2); return { pointerType: 'kbd', clientX: p.x, clientY: p.y }; }));
  const nz = days.map(d => d.value).filter(pos);
  B.describe(days.length + ' days from ' + tt(days[0].date) + ' to ' + tt(days[days.length - 1].date) + (best ? ' · best ' + tt(best.date) + ' with ' + f(best.value) : ''));
  return { scale: { min: nz.length ? Math.min(...nz) : 0, max, fmt: f, colors: [1, 2, 3, 4, 5, 6, 7].map(i => 'var(--heat' + i + ')'), zero: o.zeroLabel || 'no ' + (o.label || 'data'),
      keys: [sp ? { kind: 'sel', label: o.selLabel || 'selected period' } : null, best ? { kind: 'best', label: 'best day' } : null].filter(Boolean) },
    destroy: B.destroy, tableView: () => [['Date', o.label || 'Value']].concat(days.map(d => [tt(d.date), d.value == null ? '' : f(d.value)])) };
}

/* 7. heatmap — generic rows × cols matrix with a sequential scale. Zero or missing cells are outlined empty cells; a
   printed value turns --card only on the strongest steps (t > .72; --hk1…7 can override per theme). Every cell is a
   keyboard stop. The returned .scale feeds scaleLegend(). */
function heatmap(host, o) {
  const rows = o.rows || [], cols = o.cols || [], V = o.values || [], f = o.format || fmt, h = o.height || 240, B = base(host, h, o), W = B.W, g = el('g', null, B.svg);
  const lw = Math.max(0, ...rows.map(r => measure(r))) + 10, th = 18, gap = 2, cw = (W - lw - gap * (cols.length - 1)) / cols.length, ch = (h - th - gap * (rows.length - 1)) / rows.length;
  const flat = V.flat().filter(v => v != null), lo = Math.min(...flat), hi = Math.max(...flat), t = v => (v - lo) / ((hi - lo) || 1), none = v => v == null || v === 0;
  const cx = c => lw + c * (cw + gap), cy = r => th + r * (ch + gap), showText = cw >= 36 && ch >= 16, ax = chrome(g);
  cols.forEach((c, j) => text(ax, cx(j) + cw / 2, 12, c, { anchor: 'middle', size: 10 }));
  rows.forEach((r, i) => text(ax, lw - 8, cy(i) + ch / 2, r, { anchor: 'end', base: 'middle', size: 10 }));
  rows.forEach((r, i) => cols.forEach((c, j) => {
    const v = (V[i] || [])[j], d = MS.data + (i + j) / Math.max(1, rows.length + cols.length - 2) * MS.stagger;
    ripple(el('rect', none(v) ? { x: cx(j) + .5, y: cy(i) + .5, width: cw - 1, height: ch - 1, rx: 2, fill: 'none', stroke: 'var(--line)', class: 'cjs-empty' } : { x: cx(j), y: cy(i), width: cw, height: ch, rx: 2, fill: heat(t(v)) }, g), d);
    if (showText && !none(v)) { const k = Math.max(1, Math.min(7, Math.ceil(t(v) * 7))); fade(text(g, cx(j) + cw / 2, cy(i) + ch / 2, f(v), { anchor: 'middle', base: 'middle', size: 10, fill: `var(--hk${k},${t(v) > .72 ? 'var(--card)' : 'var(--text)'})` }), d + 90, MS.cell - 90); }
  }));
  const hl = el('rect', { width: cw, height: ch, rx: 2, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' }, g);
  const show = (i, j, e) => {
    hl.setAttribute('x', cx(j)); hl.setAttribute('y', cy(i)); hl.setAttribute('opacity', 1);
    const v = (V[i] || [])[j], a = B.at(e, cx(j) + cw / 2, cy(i) - 4);
    B.tip(a.x, a.y, rows[i] + ' · ' + cols[j], [{ label: o.label || 'Value', value: v == null ? '–' : f(v), color: none(v) ? 'var(--line)' : heat(t(v)) }], a.a);
  };
  const leave = () => { hl.setAttribute('opacity', 0); B.hide(); };
  const ov = el('rect', { x: lw, y: th, width: W - lw, height: h - th, fill: 'transparent' }, g);
  hover(ov, e => {
    const p = B.toVB(e), j = Math.floor((p.x - lw) / (cw + gap)), i = Math.floor((p.y - th) / (ch + gap));
    if (i < 0 || j < 0 || i >= rows.length || j >= cols.length) { hl.setAttribute('opacity', 0); return B.hide(); }
    show(i, j, e);
  }, leave);
  rows.forEach((r, i) => cols.forEach((c, j) => stop(e => show(i, j, e), leave, () => { const p = B.toClient(cx(j) + cw / 2, cy(i) + ch / 2); return { pointerType: 'kbd', clientX: p.x, clientY: p.y }; })));
  const nz = flat.filter(v => v !== 0);
  B.describe(rows.length + ' × ' + cols.length + ' matrix' + (flat.length ? ' · from ' + f(lo) + ' to ' + f(hi) : ''));
  return { scale: { min: nz.length ? Math.min(...nz) : 0, max: hi, fmt: f, colors: [1, 2, 3, 4, 5, 6, 7].map(i => 'var(--heat' + i + ')'), zero: o.zeroLabel || 'none' },
    destroy: B.destroy, tableView: () => [[''].concat(cols)].concat(rows.map((r, i) => [r].concat(cols.map((c, j) => f((V[i] || [])[j]))))) };
}

/* 9. cumulative — actual vs cumulative target with gap shading and a dotted projection. The month end is named
   ('target 6,975', 'proj. 3,894') and a bracket between them states the gap ('−3,081 · 56%'). */
function cumulative(host, o) {
  const labels = o.labels || [], n = labels.length, A = o.actual || [], T = o.target || [], Pj = o.projection || [], f = o.format || fmt, h = o.height || 260;
  const B = base(host, h, o), W = B.W, g = el('g', null, B.svg), ac = col(o.color, 0), PD = '1 5';
  const all = [A, T, Pj].flat().filter(v => v != null), ticks = niceTicks(0, Math.max(...all), 4), tl = tickLab(f, ticks), lo = ticks[0], hi = ticks[ticks.length - 1];
  const la = lastIdx(A), lt = lastIdx(T), lp = lastIdx(Pj), nA = A.filter(v => v != null).length;
  const ee = lp > la ? Pj[lp] : la >= 0 && la === n - 1 ? A[la] : null, te = lt >= 0 ? T[lt] : null, gap = ee != null && te ? ee - te : null;
  const aT = la >= 0 ? f(A[la]) + (nA < 3 ? ' · day ' + (la + 1) + ' of ' + n : '') : '';
  /* the right-hand column: month-end labels and the gap between the projection and the target */
  const R = [];
  if (te != null) R.push({ v: te, t: 'target ' + f(te), c: 'var(--muted)' });
  if (lp > la) R.push({ v: Pj[lp], t: 'proj. ' + f(Pj[lp]), c: 'var(--muted)' });
  if (la >= 0 && la === n - 1) R.push({ v: A[la], t: aT, c: 'var(--text)', b: 1 });
  const brk = gap != null && Math.round(gap) !== 0;
  if (brk) R.push({ v: (ee + te) / 2, t: sign(gap) + f(Math.abs(gap)) + ' · ' + Math.round(ee / te * 100) + '%', c: gap < 0 ? 'var(--bad)' : 'var(--good)', b: 1, gap: 1 });
  const rw = Math.max(0, ...R.map(r => measure(r.t, 11, r.b ? 600 : 400)));
  const m = { t: 18, r: rw + 16 + (brk ? 10 : 0), b: 24, l: Math.max(28, Math.max(...ticks.map(t => measure(tl(t)))) + 12) }, pw = W - m.l - m.r, ph = h - m.t - m.b, step = n > 1 ? pw / (n - 1) : pw;
  const x = i => m.l + i * step, y = lin(lo, hi, m.t + ph, m.t), ax = chrome(g), T0 = MS.data;
  yAxis(ax, ticks, y, m.l, m.l + pw, f);
  xLabels(ax, labels.map(sd), x, h - 6, step, W);
  /* one x-paced clock: target and actual draw together, the projection carries on where the actual stops */
  const xa = x(0), xb = x(Math.max(0, n - 1)), at = xx => T0 + EZ.draw.t(Math.max(0, Math.min(1, (xx - xa) / ((xb - xa) || 1)))) * MS.draw;
  let good = '', bad = '';
  const quad = (xa, ya, xb, yb, ta, tb, c) => { const d = `M${xa.toFixed(1)},${ya.toFixed(1)}L${xb.toFixed(1)},${yb.toFixed(1)}L${xb.toFixed(1)},${tb.toFixed(1)}L${xa.toFixed(1)},${ta.toFixed(1)}Z`; if (c >= 0) good += d; else bad += d; };
  for (let i = 0; i < n - 1; i++) {
    if ([A[i], A[i + 1], T[i], T[i + 1]].some(v => v == null)) continue;
    const da = A[i] - T[i], db = A[i + 1] - T[i + 1];
    if (da * db >= 0) quad(x(i), y(A[i]), x(i + 1), y(A[i + 1]), y(T[i]), y(T[i + 1]), da + db);
    else { const tt = da / (da - db), xm = x(i) + tt * step, ym = y(A[i] + tt * (A[i + 1] - A[i])); quad(x(i), y(A[i]), xm, ym, y(T[i]), ym, da); quad(xm, ym, x(i + 1), y(A[i + 1]), ym, y(T[i + 1]), db); }
  }
  const gapIn = la >= 0 ? at(x(la)) : T0 + MS.draw * .6;   // the gap shading fades in once the actual has landed
  if (good) fade(el('path', { d: good, fill: 'var(--good)', 'fill-opacity': .12 }, g), gapIn, MS.wash);
  if (bad) fade(el('path', { d: bad, fill: 'var(--bad)', 'fill-opacity': .12 }, g), gapIn, MS.wash);
  const pts = a => a.map((v, i) => v == null ? null : [x(i), y(v)]);
  pen(g, pts(T), { fill: 'none', stroke: TGT, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, xa, xb, T0, MS.draw, '5 4');
  if (lp >= 0) pen(g, pts(Pj), { fill: 'none', stroke: ac, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, xa, xb, T0, MS.draw, PD);
  pen(g, pts(A), { fill: 'none', stroke: ac, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, xa, xb, T0, MS.draw);
  if (la >= 0) pop(dot(g, x(la), y(A[la]), ac, 4.5), at(x(la)) - 30, MS.pop);
  /* the actual's own label when it stops before the month end: beside its dot, below the line where there is room,
     else above it — always right of the y axis */
  if (la >= 0 && la < n - 1) { const ax0 = x(la), ay = y(A[la]), below = ay + 20 < m.t + ph; fade(text(g, Math.max(m.l + 6, ax0 + 8), below ? ay + 14 : ay - 11, aT, { fill: 'var(--text)', weight: 600, halo: 1 }), at(ax0), MS.fade, -4, 0); }
  const ex = x(n - 1), bx = ex + 7, lx = brk ? bx + 6 : ex + 10, ry = pushApart(R.map(r => y(r.v)), 13, m.t, m.t + ph), tEnd = at(xb);
  if (brk) fade(el('path', { d: `M${bx - 3},${y(ee).toFixed(1)}H${bx}V${y(te).toFixed(1)}H${bx - 3}`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1, opacity: .8 }, g), tEnd, MS.fade);
  R.forEach((r, j) => {
    if (!r.gap && Math.abs(ry[j] - y(r.v)) > 2) fade(el('line', { x1: ex + 4, y1: y(r.v), x2: lx - 2, y2: ry[j], stroke: 'var(--line)' }, g), tEnd, MS.fade);
    fade(text(g, lx, ry[j], r.t, { base: 'middle', fill: r.c, weight: r.b ? 600 : 400 }), tEnd + (r.gap ? 80 : 0), MS.fade, -4, 0);
  });
  crosshair(B, g, x, step, n, m.t, m.t + ph, [ac], (i, e, place) => {
    const v = A[i] != null ? A[i] : Pj[i]; place(0, x(i), v == null ? null : y(v));
    const items = [{ label: 'Actual', value: f(A[i]), color: ac }, { label: 'Target', value: f(T[i]), color: TGT }];
    if (A[i] != null && T[i] != null) { const d = A[i] - T[i]; items.push({ label: d >= 0 ? 'Ahead' : 'Behind', value: sign(d) + f(Math.abs(d)), color: d >= 0 ? 'var(--good)' : 'var(--bad)' }); }
    if (Pj[i] != null) items.push({ label: 'Projection', value: f(Pj[i]), color: ac });
    const top = Math.min(...[A[i], T[i], Pj[i]].filter(w => w != null).map(y), m.t + ph), a = B.at(e, x(i), top - 8);
    B.tip(a.a ? a.x : B.toClient(x(i), 0).x, a.y, tt(labels[i]), items, a.a);
  });
  B.describe('Cumulative sales' + (la >= 0 ? ' ' + f(A[la]) + ' by ' + tt(labels[la]) + (T[la] != null ? ' vs ' + f(T[la]) + ' planned' : '') : '') + (te != null ? ' · month-end target ' + f(te) : '') + (lp > la ? ' · projection ' + f(Pj[lp]) : '') + (brk ? ' (' + Math.round(ee / te * 100) + '% of target)' : ''));
  const series = [{ name: 'Actual', color: ac, kind: 'line' }, { name: 'Target', color: TGT, kind: 'dashed', dash: '5 4', width: 1.5 }];
  if (lp >= 0) series.push({ name: 'Projection', color: ac, kind: 'dashed', dash: PD, cap: 'round' });
  if (good) series.push({ name: 'Ahead', color: 'var(--good)', kind: 'area' });
  if (bad) series.push({ name: 'Behind', color: 'var(--bad)', kind: 'area' });
  return { series, destroy: B.destroy, tableView: () => [['Date', 'Actual', 'Target', 'Projection']].concat(labels.map((l, i) => [tt(l), A[i] == null ? '' : f(A[i]), T[i] == null ? '' : f(T[i]), Pj[i] == null ? '' : f(Pj[i])])) };
}

/* 10. sparkline — returns an SVG string for inline use (no container) */
function sparkline(values, o) {
  o = o || {}; const w = o.width || 120, h = o.height || 28, c = o.color || 'var(--ink,var(--text))', pad = 5, vs = values.filter(v => v != null);
  const lo = Math.min(...vs), hi = Math.max(...vs), x = lin(0, Math.max(1, values.length - 1), pad, w - pad), y = lin(lo, hi === lo ? lo + 1 : hi, h - pad, pad), li = lastIdx(values);
  const d = linePath(values.map((v, i) => v == null ? null : [x(i), y(v)]));
  const end = o.endDot !== false && li >= 0 ? `<circle cx="${x(li).toFixed(1)}" cy="${y(values[li]).toFixed(1)}" r="3.5" fill="${c}" stroke="var(--card)" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle;overflow:visible" aria-hidden="true"><path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${end}</svg>`;
}

/* gauge figure: counts in lock-step with the sweep animation, so a host pausing the sweep pauses the number too */
function follow(node, to, f, a, alive) {
  if (!a || !window.requestAnimationFrame) { node.textContent = f(to); return; }
  const tm = a.effect.getTiming(), d = tm.delay || 0, D = +tm.duration || 1;
  const tick = () => {
    const ps = a.playState;
    if (ps === 'finished' || ps === 'idle' || !alive()) { node.textContent = f(to); return; }
    node.textContent = f(to * EZ.out.y(Math.max(0, Math.min(1, ((+a.currentTime || 0) - d) / D))));
    requestAnimationFrame(tick);
  };
  tick();
}

/* 12. smallMultiples — grid of mini lines on one shared y-scale. Tick labels (11px) sit in a gutter left of the first
   column; each panel names its last day ('last day 7 ▲': end dot and arrow good/bad against the item's target, which is
   dashed in the target token); panels with nothing below them carry the first and last dates. o.highlight (a title)
   tints that panel. Under 480px: ~104px columns, 78px rows, the last-day line under the title. */
function smallMultiples(host, o) {
  const items = o.items || [], W0 = host.clientWidth || 600, nar = W0 < 480, f = o.format || fmt, INK = 'var(--ink,var(--text))';
  const cols = Math.max(1, Math.min(o.columns || 4, Math.floor(W0 / (nar ? 104 : 130)))), ch = nar ? 78 : (o.cellHeight || 110), gap = nar ? 12 : 16, rows = Math.ceil(items.length / cols), DB = 14;
  const all = items.flatMap(it => it.values.filter(v => v != null).concat(it.target != null ? [it.target] : []));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 2), lo = ticks[0], hi = ticks[ticks.length - 1], gw = Math.max(0, ...ticks.map(t => measure(f(t), 11))) + 6;
  const B = base(host, rows * ch + Math.max(0, rows - 1) * gap + DB, o), W = B.W, cw = (W - gw - gap * (cols - 1)) / cols, pw = cw - 4, hd = nar ? 34 : 26, ph = ch - hd - 6;
  items.forEach((it, k) => {
    const c = k % cols, ox = gw + c * (cw + gap), oy = Math.floor(k / cols) * (ch + gap), n = it.values.length, li = lastIdx(it.values), lv = li >= 0 ? it.values[li] : null;
    const x = i => ox + (n > 1 ? i / (n - 1) : .5) * pw, y = lin(lo, hi, oy + hd + ph, oy + hd), g = el('g', null, B.svg), ax = chrome(g), d = MS.data + stag(k, items.length, 60, 320);
    const vs = it.target != null && lv != null ? (lv >= it.target ? 1 : -1) : 0, ec = vs > 0 ? 'var(--good)' : vs < 0 ? 'var(--bad)' : INK;
    if (o.highlight != null && it.title === o.highlight) el('rect', { x: ox - gap / 2 + 2, y: oy - 6, width: cw + gap - 4, height: ch + 8, rx: 10, fill: 'var(--teal-soft,var(--soft))' }, ax);
    /* title, then 'last day N ▲' — beside it, or on its own line when narrow */
    const lt = 'last day ', vt = lv == null ? '–' : f(lv), ar = vs > 0 ? ' ▲' : vs < 0 ? ' ▼' : '', rw = measure(lt, 10) + measure(vt, 12, 600) + (ar ? measure(ar, 10) : 0);
    const tt0 = text(ax, ox, oy + 12, fitText(it.title, nar ? 11.5 : 12, 600, nar ? pw : pw - rw - 10), { fill: 'var(--text)', size: nar ? 11.5 : 12, weight: 600 });
    if (tt0.textContent !== String(it.title)) el('title', null, tt0).textContent = it.title;
    const lb = text(ax, nar ? ox : ox + pw, oy + (nar ? 27 : 12), '', { anchor: nar ? 'start' : 'end', size: 10 });
    el('tspan', null, lb).textContent = lt;
    el('tspan', { 'font-size': 12, 'font-weight': 600, fill: 'var(--text)' }, lb).textContent = vt;
    if (ar) el('tspan', { fill: ec }, lb).textContent = ar;
    ticks.forEach((t, i) => { el('line', { x1: ox, x2: ox + pw, y1: y(t), y2: y(t), stroke: i ? 'var(--grid)' : 'var(--line)', 'shape-rendering': 'crispEdges' }, ax); if (c === 0) text(ax, ox - 6, y(t), f(t), { anchor: 'end', base: 'middle', size: 11 }); });
    if (k + cols >= items.length && n > 1 && it.labels) { text(ax, x(0), oy + ch + 11, sd(it.labels[0]), { size: 10 }); text(ax, x(n - 1), oy + ch + 11, sd(it.labels[n - 1]), { size: 10, anchor: 'end' }); }
    if (it.target != null) draw(dashed(g, ox, ox + pw, y(it.target), y(it.target), TGT), pw, d, MS.ref - 80);
    const P = pen(g, it.values.map((v, i) => v == null ? null : [x(i), y(v)]), { fill: 'none', stroke: INK, 'stroke-width': nar ? 1.75 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, x(0), x(Math.max(0, n - 1)), d, 480);
    if (li >= 0) pop(dot(g, x(li), y(lv), ec, 3.5), P.at(x(li)) - 60, MS.pop);
    crosshair(B, g, x, n > 1 ? pw / (n - 1) : pw, n, oy + hd, oy + hd + ph, [INK], (i, e, place) => {
      const v = it.values[i]; place(0, x(i), v == null ? null : y(v));
      const rs = [{ label: it.title, value: f(v), color: INK }]; if (it.target != null) rs.push({ label: o.targetLabel || 'Target', value: tgtVal(f, it.target), color: TGT });
      const a = B.at(e, x(i), (v == null ? oy + hd : y(v)) - 8);
      B.tip(a.x, a.y, (it.labels || [])[i] != null ? tt(it.labels[i]) : String(i + 1), rs, a.a);
    });
  });
  const L = (items[0] && items[0].labels) || [];
  B.describe(items.length + ' panels' + (L.length ? ' · ' + tt(L[0]) + ' to ' + tt(L[L.length - 1]) : '') + ' · last day ' + items.slice(0, 12).map(it => it.title + ' ' + f(it.values[lastIdx(it.values)])).join(', ') + (items.length > 12 ? ', …' : ''));
  const series = [{ name: o.seriesLabel || 'Per day', color: INK, kind: 'line' }];
  if (items.some(it => it.target != null)) series.push({ name: o.targetLabel || 'Target', color: TGT, kind: 'dashed', dash: '5 4', width: 1.5 });
  return { series, destroy: B.destroy, tableView: () => [['Date'].concat(items.map(it => it.title))].concat(L.map((l, i) => [tt(l)].concat(items.map(it => f(it.values[i]))))) };
}

/* ---------- chart forms: contrib, dumbbell, dotStrip (each returns {series, destroy, tableView}) and scaleLegend ---------- */
const escH = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
/* a label cut to fit w px, ending in an ellipsis */
function fitText(s, size, weight, w) {
  s = String(s); if (measure(s, size, weight) <= w) return s;
  while (s.length > 1 && measure(s + '…', size, weight) > w) s = s.slice(0, -1);
  return s.replace(/\s+$/, '') + '…';
}

/* 14. contrib — named contribution bars: one row per step {label, delta}, sorted by |delta|, the rest folded into
   'Other teams' (o.maxRows, 10). Bars diverge from a zero hairline (--good up, --bad down, 14px, rounded data end) with
   the signed value at each tip. o.head is the line above the rows: chunks of [text, colour?, weight?] segments, joined
   with ' · ' and wrapped whole. Height rows × 26 + 30 (16px more per wrapped head line). */
function contrib(host, o) {
  const f = o.format || fmt, mx = Math.max(2, o.maxRows || 10), W0 = host.clientWidth || 600, RH = 26, BH = 14, HS = 11.5, NS = 12;
  const isO = s => /^other\b/i.test(s.label), steps = (o.steps || []).filter(s => s && s.delta), pre = steps.some(isO);
  let rows = steps.filter(s => !isO(s)).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), rest = steps.filter(isO).reduce((a, s) => a + s.delta, 0), folded = 0;
  if (rows.length + (rest || pre ? 1 : 0) > mx) { const cut = rows.slice(mx - 1); folded = cut.length; rest += cut.reduce((a, s) => a + s.delta, 0); rows = rows.slice(0, mx - 1); }
  rows = rows.map(s => ({ label: String(s.label), delta: s.delta }));
  if (rest || folded) rows.push({ label: o.otherLabel || 'Other teams', delta: rest, other: true, n: pre ? 0 : folded });
  /* the head line(s) */
  const SEP = ' · ', sepW = measure(SEP, HS), segW = c => c.reduce((a, s) => a + measure(s[0], HS, s[2] || 400), 0), lines = [];
  (o.head || []).forEach(c => { const w = segW(c), L = lines[lines.length - 1]; if (L && L.w + sepW + w <= W0) { L.c.push(c); L.w += sepW + w; } else lines.push({ c: [c], w }); });
  const top = lines.length ? 12 + lines.length * 16 : 4, h = top + rows.length * RH + 2, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg), ax = chrome(g), T0 = MS.data;
  lines.forEach((L, j) => {
    const t = text(ax, 0, 13 + j * 16, '', { size: HS });
    L.c.forEach((c, k) => { if (k) el('tspan', null, t).textContent = SEP; c.forEach(s => { el('tspan', { fill: s[1] || null, 'font-weight': s[2] || null }, t).textContent = s[0]; }); });
  });
  /* columns: measured names | negative values | bars | positive values */
  const vt = r => sign(r.delta) + f(Math.abs(r.delta)), vw = r => measure(vt(r), 11, 600) + 7;
  const nw = Math.min(Math.max(0, ...rows.map(r => measure(r.label, NS, 500))), W * .42) + 12;
  const nL = Math.max(0, ...rows.filter(r => r.delta < 0).map(vw)), pR = Math.max(0, ...rows.filter(r => r.delta > 0).map(vw));
  const x = lin(Math.min(0, ...rows.map(r => r.delta)), Math.max(0, ...rows.map(r => r.delta)), nw + nL, W - pR), x0 = x(0);
  el('line', { x1: x0, x2: x0, y1: top - 3, y2: h, stroke: 'var(--muted)', 'stroke-opacity': .5, 'shape-rendering': 'crispEdges' }, ax);
  const marks = [];
  rows.forEach((r, i) => {
    const cy = top + i * RH + RH / 2, up = r.delta > 0, c = up ? 'var(--good)' : r.delta < 0 ? 'var(--bad)' : 'var(--muted)', xv = x(r.delta), d = T0 + stag(i, rows.length, 45);
    const nm = text(ax, 0, cy, fitText(r.label, NS, 500, nw - 12), { base: 'middle', size: NS, weight: 500, fill: r.other ? 'var(--muted)' : 'var(--text)' });
    if (nm.textContent !== r.label) el('title', null, nm).textContent = r.label;
    const p = el('path', { d: barPath(Math.min(x0, xv), cy - BH / 2, Math.max(1, Math.abs(xv - x0)), BH, 4, up ? 'right' : 'left'), fill: c, 'fill-opacity': r.other ? .55 : null }, g);
    grow(p, up ? '0% 50%' : '100% 50%', 'scaleX', d, MS.grow);
    const lb = fade(text(g, up ? xv + 6 : xv - 6, cy, vt(r), { base: 'middle', anchor: up ? 'start' : 'end', size: 11, weight: 600, fill: 'var(--text)' }), d + MS.grow * .55, MS.fade, up ? -4 : 4, 0);
    marks.push([p, lb]);
    hit(hits, 0, cy - RH / 2, W, RH, e => {
      F.on(i);
      const it = [{ label: o.valueLabel || 'Change', value: vt(r), color: c }]; if (r.other && r.n) it.push({ label: 'Teams', value: String(r.n) });
      const a = B.at(e, xv, cy - BH / 2 - 4); B.tip(a.x, a.y, r.label, it, a.a);
    }, () => { F.off(); B.hide(); });
  });
  const F = focus(marks), ht = lines.map(L => L.c.map(c => c.map(s => s[0]).join('')).join(SEP)).join(SEP);
  B.describe((ht ? ht + ' · ' : '') + rows.map(r => r.label + ' ' + vt(r)).join(', '));
  return { series: [{ name: o.upLabel || 'Up', color: 'var(--good)', kind: 'bar' }, { name: o.downLabel || 'Down', color: 'var(--bad)', kind: 'bar' }], destroy: B.destroy,
    tableView: () => [[o.labelHead || 'Team', o.valueLabel || 'Change']].concat(rows.map(r => [r.label + (r.other && r.n ? ' (' + r.n + ')' : ''), vt(r)])) };
}

/* 15. dumbbell — one 24px row per item {label, from, to}, sorted by change: the prior value is a hollow muted ring, the
   current a filled ink dot, joined by a 2px --good/--bad/--muted line, with the signed change and % on the right. The
   x axis starts at 0. Height 24 × n + 30 (a key line and the tick labels on top). */
function dumbbell(host, o) {
  const f = o.format || fmt, RH = 24, TOP = 30, INK = 'var(--ink,var(--text))', fl = o.fromLabel || 'Before', tl = o.toLabel || 'After';
  const items = (o.items || []).slice().sort((a, b) => (b.to - b.from) - (a.to - a.from) || b.to - a.to);
  const h = RH * items.length + TOP, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const dl = it => it.to - it.from, dc = it => dl(it) > 0 ? 'var(--good)' : dl(it) < 0 ? 'var(--bad)' : 'var(--muted)';
  const dt = it => sign(dl(it)) + f(Math.abs(dl(it))), pt = it => it.from ? sign(dl(it)) + Math.round(Math.abs(dl(it)) / it.from * 100) + '%' : dl(it) ? 'new' : '';
  const rw = Math.max(measure(o.changeLabel || 'change', 10), ...items.map(it => measure(dt(it), 11, 600) + (pt(it) ? measure(' · ' + pt(it), 11) : 0))) + 12;
  const nw = Math.min(Math.max(0, ...items.map(it => measure(it.label, 12))), W * .38) + 12;
  const ticks = niceTicks(0, Math.max(1, ...items.flatMap(it => [it.from, it.to])), W < 480 ? 3 : 5), x = lin(0, ticks[ticks.length - 1], nw + 6, W - rw - 6), tk = tickLab(f, ticks);
  const ax = chrome(g), T0 = MS.data;
  /* key: ring = prior, dot = current; the change column's name on the right; tick labels on the line below */
  el('circle', { cx: 4, cy: 8, r: 3.5, fill: 'var(--card)', stroke: 'var(--muted)', 'stroke-width': 1.5 }, ax);
  text(ax, 12, 8, fl, { base: 'middle', size: 10 });
  const k2 = 12 + measure(fl, 10) + 14;
  el('circle', { cx: k2 + 4, cy: 8, r: 4, fill: INK }, ax);
  text(ax, k2 + 12, 8, tl, { base: 'middle', size: 10 });
  text(ax, W, 8, o.changeLabel || 'change', { base: 'middle', anchor: 'end', size: 10 });
  ticks.forEach((t, i) => { el('line', { x1: x(t), x2: x(t), y1: TOP - 4, y2: h, stroke: i ? 'var(--grid)' : 'var(--line)', 'shape-rendering': 'crispEdges' }, ax); text(ax, x(t), 23, tk(t), { anchor: 'middle', size: 10 }); });
  const marks = [];
  items.forEach((it, i) => {
    const cy = TOP + i * RH + RH / 2, c = dc(it), xa = x(it.from), xb = x(it.to), d = T0 + stag(i, items.length, 40, 300);
    const nm = text(ax, 0, cy, fitText(it.label, 12, 400, nw - 12), { base: 'middle', size: 12, fill: 'var(--text)' });
    if (nm.textContent !== String(it.label)) el('title', null, nm).textContent = it.label;
    const ln = draw(el('line', { x1: xa, x2: xb, y1: cy, y2: cy, stroke: c, 'stroke-width': 2, 'stroke-linecap': 'round' }, g), Math.abs(xb - xa), d + 80, 360);
    const r0 = pop(el('circle', { cx: xa, cy, r: 4, fill: 'var(--card)', stroke: 'var(--muted)', 'stroke-width': 1.5 }, g), d, MS.pop);
    const r1 = pop(el('circle', { cx: xb, cy, r: 4.5, fill: INK, stroke: 'var(--card)', 'stroke-width': 1.5 }, g), d + 380, MS.pop);
    const tx = text(g, W, cy, '', { base: 'middle', anchor: 'end', size: 11 });
    el('tspan', { 'font-weight': 600, fill: c }, tx).textContent = dt(it);
    if (pt(it)) el('tspan', null, tx).textContent = ' · ' + pt(it);
    marks.push([ln, r0, r1, fade(tx, d + 380, MS.fade)]);
    hit(hits, 0, cy - RH / 2, W, RH, e => {
      F.on(i);
      const a = B.at(e, xb, cy - 8);
      B.tip(a.x, a.y, String(it.label), [{ label: fl, value: f(it.from), color: 'var(--muted)' }, { label: tl, value: f(it.to), color: INK }, { label: 'Change', value: dt(it) + (pt(it) ? ' (' + pt(it) + ')' : ''), vc: c }], a.a);
    }, () => { F.off(); B.hide(); });
  });
  const F = focus(marks);
  B.describe(items.length + ' rows, ' + fl + ' to ' + tl + ': ' + items.slice(0, 12).map(it => it.label + ' ' + f(it.from) + ' to ' + f(it.to)).join(', ') + (items.length > 12 ? ', …' : ''));
  return { series: [{ name: fl, color: 'var(--muted)', kind: 'dot' }, { name: tl, color: INK, kind: 'dot' }], destroy: B.destroy,
    tableView: () => [[o.labelHead || 'Team', fl, tl, 'Change']].concat(items.map(it => [String(it.label), f(it.from), f(it.to), dt(it) + (pt(it) ? ' (' + pt(it) + ')' : '')])) };
}

/* 16. dotStrip — one 8px dot per value {label, value} along x; dots closer than 9px stack upwards. At or above o.target
   a dot is ink, below it --other; the target is a dashed target-token line with a haloed label. Height 120, taller only
   when a stack needs it. */
function dotStrip(host, o) {
  const V = (o.values || []).filter(d => d && d.value != null && isFinite(d.value)), f = o.format || fmt, tg = o.target, INK = 'var(--ink,var(--text))', R = 4, P = 9;
  const W0 = host.clientWidth || 600, vals = V.map(d => d.value).concat(tg != null ? [tg] : []);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals) || 1, W0 < 480 ? 4 : 6), tl = o.tickFormat || tickFmt(ticks.length > 1 ? ticks[1] - ticks[0] : 1);
  const m = { t: 22, r: 14, b: o.xLabel ? 38 : 22, l: 14 }, x = lin(ticks[0], ticks[ticks.length - 1], m.l, W0 - m.r);
  const S = V.map(d => ({ d, px: x(d.value) })).sort((a, b) => a.px - b.px), lv = [];
  S.forEach(s => { let k = 0; while (lv[k] != null && s.px - lv[k] < P) k++; lv[k] = s.px; s.k = k; });
  const h = Math.max(o.height || 120, m.t + m.b + 2 + lv.length * P), B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg), yb = h - m.b - 6, ax = chrome(g), T0 = MS.data;
  ticks.forEach(t => { el('line', { x1: x(t), x2: x(t), y1: m.t, y2: h - m.b, stroke: 'var(--grid)', 'shape-rendering': 'crispEdges' }, ax); text(ax, x(t), h - m.b + 15, tl(t), { anchor: 'middle', size: 10 }); });
  el('line', { x1: m.l, x2: W - m.r, y1: h - m.b, y2: h - m.b, stroke: 'var(--line)', 'shape-rendering': 'crispEdges' }, ax);
  if (o.xLabel) text(ax, (m.l + W - m.r) / 2, h - 4, o.xLabel, { anchor: 'middle', size: 10 });
  if (tg != null) { const tx = x(tg); draw(dashed(g, tx, tx, m.t - 4, h - m.b, TGT), h - m.b - m.t + 4, T0, MS.ref); fade(text(g, tx, m.t - 10, o.targetLabel || 'Target ' + tgtVal(f, tg), { anchor: tx > W * .8 ? 'end' : tx < W * .2 ? 'start' : 'middle', size: 10, weight: 600, fill: 'var(--text)', halo: 1 }), T0 + 60, MS.fade, 0, -4); }
  S.forEach((s, j) => {
    const c = tg == null || s.d.value >= tg ? INK : 'var(--other)', cx = s.px, cy = yb - s.k * P;
    const dn = pop(el('circle', { cx, cy, r: R, fill: c, stroke: 'var(--card)', 'stroke-width': 1.5 }, g), T0 + 120 + stag(j, S.length, 25, 360), MS.pop);
    hover(el('circle', { cx, cy, r: 12, fill: 'transparent' }, hits), e => {   // 24px touch target, like the scatter
      dn.setAttribute('r', R + 1.5);
      const it = [{ label: o.valueLabel || 'Value', value: f(s.d.value), color: c }];
      if (tg != null) { const d = s.d.value - tg; it.push({ label: 'vs target', value: sign(d) + f(Math.abs(d)), vc: d >= 0 ? 'var(--good)' : 'var(--bad)' }); }
      const a = B.at(e, cx, cy - 8); B.tip(a.x, a.y, String(s.d.label), it, a.a);
    }, () => { dn.setAttribute('r', R); B.hide(); });
  });
  const nb = tg == null ? 0 : V.filter(d => d.value < tg).length;
  B.describe(V.length + ' values' + (tg != null ? ' · ' + (V.length - nb) + ' at or above target ' + tgtVal(f, tg) + ', ' + nb + ' below' : ''));
  const series = [{ name: tg != null ? o.aboveLabel || 'At or above target' : o.valueLabel || 'Value', color: INK, kind: 'dot' }];
  if (nb) series.push({ name: o.belowLabel || 'Below target', color: 'var(--other)', kind: 'dot' });
  if (tg != null) series.push({ name: o.targetLabel || 'Target', color: TGT, kind: 'dashed', dash: '5 4', width: 1.5 });
  return { series, destroy: B.destroy, tableView: () => [[o.labelHead || 'Name', o.valueLabel || 'Value']].concat(V.slice().sort((a, b) => b.value - a.value).map(d => [String(d.label), f(d.value)])) };
}

/* scaleLegend — the key for a calendar's or heatmap's .scale: 'fewer' min [7 swatches] max 'more', an outlined swatch
   for zero, then the chart's own keys (selected period, best day). host is the key element, or the chart's figure:
   a .scale-legend at the end of the figure's parent is made once and reused. */
function scaleLegend(host, s) {
  if (!host || !s) return null;
  if (host.tagName === 'FIGURE') {
    const fg = host, p = fg.parentElement;
    host = p && p.querySelector(':scope > .scale-legend[data-for="' + fg.id + '"]');
    if (!host && p) { host = document.createElement('div'); host.dataset.for = fg.id; p.appendChild(host); }
    if (!host) return null;
  }
  const f = s.fmt || fmt;
  host.classList.add('scale-legend');
  host.innerHTML = `<span class="sl-ramp"><span class="sl-cap">fewer</span><b>${escH(f(s.min))}</b><span class="sl-sws" aria-hidden="true">${(s.colors || []).map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${escH(f(s.max))}</b><span class="sl-cap">more</span></span>`
    + (s.zero ? `<span class="sl-k"><i class="sl-sw sl-none" aria-hidden="true"></i>${escH(s.zero)}</span>` : '')
    + (s.keys || []).map(k => `<span class="sl-k"><i class="sl-sw sl-${k.kind}" aria-hidden="true"></i>${escH(k.label)}</span>`).join('');
  return host;
}

window.Charts = { line, columns, bullet, scatter, calendar, heatmap, cumulative, sparkline, smallMultiples, contrib, dumbbell, dotStrip, scaleLegend, niceTicks, format: fmt, version: '1.2.0' };   // slope, waterfall, donutGauge, histogram and countUp were unused and are gone (size)
})();
