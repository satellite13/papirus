# Система композитных компонентов — План реализации

## Контекст

Papirus нуждается в возможности создавать сложные визуальные элементы из различных нотаций (BPMN, ArchiMate, C4, UML, ERD, IDEF0, EPC). Сейчас Node поддерживает только один TextLabel + NodeImage + Ports. Данный план вводит **CompositeNode** — подкласс Node с деревом дочерних компонентов, расположенных с помощью flexbox-подобного layout-движка, с отрисовкой на canvas.

Основной потребитель — проект **warchi** (Vue 3 фронтенд для архитектурного моделирования), который использует Papirus как canvas-движок. Сейчас в warchi сложные элементы нотаций собираются из плоского DiagramStyle (1 label + 1 icon + badges), что ограничивает визуальные возможности. CompositeNode позволит создавать фабрики-шаблоны для каждой нотации в warchi, маппящие DiagramStyle в дерево компонентов.

**Проектные решения:**
- Декларативный API с фабричными функциями: `container()`, `text()`, `icon()`, `shape()`, `divider()`
- Авто-размер по умолчанию (нода растёт под содержимое, с ограничениями min/max)
- Все 4 приоритетные нотации: BPMN, ArchiMate, C4, UML
- Доступ к компонентам по `id` через `node.getComponent('title')`
- Лёгкие реализации CText/CIcon с нуля (без делегирования в TextLabel/NodeImage)
- CShape — отдельный тип компонента (не объединяется с CContainer)
- Внешняя форма CompositeNode — встроенный switch по shapeType
- Inline-редактирование — только для основного текста (role: `'name'`), двойной клик на диаграмме
- Undo/redo — только для inline-редактора; программные изменения через API без истории
- Панель свойств — внешний UI (warchi строит сам), Papirus предоставляет API чтения/записи
- SVG-экспорт — поддержка с первой версии
- Анимации компонентов — не нужны

## Архитектура

```
CompositeNode extends Node
  └── CContainer (корневой контент)
        ├── CText       — текст с шрифтом/цветом/выравниванием
        ├── CIcon       — SVG-иконка с тонированием/фоном
        ├── CShape      — контейнер с рамкой (может содержать CContainer рекурсивно)
        ├── CDivider    — горизонтальный/вертикальный разделитель
        └── CContainer  — flex-контейнер строка/колонка с дочерними элементами (рекурсивно)
```

**Ключевые принципы:**
- `CompositeNode` наследует `Node` — получает порты, соединения, сериализацию, hit testing, drag, resize
- Компоненты реализуют интерфейс `CComponent` — `measure()`, `render()`, `hitTest()`
- Каждый компонент может иметь опциональный `id` для доступа через `node.getComponent(id)`
- `FlexLayout` — чистая функция расчёта layout (подмножество CSS flexbox)
- CText и CIcon — лёгкие реализации с нуля (прямая работа с canvas ctx, без TextLabel/NodeImage)
- Word-wrap свой (~30 строк), SVG tinting вынести как утилиту из NodeImage
- Грязные флаги (dirty) распространяются вверх через `onChange` колбэки (та же схема, что у TextLabel/NodeImage)
- Авто-размер: нода подстраивает width/height под содержимое; ручной resize тоже работает

## Структура файлов

```
src/elements/composite/
  CComponent.ts      — интерфейс CComponent, CComponentStyle, общие типы
  CText.ts           — текстовый компонент
  CIcon.ts           — SVG-иконка
  CShape.ts          — фигура с рамкой и опциональным вложенным содержимым
  CDivider.ts        — горизонтальный/вертикальный разделитель
  CContainer.ts      — flex-контейнер с дочерними элементами
  FlexLayout.ts      — чистый алгоритм flex-разметки
  CompositeNode.ts   — подкласс Node
  index.ts           — реэкспорт + фабричные функции
```

## Ключевые интерфейсы

### CComponent (`src/elements/composite/CComponent.ts`)

```typescript
interface CComponentStyle {
  visible?: boolean;
  opacity?: number;
  flexGrow?: number;      // по умолчанию 0
  flexShrink?: number;    // по умолчанию 1
  flexBasis?: number | 'auto';
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  margin?: number | SidesConfig;
}

interface CComponent {
  readonly type: 'text' | 'icon' | 'shape' | 'container' | 'divider';
  readonly id?: string;              // опциональный id для доступа через getComponent()
  style: CComponentStyle;
  measure(ctx: CanvasRenderingContext2D): Size;
  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void;
  hitTest(point: Point, bounds: Bounds): CComponent | null;
  setOnChange(cb: (() => void) | undefined): void;
  serialize(): SerializedCComponent;
  /** SVG-экспорт: возвращает SVG-элементы для данного компонента */
  toSVG(bounds: Bounds): string;
}
```

