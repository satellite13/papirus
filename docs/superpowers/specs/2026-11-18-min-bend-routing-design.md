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
- У конца связи — перпендикулярный к стороне цели хвостик длиной `endStubLength`
  («видимый размер маркера конца + 4 px»), если перед целью есть поворот (раздел 5).

Вне рамок: выбор стороны/порта (`EdgeEndpointUpdater`), ручные `editable-polyline`
(`controlPoints`), self-loop-шаблоны, Bezier/Straight, хвост у начала (остаётся 20 px),
код warchi.

## Текущее состояние

Причины лишних изломов:

1. `routeOrthogonalAround.searchMidPath`: `BEND_PENALTY = 0.001` — поиск минимизирует длину,
   изломы почти бесплатны.
2. Там же поиск стартует с направлением `'s'` (любое) и не учитывает направление прихода
   к `endEntry`, поэтому повороты на стыке с хвостами выхода/входа не считаются. То же
   в `buildRoutedPolyline`.
3. `contourProximityPenalty` = `segLen × 14 × proximity` за пиксель: 200 px вдоль границы ≈ 2800 —
   роутер покупает обход ценой многих изломов.
4. `fallbackOuterRoute` выбирает кандидата по длине.
5. `PolylinePathStrategy.buildRoutedPolyline`: `TURN_PENALTY = 70` — отдельная, более слабая шкала.

Причины слишком короткого хвоста у конца:

6. `routeOrthogonalAround` пропускает `endEntry`, если путь уже подходит к цели на расстоянии
   ≥ 1 px (`isOnApproachOutside(…, 1)`).
7. `clampFacingExitEntry` при близких узлах друг напротив друга ставит поворот на середину
   зазора — хвост может быть короче наконечника.
8. `calculateDirectedPath` ставит поворот на середине (`midY`/`midX`/`jogY`) без нижней границы
   до цели; в ветке «оба вертикальных» `entryY` вычисляется, но не используется.

Контекст: препятствия из `DiagramRenderer.getNodeObstacles` расширены на 4 px
(`pad = 4`); `routeOrthogonalAround` добавляет `margin = 4` (итого 8 px от видимого края),
`buildRoutedPolyline` — `OBSTACLE_MARGIN = 12` (итого 16 px). `routeOrthogonalAround`
экспортируется только из внутреннего `paths/index.ts`, не из корня пакета; warchi его
напрямую не вызывает.

## Дизайн

### 1. Единая стоимость — `src/elements/paths/routeCost.ts` (новый)

```ts
export const ROUTE_BEND_COST = 160;
export function countBends(path: Point[]): number;
export function orthogonalRouteCost(path: Point[]): number; // manhattan-длина + countBends × ROUTE_BEND_COST
```

`countBends` считает вершины, где меняется ось движения; нулевые отрезки и коллинеарные
вершины не считаются. Стоимость всегда считается по полному пути `[from, …, to]`.

### 2. Поиск в обоих роутерах

Изменения в `routeOrthogonalAround.searchMidPath` и в A* внутри
`PolylinePathStrategy.buildRoutedPolyline` одинаковые:

- Штраф за поворот — `ROUTE_BEND_COST` (вместо `BEND_PENALTY` и `TURN_PENALTY`).
- Стартовое состояние — `dir = startAxis`, ось стороны выхода (`left/right → 'h'`,
  `top/bottom → 'v'`): продолжение хвоста прямо бесплатно, поворот — излом. Состояния `'s'`
  больше нет; `FIRST_VERTICAL_PENALTY` удаляется (он работал только для `'s'`).
- Ребро, входящее в узел цели (`endEntry`) с `dir !== goalAxis` (ось стороны входа),
  получает `+ROUTE_BEND_COST` при релаксации. Штраф учитывается до извлечения из очереди,
  поэтому первое извлечение цели остаётся оптимальным; эвристика Манхэттена остаётся
  допустимой.

Только в `routeOrthogonalAround`:

