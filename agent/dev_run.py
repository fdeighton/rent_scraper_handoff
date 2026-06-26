#!/usr/bin/env python3
"""
Local end-to-end proof of the agent loop — NO hub, NO DB, NO API cost.

Uses MockHubClient + trivial handlers to exercise register -> claim -> dispatch ->
progress -> complete, and the cancel path. This validates the execution layer without
the scraper or the hub. (To run a REAL comps scrape locally, register the comps
handler with Anthropic creds — see the commented block at the bottom.)

Run:  cd agent && python dev_run.py
"""
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hub_client import MockHubClient            # noqa: E402
from runtime import Agent, JobCancelled         # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def echo_handler(payload, ctx):
    ctx.progress(20, "starting")
    ctx.progress(70, "working")
    return {"echo": payload}


def cancellable_handler(payload, ctx):
    if ctx.progress(stage="checking-cancel"):     # hub says cancel?
        raise JobCancelled()
    return {"ok": True}


def main():
    hub = MockHubClient()

    # 1) happy path: claim -> run -> complete
    agent = Agent(hub, "dev-agent", {"echo": echo_handler})
    jid = hub.enqueue("echo", {"hello": "world"})
    ran = agent.run_once()
    j = hub.jobs[jid]
    print(f"[complete] ran={ran} status={j['status']} progress={j['progress']} result={j['result']}")
    assert ran and j["status"] == "done" and j["result"] == {"echo": {"hello": "world"}}

    # 2) cancel path: hub requests cancel -> handler aborts -> status cancelled
    agent2 = Agent(hub, "dev-agent", {"echo": cancellable_handler})
    jid2 = hub.enqueue("echo", {"x": 1})
    hub.request_cancel(jid2)
    agent2.run_once()
    print(f"[cancel]   status={hub.jobs[jid2]['status']}")
    assert hub.jobs[jid2]["status"] == "cancelled"

    # 3) capability filter: a task this agent can't handle is never claimed (stays queued)
    jid3 = hub.enqueue("unknown_task", {})
    ran3 = Agent(hub, "dev-agent", {"echo": echo_handler}).run_once()
    print(f"[capability-filter] ran={ran3} status={hub.jobs[jid3]['status']}")
    assert ran3 is False and hub.jobs[jid3]["status"] == "queued"

    print("\nOK — execution loop verified (complete / cancel / capability-filter) with no hub, DB, or API calls.")

    # ---- OPTIONAL: run a REAL comps scrape locally -------------------------------
    # from handlers.comps import make_comps_handler, TASK_TYPE
    # key = os.environ.get("ANTHROPIC_API_KEY_RENT_COMPS") or os.environ.get("ANTHROPIC_API_KEY")
    # a = Agent(hub, "dev-agent", {TASK_TYPE: make_comps_handler(key, "claude-sonnet-4-6")})
    # jid = hub.enqueue(TASK_TYPE, {"url": "https://www.collegewest.com/suites", "name": "College West"})
    # a.run_once(); print(hub.jobs[jid]["result"])


if __name__ == "__main__":
    main()
