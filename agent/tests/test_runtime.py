"""Agent runtime tests — exercise the loop against the in-memory MockHubClient.
No network, no DB, no scraper. Validates the generic execution layer."""
from hub_client import MockHubClient
from runtime import Agent, HandlerContext, JobCancelled


def _agent(hub, handlers):
    return Agent(hub, "test-agent", handlers, poll_seconds=0)


def test_complete_writes_result_and_marks_done():
    hub = MockHubClient()

    def handler(payload, ctx):
        ctx.progress(50, "working")
        return {"echo": payload}

    jid = hub.enqueue("echo", {"a": 1})
    assert _agent(hub, {"echo": handler}).run_once() is True
    j = hub.jobs[jid]
    assert j["status"] == "done" and j["progress"] == 100 and j["result"] == {"echo": {"a": 1}}


def test_cancel_path_marks_cancelled():
    hub = MockHubClient()

    def handler(payload, ctx):
        if ctx.progress(stage="checking"):     # hub requested cancel
            raise JobCancelled()
        return {}

    jid = hub.enqueue("echo", {})
    hub.request_cancel(jid)
    _agent(hub, {"echo": handler}).run_once()
    assert hub.jobs[jid]["status"] == "cancelled"


def test_capability_filter_skips_unknown_task():
    hub = MockHubClient()
    jid = hub.enqueue("other_task", {})
    assert _agent(hub, {"echo": lambda p, c: {}}).run_once() is False
    assert hub.jobs[jid]["status"] == "queued"     # never claimed


def test_handler_exception_records_error():
    hub = MockHubClient()

    def boom(payload, ctx):
        raise RuntimeError("kaboom")

    jid = hub.enqueue("echo", {})
    _agent(hub, {"echo": boom}).run_once()
    j = hub.jobs[jid]
    assert j["status"] == "error" and "kaboom" in (j["error"] or "")


def test_context_progress_relays_and_signals_cancel():
    hub = MockHubClient()
    jid = hub.enqueue("echo", {})
    hub.jobs[jid]["status"] = "running"
    ctx = HandlerContext(hub, jid, "test-agent")
    assert ctx.progress(10, "fetching") is False
    assert hub.jobs[jid]["progress"] == 10 and hub.jobs[jid]["stage"] == "fetching"
    hub.request_cancel(jid)
    assert ctx.progress() is True
