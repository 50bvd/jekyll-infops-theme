---
layout: post
title: "Analytics Setup — GoatCounter, GA4, Plausible & Umami"
date: 2025-01-08 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [analytics, goatcounter, google-analytics, plausible, umami, gdpr]
description: "Step-by-step setup for all four supported analytics providers. Scripts load only in production — local development stats are never polluted."
toc: true
---

jekyll-infops-theme supports four analytics providers simultaneously. All scripts are injected only when `JEKYLL_ENV=production` — running `jekyll serve` locally never fires any tracker.

---

## How production mode works

```bash
# Development — no analytics injected
bundle exec jekyll serve

# Production build — all configured providers active
JEKYLL_ENV=production bundle exec jekyll build

# Docker production — sets JEKYLL_ENV=production automatically
docker compose -f docker-compose.prod.yml up -d --build

# GitHub Actions — pages.yml sets JEKYLL_ENV=production in the build step
```

The `analytics.html` include evaluates `jekyll.environment` at build time. If it's not `production`, the output is an empty string — no `<script>` tags, no network requests.

---

## GoatCounter (recommended)

**Why GoatCounter:** free up to 100k pageviews/month, open-source (MIT), GDPR-compliant, no cookies, no consent banner required, and provides a public JSON API that the sidebar visitor counter reads.

### Setup

1. Create an account at [goatcounter.com](https://www.goatcounter.com)
2. Choose a code (e.g. `myblog` → `https://myblog.goatcounter.com`)
3. Add to `_config.yml`:

```yaml
analytics:
  goatcounter_code: "myblog"
```

4. Rebuild and deploy

### Enabling the live visitor counter

The sidebar widget reads from GoatCounter's `/api/v0/stats/total` endpoint. This requires public stats access:

1. GoatCounter dashboard → **Settings → Allow public access to stats → Save**
2. No rebuild needed — the JS fetch happens at runtime

Without public stats, the sidebar shows `—` and a link to your private dashboard.

{% include callout.html type="tip" title="GoatCounter is enough for most blogs" content="For a personal or team tech blog, GoatCounter's dashboard covers everything you need: pageviews, referrers, browsers, countries, screen sizes — all in a clean single-page UI with no sampling." %}

---

## Google Analytics 4

GA4 provides audience demographics, user journeys, conversion funnels, and deep cohort analysis — worth it if you need detailed marketing insights.

### Setup

1. [analytics.google.com](https://analytics.google.com) → **Admin → Create property → Web**
2. Enter your site URL → **Create data stream**
3. Copy the Measurement ID (`G-XXXXXXXXXX`)
4. Add to `_config.yml`:

```yaml
analytics:
  google_analytics_id: "G-XXXXXXXXXX"
```

{% include callout.html type="warning" title="GDPR & cookies" content="GA4 sets third-party cookies (`_ga`, `_ga_XXXXXXXX`). A cookie consent banner is legally required for EU/EEA visitors (GDPR) and UK visitors (UK GDPR). Consider GoatCounter or Plausible for a cookie-free alternative." %}

The sidebar shows a direct link to your GA4 property when configured.

---

## Plausible Analytics

Lightweight (< 1KB script), privacy-first, no cookies, no consent banner. Paid SaaS ($9/mo for up to 10k pageviews), with a self-hosted option.

### Setup

1. [plausible.io](https://plausible.io) → Add website
2. Enter your domain exactly as it appears in the browser (e.g. `blog.yourdomain.com`)
3. Add to `_config.yml`:

```yaml
analytics:
  plausible_domain: "blog.yourdomain.com"
```

### Self-hosting Plausible

```bash
git clone https://github.com/plausible/community-edition.git plausible
cd plausible
cp .env.example .env
# Edit .env — set BASE_URL, SECRET_KEY_BASE, DATABASE_URL
docker compose up -d
```

{% include callout.html type="tip" title="Self-hosting" content="The Plausible Community Edition is free and MIT-licensed. A VPS with 1GB RAM is sufficient for up to ~1M monthly pageviews." %}

---

## Umami (self-hosted)

100% self-hosted, open-source, no data sent to third parties. Free forever on your own server.

### Deploy with Docker Compose

```yaml
# umami/docker-compose.yml
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://umami:umami@db:5432/umami
      APP_SECRET: replace-with-a-long-random-string

  db:
    image: postgres:16-alpine
    volumes:
      - umami-db:/var/lib/postgresql/data
    environment:
      POSTGRES_DB:       umami
      POSTGRES_USER:     umami
      POSTGRES_PASSWORD: umami

volumes:
  umami-db:
```

```bash
docker compose up -d
# → http://your-server:3000
# Default login: admin / umami  ← change immediately
```

### Get your Website ID

1. Umami dashboard → **Settings → Websites → Add website**
2. Copy the **Website ID** (UUID format)

### Configure

```yaml
analytics:
  umami_website_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  umami_src:        "https://umami.yourdomain.com/script.js"
```

---

## Comparison

| | GoatCounter | GA4 | Plausible | Umami |
|---|---|---|---|---|
| Cost | Free | Free | $9+/mo (or self-host) | Free (self-hosted) |
| Cookies | ❌ None | ✅ Yes | ❌ None | ❌ None |
| GDPR banner needed | No | Yes | No | No |
| Self-hostable | No | No | Yes (CE) | Yes |
| Sidebar visitor counter | ✅ | ❌ | ❌ | ❌ |
| Data stays yours | ❌ | ❌ | Depends | ✅ |
| Script size | ~4 KB | ~47 KB | < 1 KB | ~2 KB |

{% include callout.html type="info" title="Mix and match" content="All four providers are independent. You can run GoatCounter for the sidebar counter + Plausible for detailed reporting at the same time — just add both keys to `_config.yml`." %}
