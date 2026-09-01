# Papirus

[![npm version](https://img.shields.io/npm/v/%40ngroznykh%2Fpapirus.svg)](https://www.npmjs.com/package/@ngroznykh/papirus)
[![CI](https://github.com/satellite13/papirus/actions/workflows/ci.yml/badge.svg)](https://github.com/satellite13/papirus/actions/workflows/ci.yml)
[![License: AGPL%20v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

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
npm install @ngroznykh/papirus
```

## Требования

- Node.js `^20.19.0 || >=22.12.0`
- Современный браузер с поддержкой Canvas API (Chrome, Edge, Firefox, Safari)

## Быстрый старт

```ts
import { DiagramRenderer, RectangleNode, Edge } from '@ngroznykh/papirus';

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

- [Индекс документации](./docs/README.md)
- [Обзор API](./docs/api.md)
- [CompositeNode](./docs/composite.md)
- [Элементы](./docs/elements.md)
- [Рендерер](./docs/renderer.md)
- [Интерактивность](./docs/interactions.md)
- [Ввод](./docs/input.md)
- [Поиск](./docs/search.md)
- [Оверлеи](./docs/overlays.md)
- [Утилиты](./docs/utils.md)
- [Changelog](./CHANGELOG.ru.md)
- [Политика безопасности](./SECURITY.ru.md)

## Возможности

### Интерактивность

Встроенный `InteractionManager` включает:

- drag/select/connect/undo/redo/copy/paste
- Панорамирование по пустому месту канваса
- Zoom колесом, pinch‑to‑zoom, two‑finger pan
- Smart-align к другим фигурам при перетаскивании (с направляющими)

```ts
const interactions = renderer.enableInteractions({
  gridSize: 20,
  snapToGrid: true,
  previewPathType: 'straight', // 'straight' | 'bezier'
});
interactions.navigation.fitToView();
interactions.drag.setAlignmentEnabled(true);
```

Создание связи по умолчанию: перетягивание от одной точки (anchor) узла к другой, без модификаторов.

Горячие клавиши по умолчанию:
- `Delete/Backspace` — удалить выделение
- `Ctrl/Cmd + C` / `Ctrl/Cmd + V` — копировать/вставить
- `Ctrl/Cmd + Z` — отмена
- `Ctrl/Cmd + Y` или `Ctrl/Cmd + Shift + Z` — повтор

Для редактируемой полилинии:
- `type: 'editable-polyline'` поддерживает draggable точки перелома.
- На серединах сегментов доступны маленькие `+` для добавления новых точек.
- Двойной клик по точке перелома удаляет её.
- Для точек перелома работают snap к сетке и осевые магниты при перетаскивании.

### Элементы и группы

```ts
const group = new Group({ label: 'Main Flow', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);

const node = new RectangleNode({
  x: 20, y: 20, width: 120, height: 60,
  ports: [{ type: 'input', position: 'left' }],
  contentInset: { top: 8, right: 10, bottom: 8, left: 10 },
  label: {
    text: 'Start service',
    inset: 8,
    style: { align: 'left', verticalAlign: 'top' },
  },
  icon: {
    source: '/icons/start.svg',
    fit: 'contain',
    scaleWithBounds: true,
    placement: 'top-right',
    inset: 6,
  },
});
```

### Компоновка контента и фон подписи связи

Компоновка узла строится в два шага:
- `contentInset` задаёт контентную область внутри границ фигуры;
- `label.inset` задаёт внутренний отступ текста внутри контентной области.

Иконка и текст используют одну контентную область:
- позиция иконки задаётся через `icon.placement` и `icon.inset`;
- выравнивание текста задаётся через `label.style.align` и `label.style.verticalAlign`.

Для подписей связей доступен фон через `labelBackground`:

```ts
const edge = new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  label: 'API call',
  labelOffset: 12,
  labelPosition: 0.65, // 0..1 вдоль пути ребра (0 = начало, 1 = конец)
  labelFollowPath: true, // поворачивать подпись по направлению ребра
  labelLineGap: true, // линия разрывается под подписью
  labelBackground: {
    color: '#ffffff',
    opacity: 0.9,
    borderRadius: 6,
  },
});
```

### CompositeNode (компонентная flex-компоновка)

`CompositeNode` позволяет собирать нотационные элементы как дерево компонентов (`container`, `text`, `icon`, `shape`, `divider`) с flexbox-подобной раскладкой:

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
      text({ id: 'name', text: 'Service API', bindToProperty: '__name__', style: { alignSelf: 'center' } }),
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

Сериализация компонентов (`SerializedCComponent`) включает поля для редакторов и интеграций:
- `label` — человекочитаемая подпись компонента для host-редактора.
- `bindToProperty` — привязка значения `text` к имени свойства (`'__name__'` для отображаемого имени узла).
- `bindsNotationIcon` — признак того, что `icon` привязан к иконке на уровне нотации.

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
import { Serializer } from '@ngroznykh/papirus';

const serializer = new Serializer(renderer, {
  nodeFactory: (data) => {
    if (data.type === 'composite') {
      /* см. docs/utils.md — deserializeCComponent + CompositeNode */
    }
    return new RectangleNode(data);
  },
  edgeFactory: (data) => new Edge(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

Примеры для нескольких типов узлов и composite: [Утилиты](./docs/utils.md).

### Экспорт

```ts
import { ImageExporter, SvgExporter } from '@ngroznykh/papirus';

const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2 });

const svgExporter = new SvgExporter(renderer);
svgExporter.download('diagram.svg');
```

### Оверлеи

```ts
import { GridOverlay, MiniMap } from '@ngroznykh/papirus';

renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12, contentMargin: 200 }));
```

Доступны также `RulersOverlay`, `GuidesOverlay`, `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`.

## Интеграции

Papirus не привязан к конкретному фреймворку и может быть встроен в Vue/React/Svelte/vanilla приложения.

## Пример

См. интерактивные локальные примеры в [`examples/index.html`](./examples/index.html).

## Версионирование и стабильность API

Papirus следует [Semantic Versioning](https://semver.org/lang/ru/).  
Текущая мажорная версия `0.x`, поэтому между минорными релизами возможны изменения API.

Все важные изменения фиксируются в [CHANGELOG.ru.md](./CHANGELOG.ru.md).

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

Ключевые файлы для open-source процесса:

- [CONTRIBUTING.md](./CONTRIBUTING.md) / [CONTRIBUTING.ru.md](./CONTRIBUTING.ru.md)
- [SECURITY.md](./SECURITY.md) / [SECURITY.ru.md](./SECURITY.ru.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) / [CODE_OF_CONDUCT.ru.md](./CODE_OF_CONDUCT.ru.md)

## Лицензия

Проект использует dual licensing:

- `AGPL-3.0-or-later` для open-source использования
- Коммерческая лицензия для проприетарного/закрытого коммерческого использования

См.:

- [LICENSE](./LICENSE) / [LICENSE.ru.md](./LICENSE.ru.md)
- [LICENSE_COMMERCIAL.md](./LICENSE_COMMERCIAL.md) / [LICENSE_COMMERCIAL.ru.md](./LICENSE_COMMERCIAL.ru.md)
