# Changelog

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Подготовка к open source release
- Добавлены файлы: LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Пакет опубликован в npmjs как `@ngroznykh/papirus`

### Changed
- Обновлены `README.md` и `README.ru.md` под npm-пакет `@ngroznykh/papirus` (бейдж, ссылка, установка и примеры импортов)

## [0.1.0] - 2026-02-18

### Added
- Первый публичный релиз
- `DiagramRenderer` — центральный рендерер с системой координат, масштабированием и панорамированием
- Элементы: `RectangleNode`, `CircleNode`, `DiamondNode`, `CustomShapeNode`, `Edge`, `Group`
- `InteractionManager` с поддержкой drag/select/connect/undo/redo/copy/paste
- `StyleManager` с темами (default, dark) и пользовательскими классами стилей
- `Serializer` для сохранения/загрузки диаграмм в JSON
- `ImageExporter` и `SvgExporter` для экспорта диаграмм
- Оверлеи: `GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`
- Утилиты: `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`
- Поддержка портов (`Port`) и иконок в узлах (`NodeImage`)
- Анимации для рёбер (flow effect)
- Контекстное меню и поиск/фильтрация
- Vue 3 интеграция в `packages/vue`

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.1.0...HEAD
[0.1.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.1.0
