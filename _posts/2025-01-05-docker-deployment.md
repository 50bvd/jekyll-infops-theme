---
layout: post
title: "Docker Deployment — Development & Production"
date: 2025-01-05 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [docker, deployment, nginx, self-hosting, production]
description: "Run jekyll-infops-theme with Docker — zero Ruby required. Dev mode with live reload, production mode with nginx, gzip and security headers."
toc: true
---

jekyll-infops-theme ships with a complete Docker setup for both development and production. No Ruby installation required on your machine.

---

## Files overview

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage: `dev` target (Jekyll + livereload) and `prod` target (nginx) |
| `docker-compose.yml` | Development mode — mounts sources as a live volume |
| `docker-compose.prod.yml` | Production mode — builds static site, serves with nginx |
| `docker/nginx.conf` | nginx config with gzip, caching and security headers |

---

## Development mode

```bash
docker compose up
```

- Starts Jekyll with `--livereload`
- Mounts the entire project as a volume — file changes trigger instant rebuilds
- Opens at `http://localhost:4000`

```bash
# First launch or after Gemfile changes — rebuild the image
docker compose up --build

# Run in background
docker compose up -d

# Tail logs
docker compose logs -f jekyll
```

{% include callout.html type="tip" title="Gem cache" content="The dev Compose file mounts a named volume for the bundler gem cache. After the first build, gems are cached across container restarts — startup goes from ~60s to ~3s." %}

{% include callout.html type="info" title="Analytics in development" content="`JEKYLL_ENV` is not set in dev mode, so `jekyll.environment` evaluates to `development`. Analytics scripts in `_includes/analytics.html` are guarded by a production environment check and are never injected during local development." %}

---

## Production mode

```bash
docker compose -f docker-compose.prod.yml up -d --build
# → http://localhost (port 80)
```

The production build:

1. Runs `bundle exec jekyll build` with `JEKYLL_ENV=production` — activates analytics
2. Copies `_site/` into an nginx Alpine image (~20MB final image)
3. Serves the static site with gzip, long-term asset caching, and a set of security headers

### nginx security headers

The `docker/nginx.conf` sets:

```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

Edit `docker/nginx.conf` to add a Content-Security-Policy if needed for your analytics/comments providers.

### Caching strategy

```nginx
# HTML — no cache (always fresh)
location ~* \.html$ { add_header Cache-Control "no-store"; }

# Assets — 1 year (Jekyll fingerprints filenames)
location ~* \.(css|js|woff2?|jpg|png|svg|ico)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

---

## Useful commands

```bash
# Check running containers
docker compose ps

# Stop cleanly
docker compose down

# Destroy containers AND gem cache volume (full reset)
docker compose down -v

# Rebuild without layer cache
docker compose build --no-cache

# Production: view nginx access logs
docker compose -f docker-compose.prod.yml logs -f nginx
```

---

## Running behind a reverse proxy

If you place nginx behind Traefik, Caddy or another reverse proxy, edit `docker-compose.prod.yml` to remove the host port binding and let the proxy handle TLS:

```yaml
services:
  nginx:
    # remove: ports: ["80:80"]
    expose: ["80"]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.blog.rule=Host(`blog.yourdomain.com`)"
      - "traefik.http.routers.blog.entrypoints=websecure"
      - "traefik.http.routers.blog.tls.certresolver=letsencrypt"
```

{% include callout.html type="warning" title="update url in _config.yml" content="Set `url: 'https://blog.yourdomain.com'` in `_config.yml` so absolute URLs in feeds, sitemaps and SEO tags resolve correctly." %}

---

## GitHub Pages (no Docker)

For public hosting, GitHub Actions is simpler than Docker:

1. Push the repo to GitHub
2. **Settings → Pages → Source → GitHub Actions**
3. The `.github/workflows/pages.yml` workflow builds with `JEKYLL_ENV=production` and deploys on every push to `main`
4. Site is live at `https://your-username.github.io/repo-name/`

{% include callout.html type="tip" title="Custom domain on GitHub Pages" content="Create a `CNAME` file at the repo root containing your domain (e.g. `blog.yourdomain.com`). Then add a CNAME DNS record pointing to `your-username.github.io`. GitHub issues the TLS certificate automatically via Let's Encrypt." %}
