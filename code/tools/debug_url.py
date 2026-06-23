"""
General-purpose URL inspector for testing new scraper targets.

Usage:
    python tools/debug_url.py "https://example.com/floorplans"
    python tools/debug_url.py "https://example.com/floorplans" --no-headless
    python tools/debug_url.py "https://example.com/floorplans" --scroll
    python tools/debug_url.py "https://example.com/floorplans" --no-headless --scroll --wait 10
    python tools/debug_url.py "https://example.com/floorplans" --find-sqft
    python tools/debug_url.py "https://example.com/floorplans" --find-sqft --no-headless
"""

import asyncio
import argparse
import os
import re
import sys
import time
import random
from datetime import datetime
from playwright.async_api import async_playwright

import httpx
from dotenv import load_dotenv

# Load .env from scraper directory so ANTHROPIC_API_KEY is available for --find-sqft
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
# Ensure extractor.py is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Reuse anti-bot config from fetcher.py
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
]

VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1536, "height": 864},
    {"width": 1440, "height": 900},
    {"width": 1366, "height": 768},
]

# CSS selectors that typically contain rental listing data
RENTAL_SELECTORS = [
    '[class*="floor"]',
    '[class*="unit"]',
    '[class*="suite"]',
    '[class*="plan"]',
    '[class*="price"]',
    '[class*="rent"]',
    '[class*="listing"]',
    '[class*="availability"]',
    '[class*="apartment"]',
    '[class*="floorplan"]',
    '[class*="fp-"]',
    '[class*="bed"]',
    '[class*="bath"]',
    '[class*="sqft"]',
    '[class*="sq-ft"]',
]


def slugify(url: str) -> str:
    """Convert URL to a safe filename slug."""
    # Remove protocol
    slug = re.sub(r'https?://', '', url)
    # Replace non-alphanumeric with dashes
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', slug)
    # Trim dashes and truncate
    return slug.strip('-')[:80]


