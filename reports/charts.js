/* charts.js — dependency-free inline-SVG chart library (ES2020, no build). Exposes window.Charts.
   Colours come only from host CSS custom properties (--s1…--s5, --other, --good, --bad, --warn,
   --text, --muted, --line, --grid, --card, --soft, --heat1…--heat7). */
(function () {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const EASE = 'cubic-bezier(.22,.61,.36,1)';
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SER = ['s1','s2','s3','s4','s5'];
let FONT = 'sans-serif', ctx;

/* ---------- shared helpers ---------- */
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
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
const col = (c, i) => !c ? 'var(--' + SER[i % 5] + ')' : /^(var\(|#|rgb|hsl)/.test(c) ? c : 'var(--' + c + ')';
const fmt = v => {
  if (v == null || isNaN(v)) return '–';
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
    : (Math.round(v * 10) / 10).toLocaleString();
};
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
const isISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const sd = s => isISO(s) ? MON[+s.slice(5, 7) - 1] + ' ' + +s.slice(8, 10) : s;
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
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
/* push label y positions apart by >= gap, keeping them within [lo, hi] */
function pushApart(ys, gap, lo, hi) {
  const idx = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]), out = ys.slice();
  for (let k = 1; k < idx.length; k++) out[idx[k]] = Math.max(out[idx[k]], out[idx[k - 1]] + gap);
  const over = out[idx[idx.length - 1]] - hi;
  if (over > 0) idx.forEach(i => out[i] -= over);
  for (let k = idx.length - 2; k >= 0; k--) out[idx[k]] = Math.min(out[idx[k]], out[idx[k + 1]] - gap);
  const under = lo - out[idx[0]];
  if (under > 0) idx.forEach(i => out[i] += under);
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
/* ---------- animation (Web Animations API; skipped under prefers-reduced-motion) ---------- */
function anim(n, frames, o) {
  if (reduced() || !n.animate) return null;
  try { return n.animate(frames, Object.assign({ duration: 700, easing: EASE, fill: 'backwards' }, o)); } catch (e) { return null; }
}
function drawIn(p, delay, dash) {
  const L = p.getTotalLength ? p.getTotalLength() : 0;
  const done = () => { if (dash) p.setAttribute('stroke-dasharray', dash); else p.removeAttribute('stroke-dasharray'); };
  if (!L || reduced()) return done();
  p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', 0);
  const a = anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 750, delay: delay || 0 });
  if (a) a.onfinish = done; else done();
}
function grow(n, origin, axis, delay) {
  n.style.transformBox = 'fill-box'; n.style.transformOrigin = origin;
  anim(n, [{ transform: axis + '(0.001)' }, { transform: axis + '(1)' }], { duration: 600, delay: delay || 0 });
}
function pop(n, delay) {
  n.style.transformBox = 'fill-box'; n.style.transformOrigin = 'center';
  anim(n, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 400, delay: delay || 0 });
}
function fade(n, delay, dur) { anim(n, [{ opacity: 0 }, { opacity: 1 }], { duration: dur || 500, delay: delay || 0 }); return n; }

