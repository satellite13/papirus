# Интерактивность и менеджеры

Этот раздел покрывает `InteractionManager`, связанные менеджеры (`selection`, `drag`, `resize`, `navigation`, `connection`, `history`), обработку ввода и контекстное меню.

## Быстрый старт

```ts
const interactions = renderer.enableInteractions({
  snapToGrid: true,
  gridSize: 20,
  alignToNodes: true,
});
```

`enableInteractions()` возвращает `InteractionManager`:

- `selection` — выбор элементов.
- `drag` — перетаскивание.
- `resize` — изменение размеров узлов.
- `navigation` — панорамирование/зум.
- `connection` — создание и переподключение связей.
- `history` — undo/redo.

## Опции `enableInteractions()`

- `createEdge` — фабрика для новых рёбер при интерактивном соединении.
- `nodeFactory`, `edgeFactory` — используются для вставки (`Ctrl/Cmd+V`) и восстановления.
- `snapToGrid`, `gridSize` — базовая настройка перемещения/ресайза.
- `alignToNodes` — smart-align при перетаскивании узлов к другим узлам.
- `alignmentScreenTolerance` — расстояние в пикселях экрана, в пределах которого при перетаскивании срабатывают направляющие выравнивания (по умолчанию из константы, обычно 8). Задайте большее значение (например 80), чтобы направляющие «магнитились» с большего расстояния.
- `attachToOutline` — при `true` стрелки можно привязывать в любой точке контура фигуры (не только к портам); позиция сохраняется в `outlineParam`. <kbd>Shift</kbd>+клик по узлу — начать связь с контура.
- `previewPathType` — тип линии превью во время протягивания новой связи: `'bezier'` (по умолчанию) или `'straight'`.
- `keymap` — кастомизация клавиш:
  - `deleteKeys`
  - `copyKey`
  - `pasteKey`
  - `undoKey`
  - `redoKey`

## Public API `InteractionManager`

### Доступ к менеджерам

- `selection`, `drag`, `resize`, `navigation`, `connection`, `history`.

### Изменение свойств с историей

Эти методы автоматически создают снапшот "до/после" и добавляют изменения в undo/redo:

- `changeNodeProperties(nodeId, apply)`
- `changeEdgeProperties(edgeId, apply)`
- `changeGroupProperties(groupId, apply)`

```ts
interactions.changeNodeProperties(node.id, (n) => {
  n.style = { ...n.style, fillColor: '#dbeafe' };
});
```

### Операции над выборкой

- `removeNodeFromGroups(nodeId, groupIds?)` — удалить узел из указанных/всех групп.
- `deleteByIds(ids)` — удалить узлы/рёбра по id с поддержкой undo.
- `zoomToSelection(padding?)` — приблизить камеру к выбранным узлам.

### Жизненный цикл

- `destroy()` — отписывает обработчики ввода и очищает оверлеи взаимодействия.

## Клавиши по умолчанию

- `Delete` / `Backspace` — удалить выделение.
- `Ctrl/Cmd + C` — копировать.
- `Ctrl/Cmd + V` — вставить.
- `Ctrl/Cmd + Z` — undo.
- `Ctrl/Cmd + Y` — redo.
- `Ctrl/Cmd + Shift + Z` — redo (альтернатива).

## Комбинации мыши/клавиатуры

- `Ctrl/Cmd + Click` — добавить/убрать элемент из выделения.
- `Ctrl/Cmd + drag` по пустому месту — рамочное выделение.
- `Click + drag` по пустому месту — панорамирование.
- `Space + Left Mouse drag` — панорамирование.
- `Middle Mouse drag` — панорамирование.
- `Wheel` — zoom.
- `Esc` — закрыть открытое контекстное меню.

## Inline-редактирование меток

Встроено в `InteractionManager`:

- двойной клик по узлу или ребру открывает inline-редактор метки;
- `Enter` — сохранить;
- `Shift + Enter` — новая строка;
- `Esc` — отменить;
- `blur` — сохранить.

Изменения меток также попадают в историю. Для узлов после сохранения применяется авто-перенос по словам внутри ширины фигуры (и расширение только при длинных неразбиваемых словах).

## Навигация

```ts
interactions.navigation.fitToView(50);
interactions.navigation.zoomToSelection(bounds, 40);
interactions.navigation.resetView();
```

## Перетаскивание и снаппинг

```ts
interactions.drag.setSnapToGrid(true, 20);
interactions.drag.setAlignmentEnabled(true);
interactions.resize.setSnapToGrid(true, 20);
interactions.connection.setSnapToGrid(true, 20);
interactions.connection.setAttachToOutline(true);  // привязка стрелок по контуру фигуры
```

### Smart-align и направляющие

При `setAlignmentEnabled(true)` во время drag узел может магнититься к:

- левому/центральному/правому краю других узлов;
- верху/центру/низу других узлов.

При срабатывании выравнивания отображаются направляющие линии (вертикальная/горизонтальная).

### Редактируемая полилиния (`editable-polyline`)

Для ребра с `type: 'editable-polyline'` доступны интерактивные точки перелома:

- drag синей точки — перемещение перелома;
- click по маленькому `+` на сегменте — добавить новый перелом;
- double-click по синей точке — удалить перелом.

Дополнительно:

- при включённом `snapToGrid` точки перелома привязываются к сетке;
- при drag точки работают осевые магниты (к вертикали/горизонтали соседних сегментов);
- при drag узла ближайшая ортогональная точка перелома может сопровождать движение для сохранения геометрии.

## События менеджеров

Менеджеры реализованы через `EventEmitter` и поддерживают подписки:

```ts
interactions.drag.on('dragstart', (ids) => {
  // ids перетаскиваемых узлов
});
```

## Контекстное меню

Контекстное меню подключается отдельно через `DiagramRenderer`:

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

Отключение:

```ts
renderer.disableContextMenu();
renderer.disableInteractions();
```

## InputHandler (низкоуровневый ввод)

`InteractionManager` использует `InputHandler` под капотом. Для кастомных сценариев можно использовать его напрямую.

Подробная справка: `docs/input.md`.
