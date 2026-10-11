# Coaching Intelligence Pro: Content Guide

This guide defines how every built-in coaching entry is written. The library is used daily by contact center
supervisors (Comcast/Xfinity programs: Technical Support, Billing, Customer Service, Xfinity Mobile, Sales) to
document coaching. Supervisors click a behavior, then copy the text straight into an official coaching form.
Every sentence must be ready to paste, specific to the behavior, supportive, and professional.

Data lives in `src/data/*.json`. `src/data/meta.json` holds the categories, themes, strength catalog, the exact
list of required opportunities (id, title, theme), and the "opposites" map. `tools/exemplars.json` holds two
finished entries that show the expected quality. Validate with:

```
python3 tools/validate_content.py src/data/<file>.json
```

---

## 1. Absolute rules

1. **No identifying information, ever.** No agent names, customer names, BPIDs, HRIDs, Avaya IDs, account
   numbers, interaction IDs, phone numbers, addresses, or details from a specific real call. Examples use
   generic situations ("working from home", "the internet has been dropping all week").
2. **Write directly to the agent in the second person** ("you", "your"). Never "the agent".
   - Right: "During the interaction, you moved into troubleshooting without first acknowledging the customer's
     frustration."
   - Wrong: "The agent failed to demonstrate empathy."
3. **Never claim progress or results.** Content must not state that the agent improved, met a KPI, completed a
   previous plan, or showed a behavior consistently. No references to "last session" or history.
4. **Impact is conditional.** Describe what the behavior *can* cause ("can", "may", "often", "is likely to").
   Never state that an escalation, complaint, repeat call, or low score actually happened.
5. **Do not invent Comcast/Xfinity procedures, policies, prices, promotions, credit amounts, timeframes, or
   system names.** Describe best-practice behavior and refer to "the applicable process", "the current ITG flow",
   "approved resources", "the program's standard". When a process detail matters, put a reminder in `note`
   (e.g., "Confirm the current porting process before the session."). Never guarantee technical outcomes.
6. **Supportive, constructive, performance-focused.** Not punitive, not preachy. No empty corporate language,
   motivational clichés, or AI-sounding filler (see the banned list in section 7).
7. **Every feedback paragraph follows: observed behavior -> why it matters -> customer impact -> expected
   behavior.**
8. **Plain ASCII punctuation only.** Straight quotes and apostrophes (`'` and `"`), no em or en dashes, no
   ellipsis characters, no Markdown, no bullet characters. Use commas and periods instead of dashes.
9. **No placeholder text.** No square brackets, "insert", "TBD", "XX", or generic one-liners.
10. **No exclamation marks** in feedback, impact, plan, or follow-up.

---

## 2. Entry schema (one JSON object per opportunity)

| Field | Content | Length |
|---|---|---|
| `id` | Exact id from `meta.json` `required` | |
| `cat` | Category id (`com`, `dis`, `hold`, `own`, `tech`, `bill`, `sales`) | |
| `title` | Exact title from `meta.json` | |
| `desc` | One-sentence library description of the behavior gap, written neutrally (no "you"). Ends with a period. | 10-32 words, max 200 chars |
| `kw` | Search keywords: synonyms, supervisor shorthand, symptoms, related phrases. Lowercase, 1-4 words each. Include the words a supervisor would actually type (e.g., "silent", "mute", "no response", "sleepy", "monotone", "customer angry"). | 8-22 items |
| `tags` | 2-4 short Title Case labels (e.g., "Soft Skills", "Call Control", "Process") | max 24 chars each |
| `kpi` | Subset of `["QA", "aiCR", "Transfer"]`. QA = scored on the quality form. aiCR = can drive repeat contacts. Transfer = can drive avoidable or incorrect transfers. | at least 1 |
| `theme` | Exact theme from `meta.json` `required` | |
| `feedback` | **Things Can Be Better.** Ready-to-copy coaching paragraph. | **70-120 words** (aim 85-110) |
| `impact` | **Root Cause & Customer Impact.** 1-2 sentences on the common root cause (phrased as "usually happens when", "often comes from", never as an accusation), then the cause-and-effect impact on the customer and the business, using conditional language. | 40-100 words |
| `plan` | **Two-Week SMART Action Plan.** Specific agent commitments, a measurable standard, a realistic review period. Must use the tokens `{duration}`, `{calls}`, `{followup}`. | 65-140 words |
| `followup` | **Supervisor Follow-Up Plan.** How the supervisor will coach, demonstrate, audit, and validate. Must use `{calls}`, `{followup}`, and `{duration}` or `{durationAdj}`. | 35-110 words |
| `example` | **Correct Behavior / Example Statement.** 1-3 objects: `{ "say": "..." }` or `{ "label": "Before the hold", "say": "..." }`. `say` is natural customer-facing speech, **without surrounding quotes** (the app adds them). `label` is optional, short, no colon. | 15-100 words total |
| `questions` | **Coaching Questions.** Exactly 3 open, reflective, behavior-specific questions the supervisor can ask. | 7-32 words each, end with `?` |
| `strengths` | 3-5 strength ids from the catalog that a supervisor could plausibly also observe on a call with this gap. **Never** include the direct opposite of the gap (see `opposites` in meta.json, and use common sense). | |
| `b` | Builder fragments (section 4). | |
| `note` | Optional. Supervisor-only reminder, never copied into coaching text (e.g., confirm the internal process, how to verify the behavior on the recording). May be third person. | max 320 chars |

