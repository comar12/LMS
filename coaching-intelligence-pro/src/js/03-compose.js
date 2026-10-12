/* ==========================================================================
   03-compose: plain-text composition for copying and the Coaching Builder.
   Deterministic: the same selections always produce the same text.
   ========================================================================== */

const SECTION = {
  strengths: 'Things Went Well',
  feedback: 'Things Can Be Better',
  impact: 'Root Cause & Customer Impact',
  followup: 'Supervisor Follow-Up Plan',
  example: 'Correct Behavior / Example Statement',
  questions: 'Coaching Questions',
};
const planHeading = (settings) => `${durationTitle((settings || state.settings).duration)} SMART Action Plan`;

/* ---------- Real KPI numbers ---------- */
/** How each KPI is named in coaching text, and which direction is better. Attrition is a team measure, so it has no agent number. */
const KPI_MEASURE = {
  QA: { name: 'QA score', dir: 'up', unit: '%' },
  aiCR: { name: 'Repeat contact rate (aiCR)', dir: 'down', unit: '%' },
  Transfer: { name: 'Transfer rate', dir: 'down', unit: '%' },
  ABS: { name: 'Absenteeism (ABS)', dir: 'down', unit: '%' },
};
function fmtNum(n, unit) {
  if (n === null || n === undefined) return '';
  return unit === '%' ? `${n}%` : unit === 'count' ? String(n) : `${n} ${unit}`;
}
/** Dates in coaching text are always written in English (for example, October 19), whatever the browser language. */
const textDay = (d) => parseDay(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const planEndDay = (s) => textDay(addDays(todayDay(), s.duration));
const followDay = (s) => textDay(addDays(todayDay(), s.followup));
/** KPIs with at least one number entered, in a fixed order. */
function numberedKpis(b) {
  return Object.keys(KPI_MEASURE).filter((k) => b.nums && b.nums[k] && (b.nums[k].cur !== null || b.nums[k].target !== null));
}
/** One measurable line per KPI, built only from the numbers the supervisor typed. */
function kpiMeasureLine(k, v, s) {
  const m = KPI_MEASURE[k];
  const better = m.dir === 'down' ? 'or lower' : 'or higher';
  const cur = v.cur !== null ? `${fmtNum(v.cur, v.unit)} as of ${textDay(v.asOf)}` : '';
  const tgt = v.target !== null ? `target ${fmtNum(v.target, v.unit)} ${better} by ${planEndDay(s)}` : `we will track it through ${planEndDay(s)}`;
  return cur ? `${m.name}: ${cur}, ${tgt}.` : `${m.name}: ${tgt}.`;
}
function kpiMeasureSentence(k, v, s) {
  const m = KPI_MEASURE[k];
  const name = m.name.charAt(0).toLowerCase() + m.name.slice(1);
  const better = m.dir === 'down' ? 'or lower' : 'or higher';
  if (v.cur !== null && v.target !== null) return `Your ${name} is ${fmtNum(v.cur, v.unit)} as of ${textDay(v.asOf)}, and the target is ${fmtNum(v.target, v.unit)} ${better} by ${planEndDay(s)}.`;
  if (v.target !== null) return `The target for your ${name} is ${fmtNum(v.target, v.unit)} ${better} by ${planEndDay(s)}.`;
  return `Your ${name} is ${fmtNum(v.cur, v.unit)} as of ${textDay(v.asOf)}, and we will track it through ${planEndDay(s)}.`;
}

/* ---------- Single opportunity ---------- */
const oppFeedback = (o) => String(o.feedback || '').trim();
const oppImpact = (o) => String(o.impact || '').trim();
const oppPlan = (o, s) => fillTokens(o.plan, s).trim();
const oppFollowup = (o, s) => fillTokens(o.followup, s).trim();

function exampleLines(o) {
  return (o.example || []).filter((e) => e && e.say);
}
function exampleText(o) {
  return exampleLines(o)
    .map((e) => (e.label ? `${e.label}: "${e.say}"` : `"${e.say}"`))
    .join('\n');
}
function questionsText(o) {
  return (o.questions || []).filter(Boolean).join('\n');
}

/* ---------- Strengths ---------- */
function strengthText(sel) {
  const s = getStrength(sel.id);
  if (!s || !s.v || !s.v.length) return '';
  return s.v[Math.min(sel.v || 0, s.v.length - 1)] || s.v[0];
}
function selectedStrengths() {
  return state.builder.strengths.filter((sel) => getStrength(sel.id));
}
function selectedStrengthsText() {
  return selectedStrengths().map(strengthText).filter(Boolean).join('\n\n');
}

/** Full coaching document for one opportunity, honoring the "Copy Full Coaching includes" settings. */
function fullCoachingText(o) {
  const fc = state.prefs.fullCopy;
  const parts = [`Coaching Focus: ${o.title}`];
  const add = (title, body) => {
    if (body && body.trim()) parts.push(`${title}\n${body.trim()}`);
  };
  if (fc.strengths) add(SECTION.strengths, selectedStrengthsText());
  if (fc.feedback) add(SECTION.feedback, oppFeedback(o));
  if (fc.impact) add(SECTION.impact, oppImpact(o));
  if (fc.plan) add(planHeading(), oppPlan(o));
  if (fc.followup) add(SECTION.followup, oppFollowup(o));
  if (fc.example) add(SECTION.example, exampleText(o));
  if (fc.questions) add(SECTION.questions, questionsText(o));
  return parts.join('\n\n');
}

/* ---------- Builder composition ---------- */
function builderOpps(b) {
  return (b || state.builder).opps.map(getOpp).filter(Boolean);
}

function groupByTheme(opps) {
  const groups = [];
  const index = new Map();
  for (const o of opps) {
    const key = THEMES[o.theme] ? o.theme : '_other';
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ theme: key, items: [] });
    }
    groups[index.get(key)].items.push(o);
  }
  return groups;
}
const themeOf = (key) => THEMES[key] || FALLBACK_THEME;

