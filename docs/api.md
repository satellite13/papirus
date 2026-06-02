# Обзор публичного API

Ниже перечислены основные экспорты из `src/index.ts`. Этот список полезен как навигация по API.

Подробная справка по центральному рендереру: `docs/renderer.md`.
Подробная справка по взаимодействиям: `docs/interactions.md`.
Подробная справка по вводу: `docs/input.md`.
Подробная справка по поиску: `docs/search.md`.
Подробная справка по composite: `docs/composite.md`.

## Core

- `DiagramRenderer` — центральный рендерер и API управления диаграммой.
- `InteractionManager` — композитный менеджер взаимодействий.
- `ContextMenuManager` — контекстное меню.
- `SearchManager` — поиск и фильтрация.
- `AnimationManager` — базовые анимации.
- Менеджеры: `SelectionManager`, `DragManager`, `ResizeManager`, `NavigationManager`, `ConnectionManager`, `HistoryManager`.
- История (команды): `MoveNodesCommand`, `AddNodeCommand`, `RemoveNodeCommand`, `CompositeCommand`, `ChangeEditablePolylineControlPointsCommand`.

## Элементы

- Базовые классы: `Element`, `Node`, `Edge`, `Group`.
- Текст: `TextLabel`.
- Порты: `Port`, `resetPortIdCounter`.
- Изображения в узлах: `NodeImage`, `isCornerPlacement`.
- ID: `generateId`, `resetIdCounter`.

## Типы узлов

- `RectangleNode`, `CircleNode`, `DiamondNode` — встроенные формы.
- `CustomShapeNode` — пользовательские формы (`Path2D`). Опция `svgPath` для SVG-экспорта.
- `CompositeNode` — узел с компонентным деревом и flex-layout.
- `ShapeFactories` — фабрики Path2D (`hexagon`, `parallelogram`, `cylinder`, `document`, `chamfered`) и `ShapeFactories.svg` — SVG path для экспорта.

## Composite (компоненты и layout)

- Классы: `CText`, `CIcon`, `CDivider`, `CContainer`, `CShape`.
- Билдеры: `container`, `text`, `icon`, `divider`, `shape`.
- Утилиты: `flexLayout`, `normalizeSides`, `deserializeCComponent`.
- Типы: `CompositeNodeOptions`, `CompositeShapeType`, `CComponent`, `SerializedCComponent`, `FlexConfig`, `LayoutResult`, и др.

## События и ввод

- `EventEmitter` — типобезопасные события.
- `InputHandler` — нормализация мышь/тач/колесо/пинч.

## Стили и темы

- `StyleManager` — стили узлов/рёбер/текста/портов/групп.
- `DEFAULT_THEME`, `DARK_THEME` — готовые темы.

## Утилиты

- `Serializer` — сохранение/загрузка (`SerializerValidationError` при ошибках валидации).
- Экспорт: `ImageExporter`, `SvgExporter`.
- Авторазмещение: `AutoLayout`.
- Автороутинг: `AutoRouting`.
- Выравнивание: `alignNodes`, `distributeNodes`.
- Canvas-хелперы (расширенный рендер): `applyNodeStyle`, `renderFillAndStroke`, `applyEdgeStyle`.

## Оверлеи

- `GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`.

## Плагины диаграммы

`DiagramPlugin`: `install` / `destroy`. Опционально для оверлеев с собственным указателем:

- `beginOverlayDrag`, `updateOverlayDrag`, `endOverlayDrag`
- `blocksDiagramPointerAtScreen`

См. `docs/overlays.md` и `docs/renderer.md`.

## Геометрия

Реэкспортируются функции из `utils/geometry.ts` (расчёт расстояний, пересечения, bezier и др.).

## Типы

Экспортируются основные типы: `Point`, `Size`, `Bounds`, `ContentInsetSides` (отступы по сторонам: `contentInset` узла и `label.inset`), `ElementStyle`, `NodeStyle`, `EdgeStyle`, `TextStyle` (в т.ч. `align`, `verticalAlign`), `DiagramOptions`, `DiagramData`, `ArrowMarkerType`, `ArrowMarkerConfig`, а также сериализованные формы (`SerializedNode`, `SerializedEdge`, `SerializedGroup`, `SerializedPort`, `SerializedCompositeNode`) и др.

В `SerializedEdge` поддерживаются поля позиционирования метки:

- `labelPosition` — относительная позиция метки вдоль пути (`0..1`),
- `labelFollowPath` — поворот метки по направлению линии,
- `labelLineGap` — разрыв линии под меткой.

Для `SerializedCComponent` (контент `CompositeNode`):

- `label` — подпись компонента для редактора,
- `bindToProperty` — привязка текста к свойству (`'__name__'` — имя узла),
- `bindsNotationIcon` — привязка иконки к нотации.

## История изменений

См. [CHANGELOG.md](../CHANGELOG.md) и [CHANGELOG.ru.md](../CHANGELOG.ru.md).
