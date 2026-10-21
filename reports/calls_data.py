"""Read the daily TSX handover workbook (.xlsb) into compact per-agent call figures.

One handover = one business day. Per agent we keep handled calls, AHT (seconds),
transferred calls and handled calls per hour of the shift (Cairo 14:00 -> 07:00).
The interval sheet (D-Agent) is in US Eastern time; Cairo is 7 hours ahead all year
for this shift, so EST hour h maps to Cairo hour (h + 7) % 24.
"""
import datetime as dt
from collections import defaultdict
from pyxlsb import open_workbook

SHIFT = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]
EPOCH = dt.date(1899, 12, 30)


def _rows(wb, name):
    with wb.get_sheet(name) as sh:
        for r in sh.rows():
            yield [c.v for c in r]


def _num(v):
    return float(v) if isinstance(v, (int, float)) else 0.0


def read_handover(path, lob="EG TSX 4P"):
    """Calls come from the D-Agent interval table, exactly as the handover's own
    'Performance per OM' sheet sums them: Handled Calls, IN THT and TRANSFERRED per
    row, attributed by the table's HRID column, for rows of the given LOB.
    Rows that look repeated are separate calls (different talk times), so none are dropped."""
    with open_workbook(path) as wb:
        if "D-Agent" not in wb.sheets:
            raise ValueError(f"{path}: no 'D-Agent' sheet - is this the TSX handover?")
        it = _rows(wb, "D-Agent")
        hdr = next(it)
        ix = {str(h).strip(): i for i, h in enumerate(hdr) if h not in (None, "")}
        need = ["Date", "Time", "Handled Calls", "IN THT", "TRANSFERRED", "HRID", "LOB"]
        miss = [n for n in need if n not in ix]
        if miss:
            raise ValueError(f"{path}: D-Agent is missing {', '.join(miss)}")
        day = None
        acc = defaultdict(lambda: {"h": 0, "tht": 0.0, "tr": 0, "hours": [0] * len(SHIFT)})
        for r in it:
            if not r or len(r) <= max(ix.values()) or not isinstance(r[ix["Date"]], (int, float)):
                continue
            if lob and str(r[ix["LOB"]]).strip() != lob:
                continue
            hrv = r[ix["HRID"]]
            hr = str(int(hrv)) if isinstance(hrv, (int, float)) else str(hrv or "").strip()
            if not hr or hr in ("-", "0"):
                continue
            day = day or EPOCH + dt.timedelta(days=int(r[ix["Date"]]))
            h = _num(r[ix["Handled Calls"]])
            o = acc[hr]
            o["h"] += h; o["tht"] += _num(r[ix["IN THT"]]); o["tr"] += _num(r[ix["TRANSFERRED"]])
            if h:
                cairo = (int(_num(r[ix["Time"]]) * 24 + 1e-6) + 7) % 24
                if cairo in SHIFT:
                    o["hours"][SHIFT.index(cairo)] += int(h)
    if day is None:
        raise ValueError(f"{path}: no {lob} rows with a date in D-Agent")
    out = []
    for hr, o in acc.items():
        if o["h"]:
            out.append([hr, int(o["h"]), int(o["h"]), int(o["tht"] / o["h"] + 0.5), int(o["tr"]), o["hours"]])
    return day.isoformat(), out


def load_calls(paths):
    days = {}
    for p in paths:
        d, agents = read_handover(p)
        days[d] = {"src": p.split("/")[-1], "a": agents}
    return {"shift": SHIFT, "days": days}


if __name__ == "__main__":
    import sys, json
    c = load_calls(sys.argv[1:])
    for d, v in c["days"].items():
        tot = sum(a[1] for a in v["a"]); hsum = sum(sum(a[5]) for a in v["a"])
        print(d, v["src"], "agents", len(v["a"]), "handled", tot, "interval", hsum)
