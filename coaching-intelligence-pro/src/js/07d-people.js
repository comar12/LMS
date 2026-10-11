/* ==========================================================================
   07d-people: ABS & Attrition Toolkit (attendance conversation, return to
   work, stay conversation, early warning signs, recognition)
   ========================================================================== */

const PEOPLE = DATA.peopleToolkit;
const PEOPLE_TABS = [
  { id: 'attendance', label: 'Attendance talk', icon: 'calendar' },
  { id: 'return', label: 'Return to work', icon: 'refresh' },
  { id: 'stay', label: 'Stay conversation', icon: 'heart' },
  { id: 'signs', label: 'Early warning signs', icon: 'flag' },
  { id: 'recognition', label: 'Recognition', icon: 'award' },
];

function setPeopleTab(id) {
  state.prefs.peopleTab = id;
  persist('prefs');
  state.ui.tabAnim = true;
  refresh({ panel: false });
}

function peopleTabs(current) {
  const list = h('div', { class: 'tk-tabs', role: 'tablist', 'aria-label': 'ABS and Attrition Toolkit sections' });
  PEOPLE_TABS.forEach((t, i) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'tk-tab',
        role: 'tab',
        id: `pk-tab-${t.id}`,
        'aria-selected': String(t.id === current),
        'aria-controls': 'pk-panel',
        tabindex: t.id === current ? '0' : '-1',
        'data-fk': `pk-tab:${t.id}`,
        onclick: () => setPeopleTab(t.id),
      },
      icon(t.icon),
      t.label
    );
    btn.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = PEOPLE_TABS[(i + 1) % PEOPLE_TABS.length];
      else if (e.key === 'ArrowLeft') next = PEOPLE_TABS[(i - 1 + PEOPLE_TABS.length) % PEOPLE_TABS.length];
      else if (e.key === 'Home') next = PEOPLE_TABS[0];
      else if (e.key === 'End') next = PEOPLE_TABS[PEOPLE_TABS.length - 1];
      if (next) {
        e.preventDefault();
        setPeopleTab(next.id);
        focusByKey(`pk-tab:${next.id}`);
      }
    });
    list.appendChild(btn);
  });
  return list;
}

function renderAttendanceTab(panel) {
  const steps = PEOPLE.attendance.steps;
  const all = steps.map((s, i) => `${i + 1}. ${s.title}\n${s.say}`).join('\n\n');
  panel.append(
    h(
      'div',
      { class: 'pk-bar' },
      h('p', { class: 'pk-bar__text' }, `${steps.length} steps for a fair, private attendance conversation. Each step has a line you can say as written or adapt.`),
      copyButton(all, { label: 'Copy the whole conversation', srLabel: 'Copy the whole attendance conversation', fk: 'pk-att-all' })
    ),
    h('h2', { class: 'sr-only' }, 'Attendance conversation steps'),
    h(
      'ol',
      { class: 'timeline' },
      steps.map((s, i) =>
        h(
          'li',
          { class: 'timeline__item', style: `--i:${i}` },
          h('span', { class: 'timeline__node', 'aria-hidden': 'true' }, String(i + 1)),
          h('div', { class: 'timeline__card' }, h('h3', { class: 'timeline__title' }, s.title), h('p', { class: 'timeline__good' }, s.good), scriptLine(s.say, { label: 'You could say', fk: `pk-att:${s.id}`, srLabel: `Copy what to say for ${s.title}` }))
        )
      )
    ),
    h('div', { class: 'tk-step__coach', style: 'margin-top:18px' }, h('span', { class: 'tk-label' }, 'Coach with'), oppChips(['people-unplanned-absence', 'people-late-login', 'people-callout-process', 'people-no-call-no-show', 'people-absence-pattern'], 'pk-att-opp'))
  );
}

function renderReturnTab(panel) {
  const lines = PEOPLE.returnToWork.lines;
  panel.append(
    h('div', { class: 'pk-bar' }, h('p', { class: 'pk-bar__text' }, PEOPLE.returnToWork.intro), copyButton(lines.map((l) => l.say).join('\n\n'), { label: 'Copy all lines', srLabel: 'Copy all return-to-work lines', fk: 'pk-rtw-all' })),
    h('h2', { class: 'sr-only' }, 'Return-to-work lines'),
    h('div', { class: 'pk-stack' }, lines.map((l, i) => h('div', { class: 'pk-card', style: `--i:${i}` }, scriptLine(l.say, { label: l.label, fk: `pk-rtw:${i}`, srLabel: `Copy line: ${l.label}` }))))
  );
}

