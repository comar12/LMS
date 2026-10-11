/* ==========================================================================
   09-templates: My Templates view, opportunity and strength editors
   ========================================================================== */

const ALLOWED_TOKENS = ['{duration}', '{durationAdj}', '{calls}', '{followup}'];

function splitList(v) {
  return String(v || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unknownTokens(text) {
  return (String(text || '').match(/\{[^}]*\}/g) || []).filter((t) => !ALLOWED_TOKENS.includes(t));
}

function parseExamples(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf(' | ');
      const strip = (s) => s.replace(/^["“]+|["”]+$/g, '').trim();
      if (bar > 0 && bar <= 60) return { label: line.slice(0, bar).trim(), say: strip(line.slice(bar + 3)) };
      return { say: strip(line) };
    })
    .filter((e) => e.say);
}

function examplesToText(list) {
  return (list || []).map((e) => (e.label ? `${e.label} | ${e.say}` : e.say)).join('\n');
}

function formField({ id, label, control, hint, required, span2 = true, count }) {
  const counter = count ? h('span', { class: 'field__hint', style: 'margin-left:auto' }) : null;
  const update = () => {
    if (counter) counter.textContent = `${plural(wordCount(control.value), 'word')}${count.target ? ` (aim for ${count.target})` : ''}`;
  };
  if (counter) {
    control.addEventListener('input', update);
    update();
  }
  const warn = h('div');
  if (control.tagName === 'TEXTAREA' || (control.tagName === 'INPUT' && control.type === 'text')) {
    const sync = () => {
      const n = piiNote(control.value);
      warn.replaceChildren(...(n ? [n] : []));
    };
    control.addEventListener('input', sync);
    sync();
  }
  return h(
    'div',
    { class: `field${span2 ? ' span-2' : ''}` },
    h('label', { class: 'field__label', for: id }, label, required ? h('span', { class: 'field__req', 'aria-hidden': 'true' }, '*') : null, counter),
    control,
    hint ? h('p', { class: 'field__hint' }, hint) : null,
    warn
  );
}

function textInput(id, value, attrs = {}) {
  return h('input', { class: 'input', type: 'text', id, value: value || '', autocomplete: 'off', ...attrs });
}
function textArea(id, value, rows, attrs = {}) {
  return h('textarea', { class: 'textarea', id, rows: String(rows), value: value || '', ...attrs });
}

