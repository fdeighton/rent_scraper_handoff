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
import subprocess
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
from handlers.tricon12 import make_tricon12_handler, TASK_TYPE as TRICON12_TASK  # noqa: E402
from pairing import get_credentials, worker_id_from_token  # noqa: E402
from updater import check_and_update                       # noqa: E402
from urllib.parse import urlsplit                          # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("agent.tray")

ICON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "icon.png")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
# Public anon key — the required Supabase `apikey` header (worker token goes in Bearer).
SUPABASE_ANON_KEY = (os.environ.get("SUPABASE_ANON_KEY")
                     or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "")
AUTHORIZE_URL = os.environ.get("AGENT_AUTHORIZE_URL", "")
_hp = urlsplit(AUTHORIZE_URL or "")
# Hub origin for server-side extraction (POST /api/comp-scrape/extract); baked at build,
# defaults to the authorize URL's origin (same Vercel deployment).
HUB_URL = os.environ.get("AGENT_HUB_URL") or (f"{_hp.scheme}://{_hp.netloc}" if _hp.scheme and _hp.netloc else "")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"
AGENT_ID = os.getenv("AGENT_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
POLL = float(os.getenv("AGENT_POLL_SECONDS", "5"))
VERSION = os.getenv("AGENT_VERSION") or "0.1.0"   # baked at build time (build/agent.env); reported on register
DASHBOARD_URL = os.getenv("HUB_DASHBOARD_URL") or "https://localhost"
# How often the running agent re-checks for a newer release and self-updates in the
# background (no restart needed). Kept modest to stay under GitHub's unauth rate limit.
UPDATE_CHECK_SECONDS = float(os.getenv("AGENT_UPDATE_CHECK_SECONDS", "3600"))

# Pairing is prompted automatically ONCE (first install/run); after that an unpaired
# agent stays quiet and the user pairs from the tray "Sign in" item. This marker records
# that the one-time prompt has happened, so relaunches/updates don't re-pop the browser.
_STATE_DIR = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "FitzroviaAgent")
_FIRSTRUN_MARKER = os.path.join(_STATE_DIR, "pairing-prompted")
_DETACHED = (0x00000008 | 0x00000200) if os.name == "nt" else 0   # survive our own exit on relaunch


