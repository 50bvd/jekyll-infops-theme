---
layout: post
title: "Color Themes — Palettes, Fonts & Code Highlighting"
date: 2025-01-07 10:00:00 +0100
author: "50bvd"
categories: [documentation]
tags: [colors, themes, customization, fonts, prism, _data]
description: "Switch color palettes, change fonts and Prism syntax themes — all from _data/theme.yml, no SCSS needed. Includes 5 ready-to-use palettes."
toc: true
---

jekyll-infops-theme separates **behaviour** (`_config.yml`) from **aesthetics** (`_data/theme.yml`). This post covers everything in `_data/theme.yml`.

---

## How theme variables propagate

`_includes/custom-styles.html` runs at every Jekyll build and produces a `<style id="infops-custom-vars">` block injected into `<head>`. That block sets or overrides CSS custom properties on `:root` and `[data-theme="dark"]`. Because the entire UI is built on these variables, one hex value change cascades everywhere: cards, code blocks, tags, buttons, the terminal, the sidebar.

**Dark / Light mode** is toggled by a class on `<html data-theme="...">` — no full page reload, no flash. The terminal accent color is stored separately in `sessionStorage` so it survives soft navigation but resets on a new tab.

---

## Changing colors

```yaml
# _data/theme.yml
colors:
  accent_blue:   "#58a6ff"   # primary — links, buttons, code highlights
  accent_green:  "#56d364"   # success states, tip callouts, "online" badge
  accent_purple: "#a5a5ff"   # secondary — hover states, gradient mid-point
  accent_red:    "#f85149"   # errors, danger callouts
  accent_yellow: "#e3b341"   # warnings, maintenance badges

  bg_primary:    "#0d1117"   # page background
  bg_secondary:  "#161b22"   # cards, header, sidebar panels
  bg_tertiary:   "#21262d"   # inputs, widget headers, code background
```

{% include callout.html type="tip" title="Contrast check" content="Run your accent colour through [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker) against your background. Aim for ≥ 4.5:1 for body text and ≥ 3:1 for large text/icons." %}

---

## 5 ready-to-use palettes

Copy any block, paste under `colors:` in `_data/theme.yml`, rebuild.

### Default — GitHub dark

The shipping default. Familiar, readable, high-contrast:

```yaml
colors:
  accent_blue:   "#58a6ff"
  accent_green:  "#56d364"
  accent_purple: "#a5a5ff"
  accent_red:    "#f85149"
  accent_yellow: "#e3b341"
  bg_primary:    "#0d1117"
  bg_secondary:  "#161b22"
  bg_tertiary:   "#21262d"
```

### Cyberpunk — violet + pink

Vivid, high contrast, cyberpunk aesthetic:

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

### Ocean — deep blue

Cool deep-sea blues with warm accent:

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

### Forest — dark green

Earthy, calm, nature-inspired:

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

The classic Ethan Schoonover palette:

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

---

## Fonts

```yaml
fonts:
  sans: ""   # empty = Inter
  mono: ""   # empty = JetBrains Mono
```

Any Google Fonts name works. The theme builds the font URL with only the weights it uses and appends `&display=swap`.

**Recommended pairings:**

| Sans | Mono | Vibe |
|---|---|---|
| Plus Jakarta Sans | Fira Code | Modern SaaS |
| Outfit | Cascadia Code | Friendly, geometric |
| DM Sans | IBM Plex Mono | Technical, editorial |
| Geist | JetBrains Mono (default) | Vercel-inspired |
| Inter (default) | Source Code Pro | Classic, neutral |

---

## Prism.js code theme

```yaml
code:
  theme: "prism-tomorrow"
```

| Value | Description |
|---|---|
| `prism-tomorrow` | Dark, muted — default. Pairs well with all dark palettes |
| `prism-okaidia` | Dark, saturated — Monokai-inspired |
| `prism-solarizedlight` | Warm light background |
| `prism-twilight` | Dark with purple tones |
| `prism-coy` | Minimal light |

The CRT scanline effect and blue phosphor glow in code blocks are rendered in CSS on top of Prism's base theme — they persist regardless of which Prism theme you choose.

---

## Hero gradient

```yaml
hero:
  title_gradient: "linear-gradient(135deg, #58a6ff 0%, #a5a5ff 50%, #56d364 100%)"
```

The gradient applies to the site title text via `-webkit-text-fill-color: transparent` + `background-clip: text`. Use [cssgradient.io](https://cssgradient.io) to create and preview gradients interactively, then paste the CSS value here.

---

## Live terminal color

The `color` command lets visitors recolour the entire terminal at runtime — no rebuild needed:

```
color green        # preset: green, blue, purple, orange, red, cyan, yellow, pink, white
color #e879f9      # any 6-digit hex
color reset        # back to the theme's accent_blue
```

The chosen color is saved in `sessionStorage` and restored on page reload. It drives every terminal element: text output, cursor, prompt, pulse dot, scanline tint, and window border — all via `rgba(var(--term-color), ...)`.
