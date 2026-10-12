/* ==========================================================================
   07e-home: Home dashboard (greeting, quick actions, coach by KPI,
   categories, pinned links)
   ========================================================================== */

const KPI_ICON = { QA: 'check', aiCR: 'refresh', Transfer: 'arrow-right', ABS: 'calendar', Attrition: 'users' };

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

/** Numbers count up from zero when the page opens (skipped when motion is reduced). */
function countUp(root) {
  const els = root.querySelectorAll('[data-count]');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach((el) => {
    const end = Number(el.getAttribute('data-count')) || 0;
    if (reduce || !els.length) {
      el.textContent = String(end);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      if (!el.isConnected) return;
      const t = Math.min(1, (now - start) / dur);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  });
}

function heroArt() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 400 220');
  svg.setAttribute('class', 'hero__art');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
    return el;
  };
  add('circle', { cx: '300', cy: '70', r: '86', class: 'hero__blob hero__blob--a' });
  add('circle', { cx: '370', cy: '190', r: '58', class: 'hero__blob hero__blob--b' });
  add('circle', { cx: '210', cy: '170', r: '34', class: 'hero__blob hero__blob--c' });
  // A small "chart" motif: rising bars and a trend line.
  [[230, 120, 26], [262, 98, 48], [294, 80, 66], [326, 62, 84]].forEach(([x, y, hgt], i) => add('rect', { x: String(x), y: String(y), width: '20', height: String(hgt), rx: '5', class: 'hero__bar', style: `--i:${i}` }));
  add('path', { d: 'M222 120 L272 96 L304 84 L336 56 L366 40', class: 'hero__line' });
  add('circle', { cx: '366', cy: '40', r: '6', class: 'hero__dot' });
  return svg;
}

function homeTile({ href, iconName, title, text, cat, badge, fk, onclick }) {
  return h(
    'a',
    { class: `home-tile${cat ? ' cat-' + cat : ''}`, href, 'data-fk': fk, onclick },
    h('span', { class: 'home-tile__icon', 'aria-hidden': 'true' }, icon(iconName)),
    h('span', { class: 'home-tile__text' }, h('span', { class: 'home-tile__title' }, title, badge ? h('span', { class: 'home-tile__badge' }, badge) : null), text ? h('span', { class: 'home-tile__sub' }, text) : null),
    icon('arrow-right', 'home-tile__go')
  );
}

