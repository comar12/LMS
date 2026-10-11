/* ==========================================================================
   10-settings: Settings & Data view, export/import, resets, quick guide
   ========================================================================== */

const EXPORT_APP_ID = 'coaching-intelligence-pro';

function exportPayload() {
  return {
    app: EXPORT_APP_ID,
    format: 1,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: state.settings,
      prefs: state.prefs,
      favorites: [...state.favorites],
      custom: state.custom,
      overrides: state.overrides,
      combos: state.combos,
      drafts: state.drafts,
      builder: state.builder,
      links: state.links,
      tracker: state.tracker,
    },
  };
}

function exportData() {
  const json = JSON.stringify(exportPayload(), null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `coaching-intelligence-pro-backup-${stamp}.json`;
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Exported ${filename}`);
  } catch (e) {
    // Fallback: show the JSON so it can be copied into a file manually.
    showCopyFallback(json, 'the backup');
  }
}

function importFromFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That file is too large to be a backup from this app.', { type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleImportText(String(reader.result || ''));
    reader.onerror = () => toast('The file could not be read.', { type: 'error' });
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
}

/** Parse and sanitize an import. Only known fields are read; strings are length-limited; nothing is executed. */
function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: 'This file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.app !== EXPORT_APP_ID || !parsed.data || typeof parsed.data !== 'object') {
    return { error: 'This file is not a Coaching Intelligence Pro backup.' };
  }
  const d = parsed.data;
  return {
    pack: {
      settings: d.settings ? sanitizeSettings(d.settings) : null,
      prefs: d.prefs ? sanitizePrefs(d.prefs) : null,
      favorites: strList(d.favorites, 1000, 80).filter(isId),
      custom: sanitizeCustom(d.custom),
      overrides: sanitizeOverrides(d.overrides),
      combos: sanitizeCombos(d.combos),
      drafts: sanitizeDrafts(d.drafts),
      builder: d.builder ? sanitizeBuilder(d.builder) : null,
      links: d.links ? sanitizeLinks(d.links) : null,
      tracker: d.tracker ? sanitizeTracker(d.tracker) : null,
    },
  };
}

function mergeById(current, incoming) {
  const map = new Map(current.map((x) => [x.id, x]));
  incoming.forEach((x) => map.set(x.id, x));
  return [...map.values()];
}

function applyImport(pack, mode) {
  if (mode === 'replace') {
    state.settings = pack.settings || { ...DEFAULT_SETTINGS };
    state.prefs = pack.prefs || defaultPrefs();
    state.favorites = new Set(pack.favorites);
    state.custom = pack.custom;
    state.overrides = pack.overrides;
    state.combos = pack.combos;
    state.drafts = pack.drafts;
    state.builder = pack.builder || defaultBuilder();
    // Backups made before Quick Links existed have no links; keep the current ones.
    if (pack.links) state.links = pack.links;
    if (pack.tracker) state.tracker = pack.tracker;
  } else {
    if (pack.tracker) state.tracker = { plans: mergeById(state.tracker.plans, pack.tracker.plans) };
    if (pack.links) state.links = { items: mergeById(state.links.items, pack.links.items) };
    pack.favorites.forEach((id) => state.favorites.add(id));
    state.custom = { opps: mergeById(state.custom.opps, pack.custom.opps), strengths: mergeById(state.custom.strengths, pack.custom.strengths) };
    state.overrides = { opps: { ...state.overrides.opps, ...pack.overrides.opps }, strengths: { ...state.overrides.strengths, ...pack.overrides.strengths } };
    state.combos = mergeById(state.combos, pack.combos);
    state.drafts = mergeById(state.drafts, pack.drafts);
  }
  persist(...STATE_KEYS);
  applyTheme();
  applyBrand();
  rebuildContent();
  refresh();
}

function handleImportText(text) {
  const { pack, error } = parseImport(text);
  if (error) {
    toast(error, { type: 'error', duration: 5000 });
    return;
  }
  const counts = [
    plural(pack.custom.opps.length, 'custom opportunity', 'custom opportunities'),
    plural(pack.custom.strengths.length, 'custom strength'),
    plural(Object.keys(pack.overrides.opps).length + Object.keys(pack.overrides.strengths).length, 'customized built-in entry', 'customized built-in entries'),
    plural(pack.favorites.length, 'favorite'),
    plural(pack.combos.length, 'saved combination'),
    plural(pack.drafts.length, 'draft'),
    plural(pack.links ? pack.links.items.length : 0, 'quick link'),
    plural(pack.tracker ? pack.tracker.plans.length : 0, 'follow-up plan'),
  ];
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const replace = h('button', { type: 'button', class: 'btn btn--danger' }, 'Replace everything');
  const merge = h('button', { type: 'button', class: 'btn btn--primary' }, 'Merge into current data');
  const m = openModal({
    title: 'Import backup',
    size: 'md',
    body: [
      h('p', { class: 'prose' }, 'This backup contains:'),
      h('ul', { class: 'bullets', style: 'margin:10px 0 14px' }, counts.map((c) => h('li', null, icon('check'), c))),
      h('p', { class: 'prose' }, h('strong', null, 'Merge'), ' adds these items and replaces any with the same ID. ', h('strong', null, 'Replace everything'), ' swaps all of your current templates, favorites, drafts, Builder content, and settings for the backup.'),
    ],
    footer: [cancel, h('span', { class: 'spacer' }), replace, merge],
    initialFocus: merge,
  });
  cancel.addEventListener('click', () => m.close());
  merge.addEventListener('click', () => {
    m.close();
    applyImport(pack, 'merge');
    toast('Backup merged');
  });
  replace.addEventListener('click', async () => {
    m.close();
    if (await confirmDialog({ title: 'Replace everything?', message: 'All current templates, favorites, combinations, drafts, Builder content, and settings in this browser will be replaced by the backup.', confirmLabel: 'Replace everything', danger: true })) {
      applyImport(pack, 'replace');
      toast('Backup restored');
    }
  });
}

async function resetCustomizations() {
  if (!(await confirmDialog({ title: 'Reset customizations?', message: 'This deletes your custom opportunities and strengths and restores every built-in entry to its original wording. Favorites, drafts, and settings are kept. Export a backup first if you might need them.', confirmLabel: 'Reset customizations', danger: true }))) return;
  state.custom = { opps: [], strengths: [] };
  state.overrides = { opps: {}, strengths: {} };
  persist('custom', 'overrides');
  rebuildContent();
  if (state.ui.openId && !getOpp(state.ui.openId)) closePanel();
  refresh();
  toast('Customizations reset. Built-in content restored.');
}

async function clearAllData() {
  if (!(await confirmDialog({ title: 'Clear all local data?', message: 'This removes everything this app saved in this browser: templates, favorites, combinations, drafts, Builder content, follow-up plans, quick links, and settings. The built-in library is not affected.', confirmLabel: 'Clear everything', danger: true }))) return;
  STATE_KEYS.forEach((k) => store.remove(k));
  state.settings = { ...DEFAULT_SETTINGS };
  state.prefs = defaultPrefs();
  state.favorites = new Set();
  state.custom = { opps: [], strengths: [] };
  state.overrides = { opps: {}, strengths: {} };
  state.builder = defaultBuilder();
  state.combos = [];
  state.drafts = [];
  state.review = defaultReview();
  state.links = initialLinks();
  state.tracker = { plans: [] };
  store.remove('brandcss');
  applyTheme();
  applyBrand();
  rebuildContent();
  if (state.ui.openId && !getOpp(state.ui.openId)) closePanel();
  refresh();
  toast('All local data cleared');
}

function applyTheme() {
  const t = state.prefs.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

function setTheme(t) {
  state.prefs.theme = t;
  persist('prefs');
  applyTheme();
  refresh({ panel: false });
}

function renderSettings(main) {
  const fc = state.prefs.fullCopy;
  const s = state.settings;
  const usage = store.usage();
  const card = (title, iconName, children) => h('section', { class: 'card', 'aria-label': title }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title' }, icon(iconName), title)), h('div', { class: 'card__body' }, children));
  const copyBox = (key, label) =>
    h(
      'label',
      { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: fc[key],
        'data-fk': `fc:${key}`,
        onchange: (e) => {
          state.prefs.fullCopy[key] = e.target.checked;
          persist('prefs');
          refresh();
        },
      }),
      label
    );

  put(main, pageHead({ title: 'Settings & Data', sub: 'Defaults for action plans and copying, appearance, and the data this app keeps in your browser.' }));
  put(main, 
    h(
      'div',
      { class: 'two-col' },
      card('Action plan defaults', 'calendar', [
        planSettingsControls('settings'),
        h('p', { class: 'hint' }, icon('info'), `Plans currently read: "For the next ${durationPhrase(s.duration)} ... We will review ${numWord(s.calls)} applicable calls within ${followupPhrase(s.followup)}." The heading becomes "${planHeading()}".`),
      ]),
      card('Copy Full Coaching includes', 'copy', [
        h(
          'div',
          { class: 'stack', style: 'gap:10px' },
          copyBox('strengths', 'Things Went Well (only strengths you marked as observed)'),
          copyBox('feedback', 'Things Can Be Better'),
          copyBox('impact', 'Root Cause & Customer Impact'),
          copyBox('plan', 'SMART Action Plan'),
          copyBox('followup', 'Supervisor Follow-Up Plan'),
          copyBox('example', 'Correct Behavior / Example Statement'),
          copyBox('questions', 'Coaching Questions')
        ),
        h('p', { class: 'hint' }, icon('info'), 'Copied text is plain text with blank lines between sections, ready to paste into any coaching form. Supervisor notes are never copied.'),
      ]),
      card('Appearance', 'sun', [
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'setting__label' }, 'Theme'),
          segmented({
            label: 'Theme',
            value: state.prefs.theme,
            fkPrefix: 'theme',
            options: [
              { value: 'system', label: 'System', icon: 'monitor' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ],
            onChange: setTheme,
          })
        ),
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'setting__label' }, 'Library layout'),
          segmented({
            label: 'Library layout',
            value: state.prefs.layout,
            fkPrefix: 'slayout',
            options: [
              { value: 'grid', label: 'Grid', icon: 'grid' },
              { value: 'list', label: 'List', icon: 'list' },
            ],
            onChange: (v) => {
              state.prefs.layout = v;
              persist('prefs');
              refresh({ panel: false });
            },
          })
        ),
        h('p', { class: 'hint' }, icon('info'), 'Animations are reduced automatically when your system asks for reduced motion.'),
      ]),
      brandCard(),
      card('Data & storage', 'lock', [
        h(
          'div',
          { class: 'storage-meter' },
          h('span', null, store.ok ? `Using about ${fmtBytes(usage)}` : 'Storage unavailable'),
          h('div', { class: 'storage-meter__bar', role: 'img', 'aria-label': `About ${fmtBytes(usage)} of an estimated 5 MB browser limit used` }, h('div', { class: 'storage-meter__fill', style: `width:${Math.min(100, Math.max(1, (usage / (5 * 1024 * 1024)) * 100)).toFixed(1)}%` }))
        ),
        h(
          'div',
          { class: 'prose' },
          h('p', null, 'Everything you save here (favorites, custom templates, drafts, combinations, and settings) is stored only in this browser using local storage. Nothing is sent anywhere, and the app makes no network requests.'),
          h('p', null, h('strong', null, 'Local storage is specific to this browser and profile. '), 'It is not shared with other browsers, other computers, or private windows, and it is deleted if browser data is cleared. Moving or renaming this HTML file can also start a fresh, empty storage area in some browsers. Export a backup regularly.')
        ),
        h(
          'div',
          { class: 'data-row' },
          h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'sexport', onclick: exportData }, icon('download'), 'Export backup'),
          h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'simport', onclick: importFromFile }, icon('upload'), 'Import backup')
        ),
        h('div', { class: 'card__sep', role: 'presentation' }),
        h(
          'div',
          { class: 'data-row' },
          h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-fk': 'sresetcustom', onclick: resetCustomizations }, icon('refresh'), 'Reset customizations'),
          h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-fk': 'sclearall', onclick: clearAllData }, icon('trash'), 'Clear all local data')
        ),
      ]),
      card('Keyboard shortcuts', 'grid', [
        h(
          'div',
          { class: 'shortcuts' },
          h('kbd', null, '/'),
          h('span', null, 'Search'),
          h('kbd', null, 'Ctrl K'),
          h('span', null, 'Search (also Cmd K)'),
          h('kbd', null, 'Esc'),
          h('span', null, 'Close the open panel or dialog, or clear the search'),
          h('kbd', null, '['),
          h('span', null, 'Previous opportunity in the open panel'),
          h('kbd', null, ']'),
          h('span', null, 'Next opportunity in the open panel'),
          h('kbd', null, 'Tab'),
          h('span', null, 'Move between controls; every action works from the keyboard')
        ),
      ]),
      card('About', 'info', [
        h(
          'div',
          { class: 'prose' },
          h('p', null, h('strong', null, `Coaching Intelligence Pro — VXI, version ${APP_VERSION}. `), `Built-in library: ${DATA.opps.length} coaching opportunities in ${CATS.length} categories and ${DATA.strengths.length} strengths.`),
          h('p', null, 'This is a single, self-contained file. It works fully offline, loads no external fonts, scripts, or images, and contains no tracking or analytics. A content security policy blocks all network access.'),
          h('p', null, 'Coaching text is written as reusable best practice. Always confirm your program’s current processes, policies, and standards before coaching on them.')
        ),
      ])
    )
  );
}

/* ---------- Quick guide ---------- */
function openGuide() {
  const q = GUIDES.quick;
  const m = openModal({
    title: 'Quick Guide',
    size: 'md',
    body: [
      h('h3', { class: 'guide-h' }, 'Using this tool'),
      h('ol', { class: 'guide-list' }, q.steps.map((s) => h('li', null, s))),
      h('h3', { class: 'guide-h' }, 'A coaching conversation that works'),
      h('ol', { class: 'guide-list' }, q.conversation.map((s) => h('li', null, s))),
      h('h3', { class: 'guide-h' }, 'Documentation rules'),
      h('ul', { class: 'bullets' }, q.rules.map((s) => h('li', null, icon('lock'), s))),
      h('h3', { class: 'guide-h' }, 'SMART checklist'),
      h('div', { class: 'smart-grid' }, q.smart.map(([t, d]) => h('div', { class: 'smart-cell' }, h('strong', null, t), h('span', null, d)))),
      h('h3', { class: 'guide-h' }, 'KPI links on each opportunity'),
      h('ul', { class: 'bullets' }, KPIS.map((k) => h('li', null, icon('target'), `${k.label}: ${k.hint}.`))),
    ],
    footer: [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => m.close() }, 'Got it')],
  });
}