function openOppEditor(id) {
  const existing = id ? getOpp(id) : null;
  const isBuiltin = !!(existing && existing.builtin);
  const src = existing || {
    title: '',
    cat: state.ui.view === 'cat' && state.ui.cat ? state.ui.cat : 'com',
    desc: '',
    kw: [],
    tags: [],
    kpi: ['QA'],
    feedback: '',
    impact: '',
    plan: '',
    followup: '',
    example: [],
    questions: [],
    strengths: [],
    note: '',
    theme: '',
    b: {},
  };
  const b = src.b || {};
  const f = {
    title: textInput('ed-title', src.title, { maxlength: '120', 'aria-required': 'true' }),
    cat: h('select', { class: 'select', id: 'ed-cat' }, CATS.map((c) => h('option', { value: c.id, selected: c.id === src.cat }, c.label))),
    desc: textArea('ed-desc', src.desc, 2, { maxlength: '300' }),
    kw: textInput('ed-kw', (src.kw || []).join(', ')),
    tags: textInput('ed-tags', (src.tags || []).join(', ')),
    feedback: textArea('ed-feedback', src.feedback, 6, { 'aria-required': 'true' }),
    impact: textArea('ed-impact', src.impact, 4),
    plan: textArea('ed-plan', src.plan, 6, { 'aria-required': 'true' }),
    followup: textArea('ed-followup', src.followup, 4),
    example: textArea('ed-example', examplesToText(src.example), 3),
    q1: textInput('ed-q1', (src.questions || [])[0] || ''),
    q2: textInput('ed-q2', (src.questions || [])[1] || ''),
    q3: textInput('ed-q3', (src.questions || [])[2] || ''),
    note: textArea('ed-note', src.note, 2, { maxlength: '600' }),
    theme: h('select', { class: 'select', id: 'ed-theme' }, Object.keys(THEMES).map((k) => h('option', { value: k, selected: k === (src.theme || CAT_DEFAULT_THEME[src.cat]) }, THEMES[k].label))),
    obs: textArea('ed-obs', b.obs, 2),
    focus: textInput('ed-focus', b.focus),
    commit: textArea('ed-commit', b.commit, 2),
    m: textInput('ed-m', b.m),
    mx: textArea('ed-mx', b.mx, 2),
    coach: textInput('ed-coach', b.coach),
  };
  const kpiBoxes = KPIS.map((k) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: k.id, checked: (src.kpi || []).includes(k.id) }), k.label));
  const strengthBoxes = content.strengths.map((s) =>
    h('label', { class: 'check' }, h('input', { type: 'checkbox', value: s.id, checked: (src.strengths || []).includes(s.id) }), h('span', null, s.title))
  );
  const errorBox = h('p', { class: 'notice', role: 'alert', hidden: true });
  const tokenHint = 'Placeholders: {duration} = plan length, {durationAdj} = e.g. "two-week", {calls} = calls to review, {followup} = days until first review.';
  const hasFragments = Object.keys(b).length > 0;

  const body = h(
    'div',
    null,
    isBuiltin ? h('p', { class: 'notice notice--info', style: 'margin-bottom:16px' }, icon('info'), h('span', { class: 'notice__body' }, 'You are customizing a built-in entry. Your version replaces it in this browser, and you can restore the original at any time from My Templates.')) : null,
    errorBox,
    h(
      'div',
      { class: 'form-grid' },
      formField({ id: 'ed-title', label: 'Title', control: f.title, required: true, span2: false }),
      formField({ id: 'ed-cat', label: 'Category', control: f.cat, span2: false }),
      formField({ id: 'ed-desc', label: 'Short description', control: f.desc, hint: 'Shown on library cards. One sentence describing the behavior gap.' }),
      formField({ id: 'ed-kw', label: 'Search keywords', control: f.kw, hint: 'Comma-separated words supervisors might type, e.g. silence, mute, no response.', span2: false }),
      formField({ id: 'ed-tags', label: 'Tags', control: f.tags, hint: 'Up to four, comma-separated.', span2: false }),
      h('fieldset', { class: 'field span-2', style: 'border:0;padding:0;margin:0' }, h('legend', { class: 'field__label', style: 'margin-bottom:6px' }, 'Related KPIs'), h('div', { class: 'data-row' }, kpiBoxes)),
      formField({ id: 'ed-feedback', label: 'Things Can Be Better', control: f.feedback, required: true, hint: 'Written to the agent: observed behavior, why it matters, customer impact, expected behavior.', count: { target: '70-120' } }),
      formField({ id: 'ed-impact', label: 'Root Cause & Customer Impact', control: f.impact, count: {} }),
      formField({ id: 'ed-plan', label: 'SMART Action Plan', control: f.plan, required: true, hint: tokenHint, count: {} }),
      formField({ id: 'ed-followup', label: 'Supervisor Follow-Up Plan', control: f.followup, hint: tokenHint, count: {} }),
      formField({ id: 'ed-example', label: 'Correct Behavior / Example Statement', control: f.example, hint: 'One statement per line. Optional label: Before the hold | I am going to check...' }),
      formField({ id: 'ed-q1', label: 'Coaching question 1', control: f.q1 }),
      formField({ id: 'ed-q2', label: 'Coaching question 2', control: f.q2 }),
      formField({ id: 'ed-q3', label: 'Coaching question 3', control: f.q3 }),
      h('fieldset', { class: 'field span-2', style: 'border:0;padding:0;margin:0' }, h('legend', { class: 'field__label', style: 'margin-bottom:6px' }, 'Suggested related strengths'), h('div', { class: 'check-grid' }, strengthBoxes)),
      formField({ id: 'ed-note', label: 'Supervisor note (never copied)', control: f.note }),
      h(
        'details',
        { class: 'fieldset span-2', open: hasFragments },
        h('summary', null, 'Coaching Builder phrases', h('span', { class: 'sec__sub', style: 'font-weight:500' }, '(optional, improves merged coaching)'), icon('chev-down')),
        h(
          'div',
          { class: 'form-grid' },
          h('p', { class: 'field__hint span-2' }, 'When several opportunities are combined, the Builder writes sentences from these short phrases. Leave them empty and the Builder adds a simple sentence for this entry instead.'),
          formField({ id: 'ed-theme', label: 'Group with', control: f.theme, span2: false }),
          formField({ id: 'ed-focus', label: 'Focus label', control: f.focus, hint: 'e.g. "dead-air management"', span2: false }),
          formField({ id: 'ed-obs', label: 'Observed gap', control: f.obs, hint: 'Completes "...you ___". e.g. "left long silences while researching without updates"' }),
          formField({ id: 'ed-commit', label: 'Commitment', control: f.commit, hint: 'Completes "you will ___". e.g. "explain what you are checking before any research"' }),
          formField({ id: 'ed-m', label: 'Success measure (phrase)', control: f.m, hint: 'Completes "all reviewed calls show ___". Use this or the full sentence below.' }),
          formField({ id: 'ed-mx', label: 'Success measure (full sentence)', control: f.mx, hint: 'For event-based measures, e.g. "Every transfer during the next {duration} includes a warm handoff."' }),
          formField({ id: 'ed-coach', label: 'Coaching activity', control: f.coach, hint: 'Starts with "a" or "an", e.g. "a short roleplay of hold transitions"' })
        )
      )
    )
  );

  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('save'), isBuiltin ? 'Save my version' : 'Save');
  const footer = [];
  if (existing && !isBuiltin) footer.push(h('button', { type: 'button', class: 'btn btn--danger', onclick: () => { m.close(); deleteCustomOpp(existing.id); } }, icon('trash'), 'Delete'));
  if (isBuiltin && existing.customized) footer.push(h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { m.close(); restoreOpp(existing.id); } }, icon('refresh'), 'Restore original'));
  footer.push(h('span', { class: 'spacer' }), cancel, save);

  const m = openModal({
    title: isBuiltin ? `Customize: ${src.title}` : existing ? `Edit: ${src.title}` : 'New coaching opportunity',
    size: 'lg',
    body,
    footer,
    backdropClose: false,
    initialFocus: f.title,
  });
  cancel.addEventListener('click', () => m.close());
  save.addEventListener('click', async () => {
    const data = {
      title: f.title.value.trim(),
      cat: f.cat.value,
      desc: f.desc.value.trim(),
      kw: splitList(f.kw.value).map((k) => k.toLowerCase()),
      tags: splitList(f.tags.value).slice(0, 4),
      kpi: kpiBoxes.map((l) => l.querySelector('input')).filter((x) => x.checked).map((x) => x.value),
      feedback: f.feedback.value.trim(),
      impact: f.impact.value.trim(),
      plan: f.plan.value.trim(),
      followup: f.followup.value.trim(),
      example: parseExamples(f.example.value),
      questions: [f.q1.value, f.q2.value, f.q3.value].map((q) => q.trim()).filter(Boolean),
      strengths: strengthBoxes.map((l) => l.querySelector('input')).filter((x) => x.checked).map((x) => x.value),
      note: f.note.value.trim(),
      theme: f.theme.value,
      b: { obs: f.obs.value.trim(), focus: f.focus.value.trim(), commit: f.commit.value.trim(), m: f.m.value.trim(), mx: f.mx.value.trim(), coach: f.coach.value.trim() },
    };
    const errors = [];
    [f.title, f.feedback, f.plan].forEach((el) => el.classList.remove('is-invalid'));
    if (!data.title) {
      errors.push('Add a title.');
      f.title.classList.add('is-invalid');
    }
    if (!data.feedback) {
      errors.push('Add the Things Can Be Better paragraph.');
      f.feedback.classList.add('is-invalid');
    }
    if (!data.plan) {
      errors.push('Add a SMART action plan.');
      f.plan.classList.add('is-invalid');
    }
    const badTokens = dedupe([data.plan, data.followup, data.b.mx, data.feedback, data.impact].flatMap(unknownTokens));
    if (badTokens.length) errors.push(`Unknown placeholder ${joinList(badTokens)}. Use only ${ALLOWED_TOKENS.join(', ')}.`);
    if (data.b.coach && !/^an? /i.test(data.b.coach)) errors.push('The coaching activity phrase should start with "a" or "an".');
    if (errors.length) {
      errorBox.replaceChildren(icon('alert'), h('span', { class: 'notice__body' }, errors.join(' ')));
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (data.b.m && data.b.mx) data.b.mx = '';
    const allText = [data.title, data.desc, data.feedback, data.impact, data.plan, data.followup, data.note, ...data.questions, ...data.example.map((e) => e.say)].join('\n');
    const pii = piiWarnings(allText);
    if (pii.length && !(await confirmDialog({ title: 'Possible identifying information', message: `This entry contains ${joinList(pii)}. Coaching templates should never include names or IDs. Save anyway?`, confirmLabel: 'Save anyway' }))) return;
    const now = Date.now();
    let openId = null;
    if (isBuiltin) {
      const clean = sanitizeOppFields(data);
      state.overrides.opps[existing.id] = { ...clean, updated: now };
      persist('overrides');
    } else if (existing) {
      const clean = sanitizeCustomOpp({ ...data, id: existing.id, created: existing.created, updated: now });
      state.custom.opps = state.custom.opps.map((c) => (c.id === existing.id ? clean : c));
      persist('custom');
    } else {
      const clean = sanitizeCustomOpp({ ...data, id: uid('custom'), created: now, updated: now });
      state.custom.opps.push(clean);
      persist('custom');
      openId = clean.id;
    }
    m.close();
    rebuildContent();
    refresh();
    toast(isBuiltin ? `Saved your version of "${data.title}"` : existing ? `Updated "${data.title}"` : `Created "${data.title}"`);
    if (openId) openOpp(openId);
  });
}

