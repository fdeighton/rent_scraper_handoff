#!/usr/bin/env python3
"""
Fitzrovia Agent — production entrypoint.

A generic execution layer that runs AI Studio jobs locally on a user's machine. It is
OUTBOUND-ONLY: it polls the cloud DB (Supabase) directly — Supabase is the only
backend — claims jobs, runs them, and writes results back through scoped RPCs. Comps
scraping is the first registered task type; future tools register additional handlers.

Run:  cd agent && python main.py
Env (agent/.env or code/.env):
    SUPABASE_URL        base URL of the Supabase project (https://<ref>.supabase.co)
                        (NEXT_PUBLIC_SUPABASE_URL is also accepted)
    AGENT_AUTHORIZE_URL website authorize page for one-click pairing
                        (e.g. https://your-site/authorize.html). Not needed if a token
                        env var is set or the device was already paired (OS keychain).
    SCRAPE_WORKER_TOKEN optional scoped token override (else resolved via keychain/pairing)
    ANTHROPIC_API_KEY_RENT_COMPS | ANTHROPIC_API_KEY   (used by the comps handler)
    ANTHROPIC_MODEL  default claude-sonnet-4-6
    HEADLESS         default true
    AGENT_ID         default <hostname>-<rand>
    AGENT_POLL_SECONDS  default 5

To exercise the full loop locally with no DB, use `python dev_run.py` (in-memory hub).
"""
import logging
import os
import socket
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Shared scraper creds live in code/.env; agent/.env (if present) can override.
# When frozen (PyInstaller), load the bundled agent.env first (non-secret config the
# build baked in: SUPABASE_URL, AGENT_AUTHORIZE_URL). Secrets come via pairing.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    load_dotenv(os.path.join(sys._MEIPASS, "agent.env"))
_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_REPO, "code", ".env"))
load_dotenv()

from runtime import Agent                                  # noqa: E402
from hub_client import SupabaseHubClient                   # noqa: E402
from handlers.comps import make_comps_handler, TASK_TYPE   # noqa: E402
from pairing import get_credentials                        # noqa: E402

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO),
                    format="%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("agent")

# The agent talks DIRECTLY to the cloud DB (Supabase) — it IS the only backend.
# Accept the URL name already in code/.env (NEXT_PUBLIC_SUPABASE_URL) so nothing is
# duplicated. The worker token AND the Anthropic key are resolved by
# pairing.get_credentials() at runtime (env override → OS keychain → one-click pairing).
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
AUTHORIZE_URL = os.environ.get("AGENT_AUTHORIZE_URL", "")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"
AGENT_ID = os.getenv("AGENT_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
POLL = float(os.getenv("AGENT_POLL_SECONDS", "5"))
VERSION = os.getenv("AGENT_VERSION") or "0.1.0"   # baked at build time (build/agent.env); reported on register


def main() -> None:
    if not SUPABASE_URL:
        log.error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required — the agent talks "
                  "directly to the cloud DB. For a local test with no DB, run: python dev_run.py")
        sys.exit(1)

    # Resolve credentials: env override → OS keychain → one-click browser pairing.
    try:
        creds = get_credentials(AUTHORIZE_URL, interactive=True)
    except Exception as e:
        log.error("could not obtain credentials: %s", e)
        sys.exit(1)
    worker_token = creds.get("worker_token")
    api_key = creds.get("anthropic_key")
    if not worker_token:
        log.error("no worker token available (set a token env var or AGENT_AUTHORIZE_URL for pairing)")
        sys.exit(1)
    if not api_key:
        log.warning("no Anthropic key available — non-API comps scrapes will fail at extraction")

    handlers = {TASK_TYPE: make_comps_handler(api_key, MODEL, HEADLESS)}
    hub = SupabaseHubClient(SUPABASE_URL, worker_token)
    Agent(hub, AGENT_ID, handlers, hostname=socket.gethostname(),
          version=VERSION, poll_seconds=POLL).run_forever()


if __name__ == "__main__":
    main()