/* ---------- chart scaffolding ---------- */
function base(host, h, o) {
  FONT = getComputedStyle(host).fontFamily || 'sans-serif';
  host.innerHTML = '';
  const W = host.clientWidth || 600;
  const svg = el('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', role: 'img' }, host);
  svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible;font-family:inherit';
  const rect = () => svg.getBoundingClientRect();
  return {
    W, h, svg, host,
    toVB: e => { const r = rect(); return { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * h / (r.height || h) }; },
    toClient: (x, y) => { const r = rect(); return { x: r.left + x * (r.width || W) / W, y: r.top + y * (r.height || h) / h }; },
    tip: (x, y, title, items) => { if (o.tip) o.tip(x, y, title, items); },
    hide: () => { if (o.hideTip) o.hideTip(); },
    destroy: () => { if (svg.getAnimations) svg.getAnimations({ subtree: true }).forEach(a => a.cancel()); host.innerHTML = ''; }
  };
}
function yAxis(g, ticks, y, x0, x1, f) {
  ticks.forEach((t, i) => {
    el('line', { x1: x0, x2: x1, y1: y(t), y2: y(t), stroke: i ? 'var(--grid)' : 'var(--line)', 'shape-rendering': 'crispEdges' }, g);
    text(g, x0 - 8, y(t), f(t), { anchor: 'end', base: 'middle' });
  });
}
function xLabels(g, labels, x, y, slot, W) {
  const w = Math.max(0, ...labels.map(l => measure(l))) + 10, k = Math.max(1, Math.ceil(w / slot));
  for (let i = 0; i < labels.length; i += k) {
    const px = x(i);
    text(g, px, y, labels[i], { anchor: px < w / 2 ? 'start' : px > W - w / 2 ? 'end' : 'middle' });
  }
}
/* transparent hit rect, expanded to >= 24px in each dimension */
function hover(n, enter, leave) { n.addEventListener('pointerenter', enter); n.addEventListener('pointermove', enter); n.addEventListener('pointerleave', leave); return n; }
function hit(g, x, y, w, h, enter, leave) {
  const px = Math.max(0, (24 - w) / 2), py = Math.max(0, (24 - h) / 2);
  return hover(el('rect', { x: x - px, y: y - py, width: w + 2 * px, height: h + 2 * py, fill: 'transparent' }, g), enter, leave);
}
/* crosshair overlay: snaps to nearest index, calls onIdx(i, e) with hover dots to position */
function crosshair(B, g, x, step, n, y0, y1, colors, onIdx, off) {
  const ln = el('line', { y1: y0, y2: y1, stroke: 'var(--muted)', opacity: 0 }, g);
  const dots = colors.map(c => el('circle', { r: 4.5, fill: c, stroke: 'var(--card)', 'stroke-width': 2, opacity: 0 }, g));
  const ov = el('rect', { x: x(0) - step / 2, y: y0, width: step * n, height: y1 - y0, fill: 'transparent' }, g);
  const place = (k, cx, cy) => { dots[k].setAttribute('opacity', cy == null ? 0 : 1); if (cy != null) { dots[k].setAttribute('cx', cx); dots[k].setAttribute('cy', cy); } };
  hover(ov, e => { const i = Math.max(0, Math.min(n - 1, Math.round((B.toVB(e).x - (off || 0) - x(0)) / step))); ln.setAttribute('x1', x(i)); ln.setAttribute('x2', x(i)); ln.setAttribute('opacity', 1); onIdx(i, e, place); },
    () => { ln.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); B.hide(); });
}
const dashed = (g, x1, x2, y1, y2, c) => el('line', { x1, x2, y1, y2, stroke: c || 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
const dot = (g, cx, cy, c, r) => el('circle', { cx, cy, r: r || 4, fill: c, stroke: 'var(--card)', 'stroke-width': 2 }, g);
const lastIdx = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };
const sign = v => v > 0 ? '+' : v < 0 ? '−' : '';

/* 1. line — multi-series line/area with target, volume band, weekend shade, crosshair tooltip */
function line(host, o) {
  const h = o.height || 260, B = base(host, h, o), W = B.W, g = el('g', null, B.svg);
  const labels = o.labels || [], n = labels.length, S = (o.series || []).map((s, i) => Object.assign({}, s, { color: col(s.color, i) }));
  const yf = o.yFormat || (o.pctAxis ? v => Math.round(v) + '%' : fmt);
  const vals = S.flatMap(s => s.values.filter(v => v != null)); if (o.target != null) vals.push(o.target);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals); if (o.pctAxis) hi = Math.max(hi, 100);
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const volH = o.volume ? 44 : 0, ends = S.map(s => lastIdx(s.values));
  const endW = Math.max(0, ...ends.map((e, k) => e < 0 ? 0 : measure(yf(S[k].values[e]), 11, 600)));
  const m = { t: 18, r: Math.max(16, endW + 16), b: 24 + (volH ? volH + 8 : 0), l: Math.max(28, Math.max(...ticks.map(t => measure(yf(t)))) + 12) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, step = n > 1 ? pw / (n - 1) : pw;
  const x = i => m.l + (n > 1 ? i * step : pw / 2), y = lin(lo, hi, m.t + ph, m.t), bottom = m.t + ph + (volH ? volH + 8 : 0);
  if (o.weekendShade) labels.forEach((l, i) => { if (isISO(l) && dow(l) % 6 === 0) el('rect', { x: x(i) - step / 2, y: m.t, width: step, height: bottom - m.t, fill: 'var(--soft)' }, g); });
  yAxis(g, ticks, y, m.l, m.l + pw, yf);
  xLabels(g, labels.map(sd), x, h - 6, step, W);
  if (volH) {
    const vy = lin(0, Math.max(...o.volume), bottom, m.t + ph + 8), bw = Math.min(24, step * .6);
    el('line', { x1: m.l, x2: m.l + pw, y1: bottom, y2: bottom, stroke: 'var(--line)' }, g);
    o.volume.forEach((v, i) => grow(el('path', { d: barPath(x(i) - bw / 2, vy(v), bw, bottom - vy(v), 3, 'top'), fill: 'var(--other)', 'fill-opacity': .6 }, g), '50% 100%', 'scaleY', i * 10));
  }
  if (o.target != null) { const ty = y(o.target); dashed(g, m.l, m.l + pw, ty, ty); text(g, m.l + 4, ty - 5, o.targetLabel || 'Target', { size: 10, halo: 1 }); }
  S.forEach((s, k) => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]);
    if (s.area) {
      let d = '', run = [];
      const flush = () => { if (run.length) d += 'M' + run[0][0].toFixed(1) + ',' + y(lo).toFixed(1) + run.map(p => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('') + 'L' + run[run.length - 1][0].toFixed(1) + ',' + y(lo).toFixed(1) + 'Z'; run = []; };
      pts.forEach(p => p ? run.push(p) : flush()); flush();
      fade(el('path', { d, fill: s.color, 'fill-opacity': .1 }, g), 200, 600);
    }
    drawIn(el('path', { d: linePath(pts), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g), k * 100, s.dash ? '6 4' : null);
    if (s.markers) pts.forEach((p, i) => p && pop(dot(g, p[0], p[1], s.color), 300 + i * 15));
  });
  /* end labels with leader lines when pushed apart */
  const lab = ends.map((e, k) => e < 0 ? null : { k, e, y: y(S[k].values[e]), t: yf(S[k].values[e]) }).filter(Boolean);
  const ly = pushApart(lab.map(l => l.y), 13, m.t, m.t + ph);
  lab.forEach((l, j) => {
    const ex = x(l.e);
    if (Math.abs(ly[j] - l.y) > 2) el('line', { x1: ex + 4, y1: l.y, x2: ex + 9, y2: ly[j], stroke: 'var(--line)' }, g);
    fade(text(g, ex + 10, ly[j], l.t, { fill: 'var(--text)', base: 'middle', weight: 600 }), 600, 300);
  });
  if (o.labelExtremes) {
    let mx = null, mn = null;
    S.forEach((s, k) => s.values.forEach((v, i) => { if (v == null) return; if (!mx || v > mx.v) mx = { v, i, k }; if (!mn || v < mn.v) mn = { v, i, k }; }));
    [mx, mn].forEach((e, j) => {
      if (!e || e.i === ends[e.k]) return;
      dot(g, x(e.i), y(e.v), S[e.k].color);
      fade(text(g, x(e.i), y(e.v) + (j ? 17 : -9), yf(e.v), { anchor: 'middle', fill: 'var(--text)', weight: 600, halo: 1 }), 700, 300);
    });
  }
  /* crosshair */
  crosshair(B, g, x, step, n, m.t, bottom, S.map(s => s.color), (i, e, place) => {
    const items = S.map((s, k) => { const v = s.values[i]; place(k, x(i), v == null ? null : y(v)); return { label: s.name, value: yf(v), color: s.color }; });
    if (o.target != null) items.push({ label: o.targetLabel || 'Target', value: yf(o.target), color: 'var(--muted)' });
    if (volH) items.push({ label: o.volumeLabel || 'Volume', value: fmt(o.volume[i]), color: 'var(--other)' });
    B.tip(B.toClient(x(i), 0).x, e.clientY, labels[i], items);
  });
  const series = S.map(s => ({ name: s.name, color: s.color, kind: s.dash ? 'dashed' : s.area ? 'area' : 'line' }));
  if (o.target != null) series.push({ name: o.targetLabel || 'Target', color: 'var(--muted)', kind: 'dashed' });
  return { series, destroy: B.destroy, tableView: () => [['Label'].concat(S.map(s => s.name))].concat(labels.map((l, i) => [l].concat(S.map(s => s.values[i] == null ? '' : yf(s.values[i]))))) };
}

