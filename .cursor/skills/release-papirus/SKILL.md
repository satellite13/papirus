---
name: release-papirus
description: Выполняет релиз пакета @ngroznykh/papirus по playbook: версия, CHANGELOG, проверки, коммит, тег. Публикацию в npm пользователь делает вручную. Использовать при запросе релиза papirus, публикации версии или «релизим papirus».
---

# Релиз Papirus

Пошаговый порядок для каждого релиза `@ngroznykh/papirus`. Публикацию в npm выполняет пользователь вручную.

## Чеклист

- [ ] Подтянуть и проверить рабочее состояние
- [ ] Поднять версию
- [ ] Обновить CHANGELOG.md (и CHANGELOG.ru.md)
- [ ] Прогнать проверки
- [ ] Релизный коммит
- [ ] Поставить тег
- [ ] (Пользователь) `npm publish`

## Шаги

### 1. Проверить состояние

```bash
cd /path/to/papirus
git status --short
```

Убедиться, что в коммит попадут только нужные файлы. При необходимости поправить код.

### 2. Поднять версию

Патч: `X.Y.(Z+1)`. Минор: `X.(Y+1).0`. Мажор: `(X+1).0.0`.

```bash
npm version X.Y.Z --no-git-tag-version
```

Флаг `--no-git-tag-version` — тег ставим отдельно после коммита.

### 3. Обновить CHANGELOG

**CHANGELOG.md** и **CHANGELOG.ru.md**:

- Добавить секцию **перед** `[Unreleased]`:

```md
## [X.Y.Z] - YYYY-MM-DD

### Fixed
- ...

### Changed
- ...

### Added
- ...
```

- Внизу файла обновить ссылки:
  - `[Unreleased]`: `compare/vX.Y.Z...HEAD` (или оставить `...HEAD` для текущей ветки)
  - Добавить: `[X.Y.Z]`: `releases/tag/vX.Y.Z` (или `compare/vA.B.C...vX.Y.Z`)

Дату брать текущую (YYYY-MM-DD).

### 4. Проверки

```bash
npm run typecheck
npm run test
npm run build
```

При необходимости: `npm run pack:check` (dry-run упаковки).

### 5. Релизный коммит

```bash
git add CHANGELOG.md CHANGELOG.ru.md package.json package-lock.json
# плюс изменённые src/* и прочие файлы релиза
git commit -m "Improve <short scope> and release version X.Y.Z."
```

**Шаблон сообщения коммита:** `Improve <short scope> and release version X.Y.Z.`

Примеры:
- `Improve SVG export fidelity and release version 0.3.9.`
- `Improve edge rendering and release version 0.4.0.`

### 6. Тег

Аннотированный тег:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z."
```

Имя тега: `vX.Y.Z`. Аннотация: `Release vX.Y.Z.`

### 7. Публикация (вручную)

Пользователь выполняет сам:

1. `git status --short` — чисто
2. `git log --oneline -1` — убедиться, что последний коммит релизный
3. `git tag --list "vX.Y.Z"` — тег есть
4. `npm publish`

## После публикации

Обновить зависимость в **warchi** на новую версию и зафиксировать `package-lock.json`.

## Шаблоны

| Что | Формат |
|-----|--------|
| Коммит | `Improve <scope> and release version X.Y.Z.` |
| Тег | `vX.Y.Z` |
| Аннотация тега | `Release vX.Y.Z.` |
| Секция CHANGELOG | `## [X.Y.Z] - YYYY-MM-DD` + Fixed/Changed/Added |
