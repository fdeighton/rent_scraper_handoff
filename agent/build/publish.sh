#!/usr/bin/env bash
# Publish a built Fitzrovia Agent installer (.dmg) to GitHub Releases.
#
#   cd agent
#   ./build/publish.sh 0.1.0
#   ./build/publish.sh 0.1.0 build/FitzroviaAgent-0.1.0.dmg
#
# Creates/reuses the release tagged `agent-v<version>`, uploads the asset, and prints
# the public download URL to paste into app/config.js agentDownload.mac.
# Prereqs: `gh auth login` once. The installer carries NO secrets (safe to be public).
set -euo pipefail

VERSION="${1:?usage: publish.sh <version> [file]}"
REPO="fdeighton/rent_scraper_handoff"
AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$AGENT_DIR"

FILE="${2:-build/FitzroviaAgent-${VERSION}.dmg}"
[ -f "$FILE" ] || { echo "installer not found: $FILE (build it first: build/build_macos.sh)"; exit 1; }

TAG="agent-v${VERSION}"
ASSET="$(basename "$FILE")"

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Creating release $TAG"
  gh release create "$TAG" --repo "$REPO" --title "Fitzrovia Agent $VERSION" \
     --notes "Fitzrovia Agent $VERSION. Download, install, click Authorize once."
fi

echo "Uploading $ASSET"
gh release upload "$TAG" "$FILE" --repo "$REPO" --clobber

echo ""
echo "Published. Paste into app/config.js -> agentDownload.mac:"
echo "  https://github.com/$REPO/releases/download/$TAG/$ASSET"
