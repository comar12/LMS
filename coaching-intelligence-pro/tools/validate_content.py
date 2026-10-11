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
        if not isinstance(kpi, list) or not kpi or not set(kpi) <= KPIS or len(set(kpi)) != len(kpi):
            rep.err(where, f"'kpi' must be a non-empty subset of {sorted(KPIS)}")

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
            for tok in ("{duration}", "{calls}", "{followup}"):
                if tok not in e["plan"]:
                    rep.err(where, f"'plan' must include the token {tok}")
            plan_openers[" ".join(e["plan"].split()[:3]).lower()] += 1
        if isinstance(e["followup"], str):
            need_range(rep, where, "followup", e["followup"], 35, 110)
            for tok in ("{calls}", "{followup}"):
                if tok not in e["followup"]:
                    rep.err(where, f"'followup' must include the token {tok}")
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


def main(argv):
    strict = "--strict" in argv
    files = [a for a in argv if not a.startswith("--")]
    with open(os.path.join(DATA, "meta.json"), encoding="utf-8") as fh:
        meta = json.load(fh)
    if not files:
        files = [os.path.join(DATA, c["file"]) for c in meta["categories"]]
        files.append(os.path.join(DATA, "strengths.json"))
        files = [f for f in files if os.path.exists(f)]
    rep = Report()
    all_sentences = defaultdict(list)
    all_fragments = defaultdict(list)
    count = 0
    for f in files:
        if os.path.basename(f) == "strengths.json":
            validate_strengths(f, meta, rep)
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
