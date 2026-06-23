"""
Claude API structured extraction from HTML content.
Sends raw page content to Claude and gets back structured unit data.
"""

import json
import base64
import os
import re

import anthropic

# Default Claude model for text extraction; override with ANTHROPIC_MODEL in the env.
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


# ---------------------------------------------------------------------------
# Persistence-boundary guards. validate_units() (below) is the single point
# every scraped unit crosses before it is written to Supabase, so the limits
# live here. Bounds mirror app/build_data.py's sale-price guard (MAX_RENT).
# ---------------------------------------------------------------------------
VALID_UNIT_TYPES = frozenset({
    "bachelor", "1-bed", "1-bed+den", "2-bed", "2-bed+den", "3-bed", "3-bed+den", "4-bed",
})
MAX_RENT = 20000   # monthly rent above this is almost certainly a sale price (condos.ca trap)
MIN_RENT = 300     # below this is implausible for a monthly apartment rent
MAX_SQFT = 10000   # interior sqft above this is a data error
MAX_PSF = 50       # $/sqft above this is implausible


def _to_number(value):
    """Coerce a possibly-stringy numeric ('$2,100', '550 sqft', 2100) to float, or None.

    Tolerant of the formatting Claude occasionally emits; returns None for
    anything that isn't a parseable number so the caller can treat it as missing.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.\-]", "", value)
        if cleaned in ("", "-", ".", "-.", "--"):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


VISION_SQFT_PROMPT = """Extract the square footage (SUPERFICIE / pi² / sqft) and unit type
from each floor plan detail screenshot. Return ONLY a JSON array like:
[{"plan_type": "1-bed", "sqft": 611}, ...]

Unit type normalization rules:
- Studio / Bachelor → "bachelor"
- 1 Chambre / 1 Bedroom → "1-bed"
- 1 Bedroom + Den / 1 Chambre + Den → "1-bed+den"
- 2 Chambres / 2 Bedroom → "2-bed"
- 3 Chambres / 3 Bedroom → "3-bed"

French: "pi²" = pieds carrés = square feet. "SUPERFICIE" means area/sqft.
Use INTERIOR sqft only (not exterior/balcony).
If a screenshot does not contain sqft information, skip it.
Return ONLY valid JSON — no markdown, no explanation."""


VISUAL_QA_PROMPT = """Look at this screenshot of a rental building's listings page.
Count how many individual rental unit listings are visible on the page.

Count each distinct unit/suite card, row, or listing entry. Include:
- Units with prices shown
- Units marked as "Waitlist" or "Coming Soon"
- Units in tables (each row = 1 unit)
- Units in card/tile layouts

Do NOT count:
- Navigation elements, headers, or footers
- Building amenity sections
- Floor plan TYPE cards (unless they show individual units within them)

Return ONLY a JSON object like:
{{"visible_count": 26, "confidence": "high", "notes": "26 unit cards visible in grid layout"}}

Confidence levels:
- "high": Clear unit listings, easy to count
- "medium": Some ambiguity (e.g., collapsed sections, partial loads)
- "low": Page doesn't clearly show individual units (e.g., just floor plan types)"""


LIST_VIEW_QA_PROMPT = """These are sequential viewport screenshots of a SINGLE long rental listings page from {building_name}.
The screenshots were captured by scrolling top-to-bottom — each image is a different vertical slice of the same page.
Adjacent images may overlap by a row or two.

Count the TOTAL number of UNIQUE individual rental units visible across all screenshots, accounting for overlap.
An individual unit is a specific apartment listing with its own unit/suite number, price, sqft, or floor — not a plan type.

If a row appears in two consecutive screenshots (e.g., the same suite # at the bottom of one and the top of the next), count it ONCE.

Return ONLY a JSON object like:
{{"visible_count": 158, "confidence": "high", "notes": "5 viewport screenshots, ~30-32 rows each, minor overlap accounted for"}}

Confidence levels:
- "high": Rows are clearly delineated and easy to count, overlap is unambiguous
- "medium": Some rows are partially cut off or overlap is hard to resolve
- "low": Hard to determine unique units (heavy overlap, blurry, partially loaded content)"""


