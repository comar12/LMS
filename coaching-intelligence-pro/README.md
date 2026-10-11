# Coaching Intelligence Pro — VXI

A self-contained, offline coaching reference library and coaching builder for contact center supervisors.

**To use it, you only need one file: [`VXI_Coaching_Intelligence_Pro.html`](VXI_Coaching_Intelligence_Pro.html).**
Download it and double-click it. It opens in any modern browser (Chrome, Edge, Firefox, Safari). It needs no
internet connection, sign-in, server, or installation.

## What it does

- **93 coaching opportunities** across 7 categories (Communication, Discovery, Hold & Mute, Ownership,
  Technical Support, Billing, Sales). Each one has seven sections: Things Went Well (optional strengths),
  Things Can Be Better, Root Cause & Customer Impact, a SMART Action Plan, a Supervisor Follow-Up Plan, an
  example statement, and three coaching questions.
- **38 "Things Went Well" strengths**, each with two or three wordings. A strength only appears in copied text
  when you mark it as observed.
- **Copy buttons on every section** plus **Copy Full Coaching**. Copied text is plain text with no formatting
  marks, ready to paste into a coaching form.
- **Coaching Builder**: pick several opportunities and observed strengths and it writes one cohesive entry with
  the four fields of the coaching form, a single consolidated SMART plan, and one follow-up plan. Choose plan
  length, number of calls to review, first review date, and tone (Supportive, Balanced, Direct). Every
  section can be edited before copying, and edits are kept.
- **Search** by behavior names, synonyms, and shorthand ("dead air", "silent", "sleepy tone", "customer angry").
- **KPI links** on each opportunity: QA, Repeat (aiCR), and Transfer, with a filter.
- **Favorites, custom entries, customized wording, saved combinations, and drafts**, stored in the browser.
- **Export / Import** of everything as a JSON backup.
- Reference cards for **Hold vs. Mute vs. Dead Air vs. Research Time** and the **sales conversation flow**, plus a
  Quick Guide for new team leaders.

## Privacy and storage

- The page never connects to the internet. A Content Security Policy blocks all network access, and there is
  no tracking or analytics.
- Your favorites, templates, drafts, and settings are saved in this browser's local storage. That storage
  belongs to this browser and profile only. It is not shared with other browsers or computers, it is not
  available in private windows, and clearing browser data deletes it. Use **Settings & Data → Export backup**
  regularly.
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
tools/
  CONTENT_GUIDE.md     writing standard for coaching content
  validate_content.py  content validator (schema, word counts, tone, privacy rules)
  build.py             builds VXI_Coaching_Intelligence_Pro.html
tests/
  e2e.cjs              browser tests (Playwright + Chromium)
```

```
python3 tools/validate_content.py          # check all content
python3 tools/build.py --check             # build the single HTML file and syntax-check the JavaScript
NODE_PATH=$(npm root -g) node tests/e2e.cjs   # run the browser tests against the built file
```