### FlexLayout (`src/elements/composite/FlexLayout.ts`)

```typescript
interface FlexConfig {
  direction: 'row' | 'column';
  justifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems: 'start' | 'center' | 'end' | 'stretch';
  gap: number;
  padding: number | SidesConfig;
}

function flexLayout(
  container: Size,
  config: FlexConfig,
  children: FlexChild[]
): { childBounds: Bounds[]; contentSize: Size };
```

**Алгоритм (одна ось, без переноса):**
1. Нормализовать padding → вычислить внутреннюю область
2. Для каждого потомка: базовый размер = flexBasis или measure()[mainAxis], ограничен minSize
3. Сумма базовых размеров + gaps → totalBase
4. Если totalBase < доступно: распределить остаток по flexGrow
5. Если totalBase > доступно: сжать по flexShrink, ограничив minSize
6. Расположить вдоль главной оси по justifyContent
7. Расположить вдоль поперечной оси по alignItems/alignSelf

### CText

Свойства: `id?`, `text`, `fontFamily`, `fontWeight`, `fontStyle`, `fontSize`, `color`, `align`, `verticalAlign`, `maxLines`, `lineHeight`, `role?`, `rotation?`

- Лёгкая реализация с нуля: прямая работа с `ctx.fillText()` + `ctx.measureText()`
- Свой word-wrap (~30 строк кода)
- `role: 'name'` — помечает основной текст для inline-редактирования двойным кликом
- `rotation: number` — угол поворота в градусах (например, `-90` для вертикального текста в swimlane BPMN)
  - При `rotation: -90` или `90`: `measure()` возвращает транспонированные размеры (ширина ↔ высота)
  - `render()` применяет `ctx.rotate()` перед отрисовкой
  - Flex layout получает уже транспонированные размеры из `measure()`, поэтому корректно размещает компонент
- `measure()` возвращает размер с учётом переноса строк (и rotation)
- `toSVG()` генерирует `<text>` элементы с `transform="rotate()"` при наличии rotation

### CIcon

Свойства: `id?`, `source` (URL или inline SVG), `width`, `height`, `backgroundColor`, `fillColor`, `visible`, `onClick`

- Лёгкая реализация с нуля: `ctx.drawImage()` для рендеринга
- SVG tinting вынесен как утилита из существующего NodeImage (переиспользуем логику тонирования)
- Загрузка изображений через HTMLImageElement с кешированием
- `toSVG()` генерирует `<image>` или инлайн `<svg>` элемент

### CShape

Свойства: `borderColor`, `borderWidth`, `backgroundColor`, `cornerRadius`, `padding`, `onClick`, `content?: CContainer`

Обеспечивает рекурсивную композицию — фигура-контейнер, которая может содержать другой flex layout.

### CDivider

Свойства: `color`, `thickness`, `margin`

Простая горизонтальная (в колонке) или вертикальная (в строке) линия. Необходим для секций UML-классов.

### CompositeNode

```typescript
interface CompositeNodeOptions extends NodeOptions {
  content: CContainer;
  shapeType?: 'rectangle' | 'circle' | 'diamond' | 'custom';
  cornerRadius?: number;
  pathFactory?: (w: number, h: number) => Path2D;
  autoSize?: boolean;  // по умолчанию true
  minWidth?: number;
  minHeight?: number;
}
```

- `typeName` возвращает `'composite'`
- Переопределяет `renderContents(ctx)`: запускает layout на дереве компонентов, рендерит их
- Авто-размер: после `content.measure(ctx)` подстраивает width/height ноды при необходимости
- `getComponentAtPoint(worldPoint)`: преобразует в локальные координаты, обходит дерево компонентов
- Внешняя форма рисуется в `render()` через switch по shapeType (переиспользует логику path из существующих нод)

## Hit Testing и Click-колбэки

1. `InteractionManager` находит `CompositeNode` через существующий `getElementAtPoint()`
2. Новое: если кликнутый элемент — `CompositeNode`, вызвать `node.getComponentAtPoint(worldPoint)`
3. Если найден компонент с `onClick`, вызвать его
4. Новое событие: `DiagramEvents.componentClick: [nodeId: string, component: CComponent, point: Point]`

