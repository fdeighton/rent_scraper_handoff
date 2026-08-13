"""
Runtime logging — a persistent file log for the installed (windowed) agent.

The frozen tray app is built with `console=False`, so anything written to stderr by
`logging.basicConfig()` goes NOWHERE — which is why the only logs that ever existed on
a stuck machine were the updater's (it writes its own file). This module gives the whole
runtime the same treatment: a rotating file at

    %LOCALAPPDATA%\\FitzroviaAgent\\agent.log   (Windows)
    ~/.fitzrovia-agent/agent.log                (macOS/Linux fallback)

so pairing, credential load, network preflight, registration and every RPC response are
inspectable after the fact. Call `setup_logging()` ONCE at process start (main.py / tray.py)
before anything else logs.
"""
from __future__ import annotations

import logging
import os
import sys
import tempfile
from logging.handlers import RotatingFileHandler

# Same state dir the updater uses, so all agent logs live together.
STATE_DIR = os.path.join(
    os.environ.get("LOCALAPPDATA")
    or (os.path.join(os.path.expanduser("~"), ".fitzrovia-agent"))
    or tempfile.gettempdir(),
    "FitzroviaAgent",
)
LOG_PATH = os.path.join(STATE_DIR, "agent.log")

_FMT = "%(asctime)s %(levelname)-5s %(name)s %(message)s"
_configured = False


def setup_logging(level: str | None = None) -> str:
    """Install a rotating file handler (+ stderr when a console exists) on the root
    logger. Idempotent. Returns the log path so the caller can print/report it."""
    global _configured
    if _configured:
        return LOG_PATH

    lvl = getattr(logging, (level or os.getenv("LOG_LEVEL", "INFO")).upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(lvl)

    handlers: list[logging.Handler] = []
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        fh = RotatingFileHandler(LOG_PATH, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
        fh.setFormatter(logging.Formatter(_FMT))
        handlers.append(fh)
    except Exception as e:            # never let logging setup crash startup
        print(f"could not open agent log file ({e})", file=sys.stderr)

    # Keep stderr output when there's a real console (dev runs / headless main.py in a
    # terminal). Harmless in the windowed build (stderr is just discarded there).
    sh = logging.StreamHandler()
    sh.setFormatter(logging.Formatter(_FMT))
    handlers.append(sh)

    for h in root.handlers[:]:        # replace any prior basicConfig handlers
        root.removeHandler(h)
    for h in handlers:
        root.addHandler(h)

    _configured = True
    logging.getLogger("agent.logging").info("logging -> %s (level=%s)", LOG_PATH, lvl)
    return LOG_PATH