### Tokens (plan, followup, b.mx only)

| Token | Renders as (default) | Use in a sentence |
|---|---|---|
| `{duration}` | `two weeks` | "For the next {duration}, you will..." |
| `{durationAdj}` | `two-week` | "at the end of the {durationAdj} coaching period" |
| `{calls}` | `five` | "We will review {calls} applicable calls" / "in all {calls} calls" |
| `{followup}` | `seven days` | "within {followup}" / "within the next {followup}" |

Supervisors can change these values (for example 21 days, 8 calls, 10 days), so every sentence must stay
grammatical for any number. Do not write numbers that conflict with the tokens (no "two weeks", "five calls",
or "seven days" typed out by hand in plan or followup).

---

## 3. Writing standard for each section

### feedback (Things Can Be Better)
- Open with what was observed, in a way that is specific to this behavior yet reusable for any agent.
- Explain why it matters and how it affects the customer experience.
- Close with the expected behavior, concrete enough to act on tomorrow.
- **Vary the openings.** No more than two entries in a file may start with the same three words. Ideas:
  "During the interaction,", "When the customer explained...", "While you were reviewing the account,",
  "After the customer mentioned...", "Throughout the call,", "At the start of the call,", "Once the issue was
  identified,", "Before you began troubleshooting,", "When the customer asked...", "In this interaction,".
- **Vary the expectation transition.** Use "Going forward," in no more than half of the entries. Alternatives:
  "Next time,", "On future calls,", "Moving forward,", "The expectation is to...", "Instead,", "From here,".
- Reference the customer as "the customer". Use "call" or "interaction".

### impact (Root Cause & Customer Impact)
Model: "Missing acknowledgement and assurance at the beginning can cause an already frustrated customer to feel
unheard, making them less receptive to troubleshooting and increasing the chance of escalation or repeat
contact." Connect cause to effect. Where relevant, connect to QA results, repeat contacts (aiCR), transfers,
escalations, handle time, trust, or cancellation risk, always conditionally.