function renderStayTab(panel) {
  panel.append(
    h('div', { class: 'pk-bar' }, h('p', { class: 'pk-bar__text' }, PEOPLE.stay.intro)),
    h(
      'div',
      { class: 'pk-grid' },
      PEOPLE.stay.groups.map((g, i) =>
        h(
          'section',
          { class: 'card pk-qcard', style: `--i:${i}`, 'aria-labelledby': `pk-stay-${g.id}` },
          h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: `pk-stay-${g.id}` }, icon('question'), g.title), copyButton(g.questions.join('\n'), { label: 'Copy', srLabel: `Copy questions: ${g.title}`, fk: `pk-stay:${g.id}` })),
          h('ul', { class: 'pk-questions' }, g.questions.map((q) => h('li', null, q)))
        )
      )
    )
  );
}

function renderSignsTab(panel) {
  panel.append(
    h('p', { class: 'notice', role: 'note', style: 'margin-bottom:16px' }, icon('info'), h('span', { class: 'notice__body' }, 'These are signals to check in on, never conclusions. One sign on its own proves nothing; a change from someone\'s usual pattern is what is worth a conversation.')),
    h(
      'div',
      { class: 'pk-grid' },
      PEOPLE.signs.map((sg, i) =>
        h(
          'section',
          { class: 'card pk-sign', style: `--i:${i}`, 'aria-labelledby': `pk-sign-${sg.id}` },
          h('div', { class: 'pk-sign__head' }, h('span', { class: 'pk-sign__icon', 'aria-hidden': 'true' }, icon('flag')), h('h2', { class: 'pk-sign__title', id: `pk-sign-${sg.id}` }, sg.sign)),
          h('p', { class: 'pk-sign__detail' }, sg.detail),
          h('div', { class: 'pk-sign__action' }, h('span', { class: 'tk-label' }, 'This week'), h('p', null, sg.action)),
          oppChips(sg.opps, `pk-sign-opp:${sg.id}`)
        )
      )
    )
  );
}

function renderRecognitionTab(panel) {
  const rec = PEOPLE.recognition;
  panel.append(
    h('div', { class: 'pk-bar' }, h('p', { class: 'pk-bar__text' }, rec.intro)),
    h('h2', { class: 'sr-only' }, 'Recognition ideas'),
    h('div', { class: 'pk-grid pk-grid--ideas' }, rec.ideas.map((idea, i) => h('div', { class: 'pk-idea', style: `--i:${i}` }, h('span', { class: 'pk-idea__icon', 'aria-hidden': 'true' }, icon('award')), h('h3', { class: 'pk-idea__title' }, idea.title), h('p', { class: 'pk-idea__text' }, idea.detail)))),
    h(
      'section',
      { class: 'card', style: 'margin-top:18px', 'aria-labelledby': 'pk-shout-title' },
      h('div', { class: 'card__head' }, h('h2', { class: 'card__title', id: 'pk-shout-title' }, icon('sparkle'), 'Ready-to-send shout-outs'), h('span', { class: 'sec__sub' }, 'no names, paste into team chat or a private note')),
      h('div', { class: 'card__body' }, rec.shoutouts.map((t, i) => scriptLine(t, { fk: `pk-shout:${i}`, srLabel: `Copy shout-out ${i + 1}` })))
    )
  );
}

function renderPeopleToolkit(main) {
  const tab = PEOPLE_TAB_IDS.includes(state.prefs.peopleTab) ? state.prefs.peopleTab : 'attendance';
  main.append(
    pageHead({
      eyebrow: [h('span', { class: 'group__icon cat-people', style: 'width:22px;height:22px;border-radius:6px' }, icon('users', 'icon--sm')), 'ABS & Attrition'],
      title: 'ABS & Attrition Toolkit',
      sub: PEOPLE.intro,
      actions: h('a', { class: 'btn btn--sm', href: '#/cat/people', 'data-fk': 'pk-to-cat' }, icon('users'), 'ABS & Attrition coaching'),
    }),
    h('p', { class: 'notice notice--privacy', role: 'note', style: 'margin-bottom:16px' }, icon('lock'), h('span', { class: 'notice__body' }, PEOPLE.privacy)),
    peopleTabs(tab)
  );
  const panel = h('div', { class: `tk-panel${takeTabAnim()}`, role: 'tabpanel', id: 'pk-panel', 'aria-labelledby': `pk-tab-${tab}`, tabindex: '-1' });
  if (tab === 'return') renderReturnTab(panel);
  else if (tab === 'stay') renderStayTab(panel);
  else if (tab === 'signs') renderSignsTab(panel);
  else if (tab === 'recognition') renderRecognitionTab(panel);
  else renderAttendanceTab(panel);
  main.append(panel);
}
