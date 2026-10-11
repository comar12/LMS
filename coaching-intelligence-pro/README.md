# Coaching Intelligence Pro — VXI

A self-contained, offline coaching reference library and coaching builder for contact center supervisors.

**To use it, you only need one file: [`VXI_Coaching_Intelligence_Pro.html`](VXI_Coaching_Intelligence_Pro.html).**
Download it and double-click it. It opens in any modern browser (Chrome, Edge, Firefox, Safari). It needs no
internet connection, sign-in, server, or installation.

To see it working first, watch the one-minute walkthrough: [`docs-walkthrough.mp4`](docs-walkthrough.mp4).

## What it does

- **Home dashboard** with a quick start, coach-by-KPI tiles (QA, Repeat (aiCR), Transfer, ABS, Attrition), quick
  actions, and pinned links. Pages and cards animate in smoothly; animation turns off automatically when the
  computer asks for reduced motion.
- **107 coaching opportunities** across 8 categories (Communication, Discovery, Hold & Mute, Ownership,
  Technical Support, Billing, Sales, and ABS & Attrition). Each one has seven sections: Things Went Well (optional strengths),
  Things Can Be Better, Root Cause & Customer Impact, a SMART Action Plan, a Supervisor Follow-Up Plan, an
  example statement, and three coaching questions.
- **46 "Things Went Well" strengths**, each with two or three wordings. A strength only appears in copied text
  when you mark it as observed.
- **Copy buttons on every section** plus **Copy Full Coaching**. Copied text is plain text with no formatting
  marks, ready to paste into a coaching form.
- **Coaching Builder**: pick several opportunities and observed strengths and it writes one cohesive entry with
  the four fields of the coaching form, a single consolidated SMART plan, and one follow-up plan. Choose plan
  length, number of calls to review, first review date, and tone (Supportive, Balanced, Direct). Every
  section can be edited before copying, and edits are kept.
- **Search** by behavior names, synonyms, and shorthand ("dead air", "silent", "sleepy tone", "customer angry").
- **KPI links** on each opportunity: QA, Repeat (aiCR), Transfer, ABS, and Attrition, with a filter.
- **Call Review** for Technical Support, Billing, Customer Service, and Sales & Retention calls. Mark each step as
  Met, Opportunity, or N/A while you listen; a progress ring and a KPI risk summary show where repeat-contact
  (aiCR) and transfer risk came from. Opportunities go to the Coaching Builder and met steps become observed
  strengths. Each call type keeps its own review.
- **Follow-Up Tracker**: choose **Track this plan** in the Coaching Builder, label the plan with a code (never a
  name), and the tracker shows when the promised call reviews and weekly check-ins are due or overdue. Log each
  reviewed call or check-in as Met, Not met, or N/A per behavior. **Copy progress** and **Use in Builder** write
  the "What progress has been made" section only from what you logged, so progress is never assumed. Labels and
  notes are never copied into coaching text.
- **Team Huddle Builder**: pick one behavior (it suggests the ones most often logged as Not met in the tracker),
  choose 5, 10, or 15 minutes, and optionally open with a team win. It builds a timed agenda from the library
  entry (why it matters, what good sounds like, discussion questions, practice in pairs, one commitment), with
  **Copy plan**, **Copy team chat recap**, and a full-screen **Present** mode with a timer. Individual attendance
  and wellbeing topics are never offered for a team huddle.
- **ABS & Attrition**: 14 coaching entries on attendance, punctuality, schedule adherence, engagement, stress,
  confidence, growth, and team connection, plus a toolkit for new team leaders: a step-by-step attendance
  conversation, return-to-work lines, stay conversation questions, early warning signs, and recognition ideas
  with ready-to-send shout-outs. These entries never ask for the reason behind an absence or for private
  details, and the Builder measures them by shifts and check-ins instead of calls.
