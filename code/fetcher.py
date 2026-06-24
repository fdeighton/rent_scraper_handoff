"""
Page fetching module using Playwright with anti-bot measures.
Supports multiple strategies for different site types.
"""

import asyncio
import ipaddress
import json
import random
import re
import socket
import sys
import urllib.error
import urllib.request
from urllib.parse import quote, urljoin, urlsplit
from typing import Optional
from playwright.async_api import async_playwright, Page, BrowserContext

# Realistic user agents
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


def extract_og_image(html: str, base_url: str) -> Optional[str]:
    """Pull the marketing hero (og:image / twitter:image) URL from page HTML,
    resolved to an absolute URL. og: meta tags are server-rendered in <head> for
    SEO, so a plain HTML fetch picks them up without running the page's JS."""
    pats = [
        r'<meta[^>]+property=["\']og:image(?::secure_url|:url)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for p in pats:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return urljoin(base_url, m.group(1).strip())
    return None


def _clean_config(config: dict) -> dict:
    """Drop keys whose value is None so `config.get(key, default)` falls back to
    the default instead of returning None. A JSON `null` in a site config (or a
    Supabase scrape_config) means "use the default", but `.get` only substitutes
    the default for ABSENT keys — a present-but-None `initial_wait_ms` would reach
    `None / 1000` and raise TypeError. Stripping None here mirrors what the local
    server already does on its path, so both entry points behave the same."""
    return {k: v for k, v in (config or {}).items() if v is not None}


# --- SSRF guards -------------------------------------------------------------
# Every outbound URL the scraper touches — the top-level target, additional_urls,
# links discovered on the page, image/og URLs — must be a public http(s) endpoint.
# Without this a malicious or compromised target page can point the scraper at
# internal services or the cloud metadata endpoint (169.254.169.254).

def _ip_is_blocked(ip) -> bool:
    return bool(ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


def is_public_http_url(url) -> bool:
    """True only for an http(s) URL whose host resolves entirely to public
    addresses. Shared by the local server (entry check) and the fetcher (every
    secondary fetch). Resolves DNS, so it also catches decimal/octal/IPv4-mapped
    encodings that normalize to a private address."""
    if not isinstance(url, str):
        return False
    try:
        parts = urlsplit(url)
    except Exception:
        return False
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parts.hostname, None)
    except Exception:
        return False
    if not infos:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if _ip_is_blocked(ip):
            return False
    return True


async def _block_private_requests(route) -> None:
    """Playwright route handler: abort any request whose host is a *literal*
    private/loopback/link-local IP. Cheap (no DNS) and fail-open, so it adds no
    page-behaviour change for normal hostname traffic but blocks a target page (or
    a redirect/subresource) from reaching an internal IP such as 169.254.169.254.
    Every matched request must be resolved or it hangs — hence the broad guards."""
    host = ""
    try:
        host = urlsplit(route.request.url).hostname or ""
    except Exception:
        host = ""
    blocked = False
    if host:
        try:
            blocked = _ip_is_blocked(ipaddress.ip_address(host))
        except ValueError:
            blocked = False   # a hostname, not a literal IP — allow through
    try:
        await (route.abort() if blocked else route.continue_())
    except Exception:
        pass


async def _safe_get(client, url, **kwargs):
    """httpx GET that validates the SSRF guard on the initial URL *and every
    redirect hop*, so a 30x to an internal host can't slip past. Returns the
    httpx Response, or None if the URL (or any hop) is not a public http(s)
    endpoint. follow_redirects is forced off and handled manually."""
    seen = 0
    while seen <= 5:
        if not is_public_http_url(url):
            return None
        resp = await client.get(url, follow_redirects=False, **kwargs)
        if resp.is_redirect and resp.headers.get("location"):
            url = urljoin(str(resp.url), resp.headers["location"])
            seen += 1
            continue
        return resp
    return None


class PageFetcher:
    """Fetches rendered HTML from rental listing pages."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self._last_screenshot: bytes | None = None
        self._last_fetch_meta: dict = {}
        self._last_modal_screenshots: list[bytes] = []
        # Set by API-based strategies (e.g., tricon_api) to pass structured units
        # to main.py without round-tripping through Claude HTML extraction.
        self._last_api_units: list[dict] | None = None
        self._last_api_incentives: str | None = None

    # Public read-only accessors for the most-recent fetch's side outputs. fetch()
    # populates the private attrs as it runs; callers (main.py / local_server.py)
    # read them through these instead of reaching into underscore-internals.
    @property
    def last_api_units(self):
        return self._last_api_units

    @property
    def last_api_incentives(self):
        return self._last_api_incentives

    @property
    def last_fetch_meta(self):
        return self._last_fetch_meta

    @property
    def last_screenshot(self):
        return self._last_screenshot

    @property
    def last_modal_screenshots(self):
        return self._last_modal_screenshots

    async def fetch_og_image(self, page_url: str):
        """Fetch a listing/home page's og:image (the marketing hero shot) and
        return (image_bytes, content_type), or None. Used to auto-populate a
        building photo that matches the curated exterior photos already on file.
        """
        import httpx
        ua = random.choice(USER_AGENTS)
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20,
                                         headers={"User-Agent": ua}) as client:
                page = await _safe_get(client, page_url)
                if page is None:
                    return None
                img_url = extract_og_image(page.text, str(page.url))
                if not img_url:
                    return None
                img = await _safe_get(client, img_url, headers={"Referer": page_url})
                if img is None or img.status_code != 200 or not img.content:
                    return None
                ct = (img.headers.get("content-type") or "image/jpeg").split(";")[0].strip().lower()
                if not ct.startswith("image/"):
                    ct = "image/jpeg"
                if len(img.content) < 3000:   # skip sprites / 1px trackers / logos
                    return None
                return img.content, ct
        except Exception as e:
            print(f"      og:image fetch failed: {e}")
            return None

    async def fetch(self, url: str, config: dict) -> str:
        """
        Fetch page content based on strategy.

        Args:
            url: The URL to fetch
            config: Site-specific configuration dict with keys:
                - strategy: 'playwright_render' | 'static_html' | 'iframe_extract' | 'filter_iterate'
                - wait_selector: CSS selector to wait for
                - scroll: whether to scroll the page
                - scroll_count: number of scrolls
                - click_selectors: list of CSS selectors to click before capturing
                - click_repeat: if true, loop each click_selector until it disappears (for "Load More")
                - max_click_repeats: max loop iterations per click_selector (default 30)
                - content_selector: CSS selector for the main content area
                - initial_wait_ms: milliseconds to wait after page load
                - next_button_selector: CSS selector for a "Next" button to click repeatedly
                - next_button_wait_ms: ms to wait after clicking next button (default 2000)
                - max_pages: max iterations for next_button_selector (default 50)
                - shadow_host_selector: CSS selector for a shadow DOM host element
                - section_clicks: list of CSS selectors for tab sections to iterate through.
                  When present, the pagination loop runs once per section tab.
                - section_wait_ms: ms to wait after clicking a section tab (default 3000)
                - additional_urls: list of extra URLs to fetch and append (e.g., a separate penthouse page)
                - dynamic_additional_urls_selector: CSS selector for <a> elements whose href
                  attributes become subpage URLs — fetched within the SAME browser context
                  (preserves Cloudflare / auth cookies). Useful for sites where the "Availability"
                  button on each floor plan card links to a per-plan listing subpage.
                - dynamic_subpage_wait_ms: ms to wait after each subpage load (default 5000)
                - pre_capture_js: JavaScript string to evaluate before content capture.
                  Useful for injecting hidden data (e.g., data attributes) as visible text.
        """
        self._last_screenshot = None
        self._last_fetch_meta = {}
        self._last_modal_screenshots = []
        self._last_api_units = None
        self._last_api_incentives = None
        config = _clean_config(config)
        strategy = config.get("strategy", "playwright_render")

        if strategy == "static_html":
            content = await self._fetch_static(url)
        elif strategy == "playwright_render":
            content = await self._fetch_playwright(url, config)
        elif strategy == "iframe_extract":
            content = await self._fetch_iframe(url, config)
        elif strategy == "filter_iterate":
            content = await self._fetch_with_filters(url, config)
        elif strategy == "modal_iterate":
            content = await self._fetch_with_modals(url, config)
        elif strategy == "akamai_stealth":
            content = await self._fetch_akamai_stealth(url, config)
        elif strategy == "tricon_api":
            content = await self._fetch_tricon_api(url, config)
        else:
            # Default to playwright_render for unknown strategies
            print(f"  Warning: Unknown strategy '{strategy}', falling back to playwright_render")
            content = await self._fetch_playwright(url, config)

        # Fetch additional pages and append (e.g., penthouse listings on a separate URL)
        additional_urls = config.get("additional_urls", [])
        for extra_url in additional_urls:
            if not is_public_http_url(extra_url):     # SSRF: only public http(s) targets
                print(f"      Skipping additional page (non-public URL): {extra_url}")
                continue
            print(f"      Fetching additional page: {extra_url}")
            extra_content = await self._fetch_playwright(extra_url, config)
            if extra_content:
                content += "\n<!-- ADDITIONAL PAGE -->\n" + extra_content

        return content

    async def _create_context(self, playwright, headless: bool | None = None) -> tuple:
        """Create a browser context with anti-bot measures."""
        browser = await playwright.chromium.launch(headless=headless if headless is not None else self.headless)

        # If context creation fails after the browser launched, close the browser so
        # it isn't orphaned — callers only wrap cleanup around the returned tuple, so
        # a raise here would otherwise leak the chromium process.
        try:
            ua = random.choice(USER_AGENTS)
            viewport = random.choice(VIEWPORTS)

            context = await browser.new_context(
                user_agent=ua,
                viewport=viewport,
                locale="en-CA",
                timezone_id="America/Toronto",
            )

            # Anti-bot: mask webdriver property
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-CA', 'en-US', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            """)
            # SSRF: block navigations/subresources/redirects to a literal internal IP.
            await context.route("**/*", _block_private_requests)
        except Exception:
            await browser.close()
            raise

        return browser, context

    async def _human_scroll(self, page: Page, count: int = 3) -> None:
        """Simulate human-like scrolling with random pauses."""
        for _ in range(count):
            scroll_amount = random.randint(300, 700)
            await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
            await asyncio.sleep(random.uniform(0.5, 1.5))

    async def _capture_qa_assets(self, page: Page, config: dict) -> None:
        """Capture screenshot(s) for downstream Haiku QA.

        Always captures a single viewport screenshot (`_last_screenshot`).
        If `multi_viewport_screenshots: true` is set in config, additionally
        captures a top-to-bottom scroll series into `_last_modal_screenshots`,
        which the QA flow in main.py will route to `verify_list_units`.
        """
        if config.get("multi_viewport_screenshots"):
            try:
                # By the time we get here, prior page operations (scroll loops,
                # pagination, dynamic subpage navigation) may have left the page
                # in a state where the unit list isn't visible — e.g., a tab
                # got deactivated, or "Load More" pagination got reset. Restore:
                #   1. Re-run setup_clicks (e.g., Availability tab, List View)
                #   2. Click any Load More / Show More buttons until exhausted
                # so all rows are visible to the screenshots.
                setup_clicks = config.get("setup_clicks") or []
                for sel in setup_clicks:
                    try:
                        el = await page.wait_for_selector(sel, timeout=3000)
                        if el:
                            await el.click()
                            await page.wait_for_timeout(800)
                    except Exception:
                        pass

                try:
                    load_more_clicks = await self._auto_click_load_more(page, max_clicks=30)
                    if load_more_clicks:
                        print(f"      [scroll-qa] expanded list with {load_more_clicks} Load More click(s)")
                except Exception as e:
                    print(f"      [scroll-qa] auto-click Load More failed: {e}", file=sys.stderr)

                # Anchor scrolling to individual list ROWS (not the container).
                # The container can have misleading bounds (virtualized lists,
                # sticky headers, etc.); selecting individual items and using
                # scrollIntoView gives a robust start/end Y range.
                item_selector = (
                    config.get("multi_viewport_item_selector")
                    or config.get("wait_selector")
                )
                shots = await self._capture_scroll_screenshots(
                    page, item_selector=item_selector,
                )
                if shots:
                    self._last_modal_screenshots = shots
                    print(f"      [scroll-qa] captured {len(shots)} viewport screenshots")
                    # Optional debug: save screenshots to disk for inspection
                    if config.get("multi_viewport_debug_save"):
                        import os
                        from datetime import datetime
                        stamp = datetime.now().strftime("%H%M%S")
                        os.makedirs("debug_screenshots", exist_ok=True)
                        for idx, s in enumerate(shots, 1):
                            path = f"debug_screenshots/scrollqa_{stamp}_{idx:02d}.jpg"
                            with open(path, "wb") as f:
                                f.write(s)
                        print(f"      [scroll-qa] saved {len(shots)} debug screenshots to debug_screenshots/")
            except Exception as e:
                print(f"      [scroll-qa] capture failed: {e}", file=sys.stderr)
        try:
            self._last_screenshot = await page.screenshot(type="jpeg", quality=60, full_page=False)
        except Exception:
            pass

    async def _capture_scroll_screenshots(
        self,
        page: Page,
        max_screenshots: int = 25,
        settle_ms: int = 600,
        item_selector: Optional[str] = None,
    ) -> list[bytes]:
        """Scroll the page in viewport-sized steps and screenshot each.

        Used by Haiku visual QA to see units that fall below the initial
        viewport. If `item_selector` is given (e.g., `.TableList-item`),
        scrollIntoView() runs on the FIRST and LAST matching elements to
        locate the actual rendered list — works correctly even when the
        container element has misleading bounds (e.g., when rows are
        virtualized or the parent is sticky/positioned weirdly).

        Stops when scrollY stops advancing OR we've passed the last item
        OR max_screenshots is reached.

        Returns list of JPEG bytes ordered top-to-bottom.
        """
        shots: list[bytes] = []
        try:
            viewport_h = await page.evaluate("window.innerHeight") or 900

            # Determine start/end Y by scrolling individual items into view.
            # This handles virtualized lists / sticky headers / weird positioning
            # better than measuring container bounds directly.
            start_y = 0
            end_y = await page.evaluate("document.documentElement.scrollHeight") or viewport_h
            if item_selector:
                # Scroll the LAST item into view first so its bound is real
                last_y = await page.evaluate(
                    """(sel) => {
                        const els = document.querySelectorAll(sel);
                        if (!els.length) return null;
                        const last = els[els.length - 1];
                        last.scrollIntoView({block: 'end', inline: 'nearest'});
                        const r = last.getBoundingClientRect();
                        return r.bottom + window.scrollY;
                    }""",
                    item_selector,
                )
                # Then scroll the FIRST item into view to get the start position
                first_y = await page.evaluate(
                    """(sel) => {
                        const els = document.querySelectorAll(sel);
                        if (!els.length) return null;
                        els[0].scrollIntoView({block: 'start', inline: 'nearest'});
                        const r = els[0].getBoundingClientRect();
                        return r.top + window.scrollY;
                    }""",
                    item_selector,
                )
                count = await page.evaluate(
                    "(sel) => document.querySelectorAll(sel).length", item_selector
                )
                if first_y is not None and last_y is not None:
                    start_y = max(0, int(first_y) - int(viewport_h * 0.05))
                    end_y = int(last_y) + int(viewport_h * 0.05)
                    print(
                        f"      [scroll-qa] item_selector='{item_selector}' "
                        f"matched {count} elements, y={start_y}-{end_y} (viewport={viewport_h})"
                    )
                else:
                    print(
                        f"      [scroll-qa] item_selector '{item_selector}' not found "
                        f"(count={count}), falling back to full-page scroll",
                        file=sys.stderr,
                    )

            await page.evaluate(f"window.scrollTo(0, {start_y})")
            await page.wait_for_timeout(settle_ms)

            prev_scroll_y = -1
            for i in range(max_screenshots):
                try:
                    shot = await page.screenshot(type="jpeg", quality=60, full_page=False)
                    shots.append(shot)
                except Exception as e:
                    print(f"      [scroll-qa] screenshot {i + 1} failed: {e}", file=sys.stderr)
                    break

                cur_scroll_y = await page.evaluate("window.scrollY")
                if cur_scroll_y == prev_scroll_y:
                    break
                if cur_scroll_y + viewport_h >= end_y - 5:
                    break
                prev_scroll_y = cur_scroll_y

                await page.evaluate(f"window.scrollBy(0, {int(viewport_h * 0.9)})")
                await page.wait_for_timeout(settle_ms)

            try:
                await page.evaluate("window.scrollTo(0, 0)")
            except Exception:
                pass
        except Exception as e:
            print(f"      [scroll-qa] scroll capture error: {e}", file=sys.stderr)

        return shots

    async def fetch_screenshots(self, url: str, config: dict) -> list[bytes]:
        """Collect floor plan images for vision-based sqft extraction.

        Supports three modes:
        1. "image_urls" mode: Extract unique floor plan image URLs from tile elements
           and download them via HTTP. Faster and more reliable for sites like Planpoint
           where images are accessible via direct URLs.
        2. "click" mode: Click unit cards and screenshot the detail panel.
        3. "click_popup" mode: Click each tile to open a popup, collect the first image
           URL from the popup, close it, then download all collected images. Use for
           MetCap Living / Duda sites where floor plan images are behind a gallery icon.

        Config keys (inside vision_enrichment):
            Common:
            - mode: 'image_urls' (default), 'click', or 'click_popup'
            - tile_selector: CSS selector for unit tile elements
            - initial_wait_ms: ms to wait after page load (default: 12000)
            - max_images: max number of images to collect (default: 20)

            For image_urls mode:
            - image_selector: CSS selector for img elements within tiles (default: 'img')
            - image_attr: if set, reads this attribute from the tile element itself instead
              of looking for a child img (e.g. "href" for <a> tiles whose href IS the image URL)

            For click mode:
            - detail_selector: CSS selector for the detail panel to screenshot
            - close_selector: 'escape', 'back', or a CSS selector (default: 'escape')
            - detail_wait_ms: ms to wait after click (default: 3000)
            - back_selector: text selector to go back (e.g., 'Browse all units')

            For click_popup mode:
            - popup_image_selector: CSS selector for img inside the popup (default: 'img')
            - close_selector: CSS selector for popup close button (default: 'escape')
            - wait_ms: ms to wait after clicking tile for popup to load (default: 2000)

        Returns:
            List of image bytes (JPEG or PNG, one per unique plan type).
        """
        import httpx

        config = _clean_config(config)
        tile_selector = config.get("tile_selector")
        if not tile_selector:
            print(f"      Vision: no tile_selector configured, skipping")
            return []

        mode = config.get("mode", "image_urls")
        initial_wait = config.get("initial_wait_ms", 12000)
        max_images = config.get("max_images", 20)

        async with async_playwright() as p:
            browser, context = await self._create_context(p)

            try:
                page = await context.new_page()

                # Navigate and wait for JS rendering
                print(f"      Vision [1/4] Navigating to {url}...")
                await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                print(f"      Vision [2/4] Waiting {initial_wait/1000:.0f}s for page to settle...")
                await asyncio.sleep(initial_wait / 1000)
                await self._dismiss_popups(page)

                # Scroll to load all tiles
                print(f"      Vision [3/4] Scrolling to load all tiles...")
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(2)
                await self._human_scroll(page, 3)
                await page.evaluate("window.scrollTo(0, 0)")
                await asyncio.sleep(1)

                if mode == "image_urls":
                    return await self._vision_image_urls(page, config, max_images)
                elif mode == "click_popup":
                    return await self._vision_click_popup(page, config, max_images)
                else:
                    return await self._vision_click(page, config, max_images)

            finally:
                await browser.close()

    async def _vision_image_urls(self, page, config: dict, max_images: int) -> list[bytes]:
        """Extract unique floor plan image URLs from tiles and download them."""
        import httpx

        tile_selector = config["tile_selector"]
        image_selector = config.get("image_selector", "img")
        image_attr = config.get("image_attr")  # e.g. "href" for <a> tiles whose href is the image URL

        # Extract all unique image URLs from tiles
        image_urls = await page.evaluate("""(args) => {
            const tiles = document.querySelectorAll(args.tileSel);
            const seen = new Set();
            const urls = [];
            for (const tile of tiles) {
                if (args.imageAttr) {
                    // Read the URL directly from the tile element's attribute (e.g. href).
                    // Prefer DOM property access (tile.href / tile.src) because browsers
                    // auto-resolve relative URLs there; fall back to getAttribute for
                    // custom attributes like data-src that aren't reflected as properties.
                    const propVal = tile[args.imageAttr];
                    const attrVal = tile.getAttribute(args.imageAttr);
                    const src = (typeof propVal === 'string' && propVal) ? propVal : (attrVal || '');
                    if (!src || !src.startsWith('http')) continue;
                    if (seen.has(src)) continue;
                    seen.add(src);
                    urls.push(src);
                } else {
                    // Default: querySelectorAll for img children (handles container tiles)
                    const imgs = tile.querySelectorAll(args.imgSel);
                    for (const img of imgs) {
                        if (!img || !img.src) continue;
                        const src = img.src;
                        if (seen.has(src)) continue;
                        seen.add(src);
                        urls.push(src);
                    }
                }
            }
            return urls;
        }""", {"tileSel": tile_selector, "imgSel": image_selector, "imageAttr": image_attr})

        if not image_urls:
            print(f"      Vision: no image URLs found in tiles")
            return []

        # Limit to max_images
        if len(image_urls) > max_images:
            print(f"      Vision: found {len(image_urls)} unique images, limiting to {max_images}")
            image_urls = image_urls[:max_images]

        print(f"      Vision [4/4] Downloading {len(image_urls)} unique floor plan image(s)...")

        images = []
        async with httpx.AsyncClient(timeout=30) as client:
            for i, img_url in enumerate(image_urls):
                try:
                    resp = await _safe_get(client, img_url)
                    if resp is None:
                        print(f"      Vision image {i + 1} skipped (non-public URL)")
                        continue
                    resp.raise_for_status()
                    images.append(resp.content)
                    print(f"      Vision image {i + 1}/{len(image_urls)} downloaded ({len(resp.content):,} bytes)")
                except Exception as e:
                    print(f"      Vision image {i + 1} download failed: {e}")

        print(f"      Vision: collected {len(images)} image(s)")
        return images

    async def _vision_click_popup(self, page, config: dict, max_images: int) -> list[bytes]:
        """Click each tile to open a popup, collect the first image URL, close popup, download all."""
        import httpx

        tile_selector = config["tile_selector"]
        popup_img_selector = config.get("popup_image_selector", "img")
        close_selector = config.get("close_selector", "escape")
        wait_ms = config.get("wait_ms", 2000)

        tiles = await page.query_selector_all(tile_selector)
        n = min(len(tiles), max_images)
        print(f"      Vision [4/4] Clicking {n} tile(s) to collect popup images...")

        image_urls = []
        seen = set()

        for i in range(n):
            # Re-query each iteration in case DOM mutates
            tiles = await page.query_selector_all(tile_selector)
            if i >= len(tiles):
                break
            tile = tiles[i]

            try:
                await tile.scroll_into_view_if_needed()
                await asyncio.sleep(0.3)
                await tile.evaluate("el => el.click()")
                await asyncio.sleep(wait_ms / 1000)

                # Collect first image URL from popup
                src = await page.evaluate(
                    """(sel) => { const img = document.querySelector(sel); return img ? img.src : ''; }""",
                    popup_img_selector,
                )

                if src and src.startswith("http") and src not in seen:
                    seen.add(src)
                    image_urls.append(src)
                    print(f"      Vision tile {i + 1}/{n}: {src[:100]}")
                else:
                    print(f"      Vision tile {i + 1}/{n}: no image found (src={src[:80] if src else 'empty'})")

                # Close popup
                if close_selector == "escape":
                    await page.keyboard.press("Escape")
                else:
                    close_btn = await page.query_selector(close_selector)
                    if close_btn:
                        await close_btn.evaluate("el => el.click()")
                await asyncio.sleep(0.5)

            except Exception as e:
                print(f"      Vision tile {i + 1} failed: {e}")
                try:
                    await page.keyboard.press("Escape")
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

        if not image_urls:
            print(f"      Vision: no popup image URLs collected")
            return []

        print(f"      Vision: downloading {len(image_urls)} popup image(s)...")
        images = []
        async with httpx.AsyncClient(timeout=30) as client:
            for i, img_url in enumerate(image_urls):
                try:
                    resp = await _safe_get(client, img_url)
                    if resp is None:
                        print(f"      Vision image {i + 1} skipped (non-public URL)")
                        continue
                    resp.raise_for_status()
                    images.append(resp.content)
                    print(f"      Vision image {i + 1}/{len(image_urls)} downloaded ({len(resp.content):,} bytes)")
                except Exception as e:
                    print(f"      Vision image {i + 1} download failed: {e}")

        print(f"      Vision: collected {len(images)} image(s)")
        return images

    async def _vision_click(self, page, config: dict, max_images: int) -> list[bytes]:
        """Click unit cards and screenshot the detail panel."""
        tile_selector = config["tile_selector"]
        detail_selector = config.get("detail_selector")
        close_selector = config.get("close_selector", "escape")
        detail_wait = config.get("detail_wait_ms", 3000)
        back_selector = config.get("back_selector")

        tiles = await page.query_selector_all(tile_selector)
        print(f"      Vision [4/4] Clicking {min(len(tiles), max_images)} tile(s)...")

        screenshots = []
        for i in range(min(len(tiles), max_images)):
            # Re-query tiles each iteration (DOM may change after navigation)
            tiles = await page.query_selector_all(tile_selector)
            if i >= len(tiles):
                break
            tile = tiles[i]

            try:
                await tile.scroll_into_view_if_needed()
                await asyncio.sleep(0.3)
                await tile.evaluate("el => el.click()")
                await asyncio.sleep(detail_wait / 1000)

                # Screenshot detail area or full page
                if detail_selector:
                    detail_el = await page.query_selector(detail_selector)
                    if detail_el:
                        img_bytes = await detail_el.screenshot(type="png")
                    else:
                        img_bytes = await page.screenshot(type="png", full_page=False)
                else:
                    img_bytes = await page.screenshot(type="png", full_page=False)

                screenshots.append(img_bytes)
                print(f"      Vision screenshot {i + 1} captured")

                # Navigate back
                if back_selector:
                    back_btn = await page.query_selector(back_selector)
                    if back_btn:
                        await back_btn.click()
                        await asyncio.sleep(2)
                        continue
                if close_selector == "escape":
                    await page.keyboard.press("Escape")
                elif close_selector == "back":
                    await page.go_back()
                    await asyncio.sleep(2)
                else:
                    close_btn = await page.query_selector(close_selector)
                    if close_btn:
                        await close_btn.click()
                await asyncio.sleep(1)

            except Exception as e:
                print(f"      Vision screenshot {i + 1} failed: {e}")
                try:
                    await page.keyboard.press("Escape")
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

        print(f"      Vision: captured {len(screenshots)} screenshot(s)")
        return screenshots

    # ------------------------------------------------------------------
    # Tricon API strategy
    # ------------------------------------------------------------------
    # Tricon (and any Yardi-backed property feeding triconliving.com) exposes a
    # public JSON API that's the SAME source the marketing site renders from.
    # Hitting it directly is faster, deterministic, and yields the true
    # 12-month-equivalent rent (`min_rent`) instead of the inflated
    # shortest-term rate (`max_rent`) we used to extract from HTML.
    #
    # We still load the marketing HTML page to:
    #   1. Capture the public-facing UnitID set as a structural guard
    #      (drop API units not currently shown on the marketing site).
    #   2. Take a screenshot so the existing Haiku visual QA still runs.
    # No Claude HTML extraction.

    _TRICON_API_BASE = "https://triconliving.com/api/v1/apartments/"

    # Status values that appear on the public marketing site. If a new status
    # appears, log + exclude unless explicitly added here.
    _TRICON_PUBLIC_STATUSES = {
        "Vacant Unrented Ready",
        "Vacant Unrented Not Ready",
        "Notice Unrented",
    }

    @staticmethod
    def _tricon_beds_to_unit_type(beds, unit_type_code: Optional[str] = None) -> Optional[str]:
        """Map API beds + plan code to our unit_type taxonomy.

        Tricon's API doesn't expose +den separately on the unit; we'd need to
        infer from floorplan title. For now we only handle integer bed counts.
        """
        try:
            n = int(beds)
        except (TypeError, ValueError):
            return None
        mapping = {0: "bachelor", 1: "1-bed", 2: "2-bed", 3: "3-bed", 4: "4-bed"}
        return mapping.get(n)

    @staticmethod
    def _tricon_derive_slug(scrape_url: str, config: dict) -> Optional[str]:
        """Derive the API slug from config or scrape_url.

        Explicit `tricon_api_slug` in config takes precedence. Otherwise pull
        from a triconresidential.com /apartment/<slug>/ URL.
        """
        slug = config.get("tricon_api_slug")
        if slug:
            return slug
        m = re.search(r"triconresidential\.com/apartment/([^/?#]+)", scrape_url)
        if m:
            return m.group(1)
        return None

    def _tricon_fetch_api(self, slug: str, timeout: int = 15) -> Optional[dict]:
        """Synchronous HTTP GET against the Tricon JSON API. Never raises."""
        url = f"{self._TRICON_API_BASE}{quote(slug, safe='')}"
        req = urllib.request.Request(url, headers={
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError) as e:
            print(f"      [tricon_api] API GET failed for slug='{slug}': {e}", file=sys.stderr)
            return None

    @staticmethod
    def _tricon_validate_payload(payload: dict) -> tuple[bool, str]:
        """Sanity-check the API response shape. Returns (ok, reason)."""
        if not isinstance(payload, dict):
            return False, f"payload not dict ({type(payload).__name__})"
        units = payload.get("units")
        if not isinstance(units, list):
            return False, "missing or non-list 'units' key"
        if units:
            sample = units[0]
            required = {"unit_code", "min_rent", "max_rent", "beds", "sqft", "status"}
            missing = required - set(sample.keys())
            if missing:
                return False, f"unit schema missing keys: {sorted(missing)}"
        return True, "ok"

    async def _fetch_tricon_api(self, url: str, config: dict) -> str:
        """Fetch units from Tricon's public API + load HTML for screenshot/UnitID guard.

        Stores structured units on `self._last_api_units` and incentives on
        `self._last_api_incentives`. Returns the API JSON as a string (saved
        as snapshot raw_content for debugging / re-extraction).

        On any failure, raises so the caller can mark snapshot as 'error' —
        no silent fallback to inflated max_rent values.
        """
        # 1. Determine slug
        slug = self._tricon_derive_slug(url, config)
        if not slug:
            raise RuntimeError(f"tricon_api: cannot derive slug from URL '{url}' or config.tricon_api_slug")

        # 2. Hit API (1 retry on failure)
        payload = self._tricon_fetch_api(slug)
        if payload is None:
            print("      [tricon_api] retrying API once after 5s...", file=sys.stderr)
            await asyncio.sleep(5)
            payload = self._tricon_fetch_api(slug)
        if payload is None:
            raise RuntimeError(f"tricon_api: API unreachable for slug='{slug}' after retry")

        ok, reason = self._tricon_validate_payload(payload)
        if not ok:
            raise RuntimeError(f"tricon_api: schema validation failed — {reason}")

        api_units = payload.get("units") or []
        api_concessions = payload.get("concessions") or []

        # 3. Status whitelist filter — flag unknown statuses
        kept_by_status: list[dict] = []
        unknown_statuses = set()
        for u in api_units:
            st = u.get("status") or ""
            if st in self._TRICON_PUBLIC_STATUSES:
                kept_by_status.append(u)
            else:
                unknown_statuses.add(st)
        if unknown_statuses:
            print(
                f"      [tricon_api] excluded units with unrecognized status: {sorted(unknown_statuses)}",
                file=sys.stderr,
            )

        # 4. Load HTML page for screenshot QA + UnitID guard
        public_unit_ids: Optional[set[str]] = None
        try:
            html = await self._fetch_playwright(url, config)
            # Regex out securecafe oleapplication UnitIDs from the rendered page
            ids = set(re.findall(r"UnitID=(\d+)", html))
            if ids:
                public_unit_ids = ids
                print(f"      [tricon_api] HTML guard: {len(ids)} UnitIDs in marketing page")
            else:
                print(
                    "      [tricon_api] HTML guard: no UnitIDs in marketing page — guard disabled (status filter only)",
                    file=sys.stderr,
                )
        except Exception as e:
            print(f"      [tricon_api] HTML page load failed ({e}) — guard disabled", file=sys.stderr)

        # 5. UnitID guard: keep only API units whose apply_url UnitID is publicly listed
        kept_final: list[dict] = []
        dropped_by_guard = 0
        for u in kept_by_status:
            if public_unit_ids is not None:
                apply_url = u.get("apply_url") or ""
                m = re.search(r"UnitID=(\d+)", apply_url)
                api_unit_id = m.group(1) if m else None
                if api_unit_id is None or api_unit_id not in public_unit_ids:
                    dropped_by_guard += 1
                    continue
            kept_final.append(u)
        if dropped_by_guard:
            print(f"      [tricon_api] dropped {dropped_by_guard} unit(s) not in HTML UnitID set")

        # 6. Convert API units → our schema
        normalized: list[dict] = []
        for u in kept_final:
            unit_type = self._tricon_beds_to_unit_type(u.get("beds"), u.get("unit_type_code"))
            if not unit_type:
                continue
            min_rent = u.get("min_rent")
            max_rent = u.get("max_rent")
            sqft = u.get("sqft")
            try:
                rent = float(min_rent) if min_rent is not None else None
            except (TypeError, ValueError):
                rent = None
            try:
                sqft_i = int(sqft) if sqft is not None else None
            except (TypeError, ValueError):
                sqft_i = None
            psf = round(rent / sqft_i, 4) if (rent and sqft_i and sqft_i > 0) else None

            avail = u.get("availability") or {}
            avail_str = avail.get("display") or ""
            avail_date = avail.get("date") or ""

            raw_text = (
                f"#{u.get('unit_code')} ${min_rent}-${max_rent}/mo "
                f"{u.get('unit_type_code', '')} {u.get('beds')} bed {u.get('baths')} bath "
                f"{sqft} sqft Floor {u.get('floor')} {avail_str} {avail_date}".strip()
            )
            notes = (
                f"Unit {u.get('unit_code')}, Floor {u.get('floor')}, Plan {u.get('unit_type_code')}, "
                f"Status: {u.get('status')}, API min/max: ${min_rent}/${max_rent}"
            )

            normalized.append({
                "unit_type": unit_type,
                "bathrooms": str(u.get("baths") or "").rstrip("0").rstrip(".") or None,
                "square_footage": sqft_i,
                "rent_price": rent,
                "rent_psf": psf,
                "raw_text": raw_text,
                "notes": notes,
            })

        # 7. Concessions: prefer the headline of the first active concession
        incentive_text = None
        if api_concessions:
            headlines = [c.get("headline") for c in api_concessions if c.get("headline")]
            if headlines:
                incentive_text = " | ".join(headlines)

        self._last_api_units = normalized
        self._last_api_incentives = incentive_text
        self._last_fetch_meta = {
            "tricon_api_slug": slug,
            "api_units_total": len(api_units),
            "kept_by_status": len(kept_by_status),
            "dropped_by_guard": dropped_by_guard,
            "kept_final": len(normalized),
            "html_guard_active": public_unit_ids is not None,
        }

        print(
            f"      [tricon_api] API={len(api_units)} status_filter={len(kept_by_status)} "
            f"guard_dropped={dropped_by_guard} -> final={len(normalized)} units"
        )

        # Return the raw API JSON as snapshot content (for debugging / re-extraction)
        return json.dumps(payload, default=str)

    async def _fetch_static(self, url: str) -> str:
        """Simple HTTP fetch without browser rendering."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await _safe_get(
                client, url,
                headers={"User-Agent": random.choice(USER_AGENTS)},
                timeout=30,
            )
            if response is None:
                raise ValueError(f"refusing to fetch non-public URL: {url}")
            response.raise_for_status()
            return response.text

    async def _dismiss_popups(self, page: Page) -> None:
        """Try to dismiss common popups (cookie consent, newsletter, etc.)."""
        popup_selectors = [
            # Cookie consent buttons
            "button:has-text('Accept')",
            "button:has-text('Accept All')",
            "button:has-text('I Accept')",
            "button:has-text('Got it')",
            "button:has-text('OK')",
            "button:has-text('Agree')",
            "[id*='cookie'] button",
            "[class*='cookie'] button",
            "[id*='consent'] button",
            # Generic close/dismiss
            "[class*='popup'] button[class*='close']",
            "[class*='modal'] button[class*='close']",
            "[class*='overlay'] button[class*='close']",
            "button[aria-label='Close']",
            "button[aria-label='close']",
            # Dialog modals (CTA popups that appear on scroll)
            "dialog[open] button[class*='close']",
            "dialog[open] button[aria-label='Close']",
        ]
        # Force-close open <dialog> elements and uk3 modals via JS
        try:
            await page.evaluate("""
                document.querySelectorAll('dialog[open]').forEach(d => d.close());
                document.querySelectorAll('.uk3-modal.uk3-open').forEach(m => {
                    m.classList.remove('uk3-open');
                    m.style.display = 'none';
                });
                document.querySelectorAll('.modal-default-open').forEach(el => {
                    el.classList.remove('modal-default-open');
                });
            """)
        except Exception:
            pass
        dismissed = False
        for selector in popup_selectors:
            try:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    print(f"      Dismissed popup: {selector}")
                    dismissed = True
                    await asyncio.sleep(0.5)
            except Exception:
                pass
        if not dismissed:
            print(f"      No popups found")

    async def _capture_promo_context(self, page: Page, max_chars: int = 2000) -> str:
        """Capture promotional/incentive text from the page before popups are dismissed.

        Grabs the first ~max_chars of body.innerText (where banners, hero sections,
        and popup overlays typically appear) plus any visible modal/dialog/overlay text.
        This is called BEFORE _dismiss_popups so popup content is still in the DOM.

        Returns a string to prepend to raw_content, or empty string if nothing found.
        """
        try:
            promo_text = await page.evaluate("""(maxChars) => {
                const parts = [];

                // 1. Grab text from any visible popups/modals/overlays/dialogs
                const popupSelectors = [
                    'dialog[open]',
                    '[class*="popup"]:not([style*="display: none"])',
                    '[class*="modal"]:not([style*="display: none"])',
                    '[class*="overlay"]:not([style*="display: none"])',
                    '[class*="banner"]:not(nav):not(footer)',
                    '[class*="promo"]',
                    '[class*="incentive"]',
                    '[class*="offer"]:not(nav):not(footer)',
                    '[class*="announcement"]',
                    '[class*="hero"]',
                ];
                const seen = new Set();
                for (const sel of popupSelectors) {
                    try {
                        document.querySelectorAll(sel).forEach(el => {
                            const text = el.innerText?.trim();
                            if (text && text.length > 10 && text.length < 2000 && !seen.has(text)) {
                                seen.add(text);
                                parts.push(text);
                            }
                        });
                    } catch(e) {}
                }

                // 2. Grab first portion of body text (banners/hero at top)
                const bodyText = document.body.innerText?.substring(0, maxChars) || '';
                if (bodyText && !seen.has(bodyText)) {
                    parts.push(bodyText);
                }

                return parts.join('\\n---\\n').substring(0, maxChars);
            }""", max_chars)

            if promo_text and promo_text.strip():
                return promo_text.strip()
        except Exception as e:
            print(f"      Promo context capture failed: {e}")

        return ""

    @staticmethod
    def _prepend_promo(promo_context: str, content: str) -> str:
        """Prepend promotional context to raw content if available."""
        if not promo_context:
            return content
        return (
            "[PROMOTIONAL CONTEXT]\n"
            + promo_context
            + "\n[END PROMOTIONAL CONTEXT]\n\n"
            + content
        )

    @staticmethod
    def _has_promo_keywords(text: str) -> bool:
        """Check if text contains incentive/promotion-related keywords."""
        if not text:
            return False
        import re
        # Normalize whitespace: collapse newlines/tabs/multi-spaces to single space
        # so "2 MONTHS\n\nFREE" matches keyword "months free"
        lower = re.sub(r'\s+', ' ', text.lower())
        keywords = [
            "month free", "months free", "free rent", "rent free",
            "move-in bonus", "move in bonus", "moving bonus",
            "gift card", "reduced deposit", "no lmr",
            "no last month", "free on select",
            "special incentive", "exclusive offer",
            "limited time",
            "mois gratuit",  # French: months free
            "loyer gratuit",  # French: free rent
            "loyer offert",  # French: rent offered/free
            "offre exclusive",  # French: exclusive offer
            "offre spéciale",  # French: special offer
            "temps limité",  # French: limited time
        ]
        return any(kw in lower for kw in keywords)

    @staticmethod
    def _get_root_url(url: str) -> str:
        """Extract root domain URL from a full URL."""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/"

    @staticmethod
    def _is_subpage(url: str) -> bool:
        """Check if URL points to a subpage (not the homepage)."""
        from urllib.parse import urlparse
        path = urlparse(url).path.rstrip("/")
        return bool(path)

    async def _check_homepage_popup(self, playwright_instance, scrape_url: str) -> str:
        """Open the homepage in a FRESH browser context and capture any popup/promo text.

        Uses a separate context (not the scrape context) so that site cookies
        from the scrape URL don't suppress cookie-based popups on the homepage.

        Called as a fallback when no promotional popup was found on the scrape URL.
        Many sites only show incentive popups on the homepage.

        Returns captured promo text, or empty string if nothing found.
        """
        root_url = self._get_root_url(scrape_url)
        try:
            print(f"      Checking homepage for popups: {root_url}")
            # Fresh context — no shared cookies from the scrape page
            browser, fresh_context = await self._create_context(playwright_instance, headless=False)
            try:
                page = await fresh_context.new_page()
                await page.goto(root_url, wait_until="domcontentloaded", timeout=20_000)
                await asyncio.sleep(6)  # Wait for popups to appear (non-headless widgets need more time)

                # Capture any popup/modal/overlay text
                promo = await self._capture_promo_context(page, max_chars=1500)

                # Only return if it contains actual incentive keywords
                if promo and self._has_promo_keywords(promo):
                    return promo
                else:
                    print(f"      No promotional popup on homepage")
                    return ""
            finally:
                await browser.close()
        except Exception as e:
            print(f"      Homepage popup check failed: {e}")
            return ""

    async def _auto_click_load_more(self, page: Page, max_clicks: int = 20) -> int:
        """Auto-detect and click 'Load More' / 'Show More' buttons until exhausted.

        Uses text-based selectors to find common load-more patterns.
        Returns the total number of clicks performed (0 if nothing found).
        """
        load_more_selectors = [
            "button:has-text('Load More')",
            "a:has-text('Load More')",
            "button:has-text('Show More')",
            "a:has-text('Show More')",
            "button:has-text('View More')",
            "a:has-text('View More')",
            "[class*='load-more']",
            "[class*='loadmore']",
            "[class*='show-more']",
        ]

        total_clicks = 0

        for selector in load_more_selectors:
            click_count = 0
            while click_count < max_clicks:
                try:
                    el = await page.query_selector(selector)
                    if not el:
                        break
                    # Scroll into view first — off-screen buttons fail is_visible()
                    try:
                        await el.scroll_into_view_if_needed()
                        await asyncio.sleep(0.3)
                    except Exception:
                        pass
                    if not await el.is_visible():
                        break
                    await el.evaluate("el => el.click()")
                    click_count += 1
                    total_clicks += 1
                    await asyncio.sleep(2)
                except Exception:
                    break
            # If we clicked with this selector, stop trying others
            if click_count > 0:
                if click_count >= max_clicks:
                    print(f"      [!] WARNING: Hit auto Load More limit ({max_clicks}). Increase max_auto_clicks in scrape_config if needed.")
                break

        return total_clicks

    async def _follow_dynamic_subpages(self, page: Page, config: dict, main_url: str) -> str:
        """Follow <a> links discovered via config['dynamic_additional_urls_selector'].

        Clicks each link in turn via the actual user-interaction click (not goto), which
        bypasses Cloudflare's managed challenge more reliably than programmatic navigation.
        After each subpage captures, navigates back to re-expose the next link.

        Returns the concatenated subpage content (with SUBPAGE markers), or empty string.
        """
        dyn_sel = config.get("dynamic_additional_urls_selector")
        if not dyn_sel:
            return ""
        wait_ms = config.get("dynamic_subpage_wait_ms", 5000)
        cloudflare_markers = (
            "Performing security verification",
            "Just a moment",
            "Checking your browser",
            "security check to access",
            "Performance and Security by Cloudflare",
        )

        try:
            link_count = await page.evaluate(
                "(sel) => document.querySelectorAll(sel).length", dyn_sel
            )
        except Exception as e:
            print(f"      dynamic_additional_urls_selector query failed: {e}")
            return ""

        if not link_count:
            return ""
        print(f"      Following {link_count} dynamic subpage(s)...")
        sub_pieces = []
        for i in range(link_count):
            try:
                link_info = await page.evaluate(
                    """([sel, idx]) => {
                        const els = document.querySelectorAll(sel);
                        if (idx >= els.length) return null;
                        const el = els[idx];
                        el.scrollIntoView({block: 'center'});
                        return {href: el.href || '', idx: idx};
                    }""",
                    [dyn_sel, i],
                )
                if not link_info:
                    continue
                href = link_info.get("href", "")
                if href and not is_public_http_url(href):   # SSRF: skip internal/non-public links
                    print(f"      Skipping dynamic subpage (non-public URL): {href}")
                    continue
                async with page.expect_navigation(
                    wait_until="domcontentloaded", timeout=45000
                ):
                    await page.evaluate(
                        """([sel, idx]) => {
                            const els = document.querySelectorAll(sel);
                            els[idx].click();
                        }""",
                        [dyn_sel, i],
                    )
                # Poll for Cloudflare / bot challenge to clear. Require both
                # a meaningful body length AND absence of challenge markers.
                for _ in range(30):
                    await asyncio.sleep(1.5)
                    body_preview = await page.evaluate(
                        "() => (document.body.innerText || '')"
                    )
                    if len(body_preview) > 800 and not any(
                        m in body_preview for m in cloudflare_markers
                    ):
                        break
                await asyncio.sleep(wait_ms / 1000)
                sub_text = await page.evaluate(
                    """() => {
                        document.body.querySelectorAll(
                            'script, style, svg, link, noscript, iframe, nav, footer, header, img, form'
                        ).forEach(el => { el.style.display = 'none'; });
                        return document.body.innerText;
                    }"""
                )
                sub_pieces.append(f"\n<!-- SUBPAGE: {href} -->\n{sub_text}")
                if i + 1 < link_count:
                    try:
                        await page.go_back(wait_until="domcontentloaded", timeout=45000)
                        await asyncio.sleep(3)
                    except Exception:
                        # Fall back to re-navigating to main URL
                        await page.goto(main_url, wait_until="domcontentloaded", timeout=45000)
                        await asyncio.sleep(5)
            except Exception as e:
                print(f"        Subpage #{i} fetch failed: {e}")
        return "".join(sub_pieces)

    async def _capture_page_content(self, page: Page, config: dict) -> str:
        """Capture a single page's content using the configured method."""
        content_selector = config.get("content_selector")
        shadow_host_selector = config.get("shadow_host_selector")
        iframe_selector = config.get("iframe_selector")

        if iframe_selector:
            frame_el = await page.query_selector(iframe_selector)
            if frame_el:
                frame = await frame_el.content_frame()
                if frame:
                    await frame.wait_for_load_state("networkidle", timeout=15000)
                    return await frame.evaluate("""() => {
                        document.body.querySelectorAll(
                            'script, style, svg, link, noscript'
                        ).forEach(el => { el.style.display = 'none'; });
                        return document.body.innerText;
                    }""")
            return ""

        if shadow_host_selector:
            host = await page.query_selector(shadow_host_selector)
            if host:
                return await host.evaluate("""el => {
                    if (!el.shadowRoot) return el.innerText;
                    const sr = el.shadowRoot;
                    let text = '';
                    for (const child of sr.children) {
                        const tag = child.tagName?.toLowerCase();
                        if (tag === 'style' || tag === 'script' || tag === 'svg') continue;
                        text += child.innerText + '\\n';
                    }
                    return text;
                }""")
            return ""
        elif content_selector:
            el = await page.query_selector(content_selector)
            return await el.inner_text() if el else ""
        else:
            # Use live DOM (not a detached clone) so innerText respects
            # CSS visibility — hidden elements like leased-out plans are excluded.
            # Temporarily hide non-content elements, capture text, then restore.
            return await page.evaluate("""() => {
                const hidden = [];
                document.body.querySelectorAll(
                    'script, style, svg, link, noscript, iframe, nav, footer, header, img'
                ).forEach(el => {
                    hidden.push({ el, prev: el.style.display });
                    el.style.display = 'none';
                });
                const text = document.body.innerText;
                hidden.forEach(({ el, prev }) => { el.style.display = prev; });
                return text;
            }""")

    async def _capture_with_next_button(self, page: Page, config: dict) -> list:
        """Run next-button pagination and return list of page content strings."""
        next_button_selector = config.get("next_button_selector")
        max_pages = config.get("max_pages", 50)
        all_pages = []
        seen_hashes = set()

        for page_num in range(1, max_pages + 1):
            content = await self._capture_page_content(page, config)

            # Cycle detection
            content_hash = hash(content)
            if content_hash in seen_hashes:
                print(f"      Page {page_num} is a repeat, done (cycled back)")
                break
            seen_hashes.add(content_hash)

            all_pages.append(content)
            print(f"      Captured page {page_num}")

            # Dismiss any popups before clicking next
            try:
                await page.evaluate("""
                    document.querySelectorAll('dialog[open]').forEach(d => d.close());
                    document.querySelectorAll('.uk3-modal.uk3-open').forEach(m => {
                        m.classList.remove('uk3-open');
                        m.style.display = 'none';
                    });
                    document.querySelectorAll('.modal-default-open').forEach(el => {
                        el.classList.remove('modal-default-open');
                    });
                """)
            except Exception:
                pass

            # Try to click the next button
            try:
                next_btn = await page.query_selector(next_button_selector)
                if not next_btn:
                    print(f"      Next button not found, done")
                    break
                is_disabled = await next_btn.get_attribute("disabled")
                is_hidden = not await next_btn.is_visible()
                aria_disabled = await next_btn.get_attribute("aria-disabled")
                if is_disabled is not None or is_hidden or aria_disabled == "true":
                    print(f"      Next button disabled/hidden, done")
                    break

                # Use JS click to bypass any overlay/modal interception
                await next_btn.scroll_into_view_if_needed()
                await asyncio.sleep(0.3)
                await next_btn.evaluate("el => el.click()")
                wait_ms = config.get("next_button_wait_ms", 2000)
                await asyncio.sleep(wait_ms / 1000)
            except Exception as e:
                print(f"      Next button click failed: {e}")
                break

        if len(all_pages) >= max_pages:
            print(f"      [!] WARNING: Hit max_pages limit ({max_pages}). Some pages may be missing. Increase max_pages in scrape_config if needed.")

        return all_pages

    async def _capture_with_pagination(self, page: Page, config: dict) -> list:
        """Run numbered-pagination and return list of page content strings."""
        content_selector = config.get("content_selector")
        pagination_selector = config.get("pagination_selector")
        all_pages = []

        # Helper to capture current page content (HTML for pagination)
        async def _capture_page():
            if content_selector:
                el = await page.query_selector(content_selector)
                return await el.inner_html() if el else ""
            else:
                return await page.evaluate("""() => {
                    const clone = document.body.cloneNode(true);
                    clone.querySelectorAll(
                        'script, style, svg, link, noscript, iframe'
                    ).forEach(el => el.remove());
                    return clone.innerHTML;
                }""")

        # Capture current page first
        page_content = await _capture_page()
        if page_content:
            all_pages.append(page_content)
            print(f"      Captured page 1")

        # Find pagination buttons and click each
        buttons = await page.query_selector_all(pagination_selector)
        if buttons:
            print(f"      Found {len(buttons)} pagination button(s)")
            for i, btn in enumerate(buttons, start=2):
                try:
                    await self._dismiss_popups(page)
                    await btn.click()
                    await asyncio.sleep(random.uniform(1.5, 2.5))
                    page_content = await _capture_page()
                    if page_content:
                        all_pages.append(page_content)
                        print(f"      Captured page {i}")
                except Exception as e:
                    print(f"      Pagination click {i} failed: {e}")
        else:
            print(f"      No pagination found (all results on one page)")

        return all_pages

    async def _fetch_playwright(self, url: str, config: dict) -> str:
        """Full Playwright render with configurable wait/scroll/click behavior."""
        max_retries = 2
        retry_delay = 10

        for attempt in range(max_retries + 1):
            async with async_playwright() as p:
                browser, context = await self._create_context(p)

                try:
                    page = await context.new_page()

                    # Step 1: Navigate. A navigation timeout/error is the most common
                    # transient failure, so retry it like an HTTP 5xx (the bare retry
                    # loop previously only retried on status codes, never on exceptions,
                    # so a goto timeout aborted the whole scrape). CancelledError is a
                    # BaseException, not Exception, so cooperative cancel still propagates.
                    print(f"      [1/6] Opening browser & navigating...")
                    try:
                        response = await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                    except Exception as e:
                        if attempt < max_retries:
                            print(f"      [!] Navigation error ({e}) — retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})...")
                            await asyncio.sleep(retry_delay)
                            continue   # exits inner try -> finally closes browser -> fresh attempt
                        raise

                    # Check for HTTP errors that warrant a retry
                    if response and response.status in (403, 429, 500, 502, 503):
                        if attempt < max_retries:
                            print(f"      [!] HTTP {response.status} — retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})...")
                            await browser.close()
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            print(f"      [!] HTTP {response.status} after {max_retries} retries, proceeding anyway")

                    print(f"      [1/6] Page loaded")

                    # Step 2: Initial wait
                    initial_wait = config.get("initial_wait_ms", 3000)
                    print(f"      [2/6] Waiting {initial_wait/1000:.0f}s for page to settle...")
                    await asyncio.sleep(initial_wait / 1000)

                    # Step 2.5: Capture promo context BEFORE dismissing popups
                    # This grabs banner/hero/popup text that may contain incentives
                    has_content_selector = bool(config.get("content_selector"))
                    page_promo = await self._capture_promo_context(page)
                    if page_promo:
                        print(f"      Captured promo context ({len(page_promo):,} chars)")

                    # Step 3: Dismiss popups
                    print(f"      [3/8] Checking for popups...")
                    await self._dismiss_popups(page)

                    # Determine promo to prepend:
                    # - With content_selector: always prepend (main capture excludes banners)
                    # - With promo keywords: always prepend (multi-page paths like
                    #   section_clicks lose body text; slight duplication is harmless)
                    # - Otherwise: body text already has everything, skip
                    promo_context = page_promo if (has_content_selector or self._has_promo_keywords(page_promo)) else ""

                    # Homepage fallback: check homepage for promos not on scrape page
                    if self._is_subpage(url):
                        # Quick scan of broader body text (promo_context only has first 2k chars)
                        try:
                            body_snippet = await page.evaluate(
                                "document.body.innerText?.substring(0, 5000) || ''"
                            )
                        except Exception:
                            body_snippet = ""

                        if not self._has_promo_keywords(body_snippet):
                            homepage_promo = await self._check_homepage_popup(p, url)
                            if homepage_promo:
                                print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                                if promo_context:
                                    promo_context += "\n---\n" + homepage_promo
                                else:
                                    promo_context = homepage_promo
                        elif not promo_context or (has_content_selector and not self._has_promo_keywords(promo_context)):
                            # Body has promo keywords but promo_context is empty or
                            # contains non-promo content (e.g. floorplan modals from content_selector) —
                            # the promo may be in a footer/nav stripped by _capture_page_content
                            promo_context = body_snippet
                    elif not self._has_promo_keywords(page_promo):
                        # Homepage URL with no promo keywords — popup may be
                        # headless-invisible; try non-headless re-check
                        homepage_promo = await self._check_homepage_popup(p, url)
                        if homepage_promo:
                            print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                            promo_context = homepage_promo

                    # Step 4: Setup clicks (navigate to correct section before scraping)
                    setup_clicks = config.get("setup_clicks", [])
                    if setup_clicks:
                        print(f"      [4/8] Running {len(setup_clicks)} setup click(s)...")
                        for i, selector in enumerate(setup_clicks):
                            try:
                                # Dismiss any popups that appeared since last action
                                await self._dismiss_popups(page)
                                # Wait for element to appear before clicking
                                await page.wait_for_selector(selector, state="visible", timeout=15_000)
                                try:
                                    await page.click(selector, timeout=10_000)
                                except Exception:
                                    # Fallback: JS click to bypass overlay/interception
                                    el = await page.query_selector(selector)
                                    if el:
                                        await el.scroll_into_view_if_needed()
                                        await asyncio.sleep(0.5)
                                        await el.evaluate("el => el.click()")
                                        print(f"      Clicked (JS fallback): {selector}")
                                    else:
                                        raise Exception(f"Element not found: {selector}")
                                else:
                                    print(f"      Clicked: {selector}")
                                await asyncio.sleep(random.uniform(2, 4))
                            except Exception as e:
                                print(f"      Could not click '{selector}': {e}")
                    else:
                        print(f"      [4/8] No setup clicks, skipping")

                    # Step 5: Scroll to load dynamic content (before waiting for selector)
                    if config.get("scroll", False):
                        scroll_count = config.get("scroll_count", 3)
                        print(f"      [5/8] Scrolling page ({scroll_count}x)...")
                        # First scroll to bottom to trigger lazy loading
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(2)
                        # Then do human-like scrolling back through the page
                        await self._human_scroll(page, scroll_count)
                        print(f"      [5/8] Scrolling done")
                    else:
                        print(f"      [5/8] Scrolling disabled, skipping")

                    # Step 6: Wait for content selector (after scroll, content may be below fold)
                    wait_selector = config.get("wait_selector")
                    if wait_selector:
                        print(f"      [6/8] Waiting for content selector...")
                        try:
                            await page.wait_for_selector(wait_selector, timeout=15_000)
                            print(f"      [6/8] Content found")
                        except Exception:
                            print(f"      [6/8] Selector not found, continuing anyway")
                    else:
                        print(f"      [6/8] No wait selector configured, skipping")

                    # Step 7: Click any specified selectors (e.g., "load more" buttons)
                    # When click_repeat is true, each selector is clicked in a loop
                    # until it disappears (useful for "Load More" buttons).
                    click_selectors = config.get("click_selectors", [])
                    click_repeat = config.get("click_repeat", False)
                    max_click_repeats = config.get("max_click_repeats", 30)
                    if click_selectors:
                        print(f"      [7/8] Clicking {len(click_selectors)} element(s){' (repeat mode)' if click_repeat else ''}...")
                        for selector in click_selectors:
                            click_count = 0
                            while True:
                                try:
                                    el = await page.query_selector(selector)
                                    if not el or not await el.is_visible():
                                        if click_count == 0:
                                            print(f"      Not found: '{selector}'")
                                        break
                                    await el.scroll_into_view_if_needed()
                                    await asyncio.sleep(0.5)
                                    await el.evaluate("el => el.click()")
                                    click_count += 1
                                    await asyncio.sleep(random.uniform(1.5, 2.5))
                                    print(f"      Clicked: {selector}{f' (x{click_count})' if click_count > 1 else ''}")
                                except Exception:
                                    print(f"      Could not click '{selector}'")
                                    break
                                if not click_repeat or click_count >= max_click_repeats:
                                    if click_repeat and click_count >= max_click_repeats:
                                        print(f"      [!] WARNING: Hit max_click_repeats limit ({max_click_repeats}). Some content may be missing. Increase max_click_repeats in scrape_config if needed.")
                                    break
                        if click_repeat:
                            # Wait for content to finish loading after all Load More clicks
                            await asyncio.sleep(2)
                    else:
                        print(f"      [7/8] No click selectors, skipping")

                    # Step 7.5: Run custom pre-capture JavaScript (optional)
                    # Useful for injecting hidden data (e.g., data attributes) as visible text
                    # before the content capture step picks it up.
                    pre_capture_js = config.get("pre_capture_js")
                    if pre_capture_js:
                        try:
                            await page.evaluate(pre_capture_js)
                            print(f"      Pre-capture JS executed")
                        except Exception as e:
                            print(f"      Pre-capture JS failed: {e}")

                    # Populate fetch meta for QA
                    self._last_fetch_meta = {
                        "strategy": config.get("strategy", "playwright_render"),
                    }

                    # Step 8: Capture content (with pagination if configured)
                    next_button_selector = config.get("next_button_selector")
                    pagination_selector = config.get("pagination_selector")
                    section_clicks = config.get("section_clicks", [])

                    if section_clicks:
                        # Multi-section mode: iterate through tab sections
                        print(f"      [8/8] Capturing {len(section_clicks)} section(s)...")
                        all_section_content = []

                        for section_idx, section_selector in enumerate(section_clicks):
                            section_label = f"Section {section_idx + 1}/{len(section_clicks)}"
                            print(f"      --- {section_label}: clicking '{section_selector}'")

                            try:
                                await self._dismiss_popups(page)
                                # Scroll to top so section tabs are visible
                                await page.evaluate("window.scrollTo(0, 0)")
                                await asyncio.sleep(0.5)
                                try:
                                    await page.wait_for_selector(section_selector, state="visible", timeout=10_000)
                                    await page.click(section_selector, timeout=10_000)
                                except Exception:
                                    # Fallback: JS click on hidden/off-screen element
                                    el = await page.query_selector(section_selector)
                                    if el:
                                        await el.scroll_into_view_if_needed()
                                        await asyncio.sleep(0.5)
                                        await el.evaluate("el => el.click()")
                                        print(f"      {section_label}: used JS click fallback")
                                    else:
                                        raise Exception(f"Element not found: {section_selector}")
                                section_wait = config.get("section_wait_ms", 3000)
                                await asyncio.sleep(section_wait / 1000)
                            except Exception as e:
                                print(f"      {section_label} click failed: {e}, skipping")
                                continue

                            # Run the appropriate pagination strategy for this section
                            if next_button_selector:
                                pages = await self._capture_with_next_button(page, config)
                            elif pagination_selector:
                                pages = await self._capture_with_pagination(page, config)
                            else:
                                content = await self._capture_page_content(page, config)
                                pages = [content] if content else []

                            print(f"      {section_label}: captured {len(pages)} page(s)")
                            all_section_content.extend(pages)

                            # Navigate back between sections if configured
                            section_back = config.get("section_back_selector")
                            if section_back and section_idx < len(section_clicks) - 1:
                                try:
                                    back_el = await page.query_selector(section_back)
                                    if back_el:
                                        await back_el.click()
                                        await asyncio.sleep(config.get("section_wait_ms", 3000) / 1000)
                                        print(f"      {section_label}: navigated back")
                                except Exception as e:
                                    print(f"      {section_label}: back navigation failed: {e}")

                        print(f"      [8/8] Total: {len(all_section_content)} page(s) across {len(section_clicks)} section(s)")
                        await self._capture_qa_assets(page, config)
                        content = "\n<!-- PAGE BREAK -->\n".join(all_section_content)
                        return self._prepend_promo(promo_context, content)

                    elif next_button_selector:
                        max_pages = config.get("max_pages", 50)
                        print(f"      [8/8] Capturing with next-button navigation (max {max_pages})...")
                        pages = await self._capture_with_next_button(page, config)
                        print(f"      [8/8] Captured {len(pages)} page(s) total")
                        await self._capture_qa_assets(page, config)
                        content = "\n<!-- PAGE BREAK -->\n".join(pages)
                        return self._prepend_promo(promo_context, content)

                    elif pagination_selector:
                        print(f"      [8/8] Capturing with pagination...")
                        pages = await self._capture_with_pagination(page, config)
                        if pages:
                            print(f"      [8/8] Captured {len(pages)} page(s) total")
                            await self._capture_qa_assets(page, config)
                            content = "\n<!-- PAGE BREAK -->\n".join(pages)
                            return self._prepend_promo(promo_context, content)
                        # No pages captured — fall through to the single-page capture
                        # below (intentional fallback, made explicit so it's not silent).
                        print(f"      [8/8] Pagination produced no pages — falling back to single-page capture")
                    else:
                        print(f"      [8/8] Capturing page content...")

                    # Capture screenshot before content extraction
                    await self._capture_qa_assets(page, config)

                    # Single page fallback
                    content = await self._capture_page_content(page, config)

                    # Optional: follow dynamically discovered subpage links in the
                    # SAME browser context (preserves Cloudflare / auth cookies).
                    # Config: dynamic_additional_urls_selector (CSS selector of <a>s),
                    #         dynamic_subpage_wait_ms (default 5000).
                    sub_text = await self._follow_dynamic_subpages(page, config, main_url=url)
                    if sub_text:
                        content = (content or "") + sub_text

                    if content:
                        return self._prepend_promo(promo_context, content)
                    return await page.content()

                finally:
                    await browser.close()

        # Should never reach here, but just in case
        return ""

    async def _fetch_akamai_stealth(self, url: str, config: dict) -> str:
        """Fetch from Akamai WAF-protected sites (e.g., apartments.com).

        Uses the system's real Chrome (not Playwright's Chromium) with a persistent
        user profile. This bypasses Akamai Bot Manager which detects headless
        Chromium and standard automation frameworks.

        Key differences from _fetch_playwright:
        - launch_persistent_context with channel="chrome" (system Chrome)
        - Non-headless forced (Akamai detects headless)
        - Persistent user data dir (cookies/trust persist across runs)
        - --disable-blink-features=AutomationControlled
        """
        import os
        import tempfile

        # Shared persistent profile: accumulates the Akamai trust cookie across runs
        # (that persistence is the whole point of this strategy). Tradeoff: sites
        # scraped via akamai_stealth share cookie state. Kept local & git-ignored
        # (.gitignore: **/.chrome_profiles/) so no session state is ever committed.
        profile_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            ".chrome_profiles",
            "akamai_stealth",
        )
        os.makedirs(profile_dir, exist_ok=True)

        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                profile_dir,
                channel="chrome",
                headless=False,  # Always non-headless — Akamai detects headless
                viewport=random.choice(VIEWPORTS),
                locale="en-CA",
                timezone_id="America/Toronto",
                args=["--disable-blink-features=AutomationControlled"],
            )

            try:
                # Mask automation signals
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    delete navigator.__proto__.webdriver;
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                    );
                """)

                page = context.pages[0] if context.pages else await context.new_page()

                print(f"      [1/5] Navigating (akamai_stealth, real Chrome)...")
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                if response:
                    print(f"      [1/5] Status: {response.status}")

                # Step 2: Wait for Akamai JS challenge to resolve
                initial_wait = config.get("initial_wait_ms", 10000)
                print(f"      [2/5] Waiting {initial_wait/1000:.0f}s for Akamai challenge...")
                await asyncio.sleep(initial_wait / 1000)

                # Step 2.5: Capture promo context before popup dismissal
                has_content_selector = bool(config.get("content_selector"))
                page_promo = await self._capture_promo_context(page)
                if page_promo:
                    print(f"      Captured promo context ({len(page_promo):,} chars)")

                # Step 3: Dismiss popups
                print(f"      [3/5] Checking for popups...")
                await self._dismiss_popups(page)

                # Optimization + homepage fallback (same logic as _fetch_playwright)
                promo_context = page_promo if (has_content_selector or self._has_promo_keywords(page_promo)) else ""
                if self._is_subpage(url):
                    try:
                        body_snippet = await page.evaluate(
                            "document.body.innerText?.substring(0, 5000) || ''"
                        )
                    except Exception:
                        body_snippet = ""
                    if not self._has_promo_keywords(body_snippet):
                        homepage_promo = await self._check_homepage_popup(p, url)
                        if homepage_promo:
                            print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                            if promo_context:
                                promo_context += "\n---\n" + homepage_promo
                            else:
                                promo_context = homepage_promo
                    elif not promo_context or (has_content_selector and not self._has_promo_keywords(promo_context)):
                        promo_context = body_snippet
                elif not self._has_promo_keywords(page_promo):
                    homepage_promo = await self._check_homepage_popup(p, url)
                    if homepage_promo:
                        print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                        promo_context = homepage_promo

                # Step 4: Scroll
                scroll_count = config.get("scroll_count", 5)
                if config.get("scroll", True):
                    print(f"      [4/5] Scrolling ({scroll_count}x)...")
                    await self._human_scroll(page, count=scroll_count)

                # Step 5: Capture content
                print(f"      [5/5] Capturing page content...")
                try:
                    self._last_screenshot = await page.screenshot(
                        type="jpeg", quality=60, full_page=False
                    )
                except Exception:
                    pass

                self._last_fetch_meta = {"strategy": "akamai_stealth"}

                content_selector = config.get("content_selector")
                if content_selector:
                    el = await page.query_selector(content_selector)
                    if el:
                        content = await el.inner_text()
                    else:
                        content = ""
                else:
                    content = await page.evaluate("document.body.innerText")

                sub_text = await self._follow_dynamic_subpages(page, config, main_url=url)
                if sub_text:
                    content = (content or "") + sub_text
                return self._prepend_promo(promo_context, content)

            finally:
                await context.close()

    async def _fetch_iframe(self, url: str, config: dict) -> str:
        """Navigate to a page and extract content from an iframe."""
        async with async_playwright() as p:
            browser, context = await self._create_context(p)

            try:
                page = await context.new_page()
                await page.goto(url, wait_until="networkidle", timeout=60_000)
                await asyncio.sleep(config.get("initial_wait_ms", 3000) / 1000)

                # Capture promo context from parent page (iframe content is separate)
                # iframe pages always have a content_selector (the iframe), so prepend
                page_promo = await self._capture_promo_context(page)
                promo_context = page_promo if page_promo else ""
                if promo_context:
                    print(f"      Captured promo context ({len(promo_context):,} chars)")

                # Homepage fallback if no promo found
                if self._is_subpage(url):
                    try:
                        body_snippet = await page.evaluate(
                            "document.body.innerText?.substring(0, 5000) || ''"
                        )
                    except Exception:
                        body_snippet = ""
                    if not self._has_promo_keywords(body_snippet):
                        homepage_promo = await self._check_homepage_popup(p, url)
                        if homepage_promo:
                            print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                            if promo_context:
                                promo_context += "\n---\n" + homepage_promo
                            else:
                                promo_context = homepage_promo
                elif not self._has_promo_keywords(promo_context):
                    homepage_promo = await self._check_homepage_popup(p, url)
                    if homepage_promo:
                        print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                        promo_context = homepage_promo

                iframe_selector = config.get("iframe_selector", "iframe")
                frame_element = await page.query_selector(iframe_selector)

                if frame_element:
                    frame = await frame_element.content_frame()
                    if frame:
                        content = await frame.content()
                        return self._prepend_promo(promo_context, content)

                # Fallback to main page
                return await page.content()

            finally:
                await browser.close()

    async def _fetch_with_filters(self, url: str, config: dict) -> str:
        """Click through filter options and combine all views."""
        async with async_playwright() as p:
            browser, context = await self._create_context(p)

            try:
                page = await context.new_page()
                await page.goto(url, wait_until="networkidle", timeout=60_000)
                await asyncio.sleep(config.get("initial_wait_ms", 3000) / 1000)

                # Capture promo context before any interaction
                has_content_selector = bool(config.get("content_selector"))
                page_promo = await self._capture_promo_context(page)
                if page_promo:
                    print(f"      Captured promo context ({len(page_promo):,} chars)")

                # Optimization + homepage fallback
                promo_context = page_promo if (has_content_selector or self._has_promo_keywords(page_promo)) else ""
                if self._is_subpage(url):
                    try:
                        body_snippet = await page.evaluate(
                            "document.body.innerText?.substring(0, 5000) || ''"
                        )
                    except Exception:
                        body_snippet = ""
                    if not self._has_promo_keywords(body_snippet):
                        homepage_promo = await self._check_homepage_popup(p, url)
                        if homepage_promo:
                            print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                            if promo_context:
                                promo_context += "\n---\n" + homepage_promo
                            else:
                                promo_context = homepage_promo
                    elif not promo_context or (has_content_selector and not self._has_promo_keywords(promo_context)):
                        promo_context = body_snippet
                elif not self._has_promo_keywords(page_promo):
                    homepage_promo = await self._check_homepage_popup(p, url)
                    if homepage_promo:
                        print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                        promo_context = homepage_promo

                filter_selectors = config.get("filter_selectors", [])
                content_selector = config.get("content_selector")
                all_content = []

                for selector in filter_selectors:
                    try:
                        await page.click(selector, timeout=5000)
                        await asyncio.sleep(random.uniform(1.5, 3))

                        if content_selector:
                            element = await page.query_selector(content_selector)
                            if element:
                                html = await element.inner_html()
                                all_content.append(html)
                        else:
                            all_content.append(await page.content())
                    except Exception as e:
                        print(f"  Warning: Filter click failed for '{selector}': {e}")

                content = "\n<!-- FILTER BREAK -->\n".join(all_content) if all_content else await page.content()
                return self._prepend_promo(promo_context, content)

            finally:
                await browser.close()

    async def _close_modal(self, page: Page, modal_selector: str, close_method: str) -> bool:
        """Try multiple methods to close an open modal. Returns True if closed."""
        # Method 1: configured close method
        try:
            if close_method == "escape":
                await page.keyboard.press("Escape")
            else:
                close_btn = await page.query_selector(close_method)
                if close_btn:
                    await close_btn.click()
            await asyncio.sleep(0.5)

            # Check if modal is actually gone
            still_open = await page.query_selector(modal_selector)
            if not still_open:
                return True
        except Exception:
            pass

        # Method 2: try Escape if we didn't already
        if close_method != "escape":
            try:
                await page.keyboard.press("Escape")
                await asyncio.sleep(0.5)
                if not await page.query_selector(modal_selector):
                    return True
            except Exception:
                pass

        # Method 3: click common close button selectors
        close_selectors = [
            f"{modal_selector} button[class*='close']",
            f"{modal_selector} button[aria-label='Close']",
            f"{modal_selector} .uk3-modal-close",
            f"{modal_selector} .close",
            "button.uk3-modal-close",
            "button[aria-label='Close']",
            ".uk3-close",
        ]
        for sel in close_selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    await asyncio.sleep(0.5)
                    if not await page.query_selector(modal_selector):
                        return True
            except Exception:
                pass

        # Method 4: force-close via JS
        try:
            await page.evaluate("""(selector) => {
                document.querySelectorAll(selector).forEach(m => {
                    m.classList.remove('uk3-open');
                    m.style.display = 'none';
                    m.remove();
                });
                // Also remove any overlay/backdrop
                document.querySelectorAll('.uk3-modal-backdrop, .uk3-overlay').forEach(el => el.remove());
                document.body.classList.remove('uk3-modal-active');
                document.body.style.overflow = '';
            }""", modal_selector)
            await asyncio.sleep(0.3)
            return True
        except Exception:
            return False

    async def _fetch_with_modals(self, url: str, config: dict) -> str:
        """Click each trigger button, capture modal content, close, repeat.

        Config keys:
            - pre_click_selectors: list of selectors to click before iterating (e.g., "Load More")
            - trigger_selector: CSS selector for buttons that open modals
            - modal_selector: CSS selector for the open modal (default: '.uk3-modal.uk3-open')
            - close_method: 'escape' (default) or a CSS selector for the close button
            - modal_wait_ms: ms to wait for modal to appear after click (default 2000)
            - max_triggers: max number of triggers to process (default 100)
        """
        max_retries = 2
        retry_delay = 10

        for attempt in range(max_retries + 1):
            async with async_playwright() as p:
                browser, context = await self._create_context(p)

                try:
                    page = await context.new_page()
                    print(f"      [1/6] Opening browser & navigating...")
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=60_000)

                    # Check for HTTP errors that warrant a retry
                    if response and response.status in (403, 429, 500, 502, 503):
                        if attempt < max_retries:
                            print(f"      [!] HTTP {response.status} — retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})...")
                            await browser.close()
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            print(f"      [!] HTTP {response.status} after {max_retries} retries, proceeding anyway")

                    initial_wait = config.get("initial_wait_ms", 5000)
                    print(f"      [2/6] Waiting {initial_wait/1000:.0f}s for page to settle...")
                    await asyncio.sleep(initial_wait / 1000)

                    # Capture promo context before popup dismissal
                    page_promo = await self._capture_promo_context(page)
                    if page_promo:
                        print(f"      Captured promo context ({len(page_promo):,} chars)")

                    print(f"      [3/6] Checking for popups...")
                    await self._dismiss_popups(page)

                    # Optimization + homepage fallback
                    # modal_iterate always captures full page_context, so only prepend
                    # if promo keywords found or homepage has a popup
                    has_content_selector = bool(config.get("content_selector"))
                    promo_context = ""
                    if self._has_promo_keywords(page_promo):
                        promo_context = page_promo
                    if self._is_subpage(url):
                        # Check homepage for promos not on scrape page
                        try:
                            body_snippet = await page.evaluate(
                                "document.body.innerText?.substring(0, 5000) || ''"
                            )
                        except Exception:
                            body_snippet = ""
                        if not self._has_promo_keywords(body_snippet):
                            homepage_promo = await self._check_homepage_popup(p, url)
                            if homepage_promo:
                                print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                                if promo_context:
                                    promo_context += "\n---\n" + homepage_promo
                                else:
                                    promo_context = homepage_promo
                        elif not promo_context or (has_content_selector and not self._has_promo_keywords(promo_context)):
                            promo_context = body_snippet
                    elif not self._has_promo_keywords(page_promo):
                        homepage_promo = await self._check_homepage_popup(p, url)
                        if homepage_promo:
                            print(f"      Homepage promo captured ({len(homepage_promo):,} chars)")
                            promo_context = homepage_promo

                    # Step 4: Explicit pre-clicks from config
                    pre_clicks = config.get("pre_click_selectors", [])
                    if pre_clicks:
                        print(f"      [4/6] Running configured pre-clicks...")
                        max_pre_clicks = config.get("max_pre_clicks", 20)
                        for selector in pre_clicks:
                            click_count = 0
                            while click_count < max_pre_clicks:
                                try:
                                    el = await page.query_selector(selector)
                                    if not el:
                                        break
                                    try:
                                        await el.scroll_into_view_if_needed()
                                        await asyncio.sleep(0.3)
                                    except Exception:
                                        pass
                                    if not await el.is_visible():
                                        break
                                    await el.evaluate("el => el.click()")
                                    click_count += 1
                                    await asyncio.sleep(2)
                                except Exception:
                                    break
                            if click_count > 0:
                                print(f"      Pre-click '{selector}' x{click_count}")
                                if click_count >= max_pre_clicks:
                                    print(f"      [!] WARNING: Hit max_pre_clicks limit ({max_pre_clicks}). Increase max_pre_clicks in scrape_config if needed.")
                            else:
                                print(f"      Pre-click '{selector}' not found/visible")
                    else:
                        print(f"      [4/6] No explicit pre-clicks configured")

                    # Step 5: Auto-detect and click "Load More" / "Show More" buttons
                    if config.get("auto_load_more", True):
                        print(f"      [5/6] Auto-detecting Load More buttons...")
                        max_auto_clicks = config.get("max_auto_clicks", 20)
                        auto_clicks = await self._auto_click_load_more(page, max_clicks=max_auto_clicks)
                        if auto_clicks > 0:
                            print(f"      Auto-clicked Load More x{auto_clicks}")
                            await asyncio.sleep(2)
                        else:
                            print(f"      No Load More buttons detected")
                    else:
                        print(f"      [5/6] Auto Load More disabled in config")

                    # Step 5.5: Run custom pre-capture JavaScript (optional)
                    pre_capture_js = config.get("pre_capture_js")
                    if pre_capture_js:
                        try:
                            await page.evaluate(pre_capture_js)
                            print(f"      Pre-capture JS executed")
                        except Exception as e:
                            print(f"      Pre-capture JS failed: {e}")

                    # Capture page context before modals (has bedroom counts, plan names, etc.)
                    # This gives Claude the unit type info that modals often lack.
                    page_context = await page.evaluate("""() => {
                        const hidden = [];
                        document.body.querySelectorAll(
                            'script, style, svg, link, noscript, iframe, nav, footer, header, img'
                        ).forEach(el => {
                            hidden.push({ el, prev: el.style.display });
                            el.style.display = 'none';
                        });
                        const text = document.body.innerText;
                        hidden.forEach(({ el, prev }) => { el.style.display = prev; });
                        return text;
                    }""")
                    print(f"      Captured page context ({len(page_context):,} chars)")

                    # Iterate through trigger buttons
                    trigger_selector = config.get("trigger_selector", "button")
                    modal_selector = config.get("modal_selector", ".uk3-modal.uk3-open")
                    close_method = config.get("close_method", "escape")
                    modal_wait_ms = config.get("modal_wait_ms", 2000)
                    max_triggers = config.get("max_triggers", 100)
                    qa_screenshots = config.get("_qa", False)

                    # Count triggers first
                    triggers = await page.query_selector_all(trigger_selector)
                    total = min(len(triggers), max_triggers)
                    print(f"      [6/6] Found {len(triggers)} trigger(s), processing {total}...")
                    if len(triggers) > max_triggers:
                        print(f"      [!] WARNING: Found {len(triggers)} triggers but max_triggers is {max_triggers}. Some modals will be skipped. Increase max_triggers in scrape_config if needed.")

                    all_text = [f"<!-- PAGE CONTEXT -->\n{page_context}"]
                    modal_shots = []
                    consecutive_failures = 0

                    for i in range(total):
                        # Re-query triggers each iteration to avoid stale references
                        triggers = await page.query_selector_all(trigger_selector)
                        if i >= len(triggers):
                            print(f"      Trigger {i + 1} no longer exists (DOM changed), stopping")
                            break

                        trigger = triggers[i]

                        try:
                            # Dismiss any popups that appeared since last iteration
                            if i > 0 and i % 5 == 0:
                                await self._dismiss_popups(page)

                            # Ensure no modal is already open (leftover from failed close)
                            existing_modal = await page.query_selector(modal_selector)
                            if existing_modal:
                                await self._close_modal(page, modal_selector, close_method)
                                await asyncio.sleep(0.3)

                            # Scroll to and click the trigger with a timeout
                            try:
                                await asyncio.wait_for(
                                    trigger.scroll_into_view_if_needed(),
                                    timeout=5.0,
                                )
                            except (asyncio.TimeoutError, Exception):
                                print(f"      Trigger {i + 1}/{total} scroll timeout, skipping")
                                consecutive_failures += 1
                                if consecutive_failures >= 5:
                                    print(f"      5 consecutive failures, stopping")
                                    break
                                continue

                            await asyncio.sleep(0.3)

                            # Capture the trigger's parent card text (has bedroom count, plan name, etc.)
                            card_context = ""
                            try:
                                card_context = await trigger.evaluate("""el => {
                                    // Start from parent to avoid self-matching
                                    // (e.g. button.unit-group-card__button contains "card")
                                    let start = el.parentElement;
                                    if (!start) return '';
                                    let parent = start.closest('[class*="card"]')
                                        || start.closest('[class*="suite"]')
                                        || start.closest('[class*="unit"]')
                                        || start.parentElement?.parentElement;
                                    return parent ? parent.innerText : '';
                                }""")
                            except Exception:
                                pass

                            try:
                                await asyncio.wait_for(
                                    trigger.evaluate("el => el.click()"),
                                    timeout=5.0,
                                )
                            except (asyncio.TimeoutError, Exception):
                                print(f"      Trigger {i + 1}/{total} click timeout, skipping")
                                consecutive_failures += 1
                                if consecutive_failures >= 5:
                                    print(f"      5 consecutive failures, stopping")
                                    break
                                continue

                            # Wait for modal to appear
                            modal = None
                            try:
                                await page.wait_for_selector(
                                    modal_selector, state="visible", timeout=modal_wait_ms
                                )
                                modal = await page.query_selector(modal_selector)
                            except Exception:
                                # Modal didn't appear - try a shorter query
                                modal = await page.query_selector(modal_selector)

                            if modal:
                                try:
                                    text = await asyncio.wait_for(
                                        modal.inner_text(),
                                        timeout=5.0,
                                    )
                                    # Prepend card context (bedroom count, plan name) if available
                                    if card_context:
                                        text = f"[Card: {card_context.strip()}]\n{text}"
                                    all_text.append(text)
                                    print(f"      Captured modal {i + 1}/{total}")
                                    consecutive_failures = 0

                                    # QA: screenshot the open modal for visual verification
                                    if qa_screenshots:
                                        try:
                                            shot = await page.screenshot(type="jpeg", quality=60, full_page=False)
                                            modal_shots.append(shot)
                                        except Exception:
                                            pass
                                except (asyncio.TimeoutError, Exception) as e:
                                    print(f"      Modal {i + 1}/{total} text extraction failed: {e}")
                                    consecutive_failures += 1

                                # Close the modal (robust multi-method)
                                await self._close_modal(page, modal_selector, close_method)
                            else:
                                print(f"      Trigger {i + 1}/{total} - no modal appeared")
                                consecutive_failures += 1

                            if consecutive_failures >= 5:
                                print(f"      5 consecutive failures, stopping")
                                break

                        except Exception as e:
                            print(f"      Modal {i + 1}/{total} failed: {e}")
                            consecutive_failures += 1
                            if consecutive_failures >= 5:
                                print(f"      5 consecutive failures, stopping")
                                break
                            # Try to clean up any open modal
                            try:
                                await self._close_modal(page, modal_selector, close_method)
                            except Exception:
                                pass

                    modals_captured = len(all_text) - 1  # minus page context entry
                    print(f"      Done: captured {modals_captured} modal(s) out of {total} trigger(s)")

                    # Populate fetch meta for QA
                    self._last_fetch_meta = {
                        "strategy": "modal_iterate",
                        "triggers_found": total,
                        "modals_captured": modals_captured,
                        "consecutive_failures": consecutive_failures,
                    }
                    self._last_modal_screenshots = modal_shots

                    # Capture screenshot before returning
                    try:
                        self._last_screenshot = await page.screenshot(type="jpeg", quality=60, full_page=False)
                    except Exception:
                        pass

                    content = "\n<!-- MODAL BREAK -->\n".join(all_text)
                    return self._prepend_promo(promo_context, content)

                finally:
                    await browser.close()

        # Should never reach here, but just in case
        return ""
