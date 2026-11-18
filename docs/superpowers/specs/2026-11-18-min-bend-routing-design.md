# Авто-роутинг polyline: минимум изломов с обходом узлов

Дата: 2026-11-18. Ветка: `feat/edge-edit-ux`.

## Цель

Автоматический маршрут polyline-связи строится с минимально необходимым числом
изломов и при этом не пересекает размещённые узлы.

Критерии успеха:

- Изломы — главный критерий, длина — второй. Один излом «стоит» `ROUTE_BEND_COST = 160` px
  длины: обход, который длиннее более чем на 160 px на каждый сэкономленный излом,
  не выбирается.
- Путь не пересекает внутренность препятствий (с отступом роутера).
- Стороны выхода/входа не меняются (решение пользователя): оптимизируется только путь
  между ними.

Вне рамок: выбор стороны/порта (`EdgeEndpointUpdater`), ручные `editable-polyline`
(`controlPoints`), self-loop-шаблоны, Bezier/Straight, код warchi.

## Текущее состояние (причины лишних изломов)

1. `routeOrthogonalAround.searchMidPath`: `BEND_PENALTY = 0.001` — поиск минимизирует длину,
   изломы почти бесплатны.
2. Там же поиск стартует с направлением `'s'` (любое) и не учитывает направление прихода
   к `endEntry`, поэтому повороты на стыке с хвостами выхода/входа не считаются.
3. `contourProximityPenalty` = `segLen × 14 × proximity`: 200 px вдоль границы ≈ 2800 —
   роутер покупает обход ценой многих изломов.
4. `fallbackOuterRoute` выбирает кандидата по длине.
5. `PolylinePathStrategy.buildRoutedPolyline`: `TURN_PENALTY = 70` — отдельная, более слабая шкала.

## Дизайн

### 1. Единая стоимость — `src/elements/paths/routeCost.ts` (новый)

```ts
export const ROUTE_BEND_COST = 160;
export function countBends(path: Point[]): number; // повороты между неколлинеарными отрезками
export function orthogonalRouteCost(path: Point[]): number; // manhattan-длина + countBends × ROUTE_BEND_COST
```

`countBends` игнорирует нулевые отрезки и коллинеарные вершины.

### 2. `routeOrthogonalAround`

- `BEND_PENALTY` → `ROUTE_BEND_COST`.
- `searchMidPath` получает `startAxis` (ось `fromDir`: `left/right → 'h'`, `top/bottom → 'v'`)
  и `goalAxis` (ось `toDir`). Стартовое состояние — `dir = startAxis` (продолжение хвоста
  прямо бесплатно, поворот = излом). При достижении цели состояние с `dir !== goalAxis`
  получает `+ROUTE_BEND_COST`; цель принимается по минимальной итоговой стоимости
  (не по первому извлечению узла цели, если штраф прихода ещё не учтён).
- `contourProximityPenalty` ограничивается сверху: `min(текущая формула, ROUTE_BEND_COST / 2)`
  на отрезок. Остаётся тай-брейком между путями с равным числом изломов (mid-gap против
  линии хвоста), но не добавляет изломы. Принятое следствие: линия может идти параллельно
  узлу на расстоянии отступа вместо обхода.
- `fallbackOuterRoute` выбирает кандидата по `orthogonalRouteCost`.

Неизменно: `computeStartExit`/`computeEndEntry`, `exitDistance`, `margin`, обработка
`parent`/`internalParent`, `preserveFacingGap`/`peelForFacingGap`, same-side логика,
`clampFacingExitEntry`, `simplifyPath`.

### 3. `PolylinePathStrategy.buildRoutedPolyline`

`TURN_PENALTY` → `ROUTE_BEND_COST`. `FIRST_VERTICAL_PENALTY` остаётся тай-брейком.

### 4. Срез лишних изломов — `src/elements/paths/reduceOrthogonalBends.ts` (новый)

```ts
export function reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[];
```

- Вход — ортогональный путь `[from, …, to]`. Первый и последний отрезки не меняются
  (сохраняет стороны и направление стрелки); оптимизируются вершины `p1 … p(n-2)`.
- Для пар `i < j` в этом диапазоне пробуются замены участка `p_i … p_j`: прямая (если
  `p_i`, `p_j` на одной оси) или L-уголок через `(p_i.x, p_j.y)` либо `(p_j.x, p_i.y)`.
- Замена принимается, если ни один новый отрезок не пересекает внутренность препятствий
  (`segmentIntersectsOpenInterior`) и `orthogonalRouteCost` всего пути строго уменьшается.
- Жадно до отсутствия улучшений, не более 8 проходов; результат через коллинеарное
  упрощение. Пути из ≤ 3 точек возвращаются как есть.

Подключение в `PolylinePathStrategy.calculatePath` — внутри `finish(...)`, то есть для
`routeOrthogonalAround`, `buildRoutedPolyline`, `calculateDirectedPath`, manhattan.
Не применяется к `editablePolyline` и self-loop-шаблонам.

Препятствия для проверки: `options.obstacles`, расширенные на тот же `margin = 4`, что
передаётся в `routeOrthogonalAround`; исключаются контейнеры, в открытой внутренности
которых лежат **оба** конца. Если есть контейнер, содержащий ровно один конец (вложенная
связь, выход через стенку), проход пропускается целиком.

## Тестирование (TDD)

Новые:

- `reduceOrthogonalBends.test.ts`: лестница → L; замена не режет препятствие (путь не
  меняется); первый/последний отрезки сохраняются; минимальный путь без изменений;
  короткие пути как есть.
- `routeCost.test.ts`: `countBends` (коллинеарные/нулевые отрезки), `orthogonalRouteCost`.
- `minBendRouting.test.ts` через `PolylinePathStrategy.calculatePath` с ролями
  `source`/`target`:
  - right→top, цель снизу-справа, без помех — 1 излом;
  - right→left со смещением по Y — 2 излома;
  - right→left на одной высоте, узел-помеха между ними — 4 излома, путь не пересекает помеху;
  - несколько узлов «лестницей» — число изломов не больше минимального для раскладки;
  - баланс: при обходе, длиннее на ≫ 160 px за излом, выбирается более короткий путь.

Существующие `src/elements/paths/*.test.ts` должны остаться зелёными. Если тест падает
только из-за более простой геометрии (меньше изломов, нет пересечений), ожидание
переутверждается явной проверкой числа изломов, и каждый такой случай показывается
пользователю. Падение из-за пересечения узла — баг.

Визуальная проверка: демо papirus, раскладки до/после, скриншоты.

## Влияние

- warchi: авто-маршруты пересчитываются при загрузке; сохранённые `controlPoints` не
  меняются; правок кода нет, только пересборка зависимости papirus.
- Документация: `docs/interactions.md` или раздел о роутинге — строка о критерии
  «изломы × 160 + длина»; `CHANGELOG.md` / `CHANGELOG.ru.md`.
