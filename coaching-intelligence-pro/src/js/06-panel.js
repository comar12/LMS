/* ==========================================================================
   06-panel: coaching detail panel (docked on wide screens, overlay elsewhere)
   ========================================================================== */

function openOpp(id) {
  if (!getOpp(id)) return;
  state.ui.returnFocusKey = `open:${id}`;
  navigate(state.ui.view, { cat: state.ui.cat, open: id });
}

function closePanel() {
  navigate(state.ui.view, { cat: state.ui.cat, open: null });
}

function showPanel() {
  els.app.classList.add('panel-open');
  renderPanel();
  syncInert();
  focusSoon($('#panelTitle'));
  $$('.opp-card.is-active').forEach((c) => c.classList.remove('is-active'));
  const card = document.querySelector(`.opp-card[data-id="${cssEscape(state.ui.openId)}"]`);
  if (card) card.classList.add('is-active');
}

function hidePanel() {
  const wasOpen = els.app.classList.contains('panel-open');
  els.app.classList.remove('panel-open');
  $$('.opp-card.is-active').forEach((c) => c.classList.remove('is-active'));
  syncInert();
  setTimeout(() => {
    if (!state.ui.openId) els.panel.replaceChildren();
  }, 280);
  if (wasOpen && state.ui.returnFocusKey) {
    const target = document.querySelector(`[data-fk="${cssEscape(state.ui.returnFocusKey)}"]`);
    if (target) target.focus({ preventScroll: true });
    else els.main.focus({ preventScroll: true });
  }
}

function panelSiblings() {
  const ids = state.ui.visibleIds && state.ui.visibleIds.includes(state.ui.openId) ? state.ui.visibleIds : content.opps.map((o) => o.id);
  const i = ids.indexOf(state.ui.openId);
  return { ids, i };
}

function stepPanel(delta) {
  const { ids, i } = panelSiblings();
  if (i < 0) return;
  const next = ids[i + delta];
  if (next) {
    state.ui.returnFocusKey = `open:${next}`;
    navigate(state.ui.view, { cat: state.ui.cat, open: next, replace: true });
  }
}

function sec({ letter, cls, title, body, copy, sub, fk, foot }) {
  const id = uid('sec');
  return h(
    'section',
    { class: `sec sec--${cls}`, 'aria-labelledby': id },
    h(
      'div',
      { class: 'sec__head' },
      letter ? h('span', { class: 'sec__letter', 'aria-hidden': 'true' }, letter) : null,
      h('h3', { class: 'sec__title', id }, title, sub ? h('span', { class: 'sec__sub' }, ` · ${sub}`) : null),
      copy ? copyButton(copy, { srLabel: `Copy ${title}`, fk }) : null
    ),
    h('div', { class: 'sec__body' }, body),
    foot ? h('div', { class: 'sec__foot' }, foot) : null
  );
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => h('p', null, p.trim()));
}

/* ---------- Strength selection (shared with the Builder) ---------- */
function isStrengthSelected(id) {
  return state.builder.strengths.some((s) => s.id === id);
}

function toggleStrength(id, version) {
  const s = getStrength(id);
  if (!s) return;
  const list = state.builder.strengths;
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    announce(`${s.title} removed from observed strengths.`);
  } else {
    const v = typeof version === 'number' ? version : state.ui.sVersion[id] || 0;
    list.push({ id, v: Math.min(v, s.v.length - 1) });
    announce(`${s.title} marked as observed.`);
  }
  persist('builder');
  refresh();
}

function setStrengthVersion(id, v) {
  const s = getStrength(id);
  if (!s) return;
  const vv = Math.max(0, Math.min(v, s.v.length - 1));
  state.ui.sVersion[id] = vv;
  const sel = state.builder.strengths.find((x) => x.id === id);
  if (sel) {
    sel.v = vv;
    persist('builder');
  }
  refresh();
}

function versionSwitch(s, current, fkPrefix) {
  if (!s.v || s.v.length < 2) return null;
  return h(
    'div',
    { class: 'version-switch', role: 'group', 'aria-label': `Wording versions for ${s.title}` },
    s.v.map((_, i) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(i === current),
          'aria-label': `Version ${i + 1}`,
          title: `Version ${i + 1}`,
          'data-fk': `${fkPrefix}:${s.id}:${i}`,
          onclick: () => setStrengthVersion(s.id, i),
        },
        String(i + 1)
      )
    )
  );
}