- `contourProximityPenalty`: коэффициент 14 → `CONTOUR_COST_PER_PX = 0.2` (× `proximity`).
  Ограничивать сверху «на отрезок» нельзя: длинное прилипание состоит из многих коротких
  рёбер решётки, и предел не сработал бы. С 0.2/px прилипание стоит одного излома только
  на 800 px, а два излома — на 1600 px. Штраф остаётся тай-брейком между путями с равным
  числом изломов (mid-gap против линии хвоста). Принятое следствие: линия может идти
  параллельно узлу на расстоянии отступа вместо обхода.
- `fallbackOuterRoute(from, to, startExit, endEntry, obstacles)` выбирает кандидата по
  `orthogonalRouteCost([from, ...candidate, to])`, а не по длине.

Не меняются: `computeStartExit`, `exitDistance` (хвост у начала), `margin`,
`parent`/`internalParent`, `preserveFacingGap`/`peelForFacingGap`, same-side логика
(`clearCorridorOfOthers`, `offsetSameSideAroundBlockers`, `canAlignSameSideExits`),
`simplifyPath`, `ensureOrthogonalPath`. `computeEndEntry`, `isOnApproachOutside` и
`clampFacingExitEntry` меняются только по разделу 5.

### 3. Срез лишних изломов — `src/elements/paths/reduceOrthogonalBends.ts` (новый)

```ts
export function reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[];
```

- Вход — ортогональный путь `[p0 = from, …, p(n-1) = to]`. Пути из ≤ 3 точек возвращаются
  как есть.
- Перебираются пары `1 ≤ i < j ≤ n-2`. Участок `p_i … p_j` заменяется прямой (если `p_i`,
  `p_j` на одной оси) или L-уголком через `(p_i.x, p_j.y)` либо `(p_j.x, p_i.y)`.
- Замена принимается, если ни один новый отрезок не пересекает внутренность препятствий
  (`segmentIntersectsOpenInterior`) и `orthogonalRouteCost` всего пути строго уменьшается.
- Жадно до отсутствия улучшений, не более 8 проходов; в конце удаляются коллинеарные вершины.
- Точки `p0`, `p1`, `p(n-2)`, `p(n-1)` не двигаются, поэтому направление первого и последнего
  отрезков сохраняется. Длина этих отрезков может только вырасти: если после замены
  соседний отрезок оказался на той же оси, вершины сливаются. Укоротить хвост у конца
  проход не может.

Подключение: в `PolylinePathStrategy.calculatePath` внутри `finish(...)` — для
`routeOrthogonalAround`, `buildRoutedPolyline`, `calculateDirectedPath`, manhattan.
Не применяется к `editablePolyline` и self-loop-шаблонам.

Препятствия для проверки — `options.obstacles`, расширенные на `margin = 4` (как в
`routeOrthogonalAround`). Роли берутся из `resolveRoutingRoles`:

- `source` и `target` проверяются как обычные препятствия. Точки `p1` и `p(n-2)` лежат
  снаружи их расширенных прямоугольников: хвост у начала 20 px, у конца `endStubLength ≥ 12`,
  а расширение 8 px.
- Препятствие, кроме `source`/`target`, содержащее **оба** конца (общий контейнер), из
  проверки исключается.
- Препятствие, кроме `source`/`target`, содержащее **ровно один** конец (вложенная связь,
  выход через стенку контейнера), — проход пропускается целиком.

`source`/`target` исключены из определения контейнера, потому что препятствия расширены:
`from` лежит внутри расширенного `source`, `to` — внутри расширенного `target`.

### 4. Документация

- `docs/elements.md` (стр. 182) и `docs/utils.md` (стр. 112): «обход по кратчайшему
  внешнему каналу» заменить на «минимум изломов, затем длина (излом = 160 px); у конца
  перпендикулярный хвостик по размеру маркера».
- `CHANGELOG.md` / `CHANGELOG.ru.md`.

### 5. Хвостик у конца

**Правило.** Применяется, когда сторона входа известна (`resolveApproachDir` вернул
сторону). Последний отрезок авто-пути идёт по нормали к этой стороне. Точка входа
(`endEntry`) по умолчанию ставится ровно на `endStubLength` от `to`. Дальше её отодвигают
только правила, которые не добавляют изломов:

