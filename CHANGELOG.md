# Changelog

## 1.6.2

- **Softer light theme**: darker blue-grey surfaces (no near-white areas left), softer text and accent, calmer hero glow, code blocks and terminal in the same tones. Syntax colours darkened to stay above WCAG AA on the new backgrounds.
- **Day / night toggle**: a new animated sun / moon icon (the sun's rays fold in and a shadow slides over it to form the moon), honours reduced motion.
- **GBA emulator**: when a game cannot start, the menu now shows why (HTTP 403: file permissions, 404: missing file, network error…) instead of failing silently; library names with spaces are shown decoded.

## 1.6.1

- **Cache busting**: every local CSS / JS URL (and the emulator's `gpsp.js` / `gpsp.wasm`) carries `?v=<build time>`, so browsers load the new files right after a deployment instead of mixing cached old ones with new ones (which broke the search panel and the emulator).
- **CSP header vs antivirus**: the Apache / nginx header now has its own broad `script-src` (the per-page `<meta>` policy stays the strict one). Antivirus products that rewrite the header to inject their script (Kaspersky…) used to add a restrictive `script-src` that blocked WebAssembly; they now only append their host. When it still happens, the emulator names the antivirus and explains what to do.

## 1.6.0

### Search
- Suggestions redesigned: the panel fades / slides open, its height follows the results smoothly and results appear one after another, with the article cover, highlighted title, an excerpt around the match, date and tags, plus keyboard hints. One or two letters match the start of words only (no more highlighted letters everywhere). The search index now carries the covers.

### GBA emulator
- **Menu** (F1, or ☰ on touch screens): ROM from this computer, continue the last game, optional **server library** (`theme_config.gba.library`, JSON list, filter, download with a progress bar: %, size, speed, cancel), settings; in game: resume, save / load state, reset, saves.
- **Saves on your computer**: download / import `.sav`, and in Chrome / Edge link a `.sav` file that is updated automatically while playing and read back next time.
- **Settings**: key bindings for every action, smoothing (anti-aliasing), pixel-perfect scaling, scanlines, colour correction, frame blending, FPS counter, volume / mute, fast-forward speed.
- `.zip` ROMs, `.sav` drag & drop, `gba settings`. Core options can now change while playing (`gba_set_option`).
- Engine: `integerScale` and `pauseOverlay` game options, `g.relayout()`.

## 1.5.1

- **Softer light theme**: muted "paper" blue-grey surfaces instead of near-white ones, softer ink for the text, lighter shadows and background particles. Still WCAG AA everywhere (axe-core: 0 violations).
- The terminal "screenshots" in articles now follow the light theme (they stayed dark), and inline-code styling no longer leaks into code blocks in light mode.
- Post header: the reading time and word count no longer show a pill inside the pill.
- Comments: when Disqus is blocked (ad / tracker blocker, tracking prevention) or doesn't answer, a short explanation is shown instead of an empty area.
- Games and the terminal window use the same soft tones in light mode.

## 1.5.0

### Search
- **Instant suggestions** under the navbar search box: matches appear while typing (title hits first, matched words highlighted, date and tags), ↑/↓ + Enter to open one, "See all results" for the full search page. The index is only fetched when the box gets focus. `/` or Ctrl+K focuses the search from anywhere. Accessible combobox, results built without `innerHTML`.

### Terminal
- **Game Boy Advance emulator**: `gba` opens a ROM from your computer (file picker, or drop the file on the terminal), `gba last` reloads the last one. It is **gpSP** — the emulator of the GP2X / PSP scene — compiled to WebAssembly (interpreter core, built-in open-source BIOS), running entirely in the browser: the ROM is never uploaded. Sound, battery saves kept per game, quick states (F2 / F4), fast forward (hold Space), on-screen pad on touch screens, same window / fullscreen as the other games. The emulator (~500 KB) is only downloaded on first use. Sources, build script and licences in `tools/gba-emulator/` (GPL-2.0).
- CSP: `'wasm-unsafe-eval'` on pages with a terminal only (allows compiling WebAssembly, not JavaScript `eval`). Apache / nginx configs serve `.wasm` with the right type, compressed and cached.

## 1.4.0

### Fixes
- **`_data/theme.yml` options now work**: they were injected *before* the theme stylesheet, which overrode them, so colours, fonts, sidebar width, title gradient, Prism theme… had no effect. They are now applied after it, only when set (an empty value keeps the default — the file ships empty, so nothing is injected by default). Custom colours apply to the dark theme; the hover colour is derived automatically.
- Only one Prism theme stylesheet is loaded (the chosen one; both were loaded before).
- `posts.reading_speed` and `posts.excerpt_words` are now used; the unused `layout.section_gap` option was removed.
- Disqus reloads in the right colours after a dark/light switch.
- The floating table of contents closes when a heading is picked (it covered the text on phones).

### Accessibility
- Colour contrast raised to **WCAG AA** everywhere (automated check with axe-core: 0 violations on the main pages, both themes): muted text, links, tags, buttons, status badges, callouts and code colours in the light theme. New `--on-accent` token for text on accent backgrounds.
- Footer headings are `h2` (heading order).

### Performance & privacy
- **Fonts self-hosted** (Inter and JetBrains Mono variable fonts, latin + latin-ext, preloaded): no more request to Google Fonts. Google Fonts is only used — and allowed in the CSP — when you pick another font.
- Terminal commands and games (~150 KB of JS) are only loaded on pages with a terminal (`terminal: true` in front matter to add one elsewhere). The `window.Terminal` registry still exists on every page.
- No CSS source map in production builds (109 KB, and it exposed the SCSS sources).
- Reading time and word count computed at build time (no JavaScript, no layout shift); `reading-stats.js` removed.
- Background canvas: particles and links drawn in a handful of batched paths per frame instead of thousands of draw calls.
- Search index normalised once instead of on every keystroke; terminal output scrolls once per frame.
- Stricter CSP: jsDelivr only on pages using Mermaid / MathJax, Google Fonts only for custom fonts.
- The browser UI colour (`theme-color`) follows the site theme, not only the OS setting.

### Housekeeping
- All remaining French comments and texts translated to English; dead `assets/js/main.js` removed; duplicate light-theme code-block rules removed.
- Deprecated `interest-cohort` removed from `Permissions-Policy` (browsers logged a warning).
- GitHub Pages workflow installs `rsvg-convert`, so generated covers also get PNG social-card images on the demo.

## 1.3.0

### Terminal games
- New **game engine** `ctx.createGame(spec)`: every game gets the same window, sized to the viewport and the hero frame; in fullscreen the game is scaled up to the whole window (HiDPI-sharp, letterboxed). Fixed 60 Hz update (games no longer run faster on 120/144 Hz screens), pause (`P`, also when the tab is hidden), replay (`R`), best score per game, live resize, all listeners removed on exit.
- **Snake**: speed in moves/second, buffered turns, golden apple bonus.
- **Pong**: speeds in px/second, ball speeds up on each hit, smarter AI (bounce prediction, aiming error), first to 7.
- **Tetris**: 7-bag, wall kicks, hold piece (`C`), ghost piece, lock delay, level gravity, line-clear flash, hard/soft drop scoring.
- **Pac-Man**: smooth movement, buffered turns, ghosts actually leave their house (the door was a dead end), scatter/chase modes, chained ghost scores, levels.
- Rendering optimised: static parts cached offscreen, no per-cell `shadowBlur`.
- New game: **2048** (arrows / WASD / swipe, animated tiles).
- The game window scrolls into view when a game starts; the hero no longer fades out or shifts while playing.

### Terminal commands
- New: `sl`, `hack`, `fortune`, `cowsay`, `joke`, `8ball`, `flip`, `roll`, `rps`, `sudo`, `neofetch`, `whoami`, `date`, `uptime`, `echo`, `history`, `theme`, `ls` (list articles) and `open <n>` (open one).
- Command arguments keep their case (`echo Hello`); `/help` is sorted by command.
- New API: `ctx.createGame()`, `ctx.history()`, `ctx.neofetch()`.

## 1.2.0

### Terminal
- **Phones**: the terminal is no longer shown at page load (pure CSS, no flash). An *Open terminal* button opens it full screen, sized to the visual viewport so the on-screen keyboard never covers the prompt. Bigger touch targets, no iOS zoom on focus.
- **Touch controls** for games: swipe → arrow keys, tap / drag per game (`touch` option in `Terminal.register`), on-screen *quit* button.
- **Desktop**: double-click the title bar for fullscreen; closing the terminal leaves an *Open terminal* button to bring it back (it used to disappear until reload).
- Boot screen can show a **logo image** instead of the ASCII art (`terminal_boot.image`); ASCII art is skipped on narrow phones.
- `/help` table fixed (misaligned right border) and shown as a compact list on phones.
- New options under `theme_config.terminal`: `mobile`, `launcher_label`, `autofocus`, `persist_history`, `welcome_command`, `disabled_commands`, `max_input`, `max_lines`.
- New API: `Terminal.open()`, `Terminal.close()`, `ctx.isTouch()`, `ctx.isPhone()`. Existing API unchanged.

### Home page
- The hero title can be replaced by a **logo image** (`theme_config.hero.logo`, optional `logo_dark` variant), a custom title/subtitle, or a fully custom include (`hero.include`).

### Security
- **Content-Security-Policy `<meta>` tag** for production builds (GitHub Pages cannot send headers). Third-party hosts are only allowed when the matching feature is configured; extra hosts via `security.csp_extra`.
- The terminal no longer injects `<style>` elements (custom colors use CSS variables).
- Terminal input: length limit, control characters stripped from pasted text, persisted history validated on load, boot logo limited to same-origin / `https` URLs.
- Terminal boot values from `_config.yml` are HTML-escaped in the page `<head>`.

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