## Inline-редактирование текста

- Двойной клик по CompositeNode находит CText с `role: 'name'` (основной текст)
- Если найден — открывает существующий inline-редактор (textarea поверх canvas) для этого CText
- Bounds CText преобразуются в screen-координаты для позиционирования textarea
- По завершении: создаётся `ChangeComponentPropertyCommand` в HistoryManager (поддержка undo/redo)
- Остальные CText (без role: 'name') редактируются только программно через API
- Программные изменения через API (`ctext.text = '...'`) — без истории, только `markDirty()`

## Доступ к компонентам

```typescript
// Поиск по id — рекурсивный обход дерева
node.getComponent('title'): CComponent | undefined

// Использование:
const title = node.getComponent('title') as CText;
title.text = 'Новое название';  // → markDirty() → перерисовка

const ic = node.getComponent('type-icon') as CIcon;
ic.fillColor = '#ff0000';  // → markDirty() → перерисовка
```

## Сериализация

Новый тип `SerializedCComponent` — рекурсивная JSON-структура с дискриминатором `type`:
```typescript
interface SerializedCComponent {
  type: 'text' | 'icon' | 'shape' | 'container' | 'divider';
  style?: CComponentStyle;
  // Поля, специфичные для типа (text, source, flex, children и т.д.)
}
```

`CompositeNode` сериализуется как `type: 'composite'` с полем `content: SerializedCComponent`.
Добавляется фабрика `deserializeCComponent()` для рекурсивной реконструкции.
Существующий паттерн `nodeFactory` в Serializer уже поддерживает это — фабрика пользователя проверяет `type === 'composite'`.

## Поведение авто-размера

- При рендере, после измерения содержимого, если `autoSize` равен true:
  - `newWidth = max(minWidth, contentSize.width + contentInset.left + contentInset.right)`
  - `newHeight = max(minHeight, contentSize.height + contentInset.top + contentInset.bottom)`
  - Изменять размер только если содержимое выходит за текущие границы или границы значительно превышают содержимое
- Ручной resize через хэндлы по-прежнему работает — неявно устанавливает `autoSize = false` (или корректирует min-ограничения)

## Примеры нотаций

### BPMN Task
```typescript
const bpmnTask = new CompositeNode({
  x: 100, y: 100, width: 160, height: 80,
  shapeType: 'rectangle',
  cornerRadius: 8,
  content: container({
    direction: 'column',
    padding: 8,
    children: [
      container({
        direction: 'row',
        justifyContent: 'start',
        children: [
          icon({ source: '/icons/task.svg', width: 16, height: 16 }),
        ],
      }),
      text({
        text: 'Review Document',
        fontSize: 14,
        fontWeight: 'bold',
        style: { flexGrow: 1, alignSelf: 'center' },
      }),
      container({
        direction: 'row',
        justifyContent: 'center',
        gap: 4,
        children: [
          icon({ source: '/icons/loop.svg', width: 12, height: 12 }),
          icon({ source: '/icons/parallel.svg', width: 12, height: 12 }),
        ],
      }),
    ],
  }),
});
```

### ArchiMate Element
```typescript
const archiElement = new CompositeNode({
  x: 100, y: 100, width: 160, height: 60,
  shapeType: 'rectangle',
  content: container({
    direction: 'column',
    padding: 8,
    children: [
      container({
        direction: 'row',
        justifyContent: 'end',
        children: [
          icon({ source: '/icons/archimate-service.svg', width: 16, height: 16 }),
        ],
      }),
      text({
        text: 'Application Service',
        fontSize: 13,
        style: { flexGrow: 1, alignSelf: 'center' },
      }),
    ],
  }),
});
```

### C4 Container
```typescript
const c4Container = new CompositeNode({
  x: 100, y: 100, width: 200, height: 120,
  shapeType: 'rectangle',
  cornerRadius: 4,
  style: { fillColor: '#438DD5' },
  content: container({
    direction: 'column',
    padding: 12,
    gap: 4,
    alignItems: 'center',
    children: [
      text({ text: 'API Gateway', fontSize: 16, fontWeight: 'bold', color: '#ffffff' }),
      text({ text: '[Container: Node.js]', fontSize: 11, fontStyle: 'italic', color: '#e0e0e0' }),
      text({ text: 'Маршрутизирует запросы к микросервисам', fontSize: 12, color: '#ffffff' }),
    ],
  }),
});
```