- прямая связь без поворотов;
- середина зазора между целью и соседом (`computeEndEntry` mid-gap);
- выравнивание и обход блокеров в same-side случаях (`canAlignSameSideExits`,
  `clearCorridorOfOthers`, `offsetSameSideAroundBlockers`);
- слияние с соседним отрезком в `reduceOrthogonalBends`.

Короче `endStubLength` хвост бывает в одном случае: близкие узлы друг напротив друга
с зазором `G < endStubLength + END_STUB_FACING_START_MIN` (см. `clampFacingExitEntry` ниже).

Без известной стороны входа (manhattan без направлений) правило не применяется.

**Длина.**

```ts
// src/elements/edge/EdgeMarkerRenderer.ts
export function getMarkerVisualLength(config: ArrowMarkerConfig): number;
// size = config.size ?? MARKER_SIZES[type] ?? ARROW_SIZE
// arrow/open/stealth/diamond → size; circle/square → size × 2; none → 0

// src/constants.ts
export const END_STUB_EXTRA = 4;
export const END_STUB_MIN = 12;
export const END_STUB_FACING_START_MIN = 8;
export const DEFAULT_END_STUB = MARKER_SIZES.arrow + END_STUB_EXTRA; // 16
// endStubLength = max(END_STUB_MIN, getMarkerVisualLength(endMarker) + END_STUB_EXTRA)
```

| Маркер конца | `endStubLength` |
|---|---|
| arrow / open / stealth (12) | 16 |
| diamond (14) | 18 |
| circle / square (6 × 2) | 16 |
| нет (`endMarker` не задан или `type: 'none'`) | 12 |
| старая стрелка: ни `startMarker`, ни `endMarker` не заданы, `arrowType ≠ 'none'` (`ARROW_SIZE = 10`) | 14 |

Логика повторяет `renderEdgeMarkers`: если задан хоть один из `startMarker`/`endMarker`,
размер берётся из `endMarker`. Иначе при `arrowType ≠ 'none'` — `ARROW_SIZE`, при
`arrowType = 'none'` — 0.

`END_STUB_MIN = 12` больше расширения цели в `routeOrthogonalAround` (4 + 4 = 8 px). Поэтому
`endEntry` лежит снаружи расширенной цели и остаётся узлом решётки.

Видимый размер, а не `getCanvasMarkerLength`: у `open` тот возвращает 0 (линия не
укорачивается), хотя визуально наконечник 12 px.

**Передача.** Новое поле `PathStrategyOptions.endStubLength?: number`.
`Edge.recalculatePath` вычисляет его из `_startMarker`, `_endMarker` и `_arrowType` по
таблице выше. Сеттеры `endMarker`, `startMarker` и `arrowType` сейчас только вызывают
`markDirty()` — они будут вызывать и `recalculatePath()`. Если опция не передана,
стратегия берёт `DEFAULT_END_STUB` (16), чтобы прямые вызовы `calculatePath` и
`routeOrthogonalAround` в тестах вели себя как стрелка по умолчанию.

**Применение.**

- `routeOrthogonalAround`: новое поле входа `endStubLength` (по умолчанию `DEFAULT_END_STUB`).
  - `computeEndEntry` строит фиксированный хвост на `endStubLength` вместо `exitDistance`;
    mid-gap остаётся.
  - Пропуск `endEntry`: `isOnApproachOutside(lastMid, to, toDir, endStubLength)` вместо
    `minClearance = 1`.
  - `clampFacingExitEntry` получает `endStubLength`. `G` — зазор между `from` и `to` по оси
    подхода. Если `G ≥ endStubLength + END_STUB_FACING_START_MIN`, точка встречи ставится на
    `endStubLength` от `to` (хвост у начала укорачивается до `G − endStubLength`). Иначе
    остаётся середина: хвостик у конца короче, но без петли назад через источник.
