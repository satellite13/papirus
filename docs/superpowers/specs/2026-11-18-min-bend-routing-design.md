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
- У конца связи — перпендикулярный к стороне фигуры хвостик ровно «размер маркера конца + 4 px»,
  когда перед целью есть поворот (см. раздел 5).

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

### 5. Хвостик у конца

Правило: последний отрезок авто-пути идёт по нормали к стороне цели (`toDir`). Если перед
ним есть поворот, его длина ровно `endStubLength`. Длиннее он бывает только когда это
получилось без лишних изломов: прямая связь без поворотов или поворот на середине зазора
между узлами (`computeEndEntry` mid-gap). Начало связи не меняется (хвост выхода 20 px).

Длина:

```ts
// src/elements/edge/EdgeMarkerRenderer.ts
export function getMarkerVisualLength(config: ArrowMarkerConfig): number;
// arrow/open/stealth/diamond → size; circle/square → size × 2; none → 0
// size = config.size ?? MARKER_SIZES[type] ?? ARROW_SIZE

// src/constants.ts
export const END_STUB_EXTRA = 4;
export const END_STUB_MIN = 8;
// endStubLength = max(END_STUB_MIN, getMarkerVisualLength(endMarker) + END_STUB_EXTRA)
// стрелка по умолчанию (12) → 16 px; без маркера → 8 px
```

Видимый размер, а не `getCanvasMarkerLength`: у `open` тот возвращает 0 (линия не
укорачивается), хотя визуально наконечник 12 px.

Передача: `PathStrategyOptions.endStubLength?: number`. `Edge.recalculatePath` вычисляет
его из `_endMarker`; сеттер `endMarker` вызывает `recalculatePath`, если ещё не вызывает.
Без опции стратегия берёт `DEFAULT_END_STUB = MARKER_SIZES.arrow + END_STUB_EXTRA` (16 px),
чтобы прямые вызовы `calculatePath` в тестах вели себя как стрелка по умолчанию.

Применение:

- `routeOrthogonalAround`: новый вход `endStubLength`. `computeEndEntry` строит
  фиксированный хвост на `endStubLength` вместо `exitDistance` (mid-gap остаётся).
  `isOnApproachOutside(lastMid, …, endStubLength)` вместо `minClearance = 1`.
  `clampFacingExitEntry`: точка встречи сдвигается к источнику так, чтобы до цели
  оставалось ≥ `endStubLength` (`min(mid, to − endStubLength)` по оси подхода). Исключение:
  если весь зазор между `from` и `to` меньше `endStubLength`, остаётся середина — иначе
  получится петля назад через источник.
- `buildRoutedPolyline`: дистанция выхода у конца (`ROUTE_EXIT_DISTANCE` для `to`) →
  `endStubLength`; у начала без изменений.
- `calculateDirectedPath`: при повороте перед целью последний отрезок по `toDir` длиной
  `endStubLength`.
- `reduceOrthogonalBends` последний отрезок не трогает — правило сохраняется.

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
- `endStub.test.ts`:
  - инвариант для всех сценариев `minBendRouting`: последний отрезок по нормали к `toDir`,
    длина ≥ `endStubLength`; при повороте без mid-gap — ровно `endStubLength`;
  - `endStubLength` из маркера: стрелка → 16, ромб → 18, без маркера → 8;
  - близкие узлы друг напротив друга: хвост у конца ≥ `endStubLength`, точка встречи
    смещена к источнику; зазор < `endStubLength` — середина, без петли;
  - `Edge` с `endMarker` передаёт `endStubLength` в стратегию.
- `contourCrawl.test.ts`: `assertNotOnEntryStub` проверяет линию хвоста по
  `endStubLength` (16), а не по 20.

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
