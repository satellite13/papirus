# Changelog

[English version](./CHANGELOG.md)

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.7.2] - 2026-07-24

### Исправлено
- У composite-нод отрисовываются интерактивные `badges` (те же иконки в левом верхнем углу, что у обычных нод).

## [0.7.1] - 2026-07-21

### Исправлено
- Смена типа пути связи сразу пересчитывает геометрию (bezier → straight больше не оставляет старые контрольные точки визуально).
- При `lockAnchors: false` концы «плавают» к ближайшему порту/контуру в сторону другого конца, а не остаются на сохранённом порте и не уходят в центр ноды.

## [0.7.0] - 2026-07-21

### Добавлено
- Конец связи может крепиться к другой связи через `edgeId` + `pathParam` (junction / note→relation).
- `ConnectionManager` завершает протягивание связи drop’ом на путь существующего ребра.
- Хелперы `Edge.getPointAt` / `getClosestPointOnPath` и `docs/edge-endpoints.md`.

### Изменено
- `EdgeEndpointUpdater` считает концы на рёбрах вторым проходом после node-привязок.

## [0.6.5] - 2026-07-14

### Добавлено
- Типизированный `onClick` у composite `CComponent`.
- Публичные экспорты path strategies, batching для property-change history и дополнительные geometry helpers.

### Изменено
- Общая загрузка и tinting SVG для иконок узлов/composite и SVG-экспорта.
- `MiniMap` наследует `BaseOverlay`.

### Documentation
- Расширена `docs/`: новый `composite.md`, обновлены разделы API/elements/interactions/overlays/renderer/utils и индекс; исправлены примеры на `bindToProperty: '__name__'`; описаны бейджи, типы маркеров, хуки `DiagramPlugin` для указателя, события контрольных точек `ConnectionManager` и сериализация composite.

## [0.6.4] - 2026-06-02

### Исправлено
- Экспорт SVG для `CompositeNode` с `shapeType: 'custom'` теперь рисует кастомный контур через `svgPath`, а не подставляет прямоугольник.

## [0.6.3] - 2026-04-07

### Исправлено
- Экспорт SVG для подписей связей теперь соответствует canvas-отрисовке: учитывается поворот по `labelFollowPath`, а при `labelLineGap` в экспортируемом пути связи создаётся разрыв под меткой.

## [0.6.2] - 2026-03-31

### Добавлено
- Тип маркера ребра `square` для `startMarker` / `endMarker`: отрисовка на canvas, экспорт в SVG, значение по умолчанию в `MARKER_SIZES`.

## [0.6.1] - 2026-03-31

### Изменено
- В composite-`CText` привязка к отображаемому имени использует `bindToProperty: '__name__'` вместо устаревшего `role: 'name'`; обновлены десериализация, обработка взаимодействий, примеры и тесты.

### Документация
- Расширены README, API/elements и примеры по `CompositeNode`, опциям меток ребра (`labelPosition`, `labelFollowPath`, `labelLineGap`) и связанным элементам UI в демо basic и composite.

## [0.6.0] - 2026-03-31

### Добавлено
- Новый `CompositeNode` с flex-layout для сложных элементов нотации (BPMN, ArchiMate, C4, UML), включая примеры композиций в стиле swimlane и status card.
- Новые опции меток ребра: `labelPosition` и `labelFollowPath` для более точного управления размещением подписи.
- В сериализацию composite-компонентов добавлены поля `label`, `bindToProperty` и `bindsNotationIcon` в `SerializedCComponent`.

### Исправлено
- Отрисовка ребра с `labelOffset`/`labelLineGap` теперь корректно учитывает поворот метки.
- SVG-экспорт текста в composite-узлах теперь стабильно использует перенос строк; поведение auto-size при измерении исправлено, чтобы не раздувать размеры в примерах.

## [0.5.9] - 2026-03-25

### Исправлено
- `SvgExporter`: при экспорте связи в SVG больше не рисуется лишняя концевая стрелка из legacy `arrowType`, если заданы явные `startMarker` / `endMarker`, а на одном или обоих концах указано `none` (поведение согласовано с отрисовкой на canvas). Добавлены регрессионные тесты.

## [0.5.8] - 2026-03-25

### Добавлено
- Хуки плагинов диаграммы для перехвата указателя оверлеями: опциональные `beginOverlayDrag` / `updateOverlayDrag` / `endOverlayDrag` и `blocksDiagramPointerAtScreen` у `DiagramPlugin` (используются в `MiniMap` и проходят через `DiagramRenderer`).
- События `ConnectionManager`: `controlPointDragStart` и `controlPointDragEnd` при перетаскивании контрольных точек полилинии/безье (для хост-приложений, например совместного редактирования).

