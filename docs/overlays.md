# Оверлеи

Оверлеи подключаются через `renderer.use(...)` и рисуются поверх/под диаграммой. Все оверлеи поддерживают опцию `enabled` (по умолчанию `true`).

## GridOverlay

```ts
renderer.use(new GridOverlay({ gridSize: 20, color: '#e0e0e0' }));
```

- `gridSize` — шаг сетки.
- `color` — цвет линий.

## MiniMap

```ts
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12, contentMargin: 200 }));
```

- `width`, `height` — размеры миникарты.
- `padding` — отступы от края канваса.
- `contentMargin` — отступ (в мировых координатах) вокруг контента; расширяет область, в пределах которой можно перемещать view при перетаскивании рамки.
- `anchor` — позиция: `'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'` (по умолчанию `'bottom-right'`).
- `enabled` — включён ли оверлей (по умолчанию `true`).
- `backgroundColor`, `borderColor`, `viewportColor` — цвета оформления.

## RulersOverlay

```ts
renderer.use(new RulersOverlay({ thickness: 20 }));
```

- `thickness` — толщина линейки.
- `backgroundColor`, `textColor`, `tickColor` — цвета оформления.
- В `examples/ports` линейки нарисованы именно этим оверлеем, это часть библиотеки, а не отдельный кастомный код примера.

## GuidesOverlay

```ts
renderer.use(new GuidesOverlay({ vertical: [100, 240], horizontal: [80] }));
```

- `vertical`, `horizontal` — массивы координат направляющих.
- `color`, `lineWidth` — оформление линий.
