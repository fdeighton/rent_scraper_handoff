"""
Configuration management - loads from environment variables.
NEVER hardcode API keys or secrets.
"""

import os
from dataclasses import dataclass, field

# Model is configurable via env (ANTHROPIC_MODEL), never hardcoded. One source of truth.
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


@dataclass
class Config:
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str
    headless: bool = True
    extraction_model: str = DEFAULT_MODEL
    max_content_length: int = 100_000  # chars to send to Claude

    @classmethod
    def from_env(cls) -> "Config":
        """Load config from environment variables."""
        # Accept both this scraper's names and the standard Supabase/Next.js names.
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        # Project-scoped key first, then the generic name for backward compatibility.
        api_key = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")

        missing = []
        if not url:
            missing.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        if not key:
            missing.append("SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)")
        if not api_key:
            missing.append("ANTHROPIC_API_KEY_RENT_COMPS")

        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}\n"
                f"Copy .env.example to .env and fill in your keys."
            )

        return cls(
            supabase_url=url,
            supabase_service_key=key,
            anthropic_api_key=api_key,
            headless=os.environ.get("HEADLESS", "true").lower() == "true",
            extraction_model=DEFAULT_MODEL,
        )
