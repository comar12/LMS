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

`coachflow-academy-offline.html` is the whole Academy in one file: Home,
Knowledge, Call Flow, Scenario Lab, the Sales Integrity Gate, My Shift and its
team board, Sources and About, with the motion layer. It is the deployed
`index.html` with every stylesheet, script and the icon written into the page,
so it opens by double-click with no server and no internet, and every link
stays inside the file. Progress, calls and goals are kept in that browser for
that file, as on the site.

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
- **Call backs.** Agents never offer or promise a call back; a call back the
  customer asks for is fine. Picking "Follow-up" for GSR or XM shows that
  rule under the reason, and the note box asks for the call back the customer
  asked for and when.
- **Before you hang up.** When a call is not resolved or escalated, three
  boxes appear: gave the ticket or reference number, told them what happens
  next, gave no time frame that couldn't be confirmed. They are optional; an
  unticked one is counted as something to coach. A repeat caller's note says
  what they were not given last time.
- **QA self-check.** When a GSR or XM sale is completed, the simplified
  gate's four checks appear (before pitching, before approval, before
  activating, no red line), with a link to the Sales Integrity Gate. Also
  optional. These are the gate's own statements for now; they can be swapped
  for the QA team's form items.

Both are counted in the rail, the summary and the CSV (`next_steps` and
`qa_check`: the ticked items, `none` when nothing was ticked, empty when the
check did not apply). Calls logged before this change are not counted.

### Article sent

Every call asks "Article sent to the customer?" (Sent / Not sent), required
like the other answers. It shows in the call list, the rail and the summary;
a sent article goes into the account note; a repeat caller's note says
whether an article went out last time (and suggests sending one if none did);
the CSV adds `article_sent`; the board adds an "Article sent" column per agent
and for the team, and the supervisor line gives the team's rate. Calls logged
before the question existed are left out of the count ("Not asked").

### Overnight shifts

Operating hours run overnight (14:00 to 07:00 Cairo time), so nothing in My
Shift follows the calendar date at midnight. A shift counts from Start shift
until End shift, whatever the clock says; every call belongs to the shift it
was logged in; and a work day runs from 10:00 to 10:00 the next morning, named
by the date it starts (`WORKDAY_START` in `my-shift.js`). The list, the rail,
goals, the warm-up, the summary, My week and wins all use that day. A shift
left running for more than 13 hours (`LONG_SHIFT_H`) keeps counting and asks
"Finished? Press End shift." The CSV keeps each call's real `date` and `time`
and adds `shift_day`; the board groups by `shift_day`, so a night is one day
in "Latest day" and in the shout-outs. Older files without the column are
grouped by date as before.

### End-of-shift check-in

When the agent presses End shift, My Shift asks "How did tonight feel?" from
1 (really hard) to 5 (great), with optional reasons: tough customers, systems
or tools, call volume, no time between calls, breaks, unclear process,
support from my team, something outside work. The agent chooses whether to
share it with their team leader (on by default); a check-in kept private stays
on that computer. One check-in per shift day; it can be changed. The agent
sees their last seven check-ins, and after three hard nights in a row is told
it is worth a word with their team leader. A shared check-in goes into the
summary line and into the CSV (`checkin`, `checkin_why`).

The team board adds a Check-in column (average, nights, hard nights) and a
"Worth a check-in" list: agents whose last two or more shared check-ins were
hard (1 or 2), or with three hard nights in their last seven, with what they
said got in the way, plus the team's average and top reasons. The supervisor
line names them.

### Who is logging

The top of My Shift asks once for the agent's name and HR ID (numbers only)
and remembers them on that computer. Every call is stamped with the HR ID; if
someone else uses the computer, "Not you? Change" switches agent, ends the
previous agent's running shift, and each agent's list, summary and file hold
only their own calls. Download CSV asks for the name and HR ID first if they
are missing.