async function restoreOpp(id) {
  const o = getOpp(id);
  if (!o || !state.overrides.opps[id]) return;
  if (!(await confirmDialog({ title: 'Restore the original?', message: `Your customized wording for "${o.title}" will be removed and the built-in version restored.`, confirmLabel: 'Restore original' }))) return;
  delete state.overrides.opps[id];
  persist('overrides');
  rebuildContent();
  refresh();
  toast('Original wording restored');
}

async function deleteCustomOpp(id) {
  const o = getOpp(id);
  if (!o || !o.custom) return;
  if (!(await confirmDialog({ title: 'Delete this custom entry?', message: `"${o.title}" will be permanently removed from this browser. Export a backup first if you might need it.`, confirmLabel: 'Delete', danger: true }))) return;
  state.custom.opps = state.custom.opps.filter((c) => c.id !== id);
  state.favorites.delete(id);
  state.builder.opps = state.builder.opps.filter((x) => x !== id);
  persist('custom', 'favorites', 'builder');
  rebuildContent();
  if (state.ui.openId === id) closePanel();
  refresh();
  toast(`Deleted "${o.title}"`);
}

function openStrengthEditor(id) {
  const existing = id ? getStrength(id) : null;
  const isBuiltin = !!(existing && existing.builtin);
  const src = existing || { title: '', group: 'com', desc: '', kw: [], v: [] };
  const f = {
    title: textInput('st-title', src.title, { maxlength: '120' }),
    group: h('select', { class: 'select', id: 'st-group' }, S_GROUPS.map((g) => h('option', { value: g.id, selected: g.id === src.group }, g.label))),
    desc: textArea('st-desc', src.desc, 2, { maxlength: '300' }),
    kw: textInput('st-kw', (src.kw || []).join(', ')),
    v1: textArea('st-v1', (src.v || [])[0], 3),
    v2: textArea('st-v2', (src.v || [])[1], 3),
    v3: textArea('st-v3', (src.v || [])[2], 3),
  };
  const errorBox = h('p', { class: 'notice', role: 'alert', hidden: true });
  const vHint = 'Written directly to the agent about an observed behavior. Never claim progress, KPIs, or consistency over time.';
  const body = h(
    'div',
    null,
    isBuiltin ? h('p', { class: 'notice notice--info', style: 'margin-bottom:16px' }, icon('info'), h('span', { class: 'notice__body' }, 'You are customizing a built-in strength. You can restore the original at any time from My Templates.')) : null,
    errorBox,
    h(
      'div',
      { class: 'form-grid' },
      formField({ id: 'st-title', label: 'Title', control: f.title, required: true, span2: false }),
      formField({ id: 'st-group', label: 'Area', control: f.group, span2: false }),
      formField({ id: 'st-desc', label: 'What it looks like', control: f.desc }),
      formField({ id: 'st-kw', label: 'Search keywords', control: f.kw, hint: 'Comma-separated.' }),
      formField({ id: 'st-v1', label: 'Wording, version 1', control: f.v1, required: true, hint: vHint, count: {} }),
      formField({ id: 'st-v2', label: 'Wording, version 2', control: f.v2, count: {} }),
      formField({ id: 'st-v3', label: 'Wording, version 3', control: f.v3, count: {} })
    )
  );
  const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
  const save = h('button', { type: 'button', class: 'btn btn--primary' }, icon('save'), isBuiltin ? 'Save my version' : 'Save');
  const footer = [];
  if (existing && !isBuiltin) footer.push(h('button', { type: 'button', class: 'btn btn--danger', onclick: () => { m.close(); deleteCustomStrength(existing.id); } }, icon('trash'), 'Delete'));
  if (isBuiltin && existing.customized) footer.push(h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { m.close(); restoreStrength(existing.id); } }, icon('refresh'), 'Restore original'));
  footer.push(h('span', { class: 'spacer' }), cancel, save);
  const m = openModal({ title: isBuiltin ? `Customize: ${src.title}` : existing ? `Edit: ${src.title}` : 'New strength', size: 'lg', body, footer, backdropClose: false, initialFocus: f.title });
  cancel.addEventListener('click', () => m.close());
  save.addEventListener('click', async () => {
    const data = {
      title: f.title.value.trim(),
      group: f.group.value,
      desc: f.desc.value.trim(),
      kw: splitList(f.kw.value).map((k) => k.toLowerCase()),
      v: [f.v1.value, f.v2.value, f.v3.value].map((v) => v.trim()).filter(Boolean),
    };
    const errors = [];
    if (!data.title) errors.push('Add a title.');
    if (!data.v.length) errors.push('Add at least one wording.');
    if (errors.length) {
      errorBox.replaceChildren(icon('alert'), h('span', { class: 'notice__body' }, errors.join(' ')));
      errorBox.hidden = false;
      return;
    }
    const pii = piiWarnings([data.title, data.desc, ...data.v].join('\n'));
    if (pii.length && !(await confirmDialog({ title: 'Possible identifying information', message: `This strength contains ${joinList(pii)}. Save anyway?`, confirmLabel: 'Save anyway' }))) return;
    const now = Date.now();
    if (isBuiltin) {
      state.overrides.strengths[existing.id] = { ...sanitizeStrengthFields(data), updated: now };
      persist('overrides');
    } else if (existing) {
      const clean = sanitizeCustomStrength({ ...data, id: existing.id, created: existing.created, updated: now });
      state.custom.strengths = state.custom.strengths.map((c) => (c.id === existing.id ? clean : c));
      persist('custom');
    } else {
      state.custom.strengths.push(sanitizeCustomStrength({ ...data, id: uid('cs'), created: now, updated: now }));
      persist('custom');
    }
    // Keep selected versions within range after editing.
    state.builder.strengths.forEach((sel) => {
      const max = (data.v.length || 1) - 1;
      if (existing && sel.id === existing.id && sel.v > max) sel.v = max;
    });
    persist('builder');
    m.close();
    rebuildContent();
    refresh();
    toast(isBuiltin ? `Saved your version of "${data.title}"` : existing ? `Updated "${data.title}"` : `Created "${data.title}"`);
  });
}

