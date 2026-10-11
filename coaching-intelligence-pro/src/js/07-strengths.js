/* ==========================================================================
   07-strengths: Things Went Well library
   ========================================================================== */

function strengthCard(s, tokens) {
  const sel = state.builder.strengths.find((x) => x.id === s.id);
  const on = !!sel;
  const v = on ? Math.min(sel.v, s.v.length - 1) : Math.min(state.ui.sVersion[s.id] || 0, s.v.length - 1);
  const text = s.v[v] || '';
  const conflicts = on ? conflictsFor(s.id, state.builder.opps) : [];
  return h(
    'article',
    { class: `s-card${on ? ' is-selected' : ''}`, 'data-id': s.id },
    h(
      'div',
      { class: 's-card__top' },
      h('span', { class: `chip cat-chip ${s.custom ? 'cat-custom' : 'cat-str'}` }, h('span', { class: 'chip__dot' }), (S_GROUP_MAP[s.group] || {}).label || 'Strength'),
      s.custom ? h('span', { class: 'badge badge--custom' }, 'Custom') : s.customized ? h('span', { class: 'badge badge--edited' }, 'Edited') : null,
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn icon-btn--sm',
          style: 'margin-left:auto',
          'aria-label': `${s.builtin ? 'Customize the wording of' : 'Edit'} ${s.title}`,
          title: s.builtin ? 'Customize wording' : 'Edit',
          'data-fk': `sedit:${s.id}`,
          onclick: () => openStrengthEditor(s.id),
        },
        icon('edit')
      )
    ),
    h('h3', { class: 's-card__title' }, highlight(s.title, tokens)),
    s.desc ? h('p', { class: 's-card__desc' }, highlight(s.desc, tokens)) : null,
    h('p', { class: 's-card__text' }, text),
    conflicts.length ? h('p', { class: 'conflict' }, icon('alert'), `May contradict ${joinList(conflicts.map((o) => `"${o.title}"`))} in the Builder. Keep it only if both were observed.`) : null,
    h(
      'div',
      { class: 's-card__foot' },
      versionSwitch(s, v, 'sver'),
      copyButton(() => text, { srLabel: `Copy ${s.title}`, fk: `scopy:${s.id}` }),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--sm observe-btn',
          'aria-pressed': String(on),
          'aria-label': `${on ? 'Unmark' : 'Mark'} ${s.title} as observed`,
          'data-fk': `sobs:${s.id}`,
          onclick: () => toggleStrength(s.id, v),
        },
        icon(on ? 'check' : 'plus'),
        on ? 'Observed' : 'Mark observed'
      )
    )
  );
}

function renderStrengthsView(main) {
  const q = state.ui.query.trim();
  const group = state.prefs.sGroup;
  let base = content.strengths;
  if (group) base = base.filter((s) => s.group === group);
  const search = q ? searchList(base, q) : { results: base.map((item) => ({ item })), tokens: [] };
  const items = search.results.map((r) => r.item);
  const selected = selectedStrengths();

  put(main, 
    pageHead({
      title: 'Things Went Well',
      sub: `${content.strengths.length} reusable strengths, each with two or more wordings, written directly to the agent. Mark only what you observed; nothing positive is ever added to coaching text unless you select it.`,
    }),
    h(
      'div',
      { class: 'toolbar' },
      h('span', { class: 'toolbar__label', id: 'sgLabel' }, 'Area'),
      h(
        'div',
        { class: 'filter-chips', role: 'group', 'aria-labelledby': 'sgLabel' },
        [{ id: '', label: 'All' }].concat(S_GROUPS).map((g) =>
          h(
            'button',
            {
              type: 'button',
              class: 'filter-chip',
              'aria-pressed': String(group === g.id),
              'data-fk': `sg:${g.id}`,
              onclick: () => {
                state.prefs.sGroup = g.id;
                persist('prefs');
                refresh({ panel: false });
              },
            },
            g.label
          )
        )
      )
    )
  );
  if (q) put(main, h('p', { class: 'result-meta', role: 'status' }, items.length ? [h('strong', null, plural(items.length, 'strength')), ` match “${q}”`] : `No strengths match “${q}”`));
  if (!items.length) {
    put(main, emptyState({ iconName: 'thumb', title: 'No strengths found', text: 'Try another word, or clear the area filter.' }));
  } else {
    put(main, h('h2', { class: 'sr-only' }, 'Strengths'), h('div', { class: 's-grid' }, items.map((s) => strengthCard(s, search.tokens))));
  }
  if (selected.length) {
    put(main, 
      h(
        'div',
        { class: 'selection-bar', role: 'region', 'aria-label': 'Selected strengths' },
        h('span', { class: 'selection-bar__text' }, `${plural(selected.length, 'strength')} marked as observed`),
        copyButton(() => selectedStrengthsText(), { label: 'Copy selected', srLabel: 'Copy selected strengths', primary: true, fk: 'scopy-selected' }),
        h('a', { class: 'btn btn--sm', href: '#/builder' }, icon('clipboard'), 'Open Builder'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--sm',
            'data-fk': 'sclear',
            onclick: () => {
              state.builder.strengths = [];
              persist('builder');
              refresh();
              announce('All strength selections cleared.');
            },
          },
          'Clear'
        )
      )
    );
  }
}