- `buildRoutedPolyline`:
  - Цель (`resolveRoutingRoles().target`) расширяется на `ROUTE_TARGET_MARGIN = 4`
    вместо `OBSTACLE_MARGIN = 12`, и в решётке, и в проверке отрезков. Иначе точка входа
    на 16 px оказалась бы внутри расширенной цели (4 + 12 = 16 px, проверка закрытая):
    узел решётки отбросился бы, и роутер вернул бы `null`.
  - `endEntry = moveOutsideObstacles(to, toDir, obstaclesWithoutTarget, endStubLength)`,
    а для цели — проверка с `ROUTE_TARGET_MARGIN`. Начало без изменений
    (`ROUTE_EXIT_DISTANCE = 32`).
- `calculateDirectedPath`: последний поворот перед целью ставится на середине (как сейчас),
  если до `to` по оси подхода остаётся ≥ `endStubLength`; иначе ровно на `endStubLength`
  от `to`. Касается веток «оба вертикальных», «оба горизонтальных», «горизонтальный →
  вертикальный» (`jogY`). В ветке «вертикальный → горизонтальный» `MIN_SEGMENT_LENGTH`
  у входа заменяется на `endStubLength`. В ветке «оба вертикальных» используется
  вычисленный `entryY`.

## Тестирование (TDD)

Новые:

- `routeCost.test.ts`: `countBends` (коллинеарные и нулевые отрезки не считаются),
  `orthogonalRouteCost`.
- `reduceOrthogonalBends.test.ts`:
  - лестница превращается в L;
  - замена, режущая препятствие, отклоняется (путь не меняется);
  - направление первого и последнего отрезков сохраняется, длина не уменьшается;
  - минимальный путь без изменений;
  - пути из ≤ 3 точек как есть;
  - вложенная связь (контейнер содержит ровно один конец) — проход пропускается.
- `minBendRouting.test.ts` через `PolylinePathStrategy.calculatePath`, препятствия с
  `pad = 4` и ролями `source`/`target`:
  - right→top, цель снизу-справа, без помех — 1 излом;
  - right→left со смещением по Y — 2 излома;
  - right→left на одной высоте, узел-помеха между ними — 4 излома, путь не пересекает помеху;
  - три узла «лестницей», связь первого с третьим — не больше изломов, чем минимум для
    раскладки (фиксируется в тесте числом);
  - баланс: раскладка, где обход с −2 изломами длиннее на > 320 px, — выбирается путь
    с большим числом изломов;
  - путь вдоль длинного узла на отступе — без дополнительных изломов (следствие
    `CONTOUR_COST_PER_PX`).
- `endStub.test.ts`:
  - для всех сценариев `minBendRouting`: последний отрезок по нормали к стороне входа,
    длина ≥ `endStubLength`; в сценариях без соседа напротив цели и без same-side — ровно
    `endStubLength`;
  - `getMarkerVisualLength` и `endStubLength`: arrow/open → 16, diamond → 18, circle → 16,
    без маркера → 12, старая стрелка через `arrowType` → 14, задан только `startMarker` → 12;
  - близкие узлы друг напротив друга: при `G ≥ endStubLength + 8` хвост у конца ровно
    `endStubLength`; при меньшем `G` — середина, без петли (нет U-поворота);
  - `buildRoutedPolyline` (без ролей, связь от ребра) — хвост у конца `endStubLength`, путь
    не `null`;
  - `calculateDirectedPath` (без препятствий) — во всех четырёх ветках хвост ≥ `endStubLength`;
  - `Edge` с `endMarker` передаёт `endStubLength` в стратегию; смена `endMarker`,
    `startMarker` или `arrowType` пересчитывает путь.

Существующие `src/elements/paths/*.test.ts` должны остаться зелёными. Допустимые причины
падения, после которых ожидание переутверждается:

- путь стал проще (меньше изломов, без пересечений) — ожидание заменяется явной проверкой
  числа изломов;
- хвост у конца стал `endStubLength` вместо 20 (например, `assertNotOnEntryStub` в
  `contourCrawl.test.ts` проверяет линию `to + endStubLength`).

Каждый такой случай показывается пользователю. Падение из-за пересечения узла — баг.

Визуальная проверка: `npm run dev`, страницы `examples/basic` и `examples/composite`,
скриншоты до/после.

## Влияние

- warchi: авто-маршруты пересчитываются при загрузке; сохранённые `controlPoints` не
  меняются; правок кода нет, только пересборка зависимости papirus.
