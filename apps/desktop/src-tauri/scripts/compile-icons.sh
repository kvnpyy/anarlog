#!/bin/bash
# Compile PNG app-icon sources into AppIcon.icns with iconutil.
# Only runs on macOS — other platforms don't need .icns resources.
#
# We ship flat PNG-derived icons rather than Icon Composer Assets.car:
# macOS 26 would otherwise re-render the iconstack with Liquid Glass,
# which does not match the Dock icon the app sets at runtime (plugins/icon).

set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Skipping icon compilation (not macOS)"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_TAURI="$(cd "$SCRIPT_DIR/.." && pwd)"
ICONS_SRC="$SRC_TAURI/icons/src"
RESOURCES="$SRC_TAURI/resources"
PREVIEWS="$SRC_TAURI/../public/assets/app-icons"

compile_icns() {
  local source_image="$1"
  local output_icon="$2"

  local tmp_dir
  tmp_dir=$(mktemp -d)
  local iconset="$tmp_dir/AppIcon.iconset"
  mkdir -p "$iconset"
  trap "rm -rf '$tmp_dir'" RETURN

  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$source_image" \
      --out "$iconset/icon_${size}x${size}.png" >/dev/null
    local retina_size=$((size * 2))
    sips -z "$retina_size" "$retina_size" "$source_image" \
      --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
  done

  iconutil -c icns "$iconset" -o "$output_icon"
  rm -rf "$tmp_dir"
  trap - RETURN
}

compile_png_icon() {
  local source_image="$1"
  local variant="$2"
  local preview_image="$3"

  if [[ ! -f "$source_image" ]]; then
    echo "Warning: $source_image not found, skipping"
    return
  fi

  local output_dir="$RESOURCES/$variant"
  local output_icon="$output_dir/AppIcon.icns"
  mkdir -p "$output_dir"

  if [[ ! -f "$output_icon" ]]; then
    echo "Compiling $variant icon..."
    compile_icns "$source_image" "$output_icon"
  else
    echo "Skipping $variant (AppIcon.icns already exists)"
  fi

  if [[ ! -f "$preview_image" ]]; then
    echo "Generating $variant preview..."
    sips -z 128 128 "$source_image" --out "$preview_image" >/dev/null
  fi
}

# name, source png, preview png
PNG_ICONS=(
  "stable|$ICONS_SRC/anarlog-prod.png|$PREVIEWS/stable-light.png"
  "stable-dark|$ICONS_SRC/anarlog-prod-dark.png|$PREVIEWS/stable-dark.png"
  "dev|$ICONS_SRC/anarlog-dev.png|$PREVIEWS/dev-light.png"
  "dev-dark|$ICONS_SRC/anarlog-dev-dark.png|$PREVIEWS/dev-dark.png"
  "staging|$ICONS_SRC/anarlog-staging.png|$PREVIEWS/staging-light.png"
  "staging-dark|$ICONS_SRC/anarlog-staging-dark.png|$PREVIEWS/staging-dark.png"
  "squirrel|$ICONS_SRC/anarlog-squirrel.png|$PREVIEWS/squirrel-light.png"
  "squirrel-dark|$ICONS_SRC/anarlog-squirrel-dark.png|$PREVIEWS/squirrel-dark.png"
  "journal|$ICONS_SRC/anarlog-journal.png|$PREVIEWS/journal.png"
  "notepad|$ICONS_SRC/anarlog-notepad.png|$PREVIEWS/notepad.png"
  "stone|$ICONS_SRC/anarlog-stone.png|$PREVIEWS/stone.png"
  "typewriter-key|$ICONS_SRC/anarlog-typewriter-key.png|$PREVIEWS/typewriter-key.png"
  "walnut|$ICONS_SRC/anarlog-walnut.png|$PREVIEWS/walnut.png"
)

for entry in "${PNG_ICONS[@]}"; do
  IFS='|' read -r variant source_image preview_image <<<"$entry"
  compile_png_icon "$source_image" "$variant" "$preview_image"
done

echo "Icon compilation complete"
