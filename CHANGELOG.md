# Changelog

## 1.1.0

### Home page & animations
- **Full-screen** hero (`100svh`) that slides under a transparent header, which turns opaque on scroll.
- Animated backdrop (orbs + grid) and scroll-driven parallax/fade of the hero content — `transform`/`opacity` only (GPU-friendly).
- Cards, widgets and sections fade in as they enter the viewport (`.reveal` / `.fade-in`), search results included.
- "Scroll" cue, back-to-top button with a progress ring, native page transitions (View Transitions API) and a cross-fade on theme switch.
- Reading progress bar driven by `scaleX` + `requestAnimationFrame` (smoother).
- `prefers-reduced-motion` honored everywhere; without JavaScript all content stays visible.

### Terminal
- `window.Terminal.register()` / `ctx` API unchanged. The registry now exists on **every** page (command scripts no longer throw outside the home page).
- New: `Tab` completion, `Ctrl+L` to clear, de-duplicated history, arrow keys/space no longer scroll the page during a game.
- A crashing command prints an error instead of breaking the terminal; output capped at 500 lines (`matrix`).
- Window buttons are keyboard-accessible (no more inline `onclick`); no autofocus on touch devices (the keyboard no longer pops up on load).

### Dependencies
- Jekyll 4.4, jekyll-sass-converter 3.1 (Dart Sass), pinned plugins; gems removed from the Ruby 3.4+ stdlib added.
- Font Awesome 6.7.2, Prism 1.30.0 (fixes CVE-2024-53382), Mermaid 11, MathJax 3.2.2 — pinned on jsDelivr with **Subresource Integrity**.
- GitHub Actions: Ruby 3.4, `checkout@v5`, `upload-pages-artifact@v4`. Docker: Ruby 3.4, `nginx:stable-alpine`.

### Security
- nginx: security headers were dropped on CSS/JS/images (an `add_header` inside a `location` discards the `server`-level ones) → shared snippet included everywhere; stricter CSP (`object-src`, `base-uri`, `frame-ancestors`…), `server_tokens off`, hidden files denied, `X-XSS-Protection: 0`.
- Asset cache reduced to 30 days (files are not fingerprinted: a 1-year `immutable` cache prevented updates).
- CI: least-privilege permissions for the build job (which also runs on PRs).
- Config values injected into JS are encoded with `jsonify` (Disqus, GoatCounter, GA4), TOC built without `innerHTML`, share links properly encoded, `rel="noopener noreferrer"`, colors restored from `sessionStorage` are validated, Mermaid runs with `securityLevel: 'strict'`.

### Fixes
- The `Dockerfile` failed without a `Gemfile.lock`.
- Code blocks: no more crash when the Prism CDN is blocked.
- The "Home" link is no longer active on posts when the site has a `baseurl`.
- Duplicate `<title>` and Open Graph tags removed (already emitted by jekyll-seo-tag).
- Unavailable `localStorage` (private browsing) no longer breaks theming; `default_theme` from `_config.yml` is honored (`dark` | `light` | `auto`).
- Anchors (TOC) are no longer hidden under the sticky header; `toc_min_headings`, `show_toc` and `show_reading_progress` now take effect.
- "System Status" widget: load time via Navigation Timing Level 2, memory gauge measured against the heap limit.
- Canvas: HiDPI support, fewer particles on small screens, paused when the tab is hidden.
