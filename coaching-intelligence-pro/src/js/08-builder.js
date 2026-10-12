/* ==========================================================================
   08-builder: Coaching Builder (multi-opportunity cohesive coaching entry)
   ========================================================================== */

let lastGenerated = null;
let dragState = null;

const OUT_PLACEHOLDER = {
  progress: 'Mark observed strengths or add verified progress notes to fill this section. Nothing is claimed automatically, so it stays empty until you do.',
  challenges: 'Add one or more opportunities to generate this section.',
  plan: 'Add opportunities to generate one consolidated SMART action plan.',
  followup: 'Add opportunities to generate the supervisor follow-up plan.',
};

function builderHasContent() {
  const b = state.builder;
  return b.opps.length > 0 || b.strengths.length > 0 || !!(b.notes.progress || b.notes.evidence || b.notes.private) || Object.values(b.edited).some((v) => typeof v === 'string');
}

function moveItem(kind, from, to) {
  const list = kind === 'opps' ? state.builder.opps : state.builder.strengths;
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  persist('builder');
  refresh();
  const name = kind === 'opps' ? (getOpp(item) || {}).title : (getStrength(item.id) || {}).title;
  announce(`${name || 'Item'} moved to position ${to + 1}.`);
}

function removeItem(kind, index) {
  const list = kind === 'opps' ? state.builder.opps : state.builder.strengths;
  const [item] = list.splice(index, 1);
  persist('builder');
  refresh();
  const name = kind === 'opps' ? (getOpp(item) || {}).title : (getStrength(item.id) || {}).title;
  announce(`${name || 'Item'} removed from the Coaching Builder.`);
  // Keep keyboard focus inside the list after removal.
  const next = document.querySelector(`[data-fk="rm:${kind}:${Math.min(index, list.length - 1)}"]`) || document.querySelector(`[data-fk="combo:combo-${kind}"]`);
  if (next) next.focus({ preventScroll: true });
}

function enableDrag(li, kind, index) {
  li.draggable = true;
  li.addEventListener('dragstart', (e) => {
    dragState = { kind, index };
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-cip-reorder', `${kind}:${index}`);
    } catch (err) {
      /* some browsers restrict custom types */
    }
    li.classList.add('is-dragging');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('is-dragging');
    dragState = null;
  });
  li.addEventListener('dragover', (e) => {
    if (!dragState || dragState.kind !== kind) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    li.classList.add('is-drop-target');
  });
  li.addEventListener('dragleave', () => li.classList.remove('is-drop-target'));
  li.addEventListener('drop', (e) => {
    li.classList.remove('is-drop-target');
    if (!dragState || dragState.kind !== kind) return;
    e.preventDefault();
    const from = dragState.index;
    dragState = null;
    moveItem(kind, from, index);
  });
}

