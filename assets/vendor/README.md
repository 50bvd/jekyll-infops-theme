# Vendored front-end libraries

Served from the site itself (no CDN at runtime): works behind DNS/ad blockers,
under a strict CSP, offline, and without sending visitors' IPs to third parties.

| Library | Version | Source | License |
|---|---|---|---|
| Font Awesome Free | 6.7.2 | npm `@fortawesome/fontawesome-free` (`css/all.min.css`, `webfonts/`) | see `fontawesome/LICENSE.txt` |
| Prism | 1.30.0 | npm `prismjs` (core, autoloader plugin, `components/*.min.js`, themes) | MIT, `prism/LICENSE` |
| Inter (variable) | 5.3.0 | npm `@fontsource-variable/inter` (`latin` + `latin-ext`, `wght-normal`) | SIL OFL 1.1, `fonts/LICENSE-inter.txt` |
| JetBrains Mono (variable) | 5.3.0 | npm `@fontsource-variable/jetbrains-mono` (same subsets) | SIL OFL 1.1, `fonts/LICENSE-jetbrains-mono.txt` |

Files are copied unmodified from the npm packages (the `@font-face` rules live in `_sass/_fonts.scss`). To update:
`npm pack <package>@<version>`, extract, and replace the files here.