async function restoreStrength(id) {
  const s = getStrength(id);
  if (!s || !state.overrides.strengths[id]) return;
  if (!(await confirmDialog({ title: 'Restore the original?', message: `Your customized wording for "${s.title}" will be removed.`, confirmLabel: 'Restore original' }))) return;
  delete state.overrides.strengths[id];
  persist('overrides');
  rebuildContent();
  refresh();
  toast('Original wording restored');
}

async function deleteCustomStrength(id) {
  const s = getStrength(id);
  if (!s || !s.custom) return;
  if (!(await confirmDialog({ title: 'Delete this custom strength?', message: `"${s.title}" will be permanently removed from this browser.`, confirmLabel: 'Delete', danger: true }))) return;
  state.custom.strengths = state.custom.strengths.filter((c) => c.id !== id);
  state.builder.strengths = state.builder.strengths.filter((x) => x.id !== id);
  persist('custom', 'builder');
  rebuildContent();
  refresh();
  toast(`Deleted "${s.title}"`);
}

function tplItem({ title, chips, buttons }) {
  return h('li', { class: 'tpl-item' }, h('div', { class: 'tpl-item__main' }, h('div', { class: 'tpl-item__title' }, title), chips && chips.length ? h('div', { class: 'tpl-item__sub' }, chips) : null), h('div', { class: 'tpl-item__btns' }, buttons));
}

