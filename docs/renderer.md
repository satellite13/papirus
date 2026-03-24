# DiagramRenderer

`DiagramRenderer` — центральный класс библиотеки. Управляет:

- canvas и render loop;
- viewport (zoom/pan);
- коллекциями `nodes`, `edges`, `groups`;
- подключением плагинов/оверлеев;
- событиями рендера и изменений.

## Создание

```ts
const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 550,
  backgroundColor: '#fafafa',
  minZoom: 0.1,
  maxZoom: 5,
  initialZoom: 1,
  snapToGrid: false,
  scrollbar: true,
  animations: {
    enabled: true,
    enterDuration: 220,
    exitDuration: 180,
  },
});
```

Можно передать CSS-селектор или `HTMLCanvasElement`.

## Основные свойства

- `zoom`, `offsetX`, `offsetY` — состояние камеры.
- `viewport` — `{ zoom, offsetX, offsetY }` (get/set).
- `nodes`, `edges`, `groups` — readonly-коллекции элементов.
- `width`, `height` — размеры canvas в CSS-пикселях.
- `pixelRatio` — DPR, используемый рендерером.
- `snapToGrid` — текущая настройка снаппинга.

## Координаты

```ts
const world = renderer.screenToWorld(clientX, clientY);
const screen = renderer.worldToScreen(world.x, world.y);
```

## Работа с элементами

### Узлы

- `addNode(node)`
- `removeNode(nodeId)`
- `getNode(nodeId)`

### Рёбра

- `addEdge(edge)`
- `removeEdge(edgeId)`
- `getEdge(edgeId)`

### Группы

- `addGroup(group)`
- `removeGroup(groupId)`
- `getGroup(groupId)`

### Hit-test

- `getElementAtPoint(point)` — возвращает `Node | Edge | Group | undefined`.

## Рендер и жизненный цикл

- `markDirty()` — пометить сцену к перерисовке.
- `render()` — принудительный рендер кадра.
- `resize(width, height)` — изменить размер canvas.
- `destroy()` — остановить loop, удалить обработчики и очистить данные.

## Интерактивность

- `enableInteractions(options?)` — подключить `InteractionManager`.
- `disableInteractions()`
- `enableContextMenu(options)`
- `disableContextMenu()`

Подробнее: `docs/interactions.md`.

## Плагины и оверлеи

### Подключение плагинов

```ts
renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 160, height: 100, contentMargin: 200 }));
```

### Ручные underlay/overlay-слои

```ts
const removeOverlay = renderer.addOverlayRenderer((ctx) => {
  // custom render
});

const removeUnderlay = renderer.addUnderlayRenderer((ctx) => {
  // custom background render
});
```

Обе функции возвращают cleanup callback.

## Стили и анимации

- `setStyleManager(styleManager)` / `getStyleManager()`
- `getAnimationManager()` — доступ к `AnimationManager` (highlight/enter/exit).

## События `DiagramRenderer`

Подписка через `renderer.on(...)`:

- `render`
- `zoom`
- `pan`
- `select`
- `nodeAdd`, `nodeRemove`
- `edgeAdd`, `edgeRemove`
- `nodeBadgeClick` — клик по бейджу узла (`nodeId`, `badgeId`)

```ts
renderer.on('zoom', (value) => {
  console.log('zoom', value);
});
```
