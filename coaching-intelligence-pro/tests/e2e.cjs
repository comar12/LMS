/* End-to-end tests for VXI_Coaching_Intelligence_Pro.html (Playwright + Chromium).
 *
 * Run:  NODE_PATH=$(npm root -g) node tests/e2e.cjs
 *
 * Every scenario runs against the built file over file:// with the browser context
 * set offline, and fails if the page makes any non-local request or logs an error.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = process.env.CIP_ROOT ? path.resolve(process.env.CIP_ROOT) : path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'VXI_Coaching_Intelligence_Pro.html');
const URL = 'file://' + FILE;
const DATA_DIR = path.join(ROOT, 'src', 'data');
const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'meta.json'), 'utf8'));
const opps = meta.categories.flatMap((c) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, c.file), 'utf8')));
const strengths = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'strengths.json'), 'utf8'));
const oppById = Object.fromEntries(opps.map((o) => [o.id, o]));
const toolkit = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sales_toolkit.json'), 'utf8'));
const callReviews = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'call_reviews.json'), 'utf8'));
const peopleToolkit = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'people_toolkit.json'), 'utf8'));
const OPP_COUNT = opps.length;
const strengthById = Object.fromEntries(strengths.map((s) => [s.id, s]));

const results = [];
let browser;

function fill(text, s = { duration: 14, calls: 5, followup: 7 }) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const nw = (n) => (n <= 10 ? words[n] : String(n));
  const dur = s.duration % 7 === 0 ? (s.duration === 7 ? 'one week' : nw(s.duration / 7) + ' weeks') : nw(s.duration) + ' days';
  const adj = s.duration % 7 === 0 ? nw(s.duration / 7) + '-week' : nw(s.duration) + '-day';
  const v = { duration: dur, durationAdj: adj, calls: nw(s.calls), followup: nw(s.followup) + ' days' };
  return text.replace(/\{(duration|durationAdj|calls|followup)\}/g, (m, k, off, whole) => {
    const before = whole.slice(0, off);
    const start = off === 0 || /[.?!]\s+$/.test(before);
    return start ? v[k][0].toUpperCase() + v[k].slice(1) : v[k];
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const NAME_RE = /\b(John|Mary|Sarah|Michael|David|Jennifer|Maria|Karen|Mike|Omar|Ahmed|Jessica|Ashley)\b|\bthe agent\b|\b(BPID|HRID|Avaya)\b|\d{6,}/;
const location = (page) => page.url();

function assertClean(text, label) {
  assert(text && text.trim().length > 0, `${label}: empty`);
  assert(!/[{}]/.test(text), `${label}: contains unrendered token braces`);
  assert(!/\[|\]/.test(text), `${label}: contains square brackets`);
  assert(!/undefined|null|NaN|\[object/.test(text), `${label}: contains undefined/null/NaN`);
  assert(!NAME_RE.test(text), `${label}: contains a name, third-person reference, or identifier`);
  assert(!/<[a-z/][^>]*>/i.test(text), `${label}: contains HTML markup`);
  assert(!/\*\*|^#+\s|^\s*[-*]\s/m.test(text), `${label}: contains Markdown markers`);
}

async function newPage(opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    reducedMotion: opts.reducedMotion || 'no-preference',
    colorScheme: opts.colorScheme || 'light',
    acceptDownloads: true,
  });
  await context.setOffline(true);
  const page = await context.newPage();
  page._external = [];
  page._errors = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) page._external.push(u);
  });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') page._errors.push('console: ' + m.text());
  });
  page.on('dialog', async (d) => {
    page._errors.push('unexpected dialog: ' + d.message());
    await d.dismiss();
  });
  if (opts.init) await page.addInitScript(opts.init);
  // Most tests start in the library; the Home dashboard has its own test.
  await page.goto(URL + (opts.hash === undefined ? '#/all' : opts.hash));
  await page.waitForSelector('.opp-card, .s-card, .builder, .page-title');
  return { page, context };
}

async function finish(page, context) {
  assert(page._external.length === 0, 'Network requests were made: ' + page._external.join(', '));
  assert(page._errors.length === 0, 'Errors: ' + page._errors.join(' | '));
  await context.close();
}

async function search(page, q) {
  await page.fill('#searchInput', q);
  await page.waitForTimeout(250);
}

async function clipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function clickCopy(page, name) {
  const btn = page.getByRole('button', { name });
  await btn.click();
  await page.waitForFunction((el) => el.innerText.includes('Copied'), await btn.elementHandle(), { timeout: 3000 });
  return clipboard(page);
}

async function openFromSearch(page, q, title) {
  await search(page, q);
  const first = page.locator('.opp-card').first();
  const firstTitle = (await first.locator('.opp-card__title').innerText()).trim();
  if (title) assert(firstTitle === title, `Search "${q}" top result was "${firstTitle}", expected "${title}"`);
  await first.locator('.opp-card__open').click();
  await page.waitForSelector('#panelTitle');
  await page.waitForTimeout(300);
  return firstTitle;
}

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}

(async () => {
  browser = await chromium.launch();

  await test('Scenario 1: individual coaching (Dead Air) search, open, copy feedback and plan', async () => {
    const { page, context } = await newPage();
    await openFromSearch(page, 'Dead Air', 'Excessive Dead Air');
    const o = oppById['hold-dead-air'];
    const fb = await clickCopy(page, 'Copy Things Can Be Better');
    assert(fb === o.feedback, 'Copied feedback does not match the library text');
    assertClean(fb, 'Dead air feedback');
    const plan = await clickCopy(page, 'Copy Two-Week SMART Action Plan');
    assert(plan === fill(o.plan), 'Copied plan does not match the rendered plan');
    assertClean(plan, 'Dead air plan');
    assert(/two weeks/.test(plan) && /five/.test(plan) && /seven days/.test(plan), 'Plan is missing rendered duration/calls/follow-up');
    // Synonym searches for hold/mute behaviors.
    for (const q of ['silent', 'mute', 'no response', 'dead air']) {
      await search(page, q);
      const titles = await page.locator('.opp-card__title').allInnerTexts();
      const top = titles.slice(0, 5).join(' | ');
      assert(titles.slice(0, 5).some((t) => /Dead Air|Silence|Mute|Delayed Responses/.test(t)), `Search "${q}" did not surface Hold/Mute entries: ${top}`);
      const cats = await page.locator('.opp-card').evaluateAll((els) => els.slice(0, 3).map((e) => e.className));
      assert(cats.some((c) => c.includes('cat-hold')), `Search "${q}" top results are not in Hold & Mute`);
    }
    await finish(page, context);
  });

  await test('Scenario 2: empathy coaching content and behavior-specific plan', async () => {
    const { page, context } = await newPage();
    await search(page, 'Empathy');
    const titles = await page.locator('.opp-card__title').allInnerTexts();
    assert(titles.slice(0, 2).includes('Missing Empathy') && titles.slice(0, 2).includes('Generic / Non-Personalized Empathy'), 'Empathy entries are not the top two results: ' + titles.slice(0, 4).join(' | '));
    await page.locator('.opp-card', { hasText: 'Missing Empathy' }).first().locator('.opp-card__open').click();
    await page.waitForSelector('#panelTitle');
    const fb = (await clickCopy(page, 'Copy Things Can Be Better')).toLowerCase();
    for (const w of ['acknowledg', 'empathy', 'frustrat', 'specific situation']) assert(fb.includes(w), `Empathy feedback missing "${w}"`);
    assert(/feel|patient|cold/.test(fb), 'Empathy feedback does not describe customer impact');
    const plan = (await clickCopy(page, /Copy .*SMART Action Plan/)).toLowerCase();
    assert(plan.includes('empathy') && plan.includes('before'), 'Empathy plan is not behavior-specific');
    for (const q of ['customer angry', 'frustration', 'de-escalation']) {
      await search(page, q);
      const t = await page.locator('.opp-card__title').allInnerTexts();
      assert(t.slice(0, 6).some((x) => /De-escalation|Empathy|Frustration|Emotional/.test(x)), `Search "${q}" did not surface communication entries: ${t.slice(0, 6).join(' | ')}`);
    }
    for (const q of ['questions', 'probing', 'discovery']) {
      await search(page, q);
      const cls = await page.locator('.opp-card').evaluateAll((els) => els.slice(0, 5).map((e) => e.className));
      const nDis = cls.filter((c) => c.includes('cat-dis')).length;
      assert(nDis >= (q === 'questions' ? 3 : 4), `Search "${q}" top 5 contain only ${nDis} Discovery entries`);
      assert(cls[0].includes('cat-dis') || q === 'questions', `Search "${q}" top result is not a Discovery entry`);
    }
    await finish(page, context);
  });

  await test('Scenario 3: tone of voice (Sleepy Tone) content', async () => {
    const { page, context } = await newPage();
    await openFromSearch(page, 'Sleepy Tone', 'Flat / Sleepy / Low-Energy Tone');
    const o = oppById['com-flat-tone'];
    const fb = o.feedback.toLowerCase();
    const all = [o.feedback, o.impact, o.plan, o.followup, o.note || ''].join(' ').toLowerCase();
    assert(/energy/.test(fb), 'Tone feedback does not mention vocal energy');
    assert(/engag/.test(all), 'Tone content does not mention engagement');
    assert(/confiden/.test(all), 'Tone content does not mention confidence');
    assert(/variation|vary|pitch|emphasis/.test(all), 'Tone content does not mention tone variation');
    assert(/cheer|serious|match|upbeat|bubbly|outage|hardship/.test(all), 'Tone content does not address matching serious situations');
    for (const q of ['sleepy', 'monotone', 'flat', 'energy']) {
      await search(page, q);
      const t = (await page.locator('.opp-card__title').first().innerText()).trim();
      assert(t === 'Flat / Sleepy / Low-Energy Tone', `Search "${q}" top result was "${t}"`);
    }
    await finish(page, context);
  });

  await test('Scenario 4: Coaching Builder merges five opportunities without repetition or conflicts', async () => {
    const { page, context } = await newPage({ hash: '#/builder' });
    const pick = ['Missing Empathy', 'Weak or Missing Assurance', 'Excessive Dead Air', 'Insufficient Probing', 'Flat / Sleepy / Low-Energy Tone'];
    for (const title of pick) {
      await page.fill('#combo-opps', title);
      await page.waitForTimeout(80);
      const opt = page.locator('#combo-opps-list [role="option"]', { hasText: title }).first();
      await opt.click();
      await page.waitForTimeout(120);
    }
    for (const title of ['Correct Technical Diagnosis', 'Correct Escalation']) {
      await page.fill('#combo-strengths', title);
      await page.waitForTimeout(80);
      await page.locator('#combo-strengths-list [role="option"]', { hasText: title }).first().click();
      await page.waitForTimeout(120);
    }
    const count = await page.locator('.sel-list').first().locator('li').count();
    assert(count === 5, `Expected 5 opportunities in the builder, found ${count}`);
    const read = (k) => page.locator(`#out-${k}`).inputValue();
    const progress = await read('progress');
    const challenges = await read('challenges');
    const plan = await read('plan');
    const followup = await read('followup');
    [['progress', progress], ['challenges', challenges], ['plan', plan], ['followup', followup]].forEach(([k, v]) => assertClean(v, `Builder ${k}`));
    assert(progress.includes(strengthById['s-diagnosis'].v[0]) && progress.includes(strengthById['s-escalation'].v[0]), 'Progress section does not contain both selected strengths');
    const unselected = strengths.filter((s) => !['s-diagnosis', 's-escalation'].includes(s.id)).flatMap((s) => s.v);
    assert(!unselected.some((v) => progress.includes(v)), 'Progress section contains an unselected strength');
    const all = [challenges, plan, followup].join(' ');
    const sentences = all.split(/(?<=[.?!])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.split(' ').length > 4);
    const dupes = sentences.filter((s, i) => sentences.indexOf(s) !== i);
    assert(dupes.length === 0, 'Repeated sentences: ' + dupes.join(' || '));
    assert((plan.match(/We will review/g) || []).length === 1, 'Plan should contain exactly one review commitment');
    assert((followup.match(/I will review/g) || []).length === 1, 'Follow-up should contain exactly one audit commitment');
    assert(!/\b(three|four|six|seven|eight|nine|ten) (applicable |reviewed )?calls\b/.test(plan + followup), 'Conflicting call counts in plan or follow-up');
    assert(/two weeks/.test(plan) && /seven days/.test(plan), 'Plan does not use the default timeframes');
    for (const t of pick.map((x) => opps.find((o) => o.title === x))) {
      assert(challenges.includes(t.b.obs), `Challenges missing observation for ${t.title}`);
      assert(plan.includes(t.b.commit), `Plan missing commitment for ${t.title}`);
    }
    assert(!challenges.includes(oppById['hold-dead-air'].feedback), 'Challenges pasted a full feedback paragraph instead of merging');
    // Grammar spot checks
    for (const s of all.split(/(?<=[.?!])\s+/)) {
      if (!s.trim()) continue;
      assert(/^[A-Z"]/.test(s.trim()), 'Sentence does not start with a capital letter: ' + s.slice(0, 60));
    }
    assert(!/ {2,}|\s[,.]|\.\./.test(all), 'Spacing or punctuation problem in builder text');
    // Tone switch
    await page.getByRole('button', { name: 'Direct' }).click();
    await page.waitForTimeout(150);
    assert(/you are expected to/.test(await read('plan')), 'Direct tone did not change the plan wording');
    await page.getByRole('button', { name: 'Supportive' }).click();
    await page.waitForTimeout(150);
    assert(/work on together|work together/.test(await read('challenges') + (await read('plan'))), 'Supportive tone did not change the wording');
    // Manual edits survive selection changes
    const ta = page.locator('#out-challenges');
    await ta.click();
    await page.keyboard.press('End');
    await ta.press('Control+End');
    await page.keyboard.type(' Supervisor added sentence.');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Remove Insufficient Probing' }).click();
    await page.waitForTimeout(250);
    const edited = await read('challenges');
    assert(edited.includes('Supervisor added sentence.'), 'Manual edit was lost after changing selections');
    assert(await page.locator('#outstale-challenges').isVisible(), 'Stale-edit notice not shown after selections changed');
    assert(!(await read('plan')).includes(oppById['dis-insufficient-probing'].b.commit), 'Removed opportunity still in the plan');
    // Reorder with buttons
    await page.getByRole('button', { name: 'Move Weak or Missing Assurance up' }).click();
    await page.waitForTimeout(150);
    const firstItem = (await page.locator('.sel-list').first().locator('li').first().innerText()).trim();
    assert(firstItem.includes('Weak or Missing Assurance'), 'Reorder did not move the item up');
    // Copy all
    const copied = await clickCopy(page, 'Copy all four coaching sections');
    for (const head of ['What Progress Has Been Made Since Last Coaching Session?', 'What Challenges or Obstacles Has the Teammate Experienced?', 'Action Plan: What Actions Will the Teammate Commit to After This Conversation?', 'Supervisor Follow-Up Plan']) {
      assert(copied.split(head).length === 2, `Copy all should contain "${head}" exactly once`);
    }
    assert(copied.includes('Supervisor added sentence.'), 'Copy all did not include the manual edit');
    // Persistence of builder after reload
    await page.reload();
    await page.waitForSelector('#out-challenges');
    assert((await read('challenges')).includes('Supervisor added sentence.'), 'Builder edits did not persist after reload');
    await finish(page, context);
  });

  await test('Scenario 5: Things Went Well selection and copy (only selected strengths)', async () => {
    const { page, context } = await newPage({ hash: '#/strengths' });
    await page.waitForSelector('.s-card');
    const cards = await page.locator('.s-card').count();
    assert(cards >= 20, `Expected at least 20 strengths, found ${cards}`);
    await page.getByRole('button', { name: 'Mark Strong Acknowledgement as observed' }).click();
    await page.waitForTimeout(100);
    const itg = page.locator('.s-card', { hasText: 'Correct ITG Utilization' });
    await itg.getByRole('button', { name: 'Version 2' }).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Mark Correct ITG Utilization as observed' }).click();
    await page.waitForTimeout(100);
    const text = await clickCopy(page, 'Copy selected strengths');
    const expected = [strengthById['s-acknowledgement'].v[0], strengthById['s-itg'].v[1]].join('\n\n');
    assert(text === expected, 'Copied strengths do not match the two selected wordings');
    assert(/\byou\b|\byour\b/i.test(text), 'Strengths are not written to the agent');
    const others = strengths.filter((s) => !['s-acknowledgement', 's-itg'].includes(s.id)).flatMap((s) => s.v);
    assert(!others.some((v) => text.includes(v)), 'An unselected strength appeared in copied text');
    assertClean(text, 'Strengths');
    for (const s of strengths) assert(s.v.length >= 2, `${s.id} has fewer than two variations`);
    await finish(page, context);
  });

  await test('Scenario 6: persistence of favorites, custom entries, and settings after refresh', async () => {
    const { page, context } = await newPage();
    await search(page, 'Interrupting');
    await page.getByRole('button', { name: 'Add Interrupting the Customer to favorites' }).click();
    await page.goto(URL + '#/templates');
    await page.getByRole('button', { name: 'New opportunity' }).click();
    await page.fill('#ed-title', 'Headset Volume Too Low');
    await page.fill('#ed-feedback', 'During the call, your headset volume made it hard for the customer to hear you clearly. Check your audio settings before each shift so the customer never has to strain to follow the conversation.');
    await page.fill('#ed-plan', 'For the next {duration}, you will test your headset at the start of each shift. We will review {calls} calls within {followup} to confirm clear audio on every call.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForSelector('#panelTitle');
    assert((await page.locator('#panelTitle').innerText()).includes('Headset Volume Too Low'), 'New custom entry did not open');
    await page.reload();
    await page.goto(URL + '#/favorites');
    await page.waitForTimeout(200);
    const favTitles = await page.locator('.opp-card__title').allInnerTexts();
    assert(favTitles.includes('Interrupting the Customer'), 'Favorite did not persist');
    await search(page, 'headset volume');
    await page.goto(URL + '#/all');
    await search(page, 'headset volume');
    const t = await page.locator('.opp-card__title').allInnerTexts();
    assert(t.includes('Headset Volume Too Low'), 'Custom entry did not persist');
    const plan = await page.evaluate(() => localStorage.getItem('cip.v1.custom'));
    assert(plan && plan.includes('Headset Volume Too Low'), 'Custom entry not in local storage');
    await finish(page, context);
  });

  await test('Scenario 7: offline operation and no network requests', async () => {
    const html = fs.readFileSync(FILE, 'utf8');
    assert(!/<script[^>]+src=/i.test(html), 'External script tag found');
    assert(!/<link[^>]+rel=["']?stylesheet/i.test(html), 'External stylesheet found');
    const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    assert(css.length > 1000 && !/@import|url\((?!["']?data:)/i.test(css), 'CSS @import or url() found');
    assert(/Content-Security-Policy/.test(html) && /connect-src 'none'/.test(html), 'CSP meta missing');
    const { page, context } = await newPage();
    const n = await page.locator('.opp-card').count();
    assert(n === OPP_COUNT, `Expected ${OPP_COUNT} cards on All Opportunities, found ${n}`);
    await openFromSearch(page, 'transfer');
    await page.goto(URL + '#/builder');
    await page.goto(URL + '#/strengths');
    await page.goto(URL + '#/settings');
    await page.waitForSelector('.card');
    const fetchBlocked = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/');
        return false;
      } catch (e) {
        return true;
      }
    });
    assert(fetchBlocked, 'A network fetch was not blocked');
    page._errors = page._errors.filter((e) => !/Content Security Policy|example\.com|Failed to fetch/i.test(e));
    page._external = page._external.filter((u) => !u.includes('example.com'));
    await finish(page, context);
  });

  await test('Scenario 8: responsive layouts without horizontal overflow or hidden copy controls', async () => {
    const sizes = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 740 },
    ];
    for (const vp of sizes) {
      const { page, context } = await newPage({ viewport: vp });
      const overflow = async (label) => {
        const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(o <= 1, `${vp.width}px ${label}: horizontal overflow of ${o}px`);
      };
      await overflow('library');
      await page.goto(URL + '#/all?open=hold-dead-air');
      await page.waitForSelector('#panelTitle');
      await page.waitForTimeout(350);
      await overflow('panel open');
      const box = await page.locator('#panel').boundingBox();
      assert(box && box.x >= -1 && box.x + box.width <= vp.width + 1, `${vp.width}px: panel extends past the viewport`);
      const copyBtns = page.locator('#panel .copy-btn');
      const nBtns = await copyBtns.count();
      assert(nBtns >= 6, `${vp.width}px: expected copy buttons in the panel, found ${nBtns}`);
      for (let i = 0; i < nBtns; i++) {
        const b = copyBtns.nth(i);
        await b.scrollIntoViewIfNeeded();
        const bb = await b.boundingBox();
        assert(bb && bb.width > 20 && bb.x >= 0 && bb.x + bb.width <= vp.width + 1, `${vp.width}px: copy button ${i} is clipped or hidden`);
      }
      await page.goto(URL + '#/builder');
      await page.waitForSelector('.builder');
      await page.waitForTimeout(200);
      await overflow('builder');
      await page.goto(URL + '#/strengths');
      await page.waitForSelector('.s-card');
      await overflow('strengths');
      await page.goto(URL + '#/templates');
      await overflow('templates');
      for (const tab of ['Call review', 'Sales flow', 'Offer guides', 'Objections', 'Buying signals']) {
        await page.goto(URL + '#/sales-toolkit');
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(120);
        await overflow('sales toolkit: ' + tab);
      }
      for (const t of ['Technical Support', 'Billing', 'Customer Service', 'Sales & Retention']) {
        await page.goto(URL + '#/call-review');
        await page.getByRole('tab', { name: new RegExp(t) }).click();
        await page.waitForTimeout(120);
        await overflow('call review: ' + t);
      }
      for (const tab of ['Attendance talk', 'Return to work', 'Stay conversation', 'Early warning signs', 'Recognition']) {
        await page.goto(URL + '#/people-toolkit');
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(120);
        await overflow('ABS & Attrition toolkit: ' + tab);
      }
      await page.goto(URL + '#/home');
      await page.waitForSelector('.hero');
      await overflow('home');
      await page.goto(URL + '#/settings');
      await overflow('settings');
      if (vp.width < 1024) {
        await page.click('#menuBtn');
        await page.waitForTimeout(300);
        const sb = await page.locator('#sidebar').boundingBox();
        assert(sb && sb.x >= -1 && sb.width <= vp.width, `${vp.width}px: mobile navigation did not open within the viewport`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert(!(await page.locator('#app').getAttribute('class')).includes('nav-open'), `${vp.width}px: navigation did not close with Escape`);
      }
      await finish(page, context);
    }
  });

  await test('Scenario 9: keyboard navigation, focus, labels, landmarks, reduced motion', async () => {
    const { page, context } = await newPage({ reducedMotion: 'reduce' });
    await page.keyboard.press('/');
    assert(await page.evaluate(() => document.activeElement.id === 'searchInput'), '"/" did not focus search');
    await page.keyboard.type('dead air');
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    assert(await page.evaluate(() => document.activeElement.classList.contains('opp-card__open')), 'Enter did not move focus to the first result');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert(outline !== 'none', 'Focused element has no visible outline');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#panelTitle');
    await page.waitForTimeout(100);
    assert(await page.evaluate(() => document.activeElement.id === 'panelTitle'), 'Focus did not move to the panel title');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.getElementById('panel').contains(document.activeElement)), 'Tab left the panel');
    await page.keyboard.press(']');
    await page.waitForTimeout(150);
    const second = await page.locator('#panelTitle').innerText();
    assert(second !== 'Excessive Dead Air', '"]" did not move to the next opportunity');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert(!(await page.locator('#app').getAttribute('class')).includes('panel-open'), 'Escape did not close the panel');
    assert(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('opp-card__open')), 'Focus did not return to the card after closing');
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], input, select, textarea')]
        .filter((el) => el.getClientRects().length)
        .filter((el) => {
          const name = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim();
          const labelled = el.id && document.querySelector(`label[for="${el.id}"]`);
          return !name && !labelled && !el.getAttribute('aria-labelledby');
        })
        .map((el) => el.outerHTML.slice(0, 80))
    );
    assert(unnamed.length === 0, 'Controls without accessible names: ' + unnamed.join(' | '));
    for (const sel of ['main#main', 'nav', 'aside#sidebar', '[role="search"]', '#panel[role]']) assert(await page.locator(sel).count(), `Missing landmark ${sel}`);
    const dur = await page.locator('.opp-card').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    assert(/^(0s|1e-05s|0\.00001s)/.test(dur), 'Reduced motion not applied, transition-duration ' + dur);
    // Builder keyboard: combobox with arrow keys and Enter
    await page.goto(URL + '#/builder');
    await page.focus('#combo-opps');
    await page.keyboard.type('probing');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    assert((await page.locator('.sel-list').first().locator('li').count()) === 1, 'Keyboard selection in the combobox failed');
    // Contrast of key text pairs (WCAG AA 4.5:1) in light and dark themes
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.goto(URL + '#/all');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const failures = await page.evaluate(() => {
        const parse = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(',').map((x) => parseFloat(x));
          return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const lum = ({ r, g, b }) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const bgOf = (el) => {
          const layers = [];
          let n = el;
          while (n && n.nodeType === 1) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) {
              layers.push(c);
              if (c.a >= 1) break;
            }
            n = n.parentElement;
          }
          let out = { r: 255, g: 255, b: 255 };
          for (let i = layers.length - 1; i >= 0; i--) {
            const l = layers[i];
            out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) };
          }
          return out;
        };
        const sels = ['.page-title', '.page-sub', '.opp-card__title button', '.opp-card__desc', '.tag', '.kpi', '.chip.cat-chip', '.nav__item', '.nav__count', '.filter-chip', '.btn', '.search__input', '.group__title'];
        const bad = [];
        for (const sel of sels) {
          document.querySelectorAll(sel).forEach((el, i) => {
            if (i > 8 || !el.getClientRects().length) return;
            const fg = parse(getComputedStyle(el).color);
            if (!fg) return;
            const bg = bgOf(el);
            const L1 = lum(fg), L2 = lum(bg);
            const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            if (ratio < 4.5) bad.push(`${sel} ${ratio.toFixed(2)}`);
          });
        }
        return [...new Set(bad)];
      });
      assert(failures.length === 0, `Low contrast in ${theme} theme: ${failures.join(', ')}`);
    }
    await finish(page, context);
  });

  await test('Scenario 10: data integrity across all categories and copied text', async () => {
    const expected = { com: 16, dis: 10, hold: 12, own: 14, tech: 15, bill: 12, sales: 14 };
    for (const [cat, n] of Object.entries(expected)) {
      const got = opps.filter((o) => o.cat === cat).length;
      assert(got === n, `Category ${cat} has ${got} entries, expected ${n}`);
      const titles = meta.required[cat].map((r) => r[1]);
      for (const t of titles) assert(opps.some((o) => o.title === t), `Missing required opportunity "${t}"`);
    }
    for (const o of opps) {
      for (const k of ['desc', 'feedback', 'impact', 'plan', 'followup']) assert(o[k] && o[k].length > 40, `${o.id}.${k} missing`);
      assert(o.example.length >= 1 && o.questions.length === 3 && o.strengths.length >= 3, `${o.id} missing example/questions/strengths`);
      const words = o.feedback.split(/\s+/).length;
      assert(words >= 70 && words <= 120, `${o.id} feedback is ${words} words`);
    }
    assert(strengths.length >= 20, 'Fewer than 20 strengths');
    const { page, context } = await newPage();
    // Render every entry's full coaching document inside the app and check it.
    const docs = await page.evaluate(async () => {
      const out = [];
      const cards = [...document.querySelectorAll('.opp-card')].map((c) => c.dataset.id);
      for (const id of cards) {
        location.hash = `#/all?open=${id}`;
        await new Promise((r) => setTimeout(r, 15));
        const btn = document.querySelector('[data-fk="pcopy:full"]');
        out.push({ id, ok: !!btn, title: document.getElementById('panelTitle') && document.getElementById('panelTitle').textContent });
      }
      return out;
    });
    assert(docs.length === OPP_COUNT && docs.every((d) => d.ok), 'Not every entry opened with a Copy Full Coaching button');
    await page.goto(URL + '#/all?open=tech-porting');
    await page.waitForSelector('#panelTitle');
    const full = await clickCopy(page, 'Copy full coaching document');
    assertClean(full, 'Full coaching document');
    for (const head of ['Coaching Focus: Incorrect Mobile Porting Process', 'Things Can Be Better', 'Root Cause & Customer Impact', 'Two-Week SMART Action Plan', 'Supervisor Follow-Up Plan', 'Correct Behavior / Example Statement']) {
      assert(full.includes(head), `Full coaching is missing "${head}"`);
    }
    assert(!full.includes('Things Went Well'), 'Full coaching included strengths although none were selected');
    assert(!full.includes(oppById['tech-porting'].note || '@@'), 'Supervisor note leaked into copied text');
    await finish(page, context);
  });

  await test(`Every entry renders clean copy text (all ${OPP_COUNT} x 7 sections)`, async () => {
    for (const o of opps) {
      assertClean(o.feedback, `${o.id} feedback`);
      assertClean(o.impact, `${o.id} impact`);
      assertClean(fill(o.plan), `${o.id} plan`);
      assertClean(fill(o.followup), `${o.id} followup`);
      o.example.forEach((e, i) => assertClean(e.say, `${o.id} example ${i}`));
      o.questions.forEach((q, i) => assertClean(q, `${o.id} question ${i}`));
    }
    for (const s of strengths) s.v.forEach((v, i) => assertClean(v, `${s.id} v${i}`));
  });

  await test('Clipboard fallbacks: legacy copy and manual-copy dialog', async () => {
    const noApi = () => {
      Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });
    };
    let { page, context } = await newPage({ init: noApi, hash: '#/all?open=com-closing' });
    const legacyBtn = page.getByRole('button', { name: 'Copy Things Can Be Better' });
    await legacyBtn.click();
    await page.waitForFunction((el) => el.innerText.includes('Copied'), await legacyBtn.elementHandle(), { timeout: 3000 }).catch(() => {
      throw new Error('Legacy execCommand copy did not report success');
    });
    await finish(page, context);
    const nothing = () => {
      Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });
      document.execCommand = () => false;
    };
    ({ page, context } = await newPage({ init: nothing, hash: '#/all?open=com-closing' }));
    await page.getByRole('button', { name: 'Copy Things Can Be Better' }).click();
    await page.waitForSelector('.copy-fallback');
    const val = await page.locator('.copy-fallback').inputValue();
    assert(val === oppById['com-closing'].feedback, 'Fallback dialog does not contain the text');
    const selected = await page.evaluate(() => {
      const ta = document.querySelector('.copy-fallback');
      return ta.selectionEnd - ta.selectionStart;
    });
    assert(selected === val.length, 'Fallback text is not pre-selected');
    await page.keyboard.press('Escape');
    await finish(page, context);
  });

  await test('Plan settings render into every plan (21 days, 8 calls, 10-day review)', async () => {
    const { page, context } = await newPage({ hash: '#/settings' });
    await page.selectOption('#settings-duration', '21');
    await page.fill('#settings-calls', '8');
    await page.locator('#settings-calls').press('Enter');
    await page.fill('#settings-followup', '10');
    await page.locator('#settings-followup').press('Enter');
    await page.goto(URL + '#/all?open=hold-no-permission');
    await page.waitForSelector('#panelTitle');
    const heading = await page.locator('#panel .sec__title', { hasText: 'SMART Action Plan' }).innerText();
    assert(heading.includes('Three-Week SMART Action Plan'), 'Plan heading did not follow the duration: ' + heading);
    const plan = await clickCopy(page, /Copy Three-Week SMART Action Plan/);
    assert(/three weeks/.test(plan) && /\beight\b/.test(plan) && /\bten days\b/.test(plan), 'Plan did not render the custom settings: ' + plan);
    assertClean(plan, 'Custom-setting plan');
    await finish(page, context);
  });

  await test('Export and import round trip; malicious import is rendered as text only', async () => {
    const { page, context } = await newPage({ hash: '#/templates' });
    await page.getByRole('button', { name: 'New strength' }).click();
    await page.fill('#st-title', 'Calm Under Pressure');
    await page.fill('#st-v1', 'When the customer raised their voice, you kept a steady, even tone and stayed focused on the next step. That calm approach helps a frustrated customer settle and keeps the conversation productive.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(200);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON' }).click()]);
    const tmp = path.join(os.tmpdir(), 'cip-backup-test.json');
    await download.saveAs(tmp);
    const backup = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    assert(backup.app === 'coaching-intelligence-pro' && backup.data.custom.strengths.length === 1, 'Export file is incomplete');
    // Clear and re-import
    await page.goto(URL + '#/settings');
    await page.getByRole('button', { name: 'Clear all local data' }).click();
    await page.getByRole('button', { name: 'Clear everything' }).click();
    await page.waitForTimeout(200);
    assert((await page.evaluate(() => localStorage.getItem('cip.v1.custom'))) === null, 'Clear all did not remove data');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import backup' }).click()]);
    await chooser.setFiles(tmp);
    await page.getByRole('button', { name: 'Merge into current data' }).click();
    await page.waitForTimeout(200);
    await page.goto(URL + '#/strengths');
    await search(page, 'calm under pressure');
    assert((await page.locator('.s-card__title').allInnerTexts()).includes('Calm Under Pressure'), 'Imported strength not found');
    // Malicious payload
    const evil = {
      app: 'coaching-intelligence-pro',
      format: 1,
      data: {
        __proto__: { polluted: 'yes' },
        custom: {
          opps: [{ id: 'custom-evil-1', title: '<img src=x onerror="window.__pwned=1">Evil', cat: 'com', feedback: '<script>window.__pwned=2</script> text', plan: 'plan {duration}', __proto__: { polluted: 'yes' } }],
          strengths: [],
        },
        overrides: { opps: { __proto__: { polluted: 'yes' }, 'not-a-real-id': { title: 'x', feedback: 'y' } } },
        favorites: ['__proto__', 'custom-evil-1', 'javascript:alert(1)'],
      },
    };
    const evilPath = path.join(os.tmpdir(), 'cip-evil.json');
    fs.writeFileSync(evilPath, JSON.stringify(evil).replace('"__proto__":{"polluted":"yes"},"custom"', '"__proto__":{"polluted":"yes"},"custom"'));
    await page.goto(URL + '#/settings');
    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import backup' }).click()]);
    await chooser2.setFiles(evilPath);
    await page.getByRole('button', { name: 'Merge into current data' }).click();
    await page.waitForTimeout(200);
    await page.goto(URL + '#/all?open=custom-evil-1');
    await page.waitForSelector('#panelTitle');
    const title = await page.locator('#panelTitle').innerText();
    assert(title.includes('<img src=x'), 'Malicious title was not rendered as literal text');
    const pwned = await page.evaluate(() => [window.__pwned, {}.polluted, Object.prototype.polluted]);
    assert(pwned.every((x) => x === undefined), 'Imported content executed code or polluted prototypes');
    assert((await page.locator('#panel img').count()) === 0, 'Imported HTML was rendered as markup');
    await finish(page, context);
  });

  await test('Blocked browser storage: app still works for the session and says so', async () => {
    const block = () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); }, configurable: true });
    };
    const { page, context } = await newPage({ init: block });
    assert((await page.locator('.opp-card').count()) === OPP_COUNT, 'Library did not render with storage blocked');
    assert((await page.locator('.sidebar__status').innerText()).includes('storage unavailable'), 'Storage warning not shown in the sidebar');
    await page.getByRole('button', { name: 'Add Lack of Rapport to favorites' }).click();
    await page.goto(URL + '#/favorites');
    assert((await page.locator('.opp-card__title').allInnerTexts()).includes('Lack of Rapport'), 'In-session favorite did not work without storage');
    await page.goto(URL + '#/builder');
    assert(await page.locator('.banner').isVisible(), 'Builder does not warn that storage is unavailable');
    await finish(page, context);
  });

  await test('Saved combinations and drafts: save, reset, load', async () => {
    const { page, context } = await newPage({ hash: '#/builder' });
    for (const t of ['Excessive Hold Time', 'No Estimated Hold Time']) {
      await page.fill('#combo-opps', t);
      await page.locator('#combo-opps-list [role="option"]', { hasText: t }).first().click();
      await page.waitForTimeout(100);
    }
    await page.getByRole('button', { name: 'Save combination' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(150);
    await page.locator('#note-evidence').fill('The customer was on hold twice for the same detail.');
    await page.waitForTimeout(400);
    assert((await page.locator('#out-challenges').inputValue()).includes('on hold twice for the same detail'), 'Evidence note not added to the challenges section');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.locator('.modal input.input').fill('Hold coaching draft');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Reset builder' }).click();
    await page.getByRole('button', { name: 'Reset builder' }).last().click();
    await page.waitForTimeout(150);
    assert((await page.locator('#out-plan').inputValue()) === '', 'Reset did not clear the builder');
    await page.locator('.saved-item', { hasText: 'Hold coaching draft' }).getByRole('button', { name: 'Load' }).click();
    await page.waitForTimeout(200);
    assert((await page.locator('#note-evidence').inputValue()).includes('on hold twice'), 'Draft did not restore notes');
    await page.locator('.saved-item', { hasText: 'Excessive Hold Time' }).getByRole('button', { name: 'Load' }).click();
    await page.getByRole('button', { name: 'Load combination' }).click();
    await page.waitForTimeout(200);
    assert((await page.locator('.sel-list').first().locator('li').count()) === 2, 'Combination did not restore the two opportunities');
    assert((await page.locator('#note-evidence').inputValue()) === '', 'Loading a combination should start with empty notes');
    await finish(page, context);
  });

  await test('Conflict warning when a strength contradicts a selected opportunity', async () => {
    const { page, context } = await newPage({ hash: '#/all?open=com-missing-empathy' });
    await page.getByRole('button', { name: 'All strengths' }).click();
    await page.locator('.modal input[type="search"]').fill('personalized empathy');
    await page.locator('.modal .s-chip', { hasText: 'Personalized Empathy' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(150);
    assert(await page.locator('#panel .conflict').isVisible(), 'No conflict warning for Personalized Empathy on Missing Empathy');
    const full = await clickCopy(page, 'Copy full coaching document');
    assert(full.includes('Things Went Well') && full.includes(strengthById['s-empathy'].v[0]), 'Selected strength missing from Copy Full Coaching');
    await finish(page, context);
  });

  await test('Editor validation, identifier warnings, customize and restore a built-in entry', async () => {
    const { page, context } = await newPage({ hash: '#/templates' });
    await page.getByRole('button', { name: 'New opportunity' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert(await page.locator('.modal [role="alert"]').isVisible(), 'Missing required fields were not reported');
    await page.fill('#ed-title', 'Test entry');
    await page.fill('#ed-feedback', 'Account 12345678 was discussed. During the call you skipped a step.');
    assert(await page.locator('.modal .pii').first().isVisible(), 'No identifier warning for a long number');
    await page.fill('#ed-plan', 'For the next {weeks}, practice.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert((await page.locator('.modal [role="alert"]').innerText()).includes('Unknown placeholder'), 'Unknown token not rejected');
    await page.getByRole('button', { name: 'Cancel' }).click();
    // Customize a built-in entry, then restore it
    await page.goto(URL + '#/all?open=hold-no-estimate');
    await page.getByRole('button', { name: /Customize the wording of No Estimated Hold Time/ }).click();
    await page.fill('#ed-feedback', 'Custom wording for the estimate coaching that my program prefers to use with agents.');
    await page.getByRole('button', { name: 'Save my version' }).click();
    await page.waitForTimeout(200);
    assert((await page.locator('#panel .sec__body').nth(1).innerText()).includes('Custom wording for the estimate'), 'Customized wording not shown');
    await page.goto(URL + '#/templates');
    await page.getByRole('button', { name: 'Restore original No Estimated Hold Time' }).click();
    await page.getByRole('button', { name: 'Restore original' }).last().click();
    await page.goto(URL + '#/all?open=hold-no-estimate');
    await page.waitForSelector('#panelTitle');
    assert((await page.locator('#panel .sec__body').nth(1).innerText()).includes(oppById['hold-no-estimate'].feedback.slice(0, 40)), 'Original wording not restored');
    await finish(page, context);
  });

  await test('Builder "More" copy options copy unmerged paragraphs', async () => {
    const { page, context } = await newPage({ hash: '#/builder' });
    for (const t of ['Weak Call Opening', 'Weak Call Closing / No Recap']) {
      await page.fill('#combo-opps', t);
      await page.locator('#combo-opps-list [role="option"]', { hasText: t }).first().click();
      await page.waitForTimeout(100);
    }
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Copy each action plan, unmerged' }).click();
    await page.waitForTimeout(200);
    const text = await clipboard(page);
    assert(text === [fill(oppById['com-opening'].plan), fill(oppById['com-closing'].plan)].join('\n\n'), 'Unmerged plans copy is wrong');
    await finish(page, context);
  });

  await test('Sales Toolkit: call review feeds the Builder; every script copies exactly', async () => {
    const { page, context } = await newPage({ hash: '#/sales-toolkit' });
    assert((await page.getByRole('tab').count()) === 5, 'Expected five toolkit tabs');
    const row = (title) => page.locator('.rv-row', { has: page.locator('.rv-row__title', { hasText: new RegExp('^' + title + '$') }) });
    await row('Understand').getByRole('button', { name: 'Met' }).click();
    await row('Probe').getByRole('button', { name: 'Opportunity' }).click();
    await row('Probe').getByLabel('Missing Sales Discovery').check();
    await row('Relevant Offer').getByRole('button', { name: 'Opportunity' }).click();
    await row('Relevant Offer').getByLabel('Missing Relevant Offer').uncheck();
    await row('Relevant Offer').getByLabel('Irrelevant Sales Pitch').check();
    await row('Retention').getByRole('button', { name: 'N/A' }).click();
    const summary = await clickCopy(page, 'Copy review summary');
    for (const line of ['Understand: Met', 'Probe: Opportunity', 'Relevant Offer: Opportunity', 'Retention: Not applicable']) assert(summary.includes(line), 'Review summary missing: ' + line);
    assert(!summary.includes('Assure'), 'Unmarked steps should not appear in the summary');
    await page.reload();
    await page.waitForSelector('.rv-row');
    assert((await row('Probe').getByRole('button', { name: 'Opportunity' }).getAttribute('aria-pressed')) === 'true', 'Review marks did not persist');
    await page.getByRole('button', { name: 'Add opportunities to Builder' }).click();
    await page.getByRole('button', { name: 'Add met steps as strengths' }).click();
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.builder')));
    assert(JSON.stringify(b.opps) === JSON.stringify(['dis-insufficient-probing', 'sales-missing-discovery', 'sales-irrelevant-pitch']), 'Builder got the wrong opportunities: ' + b.opps.join(','));
    assert(b.strengths.length === 1 && b.strengths[0].id === 's-acknowledgement', 'Met steps did not become the right strengths');
    // Keyboard tab switching
    await page.getByRole('tab', { name: 'Call review' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    assert((await page.getByRole('tab', { name: 'Sales flow' }).getAttribute('aria-selected')) === 'true', 'Arrow key did not switch tabs');
    assert(await page.evaluate(() => document.activeElement && document.activeElement.id === 'tk-tab-flow'), 'Focus did not follow the selected tab');
    const say = await clickCopy(page, 'Copy example for Understand');
    assert(say === toolkit.steps[0].say, 'Sales flow example copy mismatch');
    await page.locator('.tk-step', { hasText: 'Explain Pricing' }).getByRole('button', { name: 'Incorrect Sales Pricing / Disclosure' }).click();
    await page.waitForSelector('#panelTitle');
    assert((await page.locator('#panelTitle').innerText()) === 'Incorrect Sales Pricing / Disclosure', 'Coach-with chip opened the wrong entry');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Offer guides' }).click();
    await page.getByRole('button', { name: 'TV packages' }).click();
    const tv = toolkit.offers.find((o) => o.id === 'tv');
    assert((await clickCopy(page, 'Copy bridge line')) === tv.bridge, 'Offer bridge copy mismatch');
    await page.getByRole('tab', { name: 'Objections' }).click();
    const price = toolkit.objections.find((o) => o.id === 'price');
    assert((await clickCopy(page, "Copy response to: It's too expensive.")) === [price.acknowledge, price.clarify, price.respond].join(' '), 'Objection response copy mismatch');
    const noTx = toolkit.objections.find((o) => o.id === 'not-interested');
    assert((await clickCopy(page, "Copy response to: I'm not interested.")) === [noTx.acknowledge, noTx.close].join(' '), 'A clear no should copy only a warm close');
    await page.getByRole('tab', { name: 'Buying signals' }).click();
    assert((await clickCopy(page, 'Copy follow-up for: ' + toolkit.signals[0].signal)) === toolkit.signals[0].next, 'Signal follow-up copy mismatch');
    await finish(page, context);
  });

  await test('Brand colors: custom colors apply, persist, stay readable, and reset', async () => {
    const { page, context } = await newPage({ hash: '#/settings' });
    const setHex = async (id, v) => {
      const input = page.locator(`[data-fk="${id}-hex"]`);
      await input.fill(v);
      await input.press('Enter');
      await page.waitForTimeout(120);
    };
    await setHex('brand-primary', '#C8102E');
    await setHex('brand-sidebar', '#1D1D1B');
    const vars = () => page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { accent: cs.getPropertyValue('--accent').trim(), ink: cs.getPropertyValue('--accent-ink').trim(), text: cs.getPropertyValue('--accent-text').trim(), side: getComputedStyle(document.getElementById('sidebar')).backgroundColor }; });
    let v = await vars();
    assert(v.accent === '#c8102e', 'Primary color not applied: ' + v.accent);
    assert(v.side === 'rgb(29, 29, 27)', 'Navigation color not applied: ' + v.side);
    await page.reload();
    await page.waitForSelector('.card');
    assert(await page.evaluate(() => !!document.getElementById('brand-style')), 'Brand colors were not applied on load');
    assert((await vars()).accent === '#c8102e', 'Brand colors did not persist');
    // A light primary keeps the color but switches button text to dark, and deepens link text.
    await setHex('brand-primary', '#FFD100');
    v = await vars();
    assert(v.accent === '#ffd100' && v.ink === '#0e1726', 'Light primary should use dark button text: ' + JSON.stringify(v));
    assert(v.text !== '#ffd100', 'Link text should be deepened for contrast on white');
    // Contrast of themed elements in light and dark
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(80);
      const low = await page.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const bgOf = (el) => { let n = el; while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a >= 1) return c; n = n.parentElement; } return { r: 255, g: 255, b: 255 }; };
        const bad = [];
        document.querySelectorAll('.btn--primary, .nav__item, .nav__count, .brand__name, .sidebar__status, a.btn, .badge').forEach((el) => {
          if (!el.getClientRects().length) return;
          const fg = parse(getComputedStyle(el).color); const bg = bgOf(el);
          const L1 = lum(fg), L2 = lum(bg); const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          if (r < 4.5) bad.push(el.className + ' ' + r.toFixed(2));
        });
        return bad;
      });
      assert(low.length === 0, `Low contrast with brand colors in ${theme}: ${low.join(', ')}`);
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await page.getByRole('button', { name: 'Reset to default colors' }).click();
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => !document.getElementById('brand-style')), 'Reset did not remove brand colors');
    assert((await vars()).accent === '#0b7a75', 'Reset did not restore the default primary');
    await finish(page, context);
  });

  await test('Quick Links: add, open safely, copy, pin, undo delete, paste rows, back up', async () => {
    const { page, context } = await newPage({ hash: '#/links' });
    assert((await page.locator('.empty__title').innerText()) === 'No links yet', 'The shared copy should start with no links');
    // Add one link without a scheme and one value that is not a web address.
    const add = async (name, url, group, tag) => {
      await page.getByRole('button', { name: 'Add link', exact: true }).first().click();
      await page.fill('#lk-name', name);
      await page.fill('#lk-url', url);
      await page.fill('#lk-group', group);
      await page.fill('#lk-tag', tag);
      await page.locator('.modal').getByRole('button', { name: 'Add link' }).click();
      await page.waitForTimeout(150);
    };
    await add('Repeat dashboard', 'example.com/views/repeats?:iid=1', 'Dashboards', 'AICR');
    await add('Call server', '10.0.0.5', 'Tools', '');
    await add('Bad link', 'javascript:alert(1)', 'Tools', '');
    const open = page.getByRole('link', { name: 'Open Repeat dashboard (new tab)' });
    assert((await open.getAttribute('href')) === 'https://example.com/views/repeats?:iid=1', 'Address without https:// was not completed');
    assert((await open.getAttribute('target')) === '_blank' && (await open.getAttribute('rel')).includes('noopener'), 'Links must open in a new tab without opener access');
    assert((await page.locator('a[href^="javascript"]').count()) === 0, 'A javascript: address became a link');
    assert((await clickCopy(page, 'Copy Call server')) === '10.0.0.5', 'Copy of a non-web value failed');
    await page.getByRole('button', { name: 'Copy link: Repeat dashboard' }).click();
    await page.waitForTimeout(150);
    assert((await clipboard(page)) === 'https://example.com/views/repeats?:iid=1', 'Copy link failed');
    // Pin, then delete and undo.
    await page.getByRole('button', { name: 'Pin Call server' }).click();
    await page.waitForTimeout(150);
    assert((await page.locator('section[aria-labelledby="lk-sec-pinned"] .lk-row__name').allInnerTexts()).join() === 'Call server', 'Pinned section is wrong');
    await page.getByRole('button', { name: 'Delete Bad link' }).click();
    await page.waitForTimeout(150);
    assert((await page.locator('.lk-row__name', { hasText: 'Bad link' }).count()) === 0, 'Delete failed');
    await page.locator('.toast button', { hasText: 'Undo' }).click();
    await page.waitForTimeout(150);
    assert((await page.locator('.lk-row__name', { hasText: 'Bad link' }).count()) === 1, 'Undo failed');
    // Paste rows copied from a spreadsheet: KPI, name, description, link; stray lines are ignored.
    await page.getByRole('button', { name: 'Paste from a spreadsheet' }).click();
    await page.fill('#lk-paste', 'KPI\tDashboard\tDescription\tLink\nQA\tQA scores\tWeekly QA results\thttps://example.org/qa\nPower BI\nNPS\tNPS dashboard\t\t\nWiki\texample.net/wiki');
    await page.fill('#lk-paste-group', 'Pasted');
    await page.getByRole('button', { name: 'Add links' }).click();
    await page.waitForTimeout(200);
    const qa = page.locator('.lk-row', { hasText: 'QA scores' });
    assert((await qa.locator('.kpi').innerText()) === 'QA' && (await qa.locator('.lk-row__note').innerText()) === 'Weekly QA results', 'Pasted columns were mapped wrongly');
    assert((await page.locator('.lk-row', { hasText: 'NPS dashboard' }).getByRole('button', { name: 'Add address' }).count()) === 1, 'A row without a link should ask for its address');
    assert((await page.locator('.lk-row__name', { hasText: 'Power BI' }).count()) === 0, 'A stray line was imported');
    // Filter, persistence, and backup.
    await page.fill('#lkFilter', 'aicr');
    await page.waitForTimeout(100);
    assert((await page.locator('.lk-row__name').allInnerTexts()).join() === 'Repeat dashboard', 'Filter failed');
    await page.reload();
    await page.waitForSelector('.lk-row');
    assert((await page.locator('.lk-row').count()) === 7, 'Links did not persist (expected 6 links plus 1 pinned row)');
    const backup = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.links')));
    assert(backup.items.length === 6, 'Stored link count is wrong');
    await page.goto(URL + '#/settings');
    await page.waitForSelector('.page-title');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export backup/ }).click()]);
    const json = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert(json.data.links && json.data.links.items.length === 6, 'Export backup does not include quick links');
    await finish(page, context);
  });

  await test('Home dashboard: opens by default, KPI tiles filter the library, quick actions navigate', async () => {
    const { page, context } = await newPage({ hash: '' });
    await page.waitForSelector('.hero');
    assert(/Ready to coach\?$/.test(await page.locator('#pageTitle').innerText()), 'Home did not open by default');
    const kpiTiles = await page.locator('.kpi-tile .kpi-tile__label').allInnerTexts();
    assert(kpiTiles.join('|') === meta.kpis.map((k) => k.label).join('|'), 'KPI tiles do not match the KPI list: ' + kpiTiles.join('|'));
    await page.waitForTimeout(1200);
    const absCount = opps.filter((o) => o.kpi.includes('ABS')).length;
    assert((await page.locator('.kpi-tile--abs .kpi-tile__num').innerText()).startsWith(String(absCount)), 'ABS tile count is wrong');
    await page.locator('.kpi-tile--abs').click();
    await page.waitForSelector('.opp-card');
    assert(location(page).endsWith('#/all'), 'KPI tile did not open the library');
    const cards = await page.locator('.opp-card').count();
    assert(cards === absCount, `ABS filter should show ${absCount} entries, showed ${cards}`);
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('cip.v1.prefs')); p.kpi = ''; localStorage.setItem('cip.v1.prefs', JSON.stringify(p)); });
    await page.goto(URL + '#/home');
    await page.getByRole('link', { name: /Start a call review/ }).click();
    await page.waitForSelector('.type-picker');
    assert((await page.locator('#pageTitle').innerText()) === 'Call Review', 'Hero button did not open Call Review');
    await finish(page, context);
  });

  await test('Call Review: every call type reviews, feeds the Builder, and keeps its own marks', async () => {
    const { page, context } = await newPage({ hash: '#/call-review', init: () => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('cip.v1.review', JSON.stringify({ marks: { understand: 'met' }, picks: {} })); } } });
    assert((await page.getByRole('tab').count()) === 4, 'Expected four call types');
    const row = (title) => page.locator('.rv-row', { has: page.locator('.rv-row__title', { hasText: new RegExp('^' + title + '$') }) });
    // Older saved Sales reviews still load.
    await page.getByRole('tab', { name: /Sales & Retention/ }).click();
    assert((await row('Understand').getByRole('button', { name: 'Met' }).getAttribute('aria-pressed')) === 'true', 'A Sales review saved in the old format was lost');
    for (const t of callReviews.types) {
      await page.getByRole('tab', { name: new RegExp(t.label) }).click();
      await page.waitForTimeout(100);
      assert((await page.locator('.rv-row').count()) === t.steps.length + t.skills.length, `${t.label}: wrong number of review rows`);
      for (const it of t.steps.concat(t.skills)) for (const g of it.gaps) assert(oppById[g], `${t.label}/${it.id}: unknown entry ${g}`);
    }
    await page.getByRole('tab', { name: /Technical Support/ }).click();
    const tech = callReviews.types.find((t) => t.id === 'tech');
    await row('Open and acknowledge').getByRole('button', { name: 'Met' }).click();
    await row('Follow the ITG').getByRole('button', { name: 'Opportunity' }).click();
    await row('Own it before you route it').getByRole('button', { name: 'Opportunity' }).click();
    await row('Own it before you route it').getByLabel('Failure to Follow Correct Transfer Process').check();
    const risk = await page.locator('.scorecard__risk').innerText();
    assert(/Repeat \(aiCR\): 2 steps/.test(risk) && /Transfer: 1 step/.test(risk), 'KPI risk summary is wrong: ' + risk);
    assert((await page.locator('.ring__value').innerText()).replace(/\s/g, '') === '3/' + (tech.steps.length + tech.skills.length), 'Progress ring count is wrong');
    const say = tech.steps.find((x) => x.id === 'open').say;
    assert((await clickCopy(page, 'Copy model line for Open and acknowledge')) === say, 'Model line copy mismatch');
    const summary = await clickCopy(page, 'Copy review summary');
    assert(summary.startsWith('Technical Support Call Review') && summary.includes('Follow the ITG: Opportunity'), 'Technical review summary is wrong');
    await page.getByRole('button', { name: 'Add opportunities to Builder' }).click();
    await page.getByRole('button', { name: 'Add met steps as strengths' }).click();
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.builder')));
    assert(JSON.stringify(b.opps) === JSON.stringify(['tech-itg-missing', 'own-unnecessary-transfer', 'own-transfer-process']), 'Builder got the wrong opportunities: ' + b.opps.join(','));
    assert(b.strengths.map((x) => x.id).join() === 's-acknowledgement', 'Met step did not become its strength');
    // Each type keeps its own marks across reloads.
    await page.reload();
    await page.waitForSelector('.rv-row');
    assert((await page.getByRole('tab', { name: /Technical Support/ }).getAttribute('aria-selected')) === 'true', 'Selected call type was not remembered');
    assert((await row('Follow the ITG').getByRole('button', { name: 'Opportunity' }).getAttribute('aria-pressed')) === 'true', 'Technical marks did not persist');
    await page.getByRole('tab', { name: /Billing/ }).click();
    assert((await page.locator('.rv-btn[aria-pressed="true"]').count()) === 0, 'Billing review should start empty');
    // Keyboard switching between call types
    await page.getByRole('tab', { name: /Billing/ }).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    assert((await page.getByRole('tab', { name: /Customer Service/ }).getAttribute('aria-selected')) === 'true', 'Arrow key did not switch call type');
    await finish(page, context);
  });

  await test('ABS & Attrition: entries, schedule-based Builder wording, and the toolkit', async () => {
    const { page, context } = await newPage({ hash: '#/cat/people' });
    const people = opps.filter((o) => o.cat === 'people');
    assert((await page.locator('.opp-card').count()) === people.length, 'ABS & Attrition category is incomplete');
    assert((await page.locator('.promo a', { hasText: 'Open the toolkit' }).count()) === 1, 'Category is missing the toolkit link');
    await search(page, 'late');
    assert((await page.locator('.opp-card__title').first().innerText()) === 'Late Log-Ins', 'Search "late" should find Late Log-Ins first');
    await search(page, 'burnout');
    assert((await page.locator('.opp-card__title').first().innerText()) === 'Stress and Fatigue', 'Search "burnout" should find Stress and Fatigue first');
    await search(page, '');
    // Builder with attendance and engagement entries only: no call language in the plan or follow-up.
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['people-late-login', 'people-break-overrun', 'people-disengagement'], strengths: [{ id: 's-team-support', v: 0 }] })));
    await page.goto(URL + '#/builder');
    await page.reload();
    await page.waitForSelector('.out-sec__text');
    const out = await page.locator('.out-sec__text').evaluateAll((els) => els.map((e) => e.value));
    for (const t of out) assertClean(t, 'people builder');
    assert(!/\bcalls?\b/i.test(out[2]) && !/\bcalls?\b/i.test(out[3]), 'Attendance-only plan or follow-up mentions calls');
    assert(out[2].includes('We will check in together within the next seven days'), 'Attendance plan is missing its check-in measure');
    assert(out[2].includes(fill(oppById['people-late-login'].b.mx)), 'Attendance plan is missing the entry measure');
    assert(out[3].includes('review your schedule adherence and attendance together'), 'Follow-up does not mention the schedule review');
    // Mixed call and attendance coaching keeps both measures.
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['hold-dead-air', 'people-late-login'], strengths: [] })));
    await page.reload();
    await page.waitForSelector('.out-sec__text');
    const mixed = await page.locator('.out-sec__text').evaluateAll((els) => els.map((e) => e.value));
    assert(mixed[2].includes('We will review five applicable calls') && mixed[2].includes(fill(oppById['people-late-login'].b.mx)), 'Mixed plan lost a measure');
    // Toolkit
    await page.goto(URL + '#/people-toolkit');
    await page.waitForSelector('.timeline');
    assert((await page.getByRole('tab').count()) === 5, 'Expected five toolkit tabs');
    const steps = peopleToolkit.attendance.steps;
    assert((await page.locator('.timeline__item').count()) === steps.length, 'Attendance conversation steps missing');
    assert((await clickCopy(page, 'Copy what to say for ' + steps[1].title)) === steps[1].say, 'Attendance line copy mismatch');
    const all = await clickCopy(page, 'Copy the whole attendance conversation');
    assert(all.startsWith('1. ' + steps[0].title) && all.includes(steps[steps.length - 1].say), 'Whole conversation copy is wrong');
    await page.getByRole('tab', { name: 'Stay conversation' }).click();
    const g = peopleToolkit.stay.groups[0];
    assert((await clickCopy(page, 'Copy questions: ' + g.title)) === g.questions.join('\n'), 'Stay questions copy mismatch');
    await page.getByRole('tab', { name: 'Early warning signs' }).click();
    assert((await page.locator('.pk-sign').count()) === peopleToolkit.signs.length, 'Warning signs missing');
    await page.locator('.pk-sign').first().getByRole('button', { name: oppById[peopleToolkit.signs[0].opps[0]].title }).click();
    await page.waitForSelector('#panelTitle');
    assert((await page.locator('#panelTitle').innerText()) === oppById[peopleToolkit.signs[0].opps[0]].title, 'Warning sign chip opened the wrong entry');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Recognition' }).click();
    assert((await clickCopy(page, 'Copy shout-out 1')) === peopleToolkit.recognition.shoutouts[0], 'Shout-out copy mismatch');
    await finish(page, context);
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} test groups passed.`);
  if (!process.env.CIP_ROOT) fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