function itemButtons(kind, index, length, name) {
  return h(
    'div',
    { class: 'sel-item__btns' },
    h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Move ${name} up`, title: 'Move up', 'data-fk': `up:${kind}:${index}`, disabled: index === 0, onclick: () => moveItem(kind, index, index - 1) }, icon('arrow-up')),
    h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Move ${name} down`, title: 'Move down', 'data-fk': `down:${kind}:${index}`, disabled: index === length - 1, onclick: () => moveItem(kind, index, index + 1) }, icon('arrow-down')),
    h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove ${name}`, title: 'Remove', 'data-fk': `rm:${kind}:${index}`, onclick: () => removeItem(kind, index) }, icon('x'))
  );
}

function oppsCard() {
  const ids = state.builder.opps.filter((id) => getOpp(id));
  if (ids.length !== state.builder.opps.length) state.builder.opps = ids;
  const list = h('ol', { class: 'sel-list', 'aria-label': 'Selected opportunities in order' });
  ids.forEach((id, i) => {
    const o = getOpp(id);
    const li = h(
      'li',
      { class: 'sel-item' },
      h('span', { class: 'sel-item__grip', title: 'Drag to reorder', 'aria-hidden': 'true' }, icon('grip')),
      h('span', { class: 'sel-item__num', 'aria-hidden': 'true' }, String(i + 1)),
      h(
        'div',
        { class: 'sel-item__main' },
        h('button', { type: 'button', class: 'sel-item__title opp-card__open', style: 'text-align:left', 'data-fk': `bopen:${id}`, onclick: () => { state.ui.returnFocusKey = `bopen:${id}`; navigate('builder', { open: id }); } }, o.title),
        h('div', { class: 'sel-item__sub' }, catChip(o.cat), (o.kpi || []).map(kpiChip))
      ),
      itemButtons('opps', i, ids.length, o.title)
    );
    enableDrag(li, 'opps', i);
    list.appendChild(li);
  });
  const combo = combobox({
    id: 'combo-opps',
    label: 'Add an opportunity',
    placeholder: 'Add an opportunity (e.g. dead air, empathy)',
    getItems: (q) => {
      const pool = q.trim() ? searchList(content.opps, q).results.map((r) => r.item) : content.opps;
      return pool.map((o) => ({ id: o.id, title: o.title, sub: state.builder.opps.includes(o.id) ? 'Added' : (CAT_MAP[o.cat] || {}).nav, disabled: state.builder.opps.includes(o.id), dotCat: o.cat }));
    },
    onSelect: (id) => {
      if (!state.builder.opps.includes(id)) state.builder.opps.push(id);
      persist('builder');
      refresh();
      announce(`${getOpp(id).title} added.`);
    },
  });
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'bOppsTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bOppsTitle' }, icon('target'), 'Opportunities', h('span', { class: `pill${ids.length ? ' is-active' : ''}` }, String(ids.length)))),
    h(
      'div',
      { class: 'card__body' },
      combo,
      ids.length ? list : h('p', { class: 'hint' }, icon('info'), 'Add the behaviors you observed. Use the + on any library card, or search here.'),
      ids.length > 1 ? h('p', { class: 'hint' }, icon('info'), 'Order matters: related behaviors are grouped, and groups follow the order you set here.') : null
    )
  );
}

function strengthsCard() {
  const sels = state.builder.strengths.filter((s) => getStrength(s.id));
  if (sels.length !== state.builder.strengths.length) state.builder.strengths = sels;
  const list = h('ol', { class: 'sel-list', 'aria-label': 'Observed strengths in order' });
  sels.forEach((sel, i) => {
    const s = getStrength(sel.id);
    const conflicts = conflictsFor(s.id, state.builder.opps);
    const li = h(
      'li',
      { class: 'sel-item sel-item--strength' },
      h('span', { class: 'sel-item__grip', title: 'Drag to reorder', 'aria-hidden': 'true' }, icon('grip')),
      h(
        'div',
        { class: 'sel-item__main' },
        h('div', { class: 'sel-item__title' }, s.title),
        h('div', { class: 'sel-item__sub' }, versionSwitch(s, Math.min(sel.v, s.v.length - 1), 'bver')),
        conflicts.length ? h('p', { class: 'conflict' }, icon('alert'), `May contradict ${joinList(conflicts.map((o) => `"${o.title}"`))}.`) : null
      ),
      itemButtons('strengths', i, sels.length, s.title)
    );
    enableDrag(li, 'strengths', i);
    list.appendChild(li);
  });

  const selectedIds = new Set(sels.map((s) => s.id));
  const blocked = new Set(state.builder.opps.flatMap((id) => OPPOSITES[id] || []));
  const suggested = dedupe(state.builder.opps.flatMap((id) => (getOpp(id) || {}).strengths || [])).filter((id) => getStrength(id) && !selectedIds.has(id) && !blocked.has(id)).slice(0, 10);

  const combo = combobox({
    id: 'combo-strengths',
    label: 'Add an observed strength',
    placeholder: 'Add a strength you observed',
    getItems: (q) => {
      const pool = q.trim() ? searchList(content.strengths, q).results.map((r) => r.item) : content.strengths;
      return pool.map((s) => ({ id: s.id, title: s.title, sub: selectedIds.has(s.id) ? 'Added' : (S_GROUP_MAP[s.group] || {}).label, disabled: selectedIds.has(s.id) }));
    },
    onSelect: (id) => toggleStrength(id),
  });

  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'bStrTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bStrTitle' }, icon('thumb'), 'Strengths observed', h('span', { class: `pill${sels.length ? ' is-active' : ''}` }, String(sels.length)))),
    h(
      'div',
      { class: 'card__body' },
      combo,
      sels.length ? list : h('p', { class: 'hint' }, icon('info'), 'Optional. Only add strengths you genuinely observed. They fill the progress section; nothing positive is added otherwise.'),
      suggested.length
        ? h(
            'div',
            { class: 'suggest', role: 'group', 'aria-label': 'Suggested strengths, add only if observed' },
            h('span', { class: 'suggest__label' }, 'Often seen alongside your opportunities (add only if observed):'),
            suggested.map((id) => strengthToggleChip(id, 'bsug'))
          )
        : null
    )
  );
}

function settingsCard() {
  const b = state.builder;
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'bSetTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bSetTitle' }, icon('calendar'), 'Plan settings')),
    h(
      'div',
      { class: 'card__body' },
      planSettingsControls('builder'),
      h(
        'div',
        { class: 'settings-grid' },
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'setting__label', id: 'toneLabel' }, 'Tone'),
          segmented({
            label: 'Tone',
            value: b.tone,
            fkPrefix: 'tone',
            options: [
              { value: 'supportive', label: 'Supportive' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'direct', label: 'Direct' },
            ],
            onChange: (v) => {
              b.tone = v;
              persist('builder');
              refresh({ panel: false });
            },
          })
        ),
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'setting__label' }, 'Format'),
          segmented({
            label: 'Format',
            value: b.style,
            fkPrefix: 'style',
            options: [
              { value: 'points', label: 'Points', icon: 'list' },
              { value: 'paragraphs', label: 'Paragraphs', icon: 'note' },
            ],
            onChange: (v) => {
              b.style = v;
              persist('builder');
              refresh({ panel: false });
            },
          })
        ),
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'setting__label' }, 'Coaching is based on'),
          segmented({
            label: 'Coaching is based on',
            value: b.scope,
            fkPrefix: 'scope',
            options: [
              { value: 'single', label: 'One call' },
              { value: 'multiple', label: 'Several calls' },
            ],
            onChange: (v) => {
              b.scope = v;
              persist('builder');
              refresh({ panel: false });
            },
          })
        )
      )
    )
  );
}

/* ---------- Real numbers from the KPI dashboard ---------- */
let numsExtra = [];
function numbersCard() {
  const b = state.builder;
  const opps = builderOpps();
  const fromOpps = dedupe(opps.flatMap((o) => o.kpi || [])).filter((k) => KPI_MEASURE[k]);
  const keys = Object.keys(KPI_MEASURE).filter((k) => fromOpps.includes(k) || numsExtra.includes(k) || (b.nums[k] && (b.nums[k].cur !== null || b.nums[k].target !== null)));
  const others = Object.keys(KPI_MEASURE).filter((k) => !keys.includes(k));
  const attrition = opps.some((o) => (o.kpi || []).includes('Attrition'));
  const setVal = (k, field, raw, input) => {
    const clean = raw.replace('%', '').trim();
    const v = clean === '' ? null : numOrNull(clean);
    input.classList.toggle('is-invalid', clean !== '' && v === null);
    input.setAttribute('aria-invalid', String(clean !== '' && v === null));
    if (clean !== '' && v === null) return;
    const cur = b.nums[k] || { cur: null, target: null, unit: KPI_MEASURE[k].unit, asOf: todayDay() };
    cur[field] = v;
    if (field === 'cur') cur.asOf = todayDay();
    if (cur.cur === null && cur.target === null) delete b.nums[k];
    else b.nums[k] = cur;
    persistBuilderSoon();
    updateBuilderOutputs();
  };
  const row = (k) => {
    const m = KPI_MEASURE[k];
    const v = b.nums[k] || { cur: null, target: null, unit: m.unit };
    const field = (f, label) => {
      const id = `num-${k}-${f}`;
      const input = h('input', { class: 'input', id, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-fk': id, value: v[f] === null || v[f] === undefined ? '' : String(v[f]), placeholder: f === 'cur' ? 'From dashboard' : m.dir === 'down' ? 'Lower is better' : 'Higher is better' });
      input.addEventListener('input', () => setVal(k, f, input.value, input));
      return h('div', { class: 'field' }, h('label', { class: 'field__label', for: id }, label), input);
    };
    const unit = h(
      'select',
      {
        class: 'select',
        id: `num-${k}-unit`,
        'data-fk': `num-${k}-unit`,
        onchange: (e) => {
          const cur = b.nums[k] || { cur: null, target: null, unit: m.unit, asOf: todayDay() };
          cur.unit = e.target.value;
          if (cur.cur !== null || cur.target !== null) b.nums[k] = cur;
          persist('builder');
          updateBuilderOutputs();
        },
      },
      NUM_UNITS.map((u) => h('option', { value: u, selected: (v.unit || m.unit) === u }, u === '%' ? 'Percent (%)' : capFirst(u)))
    );
    return h(
      'div',
      { class: `num-row${fromOpps.includes(k) ? '' : ' is-extra'}` },
      h('div', { class: 'num-row__head' }, h('span', { class: 'num-row__name' }, icon('trend', 'icon--sm'), m.name), h('span', { class: `num-row__dir num-row__dir--${m.dir}` }, icon(m.dir === 'down' ? 'arrow-down' : 'arrow-up', 'icon--sm'), m.dir === 'down' ? 'Lower is better' : 'Higher is better')),
      h('div', { class: 'num-row__grid' }, field('cur', 'Current'), field('target', 'Target'), h('div', { class: 'field' }, h('label', { class: 'field__label', for: `num-${k}-unit` }, 'Unit'), unit))
    );
  };
  const add = others.length
    ? h(
        'select',
        {
          class: 'select',
          id: 'num-add',
          'aria-label': 'Add another KPI',
          'data-fk': 'num-add',
          onchange: (e) => {
            if (!e.target.value) return;
            numsExtra.push(e.target.value);
            refresh({ panel: false });
            focusByKey(`num-${e.target.value}-cur`);
          },
        },
        h('option', { value: '' }, 'Add another KPI'),
        others.map((k) => h('option', { value: k }, KPI_MEASURE[k].name))
      )
    : null;
  const matched = state.team.members.filter((x) => Object.keys(hubKpiValues(x)).length);
  const fill = matched.length
    ? h(
        'div',
        { class: 'field num-fill' },
        h('label', { class: 'field__label', for: 'num-fill' }, 'Fill from your dashboards'),
        h(
          'select',
          {
            class: 'select',
            id: 'num-fill',
            'data-fk': 'num-fill',
            onchange: (e) => {
              if (e.target.value) hubBuilderFill(e.target.value);
            },
          },
          h('option', { value: '' }, 'Choose an agent'),
          matched.map((x) => h('option', { value: x.id }, memberLabel(x)))
        )
      )
    : null;
  return h(
    'section',
    { class: 'card nums-card', 'aria-labelledby': 'bNumsTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bNumsTitle' }, icon('trend'), 'Measure with real numbers'), h('span', { class: 'sec__sub' }, 'optional')),
    h(
      'div',
      { class: 'card__body nums-body' },
      h('p', { class: 'field__hint' }, 'Type the agent\'s numbers from your KPI dashboard, or fill them from the hub dashboards. The action plan then states where they are today and the target by the end of the plan. Nothing is estimated.'),
      fill,
      keys.length ? keys.map(row) : h('p', { class: 'day-empty' }, icon('info'), 'Add opportunities to see the KPIs they affect, or add a KPI below.'),
      attrition ? h('p', { class: 'field__hint' }, icon('info', 'icon--sm'), ' Attrition is a team measure, so it has no agent number here.') : null,
      add ? h('div', { class: 'num-add' }, add) : null
    )
  );
}

function noteField({ key, label, hint, placeholder, rows = 3 }) {
  const id = `note-${key}`;
  const ta = h('textarea', { class: 'textarea', id, rows: String(rows), 'data-fk': id, placeholder, value: state.builder.notes[key] });
  const warn = h('div');
  const syncWarn = () => {
    const note = piiNote(ta.value);
    warn.replaceChildren(...(note ? [note] : []));
  };
  ta.addEventListener('input', () => {
    state.builder.notes[key] = ta.value;
    persistBuilderSoon();
    syncWarn();
    if (key !== 'private') updateBuilderOutputs();
  });
  syncWarn();
  return h('div', { class: 'field' }, h('label', { class: 'field__label', for: id }, label), hint ? h('p', { class: 'field__hint' }, hint) : null, ta, warn);
}

function notesCard() {
  const b = state.builder;
  const include = h('input', {
    type: 'checkbox',
    id: 'includeEvidence',
    'data-fk': 'includeEvidence',
    checked: b.notes.includeEvidence,
    onchange: (e) => {
      b.notes.includeEvidence = e.target.checked;
      persist('builder');
      updateBuilderOutputs();
    },
  });
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'bNotesTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bNotesTitle' }, icon('note'), 'Supervisor notes', h('span', { class: 'sec__sub' }, 'optional'))),
    h(
      'div',
      { class: 'card__body' },
      noteField({
        key: 'progress',
        label: 'Verified progress since the last session',
        hint: 'Only what you confirmed, such as results from audited calls. Added to the start of the progress section exactly as written.',
        placeholder: 'Example: In the five calls reviewed since our last session, you placed every hold with permission and a timeframe.',
      }),
      noteField({
        key: 'evidence',
        label: 'Call-specific evidence',
        hint: 'What you observed on the call, without names or IDs.',
        placeholder: 'Example: Around the middle of the call, the customer asked whether you were still on the line after a long silence.',
      }),
      h('label', { class: 'check', for: 'includeEvidence' }, include, 'Add the call-specific evidence to the challenges section'),
      h('div', { class: 'card__sep', role: 'presentation' }),
      noteField({ key: 'private', label: 'Private notes (never copied)', hint: 'Reminders for yourself. Not included in any copied text.', placeholder: 'Example: Ask about headset volume; check ITG access.', rows: 2 })
    )
  );
}

function cloneBuilder() {
  return JSON.parse(JSON.stringify(state.builder));
}

function suggestedName() {
  const titles = builderOpps().map((o) => o.title);
  if (!titles.length) return 'Strengths set';
  const name = titles.slice(0, 2).join(' + ') + (titles.length > 2 ? ` + ${titles.length - 2} more` : '');
  return name.slice(0, 80);
}

async function saveCombination() {
  const name = await promptDialog({ title: 'Save combination', label: 'Name this combination', value: suggestedName(), hint: 'Saves the selected opportunities, strengths, tone, and plan settings so you can reuse them. Do not include agent names or IDs.' });
  if (!name) return;
  const b = state.builder;
  state.combos.unshift({ id: uid('combo'), name, opps: [...b.opps], strengths: b.strengths.map((s) => ({ ...s })), tone: b.tone, scope: b.scope, settings: { ...state.settings }, created: Date.now() });
  persist('combos');
  refresh({ panel: false });
  toast(`Saved combination "${name}"`);
}

async function saveDraft(asNew) {
  const b = state.builder;
  const existing = !asNew && b.draftId ? state.drafts.find((d) => d.id === b.draftId) : null;
  const name = await promptDialog({
    title: existing ? 'Update draft' : 'Save draft',
    label: 'Draft name',
    value: existing ? existing.name : `Draft ${fmtDate(Date.now())}`,
    hint: 'Drafts keep everything, including your edited text and notes. Use a label without agent names or IDs.',
  });
  if (!name) return;
  const id = existing ? existing.id : uid('draft');
  b.draftId = id;
  const record = { id, name, builder: cloneBuilder(), settings: { ...state.settings }, saved: Date.now() };
  if (existing) state.drafts = state.drafts.map((d) => (d.id === id ? record : d));
  else state.drafts.unshift(record);
  persist('drafts', 'builder');
  refresh({ panel: false });
  toast(existing ? `Draft "${name}" updated` : `Draft "${name}" saved`);
}

async function loadCombination(c) {
  if (builderHasContent() && !(await confirmDialog({ title: 'Load combination?', message: `This replaces the current Builder selections, notes, and edited text with "${c.name}".`, confirmLabel: 'Load combination' }))) return;
  const b = defaultBuilder();
  b.opps = c.opps.filter((id) => getOpp(id));
  b.strengths = c.strengths.filter((s) => getStrength(s.id)).map((s) => ({ ...s }));
  b.tone = c.tone;
  b.scope = c.scope;
  state.builder = b;
  state.settings = sanitizeSettings(c.settings);
  persist('builder', 'settings');
  refresh();
  toast(`Loaded "${c.name}"`);
}

async function loadDraft(d) {
  if (builderHasContent() && state.builder.draftId !== d.id && !(await confirmDialog({ title: 'Load draft?', message: `This replaces the current Builder content with the draft "${d.name}".`, confirmLabel: 'Load draft' }))) return;
  state.builder = sanitizeBuilder(JSON.parse(JSON.stringify(d.builder)));
  state.builder.draftId = d.id;
  state.settings = sanitizeSettings(d.settings);
  persist('builder', 'settings');
  refresh();
  toast(`Loaded draft "${d.name}"`);
}

async function deleteSaved(kind, item) {
  const label = kind === 'combo' ? 'combination' : 'draft';
  if (!(await confirmDialog({ title: `Delete ${label}?`, message: `"${item.name}" will be permanently removed from this browser.`, confirmLabel: 'Delete', danger: true }))) return;
  if (kind === 'combo') {
    state.combos = state.combos.filter((c) => c.id !== item.id);
    persist('combos');
  } else {
    state.drafts = state.drafts.filter((d) => d.id !== item.id);
    if (state.builder.draftId === item.id) state.builder.draftId = null;
    persist('drafts', 'builder');
  }
  refresh({ panel: false });
  toast(`Deleted ${label} "${item.name}"`);
}

function savedCard() {
  const b = state.builder;
  const has = b.opps.length > 0 || b.strengths.length > 0;
  const loaded = b.draftId ? state.drafts.find((d) => d.id === b.draftId) : null;
  const savedItem = (kind, item, sub) =>
    h(
      'li',
      { class: 'saved-item' },
      h('div', { class: 'saved-item__main' }, h('div', { class: 'saved-item__name', title: item.name }, item.name), h('div', { class: 'saved-item__sub' }, sub)),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `load:${item.id}`, onclick: () => (kind === 'combo' ? loadCombination(item) : loadDraft(item)) }, 'Load'),
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Delete ${item.name}`, title: 'Delete', 'data-fk': `del:${item.id}`, onclick: () => deleteSaved(kind, item) }, icon('trash'))
    );
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'bSavedTitle' },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'bSavedTitle' }, icon('save'), 'Saved in this browser')),
    h(
      'div',
      { class: 'card__body' },
      h(
        'div',
        { class: 'data-row' },
        h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'save-combo', disabled: !has, onclick: saveCombination }, icon('layers'), 'Save combination'),
        loaded
          ? [
              h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'save-draft', onclick: () => saveDraft(false) }, icon('save'), 'Update draft'),
              h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'data-fk': 'save-draft-new', onclick: () => saveDraft(true) }, 'Save as new draft'),
            ]
          : h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'save-draft', disabled: !builderHasContent(), onclick: () => saveDraft(true) }, icon('save'), 'Save draft')
      ),
      loaded ? h('p', { class: 'hint' }, icon('info'), `Working on draft "${loaded.name}".`) : null,
      h('h3', { class: 'setting__label', style: 'margin-top:14px' }, 'Combinations'),
      state.combos.length
        ? h('ul', { class: 'saved-list' }, state.combos.map((c) => savedItem('combo', c, `${plural(c.opps.length, 'opportunity', 'opportunities')} · ${plural(c.strengths.length, 'strength')}`)))
        : h('p', { class: 'hint' }, 'Save selections you use often, such as a common tech-support pattern.'),
      h('h3', { class: 'setting__label', style: 'margin-top:14px' }, 'Drafts'),
      state.drafts.length
        ? h('ul', { class: 'saved-list' }, state.drafts.map((d) => savedItem('draft', d, `Saved ${fmtDate(d.saved)}`)))
        : h('p', { class: 'hint' }, 'Drafts keep your edited text so you can finish documentation later.')
    )
  );
}