### UML Class
```typescript
const umlClass = new CompositeNode({
  x: 100, y: 100, width: 200, height: 160,
  shapeType: 'rectangle',
  content: container({
    direction: 'column',
    padding: 0,
    children: [
      shape({
        backgroundColor: '#f0f0ff',
        padding: 8,
        content: container({
          direction: 'column',
          alignItems: 'center',
          children: [
            text({ text: '<<interface>>', fontSize: 10, fontStyle: 'italic' }),
            text({ text: 'Serializable', fontSize: 14, fontWeight: 'bold' }),
          ],
        }),
      }),
      divider({ color: '#333333' }),
      shape({
        padding: 8,
        content: container({
          direction: 'column',
          children: [
            text({ text: '+ serialize(): string', fontSize: 12, align: 'left' }),
            text({ text: '+ deserialize(data): void', fontSize: 12, align: 'left' }),
          ],
        }),
      }),
    ],
  }),
});
```

## SVG-экспорт

Каждый CComponent реализует метод `toSVG(bounds): string`, который возвращает SVG-разметку:
- **CText** → `<text>` с `<tspan>` для каждой строки (word-wrap)
- **CIcon** → `<image>` для растровых, инлайн `<svg>` для SVG-иконок
- **CShape** → `<rect>` с borderRadius, fill, stroke + вложенный контент
- **CDivider** → `<line>`
- **CContainer** → `<g>` группа с дочерними элементами

`SvgExporter` при обработке CompositeNode:
1. Рисует внешнюю форму (rect/circle/diamond/path)
2. Вычисляет layout дерева компонентов
3. Вызывает `toSVG()` у каждого компонента с вычисленными bounds

## Интеграция с warchi

Papirus предоставляет примитивы (CompositeNode + компоненты). Warchi строит конкретные нотации через фабрики-шаблоны. DiagramStyle в warchi **не меняется**.

```typescript
// Пример фабрики в warchi (не в Papirus):
function buildArchiElement(name: string, ds: DiagramStyle): CompositeNode {
  return new CompositeNode({
    shapeType: 'rectangle',
    style: { fillColor: ds.fillColor, strokeColor: ds.strokeColor },
    content: container({
      direction: 'column', padding: 8,
      children: [
        container({
          direction: 'row', justifyContent: 'end',
          children: [
            icon({ id: 'type-icon', source: `/icons/${ds.iconName}.svg`, width: 16, height: 16 }),
          ],
        }),
        text({ id: 'name', text: name, role: 'name', style: { flexGrow: 1, alignSelf: 'center' } }),
      ],
    }),
  });
}

// Обновление свойств через API (панель свойств warchi):
const titleText = node.getComponent('name') as CText;
titleText.text = 'Новое название';

const typeIcon = node.getComponent('type-icon') as CIcon;
typeIcon.source = '/icons/new-type.svg';
```

**Что решает для warchi:**
- Несколько текстовых блоков с разными стилями (C4: title + technology + description)
- Секции с разделителями (UML class: name | attributes | methods)
- Гибкое размещение иконок (BPMN: тип сверху-слева, маркеры снизу-по-центру)
- Inline-редактирование основного текста двойным кликом
- Не нужно пересоздавать ноду при смене свойств компонентов

## TODO — пошаговый план реализации

Каждый шаг завершается прогоном `npm run typecheck && npm run test`. Новый функционал покрывается тестами сразу.

---

### Шаг 1. Типы и интерфейсы
- [ ] `src/elements/composite/CComponent.ts` — интерфейс CComponent, CComponentStyle, SidesConfig, SerializedCComponent
- [ ] `src/types.ts` — добавить SerializedCompositeNode
- [ ] Прогнать `typecheck`

### Шаг 2. FlexLayout — чистый алгоритм
- [ ] `src/elements/composite/FlexLayout.ts` — функция flexLayout()
- [ ] `src/elements/composite/FlexLayout.test.ts` — тесты:
  - row direction: равномерное распределение, gap, padding
  - column direction: аналогично
  - justifyContent: start, center, end, space-between, space-around
  - alignItems: start, center, end, stretch
  - alignSelf переопределяет alignItems
  - flexGrow: распределение свободного пространства
  - flexShrink: сжатие при нехватке пространства, clamp к minSize
  - margin на дочерних элементах
  - contentSize корректен (для auto-size)
  - edge cases: 0 детей, 1 ребёнок, нулевой контейнер
