"""Parse the fiscal-month TSX export into dashboard performance records (mirrors readPerformance)."""
import json, re, sys, openpyxl

path, as_of, out = sys.argv[1], sys.argv[2], sys.argv[3]
ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
hi = next(i for i, r in enumerate(rows[:25]) if any(str(x or '').strip().lower() == 'agent | nt' for x in r))
headers = rows[hi]
norm = lambda v: re.sub(r'[^a-z0-9]', '', str(v or '').strip().lower())
col = {}
for c, h in enumerate(headers):
    col.setdefault(norm(h), c)  # first block = FISCAL MONTH 2026-10 (identical to Total block)

def number(v):
    if v is None or v == '' or re.fullmatch(r'[\s–—-]+', str(v)): return None
    s = re.sub(r'[%,$\s]', '', str(v))
    try: n = float(s)
    except ValueError: return None
    return int(n) if n.is_integer() and not isinstance(v, str) else n

records, warnings, skipped, seen = [], [], 0, set()
for r in rows[hi + 1:]:
    m = re.search(r'bp-[a-z0-9]+', str(r[0] or ''), re.I)
    if not m: skipped += 1; continue
    bpid = m.group(0).lower()
    if bpid in seen: raise SystemExit(f'Duplicate row {bpid}')
    seen.add(bpid)
    calls, surveys = number(r[col['interactionshandled']]), number(r[col['tnpssurveycount']])
    tnps, aicr = number(r[col['tnps']]), number(r[col['aicr']])
    xm, gsr = number(r[col['tmlinessold']]), number(r[col['gsr2026']])
    if all(v is None for v in (calls, surveys, tnps, aicr, xm, gsr)): continue
    for v in (calls, surveys, xm):
        if v is not None and (v < 0 or v != int(v)): raise SystemExit(f'Invalid count {bpid}')
    if (tnps is not None and not -100 <= tnps <= 100) or (aicr is not None and not 0 <= aicr <= 100) or (gsr is not None and gsr < 0):
        raise SystemExit(f'Invalid percentage {bpid}')
    if gsr is not None and gsr > 100: warnings.append(f'{bpid} on {as_of}: GSR 2026 is {gsr}% in the source; preserved as reported.')
    records.append(dict(bpid=bpid, name=str(r[0]).split('|')[0].strip(), site='VXI Global - Cairo', date=as_of,
                        calls=None if calls is None else int(calls), surveys=None if surveys is None else int(surveys),
                        tnps=tnps, aicr=aicr, xm=None if xm is None else int(xm), gsr2026=gsr))
json.dump(dict(records=records, dates=[as_of], sheet=ws.title, skipped=skipped, warnings=warnings), open(out, 'w'))
print(len(records), 'records;', skipped, 'skipped;', len(warnings), 'warnings')
