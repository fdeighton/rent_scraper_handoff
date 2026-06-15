"""
Comp Tracker Scraper CLI — thin wrapper around modules.

Usage:
    python main.py --building "The Selby"       # Scrape a single building
    python main.py --all                         # Scrape all active buildings
    python main.py --list                        # List all active buildings
    python main.py --building "The Selby" --dry-run  # Fetch but don't save
    python main.py --all --qa                    # Scrape all with visual QA

Requires .env file with SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
"""

import asyncio
import argparse
import sys
import time

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config import Config
from fetcher import PageFetcher
from extractor import RentExtractor
from database import ScraperDB


async def scrape_building(
    building: dict,
    fetcher: PageFetcher,
    extractor: RentExtractor,
    db: ScraperDB,
    dry_run: bool = False,
    qa: bool = False,
) -> dict:
    """
    Scrape a single building end-to-end.

    Returns dict with: success, units, prev, qa_status, qa_note
    """
    name = building["name"]
    scrape_url = building.get("scrape_url")
    scrape_config = building.get("scrape_config") or {}

    if not scrape_url:
        print(f"  [!] {name}: No scrape_url configured, skipping")
        return {"success": False, "units": 0, "prev": None, "qa_status": "SKIP", "qa_note": "No URL"}

    # Pass QA flag to fetcher so it captures modal screenshots
    if qa:
        scrape_config = {**scrape_config, "_qa": True}

    print(f"  > Scraping {name}...")
    print(f"    URL: {scrape_url}")
    print(f"    Strategy: {scrape_config.get('strategy', 'playwright_render')}")

    start_time = time.time()
    snapshot_id = None

    try:
        # 1. Fetch page content
        html = await fetcher.fetch(scrape_url, scrape_config)
        fetch_time = time.time() - start_time
        print(f"    Fetched {len(html):,} chars in {fetch_time:.1f}s")

        # 1.5. Vision enrichment (optional — screenshots -> Haiku → sqft)
        vision_config = scrape_config.get("vision_enrichment")
        if vision_config and vision_config.get("enabled"):
            print(f"    Running vision enrichment (screenshots -> Haiku)...")
            try:
                screenshots = await fetcher.fetch_screenshots(scrape_url, vision_config)
                if screenshots:
                    vision_model = vision_config.get("model", "claude-haiku-4-5-20251001")
                    sqft_map = extractor.extract_sqft_from_screenshots(
                        screenshots, name, vision_model=vision_model
                    )
                    if sqft_map:
                        ref_block = "\n[SQFT REFERENCE]\n"
                        for utype, sqft in sqft_map.items():
                            ref_block += f"{utype}: {sqft} sqft\n"
                        ref_block += "[/SQFT REFERENCE]\n"
                        html = ref_block + html
                        print(f"    Vision enrichment: {len(sqft_map)} plan types with sqft")
                    else:
                        print(f"    Vision enrichment: no sqft extracted from screenshots")
                else:
                    print(f"    Vision enrichment: no screenshots captured")
            except Exception as e:
                print(f"    Vision enrichment failed (continuing without sqft): {e}")

        if dry_run:
            print(f"    [DRY RUN] Would extract and save data")
            return {"success": True, "units": 0, "prev": None, "qa_status": "SKIP", "qa_note": "Dry run"}

        # 2. Create snapshot
        print(f"    Saving snapshot to database...")
        snapshot_id = db.create_snapshot(building["id"], html)

        # 2.5. Content guard — detect error pages (403, Access Denied, etc.)
        if len(html) < 200 and any(kw in html.lower() for kw in ["403", "forbidden", "access denied", "blocked"]):
            error_msg = f"Error page detected ({len(html)} chars): {html[:100]}"
            print(f"    [!] {error_msg}")
            if snapshot_id:
                db.update_snapshot_status(snapshot_id, status="error", error_msg=error_msg)
            elapsed = time.time() - start_time
            print(f"    [FAIL] Done in {elapsed:.1f}s")
            return {"success": False, "units": 0, "prev": None, "qa_status": "FAIL", "qa_note": error_msg}

        # 3. Extract structured data
        # Strategies that produce structured units directly (e.g., tricon_api)
        # bypass Claude — units come from `fetcher._last_api_units`.
        if scrape_config.get("strategy") == "tricon_api":
            raw_units = fetcher._last_api_units or []
            incentives = fetcher._last_api_incentives
            extract_time = 0.0
            print(f"    Using API units directly (skipping Claude extraction)")
        else:
            extraction_hint = scrape_config.get("extraction_hint", "")
            print(f"    Sending to Claude for extraction (this takes 15-30s)...")
            extract_start = time.time()
            result = extractor.extract(html, name, extraction_hint=extraction_hint)
            extract_time = time.time() - extract_start

            incentives = result.get("incentives")
            raw_units = result.get("units", [])

        # 4. Validate and clean units
        units = extractor.validate_units(raw_units)
        print(f"    Extracted {len(units)} units in {extract_time:.1f}s")
        if incentives:
            print(f"    Incentives: {incentives}")

        # 4.3. Delta check (always-on, free) — compare vs previous snapshot
        prev_count = db.get_previous_unit_count(building["id"], exclude_snapshot_id=snapshot_id)
        if prev_count is not None:
            delta = len(units) - prev_count
            delta_str = f"+{delta}" if delta > 0 else str(delta)
            print(f"    Delta: {delta_str} vs previous ({prev_count})")

            # Warn if significant drop (< 50% of previous)
            if prev_count > 0 and len(units) < prev_count * 0.5:
                print(f"    [!] DELTA WARNING: {len(units)} units (previous: {prev_count}, <50% of last run)")

        # 4.5. Extraction retry — if 0 units from large HTML, retry once
        # (Skip for API-based strategies — no Claude call to retry, the API
        # itself was already retried internally inside the strategy.)
        if (
            scrape_config.get("strategy") != "tricon_api"
            and len(units) == 0
            and len(html) > 5000
        ):
            print(f"    [!] 0 units from {len(html):,} chars — retrying extraction...")
            retry_start = time.time()
            retry_result = extractor.extract(html, name, extraction_hint=extraction_hint)
            retry_time = time.time() - retry_start
            retry_raw = retry_result.get("units", [])
            retry_units = extractor.validate_units(retry_raw)
            print(f"    Retry extracted {len(retry_units)} units in {retry_time:.1f}s")

            if len(retry_units) > 0:
                units = retry_units
                if retry_result.get("incentives") and not incentives:
                    incentives = retry_result["incentives"]
                print(f"    Retry succeeded — using {len(units)} units")
            else:
                print(f"    Retry also returned 0 units")

        # 4.7. Strategy-aware QA (--qa only)
        qa_status = "SKIP"
        qa_note = ""

        if qa:
            strategy = scrape_config.get("strategy", "playwright_render")
            fetch_meta = fetcher._last_fetch_meta

            if strategy == "modal_iterate":
                # Modal QA — send modal screenshots to Haiku
                modal_shots = fetcher._last_modal_screenshots
                triggers = fetch_meta.get("triggers_found", 0)
                modals = fetch_meta.get("modals_captured", 0)

                if modal_shots:
                    print(f"    Running modal QA ({len(modal_shots)} screenshots -> Haiku)...")
                    qa_result = extractor.verify_modal_units(
                        modal_shots, name, len(units)
                    )
                    visible = qa_result["visible_count"]
                    confidence = qa_result["confidence"]

                    if qa_result["match"]:
                        qa_status = "PASS"
                        qa_note = f"{modals}/{triggers} modals, ~{visible} visible, {len(units)} extracted ({confidence})"
                    else:
                        qa_status = "WARN"
                        qa_note = f"{modals}/{triggers} modals, ~{visible} visible vs {len(units)} extracted"
                else:
                    # Fallback: structural check only (no screenshots available)
                    if triggers > 0 and modals >= triggers * 0.8 and len(units) > 0:
                        qa_status = "PASS"
                        qa_note = f"{modals}/{triggers} modals, {len(units)} units (no screenshots)"
                    else:
                        qa_status = "WARN"
                        qa_note = f"Only {modals}/{triggers} modals captured"

                print(f"    [QA {qa_status}] {qa_note}")

            else:
                # Multi-viewport list QA — used when the scrape captured a scroll series
                # (e.g., tricon_api or any strategy with multi_viewport_screenshots: true).
                # A single viewport screenshot can't see units below the fold; the scroll
                # series gives Haiku a fair chance to count a long list.
                scroll_shots = fetcher._last_modal_screenshots
                if scroll_shots and len(scroll_shots) > 1:
                    print(f"    Running list QA ({len(scroll_shots)} scroll screenshots -> Haiku)...")
                    qa_result = extractor.verify_list_units(
                        scroll_shots, name, len(units)
                    )
                    visible = qa_result["visible_count"]
                    confidence = qa_result["confidence"]
                    if qa_result["match"]:
                        qa_status = "PASS"
                        qa_note = f"{len(scroll_shots)} viewports, ~{visible} visible ({confidence})"
                    else:
                        qa_status = "WARN"
                        qa_note = f"{len(scroll_shots)} viewports, ~{visible} visible vs {len(units)} extracted"
                    print(f"    [QA {qa_status}] {qa_note}")
                elif fetcher._last_screenshot:
                    print(f"    Running visual QA (Haiku)...")
                    qa_result = extractor.verify_unit_count(
                        fetcher._last_screenshot, name, len(units)
                    )
                    visible = qa_result["visible_count"]
                    confidence = qa_result["confidence"]

                    if qa_result["match"]:
                        qa_status = "PASS"
                        qa_note = f"~{visible} visible ({confidence})"
                    else:
                        qa_status = "WARN"
                        qa_note = f"~{visible} visible vs {len(units)} extracted"

                    print(f"    [QA {qa_status}] {qa_note}")
                else:
                    qa_status = "SKIP"
                    qa_note = "No screenshot"
                    print(f"    [QA SKIP] No screenshot available")

        # 5. Save to database
        if units:
            db.save_unit_data(snapshot_id, units)

        if incentives:
            db.update_snapshot_incentives(snapshot_id, incentives)

        # 6. Mark success
        db.update_snapshot_status(snapshot_id, "success")

        total_time = time.time() - start_time
        print(f"    [OK] Done in {total_time:.1f}s")
        return {
            "success": True,
            "units": len(units),
            "prev": prev_count,
            "qa_status": qa_status,
            "qa_note": qa_note,
        }

    except Exception as e:
        print(f"    [X] ERROR: {e}", file=sys.stderr)
        if snapshot_id:
            db.update_snapshot_status(snapshot_id, "error", str(e))
        return {"success": False, "units": 0, "prev": None, "qa_status": "ERROR", "qa_note": str(e)}


