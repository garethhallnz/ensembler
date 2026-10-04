# Contributing to Ensembler

Thanks for your interest in improving Ensembler! Contributions of all kinds are
welcome — bug reports, fixes, features, translations, and documentation.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug** — open an issue using the bug template.
- **Suggest a feature** — open an issue using the feature template.
- **Improve a translation or the docs** — the app ships in several languages
  (`frontend/src/i18n/locales/`) and the in-app docs live in `docs/`.
- **Send a pull request** — see below.

## What's out of scope

Ensembler is content-neutral by design — see the [disclaimer](DISCLAIMER.md).
Contributions that add, preset, recommend, or link to content sources
(indexers, trackers, or lists of either) are out of scope and will be closed,
as will issues or discussions asking for help finding or choosing sources.

## Development setup

You need [Node.js](https://nodejs.org/) 20+, npm, and a Docker-compatible runtime
(Docker Desktop, OrbStack, Podman, …). Then:

```bash
git clone https://github.com/garethhallnz/ensembler.git
cd ensembler
npm run install-deps      # installs root, backend, and frontend deps
```

### Running it

**Browser mode — your everyday workflow** (backend + frontend together):

```bash
npm run dev               # open http://localhost:5180
```

**Electron mode — only when the issue is about the desktop/packaged app** (window
behaviour, file paths, backend spawning):

```bash
npm run dev-electron      # stop `npm run dev` first — both use port 5180
```

> **Gotcha worth knowing:** the two modes store data in **different** folders.
> Browser mode uses `~/.ensembler`; Electron and the packaged app use the OS
> per-user data dir (e.g. macOS `~/Library/Application Support/Ensembler`). If a
> bug reproduces in the packaged app but not the browser, run it in Electron mode.

### Tests, types, and lint

```bash
cd backend && npm test    # backend unit + integration tests (Jest)
cd frontend && npm test   # frontend tests (Vitest)
cd frontend && npx tsc -b # type-check
cd frontend && npm run lint
```

Please make sure tests, `tsc`, and lint are clean before opening a PR.

## Pull requests

1. Branch off `main` (the default branch).
2. Keep each PR focused on one logical change.
3. Add or update tests for anything you change; keep the suite green.
4. Update the docs (`docs/`) and translations if you change user-facing behaviour
   or strings. English (`en.json` / `docs/*.md`) is the source; other languages
   follow.
5. Use clear, present-tense commit messages ("Add …", "Fix …").
6. Open the PR against `main` and fill in the template.

## Coding conventions

- **Frontend:** React 19 + TypeScript, Tailwind, Flowbite. No `any`; prefer
  early returns and small, single-responsibility components/hooks.
- **Backend:** Express + TypeScript. Keep the HTTP layer thin; put logic in the
  `services/` modules.
- Match the style of the surrounding code.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
