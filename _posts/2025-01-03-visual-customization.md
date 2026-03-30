---
layout: post
title: "Visual Customization — Colors, Fonts & Layout"
date: 2025-01-03 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [customization, colors, fonts, _data, themes]
description: "Customize the theme's colors, fonts and layout without touching any SCSS — everything lives in _data/theme.yml."
toc: true
---

The entire visual appearance of jekyll-infops-theme is controlled by two files: `_config.yml` (behaviour) and `_data/theme.yml` (aesthetics). You never need to touch the SCSS.

---

## How the theming pipeline works

At build time, `_includes/custom-styles.html` reads `_data/theme.yml` and injects a `<style id="infops-custom-vars">` block that overrides CSS custom properties defined in `_sass/_themes.scss`. Because CSS variables cascade, every component picks up the change automatically — cards, code blocks, tags, the terminal, the sidebar widget.

The result: **change a hex value → rebuild → done.**

---

## Fonts

```yaml
fonts:
  sans: ""   # leave empty for Inter (default)
  mono: ""   # leave empty for JetBrains Mono (default)
```

Any [Google Fonts](https://fonts.google.com) name works. The theme requests only the weights it actually uses (300–900 for sans, 400/500/700 for mono), so page weight stays minimal.

```yaml
# Examples
fonts:
  sans: "Plus Jakarta Sans"
  mono: "Fira Code"
```

{% include callout.html type="tip" title="Font pairing ideas" content="**Sans**: Plus Jakarta Sans, Outfit, DM Sans, Geist — all read well at small sizes. **Mono**: Fira Code and Cascadia Code have ligatures (`!=` → `≠`, `->` → `→`) that look great in code blocks." %}

---

## Colors

```yaml
colors:
  # Accents
  accent_blue:   "#58a6ff"   # links, buttons, primary highlights
  accent_green:  "#56d364"   # success, tips callouts, "online" status
  accent_purple: "#a5a5ff"   # secondary accent
  accent_red:    "#f85149"   # errors, danger callouts
  accent_yellow: "#e3b341"   # warnings, maintenance status

  # Backgrounds (dark mode — ignored in light mode)
  bg_primary:    "#0d1117"   # page background
  bg_secondary:  "#161b22"   # cards, header, sidebar
  bg_tertiary:   "#21262d"   # inputs, hover states, code background
```

{% include callout.html type="info" title="Light mode backgrounds" content="Light mode surfaces are built into `_sass/_themes.scss` as blue-grey tints. They are not controlled by `_data/theme.yml` — override them in `_sass/_themes.scss` if needed." %}

### Terminal color at runtime

The accent color also drives the terminal — every element (text, cursor, prompt, pulse dot) uses `rgba(var(--term-color), ...)`. Users can change it live without rebuilding:

```
color green        # named preset
color #FF6B35      # any hex
color reset        # back to theme default
```

---

## Ready-to-use palettes

Paste any block into `_data/theme.yml` under `colors:` and rebuild.

### Default — GitHub-style dark

```yaml
colors:
  accent_blue:  "#58a6ff"
  accent_green: "#56d364"
  bg_primary:   "#0d1117"
  bg_secondary: "#161b22"
  bg_tertiary:  "#21262d"
```

### Cyberpunk (violet + pink)

```yaml
colors:
  accent_blue:   "#b57bee"
  accent_green:  "#f72585"
  accent_purple: "#7209b7"
  accent_red:    "#f72585"
  accent_yellow: "#ffd60a"
  bg_primary:    "#0a0a0f"
  bg_secondary:  "#13131a"
  bg_tertiary:   "#1c1c2e"
```

### Ocean (deep blue)

```yaml
colors:
  accent_blue:   "#00b4d8"
  accent_green:  "#48cae4"
  accent_purple: "#0077b6"
  accent_red:    "#ef233c"
  accent_yellow: "#f4a261"
  bg_primary:    "#03045e"
  bg_secondary:  "#023e8a"
  bg_tertiary:   "#0077b6"
```

### Forest (dark green)

```yaml
colors:
  accent_blue:   "#52b788"
  accent_green:  "#95d5b2"
  accent_purple: "#b7e4c7"
  accent_red:    "#e63946"
  accent_yellow: "#ffd166"
  bg_primary:    "#081c15"
  bg_secondary:  "#1b4332"
  bg_tertiary:   "#2d6a4f"
```

### Solarized Dark

```yaml
colors:
  accent_blue:   "#268bd2"
  accent_green:  "#859900"
  accent_purple: "#6c71c4"
  accent_red:    "#dc322f"
  accent_yellow: "#b58900"
  bg_primary:    "#002b36"
  bg_secondary:  "#073642"
  bg_tertiary:   "#586e75"
```

### Light mode

```yaml
colors:
  accent_blue:   "#0969da"
  accent_green:  "#1a7f37"
  accent_purple: "#6e40c9"
  accent_red:    "#cf222e"
  accent_yellow: "#9a6700"
  bg_primary:    "#ffffff"
  bg_secondary:  "#f6f8fa"
  bg_tertiary:   "#eaeef2"
```

---

## Code block syntax theme

```yaml
code:
  theme: "prism-tomorrow"   # default
```

Available Prism themes (loaded from cdnjs):

| Value | Style |
|---|---|
| `prism-tomorrow` | Dark, muted — default |
| `prism-okaidia` | Dark, vivid — Monokai-like |
| `prism-solarizedlight` | Light, warm |
| `prism-twilight` | Dark, purple tones |
| `prism-coy` | Light, minimal |

---

## Layout dimensions

```yaml
layout:
  max_width:     1400   # container max-width in px (1200–1600)
  border_radius: 12     # card corner radius in px (0 = sharp squares)
  section_gap:   2      # vertical spacing between sections in rem

sidebar:
  width: 320   # sidebar width in px when visible

hero:
  title_gradient: "linear-gradient(135deg, #58a6ff 0%, #a5a5ff 50%, #56d364 100%)"
  min_height: 58   # vh
```

Use [cssgradient.io](https://cssgradient.io) to generate gradient strings visually.

---

## Social links

Edit `_data/social.yml`:

```yaml
links:
  - name:  "GitHub"
    url:   "https://github.com/your-username"
    icon:  "fab fa-github"
    color: "#e6edf3"

  - name:  "LinkedIn"
    url:   "https://linkedin.com/in/your-slug"
    icon:  "fab fa-linkedin"
    color: "#0a66c2"

  - name:  "Mastodon"
    url:   "https://fosstodon.org/@you"
    icon:  "fab fa-mastodon"
    color: "#6364ff"
```

Set `url: ""` to hide any link. The `color` value drives the hover color of the icon in the footer.
