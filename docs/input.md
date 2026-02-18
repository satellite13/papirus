# InputHandler

`InputHandler` — низкоуровневый нормализатор ввода:

- мышь (`click`, `dblclick`, `mousedown`, `mouseup`, `mousemove`, `wheel`);
- touch (`pan`, `pinch`, а также mouse-like события);
- клавиатура (`keydown`, `keyup`).

Используется внутри `InteractionManager`, но может применяться и отдельно.

## Создание

```ts
const input = new InputHandler({
  canvas,
  screenToWorld: (x, y) => renderer.screenToWorld(x, y),
});
```

## События

```ts
input.on('mousedown', (event) => {
  console.log(event.worldX, event.worldY);
});

input.on('wheel', (event) => {
  console.log(event.deltaY);
});

input.on('pinch', (event) => {
  console.log(event.scale);
});
```

Поддерживаемые события:

- `click`
- `dblclick`
- `mousedown`
- `mouseup`
- `mousemove`
- `wheel`
- `pan`
- `pinch`
- `keydown`
- `keyup`

## Нормализованный event

`InputEvent` содержит:

- экранные координаты (`screenX`, `screenY`);
- мировые координаты (`worldX`, `worldY`);
- модификаторы (`ctrlKey`, `shiftKey`, `altKey`, `metaKey`);
- `button`;
- `originalEvent`.

Дополнительно:

- `WheelInputEvent`: `deltaX`, `deltaY`, `deltaZ`.
- `PanInputEvent`: `deltaX`, `deltaY`.
- `PinchInputEvent`: `scale`.

## Touch-поведение

- один палец эмулирует mouse-like поток (`mousedown/mousemove/mouseup`);
- два и более пальцев генерируют `pan` и `pinch`.

## Клавиатура

События клавиатуры игнорируются, если фокус в:

- `input`, `textarea`, `select`;
- `contenteditable`-элементе.

Это предотвращает конфликт горячих клавиш с вводом текста.

## Обновление трансформации

```ts
input.setScreenToWorld((x, y) => renderer.screenToWorld(x, y));
```

Полезно после изменения viewport/размера canvas, если используется внешний конвертер координат.

## Очистка

```ts
input.destroy();
```

Удаляет все подписанные DOM-обработчики и очищает listeners `EventEmitter`.
