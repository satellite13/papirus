---
name: release-papirus
description: Executes the release cycle for papirus: bump version, update CHANGELOG, checks, commit, tag. User publishes to npm manually. Use when the user asks to release papirus, make a release, or publish papirus.
---

# Релиз papirus

Для papirus **«релизим»** — это полный цикл: подъём версии → CHANGELOG → проверки → коммит → тег. Публикацию в npm пользователь выполняет вручную.

## Чеклист с командами

Выполнять по порядку.

### 1. Проверить состояние

- `cd /path/to/papirus`
- `git status --short`
- Убедиться, что в релиз входят только нужные изменения

### 2. Поднять версию

- Обновить `version` в `package.json` (патч: X.Y.(Z+1), минор: X.(Y+1).0, мажор: (X+1).0.0)
- `npm version X.Y.Z --no-git-tag-version` (флаг — тег ставим отдельно после коммита)
- Если изменения маленькие — патч, если большие — мажор или минор по семантике

### 3. Обновить CHANGELOG.md и CHANGELOG.ru.md

- Добавить секцию `## [X.Y.Z] - YYYY-MM-DD` перед `[Unreleased]`
- Заполнить Fixed / Changed / Added
- Обновить ссылки внизу: `[Unreleased]`, `[X.Y.Z]`
- Включать только функциональные изменения, не технические детали (например, «обновили зависимости» не для CHANGELOG)

### 4. Проверки перед релизом

- `npm run lint` (при ошибках — `npm run lint:fix`)
- `npm run typecheck`
- `npm run test`
- `npm run build`
- При необходимости: `npm run pack:check`

### 5. Релизный коммит

- `git add CHANGELOG.md CHANGELOG.ru.md package.json package-lock.json <прочие релизные файлы>`
- `git commit -m "Improve <short scope> and release version X.Y.Z."`

### 6. Аннотированный тег

- `git tag -a vX.Y.Z -m "Release vX.Y.Z."`

### 7. Публикация (пользователь вручную)

- `git push`
- `git push --tags`
- Пользователь: `npm publish`

### 8. Проверка и обновление warchi

- `git log --oneline -1`
- `git tag --list "vX.Y.Z"`
- Обновить зависимость в warchi на новую версию, зафиксировать `package-lock.json`
- **Важно для warchi:** при переключении с `file:../papirus` на npm — выполнить `rm -rf node_modules package-lock.json && npm install`, иначе Docker-сборка падает с `TS2307: Cannot find module '@ngroznykh/papirus'`

## Заметки

- Публикацию в npm выполняет пользователь сам.
- Шаблон коммита и тега: `Release vX.Y.Z.`
