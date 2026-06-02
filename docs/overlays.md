# Оверлеи

Оверлеи подключаются через `renderer.use(...)` и рисуются поверх/под диаграммой. Все оверлеи реализуют `DiagramPlugin` (`install` / `destroy`) и поддерживают опцию `enabled` (по умолчанию `true`).

## Контракт `DiagramPlugin` для указателя

Оверлеи, которые перехватывают мышь (например `MiniMap`), могут реализовать опциональные методы:

| Метод | Назначение |
|-------|------------|
| `blocksDiagramPointerAtScreen(renderer, screenX, screenY)` | `true` — клики/drag по диаграмме в этой точке экрана игнорируются (выделение, связи, resize). |
| `beginOverlayDrag(renderer, screenX, screenY)` | Начало drag-сессии оверлея; возвращает opaque `payload`. |
| `updateOverlayDrag(renderer, screenX, screenY, payload)` | Обновление drag; `false` — сессия завершена. |
| `endOverlayDrag(renderer, payload)` | Завершение drag. |

`DiagramRenderer` маршрутизирует эти вызовы через `beginOverlayDrag()`, `blocksDiagramPointerAtScreen()`. `InteractionManager`, `ConnectionManager`, `ResizeManager` и `ContextMenuManager` учитывают блокировку указателя.

Пример кастомного оверлея с drag-рамкой (упрощённо):

```ts
class MyOverlay implements DiagramPlugin {
  name = 'my-overlay';

  install(renderer: DiagramRenderer): void {
    renderer.addOverlayRenderer((ctx) => { /* draw */ });
  }

  blocksDiagramPointerAtScreen(renderer, screenX, screenY): boolean {
    return this.hitTest(screenX, screenY);
  }

  beginOverlayDrag(renderer, screenX, screenY): unknown {
    if (!this.hitTest(screenX, screenY)) return undefined;
    return { startX: screenX, startY: screenY };
  }

  updateOverlayDrag(renderer, screenX, screenY, payload): boolean {
    // move viewport / selection rect
    return true;
  }

  endOverlayDrag(renderer, payload): void {
    // cleanup
  }
}
```

См. реализацию: `src/core/overlays/MiniMap.ts`.

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