/* 2. columns — grouped or stacked columns with selective value labels */
function columns(host, o) {
  const h = o.height || 260, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const cats = o.cats || [], n = cats.length, S = (o.series || []).map((s, i) => Object.assign({}, s, { color: col(s.color, i) }));
  const st = !!o.stacked && S.length > 1, yf = o.yFormat || fmt, vl = o.valueLabels || 'max';
  const tot = cats.map((c, i) => S.reduce((a, s) => a + (s.values[i] || 0), 0)), all = S.flatMap(s => s.values.map(v => v || 0));
  let hi = st ? Math.max(...tot) : Math.max(...all), lo = Math.min(0, ...all); if (o.target != null) hi = Math.max(hi, o.target);
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const m = { t: 22, r: 12, b: 24, l: Math.max(28, Math.max(...ticks.map(t => measure(yf(t)))) + 12) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, band = pw / Math.max(1, n), y = lin(lo, hi, m.t + ph, m.t), y0 = y(0);
  const xc = i => m.l + band * (i + .5);
  const bw = st ? Math.min(24, band * .6) : Math.min(24, (band * .72 - 2 * (S.length - 1)) / S.length), gw = st ? bw : bw * S.length + 2 * (S.length - 1);
  const bx = (i, j) => st ? xc(i) - bw / 2 : xc(i) - gw / 2 + j * (bw + 2);
  yAxis(g, ticks, y, m.l, m.l + pw, yf);
  xLabels(g, cats, xc, h - 6, band, W);
  const maxOf = s => Math.max(...s.values.map(v => v || 0)), maxTot = Math.max(...tot), bars = [];
  let k = 0;
  cats.forEach((c, i) => {
    let cum = 0; bars[i] = [];
    S.forEach((s, j) => {
      const v = s.values[i] || 0, up = v >= 0, top = st ? y(cum + v) : up ? y(v) : y0, bot = st ? y(cum) - (j ? 2 : 0) : up ? y0 : y(v);
      cum += v;
      const fill = o.highlightMax && S.length === 1 && v !== maxOf(s) ? 'var(--other)' : s.color;
      const p = el('path', { d: barPath(bx(i, j), top, bw, bot - top, (!st || j === S.length - 1) ? 4 : 0, up ? 'top' : 'bottom'), fill }, g);
      bars[i].push(p); grow(p, up ? '50% 100%' : '50% 0%', 'scaleY', k++ * 15);
    });
    if (vl === 'none') return;
    if (st) { if (vl === 'all' || tot[i] === maxTot) fade(text(g, xc(i), y(tot[i]) - 6, yf(tot[i]), { anchor: 'middle', fill: 'var(--text)', weight: 600 }), 500, 300); }
    else S.forEach((s, j) => {
      const v = s.values[i] || 0; if (vl === 'max' && v !== maxOf(s)) return;
      const lw = measure(yf(v), 10, 600); if (lw > band) return;
      if (S.some((s2, j2) => j2 !== j && Math.abs(bx(i, j2) - bx(i, j)) < (lw + bw) / 2 + 2 && y(s2.values[i] || 0) < y(v) - 2)) return;
      fade(text(g, bx(i, j) + bw / 2, v >= 0 ? y(v) - 6 : y(v) + 13, yf(v), { anchor: 'middle', fill: 'var(--text)', weight: 600, size: 10 }), 500, 300);
    });
  });
  if (o.target != null) { const ty = y(o.target); dashed(g, m.l, m.l + pw, ty, ty); text(g, m.l + pw, ty - 5, o.targetLabel || 'Target', { size: 10, anchor: 'end', halo: 1 }); }
  cats.forEach((c, i) => hit(hits, xc(i) - band / 2, m.t, band, ph, e => {
    bars[i].forEach(p => p.style.opacity = .75);
    const items = S.map(s => ({ label: s.name, value: yf(s.values[i]), color: s.color }));
    if (st) items.push({ label: 'Total', value: yf(tot[i]) });
    B.tip(e.clientX, e.clientY, c, items);
  }, () => { bars[i].forEach(p => p.style.opacity = ''); B.hide(); }));
  const series = S.map(s => ({ name: s.name, color: s.color, kind: 'bar' }));
  if (o.target != null) series.push({ name: o.targetLabel || 'Target', color: 'var(--muted)', kind: 'dashed' });
  return { series, destroy: B.destroy, tableView: () => [['Category'].concat(S.map(s => s.name))].concat(cats.map((c, i) => [c].concat(S.map(s => yf(s.values[i]))))) };
}

/* 3. bullet — horizontal bullet bars (track, value bar, target tick) */
function bullet(host, o) {
  const rows = o.rows || [], rh = o.rowHeight || 34, f = o.format || fmt, B = base(host, rows.length * rh + 6, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const x0 = Math.max(0, ...rows.map(r => Math.max(measure(r.label, 12, 600), r.sub ? measure(r.sub, 10) : 0))) + 14;
  const x1 = W - Math.max(0, ...rows.map(r => measure(f(r.value), 12, 600))) - 12;
  rows.forEach((r, i) => {
    const max = r.max || Math.max(r.value, r.target || 0) * 1.15 || 1, x = lin(0, max, x0, x1), cy = i * rh + rh / 2 + 3;
    text(g, 0, r.sub ? cy - 2 : cy, r.label, { fill: 'var(--text)', size: 12, weight: 600, base: r.sub ? 'auto' : 'middle' });
    if (r.sub) text(g, 0, cy + 11, r.sub, { size: 10 });
    el('rect', { x: x0, y: cy - 6, width: x1 - x0, height: 12, rx: 4, fill: 'var(--grid)' }, g);
    const fill = r.target == null ? 'var(--s1)' : r.value >= r.target ? 'var(--good)' : 'var(--bad)';
    const p = el('path', { d: barPath(x0, cy - 6, Math.max(0, x(Math.min(r.value, max)) - x0), 12, 4, 'right'), fill }, g);
    grow(p, '0% 50%', 'scaleX', i * 15);
    if (r.target != null) el('rect', { x: x(r.target) - 1, y: cy - 10, width: 2, height: 20, fill: 'var(--warn)' }, g);
    text(g, W, cy, f(r.value), { anchor: 'end', fill: 'var(--text)', size: 12, weight: 600, base: 'middle' });
    hit(hits, x0, cy - rh / 2, x1 - x0, rh, e => {
      p.style.opacity = .75;
      const items = [{ label: 'Actual', value: f(r.value), color: fill }];
      if (r.target != null) items.push({ label: 'Target', value: f(r.target), color: 'var(--warn)' }, { label: 'Attainment', value: Math.round(r.value / r.target * 100) + '%' });
      B.tip(e.clientX, e.clientY, r.label, items);
    }, () => { p.style.opacity = ''; B.hide(); });
  });
  return { destroy: B.destroy, tableView: () => [['Metric', 'Actual', 'Target']].concat(rows.map(r => [r.label, f(r.value), r.target == null ? '' : f(r.target)])) };
}

/* 4. slope — two-period comparison per item, coloured by direction */
function slope(host, o) {
  const items = o.items || [], f = o.format || fmt, h = o.height || 300, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const x0 = Math.max(0, ...items.map(it => measure(it.label + '  ' + f(it.from), 11, 600))) + 16, x1 = W - Math.max(0, ...items.map(it => measure(f(it.to) + '  ' + it.label, 11, 600))) - 16;
  const vals = items.flatMap(it => [it.from, it.to]), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo || 1) * .08, t = 28, b = 10;
  const y = lin(lo - pad, hi + pad, h - b, t);
  text(g, x0, 12, o.fromLabel || 'From', { anchor: 'end', weight: 600 }); text(g, x1, 12, o.toLabel || 'To', { weight: 600 });
  [x0, x1].forEach(xx => el('line', { x1: xx, x2: xx, y1: t - 6, y2: h - b, stroke: 'var(--line)' }, g));
  const ly = pushApart(items.map(it => y(it.from)), 13, t + 2, h - b), ry = pushApart(items.map(it => y(it.to)), 13, t + 2, h - b);
  items.forEach((it, i) => {
    const c = it.to > it.from ? 'var(--good)' : it.to < it.from ? 'var(--bad)' : 'var(--muted)';
    const ln = el('line', { x1: x0, y1: y(it.from), x2: x1, y2: y(it.to), stroke: c, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    drawIn(ln, i * 40); pop(dot(g, x0, y(it.from), c), i * 40); pop(dot(g, x1, y(it.to), c), 400 + i * 40);
    const tl = text(g, x0 - 10, ly[i], it.label, { anchor: 'end', base: 'middle', fill: 'var(--text)' });
    const ta = el('tspan', { 'font-weight': 600, dx: 6 }, tl); ta.textContent = f(it.from);
    const tr = text(g, x1 + 10, ry[i], '', { base: 'middle', fill: 'var(--text)' });
    const tb = el('tspan', { 'font-weight': 600 }, tr); tb.textContent = f(it.to);
    const tc = el('tspan', { dx: 6 }, tr); tc.textContent = it.label;
    const hl = el('line', { x1: x0, y1: y(it.from), x2: x1, y2: y(it.to), stroke: 'transparent', 'stroke-width': 24 }, hits);
    const show = e => { ln.setAttribute('stroke-width', 3); const d = it.to - it.from; B.tip(e.clientX, e.clientY, it.label, [{ label: o.fromLabel || 'From', value: f(it.from), color: c }, { label: o.toLabel || 'To', value: f(it.to), color: c }, { label: 'Change', value: sign(d) + f(Math.abs(d)) + (it.from ? ' (' + sign(d) + Math.round(Math.abs(d) / it.from * 100) + '%)' : '') }]); };
    hover(hl, show, () => { ln.setAttribute('stroke-width', 2); B.hide(); });
  });
  return { destroy: B.destroy, tableView: () => [['Item', o.fromLabel || 'From', o.toLabel || 'To', 'Change']].concat(items.map(it => [it.label, f(it.from), f(it.to), sign(it.to - it.from) + f(Math.abs(it.to - it.from))])) };
}

/* 5. scatter — quadrant scatter with reference lines, >= 24px hit targets, grouped colours */
function scatter(host, o) {
  const P = o.points || [], h = o.height || 320, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg), xf = o.xFormat || fmt, yf = o.yFormat || fmt;
  const xs = P.map(p => p.x).concat(o.xRef != null ? [o.xRef] : []), ys = P.map(p => p.y).concat(o.yRef != null ? [o.yRef] : []);
  const xt = niceTicks(Math.min(...xs), Math.max(...xs), 5), yt = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const m = { t: 16, r: 16, b: o.xLabel ? 40 : 24, l: Math.max(28, Math.max(...yt.map(t => measure(yf(t)))) + 12 + (o.yLabel ? 16 : 0)) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, x = lin(xt[0], xt[xt.length - 1], m.l, m.l + pw), y = lin(yt[0], yt[yt.length - 1], m.t + ph, m.t);
  yAxis(g, yt, y, m.l, m.l + pw, yf);
  xt.forEach((t, i) => { el('line', { x1: x(t), x2: x(t), y1: m.t, y2: m.t + ph, stroke: i ? 'var(--grid)' : 'var(--line)' }, g); text(g, x(t), m.t + ph + 16, xf(t), { anchor: 'middle' }); });
  if (o.xLabel) text(g, m.l + pw / 2, h - 4, o.xLabel, { anchor: 'middle', size: 10 });
  if (o.yLabel) text(g, 10, m.t + ph / 2, o.yLabel, { anchor: 'middle', size: 10 }).setAttribute('transform', `rotate(-90 10 ${m.t + ph / 2})`);
  if (o.xRef != null) dashed(g, x(o.xRef), x(o.xRef), m.t, m.t + ph);
  if (o.yRef != null) dashed(g, m.l, m.l + pw, y(o.yRef), y(o.yRef));
  if (o.quadrantLabels) [[m.l + 6, m.t + 12, 'start'], [m.l + pw - 6, m.t + 12, 'end'], [m.l + 6, m.t + ph - 6, 'start'], [m.l + pw - 6, m.t + ph - 6, 'end']].forEach((q, i) => o.quadrantLabels[i] && text(g, q[0], q[1], o.quadrantLabels[i], { anchor: q[2], size: 10, weight: 600 }));
  const groups = []; P.forEach(p => { if (p.group != null && !groups.includes(p.group)) groups.push(p.group); });
  const sizes = P.map(p => p.size).filter(v => v != null), sr = sizes.length ? lin(Math.sqrt(Math.min(...sizes)), Math.sqrt(Math.max(...sizes)), 4, 11) : () => 5;
  const order = P.map((p, i) => i).sort((a, b) => (P[b].size || 0) - (P[a].size || 0));
  const lab = P.map((p, i) => p.labelled ? { i, y: y(p.y) } : null).filter(Boolean), ly = pushApart(lab.map(l => l.y), 12, m.t + 6, m.t + ph - 6);
  order.forEach((i, k) => {
    const p = P[i], c = col(SER[Math.max(0, groups.indexOf(p.group)) % 3], 0), r = p.size != null ? sr(Math.sqrt(p.size)) : 5;
    const d = el('circle', { cx: x(p.x), cy: y(p.y), r, fill: c, 'fill-opacity': .85, stroke: 'var(--card)', 'stroke-width': 2 }, g); pop(d, k * 12);
    const hr = el('circle', { cx: x(p.x), cy: y(p.y), r: Math.max(12, r + 4), fill: 'transparent' }, hits);
    const show = e => { d.setAttribute('fill-opacity', 1); d.setAttribute('r', r + 2); const items = [{ label: o.xLabel || 'x', value: xf(p.x), color: c }, { label: o.yLabel || 'y', value: yf(p.y), color: c }]; if (p.size != null) items.push({ label: o.sizeLabel || 'Size', value: fmt(p.size) }); if (p.group != null) items.push({ label: 'Group', value: String(p.group) }); B.tip(e.clientX, e.clientY, p.label, items); };
    hover(hr, show, () => { d.setAttribute('fill-opacity', .85); d.setAttribute('r', r); B.hide(); });
  });
  lab.forEach((l, j) => { const p = P[l.i], r = (p.size != null ? sr(Math.sqrt(p.size)) : 5) + 5, flip = x(p.x) + r + measure(p.label, 10) > m.l + pw; fade(text(g, x(p.x) + (flip ? -r : r), ly[j], p.label, { base: 'middle', anchor: flip ? 'end' : 'start', fill: 'var(--text)', size: 10, halo: 1 }), 500, 300); });
  return { series: groups.map((gr, i) => ({ name: String(gr), color: col(SER[i % 3], 0), kind: 'dot' })), destroy: B.destroy,
    tableView: () => [['Label', o.xLabel || 'x', o.yLabel || 'y', 'Size', 'Group']].concat(P.map(p => [p.label, xf(p.x), yf(p.y), p.size == null ? '' : fmt(p.size), p.group == null ? '' : String(p.group)])) };
}

/* 6. calendar — GitHub-style calendar heatmap, weeks as columns */
function calendar(host, o) {
  const days = (o.days || []).slice().sort((a, b) => a.date < b.date ? -1 : 1), f = o.format || fmt, ws = o.weekStart == null ? 1 : o.weekStart, gap = 2, lw = 34, th = 20;
  const map = {}; days.forEach(d => map[d.date] = d.value);
  const d0 = new Date(days[0].date + 'T00:00:00Z'), d1 = new Date(days[days.length - 1].date + 'T00:00:00Z');
  const start = new Date(d0); start.setUTCDate(start.getUTCDate() - ((d0.getUTCDay() - ws + 7) % 7));
  const nW = Math.ceil((Math.round((d1 - start) / 864e5) + 1) / 7), W0 = host.clientWidth || 600;
  const cs = Math.max(6, Math.floor(Math.min((W0 - lw - gap * (nW - 1)) / nW, ((o.height || 130) - th - gap * 6) / 7)));
  const h = th + 7 * cs + 6 * gap, B = base(host, h, o), g = el('g', null, B.svg), max = Math.max(1, ...days.map(d => d.value || 0));
  const cx = w => lw + w * (cs + gap), cy = r => th + r * (cs + gap);
  [0, 2, 4].forEach(r => text(g, 0, cy(r) + cs / 2, DOW[(ws + r) % 7], { base: 'middle', size: 10 }));
  const iso = d => d.toISOString().slice(0, 10);
  let lastM = -1, lastX = -99, cells = [];
  for (let w = 0; w < nW; w++) for (let r = 0; r < 7; r++) {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + w * 7 + r); const k = iso(d), v = map[k], inR = d >= d0 && d <= d1;
    if (inR && d.getUTCMonth() !== lastM && cx(w) - lastX > 28) { lastM = d.getUTCMonth(); lastX = cx(w); text(g, cx(w), 12, MON[lastM], { size: 10 }); }
    if (!inR) continue;
    const c = el('rect', { x: cx(w), y: cy(r), width: cs, height: cs, rx: 2, fill: v > 0 ? heat(v / max) : 'var(--soft)' }, g);
    fade(c, Math.min(900, w * 12 + r * 3), 400); cells.push({ k, v, w, r });
  }
  const hl = el('rect', { width: cs, height: cs, rx: 2, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' }, g);
  const ov = el('rect', { x: lw, y: th, width: nW * (cs + gap), height: 7 * (cs + gap), fill: 'transparent' }, g);
  hover(ov, e => {
    const p = B.toVB(e), w = Math.floor((p.x - lw) / (cs + gap)), r = Math.floor((p.y - th) / (cs + gap)), c = cells.find(c => c.w === w && c.r === r);
    if (!c) { hl.setAttribute('opacity', 0); return B.hide(); }
    hl.setAttribute('x', cx(w)); hl.setAttribute('y', cy(r)); hl.setAttribute('opacity', 1);
    B.tip(e.clientX, e.clientY, DOW[dow(c.k)] + ' ' + sd(c.k), [{ label: o.label || 'Value', value: c.v == null ? '–' : f(c.v), color: c.v > 0 ? heat(c.v / max) : 'var(--soft)' }]);
  }, () => { hl.setAttribute('opacity', 0); B.hide(); });
  return { scale: { min: 0, max, colors: [1, 2, 3, 4, 5, 6, 7].map(i => 'var(--heat' + i + ')') }, destroy: B.destroy, tableView: () => [['Date', o.label || 'Value']].concat(days.map(d => [d.date, f(d.value)])) };
}

/* 7. heatmap — generic rows × cols matrix with sequential scale */
function heatmap(host, o) {
  const rows = o.rows || [], cols = o.cols || [], V = o.values || [], f = o.format || fmt, h = o.height || 240, B = base(host, h, o), W = B.W, g = el('g', null, B.svg);
  const lw = Math.max(0, ...rows.map(r => measure(r))) + 10, th = 18, gap = 2, cw = (W - lw - gap * (cols.length - 1)) / cols.length, ch = (h - th - gap * (rows.length - 1)) / rows.length;
  const flat = V.flat().filter(v => v != null), lo = Math.min(...flat), hi = Math.max(...flat), t = v => (v - lo) / ((hi - lo) || 1);
  const cx = c => lw + c * (cw + gap), cy = r => th + r * (ch + gap), showText = cw >= 36 && ch >= 16;
  cols.forEach((c, j) => text(g, cx(j) + cw / 2, 12, c, { anchor: 'middle', size: 10 }));
  rows.forEach((r, i) => text(g, lw - 8, cy(i) + ch / 2, r, { anchor: 'end', base: 'middle', size: 10 }));
  rows.forEach((r, i) => cols.forEach((c, j) => {
    const v = (V[i] || [])[j], k = i * cols.length + j;
    fade(el('rect', { x: cx(j), y: cy(i), width: cw, height: ch, rx: 2, fill: v == null ? 'var(--soft)' : heat(t(v)) }, g), Math.min(900, k * 6), 400);
    if (showText && v != null) fade(text(g, cx(j) + cw / 2, cy(i) + ch / 2, f(v), { anchor: 'middle', base: 'middle', size: 10, fill: t(v) > .6 ? 'var(--card)' : 'var(--text)' }), Math.min(900, k * 6), 400);
  }));
  const hl = el('rect', { width: cw, height: ch, rx: 2, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' }, g);
  const ov = el('rect', { x: lw, y: th, width: W - lw, height: h - th, fill: 'transparent' }, g);
  hover(ov, e => {
    const p = B.toVB(e), j = Math.floor((p.x - lw) / (cw + gap)), i = Math.floor((p.y - th) / (ch + gap));
    if (i < 0 || j < 0 || i >= rows.length || j >= cols.length) { hl.setAttribute('opacity', 0); return B.hide(); }
    hl.setAttribute('x', cx(j)); hl.setAttribute('y', cy(i)); hl.setAttribute('opacity', 1);
    const v = (V[i] || [])[j];
    B.tip(e.clientX, e.clientY, rows[i] + ' · ' + cols[j], [{ label: o.label || 'Value', value: v == null ? '–' : f(v), color: v == null ? 'var(--soft)' : heat(t(v)) }]);
  }, () => { hl.setAttribute('opacity', 0); B.hide(); });
  return { scale: { min: lo, max: hi, colors: [1, 2, 3, 4, 5, 6, 7].map(i => 'var(--heat' + i + ')') }, destroy: B.destroy, tableView: () => [[''].concat(cols)].concat(rows.map((r, i) => [r].concat(cols.map((c, j) => f((V[i] || [])[j]))))) };
}

/* 8. waterfall — start bar, floating deltas, end bar, connectors */
function waterfall(host, o) {
  const f = o.format || fmt, h = o.height || 280, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const bars = [{ label: o.start.label, from: 0, to: o.start.value, total: true }]; let cum = o.start.value;
  (o.steps || []).forEach(s => { bars.push({ label: s.label, from: cum, to: cum + s.delta, delta: s.delta }); cum += s.delta; });
  bars.push({ label: o.end.label, from: 0, to: cum, total: true });
  const vals = bars.flatMap(b => [b.from, b.to]), ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals), 4), lo = ticks[0], hi = ticks[ticks.length - 1];
  const m = { t: 22, r: 12, b: 24, l: Math.max(28, Math.max(...ticks.map(t => measure(f(t)))) + 12) }, pw = W - m.l - m.r, ph = h - m.t - m.b;
  const band = pw / bars.length, bw = Math.min(24, band * .6), y = lin(lo, hi, m.t + ph, m.t), xc = i => m.l + band * (i + .5);
  yAxis(g, ticks, y, m.l, m.l + pw, f);
  xLabels(g, bars.map(b => b.label), xc, h - 6, band, W);
  bars.forEach((b, i) => {
    const up = b.to >= b.from, top = y(Math.max(b.from, b.to)), bot = y(Math.min(b.from, b.to)), fill = b.total ? 'var(--s1)' : b.delta >= 0 ? 'var(--good)' : 'var(--bad)';
    const p = el('path', { d: barPath(xc(i) - bw / 2, top, bw, Math.max(1, bot - top), 4, up ? 'top' : 'bottom'), fill }, g);
    grow(p, up ? '50% 100%' : '50% 0%', 'scaleY', i * 60);
    if (i < bars.length - 1) el('line', { x1: xc(i) + bw / 2, x2: xc(i + 1) - bw / 2, y1: y(b.to), y2: y(b.to), stroke: 'var(--line)' }, g);
    const lbl = b.total ? f(b.to) : sign(b.delta) + f(Math.abs(b.delta));
    fade(text(g, xc(i), up ? top - 6 : bot + 13, lbl, { anchor: 'middle', fill: 'var(--text)', weight: 600, size: 10 }), 400 + i * 60, 300);
    hit(hits, xc(i) - band / 2, m.t, band, ph, e => { p.style.opacity = .75; const items = b.total ? [{ label: 'Value', value: f(b.to), color: fill }] : [{ label: 'Change', value: lbl, color: fill }, { label: 'Running total', value: f(b.to) }]; B.tip(e.clientX, e.clientY, b.label, items); }, () => { p.style.opacity = ''; B.hide(); });
  });
  return { destroy: B.destroy, tableView: () => [['Step', 'Change', 'Total']].concat(bars.map(b => [b.label, b.total ? '' : sign(b.delta) + f(Math.abs(b.delta)), f(b.to)])) };
}

/* 9. cumulative — actual vs cumulative target with gap shading, optional dashed projection */
function cumulative(host, o) {
  const labels = o.labels || [], n = labels.length, A = o.actual || [], T = o.target || [], Pj = o.projection || [], f = o.format || fmt, h = o.height || 260;
  const B = base(host, h, o), W = B.W, g = el('g', null, B.svg);
  const all = [A, T, Pj].flat().filter(v => v != null), ticks = niceTicks(0, Math.max(...all), 4), lo = ticks[0], hi = ticks[ticks.length - 1];
  const la = lastIdx(A), lt = lastIdx(T), lp = lastIdx(Pj);
  const endW = Math.max(0, ...[la >= 0 ? f(A[la]) : '', lt >= 0 ? f(T[lt]) : '', lp >= 0 ? f(Pj[lp]) : ''].map(s => measure(s, 11, 600)));
  const m = { t: 18, r: endW + 16, b: 24, l: Math.max(28, Math.max(...ticks.map(t => measure(f(t)))) + 12) }, pw = W - m.l - m.r, ph = h - m.t - m.b, step = n > 1 ? pw / (n - 1) : pw;
  const x = i => m.l + i * step, y = lin(lo, hi, m.t + ph, m.t);
  yAxis(g, ticks, y, m.l, m.l + pw, f);
  xLabels(g, labels.map(sd), x, h - 6, step, W);
  let good = '', bad = '';
  const quad = (xa, ya, xb, yb, ta, tb, c) => { const d = `M${xa.toFixed(1)},${ya.toFixed(1)}L${xb.toFixed(1)},${yb.toFixed(1)}L${xb.toFixed(1)},${tb.toFixed(1)}L${xa.toFixed(1)},${ta.toFixed(1)}Z`; if (c >= 0) good += d; else bad += d; };
  for (let i = 0; i < n - 1; i++) {
    if ([A[i], A[i + 1], T[i], T[i + 1]].some(v => v == null)) continue;
    const da = A[i] - T[i], db = A[i + 1] - T[i + 1];
    if (da * db >= 0) quad(x(i), y(A[i]), x(i + 1), y(A[i + 1]), y(T[i]), y(T[i + 1]), da + db);
    else { const tt = da / (da - db), xm = x(i) + tt * step, ym = y(A[i] + tt * (A[i + 1] - A[i])); quad(x(i), y(A[i]), xm, ym, y(T[i]), ym, da); quad(xm, ym, x(i + 1), y(A[i + 1]), ym, y(T[i + 1]), db); }
  }
  if (good) fade(el('path', { d: good, fill: 'var(--good)', 'fill-opacity': .12 }, g), 300, 600);
  if (bad) fade(el('path', { d: bad, fill: 'var(--bad)', 'fill-opacity': .12 }, g), 300, 600);
  const pts = a => a.map((v, i) => v == null ? null : [x(i), y(v)]);
  drawIn(el('path', { d: linePath(pts(T)), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-linejoin': 'round' }, g), 0, '6 4');
  if (Pj.length) drawIn(el('path', { d: linePath(pts(Pj)), fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round' }, g), 500, '4 4');
  drawIn(el('path', { d: linePath(pts(A)), fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g), 100);
  if (la >= 0) pop(dot(g, x(la), y(A[la]), 'var(--s1)', 4.5), 700);
  const lab = [la >= 0 && { x: x(la), y: y(A[la]), t: f(A[la]), b: true }, lt >= 0 && { x: x(lt), y: y(T[lt]), t: f(T[lt]) }, lp >= 0 && lp !== la && { x: x(lp), y: y(Pj[lp]), t: f(Pj[lp]) }].filter(Boolean);
  const ly = pushApart(lab.map(l => l.y), 13, m.t, m.t + ph);
  lab.forEach((l, j) => { if (Math.abs(ly[j] - l.y) > 2) el('line', { x1: l.x + 4, y1: l.y, x2: l.x + 9, y2: ly[j], stroke: 'var(--line)' }, g); fade(text(g, l.x + 10, ly[j], l.t, { base: 'middle', fill: l.b ? 'var(--text)' : 'var(--muted)', weight: l.b ? 600 : 400 }), 700, 300); });
  crosshair(B, g, x, step, n, m.t, m.t + ph, ['var(--s1)'], (i, e, place) => {
    const v = A[i] != null ? A[i] : Pj[i]; place(0, x(i), v == null ? null : y(v));
    const items = [{ label: 'Actual', value: f(A[i]), color: 'var(--s1)' }, { label: 'Target', value: f(T[i]), color: 'var(--muted)' }];
    if (A[i] != null && T[i] != null) { const d = A[i] - T[i]; items.push({ label: d >= 0 ? 'Ahead' : 'Behind', value: sign(d) + f(Math.abs(d)), color: d >= 0 ? 'var(--good)' : 'var(--bad)' }); }
    if (Pj[i] != null) items.push({ label: 'Projection', value: f(Pj[i]), color: 'var(--s1)' });
    B.tip(B.toClient(x(i), 0).x, e.clientY, labels[i], items);
  });
  const series = [{ name: 'Actual', color: 'var(--s1)', kind: 'line' }, { name: 'Target', color: 'var(--muted)', kind: 'dashed' }];
  if (Pj.length) series.push({ name: 'Projection', color: 'var(--s1)', kind: 'dashed' });
  series.push({ name: 'Ahead', color: 'var(--good)', kind: 'area' }, { name: 'Behind', color: 'var(--bad)', kind: 'area' });
  return { series, destroy: B.destroy, tableView: () => [['Label', 'Actual', 'Target', 'Projection']].concat(labels.map((l, i) => [l, A[i] == null ? '' : f(A[i]), T[i] == null ? '' : f(T[i]), Pj[i] == null ? '' : f(Pj[i])])) };
}

/* 10. sparkline — returns an SVG string for inline use (no container) */
function sparkline(values, o) {
  o = o || {}; const w = o.width || 120, h = o.height || 28, c = o.color || 'var(--s1)', pad = 5, vs = values.filter(v => v != null);
  const lo = Math.min(...vs), hi = Math.max(...vs), x = lin(0, Math.max(1, values.length - 1), pad, w - pad), y = lin(lo, hi === lo ? lo + 1 : hi, h - pad, pad), li = lastIdx(values);
  const d = linePath(values.map((v, i) => v == null ? null : [x(i), y(v)]));
  const end = o.endDot !== false && li >= 0 ? `<circle cx="${x(li).toFixed(1)}" cy="${y(values[li]).toFixed(1)}" r="3.5" fill="${c}" stroke="var(--card)" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle;overflow:visible" aria-hidden="true"><path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${end}</svg>`;
}

/* 11. donutGauge — 180° gauge with animated sweep and counted-up centre figure */
function donutGauge(host, o) {
  const h = o.height || 160, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), f = o.format || fmt, c = col(o.color, 0), max = o.max || 100;
  const frac = Math.max(0, Math.min(1, o.value / max)), sw = 14, cy = h - 30, cx = W / 2, r = Math.max(20, Math.min(W / 2 - sw - 24, cy - sw));
  const arc = `M${cx - r},${cy}A${r},${r} 0 0 1 ${cx + r},${cy}`;
  el('path', { d: arc, fill: 'none', stroke: 'var(--grid)', 'stroke-width': sw }, g);
  const p = el('path', { d: arc, fill: 'none', stroke: c, 'stroke-width': sw }, g), L = p.getTotalLength();
  p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L * (1 - frac));
  anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: L * (1 - frac) }], { duration: 900 });
  countUp(text(g, cx, cy - 4, '', { anchor: 'middle', fill: 'var(--text)', size: 32, weight: 600 }), o.value, { duration: 900, format: f });
  text(g, cx, cy + 16, o.label || '', { anchor: 'middle' });
  text(g, cx - r, cy + 16, f(0), { anchor: 'middle', size: 10 }); text(g, cx + r, cy + 16, f(max), { anchor: 'middle', size: 10 });
  const hr = el('path', { d: arc, fill: 'none', stroke: 'transparent', 'stroke-width': 28 }, g);
  const show = e => B.tip(e.clientX, e.clientY, o.label || '', [{ label: 'Value', value: f(o.value), color: c }, { label: 'of ' + f(max), value: Math.round(frac * 100) + '%' }]);
  hover(hr, show, B.hide);
  return { destroy: B.destroy, tableView: () => [['Metric', 'Value', 'Max', 'Progress'], [o.label || '', f(o.value), f(max), Math.round(frac * 100) + '%']] };
}

/* 12. smallMultiples — grid of mini lines on one shared y-scale */
function smallMultiples(host, o) {
  const items = o.items || [], W0 = host.clientWidth || 600, cols = Math.max(1, Math.min(o.columns || 4, Math.floor(W0 / 130))), ch = o.cellHeight || o.height || 110, gap = 16, rows = Math.ceil(items.length / cols), f = o.format || fmt;
  const B = base(host, rows * ch + (rows - 1) * gap, o), W = B.W, cw = (W - gap * (cols - 1)) / cols;
  const all = items.flatMap(it => it.values.filter(v => v != null).concat(it.target != null ? [it.target] : []));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all), 2), lo = ticks[0], hi = ticks[ticks.length - 1];
  const pl = Math.max(0, ...ticks.map(t => measure(f(t), 9))) + 8, pt = 24, pb = 8, pr = 10, pw = cw - pl - pr, ph = ch - pt - pb, y = lin(lo, hi, pt + ph, pt);
  items.forEach((it, k) => {
    const g = el('g', { transform: `translate(${(k % cols) * (cw + gap)},${Math.floor(k / cols) * (ch + gap)})` }, B.svg), n = it.values.length, li = lastIdx(it.values);
    const x = i => pl + i / Math.max(1, n - 1) * pw;
    text(g, 0, 12, it.title, { fill: 'var(--text)', size: 12, weight: 600 });
    if (li >= 0) text(g, cw, 12, f(it.values[li]), { anchor: 'end', fill: 'var(--text)', size: 12, weight: 600 });
    ticks.forEach((t, i) => { el('line', { x1: pl, x2: pl + pw, y1: y(t), y2: y(t), stroke: i ? 'var(--grid)' : 'var(--line)' }, g); if (k % cols === 0) text(g, pl - 4, y(t), f(t), { anchor: 'end', base: 'middle', size: 9 }); });
    if (it.target != null) dashed(g, pl, pl + pw, y(it.target), y(it.target));
    drawIn(el('path', { d: linePath(it.values.map((v, i) => v == null ? null : [x(i), y(v)])), fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g), k * 60);
    if (li >= 0) pop(dot(g, x(li), y(it.values[li]), 'var(--s1)'), 600 + k * 60);
    const step = n > 1 ? pw / (n - 1) : pw, ox = (k % cols) * (cw + gap);
    crosshair(B, g, x, step, n, pt, pt + ph, ['var(--s1)'], (i, e, place) => {
      const v = it.values[i]; place(0, x(i), v == null ? null : y(v));
      const items = [{ label: it.title, value: f(v), color: 'var(--s1)' }]; if (it.target != null) items.push({ label: 'Target', value: f(it.target), color: 'var(--muted)' });
      B.tip(e.clientX, e.clientY, sd((it.labels || [])[i] != null ? it.labels[i] : String(i + 1)), items);
    }, ox);
  });
  const L = (items[0] && items[0].labels) || [];
  return { destroy: B.destroy, tableView: () => [['Label'].concat(items.map(it => it.title))].concat(L.map((l, i) => [l].concat(items.map(it => f(it.values[i]))))) };
}

/* 13. histogram — distribution with nice bin edges and optional marker lines */
function histogram(host, o) {
  const vs = (o.values || []).filter(v => v != null), f = o.format || fmt, h = o.height || 240, B = base(host, h, o), W = B.W, g = el('g', null, B.svg), hits = el('g', null, B.svg);
  const edges = niceTicks(Math.min(...vs), Math.max(...vs), o.bins || 10), nb = edges.length - 1, bs = edges[1] - edges[0], counts = new Array(nb).fill(0);
  vs.forEach(v => counts[Math.max(0, Math.min(nb - 1, Math.floor((v - edges[0]) / bs)))]++);
  const ticks = niceTicks(0, Math.max(...counts), 4), m = { t: 22, r: 12, b: o.xLabel ? 38 : 24, l: Math.max(28, Math.max(...ticks.map(t => measure(t))) + 12) };
  const pw = W - m.l - m.r, ph = h - m.t - m.b, band = pw / nb, bw = Math.min(24, band - 2), y = lin(0, ticks[ticks.length - 1], m.t + ph, m.t), x = lin(edges[0], edges[nb], m.l, m.l + pw);
  yAxis(g, ticks, y, m.l, m.l + pw, String);
  const ew = Math.max(...edges.map(e => measure(f(e)))) + 8, k = Math.max(1, Math.ceil(ew / band));
  edges.forEach((e, i) => { if (i % k === 0) text(g, x(e), m.t + ph + 16, f(e), { anchor: 'middle' }); });
  if (o.xLabel) text(g, m.l + pw / 2, h - 4, o.xLabel, { anchor: 'middle', size: 10 });
  const tot = vs.length || 1;
  counts.forEach((c, i) => {
    const xc = x(edges[i]) + band / 2, p = el('path', { d: barPath(xc - bw / 2, y(c), bw, y(0) - y(c), 4, 'top'), fill: 'var(--s1)' }, g);
    grow(p, '50% 100%', 'scaleY', i * 15);
    hit(hits, xc - band / 2, m.t, band, ph, e => { p.style.opacity = .75; B.tip(e.clientX, e.clientY, f(edges[i]) + ' – ' + f(edges[i + 1]), [{ label: 'Count', value: String(c), color: 'var(--s1)' }, { label: 'Share', value: Math.round(c / tot * 100) + '%' }]); }, () => { p.style.opacity = ''; B.hide(); });
  });
  (o.markers || []).forEach(mk => { const xx = x(mk.value); dashed(g, xx, xx, m.t, m.t + ph, 'var(--warn)'); text(g, xx, m.t - 6, mk.label || f(mk.value), { anchor: xx > m.l + pw * .8 ? 'end' : xx < m.l + pw * .2 ? 'start' : 'middle', size: 10, weight: 600, halo: 1 }); });
  return { destroy: B.destroy, tableView: () => [['Range', 'Count']].concat(counts.map((c, i) => [f(edges[i]) + ' – ' + f(edges[i + 1]), String(c)])) };
}

/* countUp — animate a DOM element's text from 0 (or opts.from) to `to` */
function countUp(node, to, o) {
  o = o || {}; const f = o.format || fmt, dur = o.duration || 800, from = o.from || 0;
  if (reduced() || !window.requestAnimationFrame) { node.textContent = f(to); return; }
  const t0 = performance.now();
  const step = now => { const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3); node.textContent = f(from + (to - from) * e); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

window.Charts = { line, columns, bullet, slope, scatter, calendar, heatmap, waterfall, cumulative, sparkline, donutGauge, smallMultiples, histogram, countUp, niceTicks, format: fmt, version: '1.0.0' };
})();
