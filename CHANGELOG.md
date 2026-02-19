# Changelog

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.3.4] - 2026-02-19

### Added
- Разрешено создавать self-loop связи (из ноды в саму себя) через `ConnectionManager`.
- Для `polyline` добавлен obstacle-aware ортогональный роутинг с обходом фигур: используется расширение препятствий (`margin = 12`), штраф за повороты и приоритет горизонтального первого шага.
- Для `bezier` добавлены правила self-loop/углового обхода, чтобы путь не проходил под фигурой в коротких локальных связях.

### Changed
- Порядок отрисовки в `DiagramRenderer` обновлён: рёбра теперь рендерятся поверх фигур (nodes), а handles рёбер остаются верхним слоем.
- Специальные правила обхода для `bezier` и `polyline` ограничены self-loop сценариями там, где это требуется.

## [0.3.3] - 2026-02-19

### Fixed
- Исправлен `SVG`-экспорт меток рёбер: при отсутствии `SvgExportOptions.edgeLabelOffset` теперь используется runtime-значение `edge.labelOffset` для каждой связи.

### Added
- В пример `examples/basic` добавлена настройка `Label Offset` для интерактивной регулировки смещения метки ребра.

## [0.3.2] - 2026-02-19

### Fixed
- Исправлен рендер наконечников при экспорте в `SVG` для схем с разными типами маркеров: наконечники теперь выводятся как геометрия (`path`/`circle`), что устраняет проблемы совместимости SVG-viewer'ов с `marker-start/marker-end`.

## [0.3.1] - 2026-02-19

### Fixed
- Исправлен экспорт в `SVG` для новых маркеров рёбер (`startMarker`/`endMarker`): теперь корректно выгружаются наконечники типов `arrow`, `open`, `diamond`, `circle`.
- Добавлен fallback на legacy `arrowType` при экспорте в `SVG`, чтобы поведение совпадало с canvas-рендером.

### Changed
- Изменено поведение подписи рёбер в `SVG`-экспорте: по умолчанию метка рендерится без смещения; для явного смещения добавлена опция `SvgExportOptions.edgeLabelOffset`.

## [0.3.0] - 2026-02-19

### Added
- Публичный API для отключения resize-handles у узлов: `NodeOptions.resizeHandlesEnabled` и свойство `node.resizeHandlesEnabled`
- Публичный API для управления custom-формой: `CustomShapeNodeOptions.shapeType` и свойство `customShapeNode.shapeType`
- Публичные сеттеры `TextLabel.padding` и `TextLabel.margin` для runtime-настройки отступов

### Changed
- Улучшена интеграция с внешними редакторами диаграмм: меньше необходимости обращаться к внутренним полям и `any`-кастам

## [0.2.0] - 2026-02-18

### Added
- Inline-редактирование меток по двойному клику для узлов и рёбер (`InteractionManager`)
- Новые справочные страницы документации: `renderer.md`, `input.md`, `search.md`
- Настройки `Label Pad/Margin` и `Icon Pad/Margin/Gap` в панели `Node Style` примера `basic`

### Changed
- Улучшен layout текста в узлах:
  - перенос по словам учитывает доступную область текста при наличии иконки
  - для круга и ромба используется область вписанного прямоугольника
  - расширение узла происходит только если перенос не решает переполнение
- Обновлены примеры (`basic`, `ports`, `custom-shapes`):
  - улучшены тулбары и иконки
  - добавлены подсказки по inline-редактированию
  - упрощено поведение темы
  - улучшено управление размером canvas после отрисовки страницы
- Расширена документация по интерактивности, оверлеям и элементам

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

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.3.4...HEAD
[0.3.4]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.4
[0.3.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.3
[0.3.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.2
[0.3.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.1
[0.3.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.0
[0.2.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.2.0
[0.1.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.1.0
