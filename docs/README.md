# Документация Papirus

Здесь собрана расширенная документация по API и возможностям библиотеки.

- [Обзор API](./api.md)
- [DiagramRenderer](./renderer.md)
- [Элементы диаграммы](./elements.md)
- [Интерактивность и менеджеры](./interactions.md)
- [InputHandler](./input.md)
- [SearchManager](./search.md)
- [Оверлеи](./overlays.md)
- [Утилиты](./utils.md)

## Основная документация

- [README (English)](../README.md)
- [README (Русский)](../README.ru.md)

## Быстрые ссылки

- npm: `https://www.npmjs.com/package/@ngroznykh/papirus`
- Пример: `examples/index.html`
- Входная точка API: `src/index.ts` (список экспортов)

## Что показано в примере

- Группы (`Group`) и иерархия элементов.
- Иконки в узлах (`NodeImage` через `icon`).
- Фон подписи ребра (`labelBackground`) и разрыв линии под меткой (`labelLineGap`).
- Продвинутая подпись ребра: позиция вдоль пути (`labelPosition`) и поворот по касательной (`labelFollowPath`).
- Composite-пример с `CompositeNode` (BPMN/ArchiMate/C4/UML + swimlane/status-card) и сериализацией компонентного дерева.
- `zoomToSelection()` и управление снаппингом через `drag.setSnapToGrid()`.
- Линейки в `ports`-примере — это встроенный оверлей `RulersOverlay`, подключаемый через `renderer.use(...)`.

## Что дальше

Начните с `api.md`, затем переходите к разделам по элементам, интерактивности и утилитам.
