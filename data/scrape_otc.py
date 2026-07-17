"""Scrape Over The Cap position pages for 2025 contract APY."""
import json, re, time, urllib.request

PAGES = {
    "QB": "quarterback",
    "RB": "running-back",
    "FB": "fullback",
    "WR": "wide-receiver",
    "TE": "tight-end",
}

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def strip(html):
    return re.sub(r"<[^>]+>", "", html).strip()


out = {}
for pos, slug in PAGES.items():
    url = f"https://overthecap.com/position/{slug}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    tables = re.findall(r"<table.*?</table>", html, re.S)
    rows = []
    for t in tables:
        header = [strip(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
        if not any("Avg./Year" in h for h in header):
            continue
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
            cells = [strip(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            if cells:
                rows.append(dict(zip(header, cells)))
        break
    out[pos] = rows
    print(pos, len(rows), "rows; sample:", rows[0] if rows else None)
    time.sleep(1)

with open("otc_raw.json", "w") as f:
    json.dump(out, f, indent=1)
print("saved otc_raw.json")
