"""Shared cleaning for the TSX sales tracker + roster. Used by the Excel and HTML builders."""
import os, re, datetime as dt
import pandas as pd, numpy as np

# Same leader spelled differently across roster files -> one name, so their trend stays continuous
TL_ALIAS = {"Mohamed Kelany": "Mohamed EL-Kelany", "Eslam Farouk": "Islam Farouk"}

def tenure_bucket(days):
    if pd.isna(days): return "-"
    return "0-30" if days < 30 else "30-60" if days < 60 else "60-120" if days < 120 else "120+"

def read_roster(path, as_of=None, prev=None):
    """Roster as one row per agent: HRID, Agent Name, Team Leader, Ops Manager, Phase, Tenure Bucket, Wave, LOB Start Date, Tenure Days.
    Reads the original "Roster" sheet or the monthly HC layout (New TL / New Ops Manager, e.g. TSX November roster)."""
    xl = pd.ExcelFile(path)
    if "Roster" in xl.sheet_names:
        r = pd.read_excel(xl, sheet_name="Roster")
        r.columns = [str(c).strip() for c in r.columns]
        r = r[r["LOB"].notna()].copy()
        r["Tenure Days"] = pd.to_numeric(r["Tenurity"], errors="coerce")
        r["LOB Start Date"] = pd.to_datetime(r["LOB Start Date"], errors="coerce")
    else:
        sheet = next(n for n in xl.sheet_names if {"Agent Name", "New TL"} <= {str(c).strip() for c in pd.read_excel(xl, sheet_name=n, nrows=0).columns})
        r = pd.read_excel(xl, sheet_name=sheet)
        r.columns = [str(c).strip() for c in r.columns]
        r = r[r["HRID"].notna() & r["Agent Name"].notna()].copy()
        if "Status" in r: r = r[r["Status"].astype(str).str.strip().str.lower().isin(["active", "nan"])]
        if "Role" in r: r = r[r["Role"].astype(str).str.strip().str.lower().isin(["agent", "nan"])]
        tl = r["New TL"].where(r["New TL"].notna(), np.where(r["Phase"].astype(str).str.strip() == "Training", "Training", r.get("TEAM-2")))
        r["Team Leader"] = tl
        r["Ops Manager"] = r["New Ops Manager"]
        r["LOB Start Date"] = pd.to_datetime(r.get("Hiring Date"), errors="coerce").fillna(pd.to_datetime(r.get("PST Date"), errors="coerce"))
        ref = pd.Timestamp(as_of or dt.date.today())
        r["Tenure Days"] = (ref - r["LOB Start Date"]).dt.days
        r["Tenure Bucket"] = r["Tenure Days"].apply(tenure_bucket)
    r["HRID"] = r["HRID"].astype(str).str.extract(r"(\d+)")[0]
    r = r[r["HRID"].notna()].drop_duplicates("HRID")
    r["Agent Name"] = r["Agent Name"].astype(str).str.strip().str.title()
    r["Team Leader"] = r["Team Leader"].astype(str).str.strip().replace(TL_ALIAS)
    r["Ops Manager"] = r["Ops Manager"].astype(str).str.strip()
    r["Phase"] = r["Phase"].astype(str).str.strip()
    r["Wave"] = r["Wave"].astype(str).str.strip().str.replace(r"^Wav\s", "Wave ", regex=True)
    if prev is not None:  # no start date in this file -> keep the bucket the agent had on the previous roster
        pb = prev.set_index("HRID")["Tenure Bucket"]
        miss = r["Tenure Bucket"].isin(["-", "nan"]) | r["Tenure Bucket"].isna()
        r.loc[miss, "Tenure Bucket"] = r.loc[miss, "HRID"].map(pb).fillna("-")
    r = r.sort_values(["Team Leader", "Agent Name"]).reset_index(drop=True)
    r["Label"] = r["Agent Name"] + " (" + r["HRID"] + ")"
    return r

