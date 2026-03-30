---
layout: post
title: "FAQ & Troubleshooting"
date: 2025-01-09 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [faq, troubleshooting, debug, build, github-pages]
description: "Answers to the most common questions and build errors for jekyll-infops-theme — Sass, Ruby, Docker, GitHub Pages and browser quirks."
toc: true
---

Collected answers to everything that tends to go wrong during setup, customisation and deployment.

---

## Build & installation

### `bundle install` fails on Windows

```bash
# Force native Ruby platform (no native extensions)
bundle config set --local force_ruby_platform true
bundle install
```

If you get SSL errors:

```bash
gem update --system
gem install bundler
bundle install
```

### Sass `@import` deprecation warning

This theme uses Dart Sass `@use` / `@forward`. The warning appears if your environment falls back to LibSass (`sassc` gem):

```bash
# Ensure jekyll-sass-converter 3.x is installed
bundle update jekyll-sass-converter
bundle exec jekyll serve
```

Check which converter is active: `bundle info jekyll-sass-converter`.

### Line numbers appear inside code blocks

Set `line_numbers: false` in `_config.yml`:

```yaml
kramdown:
  syntax_highlighter_opts:
    block:
      line_numbers: false
```

Then restart Jekyll. Existing `_site/` files may be stale — run `bundle exec jekyll clean` first.

### `"Could not locate Gemfile"` or missing include

Ensure you're in the project root when running `bundle exec jekyll serve`. Double-check that all files referenced by Liquid `include` tags exist in `_includes/`.

### Jekyll builds successfully but the site looks broken

1. Check `baseurl` in `_config.yml` — for a GitHub Pages project site it must be `/repo-name`, for a user/org site it must be `""`
2. Open browser DevTools → Console for 404s on CSS/JS
3. Run `bundle exec jekyll build --verbose` for the full build log

---

## Layout & display

### Sidebar disappears on mobile

Expected — at < 1100px the sidebar collapses below the content and switches to a 2-column grid. At < 768px it becomes a single column. This is by design and controlled in `_sass/_responsive.scss`.

### Canvas background is invisible

1. Check `canvas.enabled: true` in `_config.yml`
2. DevTools → Console: look for JS errors in `canvas.js`
3. Reduce `particle_count` to `40` and lower `max_distance` to `80` to rule out performance issues
4. Some ad-blockers block canvas API calls — test in a private window

### Hero section is too tall

```yaml
# _data/theme.yml
hero:
  min_height: 40   # vh — reduce this; set to 0 for auto height
```

### Post card left border missing

The coloured left border comes from `.post-card::before` in `_sass/_layout.scss`. If you've customised SCSS, verify this rule exists and isn't overridden by a `display: none` or `content: none` somewhere.

### Search bar does nothing

The search page is at `/search/`. Confirm:

1. `pages/search.html` has the front matter block **at the very top** of the file (no Liquid tags before the `---`)
2. `search.json` exists at the repo root with a `layout: null` front matter
3. The `search-json-url` meta tag is present in `<head>` (check `_site/search/index.html`)
4. Open DevTools → Network — the fetch to `/search.json` should return 200 with valid JSON

---

## Terminal

### Terminal color doesn't persist across pages

The terminal color is stored in `sessionStorage`, not `localStorage`. It persists within the same tab session but resets when the tab is closed or a new tab is opened. This is intentional — it's a visual preference for the current session, not a permanent setting.

### Games feel too fast or too slow

Game speed is frame-rate dependent (60fps assumed). On very high refresh-rate monitors (144Hz+), games run faster because `requestAnimationFrame` fires more frequently. A fix using `performance.now()` delta timing could be added to each game file if needed.

### Terminal doesn't respond to keyboard input

Click inside the terminal window first — the hidden `<input>` needs focus. If the terminal is minimised (yellow dot), click the dot to restore it.

---

## Analytics

### GoatCounter shows `—` for visitor count

Two causes:

**Public stats disabled:** GoatCounter dashboard → **Settings → Allow public access to stats → Enable**.

**CORS blocked:** Open DevTools → Network → filter `goatcounter.com`. A `403` means public stats are off. A `CORS` error means a browser extension is blocking the request. Check the console for `[infops] GoatCounter stats: auth-required`.

### Analytics fire in development

Check that `analytics.html` wraps all script tags inside a `if jekyll.environment == "production"` Liquid condition. Run `bundle exec jekyll serve` (not `--env production` or `JEKYLL_ENV=production`).

### GA4 shows no data for 24–48 hours

Normal — GA4 processes data asynchronously with up to 48h delay. Verify the Measurement ID starts with `G-` (not the old `UA-` Universal Analytics format).

---

## GitHub Pages

### Build fails in GitHub Actions

**Check the Actions tab** for the error. Common causes:

| Error | Fix |
|---|---|
| `Gem not found` | Add the gem to `Gemfile` and commit `Gemfile.lock` |
| `Plugin not whitelisted` | The `.github/workflows/pages.yml` Action-based workflow bypasses the whitelist — ensure Source is set to **GitHub Actions**, not **Deploy from branch** |
| `baseurl` mismatch | Match `baseurl` in `_config.yml` to your repo name |
| Jekyll build error in a post | Run `bundle exec jekyll build` locally to see the exact error |

### Site deploys but shows old content

GitHub Actions build + deploy takes 1–3 minutes. Check **Actions → latest workflow run** for status. If the run succeeded but the site is still stale, try a hard refresh (`Ctrl+Shift+R`) — GitHub Pages serves behind a CDN with some caching.

### Custom domain returns 404

1. Ensure a `CNAME` file exists at the repo root containing your domain (e.g. `blog.yourdomain.com`)
2. Add a `CNAME` DNS record pointing to `your-username.github.io`
3. Wait up to 24h for DNS propagation
4. In repo **Settings → Pages → Custom domain** — GitHub checks DNS and provisions a TLS certificate automatically

---

## Docker

### `docker compose up` fails on first run

```bash
# Full reset — remove containers, volumes and cached layers
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Changes not reflected after `docker compose up`

Confirm the source directory is mounted as a volume in `docker-compose.yml`:

```yaml
volumes:
  - .:/srv/jekyll
```

If you edited `_config.yml`, livereload is not sufficient — restart the container: `docker compose restart jekyll`.
