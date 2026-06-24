"""One-off: split active scrapeable buildings into N platform-sorted batches.

Excludes akamai_stealth (manual). Writes tools/_batches/batch_<i>.txt files,
one building name per line. Guarantees complete, non-overlapping coverage.
"""
import os, sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv()
from config import Config
from database import ScraperDB

N = int(sys.argv[1]) if len(sys.argv) > 1 else 8

cfg = Config.from_env()
db = ScraperDB(cfg.supabase_url, cfg.supabase_service_key)
buildings = db.get_active_buildings()


def platform_key(b):
    cfg_ = b.get("scrape_config") or {}
    strat = cfg_.get("strategy", "")
    url = (b.get("scrape_url") or "")
    host = urlparse(url).netloc.lower()
    return (strat, host, b["name"])


# keep only scrapeable, drop akamai_stealth
rows = [
    b for b in buildings
    if b.get("scrape_url") and (b.get("scrape_config") or {}).get("strategy") != "akamai_stealth"
]
rows.sort(key=platform_key)

out_dir = Path(__file__).resolve().parent / "_batches"
out_dir.mkdir(exist_ok=True)
for f in out_dir.glob("batch_*.txt"):
    f.unlink()

# Contiguous chunks over the platform-sorted list keep same-platform buildings
# together (the last chunk may be shorter; empty trailing chunks are skipped below).
chunk = (len(rows) + N - 1) // N
batches = [rows[i * chunk:(i + 1) * chunk] for i in range(N)]

total = 0
for i, batch in enumerate(batches, 1):
    if not batch:
        continue
    p = out_dir / f"batch_{i}.txt"
    # write_bytes to force LF endings (write_text translates \n -> \r\n on Windows,
    # which leaves a trailing \r that breaks `read -r` name matching in bash)
    p.write_bytes(("\n".join(b["name"] for b in batch) + "\n").encode("utf-8"))
    total += len(batch)
    print(f"batch_{i}: {len(batch):>2d}  ({batch[0]['name']} ... {batch[-1]['name']})")

print(f"TOTAL: {total} buildings across {N} batches (akamai_stealth excluded)")
