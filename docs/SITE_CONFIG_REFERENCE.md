# Tier 2 — Site Config Reference (secondary, site-specific instructions)

Once a **technique** (Tier 1) is chosen, these keys tune it to one specific site.
They all live in `comp_buildings.scrape_config` (a JSONB object) alongside
`strategy`. Every key below is actually read by `scraper/fetcher.py` (or
`extractor.py` for `extraction_hint`) — line numbers are from the current code.

> v2 proposal groups these under a `site` object; see
> [../design/TWO_TIER_CONFIG.md](../design/TWO_TIER_CONFIG.md). The keys/semantics
> are unchanged — only the nesting differs.

## Navigation & setup
| Key | Type | Purpose |
|---|---|---|
| `setup_clicks` | string[] | Buttons to click before capture (e.g. `["text=Availability","button:has-text('List View')"]`). |
| `click_selectors` | string[] | Elements to click during capture (e.g. "Load More"). |
| `click_repeat` | bool | Keep clicking `click_selectors` until it disappears. |
| `max_click_repeats` | int (30) | Cap for `click_repeat`. |
| `pre_click_selectors` | string[] | Clicks before iteration (modal_iterate). |
| `max_pre_clicks` | int (20) | Cap for pre-clicks. |
| `auto_load_more` | bool (true) | Auto-detect & click Load/Show More (modal_iterate). |
| `max_auto_clicks` | int (20) | Cap for auto Load More. |

## Sections / tabs
| Key | Type | Purpose |
|---|---|---|
| `section_clicks` | string[] | Tab/section selectors to iterate, capturing each (e.g. floor tabs). |
| `section_wait_ms` | int (3000) | Wait after a section click. |
| `section_back_selector` | string | Back button between sections. |

## Pagination
| Key | Type | Purpose |
|---|---|---|
| `next_button_selector` | string | "Next page" button; click + capture until gone. |
| `next_button_wait_ms` | int (2000) | Wait after each next click. |
| `pagination_selector` | string | Numbered page links to click in turn. |
| `max_pages` | int (50) | Pagination loop cap. |

## Content waiting & selection
| Key | Type | Purpose |
|---|---|---|
| `wait_selector` | string | CSS to wait for before capturing. |
| `content_selector` | string | Limit captured text to this element (else full body). |
| `initial_wait_ms` | int (3000) | Wait after page load. |

## Scrolling
| Key | Type | Purpose |
|---|---|---|
| `scroll` | bool | Scroll to trigger lazy loading. |
| `scroll_count` | int | Number of scroll steps. |

## DOM / JavaScript
| Key | Type | Purpose |
|---|---|---|
| `shadow_host_selector` | string | Shadow-DOM host to pierce for content (e.g. RentSync FPN). |
| `iframe_selector` | string | iframe to enter (`iframe_extract`, or within render). |
| `pre_capture_js` | string | Custom JS run before capture (reveal hidden data, inject `textContent`). |
| `dynamic_additional_urls_selector` | string | Discover subpage `<a>` hrefs and follow them in-context (keeps cookies). |
| `dynamic_subpage_wait_ms` | int (5000) | Wait per dynamic subpage. |
| `additional_urls` | string[] | Extra static URLs to fetch & append (real browser per URL — use instead of `fetch()` on Cloudflare sites). |

## Filters / iframe / modal (technique-specific)
| Key | Type | Technique | Purpose |
|---|---|---|---|
| `filter_selectors` | string[] | filter_iterate | Filter chips to click, capturing each. |
| `trigger_selector` | string | modal_iterate | Cards that open a unit modal. |
| `modal_selector` | string (`.uk3-modal.uk3-open`) | modal_iterate | The open-modal element. |
| `close_method` | string (`escape`) | modal_iterate | How to close: "escape" or a selector. |
| `modal_wait_ms` | int (2000) | modal_iterate | Wait for modal to appear. |
| `max_triggers` | int (100) | modal_iterate | Max modals to process. |

## Tricon
| Key | Type | Purpose |
|---|---|---|
| `tricon_api_slug` | string | Explicit API slug; else parsed from the URL. |

## QA (visual verification)
| Key | Type | Purpose |
|---|---|---|
| `multi_viewport_screenshots` | bool | Capture a scroll series for Haiku list QA (Load More pages). |
| `multi_viewport_item_selector` | string | Anchor scrolling to individual list items. |
| `multi_viewport_debug_save` | bool | Save the scroll screenshots to disk for inspection. |

## Vision enrichment (`vision_enrichment` object)
| Key | Type | Purpose |
|---|---|---|
| `enabled` | bool | Turn on floor-plan sqft enrichment. |
| `mode` | string | `image_urls` (default) / `click` / `click_popup`. |
| `tile_selector` | string | Unit/plan tiles to read images from. |
| `initial_wait_ms` | int (12000) | Wait before collecting tiles. |
| `max_images` | int (20) | Cap on plan images. |
| `image_selector` | string (`img`) | `image_urls` mode — img within a tile. |
| `image_attr` | string | Read image URL from this tile attribute (e.g. `href`). |
| `detail_selector` / `detail_wait_ms` / `back_selector` / `close_selector` | | `click` mode — open a detail panel, screenshot, return. |
| `popup_image_selector` / `close_selector` / `wait_ms` | | `click_popup` mode — click tile → popup image. |

## Extraction
| Key | Type | Purpose |
|---|---|---|
| `extraction_hint` | string | Extra guidance appended to Claude's extraction prompt (e.g. "extract EACH individual apartment from the ADDITIONAL PAGE section"; "Tower A only"). |

## Documentation-only
| Key | Type | Purpose |
|---|---|---|
| `building_name` | string | Human reference; ignored by logic. |
| `notes` | string | Human notes; ignored by logic. |

---

## Two worked examples (live configs)

**The Selby** — `playwright_render`, paginated table behind tabs:
```json
{
  "building_name": "The Selby",
  "strategy": "playwright_render",
  "setup_clicks": ["text=Availability", "button:has-text('List View')"],
  "scroll": false,
  "wait_selector": ".TableList-item",
  "content_selector": ".UnitsList.TableList",
  "pagination_selector": ".UnitsListWrapper .pagination a, .UnitsList ~ .pagination a",
  "initial_wait_ms": 5000,
  "notes": "Dismiss popup > Availability sidebar > List View tab > paginated table."
}
```

**Story of Midtown** — `playwright_render`, shadow DOM + floor pagination:
```json
{
  "building_name": "Story of Midtown",
  "strategy": "playwright_render",
  "initial_wait_ms": 5000,
  "scroll": true,
  "scroll_count": 5,
  "section_clicks": ["button:has-text(\"Brand New Suites\")"],
  "next_button_selector": "a.floor-select__next-floor",
  "next_button_wait_ms": 3000,
  "max_pages": 30,
  "section_wait_ms": 3000,
  "shadow_host_selector": "floorplan-navigator.fpn-one"
}
```

Every active building's full config is in
[`../db/seed/comp_buildings.json`](../db/seed/comp_buildings.json) (the `scrape_config` field).
