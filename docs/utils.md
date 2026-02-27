# Утилиты

## Serializer

Сохраняет и восстанавливает диаграмму в JSON.

```ts
const serializer = new Serializer(renderer, {
  nodeFactory: (data) => new RectangleNode(data),
  edgeFactory: (data) => new Edge(data),
  groupFactory: (data) => new Group(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

## Экспорт

```ts
const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2, padding: 20 });

const svgExporter = new SvgExporter(renderer);
svgExporter.download('diagram.svg', { includeBackground: true });
```

**Custom shapes в SVG:** для `CustomShapeNode` укажите опцию `svgPath` — иначе экспорт использует прямоугольник. Готовые path: `ShapeFactories.svg.hexagon`, `ShapeFactories.svg.parallelogram`, `ShapeFactories.svg.cylinder`, `ShapeFactories.svg.document`, `ShapeFactories.svg.chamfered`.

## AutoLayout

Быстрый grid-лейаут для массива узлов.

```ts
const layout = new AutoLayout();
layout.applyGridLayout(nodes, { columns: 3, rowGap: 40, columnGap: 40 });
```

## AutoRouting

Автоматически пересчитывает путь рёбер (тип: `straight | polyline | bezier`).

```ts
const router = new AutoRouting();
router.apply(renderer, { type: 'polyline' });
```

## Поиск и фильтрация

```ts
const search = new SearchManager(renderer);
search.find('API', { highlight: true });
search.filter({ nodeType: 'RectangleNode', styleClass: 'warning' });
search.clear();
```

Подробная справка: `docs/search.md`.

## Анимации

Анимации включаются через опции рендерера:

```ts
const renderer = new DiagramRenderer('#canvas', {
  animations: { enabled: true, enterDuration: 200, exitDuration: 180 },
});
```

## Выравнивание и распределение

```ts
alignNodes(nodes, 'left');
distributeNodes(nodes, 'horizontal');
```

## Геометрия

В `utils/geometry.ts` доступны функции для hit-test и геометрии:

- `pointInRect`, `rectsIntersect`, `rectIntersection`, `rectUnion`
- `distance`, `distanceToSegment`, `angle`, `rotatePoint`, `lerp`
- `calculateBezierControlPoints`, `bezierPoint`, `expandBounds`, `boundsCenter`