MODAL_QA_PROMPT = """These are screenshots of individual rental listing modals from {building_name}.
Each screenshot shows a modal popup containing unit details (floor plans, prices, availability).
Each modal may contain multiple individual units (e.g., different floor levels of the same plan type).

Count the TOTAL number of individual rental units visible across ALL screenshots combined.
An individual unit is a specific apartment with its own price/floor/availability — not a plan type.

For example, if a modal shows "Studio - Floor 3: $1,800 / Floor 5: $1,850 / Floor 8: $1,900",
that's 3 individual units from one modal.

Return ONLY a JSON object like:
{{"visible_count": 53, "confidence": "high", "notes": "12 modals with ~4-5 units each"}}

Confidence levels:
- "high": Clear unit listings in each modal, easy to count
- "medium": Some modals have ambiguous or partially loaded content
- "low": Hard to determine individual units from the screenshots"""


EXTRACTION_PROMPT = """You are extracting rental unit listings from a building's website HTML.

Building name: {building_name}
{extraction_hint}
Extract ALL rental unit listings, including units marked as "Join Waitlist", waitlisted,
or otherwise not immediately available. For each unit, return:
- unit_type: Normalize to one of: "bachelor", "1-bed", "1-bed+den", "2-bed", "2-bed+den", "3-bed", "3-bed+den", "4-bed"
  - Map "Studio" → "bachelor"
  - Map "Junior 1 Bedroom" → "bachelor"
  - Map "1 Bedroom + Den" or "1 Bed + Den" → "1-bed+den"
  - Map "2 Bedroom + Den" → "2-bed+den"
  - Map "3 Bedroom + Den" → "3-bed+den"
  - French: "1 Chambre" = 1-bed, "2 Chambres" = 2-bed, "3 Chambres" = 3-bed, "Studio" = bachelor
- bathrooms: as string (e.g., "1", "2", "1.5"). null if not listed.
- square_footage: INTERIOR square footage only as integer. If the listing separates INT and EXT
  (e.g., "569 INT SQ.FT. + 42 EXT SQ.FT."), use only the INT value (569).
  If sqft is shown as a plan-level range such as "up to X SF" or "up to X sq ft", use X as the
  square footage for all units of that type (e.g., "up to 679 SF" → square_footage: 679).
  If sqft is shown as a bracket range (e.g., "500-599 sqft", "0-499 sqft", "1,000-1,199 sqft"),
  use the HIGHEST value in the range (e.g., "500-599 sqft" → square_footage: 599).
  If individual unit sqft is not listed but [SQFT REFERENCE] markers are present in the content,
  use the sqft value from the matching unit type. null only if no sqft source exists.
  French: "pi²" or "pi2" = pieds carrés = square feet (e.g., "700pi²" = 700 sqft).
  "SUPERFICIE" means area/sqft in French-language listings.
- rent_price: monthly rent as number (no $ or commas). If a range is shown (e.g., "$2,279-$2,348/mo"),
  use the HIGHEST value in the range (e.g., 2348). This reflects the 12-month lease term.
  If individual units/floor plans do not show a price directly, but the page contains "starting from"
  or "from $X" prices by bedroom type (e.g., "1 bedroom from $2250 per month"), use those as the
  rent_price for all units of that matching bedroom type.
  null only if no price source exists anywhere on the page for that unit type.
- rent_psf: rent per square foot as number. Calculate as rent_price / square_footage if both
  are available and rent_psf is not directly listed. null if either is missing.
- raw_text: the original text snippet this unit was parsed from (keep it short, ~1 line).
- notes: any unit-specific identifiers or notable details. Include floor number (e.g., "Floor 4"),
  unit number/ID (e.g., "Unit 0107"), plan name if listed, and any special characteristics
  (e.g., "corner unit", "penthouse", "terrace"). null if nothing notable is found.

Rules:
- If this page shows listings from multiple buildings or towers, ONLY extract units
  specifically labeled as belonging to "{building_name}". Do NOT include units from other buildings/towers.
- If a unit type has multiple floor plans with different prices, create separate entries for each.
- Include waitlisted units even if they have no listed price — set rent_price to null.
  Note "Waitlist" or "Join Waitlist" in the notes field for these units.
- Ignore furnished/short-term units unless they are the only listings.
- If no units are found, return an empty array.
- Return ONLY valid JSON — a single array of objects. No markdown, no explanation.

Also extract any current INCENTIVES or PROMOTIONS the building is offering (e.g., "2 Months Free",
"$1000 Move-in Bonus", "1 Month Free + Reduced Deposit"). Return this as a separate field.

Return your response in this exact JSON format:
{{
  "incentives": "string description of current incentives, or null if none found",
  "units": [
    {{
      "unit_type": "1-bed",
      "bathrooms": "1",
      "square_footage": 550,
      "rent_price": 2100,
      "rent_psf": 3.82,
      "raw_text": "1 Bedroom - 550 SF - From $2,100",
      "notes": "Unit 0401, Floor 4"
    }}
  ]
}}

HTML Content:
{html_content}"""


