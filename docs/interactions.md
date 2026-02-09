# Интерактивность и менеджеры

## Включение взаимодействий

```ts
const interactions = renderer.enableInteractions({
  gridSize: 20,
  snapToGrid: true,
});
```

`enableInteractions()` возвращает `InteractionManager` с доступом к менеджерам:

- `selection` — выбор элементов.
- `drag` — перетаскивание.
- `resize` — изменение размеров узлов.
- `navigation` — панорамирование/зум.
- `connection` — создание и переподключение связей.
- `history` — undo/redo.

## InteractionManager API

```ts
interactions.zoomToSelection(40);
interactions.history.undo();
interactions.history.redo();
```

### Опции `enableInteractions()`

- `createEdge` — фабрика для новых рёбер.
- `nodeFactory`, `edgeFactory` — используются при вставке/восстановлении.
- `snapToGrid`, `gridSize` — базовая настройка сетки.
- `keymap` — настройка клавиш (copy/paste/undo/redo/delete).

## Навигация

```ts
interactions.navigation.fitToView(50);
interactions.navigation.zoomToSelection(bounds, 40);
interactions.navigation.resetView();
```

## Перетаскивание

```ts
interactions.drag.setSnapToGrid(true, 20);
```

## События

Менеджеры являются `EventEmitter` и могут подписывать на события:

```ts
interactions.drag.on('dragstart', (ids) => {
  // обработка id элементов
});
```

## Контекстное меню

```ts
const interactions = renderer.enableInteractions();

renderer.enableContextMenu({
  menu: {
    node: (target) => [
      { label: 'Удалить', action: () => interactions.deleteByIds([target.node.id]) },
    ],
    edge: (target) => [
      { label: 'Удалить связь', action: () => interactions.deleteByIds([target.edge.id]) },
    ],
    canvas: [
      { label: 'Добавить узел', action: (target) => { /* создать узел по target.point */ } },
    ],
  },
});
```
