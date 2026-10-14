/* ==========================================================================
   07o-hub: live numbers from the TSX Operations Hub dashboards
   - Sales Performance saves its tracker data in this browser ("tsxDashData")
   - AUX TSX saves its last import in IndexedDB ("aux-tsx-pulse")
   Both are read only, matched to Team Pulse members by HRID, and never
   copied into this app's own storage. Nothing is estimated: a number shows
   only when the dashboards have it.
   ========================================================================== */

const HUB_SALES_KEY = 'tsxDashData';
const HUB_TARGETS_KEY = 'tsxTargets';
const hub = { sales: null, aux: null, stamp: '', loading: null };
const normHr = (v) => String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
const salesTargetPct = () => state.prefs.salesTarget;

function readHubSales() {
  try {
    const raw = window.localStorage.getItem(HUB_SALES_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.rows) || !d.rows.length) return null;
    // Row layout written by the Sales Performance dashboard: [date, hrid, tl, om, xm, gsr, xmc, esim, dev, promo, dup, ...]
    const rows = [];
    let max = '';
    for (const a of d.rows) {
      if (!Array.isArray(a) || !isIsoDate(a[0])) continue;
      const hr = normHr(a[1]);
      if (!hr) continue;
      rows.push({ d: a[0], hr, xm: Number(a[4]) || 0, gsr: Number(a[5]) || 0, dup: !!a[10] });
      if (a[0] > max) max = a[0];
    }
    return rows.length ? { rows, through: max } : null;
  } catch (e) {
    return null;
  }
}

function readHubAux() {
  return new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open('aux-tsx-pulse');
      req.onupgradeneeded = () => {
        // The AUX dashboard has not been opened in this browser yet; do not create its store.
        req.transaction.abort();
        resolve(null);
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('datasets')) {
          db.close();
          return resolve(null);
        }
        const q = db.transaction('datasets', 'readonly').objectStore('datasets').get('dataset');
        q.onsuccess = () => {
          db.close();
          const D = q.result;
          if (!D || !D.meta || !Array.isArray(D.agents)) return resolve(null);
          const agents = {};
          D.agents.forEach((x) => {
            const hr = normHr(x.HRID);
            if (hr) agents[hr] = { calls: Number(x.calls) || 0, tr: typeof x.tr === 'number' ? x.tr : null, aht: typeof x.aht === 'number' ? x.aht : null, abs: typeof x.abs_pct === 'number' ? x.abs_pct : null };
          });
          resolve({ agents, from: D.meta.period_start, to: D.meta.period_end, fiscal: isIsoDate(D.meta.fiscal_start) ? D.meta.fiscal_start : D.meta.period_start, updated: (D.meta.source && D.meta.source.updatedAt) || D.meta.generated || '' });
        };
        q.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    } catch (e) {
      resolve(null);
    }
  });
}

/** Re-read both dashboards; re-render only when something changed. */
function loadHubData(opts = {}) {
  if (hub.loading) return hub.loading;
  hub.sales = readHubSales();
  hub.loading = readHubAux().then((aux) => {
    hub.aux = aux;
    hub.loading = null;
    const stamp = JSON.stringify([hub.sales && hub.sales.through, hub.sales && hub.sales.rows.length, aux && aux.to, aux && aux.updated]);
    if (stamp !== hub.stamp) {
      const first = !hub.stamp;
      hub.stamp = stamp;
      if (!first || hub.sales || hub.aux) {
        refresh({ panel: false });
        if (opts.announce && !first) toast('Dashboard numbers updated');
      }
    }
    return hub;
  });
  return hub.loading;
}

/** One agent's numbers for the AUX period (or the last seven days of sales when AUX is not loaded). */
function hubStats(m) {
  const hr = normHr(m && m.hrid);
  if (!hr || (!hub.sales && !hub.aux)) return null;
  const aux = hub.aux && hub.aux.agents[hr];
  const from = hub.aux ? hub.aux.from : hub.sales ? addDays(hub.sales.through, -6) : '';
  const to = hub.aux ? hub.aux.to : hub.sales ? hub.sales.through : '';
  let xm = 0;
  let gsr = 0;
  let found = false;
  if (hub.sales) {
    for (const r of hub.sales.rows) {
      if (r.hr !== hr || r.dup || r.d < from || r.d > to) continue;
      xm += r.xm;
      gsr += r.gsr;
      found = true;
    }
  }
  if (!aux && !found && !(hub.sales && hub.sales.rows.some((r) => r.hr === hr))) return null;
  const units = xm + gsr;
  const calls = aux ? aux.calls : null;
  const conv = calls ? units / calls : null;
  const target = salesTargetPct();
  return {
    xm,
    gsr,
    units,
    calls,
    conv,
    below: conv !== null && conv * 100 < target,
    tr: aux ? aux.tr : null,
    aht: aux ? aux.aht : null,
    abs: aux ? aux.abs : null,
    from,
    to,
    hasSales: !!hub.sales,
  };
}
const pct1 = (v) => `${Math.round(v * 1000) / 10}%`;

