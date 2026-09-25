#!/usr/bin/env bash
# =============================================================================
# scripts/deploy.sh — deploy 50bvd.com on the home server
#
#   ./scripts/deploy.sh prod      build with Docker, publish to Apache (host)
#   ./scripts/deploy.sh preprod   (re)build and restart the preprod container
#   ./scripts/deploy.sh all       both
#
# Requirements on the server: git, Docker (with buildx), Apache 2.4, rsync.
# No Ruby needed: Jekyll runs inside Docker.
#
# Overridable: WEB_ROOT (default /var/www/50bvd.com), BRANCH (default main)
# =============================================================================
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/50bvd.com}"
BRANCH="${BRANCH:-main}"
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

deploy_prod() {
  command -v rsync >/dev/null || die "rsync is not installed"
  local out; out="$(mktemp -d)"
  trap 'rm -rf "$out"' RETURN

  log "Building the production site (Docker)"
  docker build --target site-export --output "type=local,dest=$out" .

  [ -f "$out/index.html" ] || die "build produced no index.html — nothing deployed"

  log "Publishing to $WEB_ROOT"
  sudo mkdir -p "$WEB_ROOT"
  sudo rsync -a --delete --chmod=D755,F644 "$out"/ "$WEB_ROOT"/

  if command -v apachectl >/dev/null; then
    sudo apachectl configtest && sudo apachectl graceful
  fi
  log "Production deployed → https://50bvd.com"
}

deploy_preprod() {
  log "Building and restarting the preprod container"
  docker compose -f docker-compose.preprod.yml up -d --build
  docker image prune -f >/dev/null
  log "Preprod up → http://127.0.0.1:8081 (on the server)"
}

case "${1:-}" in
  prod)    update_sources; deploy_prod ;;
  preprod) update_sources; deploy_preprod ;;
  all)     update_sources; deploy_preprod; deploy_prod ;;
  *) echo "Usage: $0 {prod|preprod|all}"; exit 1 ;;
esac