/* Attendance, adherence, and engagement entries are measured by shifts and check-ins, not calls. */
const isPeopleOpp = (o) => o.cat === 'people';
function builderMode(opps) {
  const p = opps.filter(isPeopleOpp).length;
  return p === 0 ? 'call' : p === opps.length ? 'people' : 'mixed';
}
const unitPhrase = (mode) => (mode === 'people' ? 'every scheduled shift' : mode === 'mixed' ? 'every applicable call and scheduled shift' : 'every applicable call');

function quantity(n) {
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (n <= 4) return 'a few';
  return 'several';
}

function challengeOpener(tone, scope, n, mode) {
  if (mode === 'people') {
    const q = quantity(n);
    if (tone === 'supportive') return n === 1 ? 'There is one area from the recent review period that we will work on together.' : `There are ${q} areas from the recent review period that we will work on together.`;
    if (tone === 'direct') return n === 1 ? 'Over the recent review period, one behavior did not meet the expected standard.' : `Over the recent review period, ${q} behaviors did not meet the expected standard.`;
    return n === 1 ? 'Looking at the recent review period, there is one area to focus on.' : `Looking at the recent review period, there are ${q} areas to focus on.`;
  }
  const where = mode === 'mixed' ? (scope === 'multiple' ? 'Across the interactions and the schedule period reviewed' : 'During the interaction and the recent schedule period') : scope === 'multiple' ? 'Across the interactions reviewed' : 'During the interaction';
  const q = quantity(n);
  if (tone === 'supportive') {
    const area = n === 1 ? 'is one area' : `are ${q} areas`;
    return scope === 'multiple'
      ? `Across the interactions reviewed, there ${area} we will work on together.`
      : `There ${area} from this ${mode === 'mixed' ? 'review' : 'interaction'} that we will work on together.`;
  }
  if (tone === 'direct') {
    return n === 1
      ? `${where}, one behavior did not meet the expected standard.`
      : `${where}, ${q === 'a few' ? 'a few' : q} behaviors did not meet the expected standard.`;
  }
  return n === 1
    ? `${where}, one behavior affected the overall customer experience.`
    : `${where}, ${q} behaviors affected the overall customer experience.`;
}