class RentExtractor:
    """Extracts structured rental data from HTML using Claude."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def extract(
        self, html_content: str, building_name: str, extraction_hint: str = "",
        max_content_length: int = 100_000,
    ) -> dict:
        """
        Send HTML to Claude, get back structured data.

        Returns dict with:
            - incentives: str | None
            - units: list[dict] with unit_type, bathrooms, square_footage, rent_price, rent_psf, raw_text
        """
        # Truncate content to avoid exceeding context limits
        truncated = html_content[:max_content_length]
        if len(html_content) > max_content_length:
            truncated += "\n\n<!-- CONTENT TRUNCATED -->"

        prompt = EXTRACTION_PROMPT.format(
            building_name=building_name,
            extraction_hint=extraction_hint,
            html_content=truncated,
        )

        # Use streaming to avoid Anthropic API timeout for large outputs
        with self.client.messages.stream(
            model=self.model,
            max_tokens=32768,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            text = stream.get_final_text().strip()

        # Handle potential markdown code blocks
        if "```" in text:
            # Extract content between ```json ... ``` or ``` ... ```
            import re
            match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()

        # If text doesn't start with { or [, try to find JSON in the response
        if not text.startswith(("{", "[")):
            # Look for the first { that starts a JSON object
            brace_idx = text.find("{")
            if brace_idx != -1:
                text = text[brace_idx:]
                # Find the matching closing brace
                depth = 0
                for i, ch in enumerate(text):
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            text = text[: i + 1]
                            break

        try:
            # strict=False allows literal control chars (e.g. tabs) inside JSON
            # strings — Claude sometimes emits unescaped \t in raw_text fields
            result = json.loads(text, strict=False)
        except json.JSONDecodeError as e:
            print(f"  Warning: Failed to parse Claude response as JSON: {e}")
            print(f"  Raw response (first 500 chars): {text[:500]}")
            return {"incentives": None, "units": []}

        # Normalize the response format
        if isinstance(result, list):
            # Old format: just an array of units
            return {"incentives": None, "units": result}
        elif isinstance(result, dict):
            return {
                "incentives": result.get("incentives"),
                "units": result.get("units", []),
            }
        else:
            return {"incentives": None, "units": []}

    def extract_sqft_from_screenshots(
        self,
        screenshots: list[bytes],
        building_name: str,
        vision_model: str = "claude-haiku-4-5-20251001",
    ) -> dict[str, int]:
        """Use Haiku vision to extract sqft from floor plan screenshots.

        Args:
            screenshots: List of PNG screenshot bytes
            building_name: Building name for logging
            vision_model: Model to use (default: Haiku for cost efficiency)

        Returns:
            Dict mapping unit_type → sqft (e.g. {"1-bed": 611, "2-bed": 819})
        """
        if not screenshots:
            return {}

        # Build multimodal content: all images + prompt
        content_blocks = []
        for img in screenshots:
            # Detect media type from magic bytes
            if img[:3] == b'\xff\xd8\xff':
                media_type = "image/jpeg"
            elif img[:8] == b'\x89PNG\r\n\x1a\n':
                media_type = "image/png"
            else:
                media_type = "image/jpeg"  # default fallback
            content_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(img).decode(),
                },
            })
        content_blocks.append({"type": "text", "text": VISION_SQFT_PROMPT})

        try:
            response = self.client.messages.create(
                model=vision_model,
                max_tokens=4096,
                messages=[{"role": "user", "content": content_blocks}],
            )
            text = response.content[0].text.strip()

            # Handle potential markdown code blocks
            if "```" in text:
                import re
                match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
                if match:
                    text = match.group(1).strip()

            result = json.loads(text, strict=False)

            # Build {unit_type: sqft} map, deduplicating by taking first seen
            sqft_map = {}
            for entry in result:
                plan_type = entry.get("plan_type", "").lower().strip()
                sqft = entry.get("sqft")
                if plan_type and sqft and plan_type not in sqft_map:
                    sqft_map[plan_type] = int(sqft)

            print(f"    Vision extracted sqft for: {list(sqft_map.keys())}")
            return sqft_map

        except json.JSONDecodeError as e:
            print(f"    Warning: Vision sqft JSON parse failed: {e}")
            return {}
        except Exception as e:
            print(f"    Warning: Vision sqft extraction failed: {e}")
            return {}

    def verify_unit_count(
        self,
        screenshot: bytes,
        building_name: str,
        extracted_count: int,
        vision_model: str = "claude-haiku-4-5-20251001",
    ) -> dict:
        """Use Haiku vision to count visible units and compare vs extracted count.

        Args:
            screenshot: JPEG screenshot bytes of the listings page
            building_name: Building name for logging
            extracted_count: Number of units the extraction step found
            vision_model: Model to use (default: Haiku for cost)

        Returns:
            Dict with: visible_count, extracted_count, match, confidence, notes
        """
        # Detect media type
        if screenshot[:3] == b'\xff\xd8\xff':
            media_type = "image/jpeg"
        elif screenshot[:8] == b'\x89PNG\r\n\x1a\n':
            media_type = "image/png"
        else:
            media_type = "image/jpeg"

        content_blocks = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(screenshot).decode(),
                },
            },
            {"type": "text", "text": VISUAL_QA_PROMPT},
        ]

        try:
            response = self.client.messages.create(
                model=vision_model,
                max_tokens=1024,
                messages=[{"role": "user", "content": content_blocks}],
            )
            text = response.content[0].text.strip()

            # Parse JSON from response
            if "```" in text:
                import re
                match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
                if match:
                    text = match.group(1).strip()

            result = json.loads(text)
            visible_count = result.get("visible_count", 0)
            confidence = result.get("confidence", "unknown")
            notes = result.get("notes", "")

            # Determine if counts match (within 30% or 3 absolute units)
            if extracted_count == 0:
                match = visible_count == 0
            else:
                ratio = min(visible_count, extracted_count) / max(visible_count, extracted_count)
                abs_diff = abs(visible_count - extracted_count)
                match = ratio >= 0.7 or abs_diff <= 3

            return {
                "visible_count": visible_count,
                "extracted_count": extracted_count,
                "match": match,
                "confidence": confidence,
                "notes": notes,
            }

        except json.JSONDecodeError as e:
            print(f"    Warning: Visual QA JSON parse failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": f"JSON parse error: {e}",
            }
        except Exception as e:
            print(f"    Warning: Visual QA failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": str(e),
            }

    def verify_modal_units(
        self,
        screenshots: list[bytes],
        building_name: str,
        extracted_count: int,
        vision_model: str = "claude-haiku-4-5-20251001",
    ) -> dict:
        """Use Haiku vision to count visible units across modal screenshots.

        Args:
            screenshots: List of JPEG modal screenshot bytes
            building_name: Building name for the prompt
            extracted_count: Number of units the extraction step found
            vision_model: Model to use (default: Haiku for cost)

        Returns:
            Dict with: visible_count, extracted_count, match, confidence, notes
        """
        if not screenshots:
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": "No modal screenshots provided",
            }

        # Build multimodal content: all modal screenshots + prompt
        content_blocks = []
        for img in screenshots:
            if img[:3] == b'\xff\xd8\xff':
                media_type = "image/jpeg"
            elif img[:8] == b'\x89PNG\r\n\x1a\n':
                media_type = "image/png"
            else:
                media_type = "image/jpeg"
            content_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(img).decode(),
                },
            })
        content_blocks.append({
            "type": "text",
            "text": MODAL_QA_PROMPT.format(building_name=building_name),
        })

        try:
            response = self.client.messages.create(
                model=vision_model,
                max_tokens=1024,
                messages=[{"role": "user", "content": content_blocks}],
            )
            text = response.content[0].text.strip()

            # Parse JSON from response
            if "```" in text:
                import re
                match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
                if match:
                    text = match.group(1).strip()

            result = json.loads(text)
            visible_count = result.get("visible_count", 0)
            confidence = result.get("confidence", "unknown")
            notes = result.get("notes", "")

            # Determine if counts match (within 30% or 3 absolute units)
            if extracted_count == 0:
                match = visible_count == 0
            else:
                ratio = min(visible_count, extracted_count) / max(visible_count, extracted_count)
                abs_diff = abs(visible_count - extracted_count)
                match = ratio >= 0.7 or abs_diff <= 3

            return {
                "visible_count": visible_count,
                "extracted_count": extracted_count,
                "match": match,
                "confidence": confidence,
                "notes": notes,
            }

        except json.JSONDecodeError as e:
            print(f"    Warning: Modal QA JSON parse failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": f"JSON parse error: {e}",
            }
        except Exception as e:
            print(f"    Warning: Modal QA failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": str(e),
            }

    def verify_list_units(
        self,
        screenshots: list[bytes],
        building_name: str,
        extracted_count: int,
        vision_model: str = "claude-haiku-4-5-20251001",
    ) -> dict:
        """Use Haiku vision to count units across sequential scroll screenshots of a list page.

        Mirror of `verify_modal_units` but tuned for a single long listings page that's
        been captured as multiple viewport-sized screenshots (top-to-bottom). Uses the
        LIST_VIEW_QA_PROMPT which warns Haiku about overlap between consecutive images.

        Args:
            screenshots: list of JPEG screenshots ordered top-to-bottom
            building_name: building name for the prompt
            extracted_count: number of units the data extraction step found
            vision_model: model to use (default Haiku for cost)

        Returns:
            Dict with: visible_count, extracted_count, match, confidence, notes
        """
        if not screenshots:
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": "No scroll screenshots provided",
            }

        content_blocks = []
        for img in screenshots:
            if img[:3] == b'\xff\xd8\xff':
                media_type = "image/jpeg"
            elif img[:8] == b'\x89PNG\r\n\x1a\n':
                media_type = "image/png"
            else:
                media_type = "image/jpeg"
            content_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(img).decode(),
                },
            })
        content_blocks.append({
            "type": "text",
            "text": LIST_VIEW_QA_PROMPT.format(building_name=building_name),
        })

        try:
            response = self.client.messages.create(
                model=vision_model,
                max_tokens=1024,
                messages=[{"role": "user", "content": content_blocks}],
            )
            text = response.content[0].text.strip()

            if "```" in text:
                import re
                match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
                if match:
                    text = match.group(1).strip()

            result = json.loads(text)
            visible_count = result.get("visible_count", 0)
            confidence = result.get("confidence", "unknown")
            notes = result.get("notes", "")

            # Same matching tolerance as verify_modal_units (±30% or ±3)
            if extracted_count == 0:
                match = visible_count == 0
            else:
                ratio = min(visible_count, extracted_count) / max(visible_count, extracted_count)
                abs_diff = abs(visible_count - extracted_count)
                match = ratio >= 0.7 or abs_diff <= 3

            return {
                "visible_count": visible_count,
                "extracted_count": extracted_count,
                "match": match,
                "confidence": confidence,
                "notes": notes,
            }

        except json.JSONDecodeError as e:
            print(f"    Warning: List QA JSON parse failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": f"JSON parse error: {e}",
            }
        except Exception as e:
            print(f"    Warning: List QA failed: {e}")
            return {
                "visible_count": -1,
                "extracted_count": extracted_count,
                "match": False,
                "confidence": "error",
                "notes": str(e),
            }

    def validate_units(self, units: list[dict]) -> list[dict]:
        """Validate, sanitize, and clean extracted unit data at the persistence boundary.

        This is the single boundary every scraped unit crosses before it is written
        to Supabase. It NEVER raises:

          * Structurally-unusable rows (non-object, or unknown/empty unit_type) are
            QUARANTINED — dropped and counted, so a misfiring scrape can't poison the
            time series with junk rows.
          * Out-of-range values (sale-price-contaminated rents, implausible
            sqft/psf) are SANITIZED to NULL — the unit-type observation is kept, the
            bad number is dropped, mirroring the "Coming Soon = NULL rent" semantics
            the building_summary view already excludes from averages.

        Every drop/coercion is tallied and a one-line summary is logged so bad
        scrapes are visible in the run log without crashing ingestion. The return
        shape (one dict per kept unit, with the exact DB column keys) is unchanged.
        """
        cleaned = []
        quarantine: dict[str, int] = {}

        def flag(reason: str) -> None:
            quarantine[reason] = quarantine.get(reason, 0) + 1

        for u in units:
            if not isinstance(u, dict):
                flag("not_an_object")
                continue

            unit_type = str(u.get("unit_type") or "").lower().strip()
            if unit_type not in VALID_UNIT_TYPES:
                flag(f"unknown_unit_type[{unit_type or '<empty>'}]")
                continue

            # rent_price — coerce, then range-guard (sanitize to NULL, keep the unit)
            rent = _to_number(u.get("rent_price"))
            if rent is not None:
                if rent > MAX_RENT:
                    flag("rent_above_max(sale_price?)"); rent = None
                elif rent <= 0:
                    rent = None                       # 0/negative ⇒ treat as missing
                elif rent < MIN_RENT:
                    flag("rent_below_min"); rent = None

            # square_footage — coerce to int, range-guard
            sqft = _to_number(u.get("square_footage"))
            if sqft is not None and sqft > MAX_SQFT:
                flag("sqft_above_max"); sqft = None
            elif sqft is not None and sqft <= 0:
                sqft = None                           # 0/negative ⇒ missing
            sqft = int(round(sqft)) if sqft is not None else None

            # rent_psf — coerce, range-guard, then recompute from clean rent/sqft if absent
            psf = _to_number(u.get("rent_psf"))
            if psf is not None and (psf > MAX_PSF or psf <= 0):
                if psf > MAX_PSF:
                    flag("psf_above_max")
                psf = None
            if psf is None and rent is not None and sqft is not None and sqft > 0:
                psf = round(rent / sqft, 4)

            bathrooms = u.get("bathrooms")
            bathrooms = str(bathrooms).strip() if bathrooms not in (None, "") else None
            raw_text = u.get("raw_text")
            notes = u.get("notes")

            cleaned.append({
                "unit_type": unit_type,
                "bathrooms": bathrooms,
                "square_footage": sqft,
                "rent_price": rent,
                "rent_psf": psf,
                "raw_text": str(raw_text) if raw_text is not None else None,
                "notes": str(notes) if notes is not None else None,
            })

        if quarantine:
            total = sum(quarantine.values())
            summary = ", ".join(f"{n}× {reason}" for reason, n in sorted(quarantine.items()))
            print(f"  Quarantined/sanitized {total} value(s): {summary}")

        return cleaned
