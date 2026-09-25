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
      ca-certificates \
      libffi-dev \
      yaml-dev \
      zlib-dev \
      gcompat

# Article covers: SVG → PNG for social cards (optional — covers stay SVG without it)
RUN apk add --no-cache font-dejavu \
 && (apk add --no-cache rsvg-convert || apk add --no-cache librsvg || echo "rsvg-convert unavailable: covers will be SVG only")

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

# SITE_CONFIG: extra config layered on _config.yml (the personal server uses _config.perso.yml)
ARG SITE_CONFIG=_config.perso.yml
RUN JEKYLL_ENV=production bundle exec jekyll build \
      --config "_config.yml,${SITE_CONFIG}" --destination /dist

# ─── Export of the built site (used by scripts/deploy.sh) ────────────────────
#   docker build --target site-export --output type=local,dest=_deploy .
FROM scratch AS site-export
COPY --from=builder /dist /

# ─── Preprod build (noindex, no analytics, relative URLs) ────────────────────
FROM base AS builder-preprod

WORKDIR /site
COPY . .

RUN JEKYLL_ENV=production bundle exec jekyll build \
      --config _config.yml,_config.perso.yml,_config.preprod.yml --destination /dist

# ─── Apache httpd image shared by prod-httpd and preprod ─────────────────────
FROM httpd:2.4-alpine AS httpd-base

COPY apache/security-headers.conf apache/site-common.conf apache/container-httpd.conf /usr/local/apache2/conf/infops/
RUN echo "Include conf/infops/container-httpd.conf" >> /usr/local/apache2/conf/httpd.conf \
 && rm -rf /usr/local/apache2/htdocs/*

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

# ─── Production: Apache httpd container serving 50bvd.com ────────────────────
FROM httpd-base AS prod-httpd
COPY --from=builder /dist /usr/local/apache2/htdocs

# ─── Preprod: same image, noindex build + X-Robots-Tag ───────────────────────
FROM httpd-base AS preprod
COPY --from=builder-preprod /dist /usr/local/apache2/htdocs
CMD ["httpd-foreground", "-DPREPROD"]

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
