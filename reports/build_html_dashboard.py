"""Build the self-contained interactive HTML dashboard from the tracker + roster.
Usage: python3 build_html_dashboard.py OUT.html TRACKER.xlsx ROSTER.xlsx [TEMPLATE.html]"""
import sys, os, json, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tsx_data import load
import pandas as pd

OUT, TRACKER, ROSTER = sys.argv[1], sys.argv[2], sys.argv[3]
TEMPLATE = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard_template.html")
d = load(TRACKER, ROSTER); s, r = d["s"], d["r"]
yn = lambda v: "Y" if v == "Yes" else ("N" if v == "No" else "")
rows = []
for _, x in s.iterrows():
    types = [p.strip() for p in str(x["Type of GSR"] or "").split(";") if p.strip()] if pd.notna(x["Type of GSR"]) else []
    rows.append([x["Date"].strftime("%Y-%m-%d"), x["hr_key"], x["TL"], x["OM"], int(x["xm"]), int(x["gsr"]), yn(x["Did you add XMC?"]), yn(x["Did you Activate the E-SIM?"]),
                 x["device"], x["promo"], int(x["dup"]), int(x["in_roster"]), int(x["order_valid"]), types, int(x["ID"]), int(x["ct"].hour)])
roster = [[a["HRID"], a["Agent Name"], a["Team Leader"], a["Ops Manager"], a["Phase"], a["Tenure Bucket"], a["Wave"]] for _, a in r.iterrows()]
data = {"meta": {"minDate": min(d["dates"]).isoformat(), "maxDate": d["MAXD"].isoformat(), "defFrom": d["DEF_FROM"].isoformat(), "built": dt.date.today().strftime("%d %b %Y"), "rows": len(rows), "source": "Source: Sales Tracker (Microsoft Forms)"},
        "rows": rows, "roster": roster, "tls": d["tls"], "oms": d["oms"]}
js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = open(TEMPLATE, encoding="utf-8").read()
assert html.count("__DATA__") == 1
open(OUT, "w", encoding="utf-8").write(html.replace("__DATA__", js))
print("saved", OUT, round(os.path.getsize(OUT) / 1024), "KB", "rows", len(rows), "roster", len(roster))
