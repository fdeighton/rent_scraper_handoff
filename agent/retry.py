"""
Transient-error retry with backoff for the agent's scrape path (handoff Part 2 §G:
~80% of "red" clears on a bare retry).

`is_transient()` classifies an exception by the SAME vocabulary the hub audit regexes
(429/rate, overloaded, timeout, navigation/net::err, DNS, 5xx) so the agent retries the
cases that are worth retrying — and NOT the fail-loud ones (404 / page-not-found,
"credit balance" billing errors, auth). `run_with_retry()` retries only transient
failures, with bounded backoff, and re-raises the last error (still classifiable) so
job_fail carries the real cause.
"""
from __future__ import annotations

import re
import time

# Retry these — service/network hiccups that usually clear on their own.
_TRANSIENT_RE = re.compile(
    r"\b429\b|rate.?limit|overloaded|too many requests|timeout|timed out|"
    r"navigation|net::err|temporarily unavailable|getaddrinfo|"
    r"name or service not known|connection (?:reset|aborted|refused)|\b50[234]\b",
    re.I,
)
# NEVER retry these even if they co-occur — retrying won't help (fail loud instead).
_FATAL_RE = re.compile(r"page not found|\b404\b|credit balance|unauthorized|\b401\b|\b403\b", re.I)


def is_transient(err) -> bool:
    s = str(err)
    if _FATAL_RE.search(s):
        return False
    return bool(_TRANSIENT_RE.search(s))


def run_with_retry(fn, *, attempts: int = 3, backoff=(3, 9), on_retry=None):
    """Call fn(); on a TRANSIENT exception wait + retry up to `attempts` times.
    Non-transient exceptions raise immediately. `on_retry(i, attempts, wait, err)` is
    invoked before each backoff (used to log a WARNING + refresh the job lease)."""
    last = None
    for i in range(1, attempts + 1):
        try:
            return fn()
        except Exception as e:      # noqa: BLE001 — classify, then decide
            last = e
            if i < attempts and is_transient(e):
                wait = backoff[min(i - 1, len(backoff) - 1)]
                if on_retry:
                    on_retry(i, attempts, wait, e)
                time.sleep(wait)
                continue
            raise
    raise last                       # unreachable, but keeps type-checkers happy
