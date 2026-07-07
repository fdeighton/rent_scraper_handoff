"""job_complete additive-arg cascade (raw_content, qa) in agent/hub_client.py."""
import httpx

from hub_client import SupabaseHubClient


def _pgrst202():
    req = httpx.Request("POST", "https://x/rpc/job_complete")
    resp = httpx.Response(404, text='{"code":"PGRST202","message":"Could not find the function"}',
                          request=req)
    return httpx.HTTPStatusError("404", request=req, response=resp)


def _client(rpc):
    c = SupabaseHubClient("https://x.supabase.co", "anon-key", "worker-token")
    c._rpc = rpc
    c._job_types["j"] = "comps_scrape"
    return c


def test_full_schema_first_try():
    calls = []
    c = _client(lambda fn, p: calls.append(dict(p)))
    c.complete("j", "w", {"units": [1], "incentives": "x", "raw_content": "y",
                          "qa": {"status": "ok", "reason": "r"}})
    assert len(calls) == 1 and "p_qa" in calls[0] and "p_raw_content" in calls[0]


def test_falls_back_when_p_qa_missing():
    calls = []

    def rpc(fn, p):
        calls.append(dict(p))
        if "p_qa" in p:
            raise _pgrst202()
    c = _client(rpc)
    c.complete("j", "w", {"units": [], "raw_content": "y", "qa": {"status": "warn", "reason": "r"}})
    assert len(calls) == 2 and "p_qa" in calls[0] and "p_qa" not in calls[1] and "p_raw_content" in calls[1]


def test_falls_back_to_base_when_both_missing():
    calls = []

    def rpc(fn, p):
        calls.append(dict(p))
        if "p_raw_content" in p or "p_qa" in p:
            raise _pgrst202()
    c = _client(rpc)
    c.complete("j", "w", {"units": [], "raw_content": "y", "qa": {"status": "ok", "reason": "r"}})
    assert "p_raw_content" not in calls[-1] and "p_qa" not in calls[-1]


def test_no_qa_skips_the_qa_attempt():
    calls = []
    c = _client(lambda fn, p: calls.append(dict(p)))
    c.complete("j", "w", {"units": [], "raw_content": "y"})     # qa is None
    assert len(calls) == 1 and "p_qa" not in calls[0] and "p_raw_content" in calls[0]