/* ---------- Output ---------- */
function outSection(field, idx, gen) {
  const key = field.key;
  const titleId = `outt-${key}`;
  const b = state.builder;
  const edited = typeof b.edited[key] === 'string';
  const value = edited ? b.edited[key] : gen[key];
  const ta = h('textarea', {
    class: 'out-sec__text',
    id: `out-${key}`,
    'aria-labelledby': titleId,
    'aria-describedby': `outwc-${key}`,
    placeholder: OUT_PLACEHOLDER[key],
    'data-fk': `out:${key}`,
    spellcheck: 'true',
    value,
  });
  ta.addEventListener('input', () => {
    const generated = (lastGenerated || composeBuilder())[key];
    if (ta.value === generated) {
      b.edited[key] = null;
      b.base[key] = null;
    } else {
      if (typeof b.edited[key] !== 'string') b.base[key] = generated;
      b.edited[key] = ta.value;
    }
    persistBuilderSoon();
    syncOutSection(key);
    autosize(ta);
  });
  const reset = async () => {
    if (!(await confirmDialog({ title: 'Replace your edits?', message: 'This section will be regenerated from your current selections. Your manual edits to this section will be lost.', confirmLabel: 'Regenerate' }))) return;
    b.edited[key] = null;
    b.base[key] = null;
    persist('builder');
    updateBuilderOutputs();
    ta.focus();
  };
  return h(
    'section',
    { class: 'out-sec', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'out-sec__head' },
      h('span', { class: 'out-sec__num', 'aria-hidden': 'true' }, String(idx + 1)),
      h('h3', { class: 'out-sec__title', id: titleId }, field.title),
      copyButton(() => ta.value, { srLabel: `Copy ${field.title}`, fk: `ocopy:${key}`, emptyMessage: 'This section is empty.' })
    ),
    h(
      'div',
      { class: 'notice', id: `outstale-${key}`, hidden: true },
      icon('info'),
      h(
        'div',
        { class: 'notice__body' },
        'Your selections changed after you edited this section. Your edits were kept.',
        h('div', null, h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `regen:${key}`, onclick: reset }, icon('refresh'), 'Regenerate this section'))
      )
    ),
    ta,
    h(
      'div',
      { class: 'out-sec__foot' },
      h('span', { id: `outwc-${key}` }, ''),
      h('span', { class: 'badge badge--edited', id: `outbadge-${key}`, hidden: !edited }, 'Edited'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', id: `outreset-${key}`, 'data-fk': `reset:${key}`, hidden: !edited, onclick: reset }, icon('refresh'), 'Reset to generated')
    )
  );
}

