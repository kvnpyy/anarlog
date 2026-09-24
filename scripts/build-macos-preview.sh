#!/usr/bin/env bash
#
# Build a macOS app that can be shared privately before an Apple Developer
# account exists.
#
# Two separate mechanisms make an unsigned build unusable on a colleague's Mac,
# and both have to be handled:
#
#   1. Apple Silicon refuses to execute a Mach-O with no signature at all, so
#      the bundle is ad-hoc signed here ("-" identity). Ad-hoc satisfies the
#      kernel loader but carries no team identity, which is why library
#      validation has to be disabled for the bundled cloudsync dylib to load.
#   2. Gatekeeper reports "damaged and can't be opened" for any quarantined
#      bundle it cannot verify, and on macOS 15+ there is no right-click bypass
#      for that state. Quarantine is applied by the downloader, not the file, so
#      recipients fetch with curl (which never sets com.apple.quarantine)
#      instead of a browser.
#
# Replace this with the real signed + notarized pipeline in desktop_cd.yaml once
# the Developer ID certificate is available.

set -euo pipefail

CHANNEL="stable"
TARGET=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel)
      CHANNEL="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--channel stable|staging] [--target <rust-triple>] [--output <dir>]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this script builds a macOS bundle and must run on macOS." >&2
  exit 1
fi

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

if [[ -z "$TARGET" ]]; then
  case "$(uname -m)" in
    arm64) TARGET="aarch64-apple-darwin" ;;
    x86_64) TARGET="x86_64-apple-darwin" ;;
    *)
      echo "Error: unsupported architecture $(uname -m)." >&2
      exit 1
      ;;
  esac
fi

OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/dist-preview}"
SRC_TAURI="$REPO_ROOT/apps/desktop/src-tauri"
BASE_CONFIG="$SRC_TAURI/tauri.conf.$CHANNEL.json"
PREVIEW_CONFIG="$SRC_TAURI/tauri.conf.preview-local.json"
ENTITLEMENTS="$SRC_TAURI/Entitlements.plist"

if [[ ! -f "$BASE_CONFIG" ]]; then
  echo "Error: no Tauri config for channel '$CHANNEL' at $BASE_CONFIG" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$WORK_DIR"
  rm -f "$PREVIEW_CONFIG"
}
trap cleanup EXIT

echo "==> Building @anlg/ui"
pnpm -F ui build

echo "==> Preparing sidecar binaries for $TARGET"
TAURI_ENV_TARGET_TRIPLE="$TARGET" cargo xtask prepare-binaries

cp "$BASE_CONFIG" "$PREVIEW_CONFIG"
for sidecar in "binaries/char-chrome-native-host" "binaries/check-permissions" "resources/cli/anarlog-cli"; do
  "$REPO_ROOT/scripts/sidecar.sh" "$PREVIEW_CONFIG" "$sidecar"
done

# Only the .app is bundled here. Letting Tauri build the DMG would seal the
# unsigned bundle inside it, since signing happens after the bundler runs.
echo "==> Building the app bundle"
env -u APPLE_CERTIFICATE \
  -u APPLE_CERTIFICATE_PASSWORD \
  -u APPLE_ID \
  -u APPLE_PASSWORD \
  -u APPLE_SIGNING_IDENTITY \
  -u APPLE_TEAM_ID \
  -u APPLE_API_KEY \
  -u APPLE_API_ISSUER \
  pnpm -F desktop tauri build \
  --target "$TARGET" \
  --config "./src-tauri/tauri.conf.preview-local.json" \
  --bundles app \
  --no-sign

BUNDLE_DIR="$SRC_TAURI/target/$TARGET/release/bundle/macos"
shopt -s nullglob
APPS=("$BUNDLE_DIR"/*.app)
shopt -u nullglob

if [[ ${#APPS[@]} -ne 1 ]]; then
  echo "Error: expected exactly one .app in $BUNDLE_DIR, found ${#APPS[@]}." >&2
  exit 1
fi

APP="${APPS[0]}"
APP_NAME=$(basename "$APP" .app)

PREVIEW_ENTITLEMENTS="$WORK_DIR/Entitlements.preview.plist"
cp "$ENTITLEMENTS" "$PREVIEW_ENTITLEMENTS"
# PlistBuddy rather than plutil: plutil treats dots in a key as a keypath.
/usr/libexec/PlistBuddy \
  -c "Add :com.apple.security.cs.disable-library-validation bool true" \
  "$PREVIEW_ENTITLEMENTS" > /dev/null

echo "==> Ad-hoc signing $APP_NAME.app"
# Nested code first: a bundle signature is invalidated by anything signed after it.
while IFS= read -r -d '' candidate; do
  if file --brief "$candidate" | grep -q "Mach-O"; then
    codesign --force --sign - \
      --timestamp=none \
      --options runtime \
      --entitlements "$PREVIEW_ENTITLEMENTS" \
      "$candidate"
  fi
done < <(find "$APP/Contents" -type f -print0)

codesign --force --sign - \
  --timestamp=none \
  --options runtime \
  --entitlements "$PREVIEW_ENTITLEMENTS" \
  "$APP"

codesign --verify --deep --strict --verbose=2 "$APP"

echo "==> Packaging the disk image"
mkdir -p "$OUTPUT_DIR"
VOLUME_NAME="$APP_NAME Preview"
DMG_PATH="$OUTPUT_DIR/$APP_NAME-preview-${TARGET%%-*}.dmg"
STAGE_DIR="$WORK_DIR/stage"

mkdir -p "$STAGE_DIR"
cp -R "$APP" "$STAGE_DIR/"
ln -s /Applications "$STAGE_DIR/Applications"

rm -f "$DMG_PATH"
hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGE_DIR" \
  -format UDZO \
  -quiet \
  "$DMG_PATH"

codesign --force --sign - --timestamp=none "$DMG_PATH"

CHECKSUM=$(shasum -a 256 "$DMG_PATH" | cut -d ' ' -f 1)

cat <<INSTRUCTIONS

Built: $DMG_PATH
SHA-256: $CHECKSUM

This build is ad-hoc signed, not notarized. Upload the DMG somewhere that
serves a direct file URL, then send testers these commands. curl is what makes
this work: it does not set the quarantine attribute, so Gatekeeper never marks
the app as damaged.

  curl -fL -o ~/Downloads/$(basename "$DMG_PATH") "<DOWNLOAD_URL>"
  shasum -a 256 ~/Downloads/$(basename "$DMG_PATH")   # expect $CHECKSUM
  hdiutil attach ~/Downloads/$(basename "$DMG_PATH")
  cp -R "/Volumes/$VOLUME_NAME/$APP_NAME.app" /Applications/
  hdiutil detach "/Volumes/$VOLUME_NAME"
  open -a "$APP_NAME"

If someone downloads through a browser anyway, quarantine is already attached
and they need to clear it before the app will open:

  xattr -dr com.apple.quarantine /Applications/$APP_NAME.app

INSTRUCTIONS
