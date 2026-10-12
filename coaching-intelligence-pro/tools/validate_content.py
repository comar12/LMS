#!/usr/bin/env python3
"""Validate Coaching Intelligence Pro content files against the content guide.

Usage:
  python3 tools/validate_content.py                       # validate every data file present
  python3 tools/validate_content.py src/data/hold.json    # validate one or more files
  python3 tools/validate_content.py --strict              # warnings also fail the run

Exit code 0 = no errors (warnings may be present unless --strict).
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")

TOKENS = {"{duration}", "{durationAdj}", "{calls}", "{followup}"}
RENDER = {"{duration}": "two weeks", "{durationAdj}": "two-week", "{calls}": "five", "{followup}": "seven days"}
KPIS = {"QA", "aiCR", "Transfer"}
PEOPLE_KPIS = {"ABS", "Attrition"}
# Attendance, adherence, and retention entries are about schedules and engagement, not calls.
PEOPLE_CATS = {"people"}
OPP_KEYS = {"id", "cat", "title", "desc", "kw", "tags", "kpi", "theme", "feedback", "impact", "plan",
            "followup", "example", "questions", "strengths", "b", "note"}
B_KEYS = {"obs", "focus", "commit", "m", "mx", "coach"}

# Phrases that are clichés, AI-sounding, punitive, placeholder-like, or that claim history/progress.
BANNED = [
    "the agent", "you failed", "failure on your part", "unacceptable", "at the end of the day",
    "above and beyond", "extra mile", "touch base", "circle back", "leverage", "synergy",
    "game changer", "game-changer", "rockstar", "rock star", "superstar", "world-class", "world class",
    "best-in-class", "seamless", "seamlessly", "elevate", "empower", "journey", "delve",
    "tapestry", "important to note", "worth noting", "in conclusion", "furthermore", "moreover",
    "additionally", "needless to say", "rest assured", "i understand your frustration",
    "sorry for any inconvenience", "apologize for any inconvenience", "apologize for the inconvenience",
    "kindly", "please be advised", "valued customer", "great job", "good job", "amazing", "awesome",
    "superb", "fantastic", "last session", "previous session", "previous coaching", "since our last",
    "you have improved", "lorem", "tbd", "placeholder", "agent name", "customer name", "bpid", "hrid",
    "avaya", "interaction id", "insert coaching", "insert here", "needs to improve",
]
# A few phrases are legitimately quoted as the *wrong* example inside specific entries.
BANNED_EXCEPT = {
    "i understand your frustration": {"com-generic-empathy"},
    "sorry for any inconvenience": {"com-generic-empathy"},
    "apologize for any inconvenience": {"com-generic-empathy"},
    "apologize for the inconvenience": {"com-generic-empathy"},
}
# Strength statements must never imply history, metrics, or generalize beyond what was observed.
STRENGTH_BANNED = ["improved", "improvement", "progress", "kpi", "score", "csat", "nps", "survey",
                   "than before", "every call", "always", "every time", "consistently"]

COMMON_NAMES = set("""john mary sarah michael david james robert maria jennifer linda lisa karen mike chris jessica
ashley emily daniel matthew anthony mark paul steven andrew joshua kevin brian george edward ronald timothy jason
jeffrey ryan jacob gary nicholas eric jonathan stephen larry justin scott brandon benjamin samuel frank gregory
raymond alexander patrick jack dennis jerry tyler aaron jose adam nathan henry douglas zachary peter kyle ethan
walter noah jeremy christian keith roger terry gerald harold sean austin carl arthur lawrence dylan jesse jordan
bryan billy joe bruce gabriel logan albert willie alan juan wayne elijah randy roy vincent ralph eugene russell
bobby mason philip louis patricia barbara elizabeth susan nancy betty margaret sandra kimberly donna michelle
dorothy carol amanda melissa deborah stephanie rebecca sharon laura cynthia kathleen amy angela shirley anna brenda
pamela emma nicole helen samantha katherine christine debra rachel carolyn janet catherine heather diane ruth julie
olivia joyce virginia victoria kelly lauren christina joan evelyn judith megan andrea cheryl hannah jacqueline
martha gloria teresa ann sara madison frances kathryn janice jean abigail alice judy sophia grace denise amber
doris marilyn danielle beverly isabella theresa diana natalie brittany charlotte marie kayla alexis lori omar ahmed
mohamed mohammed ali fatima sam alex taylor morgan casey jamie riley""".split())

BAD_CHARS = {"“": "curly double quote", "”": "curly double quote", "‘": "curly apostrophe",
             "’": "curly apostrophe", "—": "em dash", "–": "en dash", "…": "ellipsis character",
             " ": "non-breaking space"}


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, where, msg):
        self.errors.append(f"ERROR   {where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"WARNING {where}: {msg}")


def render(text):
    for k, v in RENDER.items():
        text = text.replace(k, v)
    return text


def wc(text):
    return len(render(text).split())


def sentences(text):
    parts = re.split(r"(?<=[.?!])\s+", render(text).strip())
    return [p.strip() for p in parts if len(p.split()) >= 5]


def norm_sentence(s):
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


def check_text(rep, where, text, entry_id, field, allow_tokens=False, allow_agent=False):
    if not isinstance(text, str) or not text.strip():
        rep.err(where, f"'{field}' must be a non-empty string")
        return
    for ch, name in BAD_CHARS.items():
        if ch in text:
            rep.err(where, f"'{field}' contains a {name}; use plain ASCII punctuation")
    toks = set(re.findall(r"\{[^}]*\}", text))
    if toks and not allow_tokens:
        rep.err(where, f"'{field}' may not contain tokens: {sorted(toks)}")
    unknown = toks - TOKENS
    if unknown:
        rep.err(where, f"'{field}' contains unknown tokens {sorted(unknown)}")
    if "[" in text or "]" in text:
        rep.err(where, f"'{field}' contains square brackets (placeholder-like)")
    if re.search(r"\d{3,}", text):
        rep.err(where, f"'{field}' contains a 3+ digit number (possible identifier or invented figure)")
    if "$" in text or "%" in text:
        rep.err(where, f"'{field}' contains '$' or '%' (no invented prices or metrics)")
    if "**" in text or "__" in text or "##" in text or re.search(r"(^|\n)\s*[-*] ", text):
        rep.err(where, f"'{field}' contains Markdown markers")
    if re.search(r"\s[,.;:?!]", text):
        rep.err(where, f"'{field}' has a space before punctuation")
    if "  " in text:
        rep.warn(where, f"'{field}' contains a double space")
    if re.search(r"\b(Mr|Mrs|Ms|Dr|Miss)\.?\s+[A-Z]", text):
        rep.err(where, f"'{field}' appears to contain a personal name/title")
    low = text.lower()
    for phrase in BANNED:
        if phrase == "the agent" and allow_agent:
            continue
        if re.search(r"(?<![a-z])" + re.escape(phrase) + r"(?![a-z])", low):
            if entry_id in BANNED_EXCEPT.get(phrase, set()):
                continue
            rep.err(where, f"'{field}' contains banned phrase '{phrase}'")
    # Capitalized common first names that are not at a sentence start.
    for m in re.finditer(r"\b([A-Z][a-z]+)\b", text):
        word = m.group(1)
        if word.lower() not in COMMON_NAMES:
            continue
        prev = text[:m.start(1)].rstrip()
        if not prev or prev[-1] in '.?!:"(':
            continue
        rep.err(where, f"'{field}' may contain a personal name: '{word}'")
    if text.lower().count("ensure") > 2:
        rep.warn(where, f"'{field}' uses 'ensure' more than twice")


def need_range(rep, where, field, text, lo, hi, hard=True):
    n = wc(text)
    if n < lo or n > hi:
        (rep.err if hard else rep.warn)(where, f"'{field}' is {n} words; expected {lo}-{hi}")
    return n


def validate_opps(path, meta, rep, all_sentences, all_fragments):
    fname = os.path.basename(path)
    cat_by_file = {c["file"]: c["id"] for c in meta["categories"]}
    cat = cat_by_file.get(fname)
    if not cat:
        rep.err(fname, "unknown category file name")
        return []
    try:
        with open(path, encoding="utf-8") as fh:
            entries = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return []
    if not isinstance(entries, list):
        rep.err(fname, "top level must be a JSON array")
        return []

    people = cat in PEOPLE_CATS
    required = meta["required"][cat]
    req_ids = [r[0] for r in required]
    req_map = {r[0]: r for r in required}
    strength_ids = {s["id"] for s in meta["strengthCatalog"]}
    opposites = meta.get("opposites", {})

    seen = set()
    ids_in_order = []
    feedback_openers = Counter()
    plan_openers = Counter()
    going_forward = 0

    for i, e in enumerate(entries):
        where = f"{fname}[{i}]"
        if not isinstance(e, dict):
            rep.err(where, "entry must be an object")
            continue
        eid = e.get("id", f"#{i}")
        where = f"{fname}:{eid}"
        extra = set(e.keys()) - OPP_KEYS
        if extra:
            rep.err(where, f"unknown keys {sorted(extra)}")
        missing = (OPP_KEYS - {"note"}) - set(e.keys())
        if missing:
            rep.err(where, f"missing keys {sorted(missing)}")
            continue
        if eid in seen:
            rep.err(where, "duplicate id")
        seen.add(eid)
        ids_in_order.append(eid)
        if eid not in req_map:
            rep.err(where, f"id is not one of the required ids for '{cat}'")
            continue
        _, title, theme = req_map[eid]
        if e["title"] != title:
            rep.err(where, f"title must be exactly '{title}'")
        if e["cat"] != cat:
            rep.err(where, f"cat must be '{cat}'")
        if e["theme"] != theme:
            rep.err(where, f"theme must be '{theme}'")

        # desc
        check_text(rep, where, e["desc"], eid, "desc")
        if isinstance(e["desc"], str):
            need_range(rep, where, "desc", e["desc"], 10, 32)
            if len(e["desc"]) > 200:
                rep.err(where, "'desc' longer than 200 characters")
            if not e["desc"].endswith("."):
                rep.err(where, "'desc' must end with a period")

        # kw
        kw = e["kw"]
        if not isinstance(kw, list) or not (8 <= len(kw) <= 22):
            rep.err(where, "'kw' must be a list of 8-22 keyword phrases")
        else:
            for k in kw:
                if not isinstance(k, str) or k != k.lower() or not k.strip() or len(k.split()) > 4:
                    rep.err(where, f"keyword '{k}' must be a lowercase phrase of 1-4 words")
            if len(set(kw)) != len(kw):
                rep.err(where, "'kw' contains duplicates")

        # tags
        tags = e["tags"]
        if not isinstance(tags, list) or not (2 <= len(tags) <= 4):
            rep.err(where, "'tags' must be a list of 2-4 short labels")
        else:
            for t in tags:
                if not isinstance(t, str) or not t[:1].isupper() or len(t) > 24:
                    rep.err(where, f"tag '{t}' must be Title Case and at most 24 characters")

        # kpi
        kpi = e["kpi"]
        allowed = PEOPLE_KPIS if people else KPIS
        if not isinstance(kpi, list) or not kpi or not set(kpi) <= allowed or len(set(kpi)) != len(kpi):
            rep.err(where, f"'kpi' must be a non-empty subset of {sorted(allowed)}")

        # main text fields
        check_text(rep, where, e["feedback"], eid, "feedback")
        check_text(rep, where, e["impact"], eid, "impact")
        check_text(rep, where, e["plan"], eid, "plan", allow_tokens=True)
        check_text(rep, where, e["followup"], eid, "followup", allow_tokens=True)
        if isinstance(e["feedback"], str):
            need_range(rep, where, "feedback", e["feedback"], 70, 120)
            if not re.search(r"\byou\b|\byour\b", e["feedback"], re.I):
                rep.err(where, "'feedback' must be written in the second person")
            if "!" in e["feedback"]:
                rep.err(where, "'feedback' must not contain exclamation marks")
            first3 = " ".join(e["feedback"].split()[:3]).lower()
            feedback_openers[first3] += 1
            if "going forward" in e["feedback"].lower():
                going_forward += 1
        if isinstance(e["impact"], str):
            need_range(rep, where, "impact", e["impact"], 40, 100)
        if isinstance(e["plan"], str):
            need_range(rep, where, "plan", e["plan"], 65, 140)
            for tok in ("{duration}", "{followup}") if people else ("{duration}", "{calls}", "{followup}"):
                if tok not in e["plan"]:
                    rep.err(where, f"'plan' must include the token {tok}")
            plan_openers[" ".join(e["plan"].split()[:3]).lower()] += 1
        if isinstance(e["followup"], str):
            need_range(rep, where, "followup", e["followup"], 35, 110)
            for tok in ("{followup}",) if people else ("{calls}", "{followup}"):
                if tok not in e["followup"]:
                    rep.err(where, f"'followup' must include the token {tok}")
        if people:
            for fld in ("plan", "followup"):
                if isinstance(e[fld], str) and "{calls}" in e[fld]:
                    rep.err(where, f"'{fld}' must not use {{calls}}; attendance and engagement plans are measured by shifts and check-ins")
                if isinstance(e[fld], str) and re.search(r"\bcalls?\b", e[fld]) and "{calls}" not in e[fld]:
                    rep.warn(where, f"'{fld}' mentions calls; check that the measure fits attendance or engagement")
            if "{duration}" not in e["followup"] and "{durationAdj}" not in e["followup"]:
                rep.err(where, "'followup' must reference the end of the plan with {duration} or {durationAdj}")
        for fld in ("feedback", "impact", "plan", "followup"):
            if isinstance(e[fld], str) and not e[fld].rstrip().endswith("."):
                rep.err(where, f"'{fld}' must end with a period")
            if isinstance(e[fld], str) and "\n" in e[fld]:
                rep.err(where, f"'{fld}' must be a single paragraph (no line breaks)")

        # example
        ex = e["example"]
        if not isinstance(ex, list) or not (1 <= len(ex) <= 3):
            rep.err(where, "'example' must be a list of 1-3 objects")
        else:
            total = 0
            for j, line in enumerate(ex):
                if not isinstance(line, dict) or "say" not in line or set(line) - {"say", "label"}:
                    rep.err(where, f"example[{j}] must be an object with 'say' and optional 'label'")
                    continue
                check_text(rep, where, line["say"], eid, f"example[{j}].say")
                say = line["say"]
                if isinstance(say, str):
                    total += wc(say)
                    if say[:1] in "\"'" or say[-1:] in "\"'":
                        rep.err(where, f"example[{j}].say must not be wrapped in quotes (the app adds them)")
                if "label" in line:
                    lab = line["label"]
                    if not isinstance(lab, str) or not lab or len(lab) > 40 or ":" in lab or '"' in lab:
                        rep.err(where, f"example[{j}].label must be a short plain label without colons or quotes")
            if total and not (15 <= total <= 100):
                rep.err(where, f"'example' totals {total} words; expected 15-100")

        # questions
        qs = e["questions"]
        if not isinstance(qs, list) or len(qs) != 3:
            rep.err(where, "'questions' must contain exactly 3 questions")
        else:
            for j, q in enumerate(qs):
                check_text(rep, where, q, eid, f"questions[{j}]")
                if isinstance(q, str):
                    need_range(rep, where, f"questions[{j}]", q, 7, 32)
                    if not q.endswith("?"):
                        rep.err(where, f"questions[{j}] must end with '?'")
            if len(set(qs)) != 3:
                rep.err(where, "questions must be unique")

        # strengths
        st = e["strengths"]
        if not isinstance(st, list) or not (3 <= len(st) <= 5) or len(set(st)) != len(st):
            rep.err(where, "'strengths' must list 3-5 unique strength ids")
        else:
            for sid in st:
                if sid not in strength_ids:
                    rep.err(where, f"unknown strength id '{sid}'")
                if sid in opposites.get(eid, []):
                    rep.err(where, f"strength '{sid}' is the direct opposite of this opportunity")

        # builder fragments
        b = e["b"]
        if not isinstance(b, dict):
            rep.err(where, "'b' must be an object")
        else:
            extra = set(b) - B_KEYS
            if extra:
                rep.err(where, f"'b' has unknown keys {sorted(extra)}")
            for k in ("obs", "focus", "commit", "coach"):
                if k not in b:
                    rep.err(where, f"'b.{k}' is required")
            if ("m" in b) == ("mx" in b):
                rep.err(where, "'b' must contain exactly one of 'm' or 'mx'")
            if people and "mx" not in b:
                rep.err(where, "attendance and engagement entries must use 'b.mx' (a complete measure sentence), not 'b.m'")
            if people and isinstance(b.get("mx"), str) and "{calls}" in b["mx"]:
                rep.err(where, "'b.mx' must not use {calls} in attendance and engagement entries")
            if isinstance(b.get("obs"), str):
                s = b["obs"]
                check_text(rep, where, s, eid, "b.obs")
                need_range(rep, where, "b.obs", s, 8, 32)
                if s.split()[0].lower() in ("you", "your", "the", "there"):
                    rep.err(where, "'b.obs' must start with a past-tense verb (it follows 'you')")
                if not s[:1].islower():
                    rep.err(where, "'b.obs' must start lowercase")
                if s.rstrip()[-1:] in ".!?":
                    rep.err(where, "'b.obs' must not end with punctuation")
            if isinstance(b.get("focus"), str):
                s = b["focus"]
                check_text(rep, where, s, eid, "b.focus")
                if not (1 <= len(s.split()) <= 4):
                    rep.err(where, "'b.focus' must be 1-4 words")
                if not s[:1].islower() and not s.startswith("ITG"):
                    rep.err(where, "'b.focus' must start lowercase")
                if s.rstrip()[-1:] in ".!?":
                    rep.err(where, "'b.focus' must not end with punctuation")
            if isinstance(b.get("commit"), str):
                s = b["commit"]
                check_text(rep, where, s, eid, "b.commit")
                need_range(rep, where, "b.commit", s, 7, 32)
                if s.split()[0].lower() in ("you", "to", "will", "should", "must", "always", "the"):
                    rep.err(where, "'b.commit' must start with a base-form verb (it follows 'you will')")
                if not s[:1].islower():
                    rep.err(where, "'b.commit' must start lowercase")
                if s.rstrip()[-1:] in ".!?":
                    rep.err(where, "'b.commit' must not end with punctuation")
            if isinstance(b.get("m"), str):
                s = b["m"]
                check_text(rep, where, s, eid, "b.m")
                need_range(rep, where, "b.m", s, 3, 22)
                if not s[:1].islower():
                    rep.err(where, "'b.m' must start lowercase")
                if s.rstrip()[-1:] in ".!?":
                    rep.err(where, "'b.m' must not end with punctuation")
            if isinstance(b.get("mx"), str):
                s = b["mx"]
                check_text(rep, where, s, eid, "b.mx", allow_tokens=True)
                need_range(rep, where, "b.mx", s, 6, 40)
                if not s[:1].isupper() or not s.rstrip().endswith("."):
                    rep.err(where, "'b.mx' must be a complete sentence (capitalized, ending with a period)")
            if isinstance(b.get("coach"), str):
                s = b["coach"]
                check_text(rep, where, s, eid, "b.coach")
                need_range(rep, where, "b.coach", s, 4, 22)
                if not (s.startswith("a ") or s.startswith("an ")):
                    rep.err(where, "'b.coach' must start with 'a ' or 'an '")
                if s.rstrip()[-1:] in ".!?":
                    rep.err(where, "'b.coach' must not end with punctuation")
            for k in ("obs", "commit", "m", "coach"):
                if isinstance(b.get(k), str):
                    all_fragments[(k, b[k].strip().lower())].append(eid)

        if "note" in e:
            check_text(rep, where, e["note"], eid, "note", allow_agent=True)
            if isinstance(e["note"], str) and len(e["note"]) > 320:
                rep.err(where, "'note' longer than 320 characters")

        # sentence-level duplicate detection
        for fld in ("feedback", "impact", "plan", "followup"):
            if isinstance(e.get(fld), str):
                for s in sentences(e[fld]):
                    all_sentences[norm_sentence(s)].append(f"{eid}.{fld}")

    missing_ids = [r for r in req_ids if r not in seen]
    if missing_ids:
        rep.err(fname, f"missing required entries: {missing_ids}")
    if [i for i in ids_in_order if i in req_ids] != [r for r in req_ids if r in seen]:
        rep.warn(fname, "entries are not in the required order")
    for opener, n in feedback_openers.items():
        if n > 2:
            rep.warn(fname, f"{n} feedback paragraphs start with '{opener}'; vary the openings")
    for opener, n in plan_openers.items():
        if n > max(4, len(entries) // 3):
            rep.warn(fname, f"{n} plans start with '{opener}'; vary the openings")
    if entries and going_forward > len(entries) * 0.5:
        rep.warn(fname, f"'Going forward' appears in {going_forward}/{len(entries)} feedback paragraphs; vary it")
    return entries


def validate_strengths(path, meta, rep):
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            entries = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return
    if not isinstance(entries, list):
        rep.err(fname, "top level must be a JSON array")
        return
    catalog = {s["id"]: s for s in meta["strengthCatalog"]}
    seen = set()
    openers = Counter()
    total_variations = 0
    all_v = []
    for i, e in enumerate(entries):
        where = f"{fname}[{i}]"
        if not isinstance(e, dict):
            rep.err(where, "entry must be an object")
            continue
        sid = e.get("id")
        where = f"{fname}:{sid}"
        extra = set(e) - {"id", "kw", "v"}
        if extra:
            rep.err(where, f"unknown keys {sorted(extra)} (title/group/desc come from meta.json)")
        if sid not in catalog:
            rep.err(where, "id is not in the strength catalog")
            continue
        if sid in seen:
            rep.err(where, "duplicate id")
        seen.add(sid)
        kw = e.get("kw")
        if not isinstance(kw, list) or not (3 <= len(kw) <= 12):
            rep.err(where, "'kw' must be a list of 3-12 lowercase phrases")
        else:
            for k in kw:
                if not isinstance(k, str) or k != k.lower() or len(k.split()) > 4:
                    rep.err(where, f"keyword '{k}' must be a lowercase phrase of 1-4 words")
        vs = e.get("v")
        if not isinstance(vs, list) or not (2 <= len(vs) <= 3):
            rep.err(where, "'v' must contain 2-3 variations")
            continue
        for j, v in enumerate(vs):
            check_text(rep, where, v, sid, f"v[{j}]")
            if not isinstance(v, str):
                continue
            total_variations += 1
            all_v.append(norm_sentence(v))
            need_range(rep, where, f"v[{j}]", v, 22, 65)
            if not re.search(r"\byou\b|\byour\b", v, re.I):
                rep.err(where, f"v[{j}] must be written directly to the agent (second person)")
            if "!" in v:
                rep.err(where, f"v[{j}] must not contain exclamation marks")
            if not v.rstrip().endswith("."):
                rep.err(where, f"v[{j}] must end with a period")
            if "\n" in v:
                rep.err(where, f"v[{j}] must be one paragraph")
            low = v.lower()
            for word in STRENGTH_BANNED:
                if re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", low):
                    rep.err(where, f"v[{j}] contains '{word}' (no claims of progress, metrics, or generalization)")
            openers[" ".join(v.split()[:2]).lower()] += 1
    missing = [sid for sid in catalog if sid not in seen]
    if missing:
        rep.err(fname, f"missing strengths: {missing}")
    for opener, n in openers.items():
        if total_variations and n > max(6, total_variations * 0.15):
            rep.warn(fname, f"{n} variations start with '{opener}'; vary the openings")
    dupes = [v for v, n in Counter(all_v).items() if n > 1]
    if dupes:
        rep.err(fname, f"{len(dupes)} duplicate variation(s)")


def validate_sales_toolkit(path, meta, rep, opp_ids):
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return
    strength_ids = {s["id"] for s in meta["strengthCatalog"]}

    def text(where, value, field, optional=False, agent=False):
        if optional and value == "":
            return
        check_text(rep, where, value, "sales-toolkit", field, allow_agent=agent)

    for key in ("intro", "notOffer", "objectionPrinciple"):
        text(fname, d.get(key), key)
    steps = d.get("steps", [])
    if [s.get("title") for s in steps] != ["Understand", "Empathize", "Assure", "Probe", "Resolve", "Confirm", "Plant the Seed",
                                           "Relevant Offer", "Explain Pricing", "Confirm Understanding"]:
        rep.err(fname, "steps must be the ten sales flow steps in order")
    for group in ("steps", "skills"):
        for s in d.get(group, []):
            where = f"{fname}:{group}.{s.get('id')}"
            text(where, s.get("good"), "good")
            if group == "steps":
                text(where, s.get("say"), "say")
            gaps = s.get("gaps") or []
            if not gaps:
                rep.err(where, "needs at least one related opportunity")
            for g in gaps:
                if g not in opp_ids:
                    rep.err(where, f"unknown opportunity id '{g}'")
            if s.get("strength") is not None and s.get("strength") not in strength_ids:
                rep.err(where, f"unknown strength id '{s.get('strength')}'")
    offers = d.get("offers", [])
    if [o.get("id") for o in offers] != ["xm", "upgrade", "tv", "retention"]:
        rep.err(fname, "offers must be xm, upgrade, tv, retention in that order")
    for o in offers:
        where = f"{fname}:offers.{o.get('id')}"
        for key in ("title", "short", "summary", "seed", "bridge"):
            text(where, o.get(key), key)
        text(where, o.get("note"), "note", agent=True)
        for key, lo in (("fits", 3), ("questions", 3), ("value", 2), ("disclosure", 3)):
            items = o.get(key) or []
            if len(items) < lo:
                rep.err(where, f"'{key}' needs at least {lo} items")
            for i, item in enumerate(items):
                text(where, item, f"{key}[{i}]")
        for i, q in enumerate(o.get("questions") or []):
            if not q.endswith("?"):
                rep.err(where, f"questions[{i}] must end with '?'")
        obj = o.get("objection") or {}
        for key in ("says", "acknowledge", "clarify", "respond"):
            text(where, obj.get(key), f"objection.{key}")
    for ob in d.get("objections", []):
        where = f"{fname}:objections.{ob.get('id')}"
        for key in ("says", "acknowledge", "close"):
            text(where, ob.get(key), key)
        for key in ("clarify", "respond"):
            text(where, ob.get(key, ""), key, optional=True)
        if ob.get("guidance"):
            text(where, ob["guidance"], "guidance")
        if not ob.get("respond") and not ob.get("guidance"):
            rep.err(where, "needs either a response or guidance")
    signals = d.get("signals", [])
    if len(signals) < 6:
        rep.err(fname, "needs at least 6 buying signals")
    for i, sg in enumerate(signals):
        where = f"{fname}:signals[{i}]"
        for key in ("signal", "example", "next"):
            text(where, sg.get(key), key)


def validate_people_toolkit(path, meta, rep, opp_ids):
    """ABS & Attrition toolkit: conversation guides, stay questions, early warning signs, recognition."""
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return

    def text(where, value, field, lo=None, hi=None):
        check_text(rep, where, value, "people-toolkit", field)
        if isinstance(value, str):
            if lo is not None:
                need_range(rep, where, field, value, lo, hi)
            if "!" in value:
                rep.err(where, f"'{field}' must not contain exclamation marks")
            if re.search(r"\b(medical|diagnos|illness|sick note|doctor)", value, re.I):
                rep.err(where, f"'{field}' must not mention medical details")

    for key in ("intro", "privacy"):
        text(fname, d.get(key), key, 12, 70)
    steps = (d.get("attendance") or {}).get("steps") or []
    if not (6 <= len(steps) <= 9):
        rep.err(fname, "attendance.steps needs 6-9 steps")
    ids = set()
    for st in steps:
        where = f"{fname}:attendance.{st.get('id')}"
        if not isinstance(st.get("id"), str) or st["id"] in ids:
            rep.err(where, "each step needs a unique id")
        ids.add(st.get("id"))
        text(where, st.get("title"), "title", 1, 5)
        text(where, st.get("good"), "good", 8, 40)
        text(where, st.get("say"), "say", 8, 50)
    rtw = d.get("returnToWork") or {}
    text(f"{fname}:returnToWork", rtw.get("intro"), "intro", 10, 60)
    lines = rtw.get("lines") or []
    if not (3 <= len(lines) <= 6):
        rep.err(fname, "returnToWork.lines needs 3-6 lines")
    for i, ln in enumerate(lines):
        text(f"{fname}:returnToWork[{i}]", ln.get("label"), "label", 1, 5)
        text(f"{fname}:returnToWork[{i}]", ln.get("say"), "say", 8, 50)
    stay = d.get("stay") or {}
    text(f"{fname}:stay", stay.get("intro"), "intro", 10, 60)
    groups = stay.get("groups") or []
    if not (4 <= len(groups) <= 6):
        rep.err(fname, "stay.groups needs 4-6 groups")
    for g in groups:
        where = f"{fname}:stay.{g.get('id')}"
        text(where, g.get("title"), "title", 1, 5)
        qs = g.get("questions") or []
        if not (3 <= len(qs) <= 5):
            rep.err(where, "needs 3-5 questions")
        for i, q in enumerate(qs):
            text(where, q, f"questions[{i}]", 6, 30)
            if isinstance(q, str) and not q.endswith("?"):
                rep.err(where, f"questions[{i}] must end with '?'")
    signs = d.get("signs") or []
    if not (7 <= len(signs) <= 12):
        rep.err(fname, "signs needs 7-12 early warning signs")
    for sg in signs:
        where = f"{fname}:signs.{sg.get('id')}"
        text(where, sg.get("sign"), "sign", 2, 10)
        text(where, sg.get("detail"), "detail", 8, 40)
        text(where, sg.get("action"), "action", 8, 45)
        opps = sg.get("opps") or []
        if not opps:
            rep.err(where, "needs at least one related opportunity")
        for o in opps:
            if o not in opp_ids:
                rep.err(where, f"unknown opportunity id '{o}'")
    rec = d.get("recognition") or {}
    text(f"{fname}:recognition", rec.get("intro"), "intro", 10, 60)
    ideas = rec.get("ideas") or []
    if not (6 <= len(ideas) <= 12):
        rep.err(fname, "recognition.ideas needs 6-12 ideas")
    for i, idea in enumerate(ideas):
        text(f"{fname}:recognition.ideas[{i}]", idea.get("title"), "title", 1, 6)
        text(f"{fname}:recognition.ideas[{i}]", idea.get("detail"), "detail", 8, 40)
    shout = rec.get("shoutouts") or []
    if not (3 <= len(shout) <= 6):
        rep.err(fname, "recognition.shoutouts needs 3-6 templates")
    for i, t in enumerate(shout):
        text(f"{fname}:recognition.shoutouts[{i}]", t, f"shoutouts[{i}]", 10, 50)


def validate_call_reviews(path, meta, rep, opp_ids):
    """Call review checklists for Technical Support, Billing, and Customer Service calls."""
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return
    strength_ids = {s["id"] for s in meta["strengthCatalog"]}
    kpis = {k["id"] for k in meta["kpis"]}
    types = d.get("types") or []
    if [t.get("id") for t in types] != ["tech", "billing", "service"]:
        rep.err(fname, "types must be tech, billing, service in that order")
    for t in types:
        tw = f"{fname}:{t.get('id')}"
        check_text(rep, tw, t.get("label"), "call-reviews", "label")
        check_text(rep, tw, t.get("intro"), "call-reviews", "intro")
        seen = set()
        steps, skills = t.get("steps") or [], t.get("skills") or []
        if not (6 <= len(steps) <= 12) or not (3 <= len(skills) <= 6):
            rep.err(tw, "needs 6-12 steps and 3-6 skills")
        for group, items in (("steps", steps), ("skills", skills)):
            for it in items:
                where = f"{tw}.{group}.{it.get('id')}"
                if not isinstance(it.get("id"), str) or it["id"] in seen:
                    rep.err(where, "ids must be unique within a call type")
                seen.add(it.get("id"))
                check_text(rep, where, it.get("title"), "call-reviews", "title")
                check_text(rep, where, it.get("good"), "call-reviews", "good")
                if isinstance(it.get("good"), str):
                    need_range(rep, where, "good", it["good"], 8, 40)
                if "say" in it:
                    check_text(rep, where, it["say"], "call-reviews", "say")
                gaps = it.get("gaps") or []
                if not gaps:
                    rep.err(where, "needs at least one related opportunity")
                for g in gaps:
                    if g not in opp_ids:
                        rep.err(where, f"unknown opportunity id '{g}'")
                if it.get("strength") is not None and it.get("strength") not in strength_ids:
                    rep.err(where, f"unknown strength id '{it.get('strength')}'")
                for k in it.get("kpi") or []:
                    if k not in kpis:
                        rep.err(where, f"unknown KPI '{k}'")


def validate_leader(path, meta, rep, opp_ids):
    """Run the Session steps and the Coach the Coach observation checklist."""
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return
    sources = {None, "strength", "questions", "challenges", "plan", "followup"}
    steps = d.get("session") or []
    if [s.get("id") for s in steps] != ["open", "strength", "ask", "observe", "plan", "followup", "close"]:
        rep.err(fname, "session steps must be open, strength, ask, observe, plan, followup, close")
    for st in steps:
        where = f"{fname}:session.{st.get('id')}"
        check_text(rep, where, st.get("title"), "leader", "title")
        check_text(rep, where, st.get("tip"), "leader", "tip", allow_agent=True)
        if st.get("source") not in sources:
            rep.err(where, f"unknown source '{st.get('source')}'")
        for i, line in enumerate(st.get("say") or []):
            check_text(rep, where, line, "leader", f"say[{i}]")
            need_range(rep, where, f"say[{i}]", line, 6, 40)
        if not st.get("say") and not st.get("source"):
            rep.err(where, "needs model lines or a Builder source")
    items = d.get("observe") or []
    if not (8 <= len(items) <= 14):
        rep.err(fname, "observe needs 8-14 items")
    ids = set()
    for it in items:
        where = f"{fname}:observe.{it.get('id')}"
        if it.get("id") in ids:
            rep.err(where, "duplicate id")
        ids.add(it.get("id"))
        check_text(rep, where, it.get("title"), "leader", "title", allow_agent=True)
        for k in ("good", "gap"):
            # Written to the team leader, so "the agent" is the right way to refer to the person coached.
            check_text(rep, where, it.get(k), "leader", k, allow_agent=True)
            need_range(rep, where, k, it.get(k) or "", 8, 32)
        if not re.search(r"\byou\b|\byour\b", it.get("good") or "", re.I):
            rep.err(where, "'good' must be written to the leader in the second person")
        for word in STRENGTH_BANNED:
            if re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", (it.get("good") or "").lower()):
                rep.err(where, f"'good' contains '{word}'")


def validate_practice(path, meta, rep, opp_ids):
    """Practice Lab role-play scenarios, scored against the Call Review steps."""
    fname = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    except Exception as exc:  # noqa: BLE001
        rep.err(fname, f"invalid JSON: {exc}")
        return
    with open(os.path.join(DATA, "call_reviews.json"), encoding="utf-8") as fh:
        steps = {t["id"]: {i["id"] for i in t["steps"] + t["skills"]} for t in json.load(fh)["types"]}
    with open(os.path.join(DATA, "sales_toolkit.json"), encoding="utf-8") as fh:
        st = json.load(fh)
        steps["sales"] = {i["id"] for i in st["steps"] + st["skills"]}
    check_text(rep, fname, d.get("intro"), "practice", "intro")
    scen = d.get("scenarios") or []
    if not (8 <= len(scen) <= 30):
        rep.err(fname, "needs 8-30 scenarios")
    ids = set()
    for sc in scen:
        where = f"{fname}:{sc.get('id')}"
        if not isinstance(sc.get("id"), str) or not sc["id"].startswith("pr-") or sc["id"] in ids:
            rep.err(where, "ids must be unique and start with 'pr-'")
        ids.add(sc.get("id"))
        if sc.get("type") not in steps:
            rep.err(where, f"unknown call type '{sc.get('type')}'")
            continue
        for k in sc.get("kpi") or []:
            if k not in KPIS:
                rep.err(where, f"unknown KPI '{k}'")
        if sc.get("level") not in (1, 2, 3) or not isinstance(sc.get("minutes"), int) or not (3 <= sc["minutes"] <= 20):
            rep.err(where, "level must be 1-3 and minutes 3-20")
        check_text(rep, where, sc.get("title"), "practice", "title")
        check_text(rep, where, sc.get("brief"), "practice", "brief")
        need_range(rep, where, "brief", sc.get("brief") or "", 10, 45)
        # Written to the team leader playing the customer, so "the agent" is right here.
        check_text(rep, where, sc.get("persona"), "practice", "persona", allow_agent=True)
        need_range(rep, where, "persona", sc.get("persona") or "", 20, 90)
        lines = sc.get("lines") or []
        if not (3 <= len(lines) <= 7):
            rep.err(where, "needs 3-7 customer lines")
        for i, ln in enumerate(lines):
            check_text(rep, where, ln.get("when"), "practice", f"lines[{i}].when", allow_agent=True)
            check_text(rep, where, ln.get("say"), "practice", f"lines[{i}].say")
        rub = sc.get("rubric") or []
        if not (3 <= len(rub) <= 6):
            rep.err(where, "needs 3-6 rubric items")
        seen = set()
        for i, r in enumerate(rub):
            if r.get("step") not in steps[sc["type"]]:
                rep.err(where, f"rubric[{i}] step '{r.get('step')}' is not a {sc['type']} review step")
            if r.get("step") in seen:
                rep.err(where, f"rubric[{i}] repeats step '{r.get('step')}'")
            seen.add(r.get("step"))
            check_text(rep, where, r.get("look"), "practice", f"rubric[{i}].look", allow_agent=True)
        for i, m in enumerate(sc.get("model") or []):
            check_text(rep, where, m, "practice", f"model[{i}]")
            need_range(rep, where, f"model[{i}]", m, 5, 40)
        if not sc.get("model"):
            rep.err(where, "needs model lines")
        for i, q in enumerate(sc.get("debrief") or []):
            check_text(rep, where, q, "practice", f"debrief[{i}]")
            if not q.endswith("?"):
                rep.err(where, f"debrief[{i}] must be a question")
        if not sc.get("debrief"):
            rep.err(where, "needs debrief questions")


def main(argv):
    strict = "--strict" in argv
    files = [a for a in argv if not a.startswith("--")]
    with open(os.path.join(DATA, "meta.json"), encoding="utf-8") as fh:
        meta = json.load(fh)
    if not files:
        files = [os.path.join(DATA, c["file"]) for c in meta["categories"]]
        files.append(os.path.join(DATA, "strengths.json"))
        files.append(os.path.join(DATA, "sales_toolkit.json"))
        files.append(os.path.join(DATA, "people_toolkit.json"))
        files.append(os.path.join(DATA, "call_reviews.json"))
        files.append(os.path.join(DATA, "leader.json"))
        files.append(os.path.join(DATA, "practice.json"))
        files = [f for f in files if os.path.exists(f)]
    rep = Report()
    all_sentences = defaultdict(list)
    all_fragments = defaultdict(list)
    count = 0
    opp_ids = set()
    for c in meta["categories"]:
        p = os.path.join(DATA, c["file"])
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8") as fh:
                    opp_ids.update(e.get("id") for e in json.load(fh) if isinstance(e, dict))
            except Exception:  # noqa: BLE001
                pass
    # Entries that meta.json requires count as known, so toolkits can be written before their category file.
    opp_ids.update(r[0] for reqs in meta["required"].values() for r in reqs)
    for f in files:
        if os.path.basename(f) == "strengths.json":
            validate_strengths(f, meta, rep)
        elif os.path.basename(f) == "sales_toolkit.json":
            validate_sales_toolkit(f, meta, rep, opp_ids)
        elif os.path.basename(f) == "people_toolkit.json":
            validate_people_toolkit(f, meta, rep, opp_ids)
        elif os.path.basename(f) == "leader.json":
            validate_leader(f, meta, rep, opp_ids)
        elif os.path.basename(f) == "practice.json":
            validate_practice(f, meta, rep, opp_ids)
        elif os.path.basename(f) == "call_reviews.json":
            validate_call_reviews(f, meta, rep, opp_ids)
        else:
            count += len(validate_opps(f, meta, rep, all_sentences, all_fragments))
    for s, where in all_sentences.items():
        if len(where) > 1 and len(s.split()) >= 6:
            rep.err("duplicate sentence", f"'{s[:90]}' appears in {where}")
    for (k, s), where in all_fragments.items():
        if len(where) > 1:
            rep.err("duplicate builder fragment", f"b.{k} '{s[:80]}' appears in {where}")
    for line in rep.errors + rep.warnings:
        print(line)
    print(f"\nChecked {len(files)} file(s), {count} opportunity entries: "
          f"{len(rep.errors)} error(s), {len(rep.warnings)} warning(s).")
    if rep.errors or (strict and rep.warnings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