The CSV adds `transfer_reason`, `repeat_7d`, `agent`, `hr_id`, `call_id`,
`warmup`, `next_steps`, `qa_check`, `what_worked`, `holds`, `hold_secs`,
`longest_hold_secs`, `long_holds`, `shift_day`, `checkin`, `checkin_why` and `article_sent` columns, and the file is named
`my-shift-<name>-<hr id>-<date>.csv`.

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

The board also shows, per agent and for the team, the unresolved calls with
next steps given in full and the sales with the QA self-check fully ticked,
two tiles for them, and a "Left unticked" column with the items missed most
and where to practise them.

### Reset after a tough call, wins and lines that worked

- **Reset after a tough call.** When a call is logged with the customer not
  satisfied, a card offers 30 seconds before the next call: a breathing
  circle, a countdown and a few short lines, then "Ready when you are." After
  two unhappy customers in a row it says so and that it's fine to tell the
  team leader they need a minute. It can be skipped; only the agent sees it
  and nothing is logged.
- **Wins and streaks.** Streaks for offering on every call, giving next steps,
  ticking the QA self-check and doing the warm-up show as chips under the
  bar; milestones (5, 10, 20, 50 calls with an offer; sales counts; first GSR
  and XM sale; best day) are listed under "Wins". A new win is named when the
  call that earned it is logged.
- **Lines that worked.** After a completed sale the agent can note the line
  that worked, in the customer's own words. Their lines, and any the leader
  shares, show under "Customer said" when a few words match. "Add team lines"
  reads the file the leader downloads from the board.

### Hold timer and the account note

- **Hold timer.** "Customer on hold" (or the H key) starts a timer above the
  form with a reminder to ask first and say why. At 0:45 it turns amber and
  says to go back and thank the customer; past 1:30 it turns red and counts
  as a long hold. The browser tab title shows the time, and an agent can let
  My Shift send a desktop reminder when they are in another window. "Back
  with customer" ends the hold; every hold is counted on the call being
  logged (a hold still running when the call is logged is ended and counted).
  The numbers are `HOLD_CHECK` and `HOLD_LONG` at the top of `my-shift.js`,
  to match the QA form.
- **Copy account note.** Turns the call into a few plain lines to paste into
  the account: call type and outcome, repeat contact, what happened, the
  ticket or reference number and next steps for unresolved calls, what the
  customer approved or declined (and why), and any call back the customer
  asked for. Blanks (`____`) mark what to fill in. Internal answers (not
  offered, satisfied, the QA self-check) stay out of the note. After a call
  is logged, "Copy its account note" copies the same note.

Holds are counted in the rail, the summary, the CSV and on the board, which
adds a "Holds over 1:30" column per agent and the team total.

The team board adds shout-outs (each agent's best wins, with a copy button)
and a "What worked" list of the team's lines, with "Download for the team"
(`my-shift-team-lines-<date>.csv`, columns `line,product,agent,date`). Check
shared lines against the Sales Integrity Gate before passing them on.

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

My Shift and the team board add more on top:

- Tiles, goal cards, wins, streak chips, shout-outs, lines, board rows and
  repeat-caller cards arrive one after another; the numbers on the tiles count
  up to their value.
- Goal meters draw across with their goal marker popping in; the day bars in
  My week grow one after another.
- A new win, and a goal reached for the first time, give a small burst of
  colour; streak and shout-out stars spin in.
- The hold timer has a bar that fills toward 0:45, nudges when it is time to
  go back, and pulses past 1:30.
- Copy buttons pop and turn green; cards lift a little under the mouse.

Reduced motion keeps all of this still too: numbers show at once and no burst
is drawn. `my-shift-more-motion.mp4` shows it.

## Deploying

Deploy the folder as-is with the Vercel CLI (`vercel deploy`) alongside
`academy.js`, `academy.css`, `icon.svg`, `robots.txt`, `404.html` and
`not-found.css` from the current deployment.
