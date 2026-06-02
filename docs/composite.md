# CompositeNode

`CompositeNode` — узел с деревом lightweight-компонентов (`CText`, `CIcon`, `CContainer`, `CShape`, `CDivider`) и flex-подобной раскладкой. Подходит для нотаций BPMN, ArchiMate, C4, UML и кастомных карточек.

См. также: [Элементы](./elements.md) (базовый пример), [Утилиты](./utils.md) (сериализация).

## Быстрый старт

```ts
import { CompositeNode, container, text, icon, divider } from '@ngroznykh/papirus';

const node = new CompositeNode({
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
      text({
        id: 'name',
        text: 'Service API',
        bindToProperty: '__name__',
        style: { alignSelf: 'center' },
      }),
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

## Опции `CompositeNode`

| Опция | Описание |
|-------|----------|
| `content` | Корневой `CContainer` (обязательно). |
| `shapeType` | `'rectangle' \| 'circle' \| 'diamond' \| 'custom'` (по умолчанию `'rectangle'`). |
| `cornerRadius` | Скругление для `rectangle`. |
| `pathFactory` | `(w, h) => Path2D` — контур для `shapeType: 'custom'` на canvas. |
| `svgPath` | Строка или `(w, h) => string` — SVG path для экспорта при `custom` (иначе прямоугольник). |
| `autoSize` | Подгонка `width`/`height` под контент (по умолчанию `false`). |
| `minWidth`, `minHeight` | Минимумы при `autoSize`. |

Наследуются общие опции `Node`: `label`, `icon`, `contentInset`, `ports`, `badges`, стили.

## Компоненты

### Билдеры (декларативный API)

- `container({ direction, justifyContent, alignItems, gap, padding, children })`
- `text({ text, bindToProperty, align, verticalAlign, maxLines, rotation, role, ... })`
- `icon({ source, width, height, fillColor, bindsNotationIcon, ... })`
- `shape({ shapeType, cornerRadius, content })` — фон/рамка с вложенным `content`
- `divider({ color, thickness })`

### Классы (императивный API)

`CText`, `CIcon`, `CContainer`, `CShape`, `CDivider` — те же сущности, что создают билдеры.

### `flexLayout`

Низкоуровневый расчёт раскладки (используется внутри `CContainer`):

```ts
import { flexLayout } from '@ngroznykh/papirus';

const { childBounds } = flexLayout(
  { width: 200, height: 100 },
  { direction: 'row', gap: 8, padding: 4 },
  childrenAsFlexChild[]
);
```

### `normalizeSides`

Приводит `padding` / `gap` к виду `{ top?, right?, bottom?, left? }` для единообразной обработки сторон.

## Поля `SerializedCComponent`

| Поле | Назначение |
|------|------------|
| `type` | `'text' \| 'icon' \| 'container' \| 'shape' \| 'divider'`. |
| `label` | Подпись компонента для host-редактора (не влияет на отрисовку). |
| `bindToProperty` | Привязка текста к свойству; `'__name__'` — отображаемое имя узла и inline-редактирование по двойному клику. |
| `bindsNotationIcon` | Иконка привязана к источнику на уровне нотации (интеграции wArchi и др.). |
| `role` | Произвольный маркер для host-приложения; **не** заменяет `bindToProperty: '__name__'` для редактирования имени. |

## Десериализация дерева

```ts
import { CompositeNode, deserializeCComponent, CContainer } from '@ngroznykh/papirus';
import type { SerializedCompositeNode } from '@ngroznykh/papirus';

function compositeFromSerialized(data: SerializedCompositeNode): CompositeNode {
  const root = deserializeCComponent(data.content);
  if (!(root instanceof CContainer)) {
    throw new Error('Composite root must be a container');
  }
  return new CompositeNode({
    id: data.id,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    content: root,
    shapeType: data.shapeType,
    cornerRadius: data.cornerRadius,
    autoSize: data.autoSize ?? true,
    minWidth: data.minWidth,
    minHeight: data.minHeight,
  });
}
```

## Кастомный контур (`shapeType: 'custom'`)

Для произвольной формы задайте `pathFactory` (canvas) и `svgPath` (SVG-экспорт). Без `svgPath` экспорт рисует прямоугольник (с 0.6.4 корректный контур экспортируется при наличии `svgPath`).

```ts
import { CompositeNode, container, text, ShapeFactories } from '@ngroznykh/papirus';

new CompositeNode({
  shapeType: 'custom',
  pathFactory: ShapeFactories.hexagon,
  svgPath: ShapeFactories.svg.hexagon,
  autoSize: true,
  content: container({ children: [text({ text: 'Hex', bindToProperty: '__name__' })] }),
});
```

## События интеграции

На `DiagramRenderer`:

- `componentClick` — клик по компоненту внутри composite (`nodeId`, `CComponent`, `point` в мировых координатах).
- Двойной клик по `CText` с `bindToProperty: '__name__'` открывает inline-редактирование имени (через `InteractionManager`).

## Примеры

- `examples/composite/` — BPMN, swimlane, status-card, сериализация JSON/SVG.
