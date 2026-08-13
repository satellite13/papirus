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

### Узлы разных типов и `CompositeNode`

`nodeFactory` получает `SerializedNode` с полем `type` (`'rectangle' | 'circle' | 'diamond' | 'composite' | ...`). Для composite в данных есть `content` (дерево `SerializedCComponent`).

```ts
import {
  Serializer,
  RectangleNode,
  CircleNode,
  DiamondNode,
  Edge,
  Group,
  CompositeNode,
  CContainer,
  deserializeCComponent,
} from '@ngroznykh/papirus';
import type { SerializedNode, SerializedCompositeNode } from '@ngroznykh/papirus';

function nodeFactory(data: SerializedNode) {
  const base = {
    id: data.id,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    style: data.style,
    styleClass: data.styleClass,
    label: data.label,
    icon: data.icon,
    contentInset: data.contentInset,
    ports: data.ports,
    anchorPoints: data.anchorPoints,
  };

  if (data.type === 'composite') {
    const c = data as SerializedCompositeNode;
    const root = deserializeCComponent(c.content);
    if (!(root instanceof CContainer)) {
      throw new Error('Composite root must be a container');
    }
    return new CompositeNode({
      ...base,
      content: root,
      shapeType: c.shapeType,
      cornerRadius: c.cornerRadius,
      autoSize: c.autoSize ?? true,
      minWidth: c.minWidth,
      minHeight: c.minHeight,
    });
  }

  switch (data.type) {
    case 'circle':
      return new CircleNode(base);
    case 'diamond':
      return new DiamondNode(base);
    case 'rectangle':
    default:
      return new RectangleNode(base);
  }
}

const serializer = new Serializer(renderer, {
  nodeFactory,
  edgeFactory: (data) => new Edge(data),
  groupFactory: (data) => new Group(data),
});
```

Подробнее о composite: `docs/composite.md`.

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

Автоматически пересчитывает путь рёбер (тип: `straight | polyline | bezier`). Для `polyline` со сторонами и препятствиями используется ортогональный обход (`routeOrthogonalAround`); см. [Элементы](./elements.md).

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

В `utils/geometry.ts` доступны функции для hit-test и геометрии. Ниже — часто используемые (не исчерпывающий список):

- `pointInRect`, `rectsIntersect`, `rectIntersection`, `rectUnion`
- `distance`, `distanceToSegment`, `angle`, `rotatePoint`, `lerp`
- `calculateBezierControlPoints`, `bezierPoint`, `expandBounds`, `boundsCenter`

Полный перечень доступен в `src/utils/geometry.ts` и через публичный реэкспорт из `src/index.ts`.