### plan (SMART)
- Specific: name the exact behaviors the agent will perform and when (e.g., "before placing a hold", "within the
  first minute of the concern", "before ending the call").
- Measurable: a clear target. The default is the behavior in all `{calls}` reviewed calls, but **do not apply
  that blindly**. Event-based behaviors need event-based measures, for example: "every transfer in the reviewed
  calls follows the warm transfer steps", "every disconnected call receives a callback attempt", "a relevant
  offer on every reviewed call where discovery identified a need", "zero unsupported guarantees".
- Achievable and relevant: realistic for one agent over the period, tied to the behavior.
- Time-bound: `{duration}` for the plan, `{followup}` for the first review.
- Vary the opening: "For the next {duration}, you will", "Over the next {duration}, you will", "During the next
  {duration}, you will", "Starting with your next call and continuing for {duration}, you will", "Each day for
  the next {duration}, you will".
- No one-line plans. 3-5 sentences.

### followup (Supervisor Follow-Up Plan)
Written from the supervisor to the agent ("We will...", "I will..."). Include, where appropriate: a demonstration
or roleplay during the session; reviewing `{calls}` calls within `{followup}`; a midweek progress discussion; an
end-of-plan review at `{durationAdj}`/`{duration}`. **Make the coaching activity specific to the behavior** and
vary it across entries: roleplay, side-by-side listening of the recording, agent self-assessment against a short
checklist, listening to a strong call example together, ITG or process walkthrough, tools navigation practice,
building a personal phrase bank, a quick knowledge check, reviewing the process documentation together.

### example (Correct Behavior / Example Statement)
Natural, warm, customer-friendly speech that a strong agent would actually say. Generic enough to reuse. No
names, no invented prices, promotions, credit amounts, or policy timeframes. Illustrative estimates like "about
two minutes" are fine. Never use "I understand your frustration", "rest assured", or "sorry for any
inconvenience" as model language.

### questions
Open questions that help the agent reflect and own the change, specific to the behavior. Model:
"What did you notice about the customer's frustration?" / "What could you have said before beginning
troubleshooting?" / "How would you manage that situation differently next time?" Do not reuse the same three
questions across entries.

---

## 4. Builder fragments (`b`)

The Coaching Builder merges several selected opportunities into one cohesive coaching entry. It does **not**
paste full paragraphs together; it composes sentences from these short fragments. Grammar must be exact.

| Key | Grammar | Composed as | Length |
|---|---|---|---|
| `obs` | Past-tense verb phrase that follows "you". Lowercase start, no final period. | "During discovery, you **asked few questions about when the issue started** and **moved into steps before confirming what the customer had already tried**." | 8-32 words |
| `focus` | 1-4 word lowercase noun phrase naming the skill. | "Over the next two weeks, you will focus on **personalized empathy**, **dead-air management**, and **thorough probing**." | 1-4 words |
| `commit` | Base-form verb phrase that follows "you will" / "you are expected to". Lowercase start, no final period. | "To strengthen discovery before acting on the concern, you will **ask about when the issue started and what has already been tried before recommending a step**." | 7-32 words |
| `m` | Noun phrase that completes "The target is for all five reviewed calls to show ___". Lowercase, no period. | "...to show **no unexplained extended dead-air periods**, **an acknowledgement and personalized empathy statement before troubleshooting begins**, and..." | 3-22 words |
| `mx` | Use **instead of** `m` for event-based measures. A complete sentence; tokens allowed. | "**Every disconnected call during the next {duration} is followed by a callback attempt and documented according to the applicable process.**" | 6-40 words |
| `coach` | Noun phrase starting with "a" or "an", no final period. | "During this session, we will complete **a short roleplay of hold transitions and research narration** and **a side-by-side review of the call opening**." | 4-22 words |

Each opportunity's `obs` is grouped with others from the same theme under the theme lead-in from `meta.json`
(e.g., `"During discovery, you {list}."`, `"In managing the flow of the call, you {list}."`), so write `obs` so
it reads naturally after that lead-in. Keep each fragment unique to its entry (the validator rejects duplicates).

---

## 5. Strength catalog and the "opposites" rule

Strength ids and titles are in `meta.json` `strengthCatalog`. Choose 3-5 that a supervisor might genuinely also
see on a call with this gap (for example, a call with excessive dead air may still show correct ITG use and good
ownership). Never suggest a strength that contradicts the gap (Missing Empathy must not suggest Personalized
Empathy). The app only includes a strength in copied text when the supervisor explicitly selects it.

---

## 6. Category-specific guidance

**Hold, Mute & Call Control.** These are top coaching priorities. Keep the concepts distinct:
- *Hold* uses the phone system hold function; the customer hears hold music or messaging and hold time is
  recorded. Correct use: ask permission, give the reason and an estimated time, return on time or check back,
  thank the customer.
- *Mute* turns off the agent's microphone; the line stays open and the customer hears silence. From the
  customer's side it sounds like dead air. Mute is not a substitute for hold during research.
- *Dead air* is silence on an open line with no communication, whatever the cause (mute, reading, typing,
  system delays).
- *Research time* is acceptable when the customer is kept informed (narration or a proper hold).
- Zero recorded hold time does **not** prove the customer was on mute; the silence may come from reading,
  navigating tools, or system delays. Coaching for mute usage should note confirming it from the recording.
- Distinguish: Excessive Dead Air (long silent stretches during research), Avoidable or Unexplained Silence
  (shorter silences at transition points that could have been filled or explained), Poor Research Communication
  (not explaining what is being checked and what was found), Delayed Responses (slow replies to the customer's
  questions or statements), Failure to Return With Updates (staying on hold past the stated time without
  checking back), Excessive Hold Time (too many or too long holds), Incorrect Mute Usage.

**Ownership & Resolution.** Transfers and repeat contacts tie to the Transfer and aiCR (repeat rate) KPIs. Refer
to "the applicable transfer process", "warm transfer", "the correct escalation path" without inventing queue
names. Callback and follow-up commitments must be described as following the applicable process.

**Technical Support & Process Knowledge.** "ITG" is the program's troubleshooting guide; use the term as is
("the applicable ITG flow"). Describe best-practice diagnostics (confirm symptoms, scope, equipment status,
signal and connection checks, outage checks, prior contacts) without inventing system names or steps. Never
promise outcomes ("this will definitely fix it", "the technician will fix it"). Add a `note` reminding the
supervisor to confirm the current internal process where relevant (porting, verification, scheduling, equipment
replacement, account access).

**Billing & Customer Education.** No invented prices, credit amounts, refund timelines, promotions, or fees.
Use "the applicable timeframe", "the promotional term", "the standard rate after the promotion", "eligible
credits". Focus on accuracy, complete disclosure, setting correct expectations, and acknowledging frustration.

**Sales & Retention.** Sales coaching must follow: Understand -> Empathize -> Assure -> Probe -> Resolve ->
Confirm -> Plant the Seed -> Relevant Offer -> Explain Pricing -> Confirm Understanding. Key principles:
- A payment link or payment assistance is **not** a sales offer.
- Distinguish offer types where relevant: Xfinity Mobile (XM) lines and devices, service upgrades (for example
  internet speed or equipment), TV package changes, and retention offers for customers considering cancellation.
- Offers must connect to needs discovered in the conversation; respect a clear "no"; explain value as customer
  benefits; disclose pricing completely and accurately; confirm understanding and agreement.

---

## 7. Banned phrases and patterns

The validator rejects these (case-insensitive): "the agent", "you failed", "unacceptable", "at the end of the
day", "above and beyond", "extra mile", "touch base", "circle back", "leverage", "synergy", "game changer",
"rockstar", "superstar", "world-class", "best-in-class", "seamless", "elevate", "empower", "journey", "delve",
"tapestry", "important to note", "worth noting", "in conclusion", "furthermore", "moreover", "additionally",
"needless to say", "rest assured", "I understand your frustration" (except where quoted as the weak example in
Generic Empathy), "sorry for any inconvenience", "kindly", "please be advised", "valued customer", "great job",
"good job", "amazing", "awesome", "fantastic", "last session", "previous session", "since our last",
"you have improved", "needs to improve", placeholders, `$`, `%`, 3+ digit numbers, square brackets, Markdown,
curly quotes, and em/en dashes.

Also avoid: robotic repetition, stacked adjectives, therapy-speak, scolding, "simply", "just" used to minimize,
and filler like "it is crucial that" or "in today's fast-paced environment".

---

## 8. Strength statements (Things Went Well library)

`src/data/strengths.json` is an array of `{ "id", "kw", "v" }` (title, group, and description come from the
catalog in meta.json).
- `v` holds 2-3 variations, each 22-65 words, written directly to the agent as positive, specific feedback:
  the behavior observed plus why it matters, in general terms ("This shows the customer...", "That kind of
  ... helps customers...").
- Variations of the same strength must differ in structure and wording, not just synonyms.
- Never claim progress, improvement, metrics, survey results, or consistency over time ("always", "every call",
  "consistently", "improved", "KPI", "score" are rejected). Describe what was observed on the call.
- Vary openings across the library: "You did a strong job...", "Your ... ", "When the customer...", "From the
  start of the call,", "One clear strength was...", "Before ... , you...", "I appreciated how you...".
- No exclamation marks, no clichés.
