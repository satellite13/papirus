# MEMORY

## Papirus Release Playbook

Этот порядок используем для каждого релиза `@ngroznykh/papirus`.

1. Подтянуть и проверить рабочее состояние:
   - `git status --short`
   - убедиться, что в коммит попадут только нужные файлы
2. Внести изменения в код.
3. Поднять версию патча:
   - `npm version X.Y.Z --no-git-tag-version`
4. Обновить `CHANGELOG.md`:
   - добавить секцию `## [X.Y.Z] - YYYY-MM-DD`
   - перечислить ключевые `Fixed/Changed/Added`
   - обновить ссылки внизу:
     - `[Unreleased]` -> `compare/vX.Y.Z...HEAD`
     - добавить `[X.Y.Z]` -> `releases/tag/vX.Y.Z`
5. Прогнать проверки:
   - `npm run typecheck`
   - `npm run build`
   - при необходимости `npm run pack:check`
6. Сделать релизный коммит:
   - `git add CHANGELOG.md package.json package-lock.json <измененные src/*>`
   - `git commit -m "Improve ... and release version X.Y.Z."`
7. Поставить аннотированный тег:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z."`
8. Публикация на npm выполняется вручную владельцем:
   - `npm publish`

## Notes

- Публикацию в npmjs делает пользователь вручную.
- После публикации обновляем зависимость в `warchi` на новую версию и фиксируем `package-lock.json`.

## Message Templates

### Commit message

`Improve <short scope> and release version X.Y.Z.`

Примеры:
- `Improve SVG export fidelity and release version 0.3.9.`
- `Improve edge rendering and release version 0.4.0.`

### Tag

- tag name: `vX.Y.Z`
- annotation: `Release vX.Y.Z.`

Команда:
- `git tag -a vX.Y.Z -m "Release vX.Y.Z."`

### Changelog section template

```md
## [X.Y.Z] - YYYY-MM-DD

### Fixed
- ...

### Changed
- ...
```

### Manual publish checklist

1. `git status --short` -> clean
2. `git log --oneline -1` -> проверить релизный коммит
3. `git tag --list "vX.Y.Z"` -> тег существует
4. `npm publish`
