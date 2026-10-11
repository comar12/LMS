# My Shift, its team board, the simplified gate and Academy-wide motion

Files that sit next to the Academy's own `academy.js` / `academy.css` bundle
on Vercel (project `coachflow-academy-tsx-test`). Nothing in the Academy
bundle is modified; the extra scripts add three routes and one motion layer:

- `#/academy/sales-integrity-gate` — the simplified four-tick Sales Integrity
  Gate (`gate-simple.js`, `gate-simple.css`, `gate-data.js`).
- `#/academy/my-shift` — the shift timer and call log (`my-shift.js`,
  `my-shift.css`). "My Shift" is a working name.
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

The CSV adds `transfer_reason`, `repeat_7d`, `agent` and `call_id` columns,
and the file is named after the agent (`my-shift-<name>-<date>.csv`).

## The team board

A leader adds the agents' CSV files (drop them in or choose them) and sees,
for the latest day, the last 7 days or every day in the files: calls, GSR and
XM offer rates and sales, calls that came back within 7 days, transfers and
satisfaction; the same per agent with a practice suggestion (the reason that
comes up more for that agent than for the team); the top reasons for not
offering, for a no and for transfers, each with its practice link; and every
account that called the team twice within 7 days, masked to the last four
digits unless the leader asks for the full numbers. A one-line team summary
can be copied for the supervisor. Files are read in the browser and nothing
is stored: a reload empties the board. A call that appears in two files is
counted once; rows whose date or account number a spreadsheet has rewritten
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