- **Favorites, custom entries, customized wording, saved combinations, and drafts**, stored in the browser.
- **Export / Import** of everything as a JSON backup.
- **Sales Toolkit** for sales and retention calls:
  - **Call review**: mark each of the ten sales flow steps and five sales skills as Met, Opportunity, or N/A
    while you listen. Send the opportunities to the Coaching Builder and the met steps as observed strengths.
  - **Sales flow** with model language for each step (Understand → Empathize → Assure → Probe → Resolve →
    Confirm → Plant the Seed → Relevant Offer → Explain Pricing → Confirm Understanding).
  - **Offer guides** for Xfinity Mobile, upgrades, TV packages, and retention, plus **objection handling** and
    **buying signals**.
  - A payment link or payment assistance is never treated as a sales offer, and offers, eligibility, and pricing
    always come from approved resources.
- **Brand colors** (Settings & Data): set the primary and navigation colors from the official brand guide, or
  use **Pick from screen** to take them from the logo. Text colors adjust automatically so everything keeps
  WCAG AA contrast in light and dark mode. The built-in teal and navy are placeholders, not official VXI
  brand values.
- **Quick Links**: the dashboards, tools, and forms you open every day, grouped and searchable, with Open, Copy,
  and Pin. Paste rows straight from a spreadsheet, and anything that is not a web address (such as a server
  address) gets a Copy button instead of a link. Links open in a new tab; the app itself still makes no network
  requests. The shared copy starts empty, so internal addresses never end up in this repository.
- Reference cards for **Hold vs. Mute vs. Dead Air vs. Research Time** and the **sales conversation flow**, plus a
  Quick Guide for new team leaders.

## Privacy and storage

- The page never connects to the internet. A Content Security Policy blocks all network access, and there is
  no tracking or analytics.
- Your favorites, templates, drafts, follow-up plans, brand colors, and settings are saved in this browser's
  local storage. That storage belongs to this browser and profile only. It is not shared with other browsers or computers, it
  is not available in private windows, and clearing browser data deletes it. Use **Settings & Data → Export
  backup** regularly.
- Never type agent or customer names, BPIDs, HRIDs, Avaya IDs, account numbers, or interaction IDs into the
  app. Text fields warn you when something looks like an identifier.

## Content principles

All built-in text is written directly to the agent in a supportive, specific voice, follows
observed behavior → why it matters → customer impact → expected behavior, and never claims progress or results.
Coaching text describes best practice and does not invent Comcast/Xfinity procedures; each entry that depends on
an internal process has a supervisor note (never copied) saying what to confirm before the session.

## For maintainers

The HTML file is generated. To change the content or the app:

```
src/
  template.html        page shell and icon sprite
  styles.css           all styles (light and dark themes, responsive, reduced motion)
  js/*.js              application modules, concatenated in file-name order
  data/meta.json       categories, themes, strength catalog, required entries, KPI list
  data/*.json          coaching content (one file per category) and strengths.json
  data/guides.json     reference cards and quick guide
  data/sales_toolkit.json  Sales Toolkit: review steps and skills, offer guides, objections, buying signals
  data/call_reviews.json   Call Review checklists for Technical Support, Billing, and Customer Service
  data/people_toolkit.json ABS & Attrition Toolkit: conversations, stay questions, warning signs, recognition
tools/
  CONTENT_GUIDE.md     writing standard for coaching content
  validate_content.py  content validator (schema, word counts, tone, privacy rules)
  build.py             builds VXI_Coaching_Intelligence_Pro.html
tests/
  e2e.cjs              browser tests (Playwright + Chromium): the ten QA scenarios plus copy, storage,
                       import, Builder, Home, Call Review, ABS & Attrition, Follow-Up Tracker, Team Huddle,
                       Sales Toolkit, Quick Links, and brand color checks
```

```
python3 tools/validate_content.py --strict # check all content (warnings count as errors)
python3 tools/build.py --check             # build the single HTML file and syntax-check the JavaScript
python3 tools/build.py --links my-links.json --out My_Copy.html
                                           # personal copy with Quick Links preloaded (both files are git-ignored)
NODE_PATH=$(npm root -g) node tests/e2e.cjs   # run the browser tests against the built file
```