- [ ] Прогнать `typecheck + test`

### Шаг 3. CText — текстовый компонент
- [ ] `src/elements/composite/CText.ts` — реализация с нуля:
  - word-wrap через ctx.measureText()
  - поддержка font*, color, align, verticalAlign, maxLines, lineHeight
  - rotation (для вертикального текста swimlane)
  - role: 'name' для inline-редактирования
  - measure(), render(), hitTest(), serialize(), toSVG()
  - onChange колбэк при изменении свойств
- [ ] `src/elements/composite/CText.test.ts` — тесты:
  - measure() возвращает корректные размеры
  - word-wrap разбивает длинный текст
  - maxLines обрезает текст
  - rotation: measure() транспонирует размеры
  - render() вызывает ctx.fillText() с правильными параметрами
  - render() с rotation вызывает ctx.rotate()
  - hitTest() корректен в bounds и за пределами
  - serialize() → deserialize() round-trip
  - toSVG() генерирует валидный `<text>`
  - onChange вызывается при изменении text, fontSize, color и т.д.
- [ ] Прогнать `typecheck + test`

### Шаг 4. SVG tinting утилита
- [ ] Вынести логику тонирования SVG из `src/elements/NodeImage.ts` в `src/utils/svgTint.ts`
- [ ] `NodeImage.ts` — переключить на использование утилиты (поведение не меняется)
- [ ] Прогнать `typecheck + test` — убедиться, что существующие тесты Node/SvgExporter проходят

### Шаг 5. CIcon — компонент иконки
- [ ] `src/elements/composite/CIcon.ts` — реализация с нуля:
  - загрузка через HTMLImageElement, кеширование
  - SVG tinting через утилиту из шага 4
  - backgroundColor, fillColor, visible, onClick
  - measure(), render(), hitTest(), serialize(), toSVG()
  - onChange колбэк
- [ ] `src/elements/composite/CIcon.test.ts` — тесты:
  - measure() возвращает width/height
  - render() вызывает ctx.drawImage()
  - render() с backgroundColor рисует фон
  - hitTest() корректен
  - visible: false — render() ничего не рисует
  - serialize() round-trip
  - toSVG() генерирует `<image>`
  - onChange при смене source, fillColor и т.д.
- [ ] Прогнать `typecheck + test`

### Шаг 6. CDivider — разделитель
- [ ] `src/elements/composite/CDivider.ts` — горизонтальная/вертикальная линия
- [ ] `src/elements/composite/CDivider.test.ts` — тесты:
  - measure() возвращает thickness по главной оси
  - render() рисует линию ctx.moveTo/lineTo
  - toSVG() генерирует `<line>`
  - serialize() round-trip
- [ ] Прогнать `typecheck + test`

### Шаг 7. CContainer — flex-контейнер
- [ ] `src/elements/composite/CContainer.ts` — использует flexLayout():
  - children: CComponent[], addChild/removeChild/insertChild
  - measure() — измеряет детей, запускает layout, возвращает contentSize
  - render() — запускает layout на assigned bounds, рендерит каждого ребёнка
  - hitTest() — обход детей back-to-front
  - serialize()/toSVG()
  - onChange пробрасывается от всех детей
- [ ] `src/elements/composite/CContainer.test.ts` — тесты:
  - measure() с разными children (text + icon + divider)
  - render() вызывает render() у каждого видимого ребёнка с правильными bounds
  - hitTest() возвращает правильного ребёнка
  - hitTest() возвращает null при клике мимо
  - addChild/removeChild обновляют состояние
  - onChange всплывает от вложенного ребёнка
  - serialize() → deserialize() round-trip для дерева
  - toSVG() генерирует `<g>` с детьми
- [ ] Прогнать `typecheck + test`

### Шаг 8. CShape — фигура-контейнер
- [ ] `src/elements/composite/CShape.ts` — рамка + фон + вложенный CContainer:
  - borderColor, borderWidth, backgroundColor, cornerRadius, padding, onClick
  - content?: CContainer (рекурсивная композиция)
  - measure() учитывает border + padding + content
  - render() рисует rect, затем рендерит content
  - hitTest(), serialize(), toSVG()
