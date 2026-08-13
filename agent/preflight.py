"""
Network preflight — fail LOUD (in the log) when the agent can't reach its backends.

The target machines are managed (DNS filter + SentinelOne + RMM). The updater's history
showed repeated `getaddrinfo failed`, i.e. DNS resolution was being blocked — but the
runtime never checked, so a blocked host just looked like a silent no-heartbeat. This
resolves + TCP-connects to the given hosts and returns a list of human-readable problems
(empty = all good) so startup can log exactly which host is unreachable and why.
"""
from __future__ import annotations

import logging
import socket
from urllib.parse import urlsplit

log = logging.getLogger("agent.preflight")


def check_host(url: str, *, port: int = 443, timeout: float = 6.0) -> str | None:
    """Return None if the URL's host resolves AND accepts a TCP connection, else a
    one-line reason. Distinguishes DNS failure (allowlist/filter) from connect failure."""
    host = urlsplit(url).hostname if url else None
    if not host:
        return None                                  # nothing to check (unset config)
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        return (f"DNS resolution FAILED for {host} ({e}) — the machine's DNS filter is "
                f"likely blocking it; allowlist {host}.")
    except Exception as e:
        return f"could not resolve {host}: {e}"
    last = None
    for *_, sockaddr in infos:
        try:
            with socket.create_connection(sockaddr[:2], timeout=timeout):
                return None                          # resolved + reachable
        except Exception as e:
            last = e
    return (f"{host} resolves but TCP :{port} is unreachable ({last}) — a firewall/proxy "
            f"is likely blocking outbound HTTPS to it.")


def preflight(urls: dict[str, str]) -> list[str]:
    """Check each {label: url}; log OK/blocked per host; return the list of problems."""
    problems: list[str] = []
    for label, url in urls.items():
        if not url:
            continue
        why = check_host(url)
        if why:
            log.error("preflight: %s UNREACHABLE — %s", label, why)
            problems.append(f"{label}: {why}")
        else:
            log.info("preflight: %s reachable (%s)", label, urlsplit(url).hostname)
    return problems
