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
- `CompositeNode` (дерево компонентов с flex-компоновкой)

### CompositeNode

`CompositeNode` рендерит иерархию lightweight-компонентов внутри узла:

- `container` — flex-контейнер (`direction`, `justifyContent`, `alignItems`, `gap`, `padding`)
- `text` — текстовый компонент (`align`, `verticalAlign`, `maxLines`, `rotation`, `role`)
- `icon` — иконка/изображение (`source`, `width/height`, `fillColor`, `bindsNotationIcon`)
- `shape` — фон/рамка с вложенным `content`
- `divider` — разделитель между секциями

Базовая идея: вы описываете структуру нотационного элемента как дерево компонентов, а `CompositeNode` рассчитывает layout и отрисовывает результат в canvas/SVG.

```ts
import { CompositeNode, container, text, icon, divider } from '@ngroznykh/papirus';

const composite = new CompositeNode({
  x: 120,
  y: 80,
  width: 220,
  height: 120,
  shapeType: 'rectangle',
  autoSize: true,
  content: container({
    direction: 'column',
    padding: 10,
    gap: 6,
    children: [
      text({ id: 'name', text: 'Service API', role: 'name' }),
      divider({}),
      container({
        direction: 'row',
        justifyContent: 'space-between',
        children: [
          text({ text: 'v2.1.0', color: '#64748b' }),
          icon({ source: '/icons/cloud.svg', width: 16, height: 16, bindsNotationIcon: true }),
        ],
      }),
    ],
  }),
});
```

Сериализация `CompositeNode`:
- `SerializedCompositeNode.content` хранит корневой `SerializedCComponent`;
- у `SerializedCComponent` доступны поля `label`, `bindToProperty`, `bindsNotationIcon` для редакторских/интеграционных сценариев.

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
  label: 'Hexagon',
});
```

### Контентная область

Внутри фигуры узла выделяется **контентная область** — прямоугольник, в котором рисуются метка и иконка.

- **contentInset** — отступы от краёв фигуры до контентной области: `number` (одинаковый со всех сторон) или `{ top?, right?, bottom?, left? }`. По умолчанию `0`: контентная область совпадает с bounds узла.
- Текст и иконка размещаются в одной контентной области. Отступы **текста** от краёв этой области задаются в метке через **label.inset** (число или `{ top?, right?, bottom?, left? }`).

Итого два уровня: **фигура** → (contentInset) → **контентная область** → (label.inset) → **текст**.

### Опции узлов (общие)

- `label` — текстовая метка (`string` или `TextLabelOptions`). Текст занимает всю контентную область; выравнивание задаётся в опциях метки: `style.align` (горизонталь), `style.verticalAlign` (вертикаль).
- `icon` — изображение/иконка (`NodeImageOptions`).
- `contentInset` — отступы контентной области от краёв фигуры (см. выше).
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
  icon: { source: '/icons/start.svg', fit: 'contain', scaleWithBounds: true, inset: 6 },
  contentInset: 8,
  ports: [{ type: 'output', position: 'right' }],
});
```

### NodeImage

`NodeImage` поддерживает изображения и inline SVG. Параметры:

- `source` — URL, SVG-строка или `HTMLImageElement`
- `fit` — `contain | cover | stretch | none` (применяется только при `scaleWithBounds: true`)
- `placement` — позиция иконки в контентной области: `center | top | bottom | left | right | top-left | top-right | bottom-left | bottom-right`
- `scaleWithBounds` — растягивать иконку по размеру зоны (по умолчанию `false`)
- `inset` — отступ от края зоны размещения до изображения со всех сторон (по умолчанию 6)
- `opacity`, `align`, `verticalAlign`, `offsetX`, `offsetY`

Текст и иконка размещаются в одной контентной области: текст занимает её целиком (с отступом `inset` метки), иконка рисуется поверх по своему `placement` и `inset`.

### TextLabel (метка узла/ребра)

- `text` — строка
- `inset` — отступ от края bounds до текста: число (одинаковый со всех сторон) или `{ top?, right?, bottom?, left? }` (по умолчанию 8)
- `style` — стиль текста:
  - `align` — горизонтальное выравнивание: `left | center | right`
  - `verticalAlign` — вертикальное выравнивание внутри bounds: `top | middle | bottom`
  - а также `font`, `fontSize`, `color`, `opacity` и др.
- `maxWidth`, `styleClass`

## Рёбра

`Edge` соединяет узлы и поддерживает:

- тип пути (`type`: `straight | polyline | bezier | editable-polyline`)
- стрелки (`arrowType`, `startMarker`, `endMarker`)
- подпись (`label`), смещение подписи от центра пути (`labelOffset`) и фон подписи (`labelBackground`)
- позиция подписи вдоль пути (`labelPosition`: `0..1`) и поворот подписи по касательной (`labelFollowPath`)
- **разрыв линии под меткой** (`labelLineGap`): если `true` и задана метка, линия ребра не рисуется на участке, пересекающем прямоугольник метки — рисуются два отрезка (до метки и после), так что линия визуально «обрывается» под подписью
- кастомные контрольные точки (`controlPoints`) для кривых
- анимированный поток через `style.flowSpeed`

Пример:

```ts
const edge = new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  type: 'bezier',
  label: 'Flow',
  labelOffset: 0,      // перпендикулярный сдвиг подписи
  labelPosition: 0.65, // 0..1 вдоль пути
  labelFollowPath: true,
  labelLineGap: true,  // линия не идёт под меткой
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

- `type`: `input | output`
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
