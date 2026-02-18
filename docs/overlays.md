# Оверлеи

Оверлеи подключаются через `renderer.use(...)` и рисуются поверх/под диаграммой.

## GridOverlay

```ts
renderer.use(new GridOverlay({ gridSize: 20, color: '#e0e0e0' }));
```

- `gridSize` — шаг сетки.
- `color` — цвет линий.

## MiniMap

```ts
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12 }));
```

- `width`, `height` — размеры миникарты.
- `padding` — отступы от края канваса.
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
