# v2 Improvements (with hindsight)

v1 works and runs weekly. These are the changes worth making in a rebuild,
ordered by value-to-effort. Each is a **proposal** — none are applied to live
code in this handoff. Source for most of these is the recurring pain in the
weekly scrape history (see [../skills/weekly-scrape/LESSONS_LEARNED.md](../skills/weekly-scrape/LESSONS_LEARNED.md)).

| # | Improvement | Problem it fixes | Effort | Risk |
|---|---|---|---|---|
| 1 | **Two-tier config** | Flat blob mixes mechanism + site knobs; onboarding is bespoke | M | Low |
| 2 | **Sale-price reject rule** | condos.ca sale prices captured as rents ($400–700K) | S | Low |
| 3 | **Formalize the lessons log** | Patterns scattered across a slash command + missing `MEMORY.md` | S | Low |
| 4 | **`yardi_api` generalization** | `tricon_api` only covers Tricon; same backend powers others | M | Med |
| 5 | **New-site skill** | No repeatable onboarding; each site reverse-engineered | M | Low |
| 6 | **Persisted run history table** | Run outcomes live in prose memory, not queryable | M | Low |
| 7 | **Config validation** | Typos in `scrape_config` keys silently ignored | S | Low |

---

### 1. Two-tier config — primary technique + secondary site instructions
Full design in [TWO_TIER_CONFIG.md](TWO_TIER_CONFIG.md). Splits
`{strategy, ...}` into `{technique, site:{...}}`, enabling the onboarding loop and
key validation. Backward-compatible reader shim + one-time migration.

### 2. `rent_price > $20,000` reject rule (extractor.py)
**Problem:** when a condos.ca building has zero for-rent listings, the page
defaults to **for-sale**, and the scraper has repeatedly captured sale prices
($446K–$760K) as monthly rents — catastrophically inflating analysis averages
(Stak36 Apr 27, Avia 2 May 25). Today it's a manual `DELETE FROM unit_data WHERE
rent_price > 20000` after the fact.
**Change:** reject any unit with `rent_price > 20000` inside `validate_units()`
(log it), and/or add `pre_click_selectors: ["text=For Rent"]` for condos.ca.
**Why it's safe:** no legitimate monthly rent in this market exceeds $20K.

### 3. Formalize the lessons-learned log
**Problem:** the weekly command embeds a 24-row "Known Patterns Table" inside
itself and tells the operator to update a `MEMORY.md` that **doesn't exist in the
repo**. Learning is real but its home is ambiguous.
**Change:** a single append-only [LESSONS_LEARNED.md](../skills/weekly-scrape/LESSONS_LEARNED.md)
(seeded in this package) that the weekly skill reads at start and appends to at
end — one structured entry per run. Patterns table moves there too.

### 4. `yardi_api` — generalize the Tricon API bypass
**Problem:** `tricon_api` is the most accurate technique (deterministic JSON, no
Claude, fixed the Cherry House 27→158 undercount) but is hard-coded to Tricon's
endpoint. Other buildings (e.g. Mirvish Village) sit on the **same Yardi/RentCafe
backend**.
**Change:** generalize into a `yardi_api`/`rentcafe_api` technique parameterized
by endpoint + status whitelist + field mapping. Each migrated building removes a
Claude extraction and a class of undercount bugs.
**Risk:** endpoint discovery varies per property; needs a probe step (fits the
new-site skill).

### 5. New-site onboarding skill
**Problem:** adding a property today means manually probing the site and writing a
config by trial and error. **Change:** the [new-site skill](../skills/new-site/SKILL.md)
drives the try-order → visual-verify → add-overrides loop and persists a v2
config. Turns a 30-minute expert task into a checklist anyone can run.

### 6. Persisted run-history table
**Problem:** weekly outcomes (counts, fixes, failures, new patterns) live in prose
memory — not queryable, easy to lose. **Change:** a `scrape_runs` table
(date, buildings_processed, units, delta, fixes_json, failures_json) written at
the end of each weekly run. Enables trend dashboards over *operational* health
(success rate, recurring failers), not just rents.

### 7. Config key validation
**Problem:** a misspelled `scrape_config` key (e.g. `pagiantion_selector`) is
silently ignored — the building just under-captures. **Change:** validate keys
against the known set on write (and warn in `--list`), trivially easy once Tier-2
keys live under a typed `site` object (#1).

---

## Explicitly NOT recommended
- **Don't** hardcode unit counts anywhere — counts change weekly by design.
- **Don't** add a silent fallback from `tricon_api` to HTML max_rent on API
  failure — the current "mark error, stay visible" behavior is correct.
- **Don't** drop the Haiku visual QA layer to save cost — it's the only thing that
  catches partial-capture drift that WoW deltas miss.
