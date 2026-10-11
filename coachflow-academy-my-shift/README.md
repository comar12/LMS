# My Shift station for CoachFlow Academy

Files that sit next to the Academy's own `academy.js` / `academy.css` bundle
on Vercel (project `coachflow-academy-tsx-test`). Nothing in the Academy
bundle is modified; the extra scripts add two routes:

- `#/academy/sales-integrity-gate` — the simplified four-tick Sales Integrity
  Gate (`gate-simple.js`, `gate-simple.css`, `gate-data.js`).
- `#/academy/my-shift` — the shift timer and call log (`my-shift.js`,
  `my-shift.css`). "My Shift" is a working name.

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

## Deploying

Deploy the folder as-is with the Vercel CLI (`vercel deploy`) alongside
`academy.js`, `academy.css`, `icon.svg`, `robots.txt`, `404.html` and
`not-found.css` from the current deployment.
