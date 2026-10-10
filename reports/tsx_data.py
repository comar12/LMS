"""Shared cleaning for the TSX sales tracker + roster. Used by the Excel and HTML builders."""
import re, datetime as dt
import pandas as pd, numpy as np

def load(TRACKER, ROSTER):
    s = pd.read_excel(TRACKER)
    r = pd.read_excel(ROSTER, sheet_name="Roster")
    r.columns = [str(c).strip() for c in r.columns]
    r = r[r["LOB"].notna()].copy()
    r["HRID"] = r["HRID"].astype(str).str.extract(r"(\d+)")[0]
    r["Agent Name"] = r["Agent Name"].astype(str).str.strip().str.title()
    r["Team Leader"] = r["Team Leader"].astype(str).str.strip()
    r["Ops Manager"] = r["Ops Manager"].astype(str).str.strip()
    r["Tenure Days"] = pd.to_numeric(r["Tenurity"], errors="coerce")
    r["LOB Start Date"] = pd.to_datetime(r["LOB Start Date"], errors="coerce")
    r = r.sort_values(["Team Leader", "Agent Name"]).reset_index(drop=True)
    r["Label"] = r["Agent Name"] + " (" + r["HRID"] + ")"
    roster = set(r["HRID"])
    rmap = r.set_index("HRID")

    def map_hrid(x):
        x = re.sub(r"\D", "", str(x).strip())
        if x in roster: return x
        if len(x) == 8 and x.startswith("100") and ("1000" + x[3:]) in roster: return "1000" + x[3:]
        if len(x) == 10 and x.startswith("10000") and ("1000" + x[5:]) in roster: return "1000" + x[5:]
        if len(x) == 10 and x.startswith("1000") and x[:9] in roster: return x[:9]
        return None

    s["ct"] = pd.to_datetime(s["Completion time"])
    s["Date"] = (s["ct"] - pd.Timedelta(hours=12)).dt.normalize()  # business day: 15:00 Cairo -> 07:00 next day
    s["hr_raw"] = s["HRID"].fillna("").astype(str).str.strip()
    s["hr"] = s["hr_raw"].apply(map_hrid)
    s["in_roster"] = s["hr"].notna().astype(int)
    s["hr_key"] = s["hr"].fillna("UNMAPPED:" + s["hr_raw"].str.replace(r"\s+", " ", regex=True))
    s["Agent"] = s["hr"].map(rmap["Agent Name"]).fillna("Not in Roster")
    s["TL"] = s["hr"].map(rmap["Team Leader"]).fillna("Not in Roster")
    s["OM"] = s["hr"].map(rmap["Ops Manager"]).fillna("Not in Roster")
    s["Phase"] = s["hr"].map(rmap["Phase"]).fillna("-")
    s["Tenure"] = s["hr"].map(rmap["Tenure Bucket"]).fillna("-")
    s["Type"] = s["Line or GSR"].str.strip()
    s["xm"] = np.where(s["Type"] == "XM Lines", s["No. of XM Lines"].fillna(1), 0).astype(int)
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
    tls = sorted(r["Team Leader"].unique()); oms = sorted(r["Ops Manager"].unique())
    MAXD = max(dates); DEF_TO = MAXD; DEF_FROM = MAXD - dt.timedelta(days=6)
    print("rows", NS, "dates", ND, "tls", len(tls), "unmatched", (s.in_roster == 0).sum(), "dups", s.dup.sum())

    return dict(s=s, r=r, rmap=rmap, roster=roster, NS=NS, LAST=LAST, dates=dates, ND=ND, tls=tls, oms=oms, MAXD=MAXD, DEF_TO=DEF_TO, DEF_FROM=DEF_FROM)
