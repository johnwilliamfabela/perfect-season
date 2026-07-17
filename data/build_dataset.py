"""Merge Madden 26 ratings with Over The Cap APY into the game dataset.

Outputs:
  ../src/data/players.json  — skill-position player pool grouped by team
  ../src/data/teams.json    — team meta incl. computed defense/offense strength
  merge_report.txt          — join diagnostics (unmatched notables)
"""
import json, re, unicodedata
from collections import defaultdict

MIN_SALARY = 1_000_000  # league-minimum bucket for unmatched/undrafted depth guys

# 2025 contract APY for players missing from OTC position pages (expired deals,
# late-season moves). Estimated from reported 2025 contracts; keyed by norm(name).
APY_OVERRIDES = {
    "matthewstafford": 40_000_000,
    "tyreekhill": 30_000_000,
    "joemixon": 8_500_000,
    "stefondiggs": 21_000_000,
    "keenanallen": 4_000_000,
    "darrenwaller": 5_000_000,
    "deebosamuel": 17_000_000,
    "najeeharris": 5_250_000,
    "nickchubb": 2_500_000,
    "deandrehopkins": 5_000_000,
    "kareemhunt": 1_500_000,
    "antoniogibson": 3_750_000,
    "brandincooks": 6_500_000,
    "zachertz": 6_250_000,
    "jonnusmith": 12_000_000,
    "austinekeler": 4_200_000,
    "philiprivers": 1_200_000,
    "rondalemoore": 2_000_000,
    "sterlingshepard": 1_500_000,
    "adamthielen": 6_000_000,
    "alexandermattison": 1_500_000,
    "joshreynolds": 1_500_000,
    "noahbrown": 3_500_000,
    "raheemmostert": 2_100_000,
    "tylerlockett": 2_000_000,
    "zayjones": 2_100_000,
    "joshuapalmer": 9_700_000,
}

RAW = json.load(open("madden26_raw.json"))
OTC = json.load(open("otc_raw.json"))

SKILL = {"QB": "QB", "HB": "RB", "WR": "WR", "TE": "TE"}
DEPTH_KEEP = {"QB": 3, "RB": 4, "WR": 6, "TE": 4}

# Madden pos -> key attributes to surface on cards
CARD_STATS = {
    "QB": [("throwPower", "THP"), ("throwAccuracyDeep", "DAC"), ("speed", "SPD"), ("awareness", "AWR")],
    "RB": [("speed", "SPD"), ("breakTackle", "BTK"), ("carrying", "CAR"), ("changeOfDirection", "COD")],
    "WR": [("speed", "SPD"), ("catching", "CTH"), ("shortRouteRunning", "SRR"), ("release", "RLS")],
    "TE": [("catching", "CTH"), ("speed", "SPD"), ("runBlock", "RBK"), ("shortRouteRunning", "SRR")],
}


def norm(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", s)
    s = re.sub(r"[^a-z]", "", s)
    return s


# --- OTC lookup: normname -> [(team_nickname, apy_dollars)]
otc_map = defaultdict(list)
for pos, rows in OTC.items():
    for r in rows:
        apy = int(re.sub(r"[^\d]", "", r["Avg./Year"]) or 0)
        if apy:
            otc_map[norm(r["Player"])].append((r["Team"].lower(), apy))

# --- players
players = []
unmatched = []
for it in RAW:
    mpos = it["position"]["id"]
    if mpos not in SKILL:
        continue
    pos = SKILL[mpos]
    team = it["team"]["label"]
    name = f"{it['firstName']} {it['lastName']}".strip()
    key = norm(name)
    cands = otc_map.get(key, [])
    apy = None
    if len(cands) == 1:
        apy = cands[0][1]
    elif len(cands) > 1:
        team_l = team.lower()
        same = [c for c in cands if c[0] in team_l]
        apy = (same[0] if same else max(cands, key=lambda c: c[1]))[1]
    if apy is None and key in APY_OVERRIDES:
        apy = APY_OVERRIDES[key]
    if apy is None:
        if it["overallRating"] >= 75:
            unmatched.append((name, team, pos, it["overallRating"]))
        apy = MIN_SALARY
    stats = it.get("stats", {})
    players.append({
        "id": it["id"],
        "name": name,
        "team": team,
        "pos": pos,
        "ovr": it["overallRating"],
        "age": it["age"],
        "yearsPro": it["yearsPro"],
        "apy": apy,
        "avatar": it.get("avatarUrl"),
        "abilities": [a["label"] for a in it.get("playerAbilities", [])][:3],
        "xfactor": any(a.get("type", {}).get("id") == "xFactor" for a in it.get("playerAbilities", [])),
        "cardStats": {label: stats.get(k, {}).get("value") for k, label in CARD_STATS[pos]},
    })

# keep top-N per team+pos by OVR (skip Free Agents pseudo-team for the pool)
by_team_pos = defaultdict(list)
for p in players:
    by_team_pos[(p["team"], p["pos"])].append(p)

pool = []
for (team, pos), lst in by_team_pos.items():
    if "free agent" in team.lower():
        continue
    lst.sort(key=lambda p: -p["ovr"])
    pool.extend(lst[: DEPTH_KEEP[pos]])

# --- team meta: defense strength = mean OVR of top defensive lineup
DEF_POS = {"CB": 3, "DT": 2, "LEDG": 1, "REDG": 1, "WILL": 1, "MIKE": 1, "SAM": 0, "SS": 1, "FS": 1}
team_def = defaultdict(lambda: defaultdict(list))
team_names = {}
for it in RAW:
    team = it["team"]["label"]
    if "free agent" in team.lower():
        continue
    team_names[team] = it["team"].get("imageUrl")
    dpos = it["position"]["id"]
    if dpos in DEF_POS:
        team_def[team][dpos].append(it["overallRating"])

teams = []
for team, groups in team_def.items():
    starters = []
    for dpos, n in DEF_POS.items():
        vals = sorted(groups.get(dpos, []), reverse=True)[:n]
        starters.extend(vals)
    teams.append({
        "name": team,
        "logo": team_names.get(team),
        "defRating": round(sum(starters) / len(starters), 1) if starters else 75.0,
    })
teams.sort(key=lambda t: t["name"])

import os
os.makedirs("../src/data", exist_ok=True)
json.dump(pool, open("../src/data/players.json", "w"))
json.dump(teams, open("../src/data/teams.json", "w"))

with open("merge_report.txt", "w") as f:
    f.write(f"pool: {len(pool)} players across {len(teams)} teams\n")
    f.write(f"unmatched OVR>=75 (assigned min salary):\n")
    for n, t, p, o in sorted(unmatched, key=lambda x: -x[3]):
        f.write(f"  {o} {p} {n} ({t})\n")

print(f"pool={len(pool)} teams={len(teams)} unmatched_notable={len(unmatched)}")
print(open("merge_report.txt").read()[:2000])