function renderTemplates(main) {
  const customOpps = state.custom.opps.map((c) => getOpp(c.id)).filter(Boolean);
  const customStrengths = state.custom.strengths.map((c) => getStrength(c.id)).filter(Boolean);
  const editedOpps = Object.keys(state.overrides.opps).map(getOpp).filter(Boolean);
  const editedStrengths = Object.keys(state.overrides.strengths).map(getStrength).filter(Boolean);
  const iconBtn = (name, label, fk, fn) => h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': label, title: label, 'data-fk': fk, onclick: fn }, icon(name));

  put(main, 
    pageHead({
      title: 'My Templates',
      sub: 'Create your own coaching entries and strengths, or customize the wording of any built-in entry. Built-in originals are always kept and can be restored.',
      actions: [
        h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-fk': 'new-opp', onclick: () => openOppEditor(null) }, icon('plus'), 'New opportunity'),
        h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'new-str', onclick: () => openStrengthEditor(null) }, icon('plus'), 'New strength'),
      ],
    })
  );

  const card = (title, iconName, children, extra) =>
    h('section', { class: 'card', 'aria-label': title }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title' }, icon(iconName), title), extra || null), h('div', { class: 'card__body' }, children));

  put(main, 
    h(
      'div',
      { class: 'two-col' },
      card(
        'Custom opportunities',
        'target',
        customOpps.length
          ? h(
              'ul',
              { class: 'tpl-list' },
              customOpps.map((o) =>
                tplItem({
                  title: o.title,
                  chips: [catChip(o.cat), ...(o.kpi || []).map(kpiChip)],
                  buttons: [iconBtn('panel', `Open ${o.title}`, `topen:${o.id}`, () => openOpp(o.id)), iconBtn('edit', `Edit ${o.title}`, `tedit:${o.id}`, () => openOppEditor(o.id)), iconBtn('trash', `Delete ${o.title}`, `tdel:${o.id}`, () => deleteCustomOpp(o.id))],
                })
              )
            )
          : h('p', { class: 'hint' }, icon('info'), 'No custom opportunities yet. Create one for behaviors specific to your program.'),
        h('span', { class: 'pill' }, String(customOpps.length))
      ),
      card(
        'Custom strengths',
        'thumb',
        customStrengths.length
          ? h(
              'ul',
              { class: 'tpl-list' },
              customStrengths.map((s) =>
                tplItem({
                  title: s.title,
                  chips: [h('span', { class: 'chip cat-chip cat-custom' }, h('span', { class: 'chip__dot' }), (S_GROUP_MAP[s.group] || {}).label || '')],
                  buttons: [iconBtn('edit', `Edit ${s.title}`, `tsedit:${s.id}`, () => openStrengthEditor(s.id)), iconBtn('trash', `Delete ${s.title}`, `tsdel:${s.id}`, () => deleteCustomStrength(s.id))],
                })
              )
            )
          : h('p', { class: 'hint' }, icon('info'), 'No custom strengths yet. Add positive feedback you find yourself writing often.'),
        h('span', { class: 'pill' }, String(customStrengths.length))
      ),
      card(
        'Customized built-in content',
        'edit',
        editedOpps.length || editedStrengths.length
          ? h(
              'ul',
              { class: 'tpl-list' },
              editedOpps.map((o) =>
                tplItem({
                  title: o.title,
                  chips: [catChip(o.cat), h('span', { class: 'badge badge--edited' }, 'Edited')],
                  buttons: [iconBtn('panel', `Open ${o.title}`, `topen:${o.id}`, () => openOpp(o.id)), iconBtn('edit', `Edit ${o.title}`, `tedit:${o.id}`, () => openOppEditor(o.id)), iconBtn('refresh', `Restore original ${o.title}`, `trestore:${o.id}`, () => restoreOpp(o.id))],
                })
              ),
              editedStrengths.map((s) =>
                tplItem({
                  title: s.title,
                  chips: [h('span', { class: 'chip cat-chip cat-str' }, h('span', { class: 'chip__dot' }), 'Strength'), h('span', { class: 'badge badge--edited' }, 'Edited')],
                  buttons: [iconBtn('edit', `Edit ${s.title}`, `tsedit:${s.id}`, () => openStrengthEditor(s.id)), iconBtn('refresh', `Restore original ${s.title}`, `tsrestore:${s.id}`, () => restoreStrength(s.id))],
                })
              )
            )
          : h('p', { class: 'hint' }, icon('info'), 'Use Customize on any coaching entry, or the edit button on any strength, to adjust the wording to your program.')
      ),
      card('Backup and move to another browser', 'download', [
        h('p', { class: 'prose' }, 'Templates, favorites, saved combinations, and drafts live only in this browser. Export them to a file to keep a backup or to move them to another computer, then import that file there.'),
        h(
          'div',
          { class: 'data-row' },
          h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'texport', onclick: exportData }, icon('download'), 'Export JSON'),
          h('button', { type: 'button', class: 'btn btn--sm', 'data-fk': 'timport', onclick: importFromFile }, icon('upload'), 'Import JSON')
        ),
      ])
    )
  );
}
