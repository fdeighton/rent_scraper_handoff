#!/usr/bin/env python3
"""
Mint AND register a scoped `scrape_worker` JWT locally — the same thing the hub's
issue_worker_token edge function does — so a HEADLESS / dev agent can run WITHOUT
browser pairing.

The Supabase project enforces a token registry: the worker RPCs reject any token whose
`jti` isn't live in `public.scrape_worker_tokens` ("worker token is not live"). So this
tool (1) signs an HS256 token with WORKER_JWT_SECRET carrying a UUID `sub` + `jti`, and
(2) inserts that `jti` into `scrape_worker_tokens` via the service_role key. Both come
from code/.env. Prints the token to stdout.

Put the token in code/.env as SCRAPE_WORKER_TOKEN. The agent also needs
NEXT_PUBLIC_SUPABASE_ANON_KEY in code/.env (the required Supabase apikey header).

Usage:
    python code/tools/mint_worker_token.py            # 180-day token
    python code/tools/mint_worker_token.py 30         # custom TTL (days)

Revoke later:  select revoke_worker_token('<jti>');  (or delete the row)
NOTE: dev/headless convenience. Production pairing goes through the edge function.
"""
import base64
import datetime
import hashlib
import hmac
import json
import os
import sys
import uuid

import httpx
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))     # code/.env

secret = os.environ.get("WORKER_JWT_SECRET")
url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
svc = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
if not (secret and url and svc):
    sys.exit("Need WORKER_JWT_SECRET, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in code/.env.")

days = int(sys.argv[1]) if len(sys.argv) > 1 else 180
now = datetime.datetime.now(datetime.timezone.utc)
exp = now + datetime.timedelta(days=days)
jti = str(uuid.uuid4())
sub = os.environ.get("WORKER_SUB") or str(uuid.uuid4())     # must be a UUID (RPCs cast it)


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "role": "scrape_worker",      # PostgREST switches into this scoped role
    "iss": "supabase",
    "sub": sub,                   # UUID; the agent claims under this as worker_id
    "jti": jti,                   # must be registered live (below)
    "iat": int(now.timestamp()),
    "exp": int(exp.timestamp()),
}
signing_input = (f"{_b64(json.dumps(header, separators=(',', ':')).encode())}."
                 f"{_b64(json.dumps(payload, separators=(',', ':')).encode())}")
sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
token = f"{signing_input}.{_b64(sig)}"

# Register the jti so `_assert_worker_token_live` accepts it (what the edge fn does).
r = httpx.post(
    f"{url}/rest/v1/scrape_worker_tokens",
    headers={"apikey": svc, "Authorization": f"Bearer {svc}",
             "Content-Type": "application/json", "Prefer": "return=minimal"},
    json={"jti": jti, "user_email": os.environ.get("WORKER_EMAIL", "dev-headless@fitzrovia.ca"),
          "tool_id": "comps", "issued_at": now.isoformat(), "expires_at": exp.isoformat()},
    timeout=30,
)
if r.status_code not in (200, 201, 204):
    sys.exit(f"Failed to register jti in scrape_worker_tokens: {r.status_code} {r.text[:200]}")

print(f"# registered scrape_worker token — sub={sub} jti={jti} · {days}d", file=sys.stderr)
print(f"# add to code/.env:  SCRAPE_WORKER_TOKEN=<the line below>  (revoke: select revoke_worker_token('{jti}'))",
      file=sys.stderr)
print(token)
