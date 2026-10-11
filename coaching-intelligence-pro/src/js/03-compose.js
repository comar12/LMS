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

function quantity(n) {
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (n <= 4) return 'a few';
  return 'several';
}

function challengeOpener(tone, scope, n) {
  const where = scope === 'multiple' ? 'Across the interactions reviewed' : 'During the interaction';
  const q = quantity(n);
  if (tone === 'supportive') {
    const area = n === 1 ? 'is one area' : `are ${q} areas`;
    return scope === 'multiple'
      ? `Across the interactions reviewed, there ${area} we will work on together.`
      : `There ${area} from this interaction that we will work on together.`;
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

function challengeCloser(tone, n) {
  if (tone === 'supportive') {
    return n === 1
      ? 'This can be strengthened with focused practice, and the action plan breaks that practice into specific, measurable steps.'
      : 'Each of these can be strengthened with focused practice, and the action plan breaks that practice into specific, measurable steps.';
  }
  if (tone === 'direct') {
    return n === 1
      ? 'Meeting the expected standard in this area is required on every applicable call, and the action plan defines how progress will be measured.'
      : 'Meeting the expected standard in these areas is required on every applicable call, and the action plan defines how progress will be measured.';
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
  const sentences = [challengeOpener(b.tone, b.scope, n)];
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
  sentences.push(challengeCloser(b.tone, n));
  let text = sentences.map(tidySentence).join(' ');
  const evidence = b.notes.evidence.trim();
  if (evidence && b.notes.includeEvidence) text += '\n\n' + evidence;
  return text;
}

function composePlan(b, opps, s) {
  if (!opps.length) return '';
  const direct = b.tone === 'direct';
  const will = direct ? 'you are expected to' : 'you will';
  const alsoWill = direct ? 'You are also expected to' : 'You will also';
  const focus = dedupe(opps.map((o) => (o.b && o.b.focus) || lowerTitle(o.title)));
  const dur = durationPhrase(s.duration);
  const intro = [];
  if (b.tone === 'supportive') intro.push(`Over the next ${dur}, we will work together on ${joinList(focus)}.`);
  else if (direct) intro.push(`Over the next ${dur}, you are expected to meet the standard for ${joinList(focus)} on every applicable call.`);
  else intro.push(`Over the next ${dur}, you will focus on ${joinList(focus)}.`);

  for (const g of groupByTheme(opps)) {
    const theme = themeOf(g.theme);
    const commits = dedupe(g.items.map((o) => o.b && o.b.commit).filter(Boolean));
    const follow = direct ? ['You are also expected to {list}.', 'In addition, you are expected to {list}.'] : ['You will also {list}.', 'In addition, you will {list}.'];
    intro.push(...clauseSentences(theme.plan.replace('you will', will), commits, follow));
    g.items
      .filter((o) => !(o.b && o.b.commit))
      .forEach((o) => intro.push(`${alsoWill} apply the expected behavior for ${lowerTitle(o.title)} on every applicable call.`));
  }

  const calls = numWord(s.calls);
  const measure = [`We will review ${calls} applicable calls within the next ${followupPhrase(s.followup)} to measure progress.`];
  const std = dedupe(opps.map((o) => o.b && o.b.m).filter(Boolean));
  if (std.length && std.length <= 2) measure.push(`The target is for all ${calls} reviewed calls to show ${joinList(std)}.`);
  else if (std.length) measure.push(`The targets for all ${calls} reviewed calls are: ${std.slice(0, -1).join('; ')}; and ${std[std.length - 1]}.`);
  dedupe(opps.map((o) => o.b && o.b.mx).filter(Boolean)).forEach((mx) => measure.push(fillTokens(mx, s)));
  if (!std.length && !opps.some((o) => o.b && o.b.mx)) {
    measure.push(`The target is for all ${calls} reviewed calls to show the expected behaviors in this plan.`);
  }
  return intro.map(tidySentence).join(' ') + '\n\n' + measure.map(tidySentence).join(' ');
}

function composeFollowup(b, opps, s) {
  if (!opps.length) return '';
  const allCoach = dedupe(opps.map((o) => o.b && o.b.coach).filter(Boolean));
  const coach = allCoach.slice(0, 2);
  const parts = [];
  if (!coach.length) parts.push('During this coaching session, we will walk through the expected behaviors together using examples from the call.');
  else if (coach.length === 1) parts.push(`During this coaching session, we will complete ${coach[0]}.`);
  else parts.push(`During this coaching session, we will complete ${coach[0]}.`, `We will also complete ${coach[1]}.`);
  if (opps.length > coach.length && coach.length) parts.push('We will cover the remaining focus areas with short examples from the call.');
  const checkin = s.followup >= 5 ? 'a brief midweek check-in' : 'a brief check-in';
  parts.push(`I will review ${numWord(s.calls)} of your applicable calls within the next ${followupPhrase(s.followup)} and share what I find, and we will have ${checkin} to discuss what is working and any recurring gaps.`);
  parts.push(`At the end of the ${durationAdj(s.duration)} coaching period, we will review the results together and decide whether the plan is complete or needs to be extended or adjusted.`);
  if (b.tone === 'supportive') parts.push('If anything in this plan feels unclear, or you would like more practice before then, let me know and we will set up time.');
  if (b.tone === 'direct') parts.push('If the targets are not met by the end of the plan, we will discuss next steps, which may include an extended plan.');
  return parts.map(tidySentence).join(' ');
}

/** Generate all four builder sections from the current selections. */
function composeBuilder(b, settings) {
  const builder = b || state.builder;
  const s = settings || state.settings;
  const opps = builderOpps(builder);
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
