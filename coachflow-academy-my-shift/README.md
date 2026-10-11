# My Shift, its team board, the simplified gate and Academy-wide motion

Files that sit next to the Academy's own `academy.js` / `academy.css` bundle
on Vercel (project `coachflow-academy-tsx-test`). Nothing in the Academy
bundle is modified; the extra scripts add three routes and one motion layer:

- `#/academy/sales-integrity-gate` — the simplified four-tick Sales Integrity
  Gate (`gate-simple.js`, `gate-simple.css`, `gate-data.js`).
- `#/academy/my-shift` — the shift timer and call log (`my-shift.js`,
  `my-shift.css`, `my-shift-concerns.js`). "My Shift" is a working name.
- `#/academy/my-shift/team-board` — the team board for leaders, a second tab
  of the same station (same files).
- Every station — the same motion My Shift has (`motion.js`, `motion.css`).

`index.html` and `vercel.json` are the deployed versions that load these
files after the Academy bundle. `my-shift-standalone.html` is a single-file
offline copy of the My Shift page and its team board with the Academy's
header, footer, navigation sheet and stylesheet inlined, for review without a
server; its practice links open the live preview in a new tab.

## The call log

Every call records: account number, call type (Internet, TV, Mobile,
Billing, Outage, Other), issue resolved (Resolved, Not resolved, Escalated or
Transferred, with a reason), customer satisfied, GSR offered →
result → which GSR or why declined (or why not offered), XM offered → result
→ why declined (or why not offered), and a short note. Reasons:

- Not offered: Account not eligible, Account restriction, Customer upset,
  Unauthorized caller, No opening, Already has it, Other.
- GSR declined / follow-up: Price, Not interested, Needs to think, Partner
  decides, Contract, Already at top tier, Other.
- XM declined / follow-up: Price, Not interested, Coverage, Contract, Needs
  to think, Partner decides, Happy with current carrier, Credit check, Other.
- Transferred: Wrong queue, Billing, Mobile, Advanced repair, Security team,
  Retention / cancel, Sales, Other.

Calls are stored only in the agent's browser (`localStorage`, key
`coachflow.myshift.v1`). The page offers a one-line end-of-shift summary and
a CSV download; nothing is sent anywhere.

### Repeat callers, transfers, practice and faster logging

- **Repeat callers.** When the account number typed has been logged before,
  a note under it shows what happened last time (when, call type, outcome,
  GSR and XM, the note). Within 7 days it is marked as a repeat caller, with
  a tip and a link to the Scenario Lab's repeat-contact practice call. A
  transfer that comes back within 30 minutes counts as the same contact.
  Repeats are tagged in the table and counted in the rail and the summary.
- **Transfers.** "Transferred" is a fourth answer to "Issue resolved?" and
  needs a reason. Transfers are counted in the rail and the summary.
- **Practice links.** Each reason the Academy already practises links to it:
  Price → "It's too much for what we'd use"; Happy with current carrier →
  "Happy where I am"; Coverage → "Where it needs to work"; Credit check →
  "Three tries at the check"; Contract → "Their internet, our TV"; Needs to
  think → "A call later to finish the order"; Partner decides → "Not the one
  who can add it"; Not interested → "Loves the package" (GSR) or "I only
  called about the internet" (XM); No opening → "After the repair, before the
  offer"; transfers to Billing, Mobile and Advanced repair → their Scenario Lab
  calls; Security team → the password-reset lesson. The end of the shift
  names the one to practise next, from the reason that came up most.
- **Faster logging.** "Same as last call" fills every answer except the
  account and note; keys 1–6 pick the call type; Enter in the account or note
  box logs the call (Ctrl+Enter from anywhere); the cursor goes back to the
  account box afterwards.

### Who is logging

The top of My Shift asks once for the agent's name and HR ID (numbers only)
and remembers them on that computer. Every call is stamped with the HR ID; if
someone else uses the computer, "Not you? Change" switches agent, ends the
previous agent's running shift, and each agent's list, summary and file hold
only their own calls. Download CSV asks for the name and HR ID first if they
are missing.

