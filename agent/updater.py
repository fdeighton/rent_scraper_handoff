"""
Silent self-update for the installed agent.

On startup the (frozen) agent asks GitHub for the latest release; if it's newer than
this build's baked version, it downloads that installer, launches it silently +
detached, and returns True so the caller exits. The installer then kills the running
agent (installer.iss PrepareToInstall), installs the new files, and relaunches it.

Only runs for the packaged (frozen) build — never during a `python agent/...` dev run.
Any failure is swallowed (logged) so a bad update check never stops the agent starting.

Release discipline this relies on: each release must BUMP the version and publish a NEW
tag (agent-vX.Y.Z) — not overwrite an existing one — so "latest" advances.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import time

log = logging.getLogger("agent.updater")

REPO = os.getenv("AGENT_UPDATE_REPO", "fdeighton/rent_scraper_handoff")
# Windows: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP — installer survives our exit.
_DETACHED = 0x00000008 | 0x00000200

# Persistent state (log + attempt marker) so update behaviour is diagnosable and can't
# hammer: we won't re-attempt the SAME version within the cooldown window.
STATE_DIR = os.path.join(os.environ.get("LOCALAPPDATA") or tempfile.gettempdir(), "FitzroviaAgent")
LOG_PATH = os.path.join(STATE_DIR, "update.log")
MARKER_PATH = os.path.join(STATE_DIR, "update-attempt.json")
INSTALL_LOG = os.path.join(STATE_DIR, "install.log")
COOLDOWN_SECONDS = 900   # don't relaunch the installer for the same version within 15 min


def _ulog(msg: str) -> None:
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}\n")
    except Exception:
        pass
    log.info(msg)


def _recently_attempted(version: str) -> bool:
    try:
        with open(MARKER_PATH, encoding="utf-8") as f:
            m = json.load(f)
        return m.get("version") == version and (time.time() - float(m.get("ts", 0))) < COOLDOWN_SECONDS
    except Exception:
        return False


def _mark_attempt(version: str) -> None:
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(MARKER_PATH, "w", encoding="utf-8") as f:
            json.dump({"version": version, "ts": time.time()}, f)
    except Exception:
        pass


def _parse(v: str) -> tuple:
    v = (v or "").strip()
    for pre in ("agent-", "v"):
        if v.startswith(pre):
            v = v[len(pre):]
    out = []
    for p in v.split("."):
        try:
            out.append(int(p))
        except ValueError:
            out.append(0)
    return tuple(out) or (0,)


def _is_newer(latest: str, current: str) -> bool:
    return _parse(latest) > _parse(current)


def check_and_update(current_version: str) -> bool:
    """Return True if a newer installer was launched (caller should exit immediately)."""
    if not getattr(sys, "frozen", False):
        return False                      # dev run — never self-update
    try:
        import httpx
        r = httpx.get(f"https://api.github.com/repos/{REPO}/releases/latest",
                      headers={"Accept": "application/vnd.github+json"}, timeout=10)
        r.raise_for_status()
        rel = r.json()
        latest = rel.get("tag_name") or ""
        _ulog(f"check: current={current_version} latest={latest}")
        if not _is_newer(latest, current_version):
            return False
        if _recently_attempted(latest):
            _ulog(f"skip: already attempted {latest} within cooldown ({COOLDOWN_SECONDS}s)")
            return False
        asset = next((a for a in rel.get("assets", [])
                      if (a.get("name") or "").lower().endswith(".exe")), None)
        if not asset:
            _ulog(f"update {latest} available but no .exe asset found")
            return False

        _ulog(f"downloading {asset['name']} ({current_version} -> {latest})")
        dl = httpx.get(asset["browser_download_url"], follow_redirects=True, timeout=180)
        dl.raise_for_status()
        path = os.path.join(tempfile.gettempdir(), asset["name"])
        with open(path, "wb") as f:
            f.write(dl.content)

        # Record the attempt BEFORE launching so a failed install can't hammer every tick.
        _mark_attempt(latest)
        # Launch the installer silently + detached; it kills this agent (by name, NOT its
        # process tree — see installer.iss), installs, relaunches. /LOG captures its side.
        subprocess.Popen(
            [path, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", f"/LOG={INSTALL_LOG}"],
            creationflags=_DETACHED, close_fds=True,
        )
        _ulog(f"installer launched ({latest}) — exiting so it can take over")
        return True
    except Exception as e:
        _ulog(f"update check failed (continuing on current version): {e}")
        return False
