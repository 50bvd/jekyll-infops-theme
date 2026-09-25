#!/usr/bin/env bash
# =============================================================================
# scripts/deploy.sh — deploy 50bvd.com on the home server
#
#   ./scripts/deploy.sh preprod   rebuild + restart the preprod container (127.0.0.1:8081)
#   ./scripts/deploy.sh prod      rebuild + restart the production container (port 4000)
#   ./scripts/deploy.sh all       preprod, then prod
#   ./scripts/deploy.sh host      alternative: publish to Apache installed on the host
#                                 (/var/www/50bvd.com, see DEPLOY.md)
#
# Requirements: git, Docker (buildx + compose). No Ruby needed on the server.
# Overridable: BRANCH (site/perso), PROD_PORT (4000), PREPROD_PORT (8081),
#              WEB_ROOT (/var/www/50bvd.com, "host" mode only)
# =============================================================================
set -euo pipefail

BRANCH="${BRANCH:-site/perso}"
WEB_ROOT="${WEB_ROOT:-/var/www/50bvd.com}"
COMPOSE="docker compose -f docker-compose.50bvd.yml"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not installed"

update_sources() {
  if [ -d .git ]; then
    log "Updating sources ($BRANCH)"
    git fetch --quiet origin "$BRANCH"
    git checkout --quiet "$BRANCH"
    git pull --quiet --ff-only origin "$BRANCH"
  fi
}

# Build first, swap containers only if the build succeeded (no downtime on failure)
deploy_service() {
  local svc="$1"
  log "Building $svc"
  $COMPOSE build "$svc"
  log "Restarting $svc"
  $COMPOSE up -d --no-build "$svc"
  sleep 2
  $COMPOSE ps "$svc"
}

deploy_host() {
  command -v rsync >/dev/null || die "rsync is not installed"
  local out; out="$(mktemp -d)"
  trap 'rm -rf "$out"' RETURN
  log "Building the production site (Docker)"
  docker build --target site-export --output "type=local,dest=$out" .
  [ -f "$out/index.html" ] || die "build produced no index.html — nothing deployed"
  log "Publishing to $WEB_ROOT"
  sudo mkdir -p "$WEB_ROOT"
  sudo rsync -a --delete --chmod=D755,F644 "$out"/ "$WEB_ROOT"/
  if command -v apachectl >/dev/null; then sudo apachectl configtest && sudo apachectl graceful; fi
}

# Server-side files (mounted read-only in the containers, see docker-compose):
# make sure the folders exist and are readable (never world-writable)
IMG_DIR="${IMG_DIR:-/opt/50bvd-files/img}"
ROMS_DIR="${ROMS_DIR:-/opt/50bvd-files/roms}"
for d in "$IMG_DIR" "$ROMS_DIR"; do
  mkdir -p "$d" 2>/dev/null || true
  find "$d" -type d -exec chmod 755 {} + 2>/dev/null || true
  find "$d" -type f -exec chmod 644 {} + 2>/dev/null || true
done
[ -x scripts/gba-library.sh ] && ./scripts/gba-library.sh "$ROMS_DIR" || true

case "${1:-}" in
  preprod) update_sources; deploy_service preprod; log "Preprod → http://127.0.0.1:${PREPROD_PORT:-8081}" ;;
  prod)    update_sources; deploy_service prod;    log "Production → port ${PROD_PORT:-4000}" ;;
  all)     update_sources; deploy_service preprod; deploy_service prod ;;
  host)    update_sources; deploy_host; log "Production (host Apache) → $WEB_ROOT" ;;
  *) echo "Usage: $0 {preprod|prod|all|host}"; exit 1 ;;
esac
docker image prune -f >/dev/null 2>&1 || true
