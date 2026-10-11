/* ==========================================================================
   07c-links: Quick Links (dashboards, tools, and forms used every day)
   ========================================================================== */

/**
 * Returns an https/http address for a value that looks like a web link, or null.
 * Anything else (a server IP, a file name, javascript:, data:) is shown as text with a Copy button and is never opened.
 */
function linkTarget(value) {
  const v = (value || '').trim();
  if (!v || /\s/.test(v)) return null;
  let candidate = null;
  if (/^https?:\/\//i.test(v)) candidate = v;
  else if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(v)) candidate = 'https://' + v;
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    return u.protocol === 'https:' || u.protocol === 'http:' ? candidate : null;
  } catch (e) {
    return null;
  }
}

function linkGroups(items) {
  const groups = [];
  items.forEach((l) => {
    if (!groups.includes(l.group)) groups.push(l.group);
  });
  return groups;
}

function linkMatches(l, q) {
  if (!q) return true;
  const hay = normalizeText(`${l.name} ${l.tag} ${l.note} ${l.group} ${l.url}`);
  return normalizeText(q)
    .split(' ')
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

function saveLinks() {
  persist('links');
  renderSidebar();
}

function toggleLinkPin(id) {
  const l = state.links.items.find((x) => x.id === id);
  if (!l) return;
  l.pinned = !l.pinned;
  saveLinks();
  refresh();
  announce(l.pinned ? `${l.name} pinned` : `${l.name} unpinned`);
}

function deleteLink(id) {
  const items = state.links.items;
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [removed] = items.splice(i, 1);
  saveLinks();
  refresh();
  toast(`Deleted ${removed.name}`, {
    action: {
      label: 'Undo',
      fn: () => {
        state.links.items.splice(Math.min(i, state.links.items.length), 0, removed);
        saveLinks();
        refresh();
      },
    },
  });
}

function linkRow(l, opts = {}) {
  const target = linkTarget(l.url);
  const key = `${opts.pinnedList ? 'p' : 'g'}:${l.id}`;
  let primary;
  if (target) {
    primary = h('a', { class: 'btn btn--sm btn--primary', href: target, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${l.name} (new tab)`, 'data-fk': `lk-open:${key}` }, icon('external'), 'Open');
  } else if (l.url) {
    primary = copyButton(l.url, { label: 'Copy', srLabel: `Copy ${l.name}`, fk: `lk-copyval:${key}` });
  } else {
    primary = h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': `lk-add:${key}`, onclick: () => openLinkEditor(l) }, icon('plus'), 'Add address');
  }
  return h(
    'li',
    { class: `lk-row${l.url ? '' : ' is-missing'}` },
    h(
      'div',
      { class: 'lk-row__main' },
      h('div', { class: 'lk-row__title' }, h('span', { class: 'lk-row__name' }, l.name), l.tag ? h('span', { class: 'kpi' }, l.tag) : null, l.url ? null : h('span', { class: 'tag lk-missing' }, 'Address missing')),
      l.note ? h('p', { class: 'lk-row__note' }, l.note) : null,
      target ? h('p', { class: 'lk-row__url' }, target.replace(/^https?:\/\//i, '')) : l.url ? h('p', { class: 'lk-row__url' }, l.url) : null
    ),
    h(
      'div',
      { class: 'lk-row__actions' },
      primary,
      target ? h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Copy link: ${l.name}`, title: 'Copy link', 'data-fk': `lk-copy:${key}`, onclick: (e) => copyText(target, { button: e.currentTarget, label: `link for ${l.name}` }) }, icon('copy')) : null,
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm is-fav', 'aria-pressed': String(l.pinned), 'aria-label': `Pin ${l.name}`, title: l.pinned ? 'Unpin' : 'Pin to the top', 'data-fk': `lk-pin:${key}`, onclick: () => toggleLinkPin(l.id) }, icon('star')),
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Edit ${l.name}`, title: 'Edit', 'data-fk': `lk-edit:${key}`, onclick: () => openLinkEditor(l) }, icon('edit')),
      h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': `Delete ${l.name}`, title: 'Delete', 'data-fk': `lk-del:${key}`, onclick: () => deleteLink(l.id) }, icon('trash'))
    )
  );
}

function linkSection(title, iconName, items, opts = {}) {
  const id = `lk-sec-${opts.pinnedList ? 'pinned' : normalizeText(title).replace(/[^a-z0-9]+/g, '-')}`;
  return h(
    'section',
    { class: 'card lk-sec', 'aria-labelledby': id },
    h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id }, icon(iconName), title), h('span', { class: 'sec__sub' }, plural(items.length, 'link'))),
    h('ul', { class: 'lk-list' }, items.map((l) => linkRow(l, opts)))
  );
}

function renderLinkList(box) {
  const q = state.ui.linkQuery || '';
  const items = state.links.items.filter((l) => linkMatches(l, q));
  const out = [];
  if (!state.links.items.length) {
    out.push(
      emptyState({
        iconName: 'link',
        title: 'No links yet',
        text: 'Add the dashboards, tools, and forms you open every day, or paste them from a spreadsheet.',
        action: h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-fk': 'lk-empty-add', onclick: () => openLinkEditor(null) }, icon('plus'), 'Add a link'),
      })
    );
  } else if (!items.length) {
    out.push(emptyState({ iconName: 'search', title: 'No matching links', text: 'Try another word, such as AICR, NPS, schedule, or form.' }));
  } else {
    const pinned = items.filter((l) => l.pinned);
    if (pinned.length && !q) out.push(linkSection('Pinned', 'star', pinned, { pinnedList: true }));
    linkGroups(items).forEach((g) => out.push(linkSection(g, 'link', items.filter((l) => l.group === g))));
  }
  box.replaceChildren(...out);
}

function renderLinks(main) {
  const missing = state.links.items.filter((l) => !l.url).length;
  const filter = h('input', {
    class: 'input lk-filter__input',
    type: 'search',
    id: 'lkFilter',
    placeholder: 'Filter links: AICR, NPS, schedule, form…',
    'aria-label': 'Filter links',
    autocomplete: 'off',
    value: state.ui.linkQuery || '',
    'data-fk': 'lk-filter',
  });
  const list = h('div', { class: 'lk-groups' });
  filter.addEventListener('input', () => {
    state.ui.linkQuery = filter.value;
    renderLinkList(list);
  });
  const actions = [
    h('button', { type: 'button', class: 'btn btn--sm btn--primary', 'data-fk': 'lk-new', onclick: () => openLinkEditor(null) }, icon('plus'), 'Add link'),
    h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'lk-paste', onclick: openLinkPaste }, icon('clipboard'), 'Paste from a spreadsheet'),
  ];
  if ((DATA.seedLinks || []).length) {
    actions.push(
      menuButton({
        label: 'More',
        fk: 'lk-more',
        items: [{ label: 'Restore preset links', icon: 'refresh', onSelect: restorePresetLinks }],
      })
    );
  }
  put(main, 
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-custom', style: 'width:22px;height:22px;border-radius:6px' }, icon('link', 'icon--sm')), 'Daily tools'],
      title: 'Quick Links',
      sub: 'The dashboards, tools, and forms you use every day, one click away. Links open in a new browser tab with your normal sign-in; this app itself still makes no network requests.',
      actions,
    }),
    missing
      ? h('p', { class: 'banner', role: 'note' }, icon('info'), h('span', null, `${plural(missing, 'link')} ${missing === 1 ? 'has' : 'have'} no address yet. Open the dashboard once, copy the address from the browser bar, and paste it with Add address.`))
      : null,
    h('div', { class: 'lk-filter' }, icon('search'), filter),
    list
  );
  renderLinkList(list);
}

async function restorePresetLinks() {
  if (!(await confirmDialog({ title: 'Restore preset links?', message: 'This replaces your current quick links with the preset list that came with this copy of the app. Links you added or edited will be removed.', confirmLabel: 'Restore preset', danger: true }))) return;
  state.links = initialLinks();
  saveLinks();
  refresh();
  toast('Preset links restored');
}

/* ---------- Add / edit ---------- */
function openLinkEditor(existing) {
  const src = existing || { name: '', url: '', group: state.links.items.length ? state.links.items[state.links.items.length - 1].group : 'Dashboards', tag: '', note: '', pinned: false };
  const listId = uid('lk-groups');
  const groups = linkGroups(state.links.items);
  const fields = {
    name: h('input', { class: 'input', id: 'lk-name', type: 'text', value: src.name, maxlength: '80', autocomplete: 'off' }),
    url: h('input', { class: 'input', id: 'lk-url', type: 'text', value: src.url, maxlength: '1000', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://…' }),
    group: h('input', { class: 'input', id: 'lk-group', type: 'text', value: src.group, maxlength: '40', autocomplete: 'off', list: listId }),
    tag: h('input', { class: 'input', id: 'lk-tag', type: 'text', value: src.tag, maxlength: '30', autocomplete: 'off', placeholder: 'AICR, NPS, QA…' }),
    note: h('textarea', { class: 'textarea', id: 'lk-note', rows: '2', maxlength: '300', value: src.note, placeholder: 'For example: 4 calls per day' }),
    pinned: h('input', { type: 'checkbox', id: 'lk-pinned', checked: !!src.pinned }),
  };
  const urlHint = h('p', { class: 'field__hint', 'aria-live': 'polite' });
  const nameErr = h('p', { class: 'field__error', hidden: true }, 'Enter a name.');
  const updateHint = () => {
    const v = fields.url.value.trim();
    const t = linkTarget(v);
    urlHint.textContent = !v ? 'Leave empty to fill in later.' : t ? `Opens ${t}` : 'Not a web address, so it is shown as text with a Copy button (for example a server address).';
  };
  fields.url.addEventListener('input', updateHint);
  updateHint();
  const field = (id, label, control, hint, span) => h('div', { class: `field${span ? ' span-2' : ''}` }, h('label', { class: 'field__label', for: id }, label), control, hint || null);
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('save'), existing ? 'Save changes' : 'Add link');
  const m = openModal({
    title: existing ? 'Edit link' : 'Add a link',
    size: 'md',
    body: h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'field span-2' }, h('label', { class: 'field__label', for: 'lk-name' }, 'Name', h('span', { class: 'field__req', 'aria-hidden': 'true' }, '*')), fields.name, nameErr),
      field('lk-url', 'Address (link or text)', fields.url, urlHint, true),
      field('lk-group', 'Group', fields.group, null),
      field('lk-tag', 'KPI or label', fields.tag, null),
      field('lk-note', 'Note', fields.note, h('p', { class: 'field__hint' }, 'What it is for, a target, or a deadline. Do not enter agent or customer details.'), true),
      h('label', { class: 'check span-2' }, fields.pinned, 'Pin to the top of Quick Links'),
      h('datalist', { id: listId }, groups.map((g) => h('option', { value: g })))
    ),
    footer: [cancel, h('span', { class: 'spacer' }), save],
    initialFocus: existing && !existing.url ? fields.url : fields.name,
  });
  cancel.addEventListener('click', () => m.close());
  const submit = () => {
    const name = fields.name.value.trim();
    nameErr.hidden = !!name;
    if (!name) {
      fields.name.focus();
      return;
    }
    const data = sanitizeLinks({
      items: [{ id: existing ? existing.id : uid('link'), name, url: fields.url.value, group: fields.group.value, tag: fields.tag.value, note: fields.note.value, pinned: fields.pinned.checked }],
    }).items[0];
    if (existing) {
      const i = state.links.items.findIndex((x) => x.id === existing.id);
      if (i >= 0) state.links.items[i] = data;
      else state.links.items.push(data);
    } else {
      state.links.items.push(data);
    }
    saveLinks();
    m.close();
    refresh();
    toast(existing ? 'Link saved' : `Added ${data.name}`);
  };
  save.addEventListener('click', submit);
  m.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
      e.preventDefault();
      submit();
    }
  });
}

/* ---------- Paste from a spreadsheet ---------- */
/**
 * Reads rows copied from Excel or Teams (tab-separated). The cell that looks like a link becomes the address;
 * with three or more other cells they are read as KPI, name, and description, otherwise as name and note.
 */
function parseLinkTable(text, group) {
  const rows = [];
  const isAddress = (c) => !!linkTarget(c) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(c);
  for (const line of String(text || '').split(/\r?\n/)) {
    const cells = line.split('\t').map((c) => c.trim());
    const filled = cells.filter(Boolean);
    if (!filled.length) continue;
    let urlIdx = -1;
    cells.forEach((c, i) => {
      if (c && isAddress(c)) urlIdx = i;
    });
    const url = urlIdx >= 0 ? cells[urlIdx] : '';
    const rest = cells.filter((c, i) => c && i !== urlIdx);
    if (!url && rest.length < 2) continue; // a stray line, not a row
    if (!url && rest.some((c) => /^(link|links|url)$/i.test(c))) continue; // header row
    let name;
    let tag = '';
    let note = '';
    if (rest.length >= 3) [tag, name, note] = rest;
    else if (rest.length === 2) [name, note] = rest;
    else name = rest[0] || url;
    rows.push({ name, url, group, tag, note, pinned: false });
  }
  return sanitizeLinks({ items: rows }).items;
}

function openLinkPaste() {
  const area = h('textarea', { class: 'textarea', id: 'lk-paste', rows: '8', spellcheck: 'false', placeholder: 'Copy rows from Excel, a Teams table, or an email and paste them here.' });
  const group = h('input', { class: 'input', id: 'lk-paste-group', type: 'text', value: 'Imported', maxlength: '40', autocomplete: 'off' });
  const preview = h('p', { class: 'field__hint', 'aria-live': 'polite' }, 'Nothing pasted yet.');
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const add = h('button', { type: 'button', class: 'btn btn--primary', disabled: true }, icon('plus'), 'Add links');
  let parsed = [];
  const update = () => {
    parsed = parseLinkTable(area.value, group.value.trim() || 'Imported');
    const missing = parsed.filter((l) => !l.url).length;
    preview.textContent = parsed.length ? `Found ${plural(parsed.length, 'link')}${missing ? `, ${missing} without an address` : ''}: ${parsed.slice(0, 4).map((l) => l.name).join(', ')}${parsed.length > 4 ? '…' : ''}` : 'No rows found yet. Each row needs a name and a link, separated by a tab.';
    add.disabled = !parsed.length;
  };
  area.addEventListener('input', update);
  group.addEventListener('input', update);
  const m = openModal({
    title: 'Paste links from a spreadsheet',
    size: 'md',
    body: h(
      'div',
      null,
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'lk-paste' }, 'Rows to add'), area, preview),
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'lk-paste-group' }, 'Add to group'), group)
    ),
    footer: [cancel, h('span', { class: 'spacer' }), add],
    initialFocus: area,
  });
  cancel.addEventListener('click', () => m.close());
  add.addEventListener('click', () => {
    if (!parsed.length) return;
    const known = new Set(state.links.items.map((l) => `${normalizeText(l.name)}|${l.url}`));
    const fresh = parsed.filter((l) => !known.has(`${normalizeText(l.name)}|${l.url}`));
    state.links.items.push(...fresh);
    saveLinks();
    m.close();
    refresh();
    const skipped = parsed.length - fresh.length;
    toast(`Added ${plural(fresh.length, 'link')}${skipped ? ` (${skipped} already in your list)` : ''}`);
  });
}
