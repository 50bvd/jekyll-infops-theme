# =============================================================================
# Dockerfile — jekyll-infops-theme
# Deux stages : dev (livereload) et prod (site statique servi par nginx)
#
# Usage :
#   Dev  → docker compose up
#   Prod → docker compose -f docker-compose.prod.yml up
# =============================================================================

# ─── Stage 1 : base Ruby ─────────────────────────────────────────────────────
FROM ruby:3.3-alpine AS base

# Dépendances système
RUN apk add --no-cache \
      build-base \
      git \
      nodejs \
      npm \
      tzdata \
      libffi-dev \
      yaml-dev \
      zlib-dev

WORKDIR /site

# Copier les fichiers de gems en premier (cache Docker)
COPY Gemfile Gemfile.lock ./

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
FROM nginx:1.27-alpine AS prod

# Copier le site buildé
COPY --from=builder /dist /usr/share/nginx/html

# Config nginx optimisée pour un site statique Jekyll
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