/** Numbers ready for the Builder and the tracker: percentages as the dashboards show them. */
function hubKpiValues(m) {
  const st = hubStats(m);
  if (!st) return {};
  const out = {};
  if (st.conv !== null) out.Sales = Math.round(st.conv * 1000) / 10;
  if (st.tr !== null) out.Transfer = Math.round(st.tr * 1000) / 10;
  if (st.abs !== null) out.ABS = Math.round(st.abs * 1000) / 10;
  if (st.hasSales) {
    out.XM = st.xm;
    out.GSR = st.gsr;
  }
  return out;
}

/** Team sales from the Sales Performance data: GSR submitted on a day, and the share of agents with any sale since a date. */
function hubTeamSales(day, since) {
  if (!hub.sales) return null;
  const ids = new Set(state.team.members.map((m) => normHr(m.hrid)).filter(Boolean));
  if (!ids.size) return null;
  let gsrDay = 0;
  const sold = new Set();
  for (const r of hub.sales.rows) {
    if (!ids.has(r.hr) || r.dup) continue;
    if (r.d === day) gsrDay += r.gsr;
    if (r.d >= since && r.d <= day && r.xm + r.gsr > 0) sold.add(r.hr);
  }
  return { gsrDay, participation: Math.round((sold.size / ids.size) * 100), agents: ids.size, sold: sold.size };
}

function hubSourceLine() {
  const parts = [];
  if (hub.sales) parts.push(`Sales tracker through ${fmtDay(hub.sales.through, true)}`);
  if (hub.aux) parts.push(`AUX calls ${fmtDay(hub.aux.from)} to ${fmtDay(hub.aux.to, true)}`);
  return parts.join(' · ');
}

/** A short strip on each Team Pulse card: sales against the target, with a caution when below. */
function hubStrip(m) {
  const st = hubStats(m);
  if (!st) return null;
  const t = salesTargetPct();
  return h(
    'div',
    { class: `hub-strip${st.below ? ' is-below' : st.conv !== null ? ' is-ok' : ''}` },
    h('span', { class: 'hub-strip__main' }, icon(st.below ? 'alert' : 'tag', 'icon--sm'), st.conv !== null ? `Sales ${pct1(st.conv)} of calls` : `${st.units} sales`, h('span', { class: 'hub-strip__t' }, st.conv !== null ? ` · target ${t}%` : hub.aux ? ' · no AUX calls found' : ' · load AUX for calls')),
    h('span', { class: 'hub-strip__sub' }, `XM ${st.xm} · GSR ${st.gsr}${st.calls !== null ? ` · ${st.calls} calls` : ''}`)
  );
}

function hubBuilderFill(memberId) {
  const m = state.team.members.find((x) => x.id === memberId);
  const v = m ? hubKpiValues(m) : {};
  if (!Object.keys(v).length) {
    toast('No dashboard numbers for this agent yet.', { type: 'warn' });
    return;
  }
  Object.entries(v).forEach(([k, val]) => {
    const cur = state.builder.nums[k] || { cur: null, target: null, unit: '%', asOf: todayDay() };
    cur.cur = val;
    cur.unit = KPI_MEASURE[k].unit;
    cur.asOf = (hub.aux && hub.aux.to) || (hub.sales && hub.sales.through) || todayDay();
    if (cur.target === null && kpiTarget(k) !== null) cur.target = kpiTarget(k);
    state.builder.nums[k] = cur;
  });
  persist('builder');
  refresh({ panel: false });
  toast(`Filled ${plural(Object.keys(v).length, 'number')} from the dashboards for ${memberLabel(m)}`);
}

