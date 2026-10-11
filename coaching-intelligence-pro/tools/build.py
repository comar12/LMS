#!/usr/bin/env python3
"""Build the single-file offline app: VXI_Coaching_Intelligence_Pro.html

Inlines src/styles.css, every src/js/*.js module (in file-name order), and all
content from src/data/*.json into src/template.html. The result has no external
dependencies and makes no network requests.

Usage:
  python3 tools/build.py            # build
  python3 tools/build.py --check    # build, then syntax-check the generated JavaScript with Node
  python3 tools/build.py --links my-links.json --out My_Copy.html
                                    # personal copy with Quick Links preloaded (keep that JSON out of git)
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "VXI_Coaching_Intelligence_Pro.html")


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def load_json(rel):
    with open(os.path.join(SRC, rel), encoding="utf-8") as fh:
        return json.load(fh)


def load_seed_links(path):
    """A personal list of Quick Links: [{"name", "url", "group", "tag", "note", "pinned"}]."""
    if not path:
        return []
    with open(path, encoding="utf-8") as fh:
        links = json.load(fh)
    if not isinstance(links, list) or not all(isinstance(l, dict) and str(l.get("name", "")).strip() for l in links):
        raise SystemExit(f"{path}: expected a list of links, each with a name")
    keys = ("name", "url", "group", "tag", "note", "pinned")
    return [{k: l[k] for k in keys if k in l} for l in links]


def build_data(links_path=None):
    meta = load_json("data/meta.json")
    opps = []
    for cat in meta["categories"]:
        entries = load_json(os.path.join("data", cat["file"]))
        for e in entries:
            if e.get("cat") != cat["id"]:
                raise SystemExit(f"{cat['file']}: entry {e.get('id')} has cat {e.get('cat')!r}, expected {cat['id']!r}")
        opps.extend(entries)
    raw = {s["id"]: s for s in load_json("data/strengths.json")}
    strengths = []
    for c in meta["strengthCatalog"]:
        if c["id"] not in raw:
            raise SystemExit(f"strengths.json is missing {c['id']}")
        s = raw[c["id"]]
        strengths.append({"id": c["id"], "group": c["group"], "title": c["title"], "desc": c["desc"], "kw": s["kw"], "v": s["v"]})
    ids = [o["id"] for o in opps] + [s["id"] for s in strengths]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate ids across content files")
    return {
        "meta": {
            "categories": [{k: v for k, v in c.items() if k != "file"} for c in meta["categories"]],
            "kpis": meta["kpis"],
            "themes": meta["themes"],
            "strengthGroups": meta["strengthGroups"],
            "opposites": meta["opposites"],
        },
        "opps": opps,
        "strengths": strengths,
        "guides": load_json("data/guides.json"),
        "salesToolkit": load_json("data/sales_toolkit.json"),
        "seedLinks": load_seed_links(links_path),
    }


def build(check=False, links_path=None, out=OUT):
    data = build_data(links_path)
    data_js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # Never allow the inlined data to terminate the script element.
    data_js = data_js.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    modules = sorted(glob.glob(os.path.join(SRC, "js", "*.js")))
    js = "\n".join(read(p) for p in modules)
    app = "(function () {\n'use strict';\nconst DATA = " + data_js + ";\n" + js + "\n})();\n"
    if "</script" in app.lower():
        raise SystemExit("Generated JavaScript contains '</script'")
    template = read(os.path.join(SRC, "template.html"))
    css = read(os.path.join(SRC, "styles.css"))
    if "/*__STYLES__*/" not in template or "/*__APP__*/" not in template:
        raise SystemExit("template.html is missing a placeholder")
    html = template.replace("/*__STYLES__*/", css.strip()).replace("/*__APP__*/", app.strip())
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    size = os.path.getsize(out)
    extra = f", {len(data['seedLinks'])} preset links" if data["seedLinks"] else ""
    print(f"Built {os.path.relpath(out, ROOT)}: {size / 1024:.1f} KB, {len(data['opps'])} opportunities, {len(data['strengths'])} strengths, {len(modules)} JS modules{extra}")
    if check:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
            tmp.write(app)
            tmp_path = tmp.name
        try:
            result = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
            if result.returncode != 0:
                print(result.stderr)
                raise SystemExit("JavaScript syntax check failed")
            print("JavaScript syntax check passed")
        finally:
            os.unlink(tmp_path)


def arg_value(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 >= len(sys.argv):
            raise SystemExit(f"{flag} needs a file path")
        return os.path.abspath(sys.argv[i + 1])
    return None


if __name__ == "__main__":
    build(check="--check" in sys.argv, links_path=arg_value("--links"), out=arg_value("--out") or OUT)