function challengeCloser(tone, n, mode) {
  if (tone === 'supportive') {
    return n === 1
      ? 'This can be strengthened with focused practice, and the action plan breaks that practice into specific, measurable steps.'
      : 'Each of these can be strengthened with focused practice, and the action plan breaks that practice into specific, measurable steps.';
  }
  if (tone === 'direct') {
    return n === 1
      ? `Meeting the expected standard in this area is required on ${unitPhrase(mode)}, and the action plan defines how progress will be measured.`
      : `Meeting the expected standard in these areas is required on ${unitPhrase(mode)}, and the action plan defines how progress will be measured.`;
  }
  return n === 1
    ? 'The action plan outlines the specific steps and measures for improving in this area.'
    : 'The action plan outlines the specific steps and measures for improving in these areas.';
}

const isShortClause = (s) => wordCount(s) <= 16 && !s.includes(',');

/**
 * Turn clauses into readable sentences: the first uses the lead-in, short neighbours are paired,
 * long clauses get their own sentence, and follow-on sentences rotate their connectors.
 */
function clauseSentences(lead, clauses, followForms) {
  const out = [];
  let i = 0;
  let follow = 0;
  while (i < clauses.length) {
    const a = clauses[i];
    const b = clauses[i + 1];
    const part = b && isShortClause(a) && isShortClause(b) ? [a, b] : [a];
    i += part.length;
    const list = joinList(part);
    if (!out.length) out.push(lead.replace('{list}', list));
    else out.push(followForms[follow++ % followForms.length].replace('{list}', list));
  }
  return out;
}

function composeProgress(b) {
  const paras = [];
  const note = b.notes.progress.trim();
  if (note) paras.push(note);
  for (const sel of b.strengths) {
    if (!getStrength(sel.id)) continue;
    const t = strengthText(sel);
    if (t) paras.push(t);
  }
  return paras.join('\n\n');
}

function composeChallenges(b, opps) {
  if (!opps.length) return '';
  const n = opps.length;
  const mode = builderMode(opps);
  const sentences = [challengeOpener(b.tone, b.scope, n, mode)];
  const groups = groupByTheme(opps);
  for (const g of groups) {
    const theme = themeOf(g.theme);
    const obs = dedupe(g.items.filter((o) => o.b && o.b.obs).map((o) => o.b.obs));
    sentences.push(...clauseSentences(theme.lead, obs, ['You also {list}.', 'In addition, you {list}.']));
    g.items
      .filter((o) => !(o.b && o.b.obs))
      .forEach((o) => sentences.push(`There was also an opportunity related to ${lowerTitle(o.title)}.`));
  }
  const impacts = dedupe(groups.map((g) => themeOf(g.theme).impact)).slice(0, 4);
  sentences.push(n === 1 ? `This can ${impacts[0]}.` : `Together, these behaviors can ${joinList(impacts)}.`);
  sentences.push(challengeCloser(b.tone, n, mode));
  let text = sentences.map(tidySentence).join(' ');
  const evidence = b.notes.evidence.trim();
  if (evidence && b.notes.includeEvidence) text += '\n\n' + evidence;
  return text;
}

