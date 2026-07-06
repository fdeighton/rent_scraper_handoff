import os
import sys

# Make the agent modules (runtime, hub_client, retry, hub_extractor) importable in tests,
# plus the engine under code/ (extractor/fetcher/pipeline) — the same paths the agent adds
# at runtime (see handlers/comps.py).
_AGENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # agent/
sys.path.insert(0, _AGENT)
sys.path.insert(0, os.path.join(os.path.dirname(_AGENT), "code"))      # code/ engine