async def run_sqft_discovery(page, url: str):
    """Auto-discover floor plan images on the page and extract sqft via Haiku vision."""

    print(f"\n{'='*70}")
    print(f"  Floor Plan Sqft Discovery")
    print(f"{'='*70}")

    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_api_key:
        print("  ERROR: ANTHROPIC_API_KEY_RENT_COMPS not set in .env — cannot run vision extraction")
        return

    image_urls = []       # img src URLs to download
    image_bytes_list = [] # bytes from element screenshots (strategy 3)
    strategies_used = []
    s2_winning_selector = None
    s3_thumb_sel_used = None

    # --- Strategy 1: sqft-text-adjacent images ---
    print("\n  [Strategy 1] Searching for sqft-text-adjacent images...")
    try:
        s1_urls = await page.evaluate("""() => {
            const results = [];
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
                if (/\\d+\\s*sq\\.?\\s*ft/i.test(el.textContent || '')) {
                    // Only leaf-like containers, not the whole body
                    if (el.children.length <= 5) {
                        let container = el;
                        for (let i = 0; i < 3; i++) {
                            const img = container.querySelector('img');
                            if (img && img.src && img.src.startsWith('http')) {
                                results.push(img.src);
                                break;
                            }
                            if (container.parentElement) container = container.parentElement;
                        }
                    }
                }
            }
            return [...new Set(results)];
        }""")
        if s1_urls:
            image_urls.extend(s1_urls)
            strategies_used.append("strategy-1 (sqft-text-adjacent)")
            print(f"    Found {len(s1_urls)} image(s): {s1_urls[:3]}")
        else:
            print(f"    No images found")
    except Exception as e:
        print(f"    Error: {e}")

    # --- Strategy 2: Common floor plan / carousel selectors ---
    print("\n  [Strategy 2] Scanning floor plan / carousel selectors...")
    fp_selectors = [
        '[class*="floor-plan"] img',
        '[class*="floorplan"] img',
        '[id*="floor"] img',
        '.flex-control-thumbs li img',
        '.flex-viewport .slides li img',
        '.slick-slide:not(.slick-cloned) img',
        '.owl-item img',
        '[class*="slide"] img',
        '[class*="fp-"] img',
    ]
    for sel in fp_selectors:
        try:
            imgs = await page.evaluate(f"""() => {{
                return Array.from(document.querySelectorAll('{sel}'))
                    .map(img => img.src || img.getAttribute('data-src') || '')
                    .filter(src => src.startsWith('http'));
            }}""")
            if imgs:
                print(f"    {sel}: {len(imgs)} image(s)")
                if s2_winning_selector is None:
                    s2_winning_selector = sel
                image_urls.extend(imgs)
        except Exception:
            pass

    if s2_winning_selector:
        strategies_used.append(f"strategy-2 (carousel selectors, first match: {s2_winning_selector})")
    else:
        print(f"    No images found from carousel selectors")

    # Deduplicate URL list, cap at 10
    seen_urls = set()
    unique_urls = []
    for u in image_urls:
        if u not in seen_urls:
            seen_urls.add(u)
            unique_urls.append(u)
    unique_urls = unique_urls[:10]

    # --- Strategy 3: Carousel thumbnail cycling (fallback if < 2 unique image URLs) ---
    if len(unique_urls) < 2:
        print("\n  [Strategy 3] Trying carousel thumbnail cycling...")
        thumb_selectors = [
            '.flex-control-thumbs li',
            '.slick-dots li',
            '[class*="thumb"] li',
        ]
        active_img_selectors = [
            '.flex-active img',
            '.slick-active img',
            '[class*="active"] img',
        ]
        s3_screenshots = []
        s3_thumb_sel_used = None

        for thumb_sel in thumb_selectors:
            try:
                thumbs = await page.query_selector_all(thumb_sel)
                if thumbs:
                    print(f"    Found {len(thumbs)} thumbnail(s) via: {thumb_sel}")
                    s3_thumb_sel_used = thumb_sel
                    for thumb in thumbs[:10]:
                        try:
                            await thumb.click()
                            await asyncio.sleep(0.8)
                            for active_sel in active_img_selectors:
                                active_img = await page.query_selector(active_sel)
                                if active_img:
                                    box = await active_img.bounding_box()
                                    if box and box['width'] > 50 and box['height'] > 50:
                                        shot = await page.screenshot(clip={
                                            'x': box['x'], 'y': box['y'],
                                            'width': box['width'], 'height': box['height'],
                                        })
                                        s3_screenshots.append(shot)
                                        break
                        except Exception:
                            pass
                    break
            except Exception:
                pass

        if s3_screenshots:
            image_bytes_list.extend(s3_screenshots)
            strategies_used.append(
                f"strategy-3 (carousel cycling via {s3_thumb_sel_used}, {len(s3_screenshots)} screenshots)"
            )
            print(f"    Collected {len(s3_screenshots)} screenshot(s)")
        else:
            print(f"    No screenshots collected from carousel cycling")

    # --- Download URL-based images ---
    print(f"\n  Downloading {len(unique_urls)} URL-based image(s)...")
    if unique_urls:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            for img_url in unique_urls:
                try:
                    resp = await client.get(
                        img_url, headers={"User-Agent": random.choice(USER_AGENTS)}
                    )
                    if resp.status_code == 200:
                        image_bytes_list.append(resp.content)
                        print(f"    OK: {img_url[:90]}")
                    else:
                        print(f"    HTTP {resp.status_code}: {img_url[:90]}")
                except Exception as e:
                    print(f"    Failed: {img_url[:90]} — {e}")

    total_images = len(image_bytes_list)
    print(f"\n  Total images for vision: {total_images}")

    if total_images == 0:
        print(f"\n  No images collected. Strategies tried: {', '.join(strategies_used) or 'none succeeded'}")
        print(f"  Tip: Try --no-headless to inspect the page manually, or add --scroll to load lazy images.")
        return

    # --- Send to Haiku vision ---
    print(f"  Sending to Haiku vision for sqft extraction...")
    from extractor import RentExtractor
    extractor = RentExtractor(api_key=anthropic_api_key)
    sqft_map = extractor.extract_sqft_from_screenshots(
        image_bytes_list[:10],
        building_name="debug",
    )

    # --- Print results ---
    print(f"\n{'='*70}")
    print(f"  === Floor Plan Sqft Discovery Results ===")
    print(f"  Strategies used:  {', '.join(strategies_used) or 'none'}")
    print(f"  Images collected: {total_images}")
    print()

    if sqft_map:
        print(f"  Haiku extracted:")
        for unit_type, sqft in sorted(sqft_map.items()):
            print(f"    {unit_type:<14} {sqft} sqft")

        print(f"\n  Suggested vision_enrichment config:")

        if "strategy-1" in " ".join(strategies_used):
            print(f"  (Strategy 1 found sqft alongside HTML text — consider pre_capture_js")
            print(f"   to collect that text directly, which is cheaper than vision.)")
        else:
            # Suggest a config snippet based on what worked
            tile_sel = s3_thumb_sel_used or ".flex-control-thumbs li"
            if "strategy-2" in " ".join(strategies_used) and s2_winning_selector:
                # Strip ' img' suffix to get the tile selector
                tile_sel = s2_winning_selector.replace(" img", "").strip()
            print(f"""  "vision_enrichment": {{
    "enabled": true,
    "mode": "image_urls",
    "tile_selector": "{tile_sel}",
    "image_selector": "img",
    "max_images": 10
  }}""")
        print(f"\n  (Verify selectors in DevTools, then update comp_buildings.scrape_config in Supabase)")
    else:
        print(f"  No sqft found by Haiku.")
        print(f"  Images sent: {total_images}")
        print(f"  Tip: The floor plan images may not contain visible sqft text.")
        print(f"       Try --no-headless to inspect which images are being captured.")

    print(f"{'='*70}")


