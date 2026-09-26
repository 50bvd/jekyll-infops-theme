# Contributing

Thanks for taking the time to contribute! Bug reports, fixes, docs and ideas
are all welcome.

## Branches

| Branch | Role |
|---|---|
| `main` | the theme and its GitHub Pages demo. Protected: changes go through pull requests. |
| `site/perso` | the author's own site (50bvd.com), built from `main`. Never merged into `main`. |
| `feat/…`, `fix/…`, `perf/…`, `docs/…`, `chore/…` | short-lived branches for pull requests, deleted once merged. |

## Workflow

1. Fork the repository (or create a branch if you have write access) from `main`.
2. Make a focused change: one topic per pull request.
3. Check it locally (below), update `CHANGELOG.md` when users will notice the change.
4. Open a pull request against `main` and fill in the template. CI must be green.

Pull requests are squash-merged: the PR title becomes the commit message, so
make it a clear, imperative sentence (`Fix search suggestions on mobile`).

## Local checks

```bash
bundle install
bundle exec jekyll serve          # http://localhost:4000/jekyll-infops-theme/
bundle exec jekyll build          # what CI runs
```

No Ruby? `docker compose up` serves the site with live reload (see
`docker/README-docker.md`).

Before opening the pull request:

- the site builds without warnings;
- pages still work in the dark **and** light themes, on a phone width too;
- keyboard navigation and contrast still pass (the theme targets WCAG 2.1 AA);
- no inline script or style that the Content-Security-Policy would block
  (`_includes/csp.html`);
- shell scripts pass `shellcheck`, JavaScript passes `node --check`.

## Style

- Match the surrounding code: 2-space indentation, same comment density, same naming.
- JavaScript is plain ES5/ES2015 without a build step; no new dependency
  without a good reason.
- Repository content (code, comments, docs, commits) is written in English.

## GBA emulator

`assets/vendor/gpsp/` is generated: change `tools/gba-emulator/` and run
`./tools/gba-emulator/build.sh` (Emscripten), then commit the new build.
gpSP and the frontend are GPL-2.0; the rest of the theme is MIT.

## Security

Please report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## Code of conduct

Be kind and constructive, see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
