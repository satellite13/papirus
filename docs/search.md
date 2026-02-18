# SearchManager

`SearchManager` отвечает за:

- поиск по меткам узлов и рёбер;
- навигацию по найденным совпадениям;
- подсветку совпадений поверх диаграммы;
- фильтрацию видимости элементов по критериям.

## Создание

```ts
const search = new SearchManager(renderer, {
  highlightColor: '#f59e0b',
  currentColor: '#ef4444',
  highlightLineWidth: 2,
  currentLineWidth: 3,
  highlightPadding: 6,
});
```

## Поиск

```ts
const result = search.find('api', {
  highlight: true,
  caseSensitive: false,
});
```

`find()` возвращает:

- `matches`: `{ id, type, label }[]`
- `nodes`: совпавшие узлы
- `edges`: совпавшие рёбра

Поиск идет по `label.text` у узлов и рёбер.

## Навигация по совпадениям

```ts
const next = search.next();
const prev = search.previous();
```

- `next()` и `previous()` циклически переключают текущее совпадение.
- Возвращают `SearchMatch | null`.
- Текущее совпадение подсвечивается сильнее (`currentColor/currentLineWidth`).

## Очистка

```ts
search.clear();
```

Очищает:

- подсветку поиска;
- фильтр видимости;
- текущий индекс/результаты поиска.

## Фильтрация видимости

```ts
search.filter({
  nodeType: 'RectangleNode',
  edgeType: 'bezier',
  styleClass: 'warning',
  scope: 'all', // 'nodes' | 'edges' | 'all'
  predicate: (element) => true,
});
```

`filter()` управляет `visible` у элементов и запоминает исходную видимость.

```ts
search.clearFilter();
```

`clearFilter()` восстанавливает исходную `visible` для узлов и рёбер.

## Жизненный цикл

```ts
search.destroy();
```

`destroy()` снимает overlay-подсветку и очищает внутреннее состояние менеджера.

## Связь с анимациями

Если у рендерера включены анимации, `SearchManager` использует `AnimationManager` для pulse-подсветки текущих совпадений.
