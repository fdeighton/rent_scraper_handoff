"""
Configuration management - loads from environment variables.
NEVER hardcode API keys or secrets.
"""

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: str
    headless: bool = True
    extraction_model: str = "claude-sonnet-4-20250514"
    max_content_length: int = 100_000  # chars to send to Claude

    @classmethod
    def from_env(cls) -> "Config":
        """Load config from environment variables."""
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        # Project-scoped key first, then the generic name for backward compatibility.
        api_key = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")

        missing = []
        if not url:
            missing.append("SUPABASE_URL")
        if not key:
            missing.append("SUPABASE_SERVICE_KEY")
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
            extraction_model=os.environ.get("EXTRACTION_MODEL", "claude-sonnet-4-20250514"),
        )