function strengthToggleChip(id, fkPrefix) {
  const s = getStrength(id);
  if (!s) return null;
  const on = isStrengthSelected(id);
  return h(
    'button',
    {
      type: 'button',
      class: 's-chip',
      'aria-pressed': String(on),
      'data-fk': `${fkPrefix}:${id}`,
      title: s.desc || s.title,
      onclick: () => toggleStrength(id),
    },
    icon(on ? 'check' : 'plus'),
    s.title
  );
}

function strengthSection(o) {
  const selected = selectedStrengths();
  const suggested = (o.strengths || []).filter((id) => getStrength(id));
  const body = [
    h('p', { class: 'hint' }, icon('info'), 'Select only strengths you observed on the call. Selections are shared with the Coaching Builder and are never added to coaching text automatically.'),
    h(
      'div',
      { class: 'strength-chips', role: 'group', 'aria-label': 'Suggested strengths' },
      suggested.map((id) => strengthToggleChip(id, 'pchip')),
      h('button', { type: 'button', class: 's-chip s-chip--more', 'data-fk': 'pchip-more', onclick: () => openStrengthPicker() }, icon('search'), 'All strengths')
    ),
  ];
  if (selected.length) {
    body.push(
      h(
        'div',
        { class: 'sel-strengths' },
        selected.map((sel) => {
          const s = getStrength(sel.id);
          const conflicts = conflictsFor(sel.id, [o.id]);
          return h(
            'div',
            { class: 'sel-strength' },
            h(
              'div',
              { class: 'sel-strength__head' },
              h('span', { class: 'sel-strength__title' }, s.title),
              versionSwitch(s, Math.min(sel.v, s.v.length - 1), 'pver'),
              h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Remove ${s.title}`, title: 'Remove', 'data-fk': `prm:${s.id}`, onclick: () => toggleStrength(s.id) }, icon('x'))
            ),
            h('p', { class: 'sel-strength__text' }, strengthText(sel)),
            conflicts.length ? h('p', { class: 'conflict' }, icon('alert'), `This strength may contradict the opportunity "${o.title}". Keep it only if both were genuinely observed.`) : null
          );
        })
      )
    );
  }
  return sec({
    letter: 'A',
    cls: 'a',
    title: SECTION.strengths,
    sub: selected.length ? `${selected.length} selected` : 'optional',
    body,
    copy: selected.length ? () => selectedStrengthsText() : null,
    fk: 'pcopy:strengths',
  });
}

function openStrengthPicker() {
  const listWrap = h('div', { class: 'stack', style: 'gap:6px' });
  const input = h('input', { class: 'input', type: 'search', placeholder: 'Filter strengths', 'aria-label': 'Filter strengths', autocomplete: 'off' });
  const draw = () => {
    const q = input.value.trim();
    const items = q ? searchList(content.strengths, q).results.map((r) => r.item) : content.strengths;
    listWrap.replaceChildren();
    if (!items.length) listWrap.appendChild(h('p', { class: 'hint' }, 'No strengths match.'));
    items.forEach((s) => {
      const on = isStrengthSelected(s.id);
      listWrap.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 's-chip',
            style: 'width:100%;border-radius:10px;padding:8px 12px;justify-content:flex-start',
            'aria-pressed': String(on),
            onclick: (e) => {
              toggleStrength(s.id);
              const btn = e.currentTarget;
              const nowOn = isStrengthSelected(s.id);
              btn.setAttribute('aria-pressed', String(nowOn));
              setIcon(btn.querySelector('svg'), nowOn ? 'check' : 'plus');
            },
          },
          icon(on ? 'check' : 'plus'),
          h('span', { style: 'display:flex;flex-direction:column;gap:2px;text-align:left' }, h('span', null, s.title), h('span', { style: 'font-weight:500;color:var(--text-3);font-size:12px' }, `${(S_GROUP_MAP[s.group] || {}).label || ''} · ${s.desc || ''}`))
        )
      );
    });
  };
  input.addEventListener('input', draw);
  draw();
  const m = openModal({
    title: 'Observed strengths',
    size: 'md',
    body: [h('p', { class: 'hint', style: 'margin-bottom:12px' }, icon('info'), 'Select every strength you observed. They appear in Things Went Well and in the Coaching Builder.'), input, h('div', { style: 'margin-top:12px' }, listWrap)],
    footer: [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => m.close() }, 'Done')],
    initialFocus: input,
  });
}

/* ---------- Plan settings (shared) ---------- */
function updateSettings(patch) {
  state.settings = sanitizeSettings({ ...state.settings, ...patch });
  persist('settings');
  refresh();
}

function planSettingsControls(prefix) {
  const s = state.settings;
  return h(
    'div',
    { class: 'settings-grid' },
    h(
      'div',
      { class: 'setting' },
      h('label', { class: 'setting__label', for: `${prefix}-duration` }, 'Plan length'),
      h(
        'select',
        { class: 'select', id: `${prefix}-duration`, 'data-fk': `${prefix}-duration`, value: String(s.duration), onchange: (e) => updateSettings({ duration: Number(e.target.value) }) },
        [...new Set(DURATION_OPTIONS.concat([s.duration]))].sort((a, b) => a - b).map((d) => h('option', { value: String(d) }, durationOptionLabel(d)))
      )
    ),
    h('div', { class: 'setting' }, h('label', { class: 'setting__label', for: `${prefix}-calls` }, 'Calls to review'), stepper({ id: `${prefix}-calls`, label: 'calls to review', value: s.calls, min: 2, max: 20, onChange: (v) => updateSettings({ calls: v }) })),
    h('div', { class: 'setting' }, h('label', { class: 'setting__label', for: `${prefix}-followup` }, 'First review within (days)'), stepper({ id: `${prefix}-followup`, label: 'days until the first review', value: s.followup, min: 1, max: s.duration, onChange: (v) => updateSettings({ followup: v }) }))
  );
}

function openPlanSettings() {
  const wrap = h('div');
  const draw = () => {
    const active = document.activeElement;
    const fk = active && wrap.contains(active) ? active.getAttribute('data-fk') : null;
    wrap.replaceChildren(planSettingsControls('modal'), h('p', { class: 'hint', style: 'margin-top:14px' }, icon('info'), 'These defaults apply to every SMART plan and follow-up plan, including the Coaching Builder.'));
    if (fk) focusByKey(fk, wrap);
  };
  draw();
  const rerender = () => draw();
  const m = openModal({
    title: 'Action plan settings',
    size: 'sm',
    body: wrap,
    footer: [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => m.close() }, 'Done')],
  });
  // Re-draw the controls after each change so min/max stay accurate.
  wrap.addEventListener('change', () => setTimeout(rerender, 0));
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('.stepper button')) setTimeout(rerender, 0);
  });
}

/* ---------- Panel ---------- */
function renderPanel(opts = {}) {
  const o = getOpp(state.ui.openId);
  const panel = els.panel;
  if (!o) {
    panel.replaceChildren();
    return;
  }
  const oldBody = panel.querySelector('.panel__body');
  const scroll = opts.keepScroll && oldBody ? oldBody.scrollTop : 0;
  const { ids, i } = panelSiblings();
  const fav = state.favorites.has(o.id);
  const added = state.builder.opps.includes(o.id);
  const s = state.settings;

  const head = h(
    'div',
    { class: 'panel__head' },
    h(
      'div',
      { class: 'panel__bar' },
      catChip(o.cat),
      o.custom ? h('span', { class: 'badge badge--custom' }, 'Custom') : o.customized ? h('span', { class: 'badge badge--edited' }, 'Edited') : null,
      h(
        'div',
        { class: 'panel__nav' },
        i >= 0 ? h('span', { class: 'panel__pos', 'aria-hidden': 'true' }, `${i + 1} / ${ids.length}`) : null,
        h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': 'Previous opportunity', title: 'Previous ([)', 'data-fk': 'panel-prev', disabled: i <= 0, onclick: () => stepPanel(-1) }, icon('chev-left')),
        h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': 'Next opportunity', title: 'Next (])', 'data-fk': 'panel-next', disabled: i < 0 || i >= ids.length - 1, onclick: () => stepPanel(1) }, icon('chev-right')),
        h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': 'Close coaching detail', title: 'Close (Esc)', 'data-fk': 'panel-close', onclick: closePanel }, icon('x'))
      )
    ),
    h('h2', { class: 'panel__title', id: 'panelTitle', tabindex: '-1' }, o.title),
    o.desc ? h('p', { class: 'panel__desc' }, o.desc) : null,
    h('div', { class: 'panel__meta' }, (o.kpi || []).map(kpiChip), (o.tags || []).map((t) => h('span', { class: 'tag' }, t))),
    h(
      'div',
      { class: 'panel__actions' },
      copyButton(() => fullCoachingText(o), { label: 'Copy Full Coaching', srLabel: 'Copy full coaching document', primary: true, size: 'md', fk: 'pcopy:full' }),
      h(
        'button',
        { type: 'button', class: `btn btn--sm${added ? ' is-on' : ''}`, 'aria-pressed': String(added), 'data-fk': 'padd', onclick: () => toggleBuilderOpp(o.id) },
        icon(added ? 'check' : 'plus'),
        added ? 'In Builder' : 'Add to Builder'
      ),
      h(
        'button',
        { type: 'button', class: `btn btn--sm${fav ? ' is-on' : ''}`, 'aria-pressed': String(fav), 'data-fk': 'pfav', onclick: () => toggleFavorite(o.id) },
        icon('star', fav ? 'is-filled' : ''),
        fav ? 'Favorited' : 'Favorite'
      ),
      h('button', { type: 'button', class: 'icon-btn icon-btn--bordered', style: 'width:30px;height:30px;border-radius:8px', 'aria-label': o.builtin ? `Customize the wording of ${o.title}` : `Edit ${o.title}`, title: o.builtin ? 'Customize wording' : 'Edit', 'data-fk': 'pedit', onclick: () => openOppEditor(o.id) }, icon('edit', 'icon--sm'))
    )
  );

  const planMeta = [
    icon('calendar', 'icon--sm'),
    `${durationPhrase(s.duration)} plan · ${s.calls} calls reviewed within ${s.followup} ${s.followup === 1 ? 'day' : 'days'}`,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'data-fk': 'pplan-settings', onclick: openPlanSettings }, 'Change'),
  ];

  const body = h(
    'div',
    { class: 'panel__body' },
    strengthSection(o),
    sec({ letter: 'B', cls: 'b', title: SECTION.feedback, body: paragraphs(oppFeedback(o)), copy: () => oppFeedback(o), fk: 'pcopy:feedback' }),
    o.impact ? sec({ letter: 'C', cls: 'c', title: SECTION.impact, body: paragraphs(oppImpact(o)), copy: () => oppImpact(o), fk: 'pcopy:impact' }) : null,
    o.plan ? sec({ letter: 'D', cls: 'd', title: planHeading(), body: paragraphs(oppPlan(o)), copy: () => oppPlan(o), fk: 'pcopy:plan', foot: planMeta }) : null,
    o.followup ? sec({ letter: 'E', cls: 'e', title: SECTION.followup, body: paragraphs(oppFollowup(o)), copy: () => oppFollowup(o), fk: 'pcopy:followup' }) : null,
    exampleLines(o).length
      ? sec({
          letter: 'F',
          cls: 'f',
          title: SECTION.example,
          body: exampleLines(o).map((e) => h('blockquote', { class: 'quote' }, e.label ? h('span', { class: 'quote__label' }, e.label) : null, h('p', { class: 'quote__text' }, `“${e.say}”`))),
          copy: () => exampleText(o),
          fk: 'pcopy:example',
        })
      : null,
    (o.questions || []).length ? sec({ letter: 'G', cls: 'g', title: SECTION.questions, body: h('ol', { class: 'qlist' }, o.questions.map((q) => h('li', null, q))), copy: () => questionsText(o), fk: 'pcopy:questions' }) : null,
    o.note
      ? h(
          'section',
          { class: 'sec sec--note', 'aria-label': 'Supervisor note' },
          h('div', { class: 'sec__body' }, icon('note'), h('div', null, h('strong', { style: 'display:block;color:var(--text);font-size:12.5px;margin-bottom:2px' }, 'Supervisor note (not copied)'), o.note))
        )
      : null,
    h('p', { class: 'hint', style: 'padding:2px 2px 0' }, icon('info'), fullCopySummary())
  );

  panel.replaceChildren(head, body);
  panel.setAttribute('aria-labelledby', 'panelTitle');
  if (scroll) body.scrollTop = scroll;
}

function fullCopySummary() {
  const fc = state.prefs.fullCopy;
  const names = [];
  if (fc.strengths) names.push('selected strengths');
  if (fc.feedback) names.push('Things Can Be Better');
  if (fc.impact) names.push('Root Cause & Customer Impact');
  if (fc.plan) names.push('the SMART plan');
  if (fc.followup) names.push('the follow-up plan');
  if (fc.example) names.push('the example statement');
  if (fc.questions) names.push('the coaching questions');
  return `Copy Full Coaching includes ${joinList(names) || 'nothing'}. Change this in Settings & Data.`;
}
