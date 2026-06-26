# Headless Fitzrovia Agent (runs the loop + comps handler; no tray, no ports).
# Build from the REPO ROOT so the engine (code/) is in context:
#   docker build -f agent/Dockerfile -t fitzrovia-agent .
#   docker run -d --restart=unless-stopped --env-file agent/.env fitzrovia-agent
#
# Outbound-only: it dials the hub API, nothing connects in — do NOT publish ports.
# NOTE: match the Playwright base-image tag to the `playwright` version in
# code/requirements.txt (or the `playwright install` below realigns the browser).
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /opt/fitzrovia
ENV PYTHONUNBUFFERED=1 HEADLESS=true

# Engine deps (playwright / anthropic / httpx / curl_cffi / dotenv …). Tray extras
# (pystray/pillow) are intentionally NOT installed — headless needs no GUI.
COPY code/requirements.txt code/requirements.txt
RUN pip install --no-cache-dir -r code/requirements.txt \
    && python -m playwright install chromium

# App: the scraper engine + the agent. (Frontend/seed/tools excluded via .dockerignore.)
COPY code/ code/
COPY agent/ agent/

CMD ["python", "agent/main.py"]