def parse_rosters(ROSTER):
    """ROSTER: a path, or a list of "path" / "path@YYYY-MM-DD" (the date the roster takes effect; the first one covers all earlier dates)."""
    items = [ROSTER] if isinstance(ROSTER, str) else list(ROSTER)
    epochs, prev = [], None
    for i, it in enumerate(items):
        path, _, frm = it.partition("@")
        frm = "" if i == 0 else frm
        r = read_roster(path, as_of=frm or None, prev=prev)
        epochs.append({"from": frm, "name": os.path.basename(path), "r": r}); prev = r
    return epochs

def read_tracker(path):
    """Sales Tracker submissions: the form export itself, or the "P Sales" tab of the sales tool workbook (any tab with the form's columns)."""
    xl = pd.ExcelFile(path)
    names = sorted(xl.sheet_names, key=lambda n: n != "P Sales")
    for n in names:
        cols = {str(c).strip() for c in pd.read_excel(xl, sheet_name=n, nrows=0).columns}
        if {"Completion time", "Line or GSR"} <= cols:
            return pd.read_excel(xl, sheet_name=n)
    return pd.read_excel(xl, sheet_name=0)

def load(TRACKER, ROSTER):
    s = read_tracker(TRACKER)
    epochs = parse_rosters(ROSTER)
    r = epochs[-1]["r"]
    roster = set().union(*[set(e["r"]["HRID"]) for e in epochs])
    rmap = r.set_index("HRID")
    emaps = [e["r"].set_index("HRID") for e in epochs]
    anymap = pd.concat(emaps[::-1])  # newest first: name/phase/tenure from the latest roster the agent is on
    anymap = anymap[~anymap.index.duplicated(keep="first")]

    def map_hrid(x):
        x = re.sub(r"\D", "", str(x).strip())
        if x in roster: return x
        if len(x) == 8 and x.startswith("100") and ("1000" + x[3:]) in roster: return "1000" + x[3:]
        if len(x) == 10 and x.startswith("10000") and ("1000" + x[5:]) in roster: return "1000" + x[5:]
        if len(x) == 10 and x.startswith("1000") and x[:9] in roster: return x[:9]
        return None

    s["ct"] = pd.to_datetime(s["Completion time"])
    s["Date"] = (s["ct"] - pd.Timedelta(hours=12)).dt.normalize()  # business day: 14:00 Cairo -> 07:00 next day (cut at noon)
    s["hr_raw"] = s["HRID"].fillna("").astype(str).str.strip()
    s["hr"] = s["hr_raw"].apply(map_hrid)
    s["in_roster"] = s["hr"].notna().astype(int)
    s["hr_key"] = s["hr"].fillna("UNMAPPED:" + s["hr_raw"].str.replace(r"\s+", " ", regex=True))
    s["Agent"] = s["hr"].map(anymap["Agent Name"]).fillna("Not in Roster")
    # team and manager come from the roster in force on the business day; an agent missing from it keeps their latest known team
    ep = np.zeros(len(s), dtype=int); ds = s["Date"].dt.strftime("%Y-%m-%d")
    for i, e in enumerate(epochs):
        if e["from"]: ep[(ds >= e["from"]).values] = i
    s["TL"] = s["hr"].map(anymap["Team Leader"]); s["OM"] = s["hr"].map(anymap["Ops Manager"])
    for i, m in enumerate(emaps):
        sel = (ep == i) & s["hr"].isin(m.index).values
        s.loc[sel, "TL"] = s.loc[sel, "hr"].map(m["Team Leader"]); s.loc[sel, "OM"] = s.loc[sel, "hr"].map(m["Ops Manager"])
    s["TL"] = s["TL"].fillna("Not in Roster"); s["OM"] = s["OM"].fillna("Not in Roster")
    s["Phase"] = s["hr"].map(anymap["Phase"]).fillna("-")
    s["Tenure"] = s["hr"].map(anymap["Tenure Bucket"]).fillna("-")
    s["Type"] = s["Line or GSR"].str.strip()
    s["xm"] = np.where(s["Type"] == "XM Lines", s["No. of XM Lines"].fillna(1), 0).astype(int)
    def _norm_types(v):  # the form now stores ["A","B"]; older entries are "A;B;"
        if not isinstance(v, str): return v
        t = v.strip()
        if t.startswith("["):
            try:
                import json
                arr = json.loads(t)
                if isinstance(arr, list): return ";".join(str(x).strip() for x in arr if str(x).strip())
            except ValueError:
                pass
        return v
    s["Type of GSR"] = s["Type of GSR"].map(_norm_types)
    types = s["Type of GSR"].fillna("").str.strip().str.strip(";")
    ntypes = types.apply(lambda t: len([p for p in t.split(";") if p.strip()]))
    gcount = s["Count of GSR"]
    s["gsr"] = np.where(s["Type"] == "GSRs", np.where(gcount.notna(), gcount.fillna(0), np.maximum(ntypes, 1)), 0).astype(int)
    s["units"] = s["xm"] + s["gsr"]
    def typeflag(name):
        has = types.str.contains(name, regex=False)
        return np.where(has, np.where(ntypes == 1, s["gsr"], 1), 0).astype(int)
    s["t_speed"] = typeflag("Speed Upgrade"); s["t_xpro"] = typeflag("X-PRO")
    s["t_lob"] = typeflag("Adding LOB"); s["t_mplus"] = typeflag("Mobile Plus"); s["t_xmc"] = typeflag("XMC")
    def clean_dev(v):
        if pd.isna(v): return ""
        t = str(v).strip().lower().replace("\xa0", " ")
        if "iphone" in t: return "iPhone"
        if "apple watch" in t: return "Apple Watch"
        if "samsung watch" in t: return "Samsung Watch"
        if "samsung" in t: return "Samsung"
        if "ipad" in t: return "iPad"
        if "motorola" in t: return "Motorola"
        if "byod" in t: return "BYOD"
        if t in {".", "no", "none", "0", "na", "1", "no ", "n/a"} or "no device" in t or "not solved" in t or "own device" in t or "no devices" in t or "just the line" in t: return "No Device"
        return "Other"
    s["device"] = s["Sold Device Type"].apply(clean_dev)
    def clean_promo(v):
        if pd.isna(v): return ""
        t = str(v).strip().lower()
        if "free line" in t: return "Free Line for 1 Year"
        if "byod" in t: return "BYOD"
        if "smart watch" in t or "watch" in t: return "Smart Watch Discount"
        if "port" in t: return "Port In"
        if "no promotion" in t: return "New Line with no promotions"
        if "trade" in t: return "Trade In"
        return "Other"
    s["promo"] = s["What was the promotion type"].apply(clean_promo)
    s["acct"] = s["Account Number:"].fillna("").astype(str).str.strip()
    s["order"] = s["Order Number"].fillna("").astype(str).str.strip()
    s["order_valid"] = s["order"].str.fullmatch(r"\d{6,20}").fillna(False).astype(int)
    s = s.sort_values("ct").reset_index(drop=True)
    key = s["hr_key"] + "|" + s["acct"] + "|" + s["order"] + "|" + s["Type"]
    s["dup"] = ((s["order_valid"] == 1) & key.duplicated(keep="first")).astype(int)
    nd = s[s["dup"] == 0]
    first = ~nd.duplicated(subset=["Date", "hr_key"], keep="first")
    s["day_first"] = 0; s.loc[nd.index[first], "day_first"] = 1
    s["Weekday"] = s["Date"].dt.strftime("%a")
    for c in ["Did you add XMC?", "What is the type of the SIM", "Did you Activate the E-SIM?"]:
        s[c] = s[c].fillna("").astype(str).str.strip()

    NS = len(s); LAST = NS + 1
    dates = sorted(s["Date"].dt.date.unique()); ND = len(dates)
    tls = sorted(set().union(*[set(e["r"]["Team Leader"]) for e in epochs])); oms = sorted(set().union(*[set(e["r"]["Ops Manager"]) for e in epochs]))
    MAXD = max(dates); DEF_TO = MAXD; DEF_FROM = MAXD - dt.timedelta(days=6)
    print("rows", NS, "dates", ND, "tls", len(tls), "unmatched", (s.in_roster == 0).sum(), "dups", s.dup.sum())

    return dict(s=s, r=r, rmap=rmap, roster=roster, epochs=epochs, NS=NS, LAST=LAST, dates=dates, ND=ND, tls=tls, oms=oms, MAXD=MAXD, DEF_TO=DEF_TO, DEF_FROM=DEF_FROM)
