"""Transient-retry classification + backoff loop (agent/retry.py)."""
import pytest

from retry import is_transient, run_with_retry


@pytest.mark.parametrize("msg", [
    "/extract 429: rate limited",
    "Anthropic API overloaded",
    "Timeout 30000ms exceeded",
    "page.goto: net::ERR_NAME_NOT_RESOLVED",
    "getaddrinfo failed",
    "503 Service Unavailable",
    "connection reset by peer",
])
def test_transient_true(msg):
    assert is_transient(Exception(msg))


@pytest.mark.parametrize("msg", [
    "404 page not found",
    "credit balance is too low",
    "401 unauthorized",
    "blocked/challenge page detected",
    "no units found",
])
def test_transient_false(msg):
    assert not is_transient(Exception(msg))


def test_fatal_beats_transient():
    # A 404 that also mentions "timeout" must NOT be retried (fail loud).
    assert not is_transient(Exception("404 page not found (after a timeout)"))


def test_succeeds_first_try():
    calls = []
    assert run_with_retry(lambda: calls.append(1) or "ok", backoff=(0, 0)) == "ok"
    assert len(calls) == 1


def test_retries_transient_then_succeeds():
    calls, seen = [], []

    def fn():
        calls.append(1)
        if len(calls) < 3:
            raise RuntimeError("429 rate limit")
        return "ok"

    assert run_with_retry(fn, backoff=(0, 0), on_retry=lambda *a: seen.append(a)) == "ok"
    assert len(calls) == 3 and len(seen) == 2      # two retries before success


def test_no_retry_on_fatal():
    calls = []

    def fn():
        calls.append(1)
        raise RuntimeError("404 page not found")

    with pytest.raises(RuntimeError):
        run_with_retry(fn, backoff=(0, 0))
    assert len(calls) == 1                          # failed loud, not retried


def test_exhausts_and_raises_last():
    calls = []

    def fn():
        calls.append(1)
        raise RuntimeError("overloaded")

    with pytest.raises(RuntimeError, match="overloaded"):
        run_with_retry(fn, attempts=3, backoff=(0, 0))
    assert len(calls) == 3                          # bounded at `attempts`
