# Обзор публичного API

Ниже перечислены основные экспорты из `src/index.ts`. Этот список полезен как навигация по API.

Подробная справка по центральному рендереру: `docs/renderer.md`.
Подробная справка по взаимодействиям: `docs/interactions.md`.
Подробная справка по вводу: `docs/input.md`.
Подробная справка по поиску: `docs/search.md`.

## Core

- `DiagramRenderer` — центральный рендерер и API управления диаграммой.
- `InteractionManager` — композитный менеджер взаимодействий.
- `ContextMenuManager` — контекстное меню.
- `SearchManager` — поиск и фильтрация.
- `AnimationManager` — базовые анимации.
- Менеджеры: `SelectionManager`, `DragManager`, `ResizeManager`, `NavigationManager`, `ConnectionManager`, `HistoryManager`.
- История: `MoveNodesCommand`, `AddNodeCommand`, `RemoveNodeCommand`, `CompositeCommand`.

## Элементы

- Базовые классы: `Element`, `Node`, `Edge`, `Group`.
- Текст: `TextLabel`.
- Порты: `Port`.
- Изображения в узлах: `NodeImage`.

## Типы узлов

- `RectangleNode`, `CircleNode`, `DiamondNode` — встроенные формы.
- `CustomShapeNode` — пользовательские формы (`Path2D`). Опция `svgPath` для SVG-экспорта.
- `ShapeFactories` — фабрики Path2D (`hexagon`, `parallelogram`, `cylinder`, `document`) и `ShapeFactories.svg` — SVG path для экспорта.

## События и ввод

- `EventEmitter` — типобезопасные события.
- `InputHandler` — нормализация мышь/тач/колесо/пинч.

## Стили и темы

- `StyleManager` — стили узлов/рёбер/текста/портов/групп.
- `DEFAULT_THEME`, `DARK_THEME` — готовые темы.

## Утилиты

- `Serializer` — сохранение/загрузка.
- Экспорт: `ImageExporter`, `SvgExporter`.
- Авторазмещение: `AutoLayout`.
- Автороутинг: `AutoRouting`.
- Выравнивание: `alignNodes`, `distributeNodes`.

## Оверлеи

- `GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`.

## Геометрия

Реэкспортируются функции из `utils/geometry.ts` (расчёт расстояний, пересечения, bezier и др.).

## Типы

Экспортируются основные типы: `Point`, `Size`, `Bounds`, `ContentInsetSides` (отступы по сторонам: используется в `contentInset` узла и в `label.inset`), `ElementStyle`, `NodeStyle`, `EdgeStyle`, `TextStyle` (в т.ч. `align`, `verticalAlign`), `DiagramOptions`, `DiagramData`, а также сериализованные формы (`SerializedNode`, `SerializedEdge`, `SerializedGroup`, `SerializedPort`, `SerializedNodeIcon`, `SerializedTextLabel`) и др.