/** Team Pulse section: every matched agent, lowest sales first, with cautions. */
function hubTeamCard() {
  const members = state.team.members;
  const withIds = members.filter((m) => m.hrid);
  const rows = withIds.map((m) => ({ m, st: hubStats(m) })).filter((x) => x.st);
  const t = salesTargetPct();
  const target = h('input', {
    class: 'input hub-target',
    id: 'hub-target',
    type: 'number',
    min: '1',
    max: '100',
    step: '0.5',
    value: String(t),
    'data-fk': 'hub-target',
    onchange: (e) => {
      const v = Number(e.target.value);
      if (v >= 0.5 && v <= 100) {
        state.prefs.salesTarget = v;
        persist('prefs');
        refresh({ panel: false });
      }
    },
  });
  const head = h(
    'div',
    { class: 'card__head' },
    h('h2', { class: 'card__title', id: 'hubTitle' }, icon('trend'), 'Sales and KPIs from your dashboards'),
    h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'hub-refresh', onclick: () => loadHubData({ announce: true }).then(() => toast(hub.sales || hub.aux ? 'Numbers refreshed' : 'No dashboard data found in this browser yet')) }, icon('refresh'), 'Refresh')
  );
  if (!hub.sales && !hub.aux) {
    return h(
      'section',
      { class: 'card hub-card', 'aria-labelledby': 'hubTitle' },
      head,
      h('div', { class: 'card__body' }, h('p', { class: 'field__hint' }, 'Open the Operations Hub in this browser, load your tracker file in Sales Performance, and click Update in AUX TSX once. Each agent\'s XM and GSR sales, calls handled, transfer rate, and absenteeism then show here automatically and update whenever you load new files.'))
    );
  }
  const below = rows.filter((x) => x.st.below).length;
  const sorted = rows.slice().sort((a, b) => (a.st.conv === null) - (b.st.conv === null) || (a.st.conv || 0) - (b.st.conv || 0));
  return h(
    'section',
    { class: 'card hub-card', 'aria-labelledby': 'hubTitle' },
    head,
    h(
      'div',
      { class: 'card__body' },
      h(
        'div',
        { class: 'hub-meta' },
        h('span', null, icon('calendar', 'icon--sm'), hubSourceLine()),
        h('label', { class: 'hub-meta__target', for: 'hub-target' }, 'Sales target', target, '% of calls (XM + GSR)')
      ),
      below ? h('p', { class: 'hub-alert', role: 'status' }, icon('alert', 'icon--sm'), `${plural(below, 'agent is', 'agents are')} below the ${t}% sales target.`) : null,
      !withIds.length
        ? h('p', { class: 'field__hint' }, 'Add HRIDs to your team (Paste roster or Edit details) to match agents to the dashboards.')
        : !rows.length
          ? h('p', { class: 'field__hint' }, 'None of your team\'s HRIDs were found in the dashboard data for this period.')
          : h(
              'div',
              { class: 'hub-table-wrap' },
              h(
                'table',
                { class: 'hub-table' },
                h('caption', { class: 'sr-only' }, `Sales and KPIs for ${hubSourceLine()}`),
                h('thead', null, h('tr', null, ['Agent', 'XM', 'GSR', 'Calls', 'Sales %', 'Transfer', 'AHT', 'ABS', ''].map((c, i) => h('th', { scope: 'col', class: i === 0 ? 'l' : '' }, c ? c : h('span', { class: 'sr-only' }, 'Actions'))))),
                h(
                  'tbody',
                  null,
                  sorted.map(({ m, st }) =>
                    h(
                      'tr',
                      { class: st.below ? 'is-below' : '' },
                      h('th', { scope: 'row', class: 'l' }, memberLabel(m)),
                      h('td', null, String(st.xm)),
                      h('td', null, String(st.gsr)),
                      h('td', null, st.calls === null ? '–' : String(st.calls)),
                      h('td', { class: 'hub-conv' }, st.conv === null ? '–' : h('span', { class: `hub-pill${st.below ? ' is-below' : ' is-ok'}` }, st.below ? icon('alert', 'icon--sm') : icon('check', 'icon--sm'), pct1(st.conv))),
                      h('td', null, st.tr === null ? '–' : pct1(st.tr)),
                      h('td', null, st.aht === null ? '–' : `${Math.round(st.aht)}s`),
                      h('td', null, st.abs === null ? '–' : pct1(st.abs)),
                      h('td', null, h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `hub-coach:${m.id}`, 'aria-label': `Use ${memberLabel(m)}'s numbers in the Builder`, onclick: () => { hubBuilderFill(m.id); navigate('builder'); } }, icon('clipboard'), 'Coach'))
                    )
                  )
                )
              )
            ),
      h('p', { class: 'field__hint hub-foot' }, 'Read live from the hub dashboards in this browser and matched by HRID. Sales % is XM plus GSR sales divided by calls handled in the AUX period. These numbers are never saved in this app or copied into coaching text unless you choose Coach.')
    )
  );
}

function initHub() {
  loadHubData();
  // Sales Performance writes to this browser's storage: pick up new files as soon as they are loaded in the hub.
  window.addEventListener('storage', (e) => {
    if (e.key === HUB_SALES_KEY || e.key === HUB_TARGETS_KEY) loadHubData({ announce: true });
  });
  // AUX keeps its data in IndexedDB, which has no change event: check again whenever this page comes back into view.
  window.addEventListener('focus', () => loadHubData({ announce: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadHubData({ announce: true });
  });
}
