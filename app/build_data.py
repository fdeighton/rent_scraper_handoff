"""
Build a self-contained data.js for the Comp Tracker frontend recreation.

Reads the handoff seed (db/seed/*.json + the two large *.sql files) and emits
app/data.js, which sets window.COMP_DATA = {...}. Inlining as JS (not JSON)
lets index.html be opened directly from disk (file://) with no server / no CORS.

Aggregation mirrors the live building_summary view: per (building, unit_type)
averages over the LATEST successful snapshot, with rent_price NOT NULL only
(Coming-Soon units kept in raw data but excluded from every average).
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone

SEED = os.path.join(os.path.dirname(__file__), "..", "db", "seed")
OUT = os.path.join(os.path.dirname(__file__), "data.js")

UNIT_TYPES = ["bachelor", "1-bed", "1-bed+den", "2-bed", "2-bed+den", "3-bed", "3-bed+den", "4-bed"]
# Reject obvious sale-price contamination (condos.ca trap) — no monthly rent > 20k.
MAX_RENT = 20000


# ---------------------------------------------------------------------------
# Minimal robust parser for the `INSERT ... VALUES (...),(...);` seed dumps.
# Handles '' escaped quotes, tabs, commas inside strings, and NULL.
# ---------------------------------------------------------------------------
def parse_sql_values(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    i = text.find("VALUES")
    if i == -1:
        return
    s = text[i + len("VALUES"):]

    n = len(s)
    p = 0
    while p < n:
        # find start of a tuple
        while p < n and s[p] != "(":
            p += 1
        if p >= n:
            break
        p += 1  # skip '('
        fields = []
        cur = []
        in_str = False
        while p < n:
            c = s[p]
            if in_str:
                if c == "'":
                    if p + 1 < n and s[p + 1] == "'":  # escaped quote
                        cur.append("'")
                        p += 2
                        continue
                    in_str = False
                    p += 1
                    continue
                cur.append(c)
                p += 1
                continue
            # not in string
            if c == "'":
                in_str = True
                p += 1
                continue
            if c == ",":
                fields.append("".join(cur).strip())
                cur = []
                p += 1
                continue
            if c == ")":
                fields.append("".join(cur).strip())
                p += 1
                break
            cur.append(c)
            p += 1
        # `fields` are raw token strings; quoted values already had quotes stripped
        # but unquoted NULL/numbers retain their text. We need to know which were
        # quoted. Re-derive: re-walk is overkill — instead treat 'NULL' (exact,
        # unquoted) as None and numbers as numbers; everything else is a string.
        yield fields


def coerce(tok):
    if tok == "NULL":
        return None
    return tok


# The simple parser above loses the quoted-vs-unquoted distinction. For our
# columns that's fine: we coerce per-column at the call site.
def to_float(tok):
    if tok in (None, "NULL", ""):
        return None
    try:
        return float(tok)
    except ValueError:
        return None


def to_int(tok):
    f = to_float(tok)
    return int(f) if f is not None else None


def load_json(name):
    with open(os.path.join(SEED, name), "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    comp_buildings = load_json("comp_buildings.json")
    fitz_properties = load_json("fitz_properties.json")
    comp_sets = load_json("comp_sets.json")

    # snapshots: id, comp_building_id, scraped_at, status, incentives, error_message
    snapshots = {}
    snaps_by_building = defaultdict(list)
    for row in parse_sql_values(os.path.join(SEED, "scrape_snapshots.sql")):
        if len(row) < 6:
            continue
        sid, bid, scraped_at, status, incentives, _err = row[:6]
        rec = {
            "id": sid,
            "building": bid,
            "date": scraped_at[:10] if scraped_at else None,
            "ts": scraped_at,
            "status": status,
            "incentives": None if incentives == "NULL" else incentives,
        }
        snapshots[sid] = rec
        snaps_by_building[bid].append(rec)

    # units grouped by snapshot
    units_by_snap = defaultdict(list)
    for row in parse_sql_values(os.path.join(SEED, "unit_data.sql")):
        # id, snapshot_id, unit_type, bathrooms, square_footage, rent_price, rent_psf, raw_text, notes, created_at
        if len(row) < 7:
            continue
        snap = row[1]
        utype = row[2]
        sqft = to_int(row[4])
        rent = to_float(row[5])
        psf = to_float(row[6])
        if rent is not None and rent > MAX_RENT:  # sale-price guard
            rent = None
            psf = None
        note = row[8] if len(row) > 8 else ""
        if note == "NULL":
            note = ""
        bath = row[3] if len(row) > 3 else ""
        if bath == "NULL":
            bath = ""
        units_by_snap[snap].append({"type": utype, "bath": bath, "sqft": sqft, "rent": rent, "psf": psf, "note": note[:48]})

    def aggregate(units):
        """building_summary-style aggregate. rent NOT NULL only."""
        by = {}
        priced = [u for u in units if u["rent"] is not None]
        for t in UNIT_TYPES:
            us = [u for u in priced if u["type"] == t]
            if not us:
                continue
            rents = [u["rent"] for u in us]
            psfs = [u["psf"] for u in us if u["psf"] is not None]
            sqfts = [u["sqft"] for u in us if u["sqft"] is not None]
            by[t] = {
                "count": len(us),
                "avgRent": round(sum(rents) / len(rents)),
                "avgPsf": round(sum(psfs) / len(psfs), 2) if psfs else None,
                "avgSqft": round(sum(sqfts) / len(sqfts)) if sqfts else None,
                "minRent": round(min(rents)),
                "maxRent": round(max(rents)),
            }
        weighted = None
        if priced:
            rents = [u["rent"] for u in priced]
            psfs = [u["psf"] for u in priced if u["psf"] is not None]
            sqfts = [u["sqft"] for u in priced if u["sqft"] is not None]
            weighted = {
                "count": len(priced),
                "avgRent": round(sum(rents) / len(rents)),
                "avgPsf": round(sum(psfs) / len(psfs), 2) if psfs else None,
                "avgSqft": round(sum(sqfts) / len(sqfts)) if sqfts else None,
            }
        return by, weighted

    def success_snaps(bid):
        rows = [s for s in snaps_by_building.get(bid, []) if s["status"] == "success"]
        rows.sort(key=lambda s: s["ts"] or "")
        # collapse multiple scrapes on the same calendar date to the latest one,
        # so trends/deltas have one observation per date (no same-date vertical jogs)
        by_date = {}
        for s in rows:
            by_date[s["date"]] = s
        return list(by_date.values())

    summary, prev_summary, trends, history, quarterly = {}, {}, {}, {}, {}
    snapshots = {}  # last N successful snapshots per building (for the historical picker)

    for b in comp_buildings:
        bid = b["id"]
        succ = success_snaps(bid)
        # scrape history (all snapshots, newest first)
        hist = sorted(snaps_by_building.get(bid, []), key=lambda s: s["ts"] or "", reverse=True)
        history[bid] = [
            {
                "date": h["ts"],
                "status": h["status"],
                "incentives": h["incentives"],
                "units": len([u for u in units_by_snap.get(h["id"], []) if u["rent"] is not None]),
            }
            for h in hist[:30]
        ]

        # trend series: one point per successful snapshot that has priced units
        series = []
        for s in succ:
            us = units_by_snap.get(s["id"], [])
            by, w = aggregate(us)
            if not w:
                continue
            series.append({
                "date": s["date"],
                "avgRent": w["avgRent"],
                "avgPsf": w["avgPsf"],
                "byType": {t: {"avgRent": by[t]["avgRent"], "avgPsf": by[t]["avgPsf"], "count": by[t]["count"]} for t in by},
            })
        if series:
            trends[bid] = series

        # latest + previous summary
        if succ:
            lby, lw = aggregate(units_by_snap.get(succ[-1]["id"], []))
            summary[bid] = {
                "date": succ[-1]["date"],
                "incentives": succ[-1]["incentives"],
                "byType": lby,
                "weighted": lw,
            }
            if len(succ) >= 2:
                pby, pw = aggregate(units_by_snap.get(succ[-2]["id"], []))
                prev_summary[bid] = {"date": succ[-2]["date"], "byType": pby, "weighted": pw}

        # last up-to-8 successful snapshots (newest first) for the historical picker
        sfull = []
        for s in succ[-8:]:
            us = units_by_snap.get(s["id"], [])
            by, w = aggregate(us)
            if not w:
                continue
            # the individual priced listings that roll up into the cell averages
            listings = [
                {"type": u["type"], "bath": u["bath"], "rent": round(u["rent"]), "sqft": u["sqft"],
                 "psf": u["psf"], "note": u["note"]}
                for u in us if u["rent"] is not None
            ]
            sfull.append({
                "date": s["date"],
                "incentives": s["incentives"],
                "byType": {t: {"avgRent": by[t]["avgRent"], "avgPsf": by[t]["avgPsf"],
                               "avgSqft": by[t]["avgSqft"], "count": by[t]["count"]} for t in by},
                "weighted": w,
                "units": listings,
            })
        sfull.reverse()
        if sfull:
            snapshots[bid] = sfull

        # quarterly rollup — latest successful snapshot per quarter
        qmap = {}
        for s in succ:
            if not s["date"]:
                continue
            y, m = int(s["date"][:4]), int(s["date"][5:7])
            q = f"{y}-Q{(m - 1) // 3 + 1}"
            # keep the latest snapshot in each quarter
            if q not in qmap or (s["ts"] or "") > (qmap[q]["ts"] or ""):
                qmap[q] = s
        qrows = []
        for q in sorted(qmap.keys(), reverse=True):
            by, w = aggregate(units_by_snap.get(qmap[q]["id"], []))
            if not w:
                continue
            qrows.append({
                "quarter": q,
                "activeListings": w["count"],
                "avgSqft": w["avgSqft"],
                "avgRent": w["avgRent"],
                "avgPsf": w["avgPsf"],
                "byType": {t: {"count": by[t]["count"], "avgSqft": by[t]["avgSqft"], "avgRent": by[t]["avgRent"], "avgPsf": by[t]["avgPsf"]} for t in by},
            })
        if qrows:
            quarterly[bid] = qrows

    # buildings map (trim scrape_config to the strategy + a couple fields the UI shows)
    buildings = {}
    for b in comp_buildings:
        cfg = b.get("scrape_config") or {}
        buildings[b["id"]] = {
            "id": b["id"],
            "name": b["name"],
            "address": b.get("address"),
            "city": b.get("city"),
            "province": b.get("province"),
            "lat": b.get("latitude"),
            "lng": b.get("longitude"),
            "photo": b.get("photo_url"),
            "yearBuilt": b.get("year_built"),
            "unitCount": b.get("unit_count"),
            "owner": b.get("owner_manager"),
            "assetType": b.get("asset_type"),
            "scrapeUrl": b.get("scrape_url"),
            "strategy": cfg.get("strategy", "playwright_render") if cfg else None,
            "initialWaitMs": cfg.get("initial_wait_ms"),
            "scroll": cfg.get("scroll"),
            "isActive": b.get("is_active"),
            "lastScrape": summary.get(b["id"], {}).get("date"),
        }

    comps_by_fitz = defaultdict(list)
    for cs in comp_sets:
        comps_by_fitz[cs["fitz_property_id"]].append(cs)

    analyses = []
    for fp in sorted(fitz_properties, key=lambda x: x.get("display_order", 0)):
        comps = sorted(comps_by_fitz.get(fp["id"], []), key=lambda c: c.get("display_order", 0))
        analyses.append({
            "id": fp["id"],
            "name": fp["name"],
            "address": fp.get("address"),
            "city": fp.get("city"),
            "province": fp.get("province"),
            "yearBuilt": fp.get("year_built"),
            "unitCount": fp.get("unit_count"),
            "assetType": fp.get("asset_type"),
            "benchmark": fp.get("benchmark_building_id"),
            "order": fp.get("display_order", 0),
            "comps": [{"building": c["comp_building_id"], "distance": c.get("distance_to_site"), "order": c.get("display_order", 0)} for c in comps],
        })

    data = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "counts": {
            "buildings": len(comp_buildings),
            "analyses": len(fitz_properties),
            "snapshots": len(snapshots),
            "units": sum(len(v) for v in units_by_snap.values()),
        },
        "buildings": buildings,
        "analyses": analyses,
        "summary": summary,
        "prevSummary": prev_summary,
        "trends": trends,
        "history": history,
        "quarterly": quarterly,
        "snapshots": snapshots,
    }

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by build_data.py — do not edit by hand.\n")
        f.write("window.COMP_DATA = ")
        f.write(payload)
        f.write(";\n")

    size_mb = os.path.getsize(OUT) / 1e6
    print(f"Wrote {OUT}  ({size_mb:.2f} MB)")
    print(f"  buildings={data['counts']['buildings']} analyses={data['counts']['analyses']} "
          f"snapshots={data['counts']['snapshots']} units={data['counts']['units']}")
    print(f"  summaries={len(summary)} trends={len(trends)} quarterly={len(quarterly)}")


if __name__ == "__main__":
    main()