function syncOutSection(key) {
  const b = state.builder;
  const gen = lastGenerated || composeBuilder();
  const ta = document.getElementById(`out-${key}`);
  if (!ta) return;
  const edited = typeof b.edited[key] === 'string';
  if (!edited && ta.value !== gen[key]) {
    ta.value = gen[key];
    autosize(ta);
  }
  const wc = document.getElementById(`outwc-${key}`);
  if (wc) wc.textContent = ta.value.trim() ? `${plural(wordCount(ta.value), 'word')}` : 'Empty';
  const badge = document.getElementById(`outbadge-${key}`);
  if (badge) badge.hidden = !edited;
  const resetBtn = document.getElementById(`outreset-${key}`);
  if (resetBtn) resetBtn.hidden = !edited;
  const stale = document.getElementById(`outstale-${key}`);
  if (stale) stale.hidden = !(edited && typeof b.base[key] === 'string' && b.base[key] !== gen[key]);
}

function updateBuilderOutputs() {
  lastGenerated = composeBuilder();
  BUILDER_FIELDS.forEach((f) => syncOutSection(f.key));
}

function outputColumn() {
  const gen = lastGenerated;
  const hasAny = builderCount() > 0 || !!state.builder.notes.progress.trim();
  return h(
    'div',
    { class: 'builder__col', 'aria-labelledby': 'outTitle', role: 'region' },
    h(
      'div',
      { class: 'out-head' },
      h('h2', { class: 'out-head__title', id: 'outTitle' }, 'Generated coaching entry'),
      h('a', { class: `btn btn--sm${state.builder.opps.some((id) => getOpp(id)) ? '' : ' is-disabled'}`, href: '#/session', 'data-fk': 'osession', 'aria-disabled': state.builder.opps.some((id) => getOpp(id)) ? null : 'true' }, icon('chat'), 'Run the session'),
      h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'otrack', disabled: !state.builder.opps.some((id) => getOpp(id)), onclick: openTrackFromBuilder }, icon('calendar'), 'Track this plan'),
      copyButton(
        () => (hasAny ? builderAllText() : ''),
        { label: 'Copy all sections', srLabel: 'Copy all four coaching sections', primary: true, size: 'md', fk: 'ocopy:all', emptyMessage: 'Add opportunities or observed strengths first.' }
      ),
      menuButton({
        label: 'More',
        fk: 'omore',
        items: [
          { label: 'Copy each feedback paragraph, unmerged', icon: 'copy', onSelect: () => copyText(stackedText('feedback'), { label: 'Feedback paragraphs', emptyMessage: 'Add opportunities first.' }) },
          { label: 'Copy each action plan, unmerged', icon: 'copy', onSelect: () => copyText(stackedText('plan'), { label: 'Action plans', emptyMessage: 'Add opportunities first.' }) },
          { label: 'Copy feedback and plans by opportunity', icon: 'copy', onSelect: () => copyText(stackedText('both'), { label: 'Feedback and plans', emptyMessage: 'Add opportunities first.' }) },
          { label: 'Copy observed strengths only', icon: 'thumb', onSelect: () => copyText(selectedStrengthsText(), { label: 'Observed strengths', emptyMessage: 'No strengths are marked as observed.' }) },
        ],
      })
    ),
    !gen.progress && hasAny
      ? h('p', { class: 'notice notice--info', style: 'margin-bottom:14px' }, icon('info'), h('span', { class: 'notice__body' }, 'The progress section is empty because no strengths or verified progress were added. Nothing is claimed on your behalf.'))
      : null,
    h('div', { class: 'out-sections' }, BUILDER_FIELDS.map((f, i) => outSection(f, i, gen)))
  );
}

