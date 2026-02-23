# Open Source Preparation Checklist

This document helps prepare `papirus` for public open-source release.

## 1. Legal and Metadata

- [ ] Verify `LICENSE` is present and correct
- [ ] Verify dependency license compatibility
- [ ] Keep `repository`, `bugs`, `homepage` fields up to date in `package.json`
- [ ] Verify npm package metadata (`description`, `keywords`, `files`)

## 2. Security Readiness

- [ ] Keep `SECURITY.md` and `SECURITY.ru.md` up to date
- [ ] Verify no credentials or private tokens are committed
- [ ] Validate examples and docs do not expose sensitive data

## 3. Documentation Baseline

- [x] `README.md` + `README.ru.md`
- [x] `CONTRIBUTING.md` + `CONTRIBUTING.ru.md`
- [x] `SECURITY.md` + `SECURITY.ru.md`
- [x] `CODE_OF_CONDUCT.md` + `CODE_OF_CONDUCT.ru.md`
- [x] API docs under `docs/`
- [ ] Add migration notes for major API changes (if needed)

## 4. Build and Quality Gate

- [ ] CI for lint/typecheck/test/build
- [ ] Optional bundle size checks
- [ ] npm dry-run package check in CI

Recommended checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm pack --dry-run
```

## 5. Release Process

- [ ] Keep `CHANGELOG.md` updated
- [ ] Tag releases as `vX.Y.Z`
- [ ] Publish with immutable npm tags
- [ ] Verify generated `dist` artifacts and exported types

## 6. Repository Hygiene

- [ ] Issue templates are up to date
- [ ] PR template is up to date
- [ ] Main branch protection rules are configured
- [ ] Contribution flow is documented and current