The CSV adds `transfer_reason`, `repeat_7d`, `agent`, `hr_id`, `call_id` and
`warmup` columns, and the file is named `my-shift-<name>-<hr id>-<date>.csv`.

### Warm-up, goals, "Customer said" and My week

- **5-minute warm-up.** Before the shift, a card names one Scenario Lab call
  to practise: the one for the reason that came up most on the agent's last
  working day, or the every-call practice when nothing stood out. "Mark as
  done" or "Skip today"; a done warm-up goes into the summary and the CSV.
- **Personal goals.** The agent sets their own goals for the day: GSR offer
  rate, XM offer rate and sales (GSR + XM). Each shows a meter with the goal
  marked and how many more calls with an offer, or more sales, reach it. Goals
  are kept per HR ID and carry over to the next day.
- **"Customer said".** A button in "Log this call" opens the Academy's 16
  customer concerns (`my-shift-concerns.js`, copied from `academy.js`). A few
  words find one; its card gives what to find out, what to ask, what to do
  if there is a real need, what has to happen before anything is agreed, when
  to stop and what not to say, with the Scenario Lab call that practises it.
  Concerns for the call type picked come first. Nothing here is logged.
- **My week.** The agent's own last 7 days against the 7 before: calls, GSR
  and XM offer rates, sales, resolved, repeat callers and transfers, each
  marked better or worse, and a bar for each day's calls. Only the agent sees
  it.

The team board adds a Warm-up column: the days each agent did the warm-up
out of the days they worked.

## The team board

A leader adds the agents' CSV files (drop them in or choose them) and sees,
for the latest day, the last 7 days or every day in the files: calls, GSR and
XM offer rates and sales, calls that came back within 7 days, transfers and
satisfaction; the same per agent, by name and HR ID, with a practice suggestion (the reason that
comes up more for that agent than for the team); the top reasons for not
offering, for a no and for transfers, each with its practice link; and every
account that called the team twice within 7 days, masked to the last four
digits unless the leader asks for the full numbers. A one-line team summary
can be copied for the supervisor. Files are read in the browser and nothing
is stored: a reload empties the board. A call that appears in two files is
counted once, and files with the same HR ID are one agent even if the name is
spelt differently (the leader is told); rows whose date or account number a spreadsheet has rewritten
are named rather than guessed. "See it with example data" fills the board
with made-up calls for ten agents. `my-shift-new-features.mp4` shows the
repeat-caller note, a transfer, the practice card and the board.

## Motion across the Academy

`motion.js` watches the Academy's own page updates and marks what should
move; `motion.css` moves it with the Academy's own keyframes and timing
tokens. On every station:

- A page's parts arrive one after another and its numbered steps pop in
  order, on desktop inside the Academy's page transition and on phones on
  their own. The first frame of a new page is already in motion.
- Whatever you pick pops as it fills: chips, answer rings, radio cards and
  check boxes.
- Content that opens rises into place: filtered groups coming back, a new
  coaching card, the next call-flow stage, a scenario's transcript.
- Counts tick over when they change, a finished call-flow stage's node and
  badge pop, and marking a lesson reviewed seals the button.
- The current tab's dot pops with a ring; Home, Sources and About draw
  their underline in.

The gate overlay has the same moves built in: its parts arrive in order,
only the pill or line you just changed moves, a ticked line seals with a
ring and turns green, opened checks rise, and the confirmation seals.
Reduced motion turns all of it off. `academy-motion-desktop.mp4` and
`academy-motion-phone.mp4` show it.

## Deploying

Deploy the folder as-is with the Vercel CLI (`vercel deploy`) alongside
`academy.js`, `academy.css`, `icon.svg`, `robots.txt`, `404.html` and
`not-found.css` from the current deployment.