### Изменено
- `InteractionManager`, `ConnectionManager`, `ResizeManager`, `SelectionManager` и `ContextMenuManager` учитывают блокировку указателя оверлеями, чтобы миникарта и аналогичные оверлеи стабильно получали клики и перетаскивания.
- `MiniMap`: реализованы сессии overlay-drag и проверка попадания в экранных координатах по новому контракту плагина.

## [0.5.7] - 2026-03-25

### Изменено
- Документация и примеры в README приведены в соответствие с текущим публичным API и рекомендациями для мейнтейнеров (AGENTS, renderer и utils).

## [0.5.6] - 2026-03-17

### Добавлено
- Опция `previewPathType` в `enableInteractions()` для настройки типа превью-связи при протягивании новой стрелки: `'bezier'` (по умолчанию) или `'straight'`.

### Изменено
- Обновлены docs и примеры в README для `previewPathType`.
- Добавлены тесты для обоих режимов превью связи.

## [0.5.5] - 2026-03-15

### Изменено
- Уточнена и стандартизирована внутренняя документация по workflow релиза для мейнтейнеров.

## [0.5.4] - 2026-03-04

### Изменено
- InteractionManager: рефакторинг обработки mouse down; в режиме `navigationOnly` приоритет у навигации (panning), а не выделения; упрощены условия запуска прямоугольника выделения и сброса выделения.

## [0.5.3] - 2026-03-03

### Добавлено
- Опция `alignmentScreenTolerance` в `enableInteractions()`: расстояние в пикселях экрана, в пределах которого при перетаскивании срабатывают направляющие выравнивания. Если не задана, используется значение по умолчанию из `ALIGNMENT_SCREEN_TOLERANCE` (8). Позволяет приложению (например warchi) задать большее значение (например 80) для удобства выравнивания.

### Изменено
- Константа `ALIGNMENT_SCREEN_TOLERANCE` снова 8; переопределение через опции при необходимости.
- Документация: опция `alignmentScreenTolerance` описана в `docs/interactions.md`.

## [0.5.2] - 2026-03-03

### Добавлено
- Опция ребра `labelLineGap`: при `true` и наличии метки линия не рисуется в области метки (разрыв под подписью). Поддержка в сериализации, истории и буфере обмена. В `utils/geometry` добавлена функция `segmentRectIntersections`.

### Изменено
- Документация: опции ребра (`labelOffset`, `labelLineGap`) и пример в `docs/elements.md`; в `docs/README.md` упомянут `labelLineGap`.

## [0.5.1] - 2026-03-03

### Изменено
- ContextMenuManager: расширены опции отображения иконок в пунктах контекстного меню.

## [0.5.0] - 2026-03-02

### Добавлено
- Интерактивные свойства узлов: редактирование пользовательских свойств в панели выделения (feature/interactive-properties).

## [0.4.0] - 2026-03-01

### Добавлено
- Настройки компоновки контента узла: `contentInset`, `label.inset`, `placement`/`inset` у иконки, а также `labelBackground` у подписи связи в runtime/сериализации/экспорте.
- Расширены настройки в примере `basic` для управления компоновкой меток узлов/связей и фоном подписи связи.

### Изменено
- Рефакторинг inner-layout узла и поведения SVG-экспорта для корректного размещения текста, иконки и контентной области.
- Актуализированы README (EN/RU) и документация по использованию нового layout API.

### Исправлено
- Улучшено обновление панели стилей при смене выделения: настройки отображаются консистентно.

## [0.3.23] - 2026-03-01

### Добавлено
- Стиль узла: добавлена поддержка размещения иконки и связанные параметры компоновки.
- В примере `basic` добавлены настройки inset для содержимого/метки и inset/radius фона метки связи.

### Изменено
- Рефакторинг inner-layout узла и логики SVG-экспорта для корректного позиционирования текста, иконки и области контента.
- Обновлены документация и примеры по новым настройкам компоновки контента.

### Исправлено
- Улучшено обновление панели стилей при смене выделения (refresh selected panel).

## [0.3.22] - 2026-02-28

### Исправлено
- TextLabel: защита от `undefined` в `text` — при отсутствии или присвоении `undefined` (например из опций лейбла при десериализации) больше не возникает `TypeError: undefined is not an object (evaluating 'this._text.split')`. В конструкторе и сеттере используется `?? ''`, в `measure()` — безопасное разбиение по строкам.

## [0.3.21] - 2026-02-27

### Fixed
- Горячие клавиши (Ctrl+Z/Y/C/V) работают при любой раскладке: используется `event.code` вместо `event.key` для буквенных клавиш.

## [0.3.20] - 2026-02-27

### Fixed
- Инвалидация кэша `_canvasRect` каждый кадр: `screenToWorld`/`worldToScreen` корректно учитывают изменения layout (например, изменение размера панелей вокруг canvas без изменения размеров самого canvas).

