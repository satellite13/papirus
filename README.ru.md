# Papirus

[![npm version](https://img.shields.io/npm/v/papirus.svg)](https://www.npmjs.com/package/papirus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Papirus — библиотека на TypeScript для построения интерактивных 2D‑схем на HTML Canvas. Поддерживает узлы, связи, группы, стили, сериализацию, экспорт и интерактивность.

[English version](./README.md)

## О проекте

Papirus — это движок рендера и взаимодействия с диаграммами, рассчитанный на встраивание в любой UI (SPA, статические страницы, дизайн‑системы). Библиотека поставляет:

- Рендерер (`DiagramRenderer`) с системой координат, масштабированием и панорамированием.
- Набор элементов (узлы/рёбра/группы) и базовые типы.
- Менеджеры взаимодействий (выделение, перемещение, соединение, история).
- Контекстное меню и поиск/фильтрация.
- Базовые анимации и анимированный поток рёбер.
- Темизацию и стили через `StyleManager`.
- Оверлеи (сетка, миникарта, линейки, направляющие) и утилиты экспорта.

## Установка

```bash
npm install papirus
```

## Быстрый старт

```ts
import { DiagramRenderer, RectangleNode, Edge } from 'papirus';

const renderer = new DiagramRenderer('#canvas', {
  width: 900,
  height: 600,
  backgroundColor: '#fafafa',
});

const nodeA = new RectangleNode({ x: 100, y: 100, width: 140, height: 60, label: 'Start' });
const nodeB = new RectangleNode({ x: 360, y: 100, width: 140, height: 60, label: 'Process' });

renderer.addNode(nodeA);
renderer.addNode(nodeB);
renderer.addEdge(new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  type: 'bezier',
}));

renderer.enableInteractions();
```

## Документация

- [Обзор API](./docs/api.md)
- [Элементы](./docs/elements.md)
- [Интерактивность](./docs/interactions.md)
- [Оверлеи](./docs/overlays.md)
- [Утилиты](./docs/utils.md)

## Возможности

### Интерактивность

Встроенный `InteractionManager` включает:

- drag/select/connect/undo/redo/copy/paste
- Панорамирование по пустому месту канваса
- Zoom колесом, pinch‑to‑zoom, two‑finger pan

```ts
const interactions = renderer.enableInteractions({ gridSize: 20, snapToGrid: true });
interactions.navigation.fitToView();
```

Создание связи по умолчанию: `Shift + drag` от узла к узлу.

### Элементы и группы

```ts
const group = new Group({ label: 'Main Flow', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);

const node = new RectangleNode({
  x: 20, y: 20, width: 120, height: 60,
  ports: [{ type: 'input', position: 'left' }],
  icon: { source: '/icons/start.svg', fit: 'contain', scaleWithBounds: true },
});
```

### Стили

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

### Сериализация

```ts
import { Serializer } from 'papirus';

const serializer = new Serializer(renderer, {
  nodeFactory: (data) => new RectangleNode(data),
  edgeFactory: (data) => new Edge(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

### Экспорт

```ts
import { ImageExporter, SvgExporter } from 'papirus';

const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2 });

const svgExporter = new SvgExporter(renderer);
await svgExporter.download('diagram.svg');
```

### Оверлеи

```ts
import { GridOverlay, MiniMap } from 'papirus';

renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12 }));
```

Доступны также `RulersOverlay`, `GuidesOverlay`, `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`.

## Интеграции

- [Vue 3](./packages/vue)

## Пример

См. [`examples/index.html`](./examples/index.html).

## Разработка

```bash
npm install
npm run dev
```

Полезные команды:

```bash
npm run typecheck       # Проверка типов TypeScript
npm run lint            # ESLint
npm run format          # Форматирование Prettier
npm run build           # Сборка библиотеки
npm run test            # Запуск тестов
npm run test:coverage   # Тесты с покрытием
```

## Contributing

См. [CONTRIBUTING.md](./CONTRIBUTING.md).

## Лицензия

MIT — см. [LICENSE](./LICENSE).
