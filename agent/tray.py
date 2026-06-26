#!/usr/bin/env python3
"""
Fitzrovia Agent — system-tray / menu-bar app.

Shows the Fitzrovia "F" mark in the tray, runs the agent loop in a background thread,
and gives a small menu (status · pause/resume · open dashboard · quit). This is the
production desktop-agent UX, in Python — the eventual Tauri/Electron build wraps the
same loop, but this lets you run it and SEE the icon today.

Run:  cd agent && python tray.py        (needs: pip install pystray pillow)
- If SUPABASE_URL + a worker token are set -> connects to the cloud DB (SupabaseHubClient).
- If not                                   -> DEMO mode (in-memory MockHubClient) so the
                                              icon + menu work locally with no backend.
"""
import logging
import os
import socket
import sys
import threading
import time
import uuid
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

# Frozen build: load the bundled agent.env (baked non-secret config) first.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    load_dotenv(os.path.join(sys._MEIPASS, "agent.env"))
_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_REPO, "code", ".env"))
load_dotenv()

from PIL import Image            # noqa: E402
import pystray                   # noqa: E402
from runtime import Agent        # noqa: E402
from hub_client import SupabaseHubClient, MockHubClient  # noqa: E402
from handlers.comps import make_comps_handler, TASK_TYPE  # noqa: E402
from pairing import get_credentials                       # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("agent.tray")

ICON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "icon.png")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
AUTHORIZE_URL = os.environ.get("AGENT_AUTHORIZE_URL", "")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"
AGENT_ID = os.getenv("AGENT_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
POLL = float(os.getenv("AGENT_POLL_SECONDS", "5"))
DASHBOARD_URL = os.getenv("HUB_DASHBOARD_URL") or "https://localhost"


class TrayAgent:
    def __init__(self):
        # Resolve credentials (env → keychain → one-click browser pairing).
        creds = {"worker_token": None, "anthropic_key": None}
        if SUPABASE_URL:
            try:
                creds = get_credentials(AUTHORIZE_URL, interactive=True)
            except Exception as e:
                log.warning("pairing failed (%s) — starting in DEMO mode", e)
        worker_token = creds.get("worker_token")
        api_key = creds.get("anthropic_key")

        handlers = {}
        if api_key:
            handlers[TASK_TYPE] = make_comps_handler(api_key, MODEL, HEADLESS)
        if SUPABASE_URL and worker_token:
            self.hub, self.mode = SupabaseHubClient(SUPABASE_URL, worker_token), "cloud"
        else:
            self.hub, self.mode = MockHubClient(), "demo"
            log.warning("no cloud token — DEMO mode (in-memory mock hub)")
        # Agent needs at least one handler to advertise a capability; noop keeps the loop valid.
        self.agent = Agent(self.hub, AGENT_ID, handlers or {"noop": lambda p, c: {}},
                           hostname=socket.gethostname(), poll_seconds=POLL)
        self.paused = threading.Event()
        self.stopped = threading.Event()
        self.status = "starting"
        self.jobs_done = 0

    # background work loop --------------------------------------------------
    def _loop(self):
        try:
            self.hub.register(AGENT_ID, self.agent.capabilities, socket.gethostname())
        except Exception as e:
            log.debug("register failed: %s", e)
        while not self.stopped.is_set():
            if self.paused.is_set():
                self.status = "paused"
                time.sleep(POLL)
                continue
            try:
                self.status = "running" if self._claim_and_run() else "idle"
            except Exception as e:
                log.debug("loop error: %s", e)
                self.status = "idle"
            time.sleep(POLL)

    def _claim_and_run(self) -> bool:
        ran = self.agent.run_once()
        if ran:
            self.jobs_done += 1
        return ran

    # menu ------------------------------------------------------------------
    def _title(self, _item=None) -> str:
        return f"Fitzrovia Agent — {self.mode} · {self.status} · {self.jobs_done} done"

    def _toggle_pause(self, icon, item):
        (self.paused.clear if self.paused.is_set() else self.paused.set)()

    def _open_dashboard(self, icon, item):
        try:
            webbrowser.open(DASHBOARD_URL)
        except Exception:
            pass

    def _quit(self, icon, item):
        self.stopped.set()
        icon.stop()

    def run(self):
        image = Image.open(ICON_PATH)
        menu = pystray.Menu(
            pystray.MenuItem(self._title, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Pause", self._toggle_pause, checked=lambda i: self.paused.is_set()),
            pystray.MenuItem("Open dashboard", self._open_dashboard),
            pystray.MenuItem("Quit", self._quit),
        )
        icon = pystray.Icon("fitzrovia-agent", image, title="Fitzrovia Agent", menu=menu)
        threading.Thread(target=self._loop, daemon=True).start()
        log.info("Fitzrovia Agent running (%s mode) — icon in the tray/menu bar.", self.mode)
        icon.run()   # blocks on the main thread (required on macOS)


if __name__ == "__main__":
    TrayAgent().run()
