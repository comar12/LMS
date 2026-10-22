"""Build the self-contained interactive HTML dashboard from the tracker + roster.
Usage: python3 build_html_dashboard.py OUT.html TRACKER.xlsx ROSTER.xlsx [ROSTER2.xlsx@YYYY-MM-DD ...] [HANDOVER.xlsb ...] [TEMPLATE.html]
Extra rosters take effect from the date after "@" (sales before it keep the earlier roster's teams).
Every .xlsb argument is a daily TSX handover; its calls are embedded per business day."""
import sys, os, json, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tsx_data import load
import pandas as pd

OUT, TRACKER, ROSTER = sys.argv[1], sys.argv[2], sys.argv[3]
EXTRA = sys.argv[4:]
HANDOVERS = [x for x in EXTRA if x.lower().endswith(".xlsb")]
ROSTERS = [ROSTER] + [x for x in EXTRA if "@" in x and x.partition("@")[0].lower().endswith(".xlsx")]
TPL = [x for x in EXTRA if x.lower().endswith(".html")]
TEMPLATE = TPL[0] if TPL else os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard_template.html")
d = load(TRACKER, ROSTERS); s, r = d["s"], d["r"]
yn = lambda v: "Y" if v == "Yes" else ("N" if v == "No" else "")
rows = []
for _, x in s.iterrows():
    types = [p.strip() for p in str(x["Type of GSR"] or "").split(";") if p.strip()] if pd.notna(x["Type of GSR"]) else []
    rows.append([x["Date"].strftime("%Y-%m-%d"), x["hr_key"], x["TL"], x["OM"], int(x["xm"]), int(x["gsr"]), yn(x["Did you add XMC?"]), yn(x["Did you Activate the E-SIM?"]),
                 x["device"], x["promo"], int(x["dup"]), int(x["in_roster"]), int(x["order_valid"]), types, int(x["ID"]), int(x["ct"].hour), ("E" if x["What is the type of the SIM"]=="E-sim" else "P" if x["What is the type of the SIM"]=="Physical SIM" else "")])
rlist = lambda df: [[a["HRID"], a["Agent Name"], a["Team Leader"], a["Ops Manager"], a["Phase"], a["Tenure Bucket"], a["Wave"]] for _, a in df.iterrows()]
roster = rlist(r)
data = {"meta": {"minDate": min(d["dates"]).isoformat(), "maxDate": d["MAXD"].isoformat(), "defFrom": d["DEF_FROM"].isoformat(), "built": dt.date.today().strftime("%d %b %Y"), "rows": len(rows), "source": "Source: Sales Tracker (Microsoft Forms)", "rosterName": d["epochs"][-1]["name"], "rosterFrom": d["epochs"][-1]["from"], "rosterAt": int(max(os.path.getmtime(x.partition("@")[0]) for x in ROSTERS) * 1000)},
        "rows": rows, "roster": roster, "tls": d["tls"], "oms": d["oms"],
        "rosters": [{"from": e["from"], "name": e["name"], "roster": rlist(e["r"])} for e in d["epochs"][:-1]]}
if HANDOVERS:
    from calls_data import load_calls
    data["calls"] = load_calls(HANDOVERS)
    for day, v in sorted(data["calls"]["days"].items()):
        print("calls", day, v["src"], "handled", sum(a[1] for a in v["a"]), "agents", len(v["a"]))
js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = open(TEMPLATE, encoding="utf-8").read()
assert html.count("__DATA__") == 1
open(OUT, "w", encoding="utf-8").write(html.replace("__DATA__", js))
print("saved", OUT, round(os.path.getsize(OUT) / 1024), "KB", "rows", len(rows), "roster", len(roster))
