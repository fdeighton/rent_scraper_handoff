"""
Agent device pairing + credential storage.

The downloadable agent must NOT ship any secret. On first run it obtains its
credentials via a one-click browser pairing flow and stores them in the OS keychain:

  * worker_token  — a SCOPED `scrape_worker` JWT (execute-only on the worker RPCs)
  * anthropic_key — the comps API key (so the extractor can call Claude)

Both are minted/returned by the `issue_worker_token` Edge Function (which holds the
JWT secret + the Anthropic key server-side) when the user clicks "Authorize".
Neither is ever baked into the installer.

Resolution order in `get_credentials()` (per credential): env override → OS keychain
→ interactive pairing (which fills both at once).

Pairing UX (Slack / GitHub CLI style):
    launch → browser opens "Authorize this device?" → one click → tab auto-closes
    → creds captured on 127.0.0.1 → saved to keychain → never asked again.
"""
from __future__ import annotations

import logging
import os
import secrets
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

log = logging.getLogger("agent.pairing")

KEYRING_SERVICE = "fitzrovia-agent"
KEY_TOKEN = "scrape_worker_token"
KEY_AKEY = "anthropic_key"
PAIR_TIMEOUT_SECONDS = 300

_ENV_TOKEN_NAMES = ("SCRAPE_WORKER_TOKEN", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY")
_ENV_AKEY_NAMES = ("ANTHROPIC_API_KEY_RENT_COMPS", "ANTHROPIC_API_KEY")


# --- keychain (with a protected-file fallback if `keyring` isn't available) ----
def _file_path(key: str) -> str:
    base = os.path.join(os.path.expanduser("~"), ".fitzrovia-agent")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, key)


def _load(key: str) -> str | None:
    try:
        import keyring
        v = keyring.get_password(KEYRING_SERVICE, key)
        if v:
            return v
    except Exception:
        pass
    try:
        p = _file_path(key)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return f.read().strip() or None
    except Exception:
        pass
    return None


def _save(key: str, value: str) -> None:
    try:
        import keyring
        keyring.set_password(KEYRING_SERVICE, key, value)
        return
    except Exception as e:
        log.warning("keychain unavailable (%s) — falling back to a protected file", e)
    p = _file_path(key)
    with open(p, "w", encoding="utf-8") as f:
        f.write(value)
    try:
        os.chmod(p, 0o600)   # best effort; no-op semantics on Windows
    except Exception:
        pass


def clear_credentials() -> None:
    """Forget paired credentials (forces re-pair on next start)."""
    for key in (KEY_TOKEN, KEY_AKEY):
        try:
            import keyring
            keyring.delete_password(KEYRING_SERVICE, key)
        except Exception:
            pass
        try:
            os.remove(_file_path(key))
        except OSError:
            pass


# --- loopback pairing ---------------------------------------------------------
class _Pairing:
    """Holds the result of a single pairing round across the HTTP handler thread."""
    def __init__(self, state: str):
        self.state = state
        self.token: str | None = None
        self.akey: str | None = None
        self.done = threading.Event()


def _make_handler(pairing: _Pairing):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):   # silence default stderr logging
            pass

        def _html(self, code: int, title: str, msg: str):
            self.send_response(code)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            body = (
                "<!doctype html><meta charset=utf-8>"
                "<title>Fitzrovia Agent</title>"
                "<body style=\"font-family:Poppins,system-ui,sans-serif;text-align:center;"
                "padding:64px;color:#1c2430\">"
                f"<h1 style=\"color:#f0641e\">{title}</h1><p style=\"color:#5b6573\">{msg}</p>"
                "<script>setTimeout(function(){window.close()},1500)</script></body>"
            )
            self.wfile.write(body.encode("utf-8"))

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/callback":
                self._html(404, "Not found", "")
                return
            q = urllib.parse.parse_qs(parsed.query)
            token = (q.get("token") or [None])[0]
            akey = (q.get("akey") or [None])[0]
            state = (q.get("state") or [None])[0]
            if not token or state != pairing.state:
                self._html(400, "Pairing failed", "Invalid or expired request. Restart the agent and try again.")
                return
            pairing.token = token
            pairing.akey = akey
            self._html(200, "✓ Connected", "The Fitzrovia Agent is linked to your account. You can close this tab.")
            pairing.done.set()

    return Handler


def pair(authorize_url: str, *, open_browser: bool = True) -> dict:
    """Run one interactive pairing round. Returns + stores {worker_token, anthropic_key}."""
    if not authorize_url:
        raise RuntimeError(
            "pairing needs the website authorize URL — set AGENT_AUTHORIZE_URL "
            "(e.g. https://your-site/authorize.html)")

    state = secrets.token_urlsafe(24)
    pairing = _Pairing(state)
    server = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(pairing))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    sep = "&" if "?" in authorize_url else "?"
    url = f"{authorize_url}{sep}port={port}&state={urllib.parse.quote(state)}"
    log.info("opening browser to authorize this device…")
    print(f"\n  Authorize this agent in your browser:\n    {url}\n")
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    got = pairing.done.wait(PAIR_TIMEOUT_SECONDS)
    server.shutdown()
    if not got or not pairing.token:
        raise TimeoutError("pairing timed out — no authorization received")

    _save(KEY_TOKEN, pairing.token)
    if pairing.akey:
        _save(KEY_AKEY, pairing.akey)
    log.info("device paired ✓")
    return {"worker_token": pairing.token, "anthropic_key": pairing.akey}


def _env(names) -> str | None:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return None


def get_credentials(authorize_url: str = "", *, interactive: bool = True) -> dict:
    """Resolve {worker_token, anthropic_key}: env override → keychain → pairing."""
    token = _env(_ENV_TOKEN_NAMES) or _load(KEY_TOKEN)
    akey = _env(_ENV_AKEY_NAMES) or _load(KEY_AKEY)

    if token and akey:
        return {"worker_token": token, "anthropic_key": akey}

    if interactive:
        bundle = pair(authorize_url)              # fills both
        token = token or bundle.get("worker_token")
        akey = akey or bundle.get("anthropic_key")

    return {"worker_token": token, "anthropic_key": akey}
