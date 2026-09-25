#!/usr/bin/env bash
# =============================================================================
# scripts/gba-library.sh — build the ROM list of the terminal's GBA emulator
#
#   ./scripts/gba-library.sh [ROMS_DIR]      (default: /opt/50bvd-files/roms)
#
# Writes ROMS_DIR/roms.json from the .gba / .zip files in ROMS_DIR. That
# folder is mounted read-only in the Apache containers at /assets/roms/
# (docker-compose.50bvd.yml) and _config.perso.yml points the emulator to
# /assets/roms/roms.json. Run automatically by deploy.sh; run it by hand after
# adding or removing ROMs (no rebuild needed — the list is read live).
#
# Display name: the file name, "_" and "-" turned into spaces
# ("Super_Game-v1.2.gba" → "Super Game v1.2"). To choose names yourself,
# add a line "file.gba = Display name" to ROMS_DIR/names.txt.
#
# Only put there games you are allowed to share (homebrew, public domain,
# your own creations): the files are downloadable by every visitor.
# =============================================================================
set -euo pipefail

DIR="${1:-${ROMS_DIR:-/opt/50bvd-files/roms}}"
[ -d "$DIR" ] || { echo "No ROM folder: $DIR (create it and put .gba / .zip files in it)"; exit 0; }

json_escape() { local s=${1//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s" | tr -d '\000-\037'; }

custom_name() {
  [ -f "$DIR/names.txt" ] || return 1
  local line
  line=$(grep -F -m1 -- "$1 =" "$DIR/names.txt" || true)
  [ -n "$line" ] || return 1
  printf '%s' "${line#*= }"
}

# Files copied by hand (scp, root umask 077…) are often unreadable by the
# Apache user (HTTP 403 in the emulator): make the folder and ROMs readable.
chmod 755 "$DIR"
find "$DIR" -maxdepth 1 -type f \( -iname '*.gba' -o -iname '*.zip' -o -name names.txt \) -exec chmod 644 {} +

tmp=$(mktemp "$DIR/.roms.json.XXXXXX")
{
  echo '{ "roms": ['
  first=1
  while IFS= read -r -d '' f; do
    file=$(basename "$f")
    size=$(stat -c %s "$f")
    name=$(custom_name "$file" || true)
    [ -n "$name" ] || name=$(printf '%s' "${file%.*}" | tr '_-' '  ' | tr -s ' ')
    ext=${file##*.}; ext=${ext,,}
    [ $first -eq 1 ] || echo ','
    first=0
    printf '  { "name": "%s", "file": "%s", "size": %s, "info": "%s" }' \
      "$(json_escape "$name")" "$(json_escape "$file")" "$size" "$ext"
  done < <(find "$DIR" -maxdepth 1 -type f \( -iname '*.gba' -o -iname '*.zip' \) -print0 | sort -z)
  echo
  echo '] }'
} > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$DIR/roms.json"
echo "roms.json: $(grep -c '"file"' "$DIR/roms.json" || true) ROM(s) listed in $DIR"
