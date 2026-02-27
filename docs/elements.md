# Элементы диаграммы

## Базовые элементы

- `Node` — базовый класс для узлов.
- `Edge` — связь между узлами.
- `Group` — контейнер для группировки элементов.
- `Element` — общий базовый класс с координатами, стилями и hit-test.

## Узлы

Встроенные типы:

- `RectangleNode`
- `CircleNode`
- `DiamondNode`
- `CustomShapeNode` (произвольный `Path2D`)

### CustomShapeNode

Узел с произвольной формой на основе `Path2D`. Для корректного SVG-экспорта необходимо указать `svgPath` — строку SVG path в локальных координатах (0,0 — верхний левый угол, width×height — размеры узла).

Опции:

- `path` — `Path2D` или фабрика `(width, height) => Path2D` для отрисовки на canvas.
- `svgPath` — строка или фабрика `(width, height) => string` для SVG-экспорта. Если не указано, экспорт использует прямоугольник.
- `shapeType` — произвольный идентификатор типа формы (для UI, сериализации).

Готовые SVG path: `ShapeFactories.svg.hexagon`, `ShapeFactories.svg.parallelogram`, `ShapeFactories.svg.cylinder`, `ShapeFactories.svg.document`, `ShapeFactories.svg.chamfered`.

```ts
import { CustomShapeNode, ShapeFactories } from '@ngroznykh/papirus';

const node = new CustomShapeNode({
  x: 100, y: 100,
  width: 120, height: 80,
  path: ShapeFactories.hexagon,
  svgPath: ShapeFactories.svg.hexagon,
  labelPlacement: 'center',
  label: 'Hexagon',
});
```

### Опции узлов (общие)

- `label` — текстовая метка (`string` или `TextLabelOptions`).
- `labelPlacement` — позиция лейбла внутри фигуры (`auto | center | top | bottom | left | right`).
- `icon` — изображение/иконка (`NodeImageOptions`).
- `ports` — список портов (`PortOptions`).
- `anchorPoints` — количество anchor-точек по сторонам.

Поведение меток узла при длинном тексте:

- текст сначала переносится по словам в пределах текущей ширины узла;
- ширина узла увеличивается только если встречается длинное неразбиваемое слово, которое не помещается.

Пример:

```ts
const node = new RectangleNode({
  x: 100,
  y: 80,
  width: 140,
  height: 60,
  label: 'Start',
  icon: { source: '/icons/start.svg', fit: 'contain', scaleWithBounds: true },
  ports: [{ type: 'output', position: 'right' }],
});
```

### NodeImage

`NodeImage` поддерживает изображения и inline SVG. Параметры:

- `source` — URL, SVG-строка или `HTMLImageElement`
- `fit` — `contain | cover | stretch | none` (применяется только при `scaleWithBounds: true`)
- `placement` — `center | top | bottom | left | right`
- `scaleWithBounds` — растягивать иконку по размеру фигуры (по умолчанию `false`)
- `padding`, `gap`, `opacity`, `align`, `verticalAlign`, `offsetX`, `offsetY`

## Рёбра

`Edge` соединяет узлы и поддерживает:

- тип пути (`type`: `straight | polyline | bezier | editable-polyline`)
- стрелки (`arrowType`, `startMarker`, `endMarker`)
- подпись (`label`) и фон подписи (`labelBackground`)
- кастомные контрольные точки (`controlPoints`) для кривых
- анимированный поток через `style.flowSpeed`

Пример:

```ts
const edge = new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  type: 'bezier',
  label: 'Flow',
  labelBackground: { color: '#fff', padding: 6, borderRadius: 6 },
  controlPoints: [
    { x: 200, y: 120 },
    { x: 260, y: 120 },
    { x: 320, y: 160 },
  ],
  style: { flowSpeed: 30, flowDash: [6, 6] },
});
```

## Группы

`Group` — контейнер узлов/групп с автоматическим пересчётом границ и опциональной подписью.

```ts
const group = new Group({ label: 'Section', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);
```

## Порты

`Port` задаёт точки подключения на узлах:

- `type`: `input | output | bidirectional`
- `position`: `top | bottom | left | right` или `Point`
- `styleClass` позволяет применять тему

```ts
const node = new RectangleNode({
  x: 20,
  y: 20,
  width: 120,
  height: 60,
  ports: [
    { type: 'input', position: 'left' },
    { type: 'output', position: 'right' },
  ],
});
```
