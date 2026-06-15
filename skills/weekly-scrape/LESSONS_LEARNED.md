# Weekly Scrape — Lessons Learned

The append-only memory that makes the [weekly-scrape skill](SKILL.md) smarter each
run. Two sections:

1. **Known Patterns Table** — symptom → root cause → fix. Check it during Phase 4
   *before* investigating. Add a row when you find a novel, reusable pattern.
2. **Run History** — one dated entry per weekly run. Append at the end of Phase 5.

> This replaces v1's two scattered homes for this knowledge: a patterns table
> embedded inside the slash command, and a `MEMORY.md` the command referenced but
> that didn't exist in the repo. Keep everything here.

---

## 1. Known Patterns Table

| Symptom | Platform | Root cause | Fix |
|---|---|---|---|
| `raw_content` < 1KB | Any | Site down/blocking | Increase `initial_wait_ms` to 8000–12000 |
| `raw_content` normal, 0 units | Any | Claude extraction non-deterministic | Built-in retry handles it; plain retry |
| "Access Denied" / "403" in content | Any | Bot detection | `initial_wait_ms: 8000`; consider `akamai_stealth` |
| Single `403`/tiny error page on a normally-good `playwright_render` building | Any | Transient rate-limit, not a persistent WAF | **Plain retry FIRST** (Humaniti Jun 15: 0→47). Only escalate if it persists 2+ retries |
| `raw_content` dropped 50%+ vs prev | Any | Pagination/load-more broke | Check `click_selectors`, `pagination_selector`, `pre_capture_js` |
| Units < 50% but content similar | Any | Extraction missed types | Check if site changed unit-type labels |
| `innerText` < 2KB on RentSync | RentSync | CSS-hidden `.unit-group-card` | `pre_capture_js` injecting `textContent` |
| Shadow DOM `click()` fails | RentSync FPN | Standard click unreliable | `dispatchEvent(new MouseEvent('click',{bubbles:true}))` |
| Promotions modal blocks clicks | Any | Overlay eats pointer events | JS click fallback `el.evaluate("el=>el.click()")` |
| "Show All" button not found | condos.ca | Selector targets wrong tag | `pre_capture_js` with `textContent.match()` |
| QA WARN on `modal_iterate` | Parker/Waverley | Haiku sees plan types, not units | SKIP — not a bug |
| Sqft dropped WoW | Any | Was incidental HTML text | Add `vision_enrichment` |
| Missing unit types (0 of a type) | Entrata/paginated | Floor plans paginate; only page 1 captured | Add `pagination_selector` for numbered pages |
| "Showing X results" but extracted ≪ X | Any | Pagination/lazy-load not configured | Configure pagination; compare content vs extracted |
| "Page not found"/404 in content | Any | Site redesigned / URL changed | Find new listings URL, update `scrape_url` + config |
| `fetch()` in `pre_capture_js` returns Cloudflare challenge | RentCafe/securecafe | CF blocks non-browser JS | Use `additional_urls` (real browser per URL), not fetch/XHR |
| Elementor page visually full but `innerText` < 2KB | WordPress/Elementor | CSS-background + lazy containers | `scroll_count` 15+, add `extraction_hint`; low char count is fine |
| 9 units from a RentCafe site with 100+ | RentCafe/Yardi | Claude extracts plan summaries | `extraction_hint`: extract EACH apartment from the ADDITIONAL PAGE section |
| content_len 0, "Section click failed" for all sections | Planpoint `/g/` grouped | Site consolidated; `section_clicks` selectors gone | Remove `section_clicks`/`section_wait_ms`/`section_back_selector`; `scroll_count` 8+ |
| `rent_price` $400K–$700K, raw_text `$XXX,XXX` no `/month` | condos.ca | Zero for-rent → page shows for-sale; sale prices captured as rent | `DELETE FROM unit_data WHERE rent_price > 20000`; add `pre_click_selectors:["text=For Rent"]`; **proposed** permanent reject rule (IMPROVEMENTS #2) |
| `Invalid control character at line N` JSON error, tabs in `raw_text` | Any Claude extraction | Claude emits literal `\t` in JSON strings | **FIXED in code (Jun 1):** `json.loads(text, strict=False)` at both parses (~L221, ~L293) |
| Background batch reports every building "not found", 0 writes | Windows batch driver | Batch file CRLF; bash `read` leaves `\r` | Write batch files LF-only (`write_bytes`); strip with `name="${name%$'\r'}"` |
| Tricon rents 5–10% high; Cherry House ~25% of inventory | Tricon | List `$X–$Y/mo` HIGH end = short term; HTML undercounts | `strategy: tricon_api` (Apr 27) — JSON API, `min_rent`, status filters, UnitID guard |
| Haiku QA permanently WARNs on Load More pages | Any list w/ Load More | Single screenshot can't see below fold | `multi_viewport_screenshots: true` (May 1) → scroll series → `verify_list_units` |

---

## 2. Run History

> Seed entries below are condensed from project memory (Mar–Jun 2026). Append new
> runs at the **top**. Template:
>
> ```
> ### YYYY-MM-DD — N/M buildings, U units (Δ vs prev)
> Fixed: ...  | Failed/manual: ...
> Real movers / market: ...
> New patterns: ... (added to table? y/n)
> Runtime: ...
> ```

### 2026-06-08 — 99/102, 2,037 units (+87, +4.5%)
Clean run, 8 parallel batches. No CRLF bug (LF fix holding), no JSON-parse errors
(Maestria `strict=False` holding, 187 units). Fixed: EXS Luxury 1→10 (plain-retry
extraction drift, recurring plan-summary undercount). Failed/manual: Sixty Five
Broadway (`static_html` Google-Sheets CSV 401, 2nd week — re-share sheet) + Finale
& Revolve (akamai manual). Real: Senakw I firming 6th wk; Marlow firming; Maddox
softening broadly; Elm Ledbury softening. Incentive rate 64/99 = 65%.

### 2026-06-01 — 99/102, 1,950 units (−104, −5.1%)
**Permanent fix:** Maestria 0→196 via `json.loads(strict=False)` (literal tabs in
`raw_text`, deterministic retry failure). Le Vanguard 0→4 plain retry. Failed:
Sixty Five Broadway 401 + akamai manual. Infra: hit Windows CRLF batch bug — fixed
with `write_bytes` LF + `\r` strip (no data written during the no-op run). Senakw I
firming hard 5th wk. Incentive ~65%.

### 2026-05-25 — 100/102, 2,054 units (−61, −2.9%)
EXS Luxury 1→10 retry. **Data cleanup:** Avia 2 condos.ca sale-price contamination
(6 rows $499K–$760K deleted) — same pattern as Stak36; motivates the `>$20K` reject
rule. Elm Ledbury 47 accepted as real new baseline. Senakw I firmed 4th wk.
Incentive 67/100 = 67%.

### 2026-05-19 — 101/102, 2,115 units (−136, −6.0%)
Two critical retries (Humaniti 10→60, Signal oscillation accepted 99). Failed:
Finale akamai blocked twice (profile reset needed). Cleaned 4 duplicate retry
snapshots. Senakw I firming 3rd wk; Maddox softening hard. Incentive 67/100.

### 2026-05-11 — 102/102, 2,251 units (+152, +7.2%)
Two critical plain-retries (Signal 23→151 shadow-DOM partial; Corner 0→13). Several
capture-improvement movers (not organic). Senakw I 2nd-wk firming. Incentive 65/102.

### 2026-05-04 — 102/102, 1,997 units (−52, −2.5%)
Daniels on Parliament 14→64 retry. **Mid-run halt:** Anthropic credit balance hit
zero ~38 buildings in; user reloaded, remaining 52 re-scraped — no data lost
(motivates API_CREDITS classification). 103/105 West Lodge persistent FETCH_FAILURE.

### 2026-05-01 — Tricon-only test (6/6, 247 units)
First run of `tricon_api` on the 6 Tricon buildings. Cherry House 78→158 (undercount
fix, not market). Multi-viewport Haiku QA added — all 6 PASS.

### 2026-04-27 — 102/102, 2,078 units (+6)
Tricon API methodology switch (max_rent→min_rent; Cherry House 27→158). Stak36
sale-price contamination (10 rows deleted). 5 transient retries. Pre-fix Tricon
rents 5–10% inflated; fixed for May 4 onward.

### 2026-04-20 — 101/102, 2,072 units (+158)
Maestria +256 (Planpoint consolidated — removed Tour A/B split; dropped
`section_clicks`). Revolve moved to akamai_stealth. Incentive 68/101.

### Earlier (Mar 5 – Apr 13, 2026)
First `/weekly-scrape` runs (Mar 5). Expansion to ~110 buildings. Site redesigns
caught + fixed: Story of Midtown (Apr 13/16), Mirvish→RentCafe & Whitney→/apartments
(Apr 6), The Diamond extraction_hint (Mar 30). See project memory for detail.
