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

import logging
import os
import subprocess
import sys
import tempfile

log = logging.getLogger("agent.updater")

REPO = os.getenv("AGENT_UPDATE_REPO", "fdeighton/rent_scraper_handoff")
# Windows: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP — installer survives our exit.
_DETACHED = 0x00000008 | 0x00000200


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
        if not _is_newer(latest, current_version):
            return False
        asset = next((a for a in rel.get("assets", [])
                      if (a.get("name") or "").lower().endswith(".exe")), None)
        if not asset:
            log.warning("update %s available but no .exe asset found", latest)
            return False

        log.info("update available: %s -> %s — downloading %s",
                 current_version, latest, asset["name"])
        dl = httpx.get(asset["browser_download_url"], follow_redirects=True, timeout=180)
        dl.raise_for_status()
        path = os.path.join(tempfile.gettempdir(), asset["name"])
        with open(path, "wb") as f:
            f.write(dl.content)

        # Launch the installer silently + detached; it kills this agent, installs, relaunches.
        subprocess.Popen(
            [path, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"],
            creationflags=_DETACHED, close_fds=True,
        )
        log.info("update launched (%s) — exiting so the installer can take over", latest)
        return True
    except Exception as e:
        log.warning("update check failed (continuing on current version): %s", e)
        return False
