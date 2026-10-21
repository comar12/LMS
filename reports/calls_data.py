"""Read the daily TSX handover workbook (.xlsb) into compact per-agent call figures.

One handover = one business day. Per agent we keep handled, answered, AHT (seconds),
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


def read_handover(path):
    with open_workbook(path) as wb:
        names = wb.sheets
        if "Performance per Agent" not in names:
            raise ValueError(f"{path}: no 'Performance per Agent' sheet - is this the TSX handover?")
        pa = list(_rows(wb, "Performance per Agent"))
        hi = next(i for i, r in enumerate(pa) if r and r[0] == "HRID")
        ix = {h: i for i, h in enumerate(pa[hi]) if h}
        agents, login2hr = {}, {}
        for r in pa[hi + 1:]:
            if not r or not isinstance(r[0], (int, float)):
                continue
            hr = str(int(r[0]))
            if isinstance(r[ix["AVAYA ID"]], (int, float)):
                login2hr[int(r[ix["AVAYA ID"]])] = hr
            aht = r[ix["AHT"]]
            agents[hr] = [hr, int(_num(r[ix["Handled Calls"]])), int(_num(r[ix["Answered Calls"]])),
                          int(aht + 0.5) if isinstance(aht, (int, float)) else 0, int(_num(r[ix["Transferred Calls"]]))]
        # interval calls (deduplicated: the export repeats rows)
        day, seen, hourly = None, {}, defaultdict(lambda: [0] * len(SHIFT))
        if "D-Agent" in names:
            started = False
            for r in _rows(wb, "D-Agent"):
                if not started:
                    started = bool(r) and r[0] == "Date" and r[1] in (None, "") and len(r) > 6
                    continue
                if not r or not isinstance(r[0], (int, float)) or not isinstance(r[3], (int, float)):
                    continue
                day = day or EPOCH + dt.timedelta(days=int(r[0]))
                seen[(int(r[3]), round(float(r[1]) * 48), r[5])] = _num(r[6])
            for (login, half, _skill), calls in seen.items():
                hr = login2hr.get(login)
                if not hr or not calls:
                    continue
                cairo = (half // 2 + 7) % 24
                if cairo in SHIFT:
                    hourly[hr][SHIFT.index(cairo)] += int(calls)
        if day is None and "Hourly Figures" in names:
            for r in _rows(wb, "Hourly Figures"):
                if len(r) > 2 and r[1] == "From" and isinstance(r[2], (int, float)):
                    day = EPOCH + dt.timedelta(days=int(r[2]))
                    break
    if day is None:
        raise ValueError(f"{path}: could not find the handover date")
    out = []
    for hr, a in agents.items():
        h = hourly.get(hr, [0] * len(SHIFT))
        if a[1] or a[2] or any(h):
            out.append(a + [h])
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