- [ ] `src/elements/composite/CShape.test.ts` — тесты:
  - measure() с content и без
  - render() рисует rect + вложенный контент
  - hitTest() проходит в content
  - borderWidth/cornerRadius влияют на рендеринг
  - serialize() round-trip с вложенным деревом
  - toSVG() генерирует `<rect>` + вложенные элементы
- [ ] Прогнать `typecheck + test`

### Шаг 9. CompositeNode — основной класс
- [ ] `src/elements/composite/CompositeNode.ts`:
  - extends Node, typeName 'composite'
  - shapeType switch для рисования внешней формы (rectangle, circle, diamond, custom через pathFactory)
  - override renderContents() — layout + render дерева компонентов
  - auto-size: после measure() подстраивает width/height (minWidth, minHeight)
  - getComponent(id) — рекурсивный поиск по id
  - getComponentAtPoint(worldPoint) — hit testing по дереву
- [ ] `src/elements/composite/index.ts` — реэкспорт + фабрики container(), text(), icon(), shape(), divider()
- [ ] `src/index.ts` — экспортировать composite модуль
- [ ] `src/elements/composite/CompositeNode.test.ts` — тесты:
  - render() рисует внешнюю форму + контент
  - shapeType: rectangle, circle, diamond, custom — корректная отрисовка
  - auto-size: нода растёт под содержимое
  - auto-size: minWidth/minHeight соблюдаются
  - auto-size: ручной resize → autoSize = false
  - getComponent(id) находит вложенные компоненты
  - getComponent() возвращает undefined для несуществующего id
  - getComponentAtPoint() находит правильный компонент
  - hitTest() внешней формы работает для разных shapeType
  - порты работают (наследство от Node)
  - markDirty() пробрасывается от компонентов
  - фабричные функции container/text/icon/shape/divider создают правильные типы
- [ ] Прогнать `typecheck + test + build`

### Шаг 10. Интерактивность — клики по компонентам
- [ ] `src/core/DiagramRenderer.ts` — добавить `componentClick` в DiagramEvents
- [ ] `src/core/InteractionManager.ts` — в handleClick():
  - если кликнутый элемент CompositeNode → getComponentAtPoint()
  - если найден компонент с onClick → вызвать
  - emit('componentClick', nodeId, component, point)
- [ ] Тесты в `InteractionManager.test.ts`:
  - клик по CompositeNode эмитит componentClick
  - onClick компонента вызывается
  - клик мимо компонентов — componentClick не эмитится
- [ ] Прогнать `typecheck + test`

### Шаг 11. Inline-редактирование name
- [ ] `src/core/InteractionManager.ts` — в handleDoubleClick():
  - если CompositeNode → найти CText с role 'name'
  - вычислить screen-bounds этого CText
  - открыть inline-редактор (textarea)
- [ ] `src/core/history/commands.ts` — добавить `ChangeComponentPropertyCommand`
- [ ] По завершении редактирования: создать команду в HistoryManager
- [ ] Тесты:
  - двойной клик по CompositeNode → находит CText с role 'name'
  - ChangeComponentPropertyCommand: execute/undo корректно меняют значение
- [ ] Прогнать `typecheck + test`

### Шаг 12. Сериализация
- [ ] `src/elements/composite/deserialize.ts` — `deserializeCComponent()` рекурсивная фабрика
- [ ] `src/utils/Serializer.ts` — обработка type 'composite':
  - serializeNode(): добавить content, shapeType, cornerRadius, autoSize, minWidth, minHeight
  - nodeFactory hint: документировать в типах как пользователь обрабатывает type 'composite'
- [ ] Тесты в `Serializer.test.ts`:
  - CompositeNode serialize → deserialize round-trip
  - Вложенные CShape/CContainer корректно восстанавливаются
  - Свойства компонентов (text, source, style) сохраняются
  - Обратная совместимость: существующие ноды сериализуются как раньше
- [ ] Прогнать `typecheck + test`

### Шаг 13. SVG-экспорт
- [ ] `toSVG()` — финальная реализация для каждого компонента (если не сделано ранее)
- [ ] `src/utils/SvgExporter.ts` — обработка CompositeNode:
  - рисует внешнюю форму как SVG path/rect/circle
  - вычисляет layout
  - вызывает toSVG() у дерева компонентов
- [ ] Тесты в `SvgExporter.test.ts`:
  - CompositeNode экспортируется в валидный SVG
  - Вложенные компоненты присутствуют в SVG
  - CText с rotation генерирует transform="rotate()"
  - Совместимость с существующим SVG-экспортом (обычные ноды не сломаны)
