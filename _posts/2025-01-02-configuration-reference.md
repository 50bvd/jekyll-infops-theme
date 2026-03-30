---
layout: post
title: "Configuration Reference — _config.yml"
date: 2025-01-02 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [configuration, _config.yml, reference]
description: "Complete annotated reference for every option in jekyll-infops-theme's _config.yml."
toc: true
---

All theme behaviour is driven by a single file: `_config.yml` at the repo root. This post documents every key.

{% include callout.html type="info" title="Restart required" content="Jekyll does not watch `_config.yml` for changes. Restart `jekyll serve` (or `docker compose restart`) after every edit." %}

---

## Site identity

```yaml
title:       "My InfOps Blog"
tagline:     "DevOps · SysOps · Infrastructure"
description: "A short description used for SEO and the footer."
url:         "https://your-username.github.io"   # no trailing slash
baseurl:     ""   # leave empty for root sites; use "/repo-name" for project sites
lang:        "en"
timezone:    "Europe/Paris"   # any tz database name
```

`url` + `baseurl` together form the absolute base of every link. For a GitHub Pages user site (`your-username.github.io`), both `url: "https://your-username.github.io"` and `baseurl: ""` are correct.

---

## Author

```yaml
author:
  name:     "Your Name"           # used in post meta and footer
  email:    "you@example.com"     # never displayed publicly
  bio:      "Short bio text."     # shown on the About page
  avatar:   "/assets/images/avatar.jpg"
  github:   "your-username"
  twitter:  "yourhandle"          # without @
  linkedin: "your-slug"
  mastodon: "https://fosstodon.org/@you"   # full URL
```

Social links with empty values are hidden. The footer reads from `_data/social.yml` first; these `author.*` fields are the fallback.

---

## Analytics

```yaml
analytics:
  goatcounter_code:    ""   # your-code → https://your-code.goatcounter.com
  google_analytics_id: ""   # G-XXXXXXXXXX
  plausible_domain:    ""   # yourdomain.com (no https://)
  umami_website_id:    ""   # UUID from your Umami instance
  umami_src:           ""   # https://umami.yourdomain.com/script.js
```

Scripts are injected **only when `JEKYLL_ENV=production`**. Running `jekyll serve` locally never fires any tracker. Multiple providers can be active simultaneously.

{% include callout.html type="tip" title="Recommended: GoatCounter" content="GoatCounter is free (up to 100k pageviews/month), open-source, requires no cookie banner, and exposes a public JSON API that the sidebar widget reads to display a live visitor count." %}

---

## Comments

```yaml
comments:
  provider:         "utterances"           # utterances | disqus | none
  utterances_repo:  "your-username/repo"   # GitHub repo for issue threads
  utterances_theme: "github-dark"          # github-dark | github-light | preferred-color-scheme
  disqus_shortname: ""                     # Disqus site shortname
```

Utterances maps each post URL to a GitHub Issue in the specified repo. Visitors need a GitHub account to comment. Disable comments on a specific post with `comments: false` in its front matter.

---

## Terminal

```yaml
theme_config:
  terminal_user: "user@infops"   # label in the terminal header bar

  terminal_boot:
    user:  "YOUR_USER"     # shown as user@host in neofetch
    host:  "YOUR_HOST"
    os:    "YOUR_OS"       # e.g. "Jekyll 4.3 · AlmaLinux 10"
    shell: "YOUR_SHELL"    # e.g. "bash 5.2"
    role:  "YOUR_ROLE"     # e.g. "SysOps · Infrastructure"
    line1: ""              # extra info line (leave empty to hide)
    line2: ""
    motd:  "Type /help for commands."

    ascii: |               # custom ASCII art (leave empty for Ubuntu logo)
      ██╗███╗   ██╗███████╗
      ██║████╗  ██║██╔════╝
      ██║██╔██╗ ██║█████╗
      ██║██║╚██╗██║██╔══╝
      ██║██║ ╚████║██║
      ╚═╝╚═╝  ╚═══╝╚═╝
```

All `terminal_boot` fields accept empty strings to hide that line. The `ascii` block (9 lines max, ~32 chars wide) replaces the default Ubuntu-style logo at boot. Generate art at [patorjk.com/software/taag](https://patorjk.com/software/taag/).

---

## Particle canvas

```yaml
  canvas:
    enabled:         true
    particle_count:  80     # 20–150 recommended
    max_distance:    130    # px — max distance for inter-particle lines
    cursor_distance: 160    # px — cursor attraction radius
```

Set `enabled: false` to disable the canvas entirely (good for accessibility or battery-conscious deploys).

---

## Sidebar widgets

```yaml
  show_stats:         true   # Site Stats card (articles, tags, visitors, words)
  show_system_status: true   # 4 live browser metrics
  show_recent_posts:  true   # Recent Posts list
  show_categories:    true   # Categories tag cloud
  show_tags:          true   # Tags cloud
  recent_posts_count: 5      # how many posts to show
```

---

## Post-level options

```yaml
  reading_time:       true   # "X min read" in post header
  word_count:         true   # word count in post header
  show_toc:           true   # inline table of contents
  toc_min_headings:   2      # minimum headings before TOC appears
  code_copy_button:   true   # Copy button on every code block
  show_share_buttons: true   # Twitter / LinkedIn / Email / Copy link
  show_post_nav:      true   # prev / next post navigation
  show_related_posts: true   # related posts section at bottom
  show_reading_progress: true # progress bar at top of viewport
```

All of these can be overridden per post in front matter:

```yaml
---
title: "My Post"
toc:      false
comments: false
---
```

---

## Navigation

```yaml
  navigation:
    - title: "Home"
      url:   "/"
      icon:  "fas fa-home"
    - title: "GitHub"
      url:   "https://github.com/your-username"
      icon:  "fab fa-github"
      external: true   # opens in new tab + shows ↗ icon
```

Icons are [Font Awesome 6](https://fontawesome.com/icons) class strings. Free solid icons use `fas`, brand icons use `fab`.

---

## Pagination

```yaml
paginate:      8      # posts per page on the homepage
paginate_path: "/page:num/"
```

With 10 posts and `paginate: 8`, the homepage shows 8 posts and a `/page2/` link appears automatically.

---

## Defaults

```yaml
defaults:
  - scope: { path: "", type: "posts" }
    values:
      layout:   "post"
      author:   "50bvd"
      comments: true
      toc:      true
```

Front matter values on individual posts override these defaults. Use defaults to avoid repeating boilerplate across every post file.