function composePlan(b, opps, s) {
  if (!opps.length) return '';
  const direct = b.tone === 'direct';
  const mode = builderMode(opps);
  const will = direct ? 'you are expected to' : 'you will';
  const alsoWill = direct ? 'You are also expected to' : 'You will also';
  const focus = dedupe(opps.map((o) => (o.b && o.b.focus) || lowerTitle(o.title)));
  const dur = durationPhrase(s.duration);
  const intro = [];
  if (b.tone === 'supportive') intro.push(`Over the next ${dur}, we will work together on ${joinList(focus)}.`);
  else if (direct) intro.push(`Over the next ${dur}, you are expected to meet the standard for ${joinList(focus)} on ${unitPhrase(mode)}.`);
  else intro.push(`Over the next ${dur}, you will focus on ${joinList(focus)}.`);

  for (const g of groupByTheme(opps)) {
    const theme = themeOf(g.theme);
    const commits = dedupe(g.items.map((o) => o.b && o.b.commit).filter(Boolean));
    const follow = direct ? ['You are also expected to {list}.', 'In addition, you are expected to {list}.'] : ['You will also {list}.', 'In addition, you will {list}.'];
    intro.push(...clauseSentences(theme.plan.replace('you will', will), commits, follow));
    g.items
      .filter((o) => !(o.b && o.b.commit))
      .forEach((o) => intro.push(`${alsoWill} apply the expected behavior for ${lowerTitle(o.title)} on ${unitPhrase(isPeopleOpp(o) ? 'people' : 'call')}.`));
  }

  const calls = numWord(s.calls);
  const measure = [];
  if (mode === 'people') measure.push(`We will check in together within the next ${followupPhrase(s.followup)} to review how the plan is going.`);
  else measure.push(`We will review ${calls} applicable calls within the next ${followupPhrase(s.followup)} to measure progress.`);
  const std = dedupe(opps.filter((o) => !isPeopleOpp(o)).map((o) => o.b && o.b.m).filter(Boolean));
  if (std.length && std.length <= 2) measure.push(`The target is for all ${calls} reviewed calls to show ${joinList(std)}.`);
  else if (std.length) measure.push(`The targets for all ${calls} reviewed calls are: ${std.slice(0, -1).join('; ')}; and ${std[std.length - 1]}.`);
  dedupe(opps.map((o) => o.b && o.b.mx).filter(Boolean)).forEach((mx) => measure.push(fillTokens(mx, s)));
  if (mode !== 'people' && !std.length && !opps.some((o) => !isPeopleOpp(o) && o.b && o.b.mx)) {
    measure.push(`The target is for all ${calls} reviewed calls to show the expected behaviors in this plan.`);
  }
  const nums = numberedKpis(b).map((k) => kpiMeasureSentence(k, b.nums[k], s));
  return intro.map(tidySentence).join(' ') + '\n\n' + measure.map(tidySentence).join(' ') + (nums.length ? '\n\n' + nums.join(' ') : '');
}

function composeFollowup(b, opps, s) {
  if (!opps.length) return '';
  const mode = builderMode(opps);
  const people = opps.filter(isPeopleOpp);
  const hasSchedule = people.some((o) => o.theme === 'attend' || o.theme === 'adhere');
  const hasEngage = people.some((o) => o.theme === 'engage');
  const allCoach = dedupe(opps.map((o) => o.b && o.b.coach).filter(Boolean));
  const coach = allCoach.slice(0, 2);
  const parts = [];
  if (!coach.length) parts.push(mode === 'people' ? 'During this coaching session, we will talk through the expectations together and agree on the support you need.' : 'During this coaching session, we will walk through the expected behaviors together using examples from the call.');
  else if (coach.length === 1) parts.push(`During this coaching session, we will complete ${coach[0]}.`);
  else parts.push(`During this coaching session, we will complete ${coach[0]}.`, `We will also complete ${coach[1]}.`);
  if (opps.length > coach.length && coach.length) parts.push(mode === 'people' ? 'We will cover the remaining focus areas in our check-ins.' : 'We will cover the remaining focus areas with short examples from the call.');
  const checkin = s.followup >= 5 ? 'a brief midweek check-in' : 'a brief check-in';
  const peopleTopics = [hasSchedule ? 'review your schedule adherence and attendance together' : null, hasEngage ? 'talk about what is going well and where you would like more support' : null].filter(Boolean);
  if (mode === 'people') {
    parts.push(`We will have a short check-in within the next ${followupPhrase(s.followup)} to ${joinList(peopleTopics)}, and we will keep checking in regularly until the end of the plan.`);
  } else {
    parts.push(`I will review ${numWord(s.calls)} of your applicable calls within the next ${followupPhrase(s.followup)} and share what I find, and we will have ${checkin} to discuss what is working and any recurring gaps.`);
    if (mode === 'mixed') parts.push(`During the same period, we will also ${joinList(peopleTopics)}.`);
  }
  parts.push(`At the end of the ${durationAdj(s.duration)} coaching period, we will review the results together and decide whether the plan is complete or needs to be extended or adjusted.`);
  if (b.tone === 'supportive') parts.push('If anything in this plan feels unclear, or you would like more practice before then, let me know and we will set up time.');
  if (b.tone === 'direct') parts.push('If the targets are not met by the end of the plan, we will discuss next steps, which may include an extended plan.');
  return parts.map(tidySentence).join(' ');
}

