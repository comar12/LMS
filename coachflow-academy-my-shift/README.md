# My Shift, the simplified gate and Academy-wide motion

Files that sit next to the Academy's own `academy.js` / `academy.css` bundle
on Vercel (project `coachflow-academy-tsx-test`). Nothing in the Academy
bundle is modified; the extra scripts add two routes and one motion layer:

- `#/academy/sales-integrity-gate` — the simplified four-tick Sales Integrity
  Gate (`gate-simple.js`, `gate-simple.css`, `gate-data.js`).
- `#/academy/my-shift` — the shift timer and call log (`my-shift.js`,
  `my-shift.css`). "My Shift" is a working name.
- Every station — the same motion My Shift has (`motion.js`, `motion.css`).

`index.html` and `vercel.json` are the deployed versions that load these
files after the Academy bundle. `my-shift-standalone.html` is a single-file
offline copy of the My Shift page with the Academy's header, footer,
navigation sheet and stylesheet inlined, for review without a server.

## The call log

Every call records: account number, call type (Internet, TV, Mobile,
Billing, Outage, Other), issue resolved, customer satisfied, GSR offered →
result → which GSR or why declined (or why not offered), XM offered → result
→ why declined (or why not offered), and a short note. Reasons:

- Not offered: Account not eligible, Account restriction, Customer upset,
  Unauthorized caller, No opening, Already has it, Other.
- GSR declined / follow-up: Price, Not interested, Needs to think, Partner
  decides, Contract, Already at top tier, Other.
- XM declined / follow-up: Price, Not interested, Coverage, Contract, Needs
  to think, Partner decides, Happy with current carrier, Credit check, Other.

Calls are stored only in the agent's browser (`localStorage`, key
`coachflow.myshift.v1`). The page offers a one-line end-of-shift summary and
a CSV download; nothing is sent anywhere.

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
