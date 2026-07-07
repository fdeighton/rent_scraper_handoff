#!/usr/bin/env python3
"""
Mint a scoped `scrape_worker` JWT locally — the SAME token shape the hub's
issue_worker_token edge function produces (see supabase/functions/issue_worker_token/
index.ts) — so a HEADLESS / dev agent can run WITHOUT browser pairing.

Reads WORKER_JWT_SECRET from code/.env, signs HS256, prints the token to stdout.
Put it in code/.env as SCRAPE_WORKER_TOKEN — the agent's env override then skips pairing
entirely (pairing.get_credentials resolves env before keychain/pairing).

Usage:
    python code/tools/mint_worker_token.py            # 180-day token, random worker sub
    python code/tools/mint_worker_token.py 30         # custom TTL (days)
    WORKER_SUB=my-mac python code/tools/mint_worker_token.py   # fixed worker id

NOTE: this is a dev/headless convenience. Production pairing still goes through the edge
function (secret stays server-side). The minted token is only as scoped as scrape_worker.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import uuid

from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))     # code/.env

secret = os.environ.get("WORKER_JWT_SECRET")
if not secret:
    sys.exit("WORKER_JWT_SECRET not found in code/.env — cannot mint a token.")

days = int(sys.argv[1]) if len(sys.argv) > 1 else 180
now = int(time.time())


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "role": "scrape_worker",       # PostgREST switches into this scoped role
    "iss": "supabase",
    "sub": os.environ.get("WORKER_SUB") or f"agent-{uuid.uuid4()}",
    "paired_by": "local-mint",
    "iat": now,
    "exp": now + days * 86400,
}
signing_input = (f"{_b64(json.dumps(header, separators=(',', ':')).encode())}."
                 f"{_b64(json.dumps(payload, separators=(',', ':')).encode())}")
sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
token = f"{signing_input}.{_b64(sig)}"

print(f"# scrape_worker token — sub={payload['sub']} · {days}d · signed with WORKER_JWT_SECRET",
      file=sys.stderr)
print("# add to code/.env:  SCRAPE_WORKER_TOKEN=<the line below>", file=sys.stderr)
print(token)