- [ ] Прогнать `typecheck + test`

### Шаг 14. Обновить существующие examples
- [ ] `examples/basic/` — обновить дизайн через /frontend-design
- [ ] `examples/ports/` — обновить дизайн через /frontend-design
- [ ] `examples/custom-shapes/` — обновить дизайн через /frontend-design
- [ ] `examples/performance/` — обновить дизайн через /frontend-design
- [ ] Прогнать `build`, убедиться что примеры работают

### Шаг 15. Новый example — composite
- [ ] `examples/composite/index.html` — страница с тулбаром и canvas
- [ ] `examples/composite/app.js` — демонстрация:
  - BPMN Task (иконка типа + название + маркеры внизу)
  - BPMN Swimlane (вертикальный текст заголовка)
  - ArchiMate Element (иконка справа + название по центру)
  - C4 Container (title + technology + description разными стилями)
  - UML Class (секции с divider: name | attributes | methods)
  - Демо inline-редактирования (двойной клик на name)
  - Демо click callback на иконках
  - Демо программного изменения свойств (кнопки в тулбаре)
  - SVG-экспорт композитных нод
  - Сериализация/десериализация
- [ ] Прогнать дизайн через /frontend-design
- [ ] Прогнать `build`, убедиться что пример работает

### Шаг 16. Performance example — добавить CompositeNode
- [ ] `examples/performance/app.js` — добавить секцию с CompositeNode:
  - Генерация 200-500 CompositeNode (BPMN/ArchiMate/C4/UML микс)
  - Соединения между ними
  - FPS-счётчик при скролле/зуме по области с composite-нодами
  - Сравнение: обычные ноды vs composite-ноды
- [ ] Прогнать дизайн через /frontend-design
- [ ] Прогнать `build`, убедиться что пример работает

### Шаг 17. Обновить навигацию examples
- [ ] `examples/index.html` — добавить карточку для composite example
- [ ] Проверить ссылки между примерами в header nav
- [ ] Прогнать `build`

### Шаг 18. Финальная верификация
- [ ] `npm run typecheck` — нет ошибок
- [ ] `npm run test` — все тесты проходят
- [ ] `npm run test:coverage` — покрытие не упало ниже порогов
- [ ] `npm run lint` — нет ошибок
- [ ] `npm run build` — сборка успешна
- [ ] `npm run serve` — все 5 примеров работают корректно
- [ ] Вручную проверить: drag, resize, select, connect, undo/redo, inline-edit, SVG export, serialization для CompositeNode

## Файлы, требующие изменений

**Новые файлы:**
- `src/elements/composite/CComponent.ts`
- `src/elements/composite/CText.ts`
- `src/elements/composite/CIcon.ts`
- `src/elements/composite/CDivider.ts`
- `src/elements/composite/CContainer.ts`
- `src/elements/composite/CShape.ts`
- `src/elements/composite/FlexLayout.ts`
- `src/elements/composite/CompositeNode.ts`
- `src/elements/composite/deserialize.ts`
- `src/elements/composite/index.ts`
- `src/utils/svgTint.ts`
- `src/elements/composite/FlexLayout.test.ts`
- `src/elements/composite/CText.test.ts`
- `src/elements/composite/CIcon.test.ts`
- `src/elements/composite/CDivider.test.ts`
- `src/elements/composite/CContainer.test.ts`
- `src/elements/composite/CShape.test.ts`
- `src/elements/composite/CompositeNode.test.ts`
- `examples/composite/index.html`
- `examples/composite/app.js`

**Изменяемые файлы:**
- `src/types.ts` — добавить SerializedCompositeNode
- `src/core/DiagramRenderer.ts` — добавить componentClick в DiagramEvents
- `src/core/InteractionManager.ts` — клики по компонентам + inline-edit для CText role 'name'
- `src/core/history/commands.ts` — добавить ChangeComponentPropertyCommand
- `src/utils/Serializer.ts` — обработка типа composite
- `src/utils/SvgExporter.ts` — обработка CompositeNode
- `src/elements/NodeImage.ts` — вынести SVG tinting в утилиту
- `src/index.ts` — экспортировать composite модуль
- `examples/performance/app.js` — добавить CompositeNode нагрузку
- `examples/index.html` — добавить карточку composite
- `examples/basic/`, `examples/ports/`, `examples/custom-shapes/`, `examples/performance/` — обновить дизайн
