# Cairo Repair TSX (VXI) – Sales Tracker Findings Brief

Data: 3,695 tracker rows → 3,483 after removing 212 duplicate rows (233 units); 4,012 units (1,132 XM lines = 28%, 2,880 GSR = 72%) across 80 consecutive business days, 22 Jul – 9 Oct 2026. Roster 250 agents (133 Production, 117 Training), 14 TLs, 3 OMs. All cleaning via `tsx_data.load`; duplicates excluded everywhere. "All HC" = 250 roster agents, "Prod" = 133 Production agents. Machine-readable tables: `findings.json`.

## Executive summary

1. **The account runs at 0.28 units/agent/day against a 2.0 target (14% of target)** – 70.7 units/day over the last 30 days vs 500 required on 250 HC (266 on Production HC; 0.53/agent/day = 27% of target). No agent averaged ≥2/day over the last 30 days; 9 averaged ≥1.
2. **The gap is participation, not ticket size.** Only 1,047 of 7,500 agent-days (14%) had a sale; when an agent sells, they average 1.9 units that day. 104 of 250 agents (42%) have no sale in 7+ days; 75 have never sold.
3. **Volume is accelerating: Sep +91% vs Aug (61.2 vs 32.1 units/day), Oct-to-date 91.3/day.** Trend slope +0.81 units/day² over 80 days; +1.90 over the last 30. The last three days (125/144/184) are +3.7 to +4.9σ anomalies driven by breadth: distinct sellers/day jumped from ~35 to 69/74/86.
4. **Two Production teams (Shereen Kamal, Salma Ahmed) deliver 31% of all units;** six Training-heavy teams (111 agents) deliver 6%. Comparing all 14 TLs on one league table is unfair: Production teams average 12.8 units/head (last 30d) at 90% participation vs 2.3 and 43% for Training-heavy teams.
5. **XMC attach is 23% in October (up from 11.5% in Sep); it is a team/promo effect, not tenure** (Cramér's V team 0.18 vs tenure 0.04). "Free Line for 1 Year" is 54–62% of XM sales and attaches XMC only 6.5% of the time; Trade-In 75%, Port-In 43%, No-promo 45%.
6. **E-SIM activation is falling: 90% (Aug) → 81% (Sep) → 69% (Oct), 64% last week.**
7. **12% of all units (482) sit on HRIDs not in the roster;** 8 valid-looking IDs carry 257 of them. 40 units come from 4 fake IDs (999, 999999 …). 15% of rows carry junk order numbers, so those rows cannot be de-duplicated.
8. **Sunday is the weakest day (−12.7 units vs Monday after trend adjustment, −23%);** 41% of units are logged after midnight, 42% in the 19:00–23:00 prime window.

## 1. Account trajectory

| Month | Units | Days | Units/day | /agent/day (All HC) | /agent/day (Prod) | XM share |
|---|---|---|---|---|---|---|
| Jul (from 22nd) | 359 | 10 | 35.9 | 0.14 | 0.27 | 19% |
| Aug | 995 | 31 | 32.1 | 0.13 | 0.24 | 28% |
| Sep | 1,836 | 30 | 61.2 | 0.25 | 0.46 | 31% |
| Oct (1–9) | 822 | 9 | 91.3 | 0.37 | 0.69 | 27% |

Weekly units/day (Mon–Sun weeks): 27.8, 39.7, 36.3, 22.3, 28.9, 37.0, 57.0, 67.1, 45.7, 70.1, 67.0, 115.0 (5 days). WoW growth: +54%, +18%, −32%, +53%, −4%, +72%.

- **Trend** (OLS on daily units vs day index): all 80 days slope **+0.81 units/day per day** (≈+5.7/week); last 30 days **+1.90**, but only +0.36 if the last three spike days are excluded – the underlying run-rate was flattening around 62/day (mean of the 27 pre-spike days = 61.8).
- **Best day** 9 Oct (184); **worst** 14 Aug (7). Best non-spike day 3 Oct (87; includes one agent's 18-unit day).
- **Volatility**: CV of daily units last 30 days = 0.45 (prior 30 days 0.53). Still high: a ±45% day is normal.
- **Anomalies** (|z|>2 vs trailing 14-day mean/std): 11 Aug (16, z −2.2), 14 Aug (7, −2.4), 23 Aug (63, +5.7), 29 Aug (62, +2.8), 31 Aug (66, +2.3), 8 Sep (103, +3.6 – 30 of these units are fake-ID test entries), 7 Oct (125, +4.9), 8 Oct (144, +3.7), 9 Oct (184, +3.9).
- **What drove the spike**: last 7 days vs prior 7: seller-days 363 vs 255 (+42%), units per seller-day 1.96 vs 1.75 (+12%), distinct sellers 176 vs 118. Training agents gave 175 of the 711 last-7 units (25%), unmapped IDs 60. Breadth from new waves, not big tickets; verify it holds before presenting it as the new run-rate.

## 2. Target gap (2 units/agent/business day)

| Scope (last 30 days) | Units/day | HC | Units/agent/day | Required | Multiplier to target |
|---|---|---|---|---|---|
| Account – All HC | 70.7 | 250 | 0.28 | 500 | 7.1× |
| Account – Production HC | 70.7 | 133 | 0.53 | 266 | 3.8× |

By OM (units/agent/day, All HC → Prod HC): Sep: Bishoy Mourad 0.33 → 0.40; Ramadan Gamal 0.18 → 0.47; Mohamed Radwan 0.02 (26 agents, all Training). Oct-to-date: Bishoy 0.36 → 0.44; Ramadan 0.38 → 0.96; Radwan 0.06.

By team (units/agent/day, All HC) Aug → Sep → Oct: Shereen Kamal 0.37 → 0.63 → 0.51; Salma Ahmed 0.22 → 0.58 → 0.76; Mohamed Ashour 0.07 → 0.41 → 0.48; Anas Sami 0.15 → 0.40 → 0.45; Essam Medhat 0.10 → 0.41 → 0.34; Mina Milad 0.35 → 0.33 → 0.18; Rahma Samir 0.25 → 0.27 → 0.38; Ahmed Aboelgoud – → 0.22 → 0.57; Omar Mansour – → 0.12 → 0.67; Kelany/Farouk/Mokhtar/Osama/Yehia all ≤0.20. Full matrix in `findings.json → target_gap_by_month`.

- **Who meets 2/agent/day**: no team on any day on the All-HC basis, except Salma Ahmed once (3 Oct, 2.71, driven by one agent's 18-unit day). Over the last 30 days 0 agents averaged ≥2/day, 9 averaged ≥1/day, 170 of 250 sold at all. Agent-days with ≥2 units: 514 = 6.9% of All-HC agent-days (12.9% of Production agent-days).
- **Operating model**: an agent sells on 14% of days; on those days the median is 1 unit, the mean 1.9. The gap is *frequency*, not *size*.
- **Closing the gap**: 1,767 agents would be needed for 500/day at today's rate, so headcount is not the lever. If every rostered agent sold on 1 day in 2 at 1.9 units/selling-day the account would do 238/day (3.4× today). A credible interim target is 1 unit/Production agent/day (133/day, 1.9× today), reachable by lifting Production participation from 23% to ~50% of agent-days.

## 3. Mix and quality

- **XM vs GSR**: XM share rose 19% (Jul) → 28% → 31% (Sep) → 27% (Oct).
- **GSR type mix** (share of GSR units, Jul → Oct): Speed Upgrade 54% → 46%; X-PRO 36% → 26%; Adding LOB 8% → 15% (Aug) → 8.5%; Mobile Plus 0.7% → 7.7%; XMC-as-GSR 1.4% → 10.7% (64 units in Oct). The XMC push is visible on both the XM side and the GSR side.
- **XMC attach** (Yes/(Yes+No) on XM rows): Aug 20% (only 65 answered; 193 blank), Sep 11.5% (489 answered), Oct 23.2%. Weekly: 6% (w/c 31 Aug) → 13% → 11% → 14% → 17% → 26% (w/c 5 Oct).
- **E-SIM activation**: Aug 90%, Sep 81%, Oct 69%; last week 64% (46 "No" of 126). 73% of XM rows report an e-SIM.
- **By team (all-time XMC attach, answered rows)**: Mohamed Kelany 40% (10), Islam Farouk 33% (9), Omar Mansour 29% (41), Rahma Samir 23% (71), Ahmed Aboelgoud 17% (53), Shereen Kamal 16% (115), Mohamed Ashour 15% (54), Anas Sami 13% (69), Salma Ahmed 10% (122), Mina Milad 9% (78), Essam Medhat 7% (69). E-SIM by team ranges 56% (Farouk) to 86% (Salma).
- **Team vs tenure**: chi-square on Yes/No – team: χ²=24.3, 10 dof, Cramér's V 0.18; Production tenure bucket: χ²=1.2, V 0.04 (30–60d 11.8%, 60–120d 15.0%, 120+ 12.0%); phase: Training 37% vs Production 13% (V 0.18). **Team and phase explain attach; tenure does not.** Within Production the spread is agent-level: Yassin Fawzy (Rahma) 67%, Samuel Wadie (Salma) 53% vs 0% for several agents with 5–12 answered rows.
- **Promotion is the hidden driver**: XMC attach by promo – Trade-In 75% (12), No-promo 45% (33), Port-In 43% (30), BYOD 14% (113), **Free Line for 1 Year 6.5% (401)**. Free Line is 62% (Sep) / 54% (Oct) of XM sales. Teams that sell mostly Free Line will structurally show low attach.
- **Devices** (XM rows, Sep/Oct): iPhone 58%/52%, Samsung 12%/15%, Apple Watch 8%/9%, No device 6%, BYOD 5%. Device/promo fields were blank for 100% of July and 75% of August rows (added to the Form late August), so those trends start in September.

## 4. Timing

- **Hour of submission** (ct.hour, share of units): 22:00 is the peak (10.1%), 21:00 8.5%, 23:00 8.6%, 00:00 8.2%, 20:00 8.0%. Prime 19:00–23:00 = 42%; after midnight (00:00–07:59) = **40.9%** (38.1% last 30 days); early shift 14:00–18:59 = 17%. Hours 08–13 are empty (shift pattern confirmed).
- **By OM**: Bishoy Mourad 45% after midnight / 41% prime / 14% early; Ramadan Gamal 35% / 43% / 21%; Mohamed Radwan (32 units) 9% / 59% / 31%. Peak hour is 22:00 for Bishoy, 21:00 for the other two. Team extremes: Kelany 89% and Farouk 81% after midnight (Training teams logging in the late shift); Aboelgoud 43% early; Anas Sami 52% late.
- **Weekday** (mean units/day, all 80 days): Mon 54.6, Tue 50.5, Wed 47.8, Thu 51.6, Fri 55.6, Sat 49.6, **Sun 41.1**. OLS units = 22.4 + 0.80·t + weekday dummies (R² 0.45): Sun −12.7 vs Mon (Tue −4.9, Wed −5.6, Thu −2.6, Fri +0.6, Sat −3.3). Excluding the three spike days: Sun −12.9, Wed −10.9, Thu −9.1, Fri −8.9, Mon/Tue/Sat strongest. Sunday is the only robust effect across both fits (−23%). Last 30 days: Fri 84.2, Wed 77.8, Sun 51.5.

## 5. Leaders

Rates per head on **All HC**; `units_per_head_prod` in the JSON uses Production HC.

| TL (OM) | HC (Prod) | Units | Units/head | Partic. | CV 30d | Last7 / Prior7 | Momentum | Rank 7d (prev→now) | 30d units/head | Quadrant (30d) |
|---|---|---|---|---|---|---|---|---|---|---|
| Shereen Kamal (BM) | 16 (16) | 677 | 42.3 | 94% | 0.58 | 61 / 74 | −18% | 1→5 | 16.6 | Engine |
| Salma Ahmed (RG) | 17 (17) | 571 | 33.6 | 94% | 0.75 | 94 / 71 | +32% | 3→3 | 19.1 | Engine |
| Rahma Samir (BM) | 22 (22) | 446 | 20.3 | 86% | 0.74 | 67 / 34 | +97% | 7→4 | 7.9 | Lagging |
| Mina Milad (BM) | 17 (17) | 444 | 26.1 | 100% | 0.53 | 22 / 30 | −27% | 8→11 | 8.1 | Broad but shallow |
| Anas Sami (BM) | 16 (16) | 327 | 20.4 | 100% | 0.79 | 57 / 35 | +63% | 6→6 | 12.9 | Engine |
| Mohamed Ashour (BM) | 15 (15) | 286 | 19.1 | 93% | 0.59 | 53 / 43 | +23% | 4→7 | 14.6 | Engine |
| Ahmed Aboelgoud (RG/MR) | 23 (16) | 270 | 11.7 | 83% | 1.07 | 95 / 74 | +28% | 1→2 | 11.4 | Star-dependent |
| Essam Medhat (RG) | 13 (13) | 255 | 19.6 | 100% | 0.60 | 32 / 24 | +33% | 9→9 | 12.1 | Engine |
| Omar Mansour (RG) | 18 (1) | 173 | 9.6 | 89% | 1.51 | 100 / 37 | +170% | 5→1 | 9.2 | Engine |
| Mohamed Kelany (BM) | 18 (0) | 37 | 2.1 | 61% | 2.39 | 33 / 0 | new | 12→8 | 2.1 | Lagging |
| Islam Farouk (RG) | 15 (0) | 26 | 1.7 | 60% | 2.48 | 23 / 2 | +1050% | 11→10 | 1.7 | Lagging |
| Mostafa Mokhtar (RG) | 19 (0) | 13 | 0.7 | 32% | 3.30 | 13 / 0 | new | 12→12 | 0.7 | Lagging |
| Omar Osama (RG) | 22 (0) | 4 | 0.2 | 14% | 3.26 | 0 / 4 | −100% | 10→14 | 0.2 | Lagging |
| Taher Yehia (MR) | 19 (0) | 1 | 0.05 | 5% | 5.48 | 1 / 0 | new | 12→13 | 0.05 | Lagging |

Quadrants split at the 30-day medians (participation 0.82, 9.2 units/head). Monthly rank movement (Aug→Sep): Mina Milad 1→6 (185 → 170 units, then 28 in Oct – the clearest decline), Mohamed Ashour 7→4 (31 → 183), Anas Sami 5→3 (72 → 190), Shereen 2→1, Salma 4→2.

- **Star dependence**: Omar Sayed (Shereen's team) alone has 239 units = 6.0% of the account and 35% of Shereen's all-time total, but only 11% of her last-30-day units – the team has broadened. Aboelgoud's "star-dependent" label comes from 83% participation with high per-head output.
- **OMs**: Bishoy Mourad 104 HC (86 Prod), 2,217 units, 27.7/day, 88% participation, CV 0.35, momentum +36%, 45% after midnight. Ramadan Gamal 120 HC (47 Prod), 1,281 units, 16.0/day, 66% participation, CV 0.58, momentum +69%. Mohamed Radwan 26 HC (0 Prod), 32 units.
- **Fairness**: 6 teams are ≥94% Training (Kelany, Farouk, Mokhtar, Osama, Yehia, Omar Mansour – 17 of 18); Aboelgoud is 30% Training. Production teams: 12.8 units/head and 90% participation (30d) vs 2.3 and 43% for Training-heavy teams. Omar Mansour's team is the exception (166 units in 30 days, 89% participation, 1st in the last 7 days). Recommendation: separate league tables – Production on units/Prod-head, Training on participation and first-sale rate.

## 6. Agents

- **Distribution**: Gini of all-time units across the 250 roster = **0.68**; top decile holds 46% of units, top 20% holds 68%; 75 agents have zero. Production only: Gini 0.50, top decile 35%, 6 zero sellers. Last 30 days, Production: Gini 0.43, 11 zero sellers, median 11 units.
- **Ramp (Production, by tenure bucket)**: 30–60 days 23.3 units/head all-time, **14.4 in the last 30d**; 60–120 days 25.2 / 12.7; 120+ days 26.9 / 10.9. Tenure beyond 60 days adds nothing; the newest cohort is currently the most productive. Training excluded (roster tags 23 trainees "120+" with no start date).
- **By wave**: strongest Wave 23 (80.8/head, 4 agents), Wave 20 (56.0, 6), Wave 26 (43.3); Wave 28 22.7 (14 agents); Wave 31 10.3 (16); Wave 32 11.7 (23, 83% participation); Wave Temp 1 7.9/head with **88% participation from 17 trainees** since 14 Sep; Wave 33/34 2.2/2.1 (28 agents, 61–70% participation since 25 Sep); Wave 35, Temp 2, Temp 3 (65 agents) 0.05–0.71/head.
- **Ramp curve by weeks since first sale**: week 0 = 5.3 units/agent, week 1 = 3.8, weeks 2–7 = 3.4–4.1, week 8 = 2.4. There is no ramp-up after the first sale; output is flat then decays.
- **Consistency** (active days ÷ 30, Production): median 0.23 (7 of 30 days), 75th percentile 0.33, max 0.60.
- **Streaks**: longest consecutive selling run 12 days (Youssef Sherif Attya, Salma Ahmed); only 5 agents reached ≥7 days. No agent currently holds a streak longer than 1 day.
- **Stale agents** (no sale ≥7d / ≥14d, incl. never): account 104 / 87 of 250. Production: 30 stale 7+ (23%), 17 stale 14+, 6 never sold. By Production team: **Rahma Samir 9 of 22 stale 7+ (8 stale 14+, 3 never)**, Mina Milad 5 (2), Salma Ahmed 5 (3), Shereen Kamal 4 (2), Mohamed Ashour 4 (2), Essam Medhat 2 (0), Anas Sami 1 (0). Training teams: Omar Osama 22/22 stale 7+, Taher Yehia 18/19, Mostafa Mokhtar 13/19.
- **Coaching-priority score** (Production only): `score = 100 × (0.40·P_gap + 0.35·P_stale + 0.25·P_inactive)`, where P_gap = clip((team median 30-day units − agent 30-day units) / team median, 0, 1); P_stale = min(days since last sale, 30)/30 (never = 1); P_inactive = 1 − active days in last 30 / 30. Median score 23; 16 agents score ≥70.

| # | Agent | TL | Tenure | 30d units (team median) | Days since last sale | Score |
|---|---|---|---|---|---|---|
| 1 | Abdelrahman Eid | Mina Milad | 60–120 | 0 (9) | 31 | 100 |
| 2 | Bassant Mohamed | Mina Milad | 120+ | 0 (9) | 57 | 100 |
| 3 | Ramy Mohamed Sharaf | Mohamed Ashour | 30–60 | 0 (16) | never | 100 |
| 4 | Seif Eldin Mattar | Mohamed Ashour | 60–120 | 0 (16) | 36 | 100 |
| 5 | Adham Tarek Elsherif | Rahma Samir | 120+ | 0 (5) | 70 | 100 |
| 6 | Ahd Mahmoud | Rahma Samir | 120+ | 0 (5) | never | 100 |
| 7 | Aliaa Adel Behiry | Rahma Samir | 120+ | 0 (5) | never | 100 |
| 8 | Safwat Mohamed | Rahma Samir | 120+ | 0 (5) | never | 100 |
| 9 | Gehad Khalaf Ghanem | Salma Ahmed | 30–60 | 0 (11) | 78 | 100 |
| 10 | Omar Wael Abdallah | Salma Ahmed | 120+ | 0 (11) | never | 100 |
| 11 | Mohamed Saleh (Hazem) | Shereen Kamal | 30–60 | 0 (14.5) | never | 100 |
| 12 | Youssef Yasser Gawdat | Rahma Samir | 120+ | 1 (5) | 27 | 88 |
| 13 | Germen Shohdy | Rahma Samir | 120+ | 1 (5) | 25 | 85 |
| 14 | Ahmad Abdelftah Etman | Salma Ahmed | 120+ | 5 (11), 90 all-time | 28 | 78 |
| 15 | Mohammed Marzouq Ismail | Mohamed Ashour | 30–60 | 1 (16) | 13 | 77 |

Rahma Samir owns 7 of the 15; Ahmad Etman (#14) is a former top-5 producer (90 units) silent for 28 days – an engagement case, not a skills case.

## 7. Day-over-day drivers (waterfall)

**9 Oct vs 8 Oct: 144 → 184 (+40).** Up: Ahmed Aboelgoud +13 (15→28), Not-in-roster +12 (18→30), Salma Ahmed +10 (5→15), Essam Medhat +8, Mohamed Kelany +6, Shereen Kamal +4, Ashour +3, Rahma +3, Yehia +1. Down: Omar Mansour −6 (32→26), Islam Farouk −6, Mina Milad −4, Mostafa Mokhtar −3, Anas Sami −1.

**Last 7 days (3–9 Oct) vs prior 7 (26 Sep–2 Oct): 445 → 711 (+266).** Up: **Omar Mansour +63** (37→100), Not-in-roster +43 (17→60), Mohamed Kelany +33 (0→33), Rahma Samir +33 (34→67), Salma Ahmed +23, Anas Sami +22, Ahmed Aboelgoud +21, Islam Farouk +21, Mostafa Mokhtar +13, Ashour +10, Essam +8, Yehia +1. Down: Shereen Kamal −13 (74→61), Mina Milad −8 (30→22), Omar Osama −4. 60% of the increase comes from Training-heavy teams plus unmapped IDs; the three Bishoy-org Production teams Shereen, Mina and Ashour contributed −11 net.

## 8. Data quality

| Issue | Count | Units | Impact |
|---|---|---|---|
| HRID not in roster | 410 rows, 100 distinct raw IDs | 482 (12.0% of all; 6.2% of last 30d; 60 in last 7d) | Equivalent to a whole mid-table team (Rahma = 446). 56 IDs look valid (9 digits starting 1000) and carry 388 units; 8 of them carry 257 (100071916, 100071921, 100064781, 100065731, 100071935, 100070933, 100070305, 100070297 – all stopped by late Sep, likely leavers/transfers). October: 31 IDs, 61 units, of which 37 are 10008xxxx IDs – new hires missing from a roster that contains only one 10008 ID. |
| Fake IDs | 4 (999, 999999, 45646464, 87877+7454) | 40 | Each a single 10-line XM entry; 30 on 8 Sep, inflating that day from 73 to 103 |
| Duplicates (same HRID+account+order+type) | 212 rows | 233 | 88 rows from Omar Sayed (Shereen), 33 unmapped, 18 Ehab Elsawah (Mina). Without dedup Shereen's total would be overstated by ~14% |
| Junk order numbers | 525 rows (15.1%) | 688 | "1" (92), "0" (75), "." (51), pasted "GETTING STARTED KIT…" text (20+). These rows are exempt from dedup, so duplicates there are invisible. By team: Anas Sami 45%, Mostafa Mokhtar 27%, Shereen Kamal 25%, Mina Milad 15%, Aboelgoud 1% |
| Blank XMC / e-SIM answers on XM rows | 258 / 320 of 1,010 | – | Almost all Jul–Aug; attach rates are only reliable from September |
| Big tickets ≥5 units in one submission | 9 | 70 | Includes 100070319 (Salma) logging 8 XM + 10 GSR on 3 Oct |

Attribution effect: 12% of units unattributed plus junk orders concentrated in two teams can move a Production team one or two ranks. Fixes: add the 10008xxxx hires to the roster, map or retire the 8 orphan IDs, validate Order Number as numeric in the Form, drop the 10-line fake entries.

## 9. Automated insight rules (JavaScript-ready)

Inputs assumed per export: daily units series, per-agent-day units, roster (HRID, TL, Phase), XM rows with XMC/e-SIM answers, `in_roster`, `order_valid`, `dup`.

1. **Daily anomaly** – `|units_d − mean(units_{d-14..d-1})| > 2·std(...)` → "{date} logged {units} units, {z}σ vs the 14-day norm of {mean}; {top 3 contributing teams}. Verify the submissions before reporting." (9 flags in 80 days.)
2. **Breadth surge/drop** – `sellers_d / mean(sellers_{d-14..d-1}) > 1.5 or < 0.6` → "Distinct sellers {sellers} vs norm {norm}; the change is participation-driven, units/seller {x}." (Oct 7–9: 69–86 vs 35.)
3. **Target pacing** – `units_MTD / (days_MTD × HC_prod) < 1.0` → "Production is pacing at {rate} units/agent/day, {mult}× below the 2.0 target; {n} agents averaged ≥1/day." (Current 0.53.)
4. **Stale Production agent** – `Phase=='Production' && days_since_last_sale ≥ 7` (escalate at 14) → "{name} ({TL}) has no sale in {d} days; last 30 days {u} vs team median {m}. Schedule a shadowing session." Team-level: `stale7_prod / hc_prod ≥ 0.30` → "{TL}: {pct}% of Production agents stale." (Rahma 41%.)
5. **Unmapped volume** – `units_unmatched_7d / units_7d > 0.05` → "{units} units in 7 days sit on {n} unknown HRIDs ({ids}); update the roster or these go unattributed." (Currently 8.4%.)
6. **Junk order rate by team** – `(1 − mean(order_valid)) over last 30d ≥ 0.20 with ≥20 rows` → "{TL}: {pct}% of submissions have invalid order numbers; duplicates cannot be detected." (Anas Sami 45%.)
7. **Suspicious ticket** – `units_submission ≥ 5 || agent_day_units ≥ 8 || HRID not matching /^1000\d{5}$/ with units ≥ 5` → "Review {hrid} on {date}: {units} units in one entry." (9 cases, 70 units.)
8. **XMC attach laggard** – team with `≥20 answered XM rows (30d) && attach < 0.10` → "{TL} attaches XMC on {pct}% vs account {acct}%; {freeline}% of their XM sales are Free Line (6.5% attach). Coach the offer on Free Line sales." (Essam 7%, Mina 9%, Salma 10%.)
9. **E-SIM activation slide** – `weekly activation < 0.75 with ≥30 answers` → "E-SIM activation fell to {pct}% ({no} not activated); unactivated lines risk churn-back." (Last week 64%.)
10. **Star dependence** – `top agent units / team units (30d) > 0.25` → "{TL}: {agent} is {pct}% of team output; single-agent risk." (Shereen all-time 35%, now 11%.)
11. **Momentum** – `prior7 ≥ 20 && |last7 − prior7| / prior7 ≥ 0.30` → "{TL} moved {pct}% WoW ({prior}→{last}), rank {r0}→{r1}." (Rahma +97%, Omar Mansour +170%, Mina −27%.)
12. **Sunday dip** – `units_Sunday < 0.8 × mean(Mon–Sat of same week)` → "Sunday delivered {units}, {pct}% below the week's weekday mean; review Sunday staffing/offer." (Historical −23%.)

## 10. Method notes

All cleaning from `tsx_data.load`, `dup==1` excluded. Slopes: OLS on day index. Anomalies: z vs trailing 14 days (day excluded). Weekday: OLS with linear trend, Monday base. Association: chi-square on Yes/No with Cramér's V (groups <10 dropped). Gini on units per roster agent, zeros included. Participation = distinct selling HRIDs ÷ HC. Momentum = last 7 vs prior 7 days. Waterfall = per-team difference between windows, "Not in Roster" kept as a bucket.