async def inspect_url(url: str, headless: bool = False, scroll: bool = False, wait_seconds: int = 8, find_sqft: bool = False):
    """Open a URL in Playwright and report what we find."""

    print(f"\n{'='*70}")
    print(f"  URL Inspector")
    print(f"  Target: {url}")
    print(f"  Headless: {headless} | Scroll: {scroll} | Wait: {wait_seconds}s")
    print(f"{'='*70}\n")

    async with async_playwright() as p:
        # Anti-bot browser context (matches fetcher.py)
        browser = await p.chromium.launch(headless=headless)
        ua = random.choice(USER_AGENTS)
        viewport = random.choice(VIEWPORTS)

        context = await browser.new_context(
            user_agent=ua,
            viewport=viewport,
            locale="en-CA",
            timezone_id="America/Toronto",
        )
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-CA', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)

        page = await context.new_page()

        # --- Step 1: Navigate ---
        print("[1/7] Navigating...")
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
            status = response.status if response else "No response"
            print(f"  Status: {status}")
            print(f"  Final URL: {page.url}")
            if page.url != url:
                print(f"  ** REDIRECTED from original URL **")
        except Exception as e:
            print(f"  Navigation failed: {e}")
            await browser.close()
            return

        # --- Step 2: Wait for JS rendering ---
        print(f"\n[2/7] Waiting {wait_seconds}s for JS to render...")
        await asyncio.sleep(wait_seconds)

        # --- Step 3: Dismiss popups ---
        print(f"\n[3/7] Dismissing popups...")
        popup_selectors = [
            "button:has-text('Accept')", "button:has-text('Accept All')",
            "button:has-text('Got it')", "button:has-text('OK')",
            "button:has-text('Agree')", "[id*='cookie'] button",
            "[class*='cookie'] button",
        ]
        try:
            await page.evaluate("""
                document.querySelectorAll('dialog[open]').forEach(d => d.close());
            """)
        except Exception:
            pass
        for sel in popup_selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    print(f"  Dismissed: {sel}")
                    await asyncio.sleep(0.5)
            except Exception:
                pass

        # --- Step 4: Optional scroll ---
        if scroll:
            print(f"\n[4/7] Scrolling page...")
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)
            for _ in range(5):
                scroll_amount = random.randint(300, 700)
                await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
                await asyncio.sleep(random.uniform(0.5, 1.0))
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(1)
            print(f"  Scrolling complete")
        else:
            print(f"\n[4/7] Scroll skipped (use --scroll to enable)")

        # --- Step 5: Screenshot ---
        print(f"\n[5/7] Taking screenshot...")
        screenshot_dir = os.path.join(os.path.dirname(__file__), "debug_screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        slug = slugify(url)
        screenshot_path = os.path.join(screenshot_dir, f"{slug}_{timestamp}.png")
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"  Saved: {screenshot_path}")

        # --- Step 6: Analyze page content ---
        print(f"\n[6/7] Analyzing page content...")

        # Body text
        body_text = await page.evaluate("() => document.body.innerText")
        print(f"\n  Body text length: {len(body_text):,} chars")
        print(f"  First 2000 chars:")
        print(f"  {'~'*60}")
        for line in body_text[:2000].split('\n'):
            if line.strip():
                print(f"    {line.strip()}")
        print(f"  {'~'*60}")

        # Check for pricing keywords
        price_patterns = [
            r'\$[\d,]+', r'\d+\s*(?:sq\.?\s*ft|sqft|SF)',
            r'(?:studio|bachelor|1\s*bed|2\s*bed|3\s*bed)',
            r'(?:available|waitlist|lease)',
        ]
        print(f"\n  Keyword scan:")
        for pattern in price_patterns:
            matches = re.findall(pattern, body_text, re.IGNORECASE)
            if matches:
                unique = list(set(matches[:10]))
                print(f"    {pattern}: {unique}")

        # Iframe scan
        iframes = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('iframe')).map(f => ({
                src: f.src || f.getAttribute('data-src') || '',
                width: f.width || f.style.width || '',
                height: f.height || f.style.height || '',
                id: f.id || '',
                className: f.className || '',
            }));
        }""")
        print(f"\n  Iframes found: {len(iframes)}")
        for i, iframe in enumerate(iframes):
            print(f"    [{i}] src={iframe['src'][:120]}, id={iframe['id']}, class={iframe['className']}")

        # Shadow DOM scan
        shadow_info = await page.evaluate("""() => {
            const results = [];
            function findShadowRoots(root, depth = 0) {
                const allElements = root.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.shadowRoot) {
                        results.push({
                            tag: el.tagName,
                            className: (el.className?.substring?.(0, 100) || ''),
                            id: el.id,
                            depth: depth,
                            textLen: el.shadowRoot.textContent?.length || 0,
                        });
                        findShadowRoots(el.shadowRoot, depth + 1);
                    }
                }
            }
            findShadowRoots(document);
            return results;
        }""")
        print(f"\n  Shadow DOM hosts: {len(shadow_info)}")
        for s in shadow_info:
            print(f"    <{s['tag']}> id={s['id']} class={s['className']} textLen={s['textLen']}")

        # Rental-related element scan
        print(f"\n  Rental-related elements:")
        for sel in RENTAL_SELECTORS:
            try:
                elements = await page.query_selector_all(sel)
                if elements:
                    # Get sample text from first element
                    sample = ""
                    try:
                        sample = await elements[0].inner_text()
                        sample = sample.strip()[:100].replace('\n', ' ')
                    except Exception:
                        pass
                    print(f"    {sel}: {len(elements)} element(s) -- sample: \"{sample}\"")
            except Exception:
                pass

        # --- Step 7: Check for common rental platform patterns ---
        print(f"\n[7/7] Platform detection...")
        page_html = await page.content()

        platforms = {
            "RentCafe/Yardi": ["rentcafe", "yardi", "g5-orion"],
            "SecureCafe": ["securecafe"],
            "RentSync": ["rentsync", "theliftsystem"],
            "Next.js": ["__next", "_next/static", "__NEXT_DATA__"],
            "React": ["__react", "react-root", "data-reactroot"],
            "Cloudflare": ["cf-ray", "cf-cache", "__cf_bm", "challenges.cloudflare"],
            "RealPage": ["realpage"],
            "Entrata": ["entrata"],
        }
        for platform, markers in platforms.items():
            found = [m for m in markers if m.lower() in page_html.lower()]
            if found:
                print(f"  [DETECTED] {platform}: {found}")

        # --- Optional: sqft auto-discovery ---
        if find_sqft:
            await run_sqft_discovery(page, url)

        # Keep browser open for manual inspection if not headless
        if not headless:
            print(f"\n{'='*70}")
            print(f"  Browser is open for manual inspection.")
            print(f"  Close the browser window or wait 120s to exit.")
            print(f"{'='*70}")
            try:
                await asyncio.sleep(120)
            except KeyboardInterrupt:
                pass

        await browser.close()
        print(f"\n  Done.")


def main():
    parser = argparse.ArgumentParser(description="Inspect a URL with Playwright for scraper development")
    parser.add_argument("url", help="URL to inspect")
    parser.add_argument("--no-headless", action="store_true", help="Show the browser window (default: visible)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode (no browser window)")
    parser.add_argument("--scroll", action="store_true", help="Scroll the page to trigger lazy loading")
    parser.add_argument("--wait", type=int, default=8, help="Seconds to wait for JS rendering (default: 8)")
    parser.add_argument("--find-sqft", action="store_true",
                        help="Auto-discover floor plan images and extract sqft via Haiku vision")
    args = parser.parse_args()

    # Default to visible browser (--no-headless behavior) unless --headless is explicitly set
    is_headless = args.headless and not args.no_headless

    asyncio.run(inspect_url(
        args.url,
        headless=is_headless,
        scroll=args.scroll,
        wait_seconds=args.wait,
        find_sqft=args.find_sqft,
    ))


if __name__ == "__main__":
    main()
