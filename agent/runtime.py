"""
Agent runtime — the generic execution loop. Knows nothing about scraping.

It registers, polls the hub for a job whose task_type it can handle, dispatches to
the matching handler, relays progress/heartbeats, and reports the result. Adding a
new AI Studio tool = registering another handler; the loop is untouched.

A handler is a plain callable:  handle(payload: dict, ctx: HandlerContext) -> dict
It should call ctx.progress(...) as it works and ctx.should_cancel() in long phases;
raise JobCancelled to abort cleanly.
"""
from __future__ import annotations

import logging
import signal
import time
from typing import Callable

from hub_client import HubClient

log = logging.getLogger("agent")

Handler = Callable[[dict, "HandlerContext"], dict]


class JobCancelled(Exception):
    """Raised by a handler when the hub has requested cancellation."""


class HandlerContext:
    """Handed to a handler so it can report progress + check for cancellation
    without knowing about the hub transport. should_cancel() is throttled so the
    long phases (e.g. the LLM stream) can poll it freely between tokens."""

    def __init__(self, hub: HubClient, job_id: str, agent_id: str, heartbeat_every: float = 8.0):
        self._hub = hub
        self._job_id = job_id
        self._agent_id = agent_id
        self._every = heartbeat_every
        self._last = 0.0
        self._cancel = False

    def progress(self, progress: int | None = None, stage: str | None = None) -> bool:
        """Report progress + refresh the lease now. Returns True if cancel requested."""
        self._cancel = self._hub.progress(self._job_id, self._agent_id, progress, stage)
        self._last = time.monotonic()
        return self._cancel

    def should_cancel(self) -> bool:
        """Cheap, throttled cancel check (also doubles as a heartbeat). Safe to call
        in tight loops — only hits the hub every `heartbeat_every` seconds."""
        now = time.monotonic()
        if now - self._last >= self._every:
            try:
                self._cancel = self._hub.progress(self._job_id, self._agent_id)
            except Exception as e:
                log.debug("progress/heartbeat poll failed: %s", e)
            self._last = now
        return self._cancel


class Agent:
    def __init__(self, hub: HubClient, agent_id: str, handlers: dict[str, Handler],
                 hostname: str | None = None, version: str | None = None, poll_seconds: float = 5.0):
        self.hub = hub
        self.agent_id = agent_id
        self.handlers = handlers
        self.capabilities = list(handlers.keys())
        self.hostname = hostname
        self.version = version
        self.poll = poll_seconds
        self._stop = False
        self._fails = 0          # consecutive loop-RPC failures (see _watched)

    def run_forever(self) -> None:
        self._install_signals()
        # Registration is the first real RPC — if the token/anon-key/host is wrong it fails
        # HERE. Surface it loudly (not swallowed to debug) so a stuck agent is diagnosable.
        try:
            self.hub.register(self.agent_id, self.capabilities, self.hostname, self.version)
            log.info("agent %s registered — capabilities=%s poll=%.0fs", self.agent_id, self.capabilities, self.poll)
        except Exception:
            log.exception("agent %s: worker_register FAILED — will keep retrying in the loop; "
                          "no heartbeat will appear until this succeeds (check token/anon key/network)",
                          self.agent_id)
        self._fails = 0
        while not self._stop:
            job = self._watched("claim", lambda: self.hub.claim(self.agent_id, self.capabilities))
            if not job:
                # heartbeat also re-registers (worker_register) — its success is what makes a
                # worker show up in scrape_workers, so a persistent failure here IS the bug.
                self._watched("heartbeat", lambda: self.hub.heartbeat(self.agent_id))
                time.sleep(self.poll)
                continue
            self._handle(job)
        log.info("agent %s shutting down", self.agent_id)

    def _watched(self, label: str, fn, default=None):
        """Run a loop RPC, tracking consecutive failures. Logs the FIRST failure and then
        every 12th (~1/min at poll=5s) at ERROR, so an ongoing auth/DNS/token problem is
        visible in the log instead of hidden — without spamming every tick."""
        try:
            out = fn()
            if self._fails:
                log.info("%s recovered after %d consecutive failure(s)", label, self._fails)
            self._fails = 0
            return out
        except Exception as e:
            self._fails += 1
            if self._fails == 1 or self._fails % 12 == 0:
                log.error("%s FAILED (%d in a row): %s", label, self._fails, e)
            else:
                log.debug("%s failed (%d): %s", label, self._fails, e)
            return default

    def run_once(self) -> bool:
        """Claim + run a single job if one is available. Returns True if it ran one.
        Used by tests / dev_run to exercise the loop deterministically."""
        job = self.hub.claim(self.agent_id, self.capabilities)
        if not job:
            return False
        self._handle(job)
        return True

    def _handle(self, job: dict) -> None:
        jid, ttype = job.get("id"), job.get("task_type")
        handler = self.handlers.get(ttype)
        if handler is None:
            log.error("job %s: no handler for task_type=%s", jid, ttype)
            self._safe(lambda: self.hub.fail(jid, self.agent_id, f"no handler for task_type '{ttype}'"))
            return
        log.info("job %s claimed (task=%s)", jid, ttype)
        ctx = HandlerContext(self.hub, jid, self.agent_id)
        try:
            result = handler(job.get("payload") or {}, ctx)
            self.hub.complete(jid, self.agent_id, result)
            log.info("job %s done", jid)
        except JobCancelled:
            log.info("job %s cancelled", jid)
            self._safe(lambda: self.hub.cancel(jid, self.agent_id))
        except Exception as e:
            log.exception("job %s failed", jid)
            # Only requeue TRANSIENT failures (429/timeout/DNS/5xx). Fatal ones
            # (auth/404/protected/credit) would just re-fail in a loop, so let them
            # terminate — surfaced for human review instead of burning re-scrapes.
            from retry import is_transient
            requeue = is_transient(e)
            self._safe(lambda: self.hub.fail(jid, self.agent_id, str(e), requeue=requeue))

    def _install_signals(self) -> None:
        def _h(signum, _frame):
            log.info("signal %s — finishing current job then exiting", signum)
            self._stop = True
        for s in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(s, _h)
            except (ValueError, OSError):
                pass

    @staticmethod
    def _safe(fn, default=None):
        try:
            return fn()
        except Exception as e:
            log.debug("non-fatal: %s", e)
            return default