class TrayAgent:
    def __init__(self):
        # Resolve credentials WITHOUT opening a browser (env → keychain only). Once paired,
        # the keychain token is found here forever and no auth window ever appears again.
        worker_token = None
        if SUPABASE_URL:
            try:
                worker_token = get_credentials(AUTHORIZE_URL, interactive=False).get("worker_token")
            except Exception as e:
                log.debug("credential check failed: %s", e)

        # No token: open the pairing page automatically ONLY on the very first run (the
        # install / first-open moment). On later launches we stay quiet — the user pairs
        # from the tray "Sign in" item. This stops the auth page popping on every relaunch.
        if not worker_token and SUPABASE_URL and not os.path.exists(_FIRSTRUN_MARKER):
            self._mark_first_run()
            try:
                worker_token = get_credentials(AUTHORIZE_URL, interactive=True).get("worker_token")
            except Exception as e:
                log.warning("first-run pairing not completed (%s) — sign in later from the tray menu", e)

        handlers = {TRICON12_TASK: make_tricon12_handler(HEADLESS)}   # 12mo needs no Anthropic key
        if worker_token and HUB_URL:
            # Extraction runs on the hub (AIS-73) — the agent needs no Anthropic key.
            handlers[TASK_TYPE] = make_comps_handler(HUB_URL, worker_token, HEADLESS)
        if SUPABASE_URL and worker_token and SUPABASE_ANON_KEY:
            self.hub, self.mode = SupabaseHubClient(SUPABASE_URL, SUPABASE_ANON_KEY, worker_token), "cloud"
        else:
            self.hub, self.mode = MockHubClient(), "demo"
            log.warning("no cloud token — DEMO mode (in-memory mock hub)")
        # Claim jobs under the token's `sub` so the hub /extract gate accepts us.
        self.worker_id = worker_id_from_token(worker_token, AGENT_ID) if worker_token else AGENT_ID
        # Agent needs at least one handler to advertise a capability; noop keeps the loop valid.
        self.agent = Agent(self.hub, self.worker_id, handlers or {"noop": lambda p, c: {}},
                           hostname=socket.gethostname(), version=VERSION, poll_seconds=POLL)
        self.paused = threading.Event()
        self.stopped = threading.Event()
        self.status = "starting"
        self.jobs_done = 0
        self.icon = None
        self.paired = bool(worker_token)   # drives the tray "Sign in" item visibility

    # background work loop --------------------------------------------------
    def _loop(self):
        try:
            self.hub.register(self.worker_id, self.agent.capabilities, socket.gethostname())
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

    def _update_watch(self):
        # Perpetually-running agent: re-check for a newer release on a timer and self-update
        # in the background — no restart, nothing visible. stopped.wait() lets Quit interrupt.
        while not self.stopped.wait(UPDATE_CHECK_SECONDS):
            try:
                if check_and_update(VERSION):
                    log.info("update launched — shutting down so the installer can replace us")
                    self.stopped.set()
                    if self.icon is not None:
                        self.icon.stop()
                    return
            except Exception as e:
                log.debug("update watch error: %s", e)

    # menu ------------------------------------------------------------------
    def _title(self, _item=None) -> str:
        state = self.status if self.paired else "not signed in"
        return f"Fitzrovia Agent — {self.mode} · {state} · {self.jobs_done} done"

    def _toggle_pause(self, icon, item):
        (self.paused.clear if self.paused.is_set() else self.paused.set)()

    def _open_dashboard(self, icon, item):
        try:
            webbrowser.open(DASHBOARD_URL)
        except Exception:
            pass

    @staticmethod
    def _mark_first_run():
        try:
            os.makedirs(_STATE_DIR, exist_ok=True)
            open(_FIRSTRUN_MARKER, "a").close()
        except Exception:
            pass

    def _sign_in(self, icon, item):
        # User clicked "Sign in": open the pairing page now. On success, relaunch so we
        # come back up in cloud mode with the stored token (and never prompt again).
        self._mark_first_run()
        try:
            token = get_credentials(AUTHORIZE_URL, interactive=True).get("worker_token")
        except Exception as e:
            log.warning("sign-in did not complete: %s", e)
            return
        if token:
            log.info("signed in — reconnecting")
            self._relaunch()

    def _relaunch(self):
        try:
            args = ([sys.executable] if getattr(sys, "frozen", False)
                    else [sys.executable, os.path.abspath(__file__)])
            subprocess.Popen(args, creationflags=_DETACHED, close_fds=True)
        except Exception as e:
            log.warning("relaunch failed (%s) — please Quit and reopen to connect", e)
        self.stopped.set()
        if self.icon is not None:
            self.icon.stop()

    def _quit(self, icon, item):
        self.stopped.set()
        icon.stop()

    def run(self):
        image = Image.open(ICON_PATH)
        menu = pystray.Menu(
            pystray.MenuItem(self._title, None, enabled=False),
            pystray.Menu.SEPARATOR,
            # Shown only when unpaired — opens the pairing page on click (no auto-pop).
            pystray.MenuItem("Sign in", self._sign_in, visible=lambda i: not self.paired),
            pystray.MenuItem("Pause", self._toggle_pause, checked=lambda i: self.paused.is_set()),
            pystray.MenuItem("Open dashboard", self._open_dashboard),
            pystray.MenuItem("Quit", self._quit),
        )
        icon = pystray.Icon("fitzrovia-agent", image, title="Fitzrovia Agent", menu=menu)
        self.icon = icon
        threading.Thread(target=self._loop, daemon=True).start()
        threading.Thread(target=self._update_watch, daemon=True).start()  # background self-update
        log.info("Fitzrovia Agent running (%s mode) — icon in the tray/menu bar.", self.mode)
        icon.run()   # blocks on the main thread (required on macOS)


if __name__ == "__main__":
    # Self-update (installed build only): if a newer release exists, launch it + exit.
    from updater import check_and_update  # noqa: E402
    if check_and_update(VERSION):
        sys.exit(0)
    TrayAgent().run()
