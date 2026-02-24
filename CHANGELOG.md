# Changelog

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.3.13] - 2026-02-24

### Fixed
- Исправлена отрисовка миникарты: рамка миникарты и рамка viewport больше не наследуют пунктир от ранее отрисованных пунктирных рёбер.
- В `MiniMap` добавлен явный сброс `lineDash`/`lineDashOffset` перед отрисовкой рамок, чтобы состояние canvas не «протекало» между элементами.

## [0.3.12] - 2026-02-24

### Added
- Добавлен новый тип пути связи `editable-polyline` с интерактивными точками перелома.
- Для `editable-polyline` добавлены: центральная точка по умолчанию, кнопки `+` на сегментах для вставки новых переломов, удаление точки по двойному клику.
- Добавлены осевые магниты и snap к сетке для редактирования точек перелома.
- Добавлен smart-align узлов при перетаскивании с визуальными направляющими.
- Добавлена настройка `alignToNodes` в `enableInteractions` и runtime-переключатель `interactions.drag.setAlignmentEnabled(...)`.

### Changed
- Обновлены примеры (`basic`, `ports`): добавлена демонстрация `editable-polyline`, переключатели `Align ON/OFF` и `Rulers ON/OFF`, расширено управление snap.
- Обновлена документация (`README.md`, `README.ru.md`, `docs/interactions.md`) с описанием новых интерактивных возможностей.

## [0.3.11] - 2026-02-24

### Fixed
- Исправлено залипание панорамирования canvas при отпускании кнопки мыши вне области canvas: при повторном входе курсора pan-сессия корректно завершается.
- В тестах `InteractionManager` добавлен сценарий для проверки завершения pan после потери `mouseup`.

## [0.3.10] - 2026-02-24

### Fixed
- Исправлено залипание перетаскивания scrollbars/minimap: если кнопка мыши отпущена вне canvas, drag-сессия принудительно завершается при возврате курсора.
- Отключен горизонтальный pan от wheel/trackpad-жестов: прокрутка колесом теперь используется только для zoom.
- Обновлён пример `basic`: удалена устаревшая подсказка про `Shift + wheel` для горизонтального pan.

## [0.3.9] - 2026-02-23

### Fixed
- Исправлен экспорт узловых иконок в `SVG`: иконки теперь корректно попадают в файл экспорта.
- Исправлен `SVG`-экспорт скругления прямоугольников: учитывается runtime-значение `RectangleNode.cornerRadius` (как в canvas-рендере).
- В `SVG`-экспорте узлов учтены дополнительные визуальные параметры: `fillOpacity`, `strokeOpacity`, `lineDash`, `lineDashOffset`.
- Для текстовых меток в `SVG` учтена прозрачность (`TextStyle.opacity`) и позиция метки узла через `getLabelPosition()`.
- Для узловых меток в `SVG` учтены отступы `padding`/`margin` и выравнивание текста (`left`/`center`/`right`).
- Для связей в `SVG` учтены параметры стиля линии: `strokeOpacity`, `lineCap`, `lineJoin`.
- Для меток связей в `SVG` добавлен экспорт фона (`labelBackground`) и улучшено соответствие стилям/позиционированию текста.
- Исправлен порядок слоёв в `SVG`-экспорте: связи и стрелки рендерятся поверх нод (как в canvas-рендерере).

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

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.3.13...HEAD
[0.3.13]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.13
[0.3.12]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.12
[0.3.11]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.11
[0.3.10]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.10
[0.3.9]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.9
[0.3.4]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.4
[0.3.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.3
[0.3.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.2
[0.3.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.1
[0.3.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.0
[0.2.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.2.0
[0.1.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.1.0