/* ---------- Points format: short, scannable lines with real dates ---------- */
const bullet = (t) => `\u2022 ${tidySentence(capFirst(String(t).trim()))}`;
const focusLabel = (o) => capFirst((o.b && o.b.focus) || lowerTitle(o.title));

function pointsProgress(b) {
  const lines = [];
  // Verified progress is kept word for word, one point per sentence.
  b.notes.progress
    .split(/\n+|(?<=[.?!])\s+(?=[A-Z])/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l) => lines.push(bullet(l)));
  for (const sel of b.strengths) {
    if (!getStrength(sel.id)) continue;
    const t = strengthText(sel);
    if (t) lines.push(bullet(t));
  }
  return lines.join('\n');
}

function pointsChallenges(b, opps) {
  if (!opps.length) return '';
  const lead = { supportive: 'What we will work on together:', direct: 'Behaviors that did not meet the expected standard:', balanced: 'What to work on:' }[b.tone] || 'What to work on:';
  const lines = [lead];
  const groups = groupByTheme(opps);
  for (const g of groups) {
    for (const o of g.items) {
      if (o.b && o.b.obs) lines.push(`\u2022 ${focusLabel(o)}: ${tidySentence(`you ${o.b.obs}`)}`);
      else lines.push(bullet(o.title));
    }
  }
  const impacts = dedupe(groups.map((g) => themeOf(g.theme).impact)).slice(0, 3);
  lines.push('', tidySentence(`Why it matters: this can ${joinList(impacts)}`));
  const evidence = b.notes.evidence.trim();
  if (evidence && b.notes.includeEvidence) lines.push('', evidence);
  return lines.join('\n');
}

function pointsPlan(b, opps, s) {
  if (!opps.length) return '';
  const mode = builderMode(opps);
  const direct = b.tone === 'direct';
  const focus = dedupe(opps.map((o) => (o.b && o.b.focus) || lowerTitle(o.title)));
  const lines = [tidySentence(`Focus until ${planEndDay(s)}: ${joinList(focus)}`), direct ? 'You are expected to:' : 'You will:'];
  let n = 0;
  dedupe(opps.map((o) => (o.b && o.b.commit ? capFirst(o.b.commit) : `Apply the expected behavior for ${lowerTitle(o.title)} on ${unitPhrase(isPeopleOpp(o) ? 'people' : 'call')}`))).forEach((c) => lines.push(`${++n}. ${tidySentence(c)}`));
  lines.push('', 'How we will measure success:');
  numberedKpis(b).forEach((k) => lines.push(`\u2022 ${kpiMeasureLine(k, b.nums[k], s)}`));
  const calls = s.calls;
  if (mode === 'people') lines.push(bullet(`Check-in by ${followDay(s)} to review how the plan is going`));
  else {
    lines.push(bullet(`Call reviews: ${calls} applicable calls by ${followDay(s)}`));
    const std = dedupe(opps.filter((o) => !isPeopleOpp(o)).map((o) => o.b && o.b.m).filter(Boolean));
    std.forEach((m) => lines.push(bullet(`On every reviewed call: ${m}`)));
    if (!std.length && !opps.some((o) => !isPeopleOpp(o) && o.b && o.b.mx)) lines.push(bullet('On every reviewed call: the expected behaviors in this plan'));
  }
  dedupe(opps.map((o) => o.b && o.b.mx).filter(Boolean)).forEach((mx) => lines.push(bullet(fillTokens(mx, s))));
  return lines.join('\n');
}