async function resetBuilder() {
  if (!builderHasContent()) return;
  if (!(await confirmDialog({ title: 'Reset the Coaching Builder?', message: 'This clears the selected opportunities, strengths, notes, and edited text. Saved combinations and drafts are not affected.', confirmLabel: 'Reset builder', danger: true }))) return;
  state.builder = defaultBuilder();
  persist('builder');
  refresh();
  toast('Coaching Builder reset');
}

function renderBuilder(main) {
  lastGenerated = composeBuilder();
  put(main, 
    pageHead({
      title: 'Coaching Builder',
      sub: 'Combine several opportunities and the strengths you observed into one cohesive coaching entry, with a single consolidated SMART plan and follow-up. Edit any section before copying; your edits are kept.',
      actions: h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-fk': 'breset', disabled: !builderHasContent(), onclick: resetBuilder }, icon('refresh'), 'Reset builder'),
    }),
    h('div', { class: 'builder' }, h('div', { class: 'builder__col' }, oppsCard(), strengthsCard(), numbersCard(), settingsCard(), notesCard(), savedCard()), outputColumn())
  );
  requestAnimationFrame(() => {
    BUILDER_FIELDS.forEach((f) => {
      const ta = document.getElementById(`out-${f.key}`);
      if (ta) autosize(ta);
      syncOutSection(f.key);
    });
  });
}
