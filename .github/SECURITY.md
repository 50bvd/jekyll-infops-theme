# Security policy

## Supported versions

Only the latest release of the theme (the `main` branch) receives fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: **Security → Report a vulnerability**
on this repository. You will get an answer within a few days; once a fix is
released, the report is published as a security advisory (with credit, if you
wish).

Useful details: the affected file or feature, how to reproduce it, the impact
you see, and the browser / server setup when relevant.

## Scope

- the theme itself: layouts, includes, JavaScript, the generated
  Content-Security-Policy, the Apache / nginx / Docker configurations;
- the terminal's GBA emulator frontend (`assets/js/terminal-commands/gba*.js`,
  `tools/gba-emulator/`). Bugs in gpSP itself belong upstream
  (https://github.com/libretro/gpsp), but reports are welcome here too.

Third-party services a site enables (Disqus, GoatCounter…) are out of scope.
