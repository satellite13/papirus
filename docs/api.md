# Обзор публичного API

Ниже перечислены основные экспорты из `src/index.ts`. Этот список полезен как навигация по API.

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
- `CustomShapeNode` — пользовательские формы (`Path2D`).
- `ShapeFactories` — набор готовых фабрик Path2D.

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

Экспортируются основные типы: `Point`, `Bounds`, `ElementStyle`, `NodeStyle`, `EdgeStyle`, `TextStyle`, `DiagramOptions`, `DiagramData`, а также сериализованные формы (`SerializedNode`, `SerializedEdge`, `SerializedGroup`, `SerializedPort`) и др.
