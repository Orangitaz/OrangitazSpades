#!/usr/bin/env bash
# Prepare a release: sets the version and release notes in spades.html and version.json together,
# runs the tests and commits. After you push, GitHub builds the APK and publishes the release by itself
# (within 6 hours, or straight away via Actions > Build Android APK > Run workflow, tick "publish").
#
#   scripts/release.sh 1.1.0 "Board view, hints, difficulty levels"
#   git push origin main
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: scripts/release.sh <version, e.g. 1.2.0> \"<release notes>\"" >&2
  exit 1
fi
VER="$1"
NOTES="$2"
[[ "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version must look like 1.2.3" >&2; exit 1; }

cd "$(dirname "$0")/.."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "You have uncommitted changes. Commit or stash them first." >&2
  exit 1
fi
if git ls-remote --exit-code --tags origin "refs/tags/v$VER" >/dev/null 2>&1; then
  echo "Release v$VER already exists on GitHub. Pick a new version number." >&2
  exit 1
fi

python3 - "$VER" "$NOTES" <<'PY'
import json, re, sys
ver, notes = sys.argv[1], sys.argv[2]
html = open('spades.html', encoding='utf-8').read()
html, n = re.subn(r"const APP_VERSION='[^']*'", f"const APP_VERSION='{ver}'", html)
if n != 1:
    sys.exit("Could not find APP_VERSION in spades.html")
open('spades.html', 'w', encoding='utf-8').write(html)
info = json.load(open('version.json', encoding='utf-8'))
info['version'] = ver
info['notes'] = notes
with open('version.json', 'w', encoding='utf-8') as f:
    json.dump(info, f, indent=2, ensure_ascii=False)
    f.write('\n')
PY

node --test tests/spades.test.js

git add spades.html version.json
git commit -m "Release v$VER"
echo
echo "Release v$VER is committed. Publish it with:"
echo "  git push origin main"
echo "GitHub then builds the APK and publishes the release within minutes,"
echo "or right away if you run the workflow by hand and tick \"publish\"."