function renderHome(main) {
  const bc = builderCount();
  const pinned = state.links.items.filter((l) => l.pinned && linkTarget(l.url)).slice(0, 6);
  const counts = {};
  content.opps.forEach((o) => (counts[o.cat] = (counts[o.cat] || 0) + 1));
  const stat = (n, label, iconName) => h('div', { class: 'stat' }, h('span', { class: 'stat__icon', 'aria-hidden': 'true' }, icon(iconName)), h('span', { class: 'stat__num', 'data-count': String(n) }, String(n)), h('span', { class: 'stat__label' }, label));

  const hero = h(
    'section',
    { class: 'hero', 'aria-labelledby': 'pageTitle' },
    heroArt(),
    h(
      'div',
      { class: 'hero__content' },
      h('p', { class: 'hero__eyebrow' }, 'Coaching Intelligence Pro · VXI'),
      h('h1', { class: 'page-title hero__title', id: 'pageTitle' }, `${greeting()}. Ready to coach?`),
      h('p', { class: 'hero__sub' }, 'Review a call, build the coaching, and plan the people conversations behind QA, repeat contacts (aiCR), transfers, ABS, and attrition.'),
      h(
        'div',
        { class: 'hero__actions' },
        h('a', { class: 'btn hero__cta', href: '#/call-review', 'data-fk': 'home-review' }, icon('checklist'), 'Start a call review'),
        h('a', { class: 'btn hero__ghost', href: '#/today', 'data-fk': 'home-today' }, icon('pulse'), todayOpenCount() ? `My Day (${todayOpenCount()} left)` : 'My Day'),
        h('a', { class: 'btn hero__ghost', href: '#/builder', 'data-fk': 'home-builder' }, icon('clipboard'), bc ? `Coaching Builder (${bc})` : 'Coaching Builder')
      )
    )
  );

  const stats = h('div', { class: 'stats' }, stat(content.opps.length, 'coaching entries', 'layers'), stat(content.strengths.length, 'strengths', 'thumb'), stat(state.tracker.plans.filter((p) => p.status === 'active').length, 'plans being tracked', 'calendar'), stat(state.links.items.length, 'quick links', 'link'));

  const kpiTiles = h(
    'div',
    { class: 'kpi-tiles' },
    KPIS.map((k) => {
      const n = content.opps.filter((o) => (o.kpi || []).includes(k.id)).length;
      return h(
        'button',
        {
          type: 'button',
          class: `kpi-tile kpi-tile--${k.id.toLowerCase()}`,
          'data-fk': `home-kpi:${k.id}`,
          onclick: () => {
            state.prefs.kpi = k.id;
            persist('prefs');
            navigate('all');
          },
        },
        h('span', { class: 'kpi-tile__icon', 'aria-hidden': 'true' }, icon(KPI_ICON[k.id] || 'target')),
        h('span', { class: 'kpi-tile__label' }, k.label),
        h('span', { class: 'kpi-tile__num' }, h('span', { 'data-count': String(n) }, String(n)), ' entries'),
        h('span', { class: 'kpi-tile__hint' }, k.hint)
      );
    })
  );

  const actions = h(
    'div',
    { class: 'home-grid' },
    homeTile({ href: '#/call-review', iconName: 'checklist', title: 'Call Review', text: 'Technical, Billing, Service, and Sales checklists that feed the Builder', cat: 'tech', fk: 'home-t-review' }),
    homeTile({ href: '#/listen', iconName: 'pulse', title: 'Live Listen', text: 'Tap behaviors as you hear them; every moment is time-stamped for coaching', cat: 'tech', badge: state.listen.runAt ? 'Live' : null, fk: 'home-t-listen' }),
    homeTile({ href: '#/practice', iconName: 'chat', title: 'Practice Lab', text: 'Role-play real call moments in a huddle or one-on-one, then score and debrief', cat: 'people', fk: 'home-t-practice' }),
    homeTile({ href: '#/builder', iconName: 'clipboard', title: 'Coaching Builder', text: 'Combine behaviors into one ready-to-paste coaching entry', cat: 'own', badge: bc ? String(bc) : null, fk: 'home-t-builder' }),
    homeTile({ href: '#/tracker', iconName: 'calendar', title: 'Follow-Up Tracker', text: 'Log reviews and check-ins; progress is written from your results', cat: 'own', badge: trackerDueCount() ? `${trackerDueCount()} due` : null, fk: 'home-t-tracker' }),
    homeTile({ href: '#/team', iconName: 'heart', title: 'Team Pulse', text: 'Who needs recognition or a one-on-one, and earned praise ready to send', cat: 'people', badge: teamNeedsCount() ? `${teamNeedsCount()} to see` : null, fk: 'home-t-team' }),
    homeTile({ href: '#/huddle', iconName: 'megaphone', title: 'Team Huddle Builder', text: 'A ready-to-run huddle on your team’s most-missed behavior', cat: 'people', fk: 'home-t-huddle' }),
    homeTile({ href: '#/links', iconName: 'link', title: 'Quick Links', text: state.links.items.length ? `${plural(state.links.items.length, 'dashboard, tool, or form', 'dashboards, tools, and forms')} one click away` : 'Add the dashboards and forms you open every day', cat: 'dis', fk: 'home-t-links' })
  );

  const cats = h(
    'div',
    { class: 'cat-tiles' },
    CATS.map((c) =>
      h(
        'a',
        { class: `cat-tile cat-${c.id}`, href: `#/cat/${c.id}`, 'data-fk': `home-cat:${c.id}` },
        h('span', { class: 'cat-tile__icon', 'aria-hidden': 'true' }, icon(CAT_ICON[c.id])),
        h('span', { class: 'cat-tile__name' }, c.nav),
        h('span', { class: 'cat-tile__count' }, plural(counts[c.id] || 0, 'entry', 'entries'))
      )
    )
  );

  const section = (title, iconName, body, extra) => h('section', { class: 'home-sec', 'aria-label': title }, h('div', { class: 'home-sec__head' }, h('h2', { class: 'home-sec__title' }, icon(iconName), title), extra || null), body);

  const dueN = trackerDueCount();
  const dueStrip = dueN
    ? h(
        'a',
        { class: 'due-strip', href: '#/tracker', 'data-fk': 'home-due' },
        h('span', { class: 'due-strip__icon', 'aria-hidden': 'true' }, icon('alert')),
        h('span', { class: 'due-strip__text' }, h('strong', null, `${plural(dueN, 'follow-up')} ${dueN === 1 ? 'is' : 'are'} due or overdue.`), ' Log your call reviews and check-ins so the next coaching reflects what really happened.'),
        h('span', { class: 'due-strip__go' }, 'Open tracker', icon('arrow-right'))
      )
    : null;
  const dp = dayProgress();
  const pulses = state.team.members.map((m) => ({ m, pu: memberPulse(m) }));
  const glance = h(
    'div',
    { class: 'glance' },
    h(
      'a',
      { class: 'glance__card', href: '#/today', 'data-fk': 'home-glance-day' },
      progressRing(dp.finished, Math.max(dp.total, 1), `${dp.finished} of ${dp.total} items done today`, 'home-day'),
      h('span', { class: 'glance__text' }, h('span', { class: 'glance__title' }, 'My Day'), h('span', { class: 'glance__sub' }, dp.total ? (dp.finished >= dp.total ? 'Everything is done. Nice work.' : `${plural(dp.total - dp.finished, 'item')} left today`) : 'Add your daily routine')),
      icon('arrow-right', 'home-tile__go')
    ),
    pulses.length
      ? (() => {
          const { viz, groups } = healthRing(pulses);
          return h(
            'a',
            { class: 'glance__card glance__card--team', href: '#/team', 'data-fk': 'home-glance-team' },
            viz,
            h('span', { class: 'glance__text' }, h('span', { class: 'glance__title' }, 'Team health'), h('span', { class: 'glance__chips' }, groups.filter((g) => g.n).map((g) => h('span', { class: `glance__chip glance__chip--${g.id}` }, h('strong', null, String(g.n)), ` ${g.label.toLowerCase()}`)))),
            icon('arrow-right', 'home-tile__go')
          );
        })()
      : h('a', { class: 'glance__card', href: '#/team', 'data-fk': 'home-glance-team' }, h('span', { class: 'home-tile__icon cat-people', 'aria-hidden': 'true' }, icon('heart')), h('span', { class: 'glance__text' }, h('span', { class: 'glance__title' }, 'Team Pulse'), h('span', { class: 'glance__sub' }, 'Paste your roster to see who needs recognition')), icon('arrow-right', 'home-tile__go'))
  );
  const parts = [
    hero,
    dueStrip,
    stats,
    section('Today at a glance', 'pulse', glance),
    section('Coach by KPI', 'target', kpiTiles, h('span', { class: 'sec__sub' }, 'opens the library filtered to that KPI')),
    section('Quick actions', 'sparkle', actions),
    pinned.length
      ? section(
          'Pinned links',
          'star',
          h('div', { class: 'pin-row' }, pinned.map((l) => h('a', { class: 'pin-chip', href: linkTarget(l.url), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${l.name} (new tab)`, 'data-fk': `home-pin:${l.id}` }, icon('external'), l.name))),
          h('a', { class: 'btn btn--ghost btn--sm', href: '#/links', 'data-fk': 'home-all-links' }, 'All links', icon('arrow-right'))
        )
      : null,
    section('Browse by category', 'layers', cats),
  ];
  put(main, ...parts.filter(Boolean));
}