function pointsFollowup(b, opps, s) {
  if (!opps.length) return '';
  const mode = builderMode(opps);
  const people = opps.filter(isPeopleOpp);
  const hasSchedule = people.some((o) => o.theme === 'attend' || o.theme === 'adhere');
  const hasEngage = people.some((o) => o.theme === 'engage');
  const peopleTopics = [hasSchedule ? 'review your schedule adherence and attendance together' : null, hasEngage ? 'talk about what is going well and where you would like more support' : null].filter(Boolean);
  const coach = dedupe(opps.map((o) => o.b && o.b.coach).filter(Boolean)).slice(0, 2);
  const lines = [];
  if (!coach.length) lines.push(bullet(mode === 'people' ? 'Today: we talk through the expectations and agree on the support you need' : 'Today: we walk through the expected behaviors using examples from the call'));
  coach.forEach((c) => lines.push(bullet(`Today: ${c}`)));
  if (mode === 'people') lines.push(bullet(`By ${followDay(s)}: a short check-in to ${joinList(peopleTopics)}`));
  else {
    lines.push(bullet(`Around ${textDay(addDays(todayDay(), Math.max(1, Math.round(s.followup / 2))))}: a short check-in on what is working and any recurring gaps`));
    lines.push(bullet(`By ${followDay(s)}: I review ${s.calls} of your applicable calls and share what I find`));
    if (mode === 'mixed' && peopleTopics.length) lines.push(bullet(`Also by ${followDay(s)}: we ${joinList(peopleTopics)}`));
  }
  const nums = numberedKpis(b);
  if (nums.length) lines.push(bullet(`At each check-in: we look at your ${joinList(nums.map((k) => KPI_MEASURE[k].name))} on the dashboard together`));
  lines.push(bullet(`${planEndDay(s)}: we review the results together and decide if the plan is complete, extended, or adjusted`));
  if (b.tone === 'supportive') lines.push(bullet('Anytime: if something is unclear or you want more practice, tell me and we will set up time'));
  if (b.tone === 'direct') lines.push(bullet(`If the targets are not met by ${planEndDay(s)}, we will discuss next steps, which may include an extended plan`));
  return lines.join('\n');
}

/** Generate all four builder sections from the current selections. */
function composeBuilder(b, settings) {
  const builder = b || state.builder;
  const s = settings || state.settings;
  const opps = builderOpps(builder);
  if (builder.style !== 'paragraphs') {
    return {
      progress: pointsProgress(builder),
      challenges: pointsChallenges(builder, opps),
      plan: pointsPlan(builder, opps, s),
      followup: pointsFollowup(builder, opps, s),
    };
  }
  return {
    progress: composeProgress(builder),
    challenges: composeChallenges(builder, opps),
    plan: composePlan(builder, opps, s),
    followup: composeFollowup(builder, opps, s),
  };
}

/** Current text of a builder section: the supervisor's edit if any, otherwise the generated text. */
function builderSectionText(key, generated) {
  const edited = state.builder.edited[key];
  if (typeof edited === 'string') return edited;
  return (generated || composeBuilder())[key] || '';
}

function builderAllText() {
  const gen = composeBuilder();
  return BUILDER_FIELDS.map((f) => `${f.title}\n${builderSectionText(f.key, gen).trim()}`).join('\n\n');
}

/* Original per-opportunity paragraphs, for supervisors who prefer them stacked. */
function stackedText(kind) {
  const opps = builderOpps();
  if (!opps.length) return '';
  if (kind === 'feedback') return opps.map((o) => oppFeedback(o)).join('\n\n');
  if (kind === 'plan') return opps.map((o) => oppPlan(o)).join('\n\n');
  return opps.map((o) => `${o.title}\n${oppFeedback(o)}\n\n${planHeading()}\n${oppPlan(o)}`).join('\n\n');
}

/* Strength vs opportunity conflicts (e.g. Personalized Empathy alongside Missing Empathy). */
function conflictsFor(strengthId, oppIds) {
  return oppIds.filter((oid) => (OPPOSITES[oid] || []).includes(strengthId)).map(getOpp).filter(Boolean);
}
