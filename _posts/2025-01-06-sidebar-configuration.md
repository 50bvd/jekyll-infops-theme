---
layout: post
title: "Sidebar Widgets — Configuration & Live Metrics"
date: 2025-01-06 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [sidebar, widgets, metrics, system-status, configuration]
description: "Configure the sidebar: enable/disable widgets, understand the live browser metrics, and set up the GoatCounter visitor counter."
toc: true
---

The sidebar contains five independent widgets, each toggleable from `_config.yml`. On viewports narrower than 1100px, the sidebar collapses below the main content and becomes a horizontal grid.

---

## Enable / disable widgets

```yaml
theme_config:
  show_stats:         true   # Site Stats card
  show_system_status: true   # Live browser metrics
  show_recent_posts:  true   # Recent Posts list
  show_categories:    true   # Category tag cloud
  show_tags:          true   # Tag cloud
  recent_posts_count: 5      # items in Recent Posts
```

Set any flag to `false` to hide the widget entirely — the sidebar reflows automatically.

---

## Site Stats widget

Shows four counters:

| Counter | Source |
|---|---|
| Articles | Jekyll `site.posts | size` — always accurate |
| Tags | Jekyll `site.tags | size` — always accurate |
| Words | Sum of all post word counts — computed at build time |
| Visitors / month | Live from GoatCounter API — requires configuration |

### Enabling the live visitor count

The visitor counter fetches from GoatCounter's `/api/v0/stats/total` endpoint. This endpoint requires either an API token (not practical for a public site) or **public stats** to be enabled:

1. Create a free account at [goatcounter.com](https://www.goatcounter.com)
2. Add your `goatcounter_code` to `_config.yml`
3. In the GoatCounter dashboard: **Settings → Allow public access to stats → Save**
4. Rebuild the site

```yaml
analytics:
  goatcounter_code: "myblog"   # https://myblog.goatcounter.com
```

If public stats are disabled (or if GoatCounter isn't configured), the counter shows `—` with a link to your dashboard. All other stats still display correctly.

---

## System Status widget — live browser metrics

Unlike a traditional status page, the System Status widget here reports **real-time browser metrics** — not a static configuration. The data is read from browser APIs and refreshes every 12 seconds.

### Metric 1 — Network

Uses the [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation):

| Condition | Status |
|---|---|
| `navigator.onLine === false` | 🔴 error — offline |
| `effectiveType === '2g'` or `rtt > 400ms` | 🟡 warning |
| Everything else | 🟢 online + connection type (`4g`, `wifi`…) |

### Metric 2 — Load time

Reads `performance.timing.loadEventEnd - performance.timing.navigationStart`:

| Time | Status |
|---|---|
| < 2 s | 🟢 online |
| 2 – 5 s | 🟡 warning |
| > 5 s | 🔴 error |

### Metric 3 — Protocol

`location.protocol === 'https:'` → 🟢 HTTPS, otherwise 🟡 HTTP. Useful as a quick sanity check in production.

### Metric 4 — JS heap (Chrome only)

`performance.memory.usedJSHeapSize / totalJSHeapSize`:

| Usage | Status |
|---|---|
| < 70% | 🟢 |
| 70 – 90% | 🟡 |
| > 90% | 🔴 |

This metric only appears in Chromium-based browsers — Firefox and Safari don't expose `performance.memory`.

{% include callout.html type="note" title="Why live metrics?" content="A static status config (`online | warning | error`) is useful for communicating infra state to readers. Real-time browser metrics are more interesting on a tech blog — they demonstrate what the browser APIs can actually tell you, and change as the user's conditions change." %}

---

## Recent Posts widget

Lists the N most recent posts (controlled by `recent_posts_count`). Each entry links to the post with its publication date.

---

## Categories & Tags

Both widgets display alphabetically sorted lists as tag pills. Each pill links to the corresponding category page (`/categories/category-name/`) or tag anchor (`/tags/#tag-name`).

Tag and category pages are generated at build time from the posts' front matter — no extra configuration needed.

{% include callout.html type="tip" title="Keeping tags tidy" content="Use lowercase, hyphenated tags consistently (`docker-compose`, not `Docker Compose` or `dockercompose`). Jekyll treats tags as case-sensitive — inconsistent casing creates duplicate entries in the cloud." %}
