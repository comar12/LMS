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
    assert((plan.match(/Call reviews:/g) || []).length === 1, 'Plan should contain exactly one review commitment');
    assert(/^1\. /m.test(plan) && plan.includes('How we will measure success:') && /^\u2022 /m.test(followup), 'Points format should number the actions and bullet the measures and follow-up');
    assert((followup.match(/I review/g) || []).length === 1, 'Follow-up should contain exactly one audit commitment');
    assert(!/\b(three|four|six|seven|eight|nine|ten) (applicable |reviewed )?calls\b/.test(plan + followup), 'Conflicting call counts in plan or follow-up');
    const [d7, d14] = await page.evaluate(() => [7, 14].map((k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); }));
    assert(plan.includes(`Focus until ${d14}:`) && plan.includes(`Call reviews: 5 applicable calls by ${d7}.`), 'Plan does not use the default timeframes as real dates');
    for (const t of pick.map((x) => opps.find((o) => o.title === x))) {
      assert(challenges.includes(t.b.obs), `Challenges missing observation for ${t.title}`);
      assert(plan.toLowerCase().includes(t.b.commit.toLowerCase()), `Plan missing commitment for ${t.title}`);
    }
    assert(!challenges.includes(oppById['hold-dead-air'].feedback), 'Challenges pasted a full feedback paragraph instead of merging');
    // Grammar spot checks
    for (const s of all.replace(/^(\u2022|\d+\.)\s+/gm, '').split(/(?<=[.?!])\s+/)) {
      if (!s.trim()) continue;
      // Points start with a bullet or a number; the sentence after it must still be capitalized.
      assert(/^[A-Z"]/.test(s.trim().replace(/^(\u2022|\d+\.)\s+/, '')), 'Sentence does not start with a capital letter: ' + s.slice(0, 60));
    }
    assert(!/ {2,}|\s[,.]|\.\./.test(all), 'Spacing or punctuation problem in builder text');
    // Tone switch
    await page.getByRole('button', { name: 'Direct' }).click();
    await page.waitForTimeout(150);
    assert(/you are expected to/i.test(await read('plan')), 'Direct tone did not change the plan wording');
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
      for (const v of ['#/today', '#/snapshot', '#/leader', '#/team']) {
        await page.goto(URL + v);
        await page.waitForSelector('#pageTitle');
        await overflow(v);
      }
      await page.goto(URL + '#/huddle');
      await page.locator('.hd-sug').first().click();
      await page.waitForSelector('.hd-agenda');
      await overflow('team huddle');
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
    const { page, context } = await newPage({ hash: '#/call-review', init: () => { if (!localStorage.getItem('test.review-seeded')) { localStorage.setItem('test.review-seeded', '1'); localStorage.setItem('cip.v1.review', JSON.stringify({ marks: { understand: 'met' }, picks: {} })); } } });
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
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ style: 'paragraphs', opps: ['people-late-login', 'people-break-overrun', 'people-disengagement'], strengths: [{ id: 's-team-support', v: 0 }] })));
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
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ style: 'paragraphs', opps: ['hold-dead-air', 'people-late-login'], strengths: [] })));
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

  await test('Follow-Up Tracker: track from the Builder, log results, honest progress text, due dates', async () => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const { page, context } = await newPage({
      hash: '#/builder',
      init: () => { if (!localStorage.getItem('test.tracker-seeded')) { localStorage.setItem('test.tracker-seeded', '1'); localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['dis-insufficient-probing', 'own-unnecessary-transfer', 'people-late-login'], strengths: [] })); } },
    });
    await page.reload();
    await page.waitForSelector('.builder');
    await page.getByRole('button', { name: 'Track this plan' }).click();
    await page.fill('#tr-label', 'Agent 1234567');
    assert((await page.locator('.modal .pii').count()) === 1, 'A long number in the label should show an identifier warning');
    await page.fill('#tr-label', 'Agent 4');
    await page.getByRole('button', { name: 'Start tracking' }).click();
    await page.goto(URL + '#/tracker');
    const card = page.locator('.plan', { hasText: 'Agent 4' });
    await card.waitFor();
    assert(/On track/.test(await card.locator('.due-chip').innerText()), 'A new plan should be on track');
    assert((await card.locator('.ring__value').innerText()).replace(/\s/g, '') === '0/7', 'Targets should be five call reviews plus two weekly check-ins');
    // Log one call review and one check-in.
    await card.getByRole('button', { name: 'Log call review' }).click();
    const rows = page.locator('.tr-logrow');
    assert((await rows.count()) === 2, 'Call review should list only the call behaviors');
    await page.getByRole('button', { name: 'Save call review' }).click();
    assert(!(await page.locator('.modal .field__error').isHidden()), 'Saving without answers should be blocked');
    await rows.nth(0).getByRole('button', { name: 'Met', exact: true }).click();
    await rows.nth(1).getByRole('button', { name: 'Not met' }).click();
    await page.getByRole('button', { name: 'Save call review' }).click();
    await card.getByRole('button', { name: 'Log check-in' }).click();
    assert((await page.locator('.tr-logrow').count()) === 1, 'Check-in should list only the attendance behavior');
    await page.locator('.tr-logrow').first().getByRole('button', { name: 'Met', exact: true }).click();
    await page.getByRole('button', { name: 'Save check-in' }).click();
    assert((await card.locator('.ring__value').innerText()).replace(/\s/g, '') === '2/7', 'Ring did not count the logged follow-ups');
    const start = await page.evaluate(() => new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
    const f = (id) => oppById[id].b.focus;
    const expected = `Since our coaching session on ${start}, I reviewed one of your calls. The expected standard for ${f('dis-insufficient-probing')} was met on the call reviewed. The expected standard for ${f('own-unnecessary-transfer')} was not yet met on the call reviewed. We also held one check-in. The expected standard for ${f('people-late-login')} was met on the check-in.`;
    const progress = await clickCopy(page, 'Copy progress for Agent 4');
    assert(progress === expected, 'Progress text is wrong:\n' + progress + '\nexpected:\n' + expected);
    assertClean(progress, 'tracker progress');
    assert(!progress.includes('Agent 4'), 'The plan label must never appear in coaching text');
    await card.getByRole('button', { name: 'Use in Builder' }).click();
    await page.waitForSelector('.out-sec__text');
    assert((await page.locator('.out-sec__text').first().inputValue()).replace(/\u2022 /g, '').replace(/\n/g, ' ').startsWith(expected), 'Progress did not reach the Builder progress section');
    // An overdue plan shows on the badge and on Home.
    await page.evaluate((st) => {
      const t = JSON.parse(localStorage.getItem('cip.v1.tracker'));
      t.plans.push({ id: 'plan-old', label: 'Agent 9', start: st, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] });
      localStorage.setItem('cip.v1.tracker', JSON.stringify(t));
    }, day(-10));
    await page.goto(URL + '#/tracker');
    await page.reload();
    const old = page.locator('.plan', { hasText: 'Agent 9' });
    await old.waitFor();
    assert(/^Overdue/.test(await old.locator('.due-chip').innerText()), 'A plan past its review date should be overdue');
    assert((await page.locator('.plan').first().locator('.plan__label').innerText()) === 'Agent 9', 'Overdue plans should be listed first');
    assert((await page.locator('a[href="#/tracker"] .nav__badge').getAttribute('aria-label')) === '1 due or overdue', 'Sidebar badge is wrong');
    await page.goto(URL + '#/home');
    assert((await page.locator('.due-strip').innerText()).includes('1 follow-up is due or overdue'), 'Home did not show the due follow-up');
    // Complete, filter, back up.
    await page.goto(URL + '#/tracker');
    await old.getByRole('button', { name: 'Plan' }).click();
    await page.getByRole('button', { name: 'Mark plan complete' }).click();
    assert((await page.locator('.plan', { hasText: 'Agent 9' }).count()) === 0, 'Completed plan should leave the Active list');
    await page.getByRole('button', { name: /Completed \(1\)/ }).click();
    assert((await page.locator('.plan', { hasText: 'Agent 9' }).locator('.due-chip').innerText()) === 'Completed', 'Completed filter is wrong');
    await page.goto(URL + '#/settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export backup/ }).click()]);
    const json = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert(json.data.tracker && json.data.tracker.plans.length === 2, 'Backup does not include follow-up plans');
    await finish(page, context);
  });

  await test('Team Huddle Builder: suggestions from the tracker, timed agenda, copy, present mode, private topics left out', async () => {
    const { page, context } = await newPage({
      hash: '#/huddle',
      init: () => { if (!localStorage.getItem('test.huddle-seeded')) { localStorage.setItem('test.huddle-seeded', '1'); const d = new Date(); d.setDate(d.getDate() - 2); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [{ id: 'plan-h1', label: 'Agent 1', start: day, duration: 14, calls: 5, followup: 7, focus: ['own-confirm-resolution', 'people-no-call-no-show'], logs: [{ id: 'log-h1', kind: 'call', date: day, results: { 'own-confirm-resolution': 'miss' } }, { id: 'log-h2', kind: 'checkin', date: day, results: { 'people-no-call-no-show': 'miss' } }] }] })); } },
    });
    await page.waitForSelector('.hd-sug');
    const sugs = await page.locator('.hd-sug__title').allInnerTexts();
    assert(sugs.join('|') === 'Not Confirming Resolution Before Closing', 'Suggestions should be the missed call behavior only, never a private attendance topic: ' + sugs.join('|'));
    await page.fill('#combo-huddle', 'no-call no-show');
    await page.waitForTimeout(200);
    assert(!(await page.locator('#combo-huddle-list .combo__opt-title').allInnerTexts()).includes('No-Call, No-Show'), 'Private attendance topics must not be offered for a team huddle');
    await page.keyboard.press('Escape');
    await page.locator('.hd-sug').first().click();
    await page.selectOption('#hd-strength', 's-closing');
    await page.waitForSelector('.hd-agenda');
    const o = oppById['own-confirm-resolution'];
    const mins = (await page.locator('.hd-seg__min').allInnerTexts()).map((t) => parseInt(t, 10));
    assert(mins.reduce((a, b) => a + b, 0) === 10, 'A 10-minute huddle should add up to 10 minutes: ' + mins.join(','));
    const plan = await clickCopy(page, 'Copy huddle plan');
    assertClean(plan, 'huddle plan');
    assert(plan.startsWith(`Team Huddle: ${o.title} (10 minutes)`), 'Plan heading is wrong');
    assert(plan.includes(`The goal: ${o.b.commit}.`) && plan.includes(`"${o.example[0].say}"`), 'Plan must come from the library entry');
    assert(plan.includes('Shout-out to the team for strong call closing.'), 'Team win is missing');
    assert(!/  /.test(plan), 'Plan has double spaces');
    const recap = await clickCopy(page, 'Copy team chat recap');
    assertClean(recap, 'huddle recap');
    assert(recap.startsWith(`Huddle recap: ${o.b.focus}.`), 'Recap is wrong');
    await page.getByRole('button', { name: '5 min', exact: true }).click();
    const five = (await page.locator('.hd-seg__min').allInnerTexts()).map((t) => parseInt(t, 10));
    assert(five.reduce((a, b) => a + b, 0) === 5 && (await page.locator('.hd-seg').count()) === 4, '5-minute huddle has the wrong parts');
    // Present mode: arrow keys move between parts, Escape closes.
    await page.getByRole('button', { name: 'Present' }).click();
    await page.waitForSelector('.present__title');
    assert((await page.locator('.present__title').innerText()) === 'Why it matters', 'Present mode should open on the first part');
    await page.keyboard.press('ArrowRight');
    assert((await page.locator('.present__title').innerText()) === 'Team win', 'Arrow key did not advance');
    await page.keyboard.press('Escape');
    assert((await page.locator('.present').count()) === 0, 'Escape did not close present mode');
    await page.getByRole('button', { name: 'Mark as held today' }).click();
    assert((await page.locator('.hd-hist li').count()) === 1, 'Held huddle was not saved');
    await page.reload();
    await page.waitForSelector('.hd-agenda');
    assert((await page.locator('.hd-hero__title').innerText()) === o.title && (await page.locator('.hd-seg').count()) === 4, 'Huddle choices did not persist');
    await finish(page, context);
  });

  await test('My Day: routine counters, weekly items, follow-ups due, and the huddle idea', async () => {
    const { page, context } = await newPage({ hash: '#/today' });
    await page.waitForSelector('.rt-row');
    const titles = await page.locator('.rt-row__title').allInnerTexts();
    assert(titles.join('|') === 'AICR scrubbing|NPS scrubbing|Internal calibration form', 'Default routine is wrong: ' + titles.join('|'));
    const plus = page.getByRole('button', { name: 'One more: AICR scrubbing' });
    for (let i = 0; i < 4; i++) await plus.click();
    const aicr = page.locator('.rt-row', { hasText: 'AICR scrubbing' });
    assert((await aicr.locator('.rt-counter__num').innerText()).replace(/\s/g, '') === '4/4' && /Done today/.test(await aicr.innerText()), 'Counter did not reach the target');
    await page.locator('.rt-row', { hasText: 'NPS scrubbing' }).getByRole('button', { name: 'Mark done' }).click();
    // Add a weekly item and remove one with undo.
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.fill('#rt-title', 'QA audits');
    await page.selectOption('#rt-kind', 'count');
    await page.fill('#rt-target', '3');
    await page.getByRole('button', { name: 'Add to routine' }).click();
    assert((await page.locator('.rt-row', { hasText: 'QA audits' }).locator('.rt-counter__num').innerText()).replace(/\s/g, '') === '0/3', 'New counted item is wrong');
    await page.getByRole('button', { name: 'Remove QA audits' }).click();
    assert((await page.locator('.rt-row', { hasText: 'QA audits' }).count()) === 0, 'Remove failed');
    await page.locator('.toast button', { hasText: 'Undo' }).click();
    assert((await page.locator('.rt-row', { hasText: 'QA audits' }).count()) === 1, 'Undo failed');
    await page.reload();
    await page.waitForSelector('.rt-row');
    assert(/Done today/.test(await page.locator('.rt-row', { hasText: 'AICR scrubbing' }).innerText()), 'Routine progress did not persist');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.today')));
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    assert(stored.progress[today]['rt-aicr'] === 4, 'Progress is not stored under today');
    assert((await page.locator('.day-huddle').count()) === 1, 'Huddle idea is missing');
    await finish(page, context);
  });

  await test('Run the Session: steps follow the Builder text and finish with copy and track', async () => {
    const { page, context } = await newPage({ hash: '#/session' });
    assert((await page.locator('.empty__title').innerText()) === 'Build the coaching first', 'Empty Builder should explain what to do');
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['hold-dead-air', 'com-missing-empathy'], strengths: [{ id: 's-diagnosis', v: 0 }] })));
    await page.reload();
    await page.waitForSelector('.sess-card');
    assert((await page.locator('.sess-step').count()) === 7, 'Expected seven steps');
    await page.getByRole('button', { name: 'Next step' }).click();
    assert((await page.locator('.sess-read').first().innerText()).trim().replace(/^\u2022 /, '') === strengthById['s-diagnosis'].v[0], 'Strength step should show the observed strength');
    await page.getByRole('button', { name: 'Next step' }).click();
    const qs = await page.locator('.sess-card .hd-seg__list li').allInnerTexts();
    assert(qs[0] === oppById['hold-dead-air'].questions[0] && qs[1] === oppById['com-missing-empathy'].questions[0], 'Ask step should use each entry\'s first coaching question');
    await page.locator('.sess-step', { hasText: 'Close with confidence' }).click();
    assert((await page.locator('.sess-finish').count()) === 1 && (await page.getByRole('button', { name: 'Next step' }).count()) === 0, 'Last step should finish the session');
    const all = await clickCopy(page, 'Copy all four coaching sections');
    assert(all.includes('What Progress Has Been Made Since Last Coaching Session?'), 'Copy all is wrong');
    await page.getByRole('button', { name: 'Track this plan' }).click();
    await page.fill('#tr-label', 'Agent 8');
    await page.getByRole('button', { name: 'Start tracking' }).click();
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.tracker')).plans[0].label)) === 'Agent 8', 'Track from the session failed');
    await finish(page, context);
  });

  await test('Weekly Snapshot: counts come only from logged data, with a copyable summary', async () => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const { page, context } = await newPage({ hash: '#/snapshot' });
    assert(/Nothing logged in this period/.test(await page.locator('#main').innerText()), 'Empty snapshot should say nothing was logged');
    await page.evaluate((d) => {
      localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [{ id: 'plan-s1', label: 'Agent 3', start: d.a, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [{ id: 'log-s1', kind: 'call', date: d.a, results: { 'hold-dead-air': 'miss' } }, { id: 'log-s2', kind: 'call', date: d.b, results: { 'hold-dead-air': 'met' } }, { id: 'log-s3', kind: 'call', date: d.old, results: { 'hold-dead-air': 'miss' } }] }] }));
    }, { a: day(-3), b: day(-1), old: day(-20) });
    await page.reload();
    await page.waitForSelector('.snap-row');
    assert((await page.locator('.snap-row__num').first().innerText()) === '1 of 2 met', 'Last 7 days should count only the two recent reviews');
    await page.getByRole('button', { name: 'Last 30 days' }).click();
    assert((await page.locator('.snap-row__num').first().innerText()) === '1 of 3 met', 'Last 30 days should include the older review');
    const text = await clickCopy(page, 'Copy snapshot summary');
    assert(text.includes('Logged: 3 call reviews and 0 check-ins.') && text.includes('Excessive Dead Air: 1 of 3'), 'Summary text is wrong:\n' + text);
    assert(!text.includes('Agent 3'), 'Plan labels must not appear in the summary');
    await finish(page, context);
  });

  await test('Coach the Coach: observation feedback and side-by-side calibration', async () => {
    const leader = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leader.json'), 'utf8'));
    const { page, context } = await newPage({ hash: '#/leader' });
    const row = (t) => page.locator('.rv-row', { has: page.locator('.rv-row__title', { hasText: new RegExp('^' + t + '$') }) });
    await row(leader.observe[0].title).getByRole('button', { name: 'Met', exact: true }).click();
    await row(leader.observe[2].title).getByRole('button', { name: 'Opportunity' }).click();
    const fb = await clickCopy(page, 'Copy feedback for the leader');
    assert(fb === `Coaching Observation\n\nWhat went well\n${leader.observe[0].good}\n\nFocus for your next session\n${leader.observe[2].gap}\n\nNext step\nI will observe another of your coaching sessions so we can look at these points together again.`, 'Observation feedback is wrong:\n' + fb);
    await page.getByRole('tab', { name: 'Calibrate a call' }).click();
    await page.selectOption('#cal-type', 'billing');
    const items = callReviews.types.find((t) => t.id === 'billing').steps;
    const mark = async (who, id, v) => page.locator(`[data-fk="cal:${who}:${id}:${v}"]`).click();
    await mark('a', items[0].id, 'met');
    await mark('b', items[0].id, 'met');
    await mark('a', items[1].id, 'met');
    await mark('b', items[1].id, 'gap');
    assert(/50% agreement on 2 steps/.test(await page.locator('.scorecard__title').innerText()), 'Agreement score is wrong');
    const cal = await clickCopy(page, 'Copy calibration summary');
    assert(cal.startsWith('Calibration: Billing call\nAgreement: 1 of 2') && cal.includes(`${items[1].title}: supervisor Met, team leader Opportunity`), 'Calibration summary is wrong:\n' + cal);
    await finish(page, context);
  });

  await test('Team pack: export shared material only, import merges without touching plans', async () => {
    const { page, context } = await newPage({ hash: '#/settings' });
    await page.evaluate(() => {
      localStorage.setItem('cip.v1.links', JSON.stringify({ items: [{ id: 'link-t1', name: 'Team dashboard', url: 'https://example.com/team', group: 'Daily' }] }));
      localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [{ id: 'plan-t1', label: 'Agent 1', start: '2026-01-05', duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] }] }));
    });
    await page.reload();
    await page.waitForSelector('.page-title');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export team pack' }).click()]);
    const file = await download.path();
    const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(pack.kind === 'team-pack' && pack.data.links.items.length === 1 && pack.data.routines.length === 3, 'Team pack content is wrong');
    assert(!('tracker' in pack.data) && !('builder' in pack.data) && !('drafts' in pack.data), 'Team pack must not include personal plans or drafts');
    // A second leader imports it into a fresh browser.
    const ctx2 = await browser.newContext({ acceptDownloads: true });
    await ctx2.setOffline(true);
    const p2 = await ctx2.newPage();
    await p2.goto(URL + '#/settings');
    await p2.evaluate(() => localStorage.setItem('cip.v1.today', JSON.stringify({ routines: [{ id: 'rt-own', title: 'My own check', kind: 'check' }], progress: {} })));
    await p2.reload();
    await p2.waitForSelector('.page-title');
    const [chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.getByRole('button', { name: 'Import team pack' }).click()]);
    await chooser.setFiles(file);
    await p2.waitForSelector('.modal');
    assert((await p2.locator('.modal').innerText()).includes('1 new quick link'), 'Import summary is wrong');
    await p2.getByRole('button', { name: 'Add team pack' }).click();
    await p2.waitForTimeout(200);
    const links = await p2.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.links')).items.map((l) => l.name));
    const routines = await p2.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.today')).routines.map((r) => r.title));
    assert(links.includes('Team dashboard'), 'Links were not imported');
    assert(routines[0] === 'My own check' && routines.includes('AICR scrubbing'), 'Routine items were not merged');
    assert((await p2.evaluate(() => localStorage.getItem('cip.v1.tracker'))) === null, 'Importing a team pack must not create plans');
    await ctx2.close();
    await finish(page, context);
  });

  await test('Team Pulse: codes only, earned recognition from logged results, balance flags, and prompts', async () => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const { page, context } = await newPage({ hash: '#/team' });
    assert((await page.locator('.empty__title').innerText()) === 'Set up your team', 'Team Pulse should start empty in the shared copy');
    await page.getByRole('button', { name: 'Add team members' }).click();
    await page.fill('#tm-prefix', 'bp-abcdef123');
    assert(/BP-ID/.test(await page.locator('.modal .pii').innerText()), 'A BP-ID in the code should be flagged');
    await page.fill('#tm-prefix', 'Agent');
    await page.fill('#tm-count', '4');
    await page.getByRole('button', { name: 'Add codes' }).click();
    assert((await page.locator('.pulse .plan__label').allInnerTexts()).sort().join() === 'Agent 01,Agent 02,Agent 03,Agent 04', 'Codes were not created');
    // Agent 02 has met results logged; Agent 03 has two coaching plans and no recognition.
    await page.evaluate((d) => localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [
      { id: 'plan-p1', label: 'Agent 02', start: d.a, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air', 'com-missing-empathy'], logs: [{ id: 'log-p1', kind: 'call', date: d.a, results: { 'hold-dead-air': 'miss', 'com-missing-empathy': 'met' } }, { id: 'log-p2', kind: 'call', date: d.b, results: { 'hold-dead-air': 'met', 'com-missing-empathy': 'met' } }] },
      { id: 'plan-p2', label: 'agent 03', start: d.b, duration: 14, calls: 5, followup: 7, focus: ['own-confirm-resolution'], logs: [] },
      { id: 'plan-p3', label: 'Agent 03', start: d.a, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] } ] })), { a: day(-8), b: day(-2) });
    await page.reload();
    await page.waitForSelector('.pulse');
    const card = (code) => page.locator('.pulse', { has: page.locator('.plan__label', { hasText: new RegExp('^' + code + '$') }) });
    assert((await card('Agent 02').locator('.flag').first().innerText()) === 'Earned recognition ready', 'Earned recognition should be flagged');
    assert((await card('Agent 03').locator('.flag').allInnerTexts()).includes('Coached 2 times, recognized 0 in 30 days'), 'Coaching balance flag is missing (codes should match regardless of case)');
    assert((await page.locator('.needs .rt-row__title').first().innerText()) === 'Agent 02', 'Earned recognition should be first in Who needs a touchpoint');
    await card('Agent 02').getByRole('button', { name: /Recognize/ }).click();
    const expected = `You met the expected standard for ${oppById['hold-dead-air'].b.focus} on one of the two calls I reviewed since our coaching session. You met the expected standard for ${oppById['com-missing-empathy'].b.focus} on both calls I reviewed since our coaching session. That is exactly what we worked on together, and it makes a real difference for the customers and the team. Thank you.`;
    assert((await page.locator('#rc-text').inputValue()) === expected, 'Earned recognition text is wrong:\n' + (await page.locator('#rc-text').inputValue()));
    assertClean(expected, 'earned recognition');
    await page.getByRole('radio', { name: 'A strength' }).click();
    await page.selectOption('#rc-strength', 's-empathy');
    assert((await page.locator('#rc-text').inputValue()) === strengthById['s-empathy'].v[0], 'Strength-based message is wrong');
    await page.getByRole('radio', { name: 'Earned results' }).click();
    assert((await clickCopy(page, 'Copy recognition message')) === expected, 'Copied message is wrong');
    await page.getByRole('button', { name: 'Log as recognized' }).click();
    assert((await card('Agent 02').locator('.pulse__facts dd').first().innerText()) === 'today', 'Recognition date did not update');
    assert((await card('Agent 02').locator('.flag', { hasText: 'Earned' }).count()) === 0, 'Earned flag should clear after recognizing');
    const stored = await page.evaluate(() => localStorage.getItem('cip.v1.team'));
    assert(!stored.includes('expected standard'), 'Message text must never be stored');
    await card('Agent 01').getByRole('button', { name: 'Log one-on-one' }).click();
    assert((await card('Agent 01').locator('.pulse__facts dd').nth(1).innerText()) === 'today', 'One-on-one was not logged');
    // Logging a Met in the tracker offers recognition for that agent.
    await page.goto(URL + '#/tracker');
    await page.locator('.plan', { hasText: 'Agent 03' }).first().getByRole('button', { name: 'Log call review' }).click();
    await page.locator('.tr-logrow').first().getByRole('button', { name: 'Met', exact: true }).click();
    await page.getByRole('button', { name: 'Save call review' }).click();
    await page.locator('.toast button', { hasText: 'Recognize it' }).click();
    assert((await page.locator('.mp__opt[aria-checked="true"] .mp__name').innerText()) === 'Agent 03', 'Recognize prompt opened for the wrong agent');
    await page.waitForFunction(() => document.activeElement && document.activeElement.closest('.modal'));
    await page.keyboard.press('Escape');
    await page.locator('.modal').waitFor({ state: 'detached' });
    await page.goto(URL + '#/today');
    assert((await page.locator('section[aria-labelledby="dayRec"] .rt-row__title').first().innerText()) === 'Agent 03', 'My Day should list earned recognition first');
    // Names: kept in this browser, shown everywhere in the app, never in copied coaching text.
    await page.goto(URL + '#/team');
    await card('Agent 03').getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.fill('#tm-name', 'Sam Rivers');
    await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
    assert((await card('Sam Rivers').count()) === 1, 'Name is not shown on the card');
    await card('Sam Rivers').getByRole('button', { name: /Recognize/ }).click();
    assert((await page.locator('#rc-text').inputValue()).startsWith('Hi Sam, on the call I reviewed'), 'Message should greet the agent by first name');
    await page.locator('#rc-greet').uncheck();
    assert((await page.locator('#rc-text').inputValue()).startsWith('On the call I reviewed'), 'Greeting toggle did not work');
    assert((await page.locator('.mp__search').count()) === 0, 'A small team should not need a search box');
    await page.keyboard.press('Escape');
    await page.locator('.modal').waitFor({ state: 'detached' });
    await page.goto(URL + '#/tracker');
    assert((await page.locator('.plan .plan__label').allInnerTexts()).includes('Sam Rivers'), 'Tracker should show the name for a matching code');
    await page.locator('.plan', { hasText: 'Sam Rivers' }).first().getByRole('button', { name: /Copy progress/ }).click();
    await page.waitForTimeout(150);
    assert(!(await clipboard(page)).includes('Sam'), 'Names must never appear in copied coaching text');
    // Team Pulse is in backups but never in a team pack.
    await page.goto(URL + '#/settings');
    const [d1] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export team pack' }).click()]);
    assert(!('team' in JSON.parse(fs.readFileSync(await d1.path(), 'utf8')).data), 'Team pack must not include Team Pulse');
    const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export backup/ }).click()]);
    assert(JSON.parse(fs.readFileSync(await d2.path(), 'utf8')).data.team.members.length === 4, 'Backup should include Team Pulse');
    await finish(page, context);
  });

  await test('Team picker: a full team gets avatars and a search box', async () => {
    const { page, context } = await newPage({ hash: '#/team' });
    await page.evaluate(() => localStorage.setItem('cip.v1.team', JSON.stringify({ members: Array.from({ length: 16 }, (_, i) => ({ id: `mem-${i + 1}`, code: `Agent ${String(i + 1).padStart(2, '0')}`, name: i === 4 ? 'Sam Rivers' : '' })), touches: [] })));
    await page.reload();
    // Team health ring: one segment per agent, and the legend adds up to the team.
    assert((await page.locator('.health__seg').count()) === 16, 'Team health ring should have one segment per agent');
    await page.waitForTimeout(1200);
    assert((await page.locator('.health__n').allInnerTexts()).reduce((n, x) => n + Number(x), 0) === 16, 'Team health legend should add up to the team');
    await page.locator('.pulse').first().getByRole('button', { name: /Recognize/ }).click();
    assert((await page.locator('.mp__opt').count()) === 16, 'All team members should be in the picker');
    await page.fill('.mp__search', 'sam');
    assert((await page.locator('.mp__opt .mp__name').allInnerTexts()).join() === 'Sam Rivers', 'Picker search did not filter by name');
    await page.fill('.mp__search', 'agent 01');
    assert((await page.locator('.mp__opt .mp__name').allInnerTexts()).join() === 'Agent 01', 'Picker search did not filter by code');
    await page.locator('.mp__opt').first().click();
    assert((await page.locator('.mp__opt[aria-checked="true"] .mp__name').innerText()) === 'Agent 01', 'Clicking an agent should select them');
    await page.getByRole('button', { name: 'Log as recognized' }).click();
    assert((await page.locator('.confetti').count()) === 1, 'Logging a recognition should celebrate');
    await page.locator('.confetti').waitFor({ state: 'detached' });
    await page.locator('.pulse', { hasText: 'Agent 01' }).first().getByRole('button', { name: /Recognize/ }).click();
    await page.waitForFunction(() => document.activeElement && document.activeElement.closest('.modal'));
    await page.keyboard.press('Escape');
    await page.locator('.modal').waitFor({ state: 'detached' });
    // Paste a roster (fictional people): header row in any order, tab separated and single spaced.
    await page.getByRole('button', { name: 'Paste roster' }).click();
    await page.fill('#tm-roster', 'Agent Name\tHRID\tBP-ID\nSam Rivers\t900111\tbpxsr11\nLee Park\t900222\tbpxlp22\n\nNew Person 900333 bpxnp33');
    assert((await page.locator('.roster-tbl tbody tr').count()) === 3, 'Roster preview should list 3 people');
    assert((await page.locator('.roster-prev__sum').innerText()).includes('3 people found: 3 update existing cards'), 'Roster preview summary is wrong');
    assert((await page.locator('.roster-tbl tbody tr').nth(0).innerText()).includes('Agent 05'), 'Sam Rivers should match their existing card by name');
    await page.getByRole('button', { name: 'Add to my team' }).click();
    const team = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.team')).members);
    const sam = team.find((m) => m.name === 'Sam Rivers');
    assert(sam && sam.code === 'Agent 05' && sam.hrid === '900111' && sam.bpid === 'bpxsr11', 'Roster IDs were not saved to the matching card');
    assert(team.find((m) => m.name === 'New Person' && m.hrid === '900333' && m.bpid === 'bpxnp33'), 'Single-spaced rows should be read too');
    // IDs show on the card, copy on click, and hide for screen sharing.
    const samCard = page.locator('.pulse', { has: page.getByRole('heading', { name: 'Sam Rivers', exact: true }) });
    await samCard.getByRole('button', { name: 'Copy HRID for Sam Rivers' }).click();
    await page.waitForTimeout(150);
    assert((await clipboard(page)) === '900111', 'HRID was not copied');
    await page.getByRole('button', { name: 'Hide IDs' }).click();
    assert((await page.locator('.id-chip').count()) === 0, 'Hide IDs should hide every ID');
    await page.getByRole('button', { name: 'Show IDs' }).click();
    assert((await page.locator('.id-chip').count()) > 0, 'Show IDs should bring them back');
    // Editing an ID, and a team ID typed into coaching text is flagged.
    await samCard.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    assert((await page.inputValue('#tm-hrid')) === '900111', 'Edit dialog should show the HRID');
    await page.fill('#tm-bpid', 'bpxsr99');
    await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.team')).members.find((m) => m.name === 'Sam Rivers').bpid)) === 'bpxsr99', 'Edited BP-ID was not saved');
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['hold-dead-air'], strengths: [] })));
    await page.goto(URL + '#/builder');
    await page.reload();
    await page.locator('#note-evidence').fill('Great call today, ref bpxsr99');
    assert((await page.locator('.pii').innerText()).includes('an HRID or BP-ID from your team list'), 'A team BP-ID in coaching text should be flagged');
    await page.locator('#note-evidence').fill('Sam handled the hold well');
    assert((await page.locator('.pii').innerText()).includes('a name from your team list'), 'A team name in coaching text should be flagged');
    await finish(page, context);
  });

  await test('Premium dropdowns: every select is replaced, works by mouse, keyboard, and search, and keeps its value', async () => {
    const { page, context } = await newPage({ hash: '#/settings' });
    // Every visible select on the page is behind a styled button.
    assert((await page.locator('select.select').count()) > 0 && (await page.locator('select.select').count()) === (await page.locator('.pick__btn').count()), 'Every select should get a premium dropdown');
    const btn = page.locator('#settings-duration + .pick__btn');
    assert((await btn.getAttribute('aria-haspopup')) === 'listbox', 'Dropdown button should announce a listbox');
    // Mouse: open, pick, and the app sees a normal change.
    await btn.click();
    assert((await page.locator('.pick__pop [role="option"]').count()) === (await page.locator('#settings-duration option').count()), 'All options should be listed');
    assert((await page.locator('.pick__pop [aria-selected="true"]').count()) === 1, 'The current value should be marked');
    await page.locator('.pick__pop [role="option"]', { hasText: '21' }).first().click();
    await page.locator('.pick__pop').waitFor({ state: 'detached' });
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.settings')).duration)) === 21, 'Picking an option should save it');
    assert((await btn.innerText()).includes('21'), 'Button should show the new value');
    // Keyboard: open with Arrow Down, move, choose with Enter; focus returns to the button.
    await btn.focus();
    await page.keyboard.press('ArrowDown');
    await page.locator('.pick__pop').waitFor();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await page.locator('.pick__pop').waitFor({ state: 'detached' });
    const first = await page.locator('#settings-duration option').first().getAttribute('value');
    assert(String(await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.settings')).duration)) === first, 'Keyboard choice was not saved');
    assert(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pick__btn')), 'Focus should return to the dropdown');
    // Programmatic changes (and selectOption) keep the button in sync.
    await page.selectOption('#settings-duration', '21');
    assert((await btn.innerText()).includes('21'), 'Button did not follow the select value');
    // Long lists get search; Escape closes the list but not the dialog around it.
    await page.goto(URL + '#/team');
    await page.evaluate(() => localStorage.setItem('cip.v1.team', JSON.stringify({ members: [{ id: 'mem-1', code: 'Agent 01' }], touches: [] })));
    await page.reload();
    await page.locator('.pulse').first().getByRole('button', { name: /Recognize/ }).click();
    await page.getByRole('radio', { name: 'A strength' }).click();
    await page.locator('#rc-strength + .pick__btn').click();
    await page.locator('.pick__search').fill('empathy');
    const shown = await page.locator('.pick__pop [role="option"]:not([hidden])').allInnerTexts();
    assert(shown.length >= 1 && shown.every((t) => /empath/i.test(t)), 'Search should filter the options: ' + shown.join(' | '));
    await page.keyboard.press('Escape');
    await page.locator('.pick__pop').waitFor({ state: 'detached' });
    assert((await page.locator('.modal').count()) === 1, 'Escape in a dropdown should not close the dialog');
    await page.locator('#rc-strength + .pick__btn').click();
    await page.locator('.pick__search').fill('empathy');
    await page.keyboard.press('Enter');
    assert((await page.locator('#rc-text').inputValue()).length > 20 && (await page.locator('#rc-strength').inputValue()).length > 0, 'Choosing a strength should update the message');
    // Clicking the label lands on the dropdown button.
    await page.locator('label[for="rc-strength"]').click();
    assert(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pick__btn')), 'Label click should focus the dropdown');
    await finish(page, context);
  });

  await test('Practice Lab: scenarios, role-play with timer and lines, scoring, debrief, history, and Builder', async () => {
    const practice = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/practice.json'), 'utf8'));
    const { page, context } = await newPage({ hash: '#/practice' });
    await page.evaluate(() => localStorage.setItem('cip.v1.team', JSON.stringify({ members: [{ id: 'mem-1', code: 'Agent 01' }, { id: 'mem-2', code: 'Agent 02', name: 'Sam Rivers' }], touches: [] })));
    await page.reload();
    assert((await page.locator('.pr-card').count()) === practice.scenarios.length, 'Every scenario should have a card');
    await page.locator('.pr-filter').getByRole('button', { name: 'Billing' }).click();
    assert((await page.locator('.pr-card').count()) === practice.scenarios.filter((x) => x.type === 'billing').length, 'Billing filter is wrong');
    await page.locator('.pr-filter').getByRole('button', { name: 'All' }).click();
    const sc = practice.scenarios.find((x) => x.id === 'pr-tech-repeat');
    await page.getByRole('button', { name: `Start practice: ${sc.title}` }).click();
    // Brief: what to read to the agent, and how to play the customer.
    assert((await page.locator('.pr-quote').innerText()) === sc.brief, 'Brief text is wrong');
    assert((await page.locator('.pr-persona').innerText()).includes(sc.persona.slice(0, 40)), 'Persona missing');
    await page.getByRole('radio', { name: 'One agent' }).click();
    await page.locator('.mp__opt', { hasText: 'Sam Rivers' }).click();
    await page.getByRole('button', { name: 'Start the role-play' }).click();
    // Role-play: the timer runs and lines can be marked as used.
    await page.waitForFunction(() => { const c = document.querySelector('[data-clock="practice"]'); return c && c.textContent !== '0:00'; }, null, { timeout: 4000 }).catch(() => {});
    assert((await page.locator('[data-clock="practice"]').innerText()) !== '0:00', 'Role-play timer did not run');
    assert((await page.locator('.pr-line').count()) === sc.lines.length, 'Customer lines missing');
    await page.locator('[data-fk="pr-said:0"]').click();
    assert((await page.locator('.pr-line').first().getAttribute('class')).includes('is-said'), 'Line was not marked as used');
    assert((await page.locator('.pr-looks li').count()) === sc.rubric.length, 'Listen-for list is wrong');
    await page.getByRole('button', { name: 'End and score' }).click();
    // Score against the Call Review steps.
    assert((await page.locator('.pr-rubric .rv-row').count()) === sc.rubric.length, 'Rubric rows are wrong');
    await page.locator('[data-fk="pr-met:open"]').click();
    await page.locator('[data-fk="pr-gap:history"]').click();
    await page.locator('[data-fk="pr-met:fix"]').click();
    assert((await page.locator('.pr-scorecard__big').innerText()) === '2 met, 1 to practice', 'Score summary is wrong');
    await page.getByRole('button', { name: 'See the debrief' }).click();
    assert((await page.locator('.pr-well').innerText()).includes('Open and acknowledge') && (await page.locator('.pr-more').innerText()).includes('Check history and outages'), 'Debrief lists are wrong');
    assert((await page.locator('.pr-model').count()) === sc.model.length, 'Model lines missing');
    // Copied debrief is plain text with no names.
    const text = await clickCopy(page, 'Copy debrief');
    assert(text.startsWith(`Practice: ${sc.title}`) && text.includes('Practice more\nCheck history and outages') && !text.includes('Sam'), 'Debrief copy is wrong: ' + text);
    // Save to history (once) and send results to the Builder.
    await page.getByRole('button', { name: 'Save to history' }).click();
    assert(await page.getByRole('button', { name: 'Saved to history' }).isDisabled(), 'Save button should lock after saving');
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.practice')).history);
    assert(hist.length === 1 && hist[0].member === 'mem-2' && hist[0].marks.history === 'gap' && hist[0].scenario === sc.id, 'History entry is wrong: ' + JSON.stringify(hist));
    await page.getByRole('button', { name: 'Add to Builder' }).click();
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.builder')));
    assert(b.opps.includes('dis-contact-history') && b.strengths.some((x) => x.id === 's-acknowledgement') && b.strengths.some((x) => x.id === 's-diagnosis'), 'Builder did not get the practice results');
    // The run survives a reload, and the landing page shows the history.
    await page.reload();
    assert((await page.locator('.pr-step.is-current .pr-step__label').innerText()) === 'Debrief', 'Stage was not remembered');
    await page.getByRole('button', { name: 'All scenarios' }).click();
    assert((await page.locator('.pr-recent').innerText()).includes(sc.title) && (await page.locator('.pr-recent').innerText()).includes('Sam Rivers'), 'Recent practice is wrong');
    assert((await page.locator(`.pr-card[data-id="${sc.id}"] .pr-card__badge`).innerText()).includes('Practiced 1x'), 'Practiced badge missing');
    // Surprise me opens a scenario (motion is skipped with reduced motion in other tests).
    await page.getByRole('button', { name: 'Surprise me' }).click();
    await page.locator('.pr-steps').waitFor({ timeout: 4000 });
    await finish(page, context);
  });

  await test('Live Listen: time-stamped taps, notes, shortcuts, and hand-off to Call Review and the Builder', async () => {
    const { page, context } = await newPage({ hash: '#/listen' });
    const tech = callReviews.types.find((t) => t.id === 'tech');
    assert((await page.locator('.ls-pad').count()) === tech.steps.length + tech.skills.length, 'Every review step should have a pad');
    // The first tap starts the timer.
    await page.getByRole('button', { name: 'Good: Open and acknowledge' }).click();
    assert((await page.locator('.ls-live').innerText()).toLowerCase().includes('live'), 'Timer should start on the first tap');
    assert((await page.locator('.nav__item', { hasText: 'Live Listen' }).innerText()).includes('Live'), 'Sidebar should show the call is live');
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: 'Miss: Keep the customer informed' }).click();
    await page.getByRole('button', { name: /^Miss: Keep the customer informed/ }).click();
    assert((await page.locator('.ls-stat--gap strong').innerText()) === '2', 'Miss count is wrong');
    // N adds a note at the current time; K pauses.
    await page.locator('h1').click();
    await page.keyboard.press('n');
    await page.locator('.modal input').fill('long silence while checking the account');
    await page.keyboard.press('Enter');
    assert((await page.locator('.ls-moment').count()) === 4, 'Note was not added');
    await page.keyboard.press('k');
    assert((await page.locator('[data-fk="ls-clock"]').innerText()).includes('Resume'), 'K should pause the timer');
    const marks = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.listen')).marks);
    assert(marks.some((m) => m.item === 'inform' && m.t >= 1), 'Taps should carry the time');
    // Hand-off to Call Review and the Builder.
    await page.getByRole('button', { name: 'Send to Call Review' }).click();
    const rv = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.review')));
    assert(rv.type === 'tech' && rv.byType.tech.marks.open === 'met' && rv.byType.tech.marks.inform === 'gap', 'Call Review did not get the marks');
    await page.getByRole('button', { name: 'Add to Builder' }).click();
    const b = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.builder')));
    assert(b.opps.includes('hold-dead-air') && b.strengths.some((x) => x.id === 's-acknowledgement'), 'Builder did not get the results');
    assert(b.notes.evidence.includes('missed step: Keep the customer informed') && b.notes.evidence.includes('long silence while checking the account'), 'Evidence is wrong: ' + b.notes.evidence);
    const copied = await clickCopy(page, 'Copy moments');
    assert(copied.startsWith('Live Listen: Technical Support call') && copied.includes('Opportunity: Keep the customer informed'), 'Moments copy is wrong');
    // Remove and undo.
    await page.locator('.ls-moment').first().getByRole('button', { name: /Remove moment/ }).click();
    assert((await page.locator('.ls-moment').count()) === 3, 'Remove did not work');
    await page.locator('.toast button', { hasText: 'Undo' }).click();
    assert((await page.locator('.ls-moment').count()) === 4, 'Undo did not restore the moment');
    // A running call survives a reload.
    await page.keyboard.press('k');
    await page.reload();
    await page.waitForTimeout(600);
    assert((await page.locator('.ls-live').innerText()).toLowerCase().includes('live'), 'A running timer should keep running after a reload');
    // Switching call type keeps only notes; New call clears everything.
    await page.locator('.ls-setup').getByRole('button', { name: 'Billing' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Switch call type' }).click();
    assert((await page.locator('.ls-moment').count()) === 1, 'Switching type should keep only notes');
    await page.getByRole('button', { name: 'New call' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Start a new call' }).click();
    assert((await page.locator('.ls-moment').count()) === 0 && (await page.locator('[data-clock="listen"]').innerText()) === '0:00', 'New call should clear the timer and moments');
    await finish(page, context);
  });

  await test('Real numbers: Builder KPI targets in points and paragraphs, tracked plans, updates, and honest progress', async () => {
    const { page, context } = await newPage({ hash: '#/builder' });
    const day = (n) => page.evaluate((k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); }, n);
    await page.evaluate(() => localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['hold-dead-air', 'own-unnecessary-transfer'], strengths: [] })));
    await page.reload();
    await page.waitForSelector('.nums-card');
    // Only the KPIs the chosen behaviors affect are offered; others can be added.
    assert((await page.locator('#num-Transfer-cur').count()) === 1 && (await page.locator('#num-QA-cur').count()) === 1, 'Related KPIs should be offered');
    assert((await page.locator('#num-ABS-cur').count()) === 0, 'Unrelated KPIs should not be offered by default');
    await page.fill('#num-Transfer-cur', '18');
    await page.fill('#num-Transfer-target', '12%');
    await page.fill('#num-QA-cur', 'abc');
    assert((await page.locator('#num-QA-cur').getAttribute('aria-invalid')) === 'true', 'Non-numbers should be flagged');
    await page.fill('#num-QA-cur', '');
    await page.waitForTimeout(400);
    const end = await day(14);
    let plan = await page.locator('#out-plan').inputValue();
    assert(plan.includes(`\u2022 Transfer rate: 18% as of ${await day(0)}, target 12% or lower by ${end}.`), 'Points plan should state the real numbers: ' + plan);
    assert(!plan.includes('QA score'), 'A KPI without numbers must not appear');
    assert((await page.locator('#out-followup').inputValue()).includes('we look at your Transfer rate on the dashboard together'), 'Follow-up should mention the dashboard check');
    // The same numbers in paragraph format.
    await page.locator('.segmented').getByRole('button', { name: 'Paragraphs' }).click();
    plan = await page.locator('#out-plan').inputValue();
    assert(plan.includes(`Your transfer rate is 18% as of ${await day(0)}, and the target is 12% or lower by ${end}.`), 'Paragraph plan should state the real numbers: ' + plan);
    assert(!plan.includes('\u2022'), 'Paragraphs must not have bullets');
    await page.locator('.segmented').getByRole('button', { name: 'Points' }).click();
    // Track the plan: the numbers go with it.
    await page.getByRole('button', { name: 'Track this plan' }).click();
    await page.fill('#tr-label', 'Agent 9');
    await page.getByRole('button', { name: 'Start tracking' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.tracker')).plans[0]);
    assert(stored.kpis.length === 1 && stored.kpis[0].k === 'Transfer' && stored.kpis[0].base === 18 && stored.kpis[0].target === 12, 'Plan did not keep the numbers: ' + JSON.stringify(stored.kpis));
    await page.goto(URL + '#/tracker');
    const card = page.locator('.plan').first();
    assert((await card.locator('.kb__status').innerText()) === 'No update yet', 'No progress should be claimed before an update');
    assert((await clickCopy(page, 'Copy progress for Agent 9').catch(() => '')) === '', 'Progress text must be empty with no logged data');
    // Log the latest number: progress is computed only from it.
    await card.getByRole('button', { name: 'Update numbers' }).click();
    await page.fill('#nd-Transfer-now', '15');
    await page.getByRole('button', { name: 'Save numbers' }).click();
    assert((await card.locator('.kb__status').innerText()) === '50% of the way', 'Progress toward the target is wrong');
    let text = await clickCopy(page, 'Copy progress for Agent 9');
    assert(text === `Your transfer rate was 18% on ${await day(0)} and is 15% as of ${await day(0)}; the target is 12% or lower.`, 'KPI progress text is wrong: ' + text);
    await card.getByRole('button', { name: 'Update numbers' }).click();
    await page.fill('#nd-Transfer-now', '11.5');
    await page.getByRole('button', { name: 'Save numbers' }).click();
    assert((await card.locator('.kb__status').innerText()) === 'Target met', 'Target met was not detected');
    text = await clickCopy(page, 'Copy progress for Agent 9');
    assert(text.endsWith('is 11.5% as of ' + (await day(0)) + ', which meets the target of 12% or lower.'), 'Target met text is wrong: ' + text);
    assert((await card.locator('.hist__what').first().textContent()) === 'Numbers: Transfer rate 11.5%', 'History should show the numbers update: ' + (await card.locator('.hist__what').first().textContent()));
    // Numbers updates are not counted as call reviews or check-ins.
    assert((await card.locator('.ring__value').innerText()).replace(/\s/g, '') === '0/5', 'Numbers updates must not count as follow-ups');
    await finish(page, context);
  });

  await test('Operations Hub link: sales vs the 10% target by HRID, cautions, live updates, and Builder fill', async () => {
    const { page, context } = await newPage({ hash: '#/team' });
    assert((await page.locator('.hub-card').count()) === 0 || (await page.locator('.hub-card').innerText()).includes('Open the Operations Hub'), 'Without dashboard data, only setup help is shown');
    // Fictional data shaped like the Sales Performance and AUX TSX dashboards save it.
    await page.evaluate(async () => {
      const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
      const rows = [];
      for (let i = 0; i < 6; i++) rows.push([d(i), '900111', 'TL', 'OM', 1, 1, 'N', 'N', '', '', 0, 1, 0, [], 'x' + i, -1, '']);
      rows.push([d(1), '900222', 'TL', 'OM', 1, 0, 'N', 'N', '', '', 0, 1, 0, [], 'y1', -1, '']);
      rows.push([d(2), '900222', 'TL', 'OM', 0, 1, 'N', 'N', '', '', 1, 1, 0, [], 'y2', -1, '']);
      localStorage.setItem('tsxDashData', JSON.stringify({ meta: {}, rows, roster: [], tls: [], oms: [] }));
      localStorage.setItem('cip.v1.team', JSON.stringify({ members: [{ id: 'mem-1', code: 'Agent 01', name: 'Sam Rivers', hrid: '900111' }, { id: 'mem-2', code: 'Agent 02', name: 'Lee Park', hrid: '900222' }, { id: 'mem-3', code: 'Agent 03' }], touches: [] }));
      await new Promise((res) => { const r = indexedDB.open('aux-tsx-pulse', 1); r.onupgradeneeded = () => r.result.createObjectStore('datasets'); r.onsuccess = () => { const tx = r.result.transaction('datasets', 'readwrite'); tx.objectStore('datasets').put({ meta: { period_start: d(9), period_end: d(0), source: { kind: 'import', updatedAt: 'a' } }, daily: [], agents: [{ HRID: 900111, calls: 80, tr: 0.08, aht: 640, abs_pct: 0.02 }, { HRID: 900222, calls: 50, tr: 0.15, aht: 720, abs_pct: 0.06 }] }, 'dataset'); tx.oncomplete = () => { r.result.close(); res(); }; }; });
    });
    await page.reload();
    await page.waitForSelector('.hub-table');
    const rowsText = await page.locator('.hub-table tbody tr').allInnerTexts();
    assert(rowsText.length === 2 && rowsText[0].startsWith('Lee Park') && rowsText[0].includes('2%') && rowsText[1].includes('15%'), 'Sales table is wrong: ' + JSON.stringify(rowsText));
    assert((await page.locator('.hub-alert').innerText()).includes('1 agent is below the 10% sales target'), 'Below-target caution is missing');
    const lee = page.locator('.pulse', { has: page.getByRole('heading', { name: 'Lee Park', exact: true }) });
    assert((await lee.locator('.hub-strip').getAttribute('class')).includes('is-below') && (await lee.locator('.pulse__flags').innerText()).includes('below the 10% target'), 'Card caution is missing');
    assert((await page.locator('.pulse', { has: page.getByRole('heading', { name: 'Agent 03', exact: true }) }).locator('.hub-strip').count()) === 0, 'Agents without an HRID show no numbers');
    // Changing the target re-checks everyone.
    await page.fill('#hub-target', '1.5');
    await page.locator('#hub-target').press('Tab');
    assert((await page.locator('.hub-alert').count()) === 0, 'Target change was not applied');
    await page.fill('#hub-target', '10');
    await page.locator('#hub-target').press('Tab');
    // A new tracker file loaded in the hub (another page in the same browser) updates the numbers live.
    const other = await context.newPage();
    await other.goto(URL + '#/home');
    await other.evaluate(() => { const s = JSON.parse(localStorage.getItem('tsxDashData')); const t = new Date().toISOString().slice(0, 10); for (let i = 0; i < 6; i++) s.rows.push([t, '900222', 'TL', 'OM', 1, 0, 'N', 'N', '', '', 0, 1, 0, [], 'n' + i, -1, '']); localStorage.setItem('tsxDashData', JSON.stringify(s)); });
    await other.close();
    await page.waitForFunction(() => !document.querySelector('.hub-alert'), null, { timeout: 4000 }).catch(() => {});
    assert((await page.locator('.hub-alert').count()) === 0 && (await page.locator('.hub-table tbody tr').first().innerText()).includes('14%'), 'Live update did not reach the app');
    // Coach fills the Builder with the real numbers and the 10% target.
    await page.locator('[data-fk="hub-coach:mem-2"]').click();
    await page.waitForSelector('.nums-card');
    const nums = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.builder')).nums);
    assert(nums.Sales.cur === 14 && nums.Sales.target === 10 && nums.Transfer.cur === 15 && nums.ABS.cur === 6, 'Builder numbers are wrong: ' + JSON.stringify(nums));
    await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('cip.v1.builder')); b.opps = ['sales-missing-offer']; localStorage.setItem('cip.v1.builder', JSON.stringify(b)); });
    await page.reload();
    await page.waitForSelector('#out-plan');
    assert((await page.locator('#out-plan').inputValue()).includes('Sales conversion (XM and GSR per call): 14% as of'), 'Plan should state the sales conversion');
    await finish(page, context);
  });

  await test('Personal copy: a new link replaces retired addresses once, and routines follow it', async () => {
    // Build a throwaway personal copy with fictional links.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cip-links-'));
    const linksFile = path.join(dir, 'links.json');
    const out = path.join(dir, 'copy.html');
    fs.writeFileSync(linksFile, JSON.stringify([{ name: 'Scrubbing form', group: 'Daily', url: 'https://example.com/new-form', pinned: true, replaces: ['https://example.com/old-a', 'https://example.com/old-b'] }, { name: 'Dashboard', url: 'https://example.com/dash' }]));
    require('child_process').execFileSync('python3', [path.join(ROOT, 'tools/build.py'), '--links', linksFile, '--out', out], { cwd: ROOT });
    const { page, context } = await newPage({ hash: '#/today' });
    await page.goto('file://' + out + '#/today');
    await page.evaluate(() => {
      localStorage.setItem('cip.v1.links', JSON.stringify({ items: [{ id: 'link-a', name: 'AICR Scrubbing form', url: 'https://example.com/old-a', group: 'Daily', pinned: true }, { id: 'link-b', name: 'NPS Scrubbing form', url: 'https://example.com/old-b/', group: 'Daily' }, { id: 'link-c', name: 'Dashboard', url: 'https://example.com/dash' }] }));
      localStorage.setItem('cip.v1.today', JSON.stringify({ routines: [{ id: 'rt-aicr', title: 'AICR scrubbing', kind: 'check', link: 'AICR Scrubbing' }, { id: 'rt-nps', title: 'NPS scrubbing', kind: 'check', link: 'link-b' }, { id: 'rt-dash', title: 'Dashboard check', kind: 'check', link: 'link-c' }], progress: {} }));
    });
    await page.reload();
    await page.waitForSelector('.rt-row');
    const links = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.links')).items);
    assert(links.length === 2 && links[0].url === 'https://example.com/new-form' && links[0].name === 'Scrubbing form' && links[0].pinned, 'Old links were not replaced: ' + JSON.stringify(links));
    const routines = await page.evaluate(() => JSON.parse(localStorage.getItem('cip.v1.today')).routines);
    assert(routines[0].link === links[0].id && routines[1].link === links[0].id && routines[2].link === 'link-c', 'Routines did not follow the new link: ' + JSON.stringify(routines));
    assert((await page.getByRole('link', { name: 'Open Scrubbing form (new tab)' }).count()) === 2, 'Both scrubbing routines should open the new form');
    await finish(page, context);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('My Day: end-of-day summary in the manager\'s WhatsApp format, with fill from app, extra lines, and tomorrow', async () => {
    const { page, context } = await newPage({ hash: '#/today' });
    await page.waitForSelector('#eod');
    const type = async (id, v) => { await page.fill(id, v); };
    await page.locator('[data-fk="eod-shared-ans-Yes"]').click();
    await type('#eod-alerts-closed', '5'); await type('#eod-alerts-total', '6'); await type('#eod-alerts-owner', 'Sara');
    await type('#eod-detractors-pct', '90'); await type('#eod-detractors-left', '2');
    await type('#eod-abs-mtd', '9%'); await type('#eod-abs-today', '2');
    await type('#eod-participation-mtd', '40');
    await type('#eod-gsr-rate', '3'); await type('#eod-gsr-today', '7');
    await type('#eod-ztps-pct', '100');
    await type('#eod-breaks-pct', '85'); await type('#eod-breaks-note', 'Pending HR Actions ( EXP )');
    await type('#eod-coaching-n', '3'); await page.locator('[data-fk="eod-coaching-st-Done"]').click();
    await type('#eod-scrub-aicr', '2'); await type('#eod-scrub-ob', '1'); await page.locator('[data-fk="eod-scrub-st-Done"]').click();
    await page.locator('[data-fk="eod-attendance-st-Updated"]').click();
    await page.locator('[data-fk="eod-integrity-st-Done"]').click();
    const head = await page.evaluate(() => { const d = new Date(); return `EOD Summary | ${d.toLocaleDateString('en-US', { weekday: 'long' })} | ${String(d.getDate()).padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`; });
    const B = '\u30FB';
    const expected = [head, '', 'Performance shared on WhatsApp : Yes', 'Closed Alerts : 5 closed out of 6 > Pending 1 Sara will close it', 'Detractors attainment : 90% 2 Detractors left', 'ABS Performance : 9% MTD Vs 2% Today', 'Sales Participation : 40% MTD', 'GSR : 3% Vs 7 GSR Submitted for today', 'QA ZTPS Action VS Incident : 100%', 'Action Vs Incident Breaks & Lateness : 85% - Pending HR Actions ( EXP )', '3 Coaching sessions : Done', '2 aICR & 1 Outbound : Done', 'Expected Attendance : Updated', 'Integrity Report : Done'].map((l, i) => (i < 2 ? l : B + l)).join('\n');
    assert((await page.locator('.eod-bubble__text').innerText()) === expected, 'Preview does not match the format:\n' + (await page.locator('.eod-bubble__text').innerText()));
    assert((await clickCopy(page, 'Copy end-of-day summary')) === expected, 'Copied summary is wrong');
    assert(decodeURIComponent((await page.locator('[data-fk="eod-wa"]').getAttribute('href')).replace('https://wa.me/?text=', '')) === expected, 'WhatsApp link does not carry the summary');
    // Lines can be switched off, extra lines added, and tomorrow's plan follows.
    await page.locator('[data-fk="eod-inc-ztps"]').uncheck();
    assert(!(await page.locator('.eod-bubble__text').innerText()).includes('ZTPS'), 'Switched-off line still shows');
    await page.getByRole('button', { name: 'Add a line' }).click();
    await page.locator('.modal input').fill('Floor walk');
    await page.keyboard.press('Enter');
    await page.locator('.eod-custom__row input').nth(1).fill('Done twice');
    await page.fill('#eod-tomorrow', 'Close the last alert\nCalibration with QA');
    await page.waitForTimeout(400);
    const t2 = await page.locator('.eod-bubble__text').innerText();
    assert(t2.includes(B + 'Floor walk : Done twice') && t2.endsWith(['', 'Tomorrow:', B + 'Close the last alert', B + 'Calibration with QA'].join('\n')), 'Extra line or tomorrow is wrong:\n' + t2);
    // Values survive a reload today; the setup is kept.
    await page.reload();
    await page.waitForSelector('#eod');
    assert((await page.inputValue('#eod-alerts-closed')) === '5' && !(await page.locator('[data-fk="eod-inc-ztps"]').isChecked()), 'Summary was not kept');
    // Fill from app: coaching plans started today and the AICR routine count.
    await page.evaluate(() => {
      const d = new Date().toISOString().slice(0, 10);
      localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [{ id: 'plan-1', label: 'Agent 1', start: d, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] }, { id: 'plan-2', label: 'Agent 2', start: d, duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] }] }));
      const t = JSON.parse(localStorage.getItem('cip.v1.today') || '{}');
      const key = new Date(); const k = `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}`;
      localStorage.setItem('cip.v1.today', JSON.stringify({ ...t, progress: { [k]: { 'rt-aicr': 4 } } }));
    });
    await page.reload();
    await page.waitForSelector('#eod');
    await page.getByRole('button', { name: 'Fill from app' }).click();
    assert((await page.inputValue('#eod-coaching-n')) === '2' && (await page.inputValue('#eod-scrub-aicr')) === '4', 'Fill from app did not use the tracker and routine');
    // Values reset on a new day; switched-off lines and extra line names stay.
    await page.evaluate(() => { const e = JSON.parse(localStorage.getItem('cip.v1.eod')); e.day = '2020-01-01'; localStorage.setItem('cip.v1.eod', JSON.stringify(e)); });
    await page.reload();
    await page.waitForSelector('#eod');
    assert((await page.inputValue('#eod-alerts-closed')) === '' && !(await page.locator('[data-fk="eod-inc-ztps"]').isChecked()) && (await page.locator('.eod-custom__row input').first().inputValue()) === 'Floor walk', 'New day should reset values but keep the setup');
    await finish(page, context);
  });

  await test('No page shows stray "null" or "undefined" text, empty or full', async () => {
    const { page, context } = await newPage({ hash: '#/home' });
    const views = ['#/home', '#/all', '#/cat/people', '#/call-review', '#/people-toolkit', '#/sales-toolkit', '#/strengths', '#/favorites', '#/builder', '#/tracker', '#/huddle', '#/today', '#/session', '#/snapshot', '#/leader', '#/team', '#/practice', '#/listen', '#/links', '#/templates', '#/settings'];
    const sweep = async (label) => {
      for (const v of views) {
        await page.goto(URL + v);
        await page.waitForSelector('#pageTitle');
        const bad = await page.evaluate(() => /(^|\s)(null|undefined|NaN)(\s|$)/.test(document.getElementById('main').innerText));
        assert(!bad, `${label} ${v}: page shows null, undefined, or NaN`);
      }
    };
    await sweep('empty');
    await page.evaluate(() => {
      localStorage.setItem('cip.v1.links', JSON.stringify({ items: [{ id: 'link-a1', name: 'Dashboard', url: 'example.com', group: 'Daily', pinned: true }] }));
      localStorage.setItem('cip.v1.tracker', JSON.stringify({ plans: [{ id: 'plan-a1', label: 'Agent 1', start: '2026-01-05', duration: 14, calls: 5, followup: 7, focus: ['hold-dead-air'], logs: [] }] }));
      localStorage.setItem('cip.v1.builder', JSON.stringify({ opps: ['hold-dead-air'], strengths: [] }));
      localStorage.setItem('cip.v1.huddle', JSON.stringify({ opp: 'hold-dead-air', strength: 's-empathy', minutes: 10, history: [{ date: '2026-01-05', opp: 'hold-dead-air', minutes: 10 }] }));
      localStorage.setItem('cip.v1.team', JSON.stringify({ members: [{ id: 'mem-a1', code: 'Agent 01' }], touches: [] }));
    });
    await page.reload();
    await sweep('with data');
    await finish(page, context);
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} test groups passed.`);
  if (!process.env.CIP_ROOT) fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
