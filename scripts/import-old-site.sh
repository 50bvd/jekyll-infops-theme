#!/usr/bin/env bash
# =============================================================================
# scripts/import-old-site.sh — bring back what only lived on the old site
#
#   ./scripts/import-old-site.sh [OLD_SITE_DIR]      (default: /root/50bvd-site)
#
#   · images      old assets/images/ (covers, screenshots, avatar, logo…) are
#                 copied into assets/images/ — existing files are never overwritten
#   · Google      the Search Console verification code (meta tag, _config.yml
#                 or googleXXXX.html file) is written to _config.perso.yml
#   · Disqus      the old shortname is compared with _config.perso.yml
#
# Then review with `git status` and commit (see the end of the output), so the
# files are part of the site on every future deploy.
# =============================================================================
set -euo pipefail

OLD="${1:-/root/50bvd-site}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"
CONF="_config.perso.yml"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$OLD" ] || die "old site not found in $OLD — pass its path: $0 /path/to/old-site"
[ -f "$CONF" ] || die "$CONF not found — run this from the site/perso checkout"

# Sources to search: the old sources and, if present, its last build (_site)
SRC=("$OLD")
[ -d "$OLD/_site" ] && SRC+=("$OLD/_site")

# ── 1. Images ────────────────────────────────────────────────────────────────
log "Images"
copied=0
for s in "${SRC[@]}"; do
  [ -d "$s/assets/images" ] || continue
  before=$(find assets/images -type f 2>/dev/null | wc -l)
  mkdir -p assets/images
  cp -rn "$s/assets/images/." assets/images/ 2> >(grep -v 'non-portable' >&2)
  after=$(find assets/images -type f | wc -l)
  copied=$((copied + after - before))
done
[ "$copied" -gt 0 ] && ok "$copied file(s) copied into assets/images/" || warn "no new image found in $OLD/assets/images"

missing=0
while IFS= read -r p; do
  [ -f "${p#/}" ] || { warn "still missing: $p"; missing=$((missing + 1)); }
done < <(grep -hoE '^(image|image_light): */assets/[^ "]+' _posts/*.md | sed -E 's/^[a-z_]+: *//' | sort -u)
[ "$missing" -eq 0 ] && ok "all article covers are present"

# Screenshots referenced by the articles ({% include screenshot.html src="…" %})
shots=0; shots_missing=0
while IFS= read -r p; do
  shots=$((shots + 1))
  [ -f "${p#/}" ] || { warn "screenshot not found yet: $p"; shots_missing=$((shots_missing + 1)); }
done < <(grep -hoE 'include screenshot\.html src="[^"]+"' _posts/*.md | sed -E 's/.*src="([^"]+)"/\1/' | sort -u)
[ "$shots" -gt 0 ] && [ "$shots_missing" -eq 0 ] && ok "all $shots screenshots are present"

# Old images no article points to (rename them to a missing name above if they match)
unused=$(find assets/images -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o -name '*.gif' \) \
  | while read -r f; do grep -rqF "/$f" _posts _config.yml "$CONF" pages 2>/dev/null || echo "      $f"; done)
[ -n "$unused" ] && { warn "images not used by any article:"; echo "$unused"; }

# ── 2. Google Search Console ─────────────────────────────────────────────────
log "Google Search Console"
code=""
for s in "${SRC[@]}"; do
  [ -n "$code" ] && break
  code=$(grep -rhoE 'google-site-verification"[^>]*content="[^"]+"' \
           "$s/_layouts" "$s/_includes" "$s/index.html" "$s/_config.yml" 2>/dev/null \
         | head -1 | sed -E 's/.*content="([^"]+)".*/\1/' || true)
done
if [ -z "$code" ] && [ -f "$OLD/_config.yml" ]; then
  # google_site_verification: xxx   or   webmaster_verifications: / google: xxx
  code=$(grep -E '^\s*(google_site_verification|google):\s*' "$OLD/_config.yml" \
         | grep -v '^\s*#' | head -1 | sed -E 's/^[^:]+:\s*"?([^"#]+)"?.*/\1/' | tr -d ' ' || true)
  [ "$code" = "YOUR_CODE" ] && code=""
fi

if [ -n "$code" ]; then
  if grep -qE '^webmaster_verifications:' "$CONF"; then
    ok "already set in $CONF (left as is)"
  else
    # replace the commented example block by the real value
    tmp=$(mktemp)
    awk -v c="$code" '
      /^# webmaster_verifications:/ { print "webmaster_verifications:"; print "  google: \"" c "\""; skip=1; next }
      skip && /^#   google:/ { skip=0; next }
      { skip=0; print }
    ' "$CONF" > "$tmp" && cat "$tmp" > "$CONF" && rm -f "$tmp"
    grep -qE '^webmaster_verifications:' "$CONF" || printf '\nwebmaster_verifications:\n  google: "%s"\n' "$code" >> "$CONF"
    ok "code ${code:0:6}… written to $CONF"
  fi
else
  warn "no verification meta tag found in the old site"
fi

# HTML-file verification method (googleXXXXXXXX.html at the site root)
for s in "${SRC[@]}"; do
  for f in "$s"/google*.html; do
    [ -f "$f" ] || continue
    if [ ! -f "$(basename "$f")" ]; then cp "$f" . && ok "verification file $(basename "$f") copied"; fi
  done
done
[ -n "$code" ] || ls google*.html >/dev/null 2>&1 || warn "nothing found: get the code again in Search Console → Settings → Ownership verification → HTML tag (it is the same code)"

# ── 3. Disqus ────────────────────────────────────────────────────────────────
log "Disqus"
old_sn=$(grep -hE '^\s*(disqus_shortname|shortname):' "$OLD/_config.yml" 2>/dev/null | grep -v '^\s*#' | head -1 | sed -E 's/^[^:]+:\s*"?([^"#]+)"?.*/\1/' | tr -d ' ' || true)
new_sn=$(grep -hE '^\s*disqus_shortname:' "$CONF" | head -1 | sed -E 's/^[^:]+:\s*"?([^"#]+)"?.*/\1/' | tr -d ' ')
if [ -n "$old_sn" ] && [ "$old_sn" != "$new_sn" ]; then
  sed -i -E "s/^(\s*disqus_shortname:\s*).*/\1\"$old_sn\"/" "$CONF"
  ok "shortname updated: $new_sn → $old_sn"
else
  ok "shortname: ${new_sn:-none} (same as the old site)"
fi
echo "    Trusted domains are stored in your Disqus account, not in the site: nothing to import."

# ── Summary ──────────────────────────────────────────────────────────────────
log "Done. Review, then keep these files in the site:"
git status --short -- assets/images "$CONF" 'google*.html' 2>/dev/null | head -40 || true
cat <<EOF

    git add assets/images $CONF \$(ls google*.html 2>/dev/null)
    git commit -m "content: images and settings from the old site"
    git push origin site/perso        # needed: deploy.sh pulls this branch
    ./scripts/deploy.sh all
EOF
