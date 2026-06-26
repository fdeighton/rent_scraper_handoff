#!/usr/bin/env bash
# Build the Fitzrovia Agent macOS app + .dmg.
#
#   cd agent
#   ./build/build_macos.sh 0.1.0 "https://<ref>.supabase.co" "https://your-site/authorize.html"
#
# Produces: agent/dist/FitzroviaAgent.app  and  agent/build/FitzroviaAgent-<version>.dmg
# Prereqs:  pip install -r requirements.txt pyinstaller ; brew install create-dmg
# NOTE: only NON-secret config is baked in (token + key come via pairing at runtime).
set -euo pipefail

VERSION="${1:-0.1.0}"
SUPABASE_URL="${2:?usage: build_macos.sh <version> <supabase_url> <authorize_url>}"
AUTHORIZE_URL="${3:?usage: build_macos.sh <version> <supabase_url> <authorize_url>}"

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$AGENT_DIR"

echo "1/4  Baking non-secret config -> build/agent.env"
cat > build/agent.env <<EOF
SUPABASE_URL=$SUPABASE_URL
AGENT_AUTHORIZE_URL=$AUTHORIZE_URL
AGENT_VERSION=$VERSION
HEADLESS=true
EOF

echo "2/4  Preparing icon (build/icon-1024.png; source asset left untouched)"
python - <<'PY'
from PIL import Image
Image.open('assets/icon.png').resize((1024, 1024)).save('build/icon-1024.png')
PY
# (For a real .icns: build an .iconset from build/icon-1024.png and run `iconutil -c icns`.
#  PyInstaller also accepts a .png icon directly.)

echo "3/4  PyInstaller bundle"
pyinstaller build/agent.spec --noconfirm --windowed --distpath dist --workpath build/work

echo "4/4  .dmg"
create-dmg "build/FitzroviaAgent-${VERSION}.dmg" "dist/FitzroviaAgent.app" || \
  echo "create-dmg not installed? brew install create-dmg"

echo "Done. Next: codesign + notarize the .app/.dmg, host it, and paste the URL into app/config.js agentDownload.mac"
