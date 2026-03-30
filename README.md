# jekyll-infops-theme

> A modern, feature-rich Jekyll theme for DevOps, SysOps and infrastructure engineers.

[![Jekyll](https://img.shields.io/badge/Jekyll-4.3-red?logo=jekyll)](https://jekyllrb.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-ready-brightgreen?logo=github)](https://pages.github.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://www.docker.com)

**Live demo:** https://50bvd.github.io/jekyll-infops-theme/

---

## Features

- **Interactive terminal** — CRT-style hero terminal with 4 canvas games (Pong, Pac-Man, Snake, Tetris), `color` theming, fullscreen mode, and neofetch boot screen
- **Canvas background** — animated particles connected by lines, cursor-reactive
- **Dark / Light mode** — persisted via `localStorage`, zero flash on load, all terminal colors follow the theme
- **Syntax highlighting** — Prism.js with per-block Copy button, CRT-style dark theme
- **Auto-generated TOC** — from Markdown headings, scroll-aware active link
- **Reading progress bar** — gradient bar while reading a post
- **Client-side search** — JSON index, no external service required
- **Callout blocks** — `note`, `tip`, `info`, `warning`, `danger`, `success`
- **Analytics** — GoatCounter, GA4, Plausible, Umami (production only, zero dev pollution)
- **Comments** — Utterances (GitHub Issues) or Disqus
- **System Status widget** — 4 live browser metrics (Network, Load time, Protocol, JS heap)
- **Full customization** — colors, fonts, layout via `_config.yml` and `_data/theme.yml`
- **5 built-in color palettes** — Cyberpunk, Ocean, Forest, Solarized Dark, Light Mode
- **Responsive** — mobile-first, sidebar collapses at 1100px
- **Accessible** — skip-link, aria-labels, `prefers-reduced-motion` support
- **SEO-ready** — Open Graph, Twitter Cards via `jekyll-seo-tag`
- **Docker-ready** — dev mode with livereload + prod mode with nginx

---

## Quick Start

### Option A — Local Ruby

```bash
git clone https://github.com/50bvd/jekyll-infops-theme.git my-blog
cd my-blog
bundle install
bundle exec jekyll serve --livereload
# → http://localhost:4000
```

### Option B — Docker (no Ruby required)

```bash
git clone https://github.com/50bvd/jekyll-infops-theme.git my-blog
cd my-blog
docker compose up
# → http://localhost:4000  (live reload enabled)
```

### Option C — Fork for your own site

1. Fork this repo on GitHub
2. Rename it to `your-username.github.io`
3. Edit `_config.yml` (replace `YOUR_*` placeholders)
4. Go to **Settings → Pages → Source → GitHub Actions**
5. Push — your site is live in ~2 minutes

---

## Configuration

Edit `_config.yml`:

```yaml
title:   "My InfOps Blog"
url:     "https://your-username.github.io"

author:
  name:   "Your Name"
  github: "your-username"

# Terminal boot screen (neofetch)
theme_config:
  terminal_user: "user@myblog"
  terminal_boot:
    user:  "loup"
    host:  "myblog"
    os:    "Jekyll 4.3"
    shell: "bash 5.2"
    role:  "SysOps"
    motd:  "Type /help for commands."
    ascii: |
      ██╗███╗   ██╗███████╗
      ██║████╗  ██║██╔════╝
      ██║██╔██╗ ██║█████╗
      ██║██║╚██╗██║██╔══╝
      ██║██║ ╚████║██║
      ╚═╝╚═╝  ╚═══╝╚═╝

analytics:
  goatcounter_code: "myblog"  # free, no cookies

comments:
  provider:        "utterances"
  utterances_repo: "your-username/your-repo"
```

---

## Visual Customization

Edit `_data/theme.yml` — no SCSS required:

```yaml
colors:
  accent_blue: "#58a6ff"
  bg_primary:  "#0d1117"

fonts:
  sans: "Plus Jakarta Sans"   # any Google Fonts name
  mono: "Fira Code"

code:
  theme: "prism-okaidia"      # Prism.js syntax theme
```

**Terminal color** — type in the terminal at runtime:

```
color green        # preset
color #FF6B35      # custom hex
color reset        # back to theme default
```

---

## Writing Posts

Create `_posts/YYYY-MM-DD-title.md`:

```markdown
---
layout: post
title:  "My Post"
date:   2025-01-01 10:00:00 +0100
tags:   [linux, docker]
toc:    true
---

Content here.
```

**Callouts:**

```liquid
{% include callout.html type="tip" title="Tip" content="Your advice here." %}
```

Types: `note` · `tip` · `info` · `warning` · `danger` · `success`

---

## Terminal Commands

Type `/help` in the terminal for the full list. Built-in commands:

| Command | Description |
|---|---|
| `help` / `?` | Show all commands |
| `clear` / `cls` | Clear the terminal |
| `color <name\|#hex\|reset>` | Change accent color |
| `matrix` | Enter the Matrix (ESC to stop) |
| `pong` | Play Pong (mouse / W·S) |
| `pacman` | Play Pac-Man (WASD / arrows) |
| `snake` | Play Snake (WASD / arrows) |
| `tetris` | Play Tetris (arrows + space) |

**Adding custom commands** — see [the docs post](_posts/2025-01-10-terminal-extending.md) or `/test/`.

---

## Deploy to GitHub Pages

The `.github/workflows/pages.yml` workflow builds and deploys automatically on every push to `main`.

1. Push to a GitHub repository
2. **Settings → Pages → Source → GitHub Actions**
3. Done — the workflow handles everything

**Custom domain:** add a `CNAME` file at the repo root, configure your DNS.

---

## Docker Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
# → http://localhost  (nginx + gzip + security headers)
```

Production mode activates analytics scripts (`JEKYLL_ENV=production`).

---

## Project Structure

```
jekyll-infops-theme/
├── .github/workflows/pages.yml   # GitHub Actions → GitHub Pages
├── Dockerfile                    # Multi-stage: dev + prod (nginx)
├── docker-compose.yml            # Development (live reload)
├── docker-compose.prod.yml       # Production (nginx)
├── _config.yml                   # All theme + terminal options
├── _data/
│   ├── theme.yml                 # Colors, fonts, layout
│   └── social.yml                # Social links
├── _includes/                    # 11 HTML partials
├── _layouts/                     # 4 layouts (default, home, post, category)
├── _posts/                       # 10 documentation posts
├── _sass/                        # 6 SCSS modules (Dart Sass @use)
├── assets/
│   ├── css/style.scss
│   └── js/
│       ├── modules/              # 12 JS modules
│       └── terminal-commands/   # 8 terminal command files
├── pages/
│   ├── about.md
│   ├── archives.md
│   ├── search.html
│   ├── tags.html
│   └── test.html                 # Interactive feature checklist
└── search.json                   # Search index template
```

---

## License

[MIT](LICENSE) © 2026 [50bvd](https://github.com/50bvd)
