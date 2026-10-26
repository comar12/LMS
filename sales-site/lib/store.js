// Saved uploads for the TSX dashboard.
// calls/<YYYY-MM-DD>.json  one handover day each; a new upload for the same day replaces that day only
// tracker.json             the sales tracker; a new export replaces the dates it covers and keeps every other date
// history/tracker-<day>.json  copy of the tracker after each upload day, for recovery

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 200000;

const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export function validCallsDay(day) {
  return !!day && DAY.test(day.date) && Array.isArray(day.a) && day.a.length < 5000 &&
    day.a.every(r => Array.isArray(r) && r.length >= 6 && Array.isArray(r[5]));
}

export function validTracker(t) {
  return !!t && t.meta && DAY.test(String(t.meta.minDate)) && DAY.test(String(t.meta.maxDate)) &&
    Array.isArray(t.rows) && t.rows.length > 0 && t.rows.length < MAX_ROWS && t.rows.every(r => Array.isArray(r) && r.length >= 15 && DAY.test(String(r[0]))) &&
    Array.isArray(t.roster) && Array.isArray(t.tls) && Array.isArray(t.oms);
}

// The new export is the truth for the dates it covers; rows on any other date are kept from what was saved.
export function mergeTracker(prev, next) {
  if (!prev || !validTracker(prev)) return next;
  const lo = next.meta.minDate, hi = next.meta.maxDate;
  const kept = prev.rows.filter(r => r[0] < lo || r[0] > hi);
  if (!kept.length) return next;
  const rows = kept.concat(next.rows).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const minDate = rows[0][0], maxDate = rows[rows.length - 1][0];
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
  return {
    ...next,
    meta: { ...next.meta, minDate, maxDate, defFrom: maxDate === hi ? next.meta.defFrom : addDays(maxDate, -6), keptRows: kept.length },
    rows,
    tls: union(next.tls, kept.map(r => r[2])),
    oms: union(next.oms, kept.map(r => r[3])),
  };
}

// blob: { read(path) -> object|null, write(path, obj), list(prefix) -> [path], remove(path) }
export async function loadAll(blob) {
  const [tracker, paths] = await Promise.all([blob.read('tracker.json'), blob.list('calls/')]);
  const days = {};
  const got = await Promise.all(paths.map(p => blob.read(p)));
  got.forEach(v => { if (v && DAY.test(v.date)) days[v.date] = { src: v.src, a: v.a, added: v.added || 0 }; });
  return { tracker: tracker || null, calls: { days } };
}

export async function saveCalls(blob, day) {
  const rec = { date: day.date, src: String(day.src || '').slice(0, 200), a: day.a, added: day.added || Date.now(), saved: Date.now() };
  await blob.write(`calls/${day.date}.json`, rec);
  const paths = await blob.list('calls/');
  return paths.map(p => p.slice(6, 16)).filter(d => DAY.test(d)).sort();
}

export async function saveTracker(blob, next) {
  const prev = await blob.read('tracker.json');
  const merged = mergeTracker(prev, next);
  merged.meta = { ...merged.meta, rowsRaw: undefined, savedAt: Date.now() };
  await blob.write('tracker.json', merged);
  await blob.write(`history/tracker-${new Date().toISOString().slice(0, 10)}.json`, merged);
  return merged;
}

export async function removeCallsDay(blob, date) {
  await blob.remove(`calls/${date}.json`);
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function handlers(blob) {
  return {
    async GET() { return json({ ok: true, ...(await loadAll(blob)), at: Date.now() }); },
    async POST(request) {
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Body is not JSON' }, 400); }
      if (body && body.kind === 'calls') {
        if (!validCallsDay(body.day)) return json({ ok: false, error: 'Call day is not in the expected shape' }, 400);
        return json({ ok: true, days: await saveCalls(blob, body.day) });
      }
      if (body && body.kind === 'tracker') {
        if (!validTracker(body.data)) return json({ ok: false, error: 'Tracker data is not in the expected shape' }, 400);
        return json({ ok: true, tracker: await saveTracker(blob, body.data) });
      }
      return json({ ok: false, error: 'Unknown kind' }, 400);
    },
    async DELETE(request) {
      const date = new URL(request.url).searchParams.get('day');
      if (!DAY.test(date || '')) return json({ ok: false, error: 'Pass ?day=YYYY-MM-DD' }, 400);
      await removeCallsDay(blob, date);
      return json({ ok: true });
    },
  };
}
