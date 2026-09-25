# =============================================================================
# Dockerfile — jekyll-infops-theme
# Two targets: dev (livereload) and prod (static site served by nginx)
#
# Usage :
#   Dev  → docker compose up
#   Prod → docker compose -f docker-compose.prod.yml up
# =============================================================================

# ─── Stage 1 : base Ruby ─────────────────────────────────────────────────────
FROM ruby:3.4-alpine AS base

# System dependencies (native extensions + sass-embedded)
RUN apk add --no-cache \
      build-base \
      git \
      tzdata \
      libffi-dev \
      yaml-dev \
      zlib-dev \
      gcompat

WORKDIR /site

# Copy gem files first (Docker layer cache).
# Gemfile.lock is optional: the glob keeps COPY from failing when it is absent.
COPY Gemfile Gemfile.lock* ./

# Installer les gems
RUN bundle install --jobs 4 --retry 3

# ─── Stage 2 : développement ─────────────────────────────────────────────────
FROM base AS dev

WORKDIR /site

# Port Jekyll dev + LiveReload
EXPOSE 4000 35729

CMD ["bundle", "exec", "jekyll", "serve", \
     "--host", "0.0.0.0", \
     "--port", "4000", \
     "--livereload", \
     "--incremental", \
     "--future", \
     "--drafts"]

# ─── Stage 3 : build production ──────────────────────────────────────────────
FROM base AS builder

WORKDIR /site
COPY . .

RUN JEKYLL_ENV=production bundle exec jekyll build --destination /dist

# ─── Stage 4 : production (nginx léger) ──────────────────────────────────────
FROM nginx:stable-alpine AS prod

# Copier le site buildé
COPY --from=builder /dist /usr/share/nginx/html

# Config nginx optimisée pour un site statique Jekyll
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