## [0.3.19] - 2026-02-27

### Fixed
- При смене типа связи с `editable-polyline` на `bezier`/`straight`/`polyline` точки перелома теперь удаляются.
- Убран type casting для `attachToOutline` в ConnectionManager.

### Changed
- Рефакторинг: `mergeBounds`, `clonePoints` в geometry; константы для tolerance; `hasEditableControlPoints`, `getPathVertices` в Edge.
- Оптимизация `resolveAlignmentDelta`: проверка только узлов в области перетаскивания.
- Оптимизация итерации edges в ConnectionManager (обратный цикл вместо `reverse()`).

### Added
- Тесты для ConnectionManager: создание связи (attachToOutline), reconnect.
- Снижены пороги coverage (lines/statements 48%, branches/functions 39%).

## [0.3.18] - 2026-02-27

### Fixed
- При `attachToOutline` стрелка для `CustomShapeNode` следует контуру фигуры (Path2D), а не описанному прямоугольнику.

## [0.3.17] - 2026-02-27

### Added
- `CustomShapeNodeOptions.svgPath` — опция для корректного SVG-экспорта custom shapes. Path2D нельзя конвертировать в SVG, поэтому `svgPath` задаётся отдельно (строка или фабрика `(w, h) => string`).
- `ShapeFactories.svg` — готовые SVG path для hexagon, parallelogram, cylinder, document, chamfered.
- `CustomShapeNode.getSvgPath()`, `setSvgPath()` — доступ к SVG path для экспорта.
- `TextLabel.getWrappedLines(ctx, maxWidth)` — получение текста, перенесённого по словам, для SVG-экспорта.
- `Node.getLabelBoundsForExport(ctx)` — bounds и строки метки для SVG-экспорта (с учётом иконки и placement).

### Fixed
- SVG-экспорт меток узлов: текст теперь переносится по словам (как на canvas), а не выводится в одну строку.
- SVG-экспорт меток: расположение текста (с учётом иконки, labelPlacement, getLabelContainerBounds) совпадает с отрисовкой на canvas.

## [0.3.16] - 2026-02-26

### Fixed
- Учёт `fillOpacity` и `strokeOpacity` при отрисовке `CustomShapeNode` и `DiamondNode` (ранее применялись только в SVG-экспорте).

## [0.3.15] - 2026-02-26

### Added
- Опция `contentMargin` в `MiniMap`: отступ (в мировых координатах) вокруг контента, расширяет область перемещения view при перетаскивании рамки в миникарте.

### Changed
- Обновлена документация: `contentMargin` в примерах и docs; `overlays.md` — опции `anchor`, `enabled`; `renderer.md` — `scrollbar` вместо deprecated `scrollbarOverlay`; `elements.md` — тип `editable-polyline` для рёбер.

## [0.3.14] - 2026-02-25

### Added
- Опция `attachToOutline` в `enableInteractions`: при включении стрелки можно перемещать не только по портам, но по любому месту контура фигуры; позиция привязки сохраняется в `EdgeEndpoint.outlineParam`.
- При `attachToOutline` порты и якоря скрыты; прилипание к контуру с магнитным snap; выравнивание по горизонтали/вертикали с другим концом стрелки или с ближайшей точкой перелома (для editable polyline).
- Shift+клик по узлу начинает связь с ближайшей точки контура.

### Fixed
- При Outline ON для editable polyline примагничивание к горизонтали/вертикали использует ближайшую точку перелома, а не противоположный конец стрелки.
- При перетаскивании по контуру фигуры CircleNode и DiamondNode конец стрелки следует реальному контуру (эллипс/ромб), а не bounding box.

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

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.7.2...HEAD
[0.7.2]: https://gitverse.ru/ngroznykh/papirus/compare/v0.7.1...v0.7.2
[0.7.1]: https://gitverse.ru/ngroznykh/papirus/compare/v0.7.0...v0.7.1
[0.7.0]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.5...v0.7.0
[0.6.5]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.4...v0.6.5
[0.6.4]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.3...v0.6.4
[0.6.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.3
[0.6.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.2
[0.6.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.1
[0.6.0]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.0...v0.6.1
[0.5.9]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.9
[0.5.8]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.8
[0.5.7]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.7
[0.5.6]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.6
[0.5.5]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.5
[0.5.4]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.4
[0.5.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.3
[0.5.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.2
[0.5.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.1
[0.5.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.0
[0.4.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.4.0
[0.3.23]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.23
[0.3.22]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.22
[0.3.21]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.21
[0.3.20]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.20
[0.3.19]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.19
[0.3.18]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.18
[0.3.17]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.17
[0.3.16]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.16
[0.3.15]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.15
[0.3.14]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.14
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
