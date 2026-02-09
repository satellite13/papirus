# Papirus

Papirus — библиотека на TypeScript для построения интерактивных 2D‑схем на HTML Canvas. Поддерживает узлы, связи, группы, стили, сериализацию, экспорт и интерактивность.

## О проекте

Papirus — это движок рендера и взаимодействия с диаграммами, рассчитанный на встраивание в любой UI (SPA, статические страницы, дизайн‑системы). Библиотека поставляет:

- Рендерер (`DiagramRenderer`) с системой координат, масштабированием и панорамированием.
- Набор элементов (узлы/рёбра/группы) и базовые типы.
- Менеджеры взаимодействий (выделение, перемещение, соединение, история).
- Контекстное меню и поиск/фильтрация.
- Базовые анимации и анимированный поток рёбер.
- Темизацию и стили через `StyleManager`.
- Оверлеи (сетка, миникарта, линейки, направляющие) и утилиты экспорта.

## Документация

- Краткий обзор API: `docs/api.md`
- Элементы и узлы: `docs/elements.md`
- Интерактивность: `docs/interactions.md`
- Оверлеи: `docs/overlays.md`
- Утилиты: `docs/utils.md`

## Интеграции

- Vue 3: `packages/vue`

## Установка

```bash
npm install papirus
```

## Использование в своем проекте

### Минимальный сценарий

1. Добавьте `<canvas>` в разметку.
2. Создайте `DiagramRenderer`, добавьте элементы и включите взаимодействия.

### Импорт из ESM

```ts
import { DiagramRenderer, RectangleNode, Edge } from 'papirus';
```

### Пример интеграции

```ts
const renderer = new DiagramRenderer('#canvas', {
  width: 900,
  height: 600,
  backgroundColor: '#fafafa',
  scrollbarOverlay: true,
});

const nodeA = new RectangleNode({ x: 80, y: 80, width: 140, height: 60, label: 'Start' });
const nodeB = new RectangleNode({ x: 320, y: 80, width: 140, height: 60, label: 'Process' });
renderer.addNode(nodeA);
renderer.addNode(nodeB);
renderer.addEdge(new Edge({ from: { nodeId: nodeA.id }, to: { nodeId: nodeB.id }, type: 'bezier' }));

renderer.enableInteractions({ gridSize: 20, snapToGrid: true });
```

Параметр `scrollbarOverlay` включает встроенные скролл‑индикаторы для панорамирования.

## Быстрый старт

```ts
import {
  DiagramRenderer,
  RectangleNode,
  Edge,
  StyleManager,
} from 'papirus';

const renderer = new DiagramRenderer('#canvas', {
  width: 900,
  height: 600,
  backgroundColor: '#fafafa',
});

const styles = new StyleManager();
styles.registerClass({
  name: 'warning',
  node: { fillColor: '#fef3c7', strokeColor: '#d97706' },
});
renderer.setStyleManager(styles);

const nodeA = new RectangleNode({
  x: 100,
  y: 100,
  width: 140,
  height: 60,
  label: 'Start',
});

const nodeB = new RectangleNode({
  x: 360,
  y: 100,
  width: 140,
  height: 60,
  label: 'Process',
  styleClass: 'warning',
});

renderer.addNode(nodeA);
renderer.addNode(nodeB);

const edge = new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  type: 'bezier',
});
renderer.addEdge(edge);

renderer.enableInteractions();
```

## Интерактивность

Встроенный `InteractionManager` включает:

- drag/select/connect/undo/redo/copy/paste
- panning по пустому месту канваса
- zoom колесом, pinch‑to‑zoom, two‑finger pan

Пример:

```ts
const interactions = renderer.enableInteractions({ gridSize: 20, snapToGrid: true });
interactions.navigation.fitToView();
interactions.zoomToSelection(40);
interactions.drag.setSnapToGrid(true, 20);
```

Создание связи по умолчанию: `Shift + drag` от узла к узлу (чтобы не мешать обычному перетаскиванию).

## Элементы, группы и порты

```ts
const group = new Group({ label: 'Main Flow', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);

const node = new RectangleNode({
  x: 20,
  y: 20,
  width: 120,
  height: 60,
  ports: [{ type: 'input', position: 'left' }],
  icon: { source: '/icons/start.svg', fit: 'contain', scaleWithBounds: true },
});
```

## Стили

`StyleManager` применяет темы и классы к узлам/рёбрам/тексту/портам/группам.

```ts
const styles = new StyleManager('dark');
styles.registerClass({
  name: 'error',
  node: { fillColor: '#fee2e2', strokeColor: '#dc2626' },
  text: { color: '#991b1b' },
});
renderer.setStyleManager(styles);
```

Доступны готовые темы: `DEFAULT_THEME`, `DARK_THEME`.

## Сериализация

```ts
import { Serializer } from 'papirus';

const serializer = new Serializer(renderer, {
  nodeFactory: (data) => new RectangleNode(data),
  edgeFactory: (data) => new Edge(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

Сериализация сохраняет тему и классы стилей, если установлен `StyleManager`.

## Экспорт

```ts
import { ImageExporter, SvgExporter } from 'papirus';

const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2 });

const svgExporter = new SvgExporter(renderer);
await svgExporter.download('diagram.svg');
```

## Оверлеи и утилиты

```ts
import { GridOverlay, MiniMap } from 'papirus';

renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12 }));
```

Доступны также `RulersOverlay`, `GuidesOverlay`, `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`.

## Пример

См. `examples/index.html`.

## Разработка

```bash
npm install
npm run dev
```

Полезные команды:

```bash
npm run typecheck
npm run lint
npm run format
npm run build
npm run test
npm run test:coverage
```
