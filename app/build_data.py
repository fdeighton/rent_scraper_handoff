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
import math
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
    """Yield each INSERT … VALUES tuple as a list of Python values.

    A SQL string literal becomes its (unquoted) text; an UNQUOTED NULL becomes
    Python None — so a quoted literal 'NULL' is preserved as the string "NULL",
    distinct from a real NULL. Unquoted numbers/tokens are returned as their raw
    text for to_int/to_float to parse. Whitespace between tokens is skipped, so
    quoted content (which may legitimately contain spaces) is captured exactly."""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    i = text.find("VALUES")
    if i == -1:
        return
    s = text[i + len("VALUES"):]
    n = len(s)
    p = 0

    def finish(cur, quoted):
        if quoted:
            return "".join(cur)
        tok = "".join(cur)
        return None if tok == "NULL" else tok

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
        quoted = False          # did the current field contain a quoted literal?
        while p < n:
            c = s[p]
            if in_str:
                if c == "'":
                    if p + 1 < n and s[p + 1] == "'":  # escaped '' inside a string
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
                quoted = True
                p += 1
                continue
            if c.isspace():        # skip whitespace between tokens (never inside a quote)
                p += 1
                continue
            if c == ",":
                fields.append(finish(cur, quoted))
                cur = []
                quoted = False
                p += 1
                continue
            if c == ")":
                fields.append(finish(cur, quoted))
                p += 1
                break
            cur.append(c)
            p += 1
        yield fields


# The simple parser above loses the quoted-vs-unquoted distinction. For our
# columns that's fine: we coerce per-column at the call site.
def to_float(tok):
    if tok in (None, "NULL", ""):
        return None
    try:
        f = float(tok)
    except ValueError:
        return None
    return f if math.isfinite(f) else None


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
    all_snaps = {}
    snaps_by_building = defaultdict(list)
    skipped_snaps = 0
    for row in parse_sql_values(os.path.join(SEED, "scrape_snapshots.sql")):
        if len(row) < 6:
            skipped_snaps += 1     # malformed row — surface it instead of silently dropping
            continue
        sid, bid, scraped_at, status, incentives, _err = row[:6]
        rec = {
            "id": sid,
            "building": bid,
            "date": scraped_at[:10] if scraped_at else None,
            "ts": scraped_at,
            "status": status,
            "incentives": incentives,   # parser already yields None for a real NULL
        }
        all_snaps[sid] = rec
        snaps_by_building[bid].append(rec)
    if skipped_snaps:
        print(f"[!] scrape_snapshots.sql: skipped {skipped_snaps} malformed row(s) (<6 columns)")

    # units grouped by snapshot
    units_by_snap = defaultdict(list)
    skipped_units = 0
    for row in parse_sql_values(os.path.join(SEED, "unit_data.sql")):
        # id, snapshot_id, unit_type, bathrooms, square_footage, rent_price, rent_psf, raw_text, notes, created_at
        if len(row) < 7:
            skipped_units += 1
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
        if note is None:           # real NULL → empty (a quoted 'NULL' is left intact)
            note = ""
        bath = row[3] if len(row) > 3 else ""
        if bath is None:
            bath = ""
        units_by_snap[snap].append({"type": utype, "bath": bath, "sqft": sqft, "rent": rent, "psf": psf, "note": note[:48]})
    if skipped_units:
        print(f"[!] unit_data.sql: skipped {skipped_units} malformed row(s) (<7 columns)")

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

        # per-snapshot detail (newest first) for the most recent 15 successful
        # scrapes: powers the analysis historical picker (capped to 8 in the UI)
        # AND the expandable Scrape History rows on the building page. To keep
        # data.js lean, the full individual-listing array is retained only for the
        # 8 most recent; older scrapes still expand to a by-type + weighted summary.
        window = succ[-15:]
        sfull = []
        for s in window:
            us = units_by_snap.get(s["id"], [])
            by, w = aggregate(us)
            if not w:
                continue
            entry = {
                "date": s["date"],
                "incentives": s["incentives"],
                "byType": {t: {"avgRent": by[t]["avgRent"], "avgPsf": by[t]["avgPsf"],
                               "avgSqft": by[t]["avgSqft"], "count": by[t]["count"]} for t in by},
                "weighted": w,
                "_units": us,  # stashed; attached to the 8 most recent below
            }
            sfull.append(entry)
        # individual listings for the 8 most recent EMITTED snapshots only — gate on
        # appended order, not raw window index (unpriced snapshots are skipped above).
        for entry in sfull[-8:]:
            entry["units"] = [
                {"type": u["type"], "bath": u["bath"], "rent": round(u["rent"]), "sqft": u["sqft"],
                 "psf": u["psf"], "note": u["note"]}
                for u in entry["_units"] if u["rent"] is not None
            ]
        for entry in sfull:
            entry.pop("_units", None)
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
            "snapshots": len(all_snaps),
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
    # Harden the JS payload: json.dumps doesn't escape "/", so a scraped string
    # containing "</script>" could close the tag if data.js is ever inlined; and raw
    # U+2028/U+2029 (emitted by ensure_ascii=False) are illegal in JS string literals.
    # All three forms below survive JSON.parse unchanged.
    payload = (payload.replace("</", "<\/")
                      .replace(" ", "\u2028")
                      .replace(" ", "\u2029"))
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