async def main():
    parser = argparse.ArgumentParser(
        description="Comp Tracker Scraper CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --list                          List all active buildings
  python main.py --building "The Selby"          Scrape one building
  python main.py --all                           Scrape all active buildings
  python main.py --building "The Selby" --dry-run  Fetch only, don't save
  python main.py --all --qa                      Scrape all with visual QA
        """,
    )
    parser.add_argument("--building", help="Scrape a specific building by name")
    parser.add_argument("--all", action="store_true", help="Scrape all active buildings")
    parser.add_argument("--list", action="store_true", help="List all active buildings")
    parser.add_argument("--dry-run", action="store_true", help="Fetch but do not save to database")
    parser.add_argument("--no-headless", action="store_true", help="Run browser in visible mode (for debugging)")
    parser.add_argument("--qa", action="store_true", help="Run Haiku visual QA after extraction (adds ~$0.05/run)")
    args = parser.parse_args()

    if not args.building and not args.all and not args.list:
        parser.print_help()
        sys.exit(0)

    # Load configuration
    try:
        config = Config.from_env()
    except EnvironmentError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    # Initialize modules
    headless = not args.no_headless and config.headless
    fetcher = PageFetcher(headless=headless)
    extractor = RentExtractor(config.anthropic_api_key, config.extraction_model)
    db = ScraperDB(config.supabase_url, config.supabase_service_key)

    # List mode
    if args.list:
        buildings = db.get_active_buildings()
        print(f"\nActive buildings ({len(buildings)}):")
        for b in buildings:
            url_status = "[OK]" if b.get("scrape_url") else "[X] no URL"
            print(f"  {b['name']:30s} {url_status}")
        return

    # Get buildings to scrape
    if args.building:
        building = db.get_building_by_name(args.building)
        if not building:
            print(f"Building '{args.building}' not found", file=sys.stderr)
            print("\nAvailable buildings:")
            for b in db.get_active_buildings():
                print(f"  {b['name']}")
            sys.exit(1)
        buildings = [building]
    else:
        buildings = db.get_active_buildings()

    # Run scraping
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Scraping {len(buildings)} building(s)...\n")

    success_count = 0
    fail_count = 0
    qa_results = []  # list of (name, result_dict) for summary table

    for building in buildings:
        result = await scrape_building(building, fetcher, extractor, db, dry_run=args.dry_run, qa=args.qa)
        if result["success"]:
            success_count += 1
        else:
            fail_count += 1
        qa_results.append((building["name"], result))
        print()

    # Summary
    print(f"Done: {success_count} succeeded, {fail_count} failed")

    # QA Summary Table (--qa only)
    if args.qa and qa_results:
        print(f"\n  QA Summary:")
        # Header
        print(f"  {'Building':<30s} {'Units':>5s} {'Prev':>5s} {'Delta':>7s}  {'QA':>5s}  Notes")
        print(f"  {'-' * 80}")

        pass_count = 0
        warn_count = 0
        skip_count = 0
        error_count = 0

        for name, res in qa_results:
            units = res["units"]
            prev = res["prev"]
            qa_st = res["qa_status"]
            qa_nt = res["qa_note"]

            # Delta column
            if prev is not None:
                delta = units - prev
                delta_str = f"+{delta}" if delta > 0 else str(delta)
            else:
                delta_str = "-"

            prev_str = str(prev) if prev is not None else "-"

            print(f"  {name:<30s} {units:>5d} {prev_str:>5s} {delta_str:>7s}  {qa_st:>5s}  {qa_nt}")

            if qa_st == "PASS":
                pass_count += 1
            elif qa_st == "WARN":
                warn_count += 1
            elif qa_st == "ERROR":
                error_count += 1
            else:
                skip_count += 1

        # Footer
        parts = []
        if pass_count:
            parts.append(f"{pass_count} PASS")
        if warn_count:
            parts.append(f"{warn_count} WARN")
        if error_count:
            parts.append(f"{error_count} ERROR")
        if skip_count:
            parts.append(f"{skip_count} SKIP")
        print(f"\n  {len(qa_results)} buildings: {', '.join(parts)}")


if __name__ == "__main__":
    asyncio.run(main())
