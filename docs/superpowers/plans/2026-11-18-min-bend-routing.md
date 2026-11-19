# Min-bend polyline routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Авто-маршрут polyline строится с минимально необходимым числом изломов (излом = 160 px длины), обходит узлы и заканчивается перпендикулярным хвостиком длиной «маркер + 4 px».

**Architecture:** Единая функция стоимости (`routeCost.ts`) используется в A* обоих роутеров (`routeOrthogonalAround.searchMidPath`, `PolylinePathStrategy.buildRoutedPolyline`); поиск учитывает повороты на стыке с хвостами. После роутинга `reduceOrthogonalBends` срезает оставшиеся «лестницы». Длина хвостика у конца вычисляется в `Edge` из маркера и передаётся через `PathStrategyOptions.endStubLength`.

**Tech Stack:** TypeScript, Vitest, Vite. Алиас `@` → `src`.

**Spec:** `docs/superpowers/specs/2026-11-18-min-bend-routing-design.md`

## Global Constraints

- Рабочая директория: `/Users/nikolaygroznyh/Work/warchi-ws/papirus`, ветка `feat/edge-edit-ux`. Каждый Shell-вызов — с `working_directory` = этот путь.
- НИКОГДА не вызывать `move_agent_to_root` / `move_agent_to_cloned_root`. Если какой-либо skill велит переместиться или создать worktree — IGNORE.
- Не коммитить неотслеживаемые `.agents/`, `.claude/`, `.playwright-mcp/`, `agent/`, `skills-lock.json` — только `git add <конкретные файлы>`.
- `ROUTE_BEND_COST = 160`; `CONTOUR_COST_PER_PX = 0.2`; `END_STUB_EXTRA = 4`; `END_STUB_MIN = 12`; `END_STUB_FACING_START_MIN = 8`; `DEFAULT_END_STUB = 16`; `ROUTE_TARGET_MARGIN = 4`; reduce-проход: `margin = 4`, ≤ 8 проходов.
- Стороны выхода/входа не меняются; хвост у начала остаётся (`exitDistance = 20` в `routeOrthogonalAround`, `ROUTE_EXIT_DISTANCE = 32` в `buildRoutedPolyline`, `MIN_SEGMENT_LENGTH = 20` в directed).
- Не трогать: `editable-polyline` (`controlPoints`), self-loop-шаблоны, Bezier/Straight, `EdgeEndpointUpdater`, код warchi.
- Тесты: `npx vitest run <path>`; базовая линия до изменений — `src/elements/paths` + `src/elements/Edge.test.ts`: 14 файлов, 100 тестов, все зелёные.
- Переутверждение существующих тестов допустимо только по двум причинам: (а) путь стал проще — меньше изломов, без пересечений узлов (ожидание заменяется явной проверкой `countBends`); (б) хвост у конца стал `endStubLength` вместо 20/32. Каждый такой тест перечислить в отчёте задачи и в теле коммита (`Reapproved: <file>::<test> — <причина>`). Падение из-за пересечения узла — баг, не переутверждать.
- Комментарии в коде — только ограничения, которые код не показывает. Стиль — как в окружающем коде.
- Уточнение spec: цель без роли (`buildRoutedPolyline`, reduce-проход) — `resolveRoutingRoles().target ?? smallestContaining(to, obstacles, {source})`. Причина: при `pad = 4` точка `to` лежит внутри расширенного прямоугольника, а не на его контуре, и `resolveRoutingRoles` цель без роли не находит.

## Review Focus

- Вложенная связь (источник внутри контейнера, цель снаружи): путь по-прежнему выходит из контейнера без пересечения стенки сбоку, reduce-проход пропускается — тест в Task 6.
- Близкие узлы друг напротив друга (зазор 5…40 px): нет U-поворота «хвостика», хвост у конца ≥ `endStubLength` при зазоре ≥ 24 — тесты в Task 4 (цикл по зазорам в `closeNodesTail.test.ts` + новые).
- Связь без препятствий / без сторон (`calculateDirectedPath`): во всех ветках последний отрезок не заходит внутрь цели и ≥ `endStubLength`; `bottom→bottom` больше не входит в цель сверху — тесты в Task 5.
- Смена маркера/`arrowType` у существующей связи во время работы: путь пересчитывается с новой длиной хвоста — тест в Task 7.
- Same-side обёртки (`top→top`, `left→left`) и связи внутри контейнера не начинают пересекать узлы — существующие `wrapAroundTarget`, `wrapBottomBottom`, `sameSideExitOrder`, `siblingInsideContainer` остаются зелёными (проверка в каждой задаче, меняющей роутер: Task 3, 4, 5, 6).

---

### Task 0: Снимки «до»

**Files:** нет изменений кода.

- [ ] **Step 1: Запустить dev-сервер**

Run (фон): `npm run dev -- --port 5173 --strictPort`
Expected: `Local: http://localhost:5173/`

- [ ] **Step 2: Снять скриншоты**

Открыть `http://localhost:5173/examples/basic/` и `http://localhost:5173/examples/composite/` в браузере (cursor-ide-browser или playwright), выбрать polyline-тип связей, если в примере есть переключатель, сохранить скриншоты в `/tmp/min-bend-before-basic.png` и `/tmp/min-bend-before-composite.png`. Сервер остановить.

- [ ] **Step 3: Базовая линия всех тестов**

Run: `npx vitest run 2>&1 | tee /tmp/min-bend-baseline-tests.txt | tail -20`
Expected: зафиксировать список уже падающих тестов (известны падения в `src/core/ConnectionManager.test.ts` — locked outline slide / magnet bends). Новые падения в Task 7/8 сравниваются с этим файлом.

---

### Task 1: Константы и единая стоимость маршрута

**Files:**
- Modify: `src/constants.ts` (после `MARKER_SIZES`, ~строка 22)
- Create: `src/elements/paths/routeCost.ts`
- Test: `src/elements/paths/routeCost.test.ts`

**Interfaces:**
- Produces: `ROUTE_BEND_COST: number` (160); `countBends(path: readonly Point[]): number`; `orthogonalRouteCost(path: readonly Point[]): number`; в `@/constants`: `END_STUB_EXTRA`, `END_STUB_MIN`, `END_STUB_FACING_START_MIN`, `DEFAULT_END_STUB`.

- [ ] **Step 1: Написать падающий тест**

`src/elements/paths/routeCost.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countBends, orthogonalRouteCost, ROUTE_BEND_COST } from './routeCost';
import {
  DEFAULT_END_STUB,
  END_STUB_EXTRA,
  END_STUB_FACING_START_MIN,
  END_STUB_MIN,
} from '@/constants';

describe('routeCost', () => {
  it('counts axis changes', () => {
    expect(countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
    expect(countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(1);
    expect(
      countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }])
    ).toBe(2);
  });

  it('ignores zero-length segments and colinear vertices', () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe(1);
  });

  it('cost is manhattan length plus bends × ROUTE_BEND_COST', () => {
    expect(ROUTE_BEND_COST).toBe(160);
    expect(
      orthogonalRouteCost([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }])
    ).toBe(30 + 2 * 160);
  });

  it('end stub constants', () => {
    expect(END_STUB_EXTRA).toBe(4);
    expect(END_STUB_MIN).toBe(12);
    expect(END_STUB_FACING_START_MIN).toBe(8);
    expect(DEFAULT_END_STUB).toBe(16);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/elements/paths/routeCost.test.ts`
Expected: FAIL — `Failed to resolve import "./routeCost"`.

- [ ] **Step 3: Реализация**

`src/constants.ts` — сразу после объекта `MARKER_SIZES`:

```ts
// Perpendicular approach stub before the edge end (routing)
export const END_STUB_EXTRA = 4;
export const END_STUB_MIN = 12;
export const END_STUB_FACING_START_MIN = 8;
export const DEFAULT_END_STUB = (MARKER_SIZES.arrow ?? ARROW_SIZE) + END_STUB_EXTRA;
```

`src/elements/paths/routeCost.ts`:

```ts
import type { Point } from '@/types';

export const ROUTE_BEND_COST = 160;

const EPS = 0.001;

type Axis = 'h' | 'v';

function segmentAxis(a: Point, b: Point): Axis | null {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx < EPS && dy < EPS) return null;
  if (dy < EPS) return 'h';
  if (dx < EPS) return 'v';
  return null;
}

export function countBends(path: readonly Point[]): number {
  let bends = 0;
  let prev: Axis | null = null;
  for (let i = 1; i < path.length; i++) {
    const axis = segmentAxis(path[i - 1]!, path[i]!);
    if (!axis) continue;
    if (prev && axis !== prev) bends++;
    prev = axis;
  }
  return bends;
}

export function orthogonalRouteCost(path: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y);
  }
  return length + countBends(path) * ROUTE_BEND_COST;
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx vitest run src/elements/paths/routeCost.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/elements/paths/routeCost.ts src/elements/paths/routeCost.test.ts
git commit -m "feat(paths): shared orthogonal route cost and end stub constants"
```

---

### Task 2: `reduceOrthogonalBends`

**Files:**
- Create: `src/elements/paths/reduceOrthogonalBends.ts`
- Test: `src/elements/paths/reduceOrthogonalBends.test.ts`

**Interfaces:**
- Consumes: `orthogonalRouteCost` (Task 1); `segmentIntersectsOpenInterior(a, b, r): boolean`, `type RouteRect` из `./routeOrthogonalAround`; `collapseColinearPoints(vertices, tol)` из `@/utils/orthogonalSegmentDrag`.
- Produces: `reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[]`.

- [ ] **Step 1: Написать падающие тесты**

`src/elements/paths/reduceOrthogonalBends.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reduceOrthogonalBends } from './reduceOrthogonalBends';
import { countBends } from './routeCost';
import { segmentIntersectsOpenInterior, type RouteRect } from './routeOrthogonalAround';

const staircase = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 30 },
  { x: 60, y: 30 },
  { x: 60, y: 60 },
  { x: 100, y: 60 },
  { x: 100, y: 84 },
  { x: 100, y: 100 },
];

function hits(path: { x: number; y: number }[], obstacles: RouteRect[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (obstacles.some((o) => segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, o))) {
      return true;
    }
  }
  return false;
}

describe('reduceOrthogonalBends', () => {
  it('collapses a staircase into an L', () => {
    expect(reduceOrthogonalBends(staircase, [])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('rejects bridges through obstacles', () => {
    const obstacles: RouteRect[] = [{ x: 40, y: -20, width: 80, height: 40 }];
    const result = reduceOrthogonalBends(staircase, obstacles);
    expect(hits(result, obstacles)).toBe(false);
    expect(countBends(result)).toBe(3);
    expect(countBends(result)).toBeLessThan(countBends(staircase));
  });

  it('keeps first/last segment directions and never shortens the end stub', () => {
    const obstacles: RouteRect[] = [{ x: 40, y: -20, width: 80, height: 40 }];
    const result = reduceOrthogonalBends(staircase, obstacles);
    const first = [result[0]!, result[1]!];
    const last = [result[result.length - 2]!, result[result.length - 1]!];
    expect(first[1]!.y).toBe(0);
    expect(first[1]!.x).toBeGreaterThan(0);
    expect(last[0]!.x).toBe(100);
    expect(last[1]!.y - last[0]!.y).toBeGreaterThanOrEqual(16);
  });

  it('leaves a minimal path unchanged (only colinear cleanup)', () => {
    const z = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 84, y: 50 },
      { x: 100, y: 50 },
    ];
    expect(reduceOrthogonalBends(z, [])).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
  });

  it('returns short and non-orthogonal paths as is', () => {
    const short = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(reduceOrthogonalBends(short, [])).toBe(short);
    const diagonal = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 20 }, { x: 30, y: 20 }];
    expect(reduceOrthogonalBends(diagonal, [])).toBe(diagonal);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/elements/paths/reduceOrthogonalBends.test.ts`
Expected: FAIL — `Failed to resolve import "./reduceOrthogonalBends"`.

- [ ] **Step 3: Реализация**

`src/elements/paths/reduceOrthogonalBends.ts`:

```ts
import type { Point } from '@/types';
import { collapseColinearPoints } from '@/utils/orthogonalSegmentDrag';
import { orthogonalRouteCost } from './routeCost';
import { segmentIntersectsOpenInterior, type RouteRect } from './routeOrthogonalAround';

const MAX_PASSES = 8;
const EPS = 0.001;

function isOrthogonal(path: readonly Point[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (Math.abs(a.x - b.x) >= EPS && Math.abs(a.y - b.y) >= EPS) return false;
  }
  return true;
}

function dedupe(path: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of path) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) >= EPS || Math.abs(prev.y - p.y) >= EPS) {
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

function bridges(a: Point, b: Point): Point[][] {
  if (Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS) return [[]];
  return [[{ x: a.x, y: b.y }], [{ x: b.x, y: a.y }]];
}

function bridgeHits(chain: readonly Point[], obstacles: readonly RouteRect[]): boolean {
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]!;
    const b = chain[i]!;
    if (obstacles.some((o) => segmentIntersectsOpenInterior(a, b, o))) return true;
  }
  return false;
}

function improveOnce(path: Point[], obstacles: readonly RouteRect[]): Point[] | null {
  const n = path.length;
  let best: Point[] | null = null;
  let bestCost = orthogonalRouteCost(path);
  for (let i = 1; i <= n - 4; i++) {
    for (let j = i + 2; j <= n - 2; j++) {
      const a = path[i]!;
      const b = path[j]!;
      for (const bridge of bridges(a, b)) {
        if (bridgeHits([a, ...bridge, b], obstacles)) continue;
        const candidate = [...path.slice(0, i + 1), ...bridge, ...path.slice(j)];
        const cost = orthogonalRouteCost(candidate);
        if (cost < bestCost - EPS) {
          best = candidate;
          bestCost = cost;
        }
      }
    }
  }
  return best;
}

/**
 * Replaces interior sub-chains with a straight run or an L when that lowers
 * `orthogonalRouteCost` without crossing obstacles. `path[0..1]` and
 * `path[n-2..n-1]` stay in place, so the end directions are preserved.
 */
export function reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[] {
  if (path.length <= 3 || !isOrthogonal(path)) return path;
  let current = dedupe(path);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const improved = improveOnce(current, obstacles);
    if (!improved) break;
    current = improved;
  }
  return collapseColinearPoints(current, EPS);
}
```

- [ ] **Step 4: Тесты проходят**

Run: `npx vitest run src/elements/paths/reduceOrthogonalBends.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/paths/reduceOrthogonalBends.ts src/elements/paths/reduceOrthogonalBends.test.ts
git commit -m "feat(paths): reduceOrthogonalBends post-pass"
```

---

### Task 3: Поиск в `routeOrthogonalAround` — изломы дорогие, хвосты учитываются

**Files:**
- Modify: `src/elements/paths/routeOrthogonalAround.ts` — константы (стр. 32–37), `contourProximityPenalty` (стр. 210–243), `type GraphEdge` (стр. 627), `searchMidPath` (стр. 711–777), `fallbackOuterRoute` (стр. 794–833), `routeMidPath` (стр. 835–855), вызов `routeMidPath` (стр. 1021–1028)
- Create: `src/test/routingScenarios.ts` (общие сценарии для тестов; не `*.test.ts`, чтобы импорт не перезапускал чужие тесты)
- Test: `src/elements/paths/minBendRouting.test.ts` (новый), `src/elements/paths/routeOrthogonalAround.test.ts` (дописать)

**Interfaces:**
- Consumes: `ROUTE_BEND_COST`, `orthogonalRouteCost` (Task 1).
- Produces: `export type GraphEdge = { to: number; dir: 'h' | 'v'; length: number }`; `export function searchMidPath(nodes: Point[], edges: Map<number, GraphEdge[]>, startIdx: number, goalIdx: number, startAxis: 'h' | 'v', goalAxis: 'h' | 'v'): Point[] | null`; `contourProximityPenalty` (уже экспортирован) с коэффициентом 0.2/px; из `@/test/routingScenarios`: `type Rect`, `scenarios`, `type Scenario`, `routeScenario(sc: Scenario, endStubLength?: number): Point[]`, `crosses(path, r: Rect): boolean`.

- [ ] **Step 1: Падающие юнит-тесты поиска и контура**

Дописать в конец `src/elements/paths/routeOrthogonalAround.test.ts` (импорты добавить в шапку файла):

```ts
import {
  contourProximityPenalty,
  searchMidPath,
  type GraphEdge,
} from './routeOrthogonalAround';
import { ROUTE_BEND_COST } from './routeCost';

function linkGraph(
  nodes: { x: number; y: number }[],
  links: Array<[number, number, 'h' | 'v', number?]>
): Map<number, GraphEdge[]> {
  const edges = new Map<number, GraphEdge[]>();
  for (const [a, b, dir, len] of links) {
    const length =
      len ?? Math.abs(nodes[a]!.x - nodes[b]!.x) + Math.abs(nodes[a]!.y - nodes[b]!.y);
    edges.set(a, [...(edges.get(a) ?? []), { to: b, dir, length }]);
    edges.set(b, [...(edges.get(b) ?? []), { to: a, dir, length }]);
  }
  return edges;
}

describe('searchMidPath cost model', () => {
  // 0 → 5 directly (0 bends, inflated length) vs detour 0-1-2-3-4-5 (4 bends, 320 px).
  const nodes = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 10 },
    { x: 200, y: 10 },
    { x: 200, y: 0 },
    { x: 300, y: 0 },
  ];
  const detour: Array<[number, number, 'h' | 'v']> = [
    [0, 1, 'h'],
    [1, 2, 'v'],
    [2, 3, 'h'],
    [3, 4, 'v'],
    [4, 5, 'h'],
  ];

  it('takes a longer straight run while it costs less than the bends it saves', () => {
    const edges = linkGraph(nodes, [...detour, [0, 5, 'h', 800]]);
    expect(searchMidPath(nodes, edges, 0, 5, 'h', 'h')).toEqual([nodes[0], nodes[5]]);
  });

  it('accepts bends when the straight run is longer than their cost', () => {
    const edges = linkGraph(nodes, [...detour, [0, 5, 'h', 1000]]);
    expect(searchMidPath(nodes, edges, 0, 5, 'h', 'h')).toEqual(nodes);
  });

  it('counts the turn at the start stub and the arrival axis', () => {
    // start axis h, goal axis v: (0,0)→(100,0)→(100,100) is 1 bend;
    // (0,0)→(0,100)→(100,100) turns at the start and arrives horizontally.
    const sq = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ];
    const edges = linkGraph(sq, [
      [0, 1, 'v'],
      [1, 2, 'h'],
      [0, 3, 'h'],
      [3, 2, 'v'],
    ]);
    expect(searchMidPath(sq, edges, 0, 2, 'h', 'v')).toEqual([sq[0], sq[3], sq[2]]);
  });
});

describe('contourProximityPenalty', () => {
  it('an 800 px hug costs less than one bend', () => {
    const penalty = contourProximityPenalty({ x: 0, y: 0 }, { x: 800, y: 0 }, [
      { x: 0, y: 1, width: 800, height: 50 },
    ]);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThan(ROUTE_BEND_COST);
  });
});
```

- [ ] **Step 2: Сценарные тесты через стратегию**

Создать `src/test/routingScenarios.ts`:

```ts
import type { Point } from '@/types';
import { PolylinePathStrategy } from '@/elements/paths/PolylinePathStrategy';
import type { PathObstacle } from '@/elements/paths/PathStrategy';
import { segmentIntersectsOpenInterior } from '@/elements/paths/routeOrthogonalAround';

export type Rect = { id: string; x: number; y: number; width: number; height: number };

const PAD = 4;
const pad = (n: Rect, role: 'source' | 'target' | 'other' = 'other'): PathObstacle => ({
  id: n.id,
  x: n.x - PAD,
  y: n.y - PAD,
  width: n.width + PAD * 2,
  height: n.height + PAD * 2,
  role,
});

export function crosses(path: Point[], r: Rect): boolean {
  for (let i = 1; i < path.length; i++) {
    if (segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, r)) return true;
  }
  return false;
}

export const scenarios = {
  rightToTopBelow: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 320, y: 260, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 370, y: 260 },
    fromDir: 'right',
    toDir: 'top',
    others: [] as Rect[],
    bends: 1,
  },
  rightToLeftOffset: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 360, y: 220, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 360, y: 250 },
    fromDir: 'right',
    toDir: 'left',
    others: [] as Rect[],
    bends: 2,
  },
  rightToLeftBlocked: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 500, y: 100, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 500, y: 130 },
    fromDir: 'right',
    toDir: 'left',
    others: [{ id: 'c', x: 300, y: 90, width: 100, height: 80 }],
    bends: 4,
  },
  staircase: {
    a: { id: 'a', x: 100, y: 100, width: 80, height: 60 },
    b: { id: 'b', x: 420, y: 260, width: 80, height: 60 },
    from: { x: 180, y: 130 },
    to: { x: 460, y: 260 },
    fromDir: 'right',
    toDir: 'top',
    others: [{ id: 'm', x: 260, y: 180, width: 80, height: 60 }],
    bends: 1,
  },
  hugLongNode: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 600, y: 200, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 650, y: 200 },
    fromDir: 'right',
    toDir: 'top',
    others: [{ id: 'n', x: 240, y: 140, width: 300, height: 30 }],
    bends: 1,
  },
  exactStub: {
    a: { id: 'a', x: 100, y: 150, width: 100, height: 60 },
    b: { id: 'b', x: 320, y: 110, width: 100, height: 60 },
    from: { x: 200, y: 180 },
    to: { x: 370, y: 110 },
    fromDir: 'right',
    toDir: 'top',
    others: [] as Rect[],
    bends: 3,
  },
} as const;

export type Scenario = (typeof scenarios)[keyof typeof scenarios];

export function routeScenario(sc: Scenario, endStubLength?: number): Point[] {
  const s = new PolylinePathStrategy();
  return s.calculatePath(sc.from, sc.to, sc.fromDir, sc.toDir, {
    obstacles: [pad(sc.a, 'source'), pad(sc.b, 'target'), ...sc.others.map((o) => pad(o))],
    ...(endStubLength !== undefined ? { endStubLength } : {}),
  });
}
```

До Task 4 поля `endStubLength` в `PathStrategyOptions` нет — в этой задаче объявить его сразу (`src/elements/paths/PathStrategy.ts`, см. Task 4 Step 3, только поле интерфейса), чтобы `routingScenarios.ts` компилировался; поведение поле получает в Task 4.

Создать `src/elements/paths/minBendRouting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countBends } from './routeCost';
import { crosses, routeScenario, scenarios } from '@/test/routingScenarios';

describe('min-bend polyline routing', () => {
  for (const [name, sc] of Object.entries(scenarios)) {
    it(`${name}: ${sc.bends} bend(s), no node crossed`, () => {
      const path = routeScenario(sc);
      expect(countBends(path), JSON.stringify(path)).toBe(sc.bends);
      expect(path[0]).toEqual(sc.from);
      expect(path[path.length - 1]).toEqual(sc.to);
      for (const r of [...sc.others]) {
        expect(crosses(path, r), `${name} crosses ${r.id}`).toBe(false);
      }
    });
  }
});
```

Примечание для исполнителя: `hugLongNode` зависит от Task 3; часть сценариев (`rightToTopBelow`, `rightToLeftOffset`, `exactStub`) может проходить уже на старом коде — это регрессионные гарды, отметить в отчёте.

- [ ] **Step 3: Убедиться, что новые тесты падают**

Run: `npx vitest run src/elements/paths/routeOrthogonalAround.test.ts src/elements/paths/minBendRouting.test.ts`
Expected: FAIL — `searchMidPath` не экспортирован; `contourProximityPenalty` ≈ 10 577 > 160; `hugLongNode` даёт > 1 излома.

- [ ] **Step 4: Реализация в `routeOrthogonalAround.ts`**

Импорт в шапку:

```ts
import { ROUTE_BEND_COST, orthogonalRouteCost } from './routeCost';
```

Константы (заменить `BEND_PENALTY`, `CONTOUR_PENALTY`):

```ts
const DEFAULT_MARGIN = 12;
const DEFAULT_EXIT = 20;
/** Prefer mid-gap over hugging obstacle borders among routes with equal bends. */
const CONTOUR_BAND = 18;
/** Tie-breaker only: an 800 px hug costs one bend. */
const CONTOUR_COST_PER_PX = 0.2;

type Axis = 'h' | 'v';

function axisOf(side: Side): Axis {
  return side === 'left' || side === 'right' ? 'h' : 'v';
}
```

`contourProximityPenalty` — последняя строка:

```ts
  return segLen * CONTOUR_COST_PER_PX * proximity;
```

(docstring: «Extra cost when a segment runs parallel to an obstacle edge inside CONTOUR_BAND. Scaled by segment length; kept below a bend for realistic lengths.»)

`type GraphEdge` → `export type GraphEdge = { to: number; dir: 'h' | 'v'; length: number };`

`searchMidPath` целиком:

```ts
export function searchMidPath(
  nodes: Point[],
  edges: Map<number, GraphEdge[]>,
  startIdx: number,
  goalIdx: number,
  startAxis: Axis,
  goalAxis: Axis
): Point[] | null {
  type QueueState = { node: number; dir: Axis; g: number; f: number; key: string };
  const makeStateKey = (node: number, dir: Axis): string => `${node}:${dir}`;
  const open: QueueState[] = [];
  const best = new Map<string, number>();
  const prev = new Map<string, string>();
  const startKey = makeStateKey(startIdx, startAxis);
  best.set(startKey, 0);
  open.push({
    node: startIdx,
    dir: startAxis,
    g: 0,
    f: manhattan(nodes[startIdx]!, nodes[goalIdx]!),
    key: startKey,
  });

  let goalKey: string | null = null;
  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    if (current.node === goalIdx) {
      goalKey = current.key;
      break;
    }

    for (const edge of edges.get(current.node) ?? []) {
      const nextDir = edge.dir;
      let stepCost = edge.length;
      if (current.dir !== nextDir) stepCost += ROUTE_BEND_COST;
      // Arriving across the entry axis means one more bend into the end stub.
      if (edge.to === goalIdx && nextDir !== goalAxis) stepCost += ROUTE_BEND_COST;
      const nextG = current.g + stepCost;
      const nextKey = makeStateKey(edge.to, nextDir);
      if (nextG >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, nextG);
      prev.set(nextKey, current.key);
      open.push({
        node: edge.to,
        dir: nextDir,
        g: nextG,
        f: nextG + manhattan(nodes[edge.to]!, nodes[goalIdx]!),
        key: nextKey,
      });
    }
  }

  if (!goalKey) return null;

  const path: Point[] = [];
  let key: string | undefined = goalKey;
  while (key) {
    const nodeIdx = Number(key.split(':')[0]);
    path.unshift(nodes[nodeIdx]!);
    key = prev.get(key);
  }
  return path;
}
```

Удалить `type DirState`. В `fallbackOuterRoute` сменить сигнатуру и критерий:

```ts
function fallbackOuterRoute(
  from: Point,
  to: Point,
  startExit: Point,
  endEntry: Point,
  obstacles: RouteRect[]
): Point[] {
  if (obstacles.length === 0) {
    return orthogonalElbow(startExit, endEntry);
  }

  const u = unionBBox(obstacles);
  const pad = 1;
  const top = u.y - pad;
  const bottom = u.y + u.height + pad;
  const left = u.x - pad;
  const right = u.x + u.width + pad;

  const candidates: Point[][] = [
    [startExit, { x: startExit.x, y: top }, { x: endEntry.x, y: top }, endEntry],
    [startExit, { x: startExit.x, y: bottom }, { x: endEntry.x, y: bottom }, endEntry],
    [startExit, { x: left, y: startExit.y }, { x: left, y: endEntry.y }, endEntry],
    [startExit, { x: right, y: startExit.y }, { x: right, y: endEntry.y }, endEntry],
    // Simple elbows (prefer when outer rails are blocked)
    [startExit, { x: startExit.x, y: endEntry.y }, endEntry],
    [startExit, { x: endEntry.x, y: startExit.y }, endEntry],
  ];

  let best: Point[] | null = null;
  let bestCost = Infinity;
  for (const candidate of candidates) {
    const simplified = simplifyPath(candidate);
    if (!pathIsValid(simplified, obstacles)) continue;
    const cost = orthogonalRouteCost([from, ...simplified, to]);
    if (cost < bestCost) {
      bestCost = cost;
      best = simplified;
    }
  }
  // Last resort: orthogonal elbow even if it clips — never a diagonal.
  return best ?? orthogonalElbow(startExit, endEntry);
}
```

`routeMidPath`:

```ts
function routeMidPath(
  from: Point,
  to: Point,
  startExit: Point,
  endEntry: Point,
  startAxis: Axis,
  goalAxis: Axis,
  obstacles: RouteRect[],
  parent?: RouteRect,
  target?: RouteRect,
  margin?: number
): Point[] {
  if (Math.abs(startExit.x - endEntry.x) < 0.001 || Math.abs(startExit.y - endEntry.y) < 0.001) {
    const direct = [startExit, endEntry];
    if (pathIsValid(direct, obstacles)) return direct;
  }

  const graph = buildCornerGraph(startExit, endEntry, obstacles, parent, target, margin);
  if (graph) {
    const mid = searchMidPath(
      graph.nodes,
      graph.edges,
      graph.startIdx,
      graph.goalIdx,
      startAxis,
      goalAxis
    );
    if (mid && pathIsValid(mid, obstacles)) return mid;
  }

  return fallbackOuterRoute(from, to, startExit, endEntry, obstacles);
}
```

Вызов в `routeOrthogonalAround`:

```ts
  const mid = routeMidPath(
    input.from,
    input.to,
    startExit,
    endEntry,
    axisOf(input.fromDir),
    axisOf(input.toDir),
    obstacles,
    latticeA,
    latticeB,
    margin
  ).slice(1, -1);
```

- [ ] **Step 5: Новые тесты проходят**

Run: `npx vitest run src/elements/paths/routeOrthogonalAround.test.ts src/elements/paths/minBendRouting.test.ts`
Expected: PASS (все 6 сценариев, включая `exactStub` — 3 излома; длина хвоста проверяется в Task 4). Если какой-то сценарий даёт больше изломов — это баг реализации, не подгонять ожидание.

- [ ] **Step 6: Регрессия всех path-тестов**

Run: `npx vitest run src/elements/paths`
Expected: PASS. Если что-то падает — разобрать по Global Constraints (переутверждение только по причинам (а)/(б), с записью `Reapproved:`); пересечение узла — чинить.

- [ ] **Step 7: Commit**

```bash
git add src/elements/paths/routeOrthogonalAround.ts src/elements/paths/routeOrthogonalAround.test.ts src/elements/paths/minBendRouting.test.ts src/elements/paths/PathStrategy.ts src/test/routingScenarios.ts
git commit -m "feat(paths): bend-first cost in routeOrthogonalAround search"
```

(при переутверждениях — добавить строки `Reapproved: …` в тело коммита)

---

### Task 4: Хвостик у конца в `routeOrthogonalAround`

**Files:**
- Modify: `src/elements/paths/PathStrategy.ts` (`PathStrategyOptions`)
- Modify: `src/elements/paths/routeOrthogonalAround.ts` — `RouteOrthogonalAroundInput` (стр. 13–30), `computeEndEntry` (стр. 422–460), `clampFacingExitEntry` (стр. 467–503), тело `routeOrthogonalAround` (стр. 857–1045), `isOnApproachOutside`-вызов (стр. 1034)
- Modify: `src/elements/paths/PolylinePathStrategy.ts` — `calculatePath` (передача в `routeOrthogonalAround`, стр. 611–631)
- Test: `src/elements/paths/endStub.test.ts` (новый), `src/elements/paths/closeNodesTail.test.ts`, `src/elements/paths/contourCrawl.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_END_STUB`, `END_STUB_FACING_START_MIN` (Task 1); `scenarios`, `routeScenario` из `@/test/routingScenarios` (Task 3); поле `PathStrategyOptions.endStubLength` уже объявлено в Task 3.
- Produces: `PathStrategyOptions.endStubLength?: number`; `RouteOrthogonalAroundInput.endStubLength?: number`; `export function endStubMeet(fromC: number, toC: number, endStubLength: number): number`; `clampFacingExitEntry(from, to, fromDir, toDir, startExit, endEntry, endStubLength = DEFAULT_END_STUB)`.

- [ ] **Step 1: Падающие тесты**

`src/elements/paths/endStub.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_END_STUB } from '@/constants';
import { clampFacingExitEntry, endStubMeet } from './routeOrthogonalAround';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { routeScenario, scenarios } from '@/test/routingScenarios';

type P = { x: number; y: number };

function lastSegment(path: P[]): { len: number; axis: 'h' | 'v' | 'diag' } {
  const a = path[path.length - 2]!;
  const b = path[path.length - 1]!;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return { len: dx + dy, axis: dy < 0.001 ? 'h' : dx < 0.001 ? 'v' : 'diag' };
}

const axisOfSide = (side: string): 'h' | 'v' =>
  side === 'left' || side === 'right' ? 'h' : 'v';

describe('end stub (routeOrthogonalAround)', () => {
  for (const [name, sc] of Object.entries(scenarios)) {
    it(`${name}: last segment is normal to the entry side and ≥ endStubLength`, () => {
      const seg = lastSegment(routeScenario(sc));
      expect(seg.axis).toBe(axisOfSide(sc.toDir));
      expect(seg.len).toBeGreaterThanOrEqual(DEFAULT_END_STUB - 0.001);
    });
  }

  it('exactStub: turn before the target leaves exactly endStubLength', () => {
    expect(lastSegment(routeScenario(scenarios.exactStub)).len).toBeCloseTo(16, 3);
    expect(lastSegment(routeScenario(scenarios.exactStub, 18)).len).toBeCloseTo(18, 3);
  });
});

describe('endStubMeet / clampFacingExitEntry', () => {
  it('keeps the mid-gap when it leaves enough stub', () => {
    expect(endStubMeet(0, 40, 16)).toBe(20);
  });

  it('moves the meet toward the source to keep the end stub', () => {
    expect(endStubMeet(160, 185, 16)).toBe(169);
    expect(endStubMeet(185, 160, 16)).toBe(176);
  });

  it('falls back to the middle when the gap is too small', () => {
    expect(endStubMeet(160, 180, 16)).toBe(170);
  });

  it('clampFacingExitEntry uses endStubMeet', () => {
    const clamped = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 169 }
    );
    expect(clamped.startExit.y).toBe(169);
    expect(clamped.endEntry.y).toBe(169);
    const custom = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 175 },
      10
    );
    // gap 25: mid-gap already leaves 12.5 ≥ 10
    expect(custom.endEntry.y).toBe(172.5);
  });

  it('close facing nodes keep the end stub when the gap allows', () => {
    const s = new PolylinePathStrategy();
    const start = { x: 100, y: 100, width: 120, height: 60 };
    for (const gap of [24, 30, 40]) {
      const process = { x: 110, y: 160 + gap, width: 140, height: 64 };
      const pad = (r: typeof start, role: 'source' | 'target') => ({
        x: r.x - 4,
        y: r.y - 4,
        width: r.width + 8,
        height: r.height + 8,
        role,
      });
      const path = s.calculatePath({ x: 160, y: 160 }, { x: 180, y: process.y }, 'bottom', 'top', {
        obstacles: [pad(start, 'source'), pad(process, 'target')],
      });
      const seg = lastSegment(path);
      expect(seg.axis, `gap ${gap}`).toBe('v');
      expect(seg.len, `gap ${gap}: ${JSON.stringify(path)}`).toBeGreaterThanOrEqual(16 - 0.001);
    }
  });
});
```

`closeNodesTail.test.ts`, тест `clampFacingExitEntry meets stubs in the mid-gap when they would cross`: ожидания `172.5` → `169` (переименовать тест в `clampFacingExitEntry keeps the end stub when stubs would cross`). Причина (б).

`contourCrawl.test.ts`: в `assertNotOnEntryStub` дефолт `exitDistance = 20` → `exitDistance = DEFAULT_END_STUB` (импорт из `@/constants`). Причина (б).

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/elements/paths/endStub.test.ts src/elements/paths/closeNodesTail.test.ts`
Expected: FAIL — `endStubMeet` не экспортирован; `exactStub` даёт 20; `clamp` даёт 172.5.

- [ ] **Step 3: Реализация**

`PathStrategy.ts` (в Task 3 поле объявляется именно так; если оно уже есть — шаг пропустить):

```ts
export interface PathStrategyOptions {
  controlPoints?: Point[];
  editablePolyline?: boolean;
  selfLoop?: boolean;
  obstacles?: PathObstacle[];
  /** Perpendicular stub before the end point when the route turns there. */
  endStubLength?: number;
}
```

`routeOrthogonalAround.ts`:

```ts
import { DEFAULT_END_STUB, END_STUB_FACING_START_MIN } from '@/constants';
```

В `RouteOrthogonalAroundInput` после `exitDistance?: number;`:

```ts
  /** Stub before `to` when the route turns there; default DEFAULT_END_STUB. */
  endStubLength?: number;
```

Новая функция (рядом с `clampFacingExitEntry`):

```ts
/**
 * Coordinate of the turn between facing endpoints on the approach axis.
 * Mid-gap when it leaves `endStubLength`; otherwise `endStubLength` before `to`
 * while the source side keeps END_STUB_FACING_START_MIN; else mid-gap (no loop back).
 */
export function endStubMeet(fromC: number, toC: number, endStubLength: number): number {
  const gap = Math.abs(toC - fromC);
  const mid = (fromC + toC) / 2;
  if (gap / 2 >= endStubLength) return mid;
  if (gap >= endStubLength + END_STUB_FACING_START_MIN) {
    return toC - Math.sign(toC - fromC) * endStubLength;
  }
  return mid;
}
```

`clampFacingExitEntry` — добавить параметр `endStubLength: number = DEFAULT_END_STUB` и заменить четыре вычисления середины:

```ts
  if (fromDir === 'bottom' && toDir === 'top' && to.y > from.y && startExit.y > endEntry.y) {
    const y = endStubMeet(from.y, to.y, endStubLength);
    return { startExit: { x: startExit.x, y }, endEntry: { x: endEntry.x, y } };
  }
  if (fromDir === 'top' && toDir === 'bottom' && to.y < from.y && startExit.y < endEntry.y) {
    const y = endStubMeet(from.y, to.y, endStubLength);
    return { startExit: { x: startExit.x, y }, endEntry: { x: endEntry.x, y } };
  }
  if (fromDir === 'right' && toDir === 'left' && to.x > from.x && startExit.x > endEntry.x) {
    const x = endStubMeet(from.x, to.x, endStubLength);
    return { startExit: { x, y: startExit.y }, endEntry: { x, y: endEntry.y } };
  }
  if (fromDir === 'left' && toDir === 'right' && to.x < from.x && startExit.x < endEntry.x) {
    const x = endStubMeet(from.x, to.x, endStubLength);
    return { startExit: { x, y: startExit.y }, endEntry: { x, y: endEntry.y } };
  }
```

`computeEndEntry`: переименовать параметр `exitDistance` → `endStubLength` (в теле `moveByDir(to, toDir, endStubLength)`).

В `routeOrthogonalAround` после `const exitDistance = …`:

```ts
  const endStubLength = input.endStubLength ?? DEFAULT_END_STUB;
```

— вызов `computeEndEntry(input.to, input.toDir, endStubLength, peeledTargetNeighbor?.a, peeledTargetNeighbor?.b)`;
— вызов `clampFacingExitEntry(input.from, input.to, input.fromDir, input.toDir, rawStartExit, rawEndEntry, endStubLength)`;
— `isOnApproachOutside(lastMid, input.to, input.toDir, endStubLength)`.

`PolylinePathStrategy.ts`: импорт `DEFAULT_END_STUB` из `@/constants`; в начале `calculatePath` после `const controlPoints = …`:

```ts
    const endStubLength = _options?.endStubLength ?? DEFAULT_END_STUB;
```

и в вызов `routeOrthogonalAround({...})` добавить `endStubLength,`.

- [ ] **Step 4: Тесты проходят**

Run: `npx vitest run src/elements/paths/endStub.test.ts src/elements/paths/closeNodesTail.test.ts src/elements/paths/contourCrawl.test.ts`
Expected: PASS.

- [ ] **Step 5: Регрессия**

Run: `npx vitest run src/elements/paths`
Expected: PASS (с переутверждениями по правилам).

- [ ] **Step 6: Commit**

```bash
git add src/elements/paths/PathStrategy.ts src/elements/paths/routeOrthogonalAround.ts src/elements/paths/PolylinePathStrategy.ts src/elements/paths/endStub.test.ts src/elements/paths/closeNodesTail.test.ts src/elements/paths/contourCrawl.test.ts
git commit -m "feat(paths): marker-sized end stub in routeOrthogonalAround

Reapproved: closeNodesTail.test.ts::clampFacingExitEntry… — end stub 16 instead of mid
Reapproved: contourCrawl.test.ts::assertNotOnEntryStub — stub line at DEFAULT_END_STUB"
```

---

### Task 5: `buildRoutedPolyline` и `calculateDirectedPath`

**Files:**
- Modify: `src/elements/paths/PolylinePathStrategy.ts` — константы (стр. 106–120), `moveOutsideObstacles` (стр. 194–214), `buildRoutedPolyline` (стр. 280–448), вызов (стр. 650), `calculateDirectedPath` (стр. 670–748) и его вызов (стр. 658)
- Test: `src/elements/paths/endStub.test.ts` (дописать)

**Interfaces:**
- Consumes: `ROUTE_BEND_COST` (Task 1); `endStubMeet` (Task 4); `endStubLength` в `calculatePath` (Task 4).
- Produces: поведение — у конца хвост `endStubLength` в обоих запасных роутерах.

- [ ] **Step 1: Падающие тесты**

Дописать в конец `src/elements/paths/endStub.test.ts` (`PolylinePathStrategy`, `lastSegment`, `P`, `scenarios` уже импортированы/объявлены в Task 4):

```ts
describe('end stub (buildRoutedPolyline, no roles)', () => {
  it('exactStub geometry without roles and without fromDir', () => {
    const sc = scenarios.exactStub;
    const raw = (r: { x: number; y: number; width: number; height: number }) => ({
      x: r.x - 4,
      y: r.y - 4,
      width: r.width + 8,
      height: r.height + 8,
    });
    const path = new PolylinePathStrategy().calculatePath(sc.from, sc.to, undefined, 'top', {
      obstacles: [raw(sc.a), raw(sc.b)],
    });
    const seg = lastSegment(path);
    expect(seg.axis).toBe('v');
    expect(seg.len, JSON.stringify(path)).toBeCloseTo(16, 3);
  });
});

describe('end stub (calculateDirectedPath, no obstacles)', () => {
  const s = new PolylinePathStrategy();
  const route = (from: P, to: P, fromDir: string, toDir: string) =>
    s.calculatePath(from, to, fromDir, toDir);

  // Without obstacles the Task 6 post-pass may turn these into an L (longer stub) —
  // assert the lower bound and the approach side, not an exact length.
  it('vertical → horizontal: stub before a near target', () => {
    const path = route({ x: 0, y: 0 }, { x: 30, y: 50 }, 'bottom', 'left');
    const seg = lastSegment(path);
    expect(seg.axis).toBe('h');
    expect(seg.len).toBeGreaterThanOrEqual(16);
    expect(path[path.length - 2]!.x).toBeLessThan(30);
  });

  it('horizontal → vertical: jog keeps the stub', () => {
    const path = route({ x: 0, y: 0 }, { x: 100, y: 20 }, 'right', 'top');
    const seg = lastSegment(path);
    expect(seg.axis).toBe('v');
    expect(seg.len).toBeGreaterThanOrEqual(16);
    expect(path[path.length - 2]!.y).toBeLessThan(20);
  });

  it('facing vertical: meet keeps the stub, tight gap uses the middle', () => {
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 100, y: 30 }, 'bottom', 'top'))).toEqual({
      len: 16,
      axis: 'v',
    });
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 100, y: 20 }, 'bottom', 'top'))).toEqual({
      len: 10,
      axis: 'v',
    });
  });

  it('bottom → bottom approaches from below, not through the target', () => {
    const path = route({ x: 0, y: 0 }, { x: 100, y: 100 }, 'bottom', 'bottom');
    const pre = path[path.length - 2]!;
    expect(pre.y).toBeGreaterThan(100);
    expect(lastSegment(path)).toEqual({ len: 16, axis: 'v' });
  });

  it('facing horizontal mirrors the vertical rule', () => {
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 30, y: 100 }, 'right', 'left'))).toEqual({
      len: 16,
      axis: 'h',
    });
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/elements/paths/endStub.test.ts`
Expected: FAIL — `buildRoutedPolyline` даёт хвост 32+; `horizontal → vertical` — 10; facing vertical — 10 вместо 16; `bottom → bottom` входит сверху (`pre.y` = 50). `vertical → horizontal` может пройти и на старом коде (хвост 20) — регрессионный гард.

- [ ] **Step 3: Реализация `buildRoutedPolyline`**

Импорты: `ROUTE_BEND_COST` из `./routeCost`; `endStubMeet` из `./routeOrthogonalAround` (дополнить существующий импорт).

Константы: удалить `TURN_PENALTY`, `FIRST_VERTICAL_PENALTY`; добавить `const ROUTE_TARGET_MARGIN = 4;`.

Заменить `moveOutsideObstacles` и добавить хелперы:

```ts
function expandForRouting(
  obstacles: PathObstacle[],
  target: PathObstacle | undefined
): PathObstacle[] {
  return obstacles.map((o) => {
    const m = o === target ? ROUTE_TARGET_MARGIN : OBSTACLE_MARGIN;
    return { ...o, x: o.x - m, y: o.y - m, width: o.width + m * 2, height: o.height + m * 2 };
  });
}

/** Push `point` along `dir` until it clears every pre-expanded obstacle. */
function moveOutsideObstacles(
  point: Point,
  dir: string | undefined,
  expanded: PathObstacle[],
  minDistance: number
): Point {
  if (!dir || expanded.length === 0) {
    return moveByDir(point, dir, minDistance);
  }
  let dist = minDistance;
  let candidate = moveByDir(point, dir, dist);
  const step = 16;
  const maxDist = 4000;
  while (dist < maxDist && expanded.some((obstacle) => pointInsideObstacle(candidate, obstacle))) {
    dist += step;
    candidate = moveByDir(point, dir, dist);
  }
  return candidate;
}

function routeAxis(dir: string | undefined): 'h' | 'v' | null {
  if (isHorizontal(dir)) return 'h';
  if (isVertical(dir)) return 'v';
  return null;
}
```

Если `expandObstacles` больше нигде не используется — удалить.

`buildRoutedPolyline(from, to, fromDir, toDir, obstacles, endStubLength: number)` — начало:

```ts
  const effectiveFromDir = fromDir ?? inferExitDir(from, to);
  const roles = resolveRoutingRoles(from, to, obstacles);
  const routedTarget =
    roles.target ??
    smallestContaining(to, obstacles, new Set(roles.source ? [roles.source] : []));
  const effectiveToDir = resolveApproachDir(from, to, toDir, routedTarget);

  const expanded = expandForRouting(obstacles, routedTarget);
  const startExit = moveOutsideObstacles(from, effectiveFromDir, expanded, ROUTE_EXIT_DISTANCE);
  const endEntry = moveOutsideObstacles(to, effectiveToDir, expanded, endStubLength);
```

(удалить прежние `const expanded = expandObstacles(obstacles, OBSTACLE_MARGIN);` и старые вычисления `startExit`/`endEntry`.)

A* — тип и старт:

```ts
  type DirState = 'h' | 'v' | 's';
  // ...
  const startAxis = routeAxis(effectiveFromDir);
  const goalAxis = routeAxis(effectiveToDir);
  const startDir: DirState = startAxis ?? 's';
  const startKey = makeStateKey(startIdx, startDir);
  best.set(startKey, 0);
  open.push({
    node: startIdx,
    dir: startDir,
    g: 0,
    f: manhattan(nodes[startIdx]!, nodes[goalIdx]!),
    key: startKey,
  });
```

Стоимость шага:

```ts
      const nextDir = edge.dir;
      let stepCost = edge.length;
      if (current.dir !== 's' && current.dir !== nextDir) {
        stepCost += ROUTE_BEND_COST;
      }
      if (edge.to === goalIdx && goalAxis && nextDir !== goalAxis) {
        stepCost += ROUTE_BEND_COST;
      }
```

Вызов в `calculatePath`: `buildRoutedPolyline(from, to, fromDir, toDir, obstacles, endStubLength)`.

- [ ] **Step 4: Реализация `calculateDirectedPath`**

Сигнатура `calculateDirectedPath(from, to, fromDir, toDir, endStubLength: number)`, вызов `this.calculateDirectedPath(from, to, fromDir, toDir, endStubLength)`. Тело ветвей:

```ts
    if (fromVertical && toVertical) {
      const midY = (from.y + to.y) / 2;
      const exitY =
        fromDir === 'top'
          ? Math.min(from.y - MIN_SEGMENT_LENGTH, midY)
          : Math.max(from.y + MIN_SEGMENT_LENGTH, midY);
      const entryY =
        toDir === 'top' ? Math.min(to.y - endStubLength, midY) : Math.max(to.y + endStubLength, midY);
      const facing =
        (fromDir === 'bottom' && toDir === 'top' && to.y > from.y) ||
        (fromDir === 'top' && toDir === 'bottom' && to.y < from.y);
      if (facing) {
        const y = endStubMeet(from.y, to.y, endStubLength);
        points.push({ x: from.x, y }, { x: to.x, y });
      } else if (fromDir === toDir) {
        const y = fromDir === 'top' ? Math.min(exitY, entryY) : Math.max(exitY, entryY);
        points.push({ x: from.x, y }, { x: to.x, y });
      } else {
        const midX = (from.x + to.x) / 2;
        points.push(
          { x: from.x, y: exitY },
          { x: midX, y: exitY },
          { x: midX, y: entryY },
          { x: to.x, y: entryY }
        );
      }
    } else if (fromHorizontal && toHorizontal) {
      const midX = (from.x + to.x) / 2;
      const exitX =
        fromDir === 'left'
          ? Math.min(from.x - MIN_SEGMENT_LENGTH, midX)
          : Math.max(from.x + MIN_SEGMENT_LENGTH, midX);
      const entryX =
        toDir === 'left'
          ? Math.min(to.x - endStubLength, midX)
          : Math.max(to.x + endStubLength, midX);
      const facing =
        (fromDir === 'right' && toDir === 'left' && to.x > from.x) ||
        (fromDir === 'left' && toDir === 'right' && to.x < from.x);
      if (facing) {
        const x = endStubMeet(from.x, to.x, endStubLength);
        points.push({ x, y: from.y }, { x, y: to.y });
      } else if (fromDir === toDir) {
        const x = fromDir === 'left' ? Math.min(exitX, entryX) : Math.max(exitX, entryX);
        points.push({ x, y: from.y }, { x, y: to.y });
      } else {
        const midY = (from.y + to.y) / 2;
        points.push(
          { x: exitX, y: from.y },
          { x: exitX, y: midY },
          { x: entryX, y: midY },
          { x: entryX, y: to.y }
        );
      }
    } else if (fromVertical && toHorizontal) {
      const exitY =
        fromDir === 'top' ? from.y - MIN_SEGMENT_LENGTH : from.y + MIN_SEGMENT_LENGTH;
      const jogX = (from.x + to.x) / 2;
      const approachX =
        toDir === 'left' ? Math.min(jogX, to.x - endStubLength) : Math.max(jogX, to.x + endStubLength);
      points.push({ x: from.x, y: exitY });
      points.push({ x: approachX, y: exitY });
      points.push({ x: approachX, y: to.y });
    } else if (fromHorizontal && toVertical) {
      const exitX =
        fromDir === 'left' ? from.x - MIN_SEGMENT_LENGTH : from.x + MIN_SEGMENT_LENGTH;
      const midY = (from.y + to.y) / 2;
      const jogY =
        toDir === 'top' ? Math.min(midY, to.y - endStubLength) : Math.max(midY, to.y + endStubLength);
      points.push({ x: exitX, y: from.y });
      points.push({ x: exitX, y: jogY });
      points.push({ x: to.x, y: jogY });
    } else {
```

(ветка `else` — без изменений.)

- [ ] **Step 5: Тесты проходят**

Run: `npx vitest run src/elements/paths/endStub.test.ts`
Expected: PASS.

- [ ] **Step 6: Регрессия**

Run: `npx vitest run src/elements/paths`
Expected: PASS (с переутверждениями по правилам, особенно `PolylinePathStrategy.test.ts`, `noDiagonalFallback.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/elements/paths/PolylinePathStrategy.ts src/elements/paths/endStub.test.ts
git commit -m "feat(paths): bend cost and end stub in fallback polyline routers"
```

---

### Task 6: Подключение `reduceOrthogonalBends` в `calculatePath`

**Files:**
- Modify: `src/elements/paths/PolylinePathStrategy.ts` — новый хелпер `reduceRouteBends` (рядом с `resolveRoutingRoles`), `finish` в `calculatePath` (стр. 474–490)
- Test: `src/elements/paths/reduceIntegration.test.ts` (новый)

**Interfaces:**
- Consumes: `reduceOrthogonalBends(path, obstacles)` (Task 2); `resolveRoutingRoles`, `smallestContaining`, `pointInObstacle` (уже в файле).
- Produces: все авто-пути из `finish` проходят срез.

- [ ] **Step 1: Падающие тесты**

`src/elements/paths/reduceIntegration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./reduceOrthogonalBends', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reduceOrthogonalBends')>();
  return { ...actual, reduceOrthogonalBends: vi.fn(actual.reduceOrthogonalBends) };
});

import { reduceOrthogonalBends } from './reduceOrthogonalBends';
import { PolylinePathStrategy } from './PolylinePathStrategy';

const spy = vi.mocked(reduceOrthogonalBends);
const s = new PolylinePathStrategy();
const pad = (
  r: { x: number; y: number; width: number; height: number },
  role: 'source' | 'target' | 'other' = 'other'
) => ({ x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8, role });

const a = { x: 100, y: 100, width: 100, height: 60 };
const b = { x: 360, y: 220, width: 100, height: 60 };

beforeEach(() => spy.mockClear());

describe('reduceOrthogonalBends integration', () => {
  it('runs on auto routes', () => {
    const path = s.calculatePath({ x: 200, y: 130 }, { x: 360, y: 250 }, 'right', 'left', {
      obstacles: [pad(a, 'source'), pad(b, 'target')],
    });
    expect(path.length).toBeGreaterThan(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skips editable polylines and self-loop templates', () => {
    s.calculatePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 'right', 'left', {
      editablePolyline: true,
      controlPoints: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    });
    s.calculatePath({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 'top', 'top', { selfLoop: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it('skips nested edges leaving a container', () => {
    const container = { x: 60, y: 60, width: 200, height: 200 };
    const target = { x: 500, y: 300, width: 100, height: 60 };
    const path = s.calculatePath({ x: 200, y: 130 }, { x: 500, y: 330 }, 'right', 'left', {
      obstacles: [pad(container), pad(a, 'source'), pad(target, 'target')],
    });
    expect(path.length).toBeGreaterThan(3);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores a container holding both ends', () => {
    const container = { x: 0, y: 0, width: 800, height: 600 };
    s.calculatePath({ x: 200, y: 130 }, { x: 360, y: 250 }, 'right', 'left', {
      obstacles: [pad(container), pad(a, 'source'), pad(b, 'target')],
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const checks = spy.mock.calls[0]![1];
    expect(checks.some((r) => r.width >= 800)).toBe(false);
    expect(checks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/elements/paths/reduceIntegration.test.ts`
Expected: FAIL — `spy` не вызывается.

- [ ] **Step 3: Реализация**

Импорт в `PolylinePathStrategy.ts`:

```ts
import { reduceOrthogonalBends } from './reduceOrthogonalBends';
import { routeOrthogonalAround, endStubMeet, type RouteRect, type Side } from './routeOrthogonalAround';
```

Хелпер после `resolveRoutingRoles`:

```ts
const REDUCE_MARGIN = 4;

function reduceRouteBends(
  from: Point,
  to: Point,
  path: Point[],
  obstacles: PathObstacle[]
): Point[] {
  if (path.length <= 3) return path;
  const roles = resolveRoutingRoles(from, to, obstacles);
  const source = roles.source;
  const target =
    roles.target ?? smallestContaining(to, obstacles, new Set(source ? [source] : []));
  const checks: RouteRect[] = [];
  for (const o of obstacles) {
    if (o !== source && o !== target) {
      const hasFrom = pointInObstacle(from, o);
      const hasTo = pointInObstacle(to, o);
      if (hasFrom && hasTo) continue;
      // Leaving a container through its wall: the router's exit must stay intact.
      if (hasFrom || hasTo) return path;
    }
    checks.push({
      x: o.x - REDUCE_MARGIN,
      y: o.y - REDUCE_MARGIN,
      width: o.width + REDUCE_MARGIN * 2,
      height: o.height + REDUCE_MARGIN * 2,
    });
  }
  return reduceOrthogonalBends(path, checks);
}
```

`finish` в `calculatePath`:

```ts
    const finish = (via: string, rawPath: Point[]): Point[] => {
      const path = reduceRouteBends(from, to, rawPath, obstacles);
      const roles = resolveRoutingRoles(from, to, obstacles);
      routeDebug('polyline.via', {
        // ... поля без изменений, path — уже срезанный
      });
      return path;
    };
```

- [ ] **Step 4: Тесты проходят**

Run: `npx vitest run src/elements/paths/reduceIntegration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Регрессия**

Run: `npx vitest run src/elements/paths`
Expected: PASS (с переутверждениями по правилам).

- [ ] **Step 6: Commit**

```bash
git add src/elements/paths/PolylinePathStrategy.ts src/elements/paths/reduceIntegration.test.ts
git commit -m "feat(paths): run reduceOrthogonalBends on auto polyline routes"
```

---

### Task 7: Длина хвостика из маркера в `Edge`

**Files:**
- Modify: `src/elements/edge/EdgeMarkerRenderer.ts` (после `getCanvasMarkerLength`, ~стр. 34)
- Modify: `src/elements/Edge.ts` — импорт (стр. 33), сеттеры `arrowType` (стр. 259–264), `startMarker` (стр. 273–276), `endMarker` (стр. 285–288), `recalculatePath` (стр. 581–593)
- Test: `src/elements/Edge.test.ts` (дописать)

**Interfaces:**
- Consumes: `END_STUB_EXTRA`, `END_STUB_MIN` (Task 1); `PathStrategyOptions.endStubLength` (Task 4).
- Produces: `getMarkerVisualLength(config: ArrowMarkerConfig): number`; `resolveEndStubLength(markers: { startMarker?: ArrowMarkerConfig; endMarker?: ArrowMarkerConfig; arrowType: ArrowType }): number`.

- [ ] **Step 1: Падающие тесты**

Дописать в `src/elements/Edge.test.ts` (импорты — в шапку):

```ts
import { PolylinePathStrategy } from './paths';
import { getMarkerVisualLength, resolveEndStubLength } from './edge/EdgeMarkerRenderer';

describe('Edge end stub length', () => {
  it('follows the visible end marker size', () => {
    expect(getMarkerVisualLength({ type: 'arrow' })).toBe(12);
    expect(getMarkerVisualLength({ type: 'open' })).toBe(12);
    expect(getMarkerVisualLength({ type: 'circle' })).toBe(12);
    expect(getMarkerVisualLength({ type: 'none' })).toBe(0);
    const r = (m: Parameters<typeof resolveEndStubLength>[0]) => resolveEndStubLength(m);
    expect(r({ endMarker: { type: 'arrow' }, arrowType: 'single' })).toBe(16);
    expect(r({ endMarker: { type: 'open' }, arrowType: 'single' })).toBe(16);
    expect(r({ endMarker: { type: 'diamond' }, arrowType: 'single' })).toBe(18);
    expect(r({ endMarker: { type: 'circle' }, arrowType: 'single' })).toBe(16);
    expect(r({ endMarker: { type: 'arrow', size: 20 }, arrowType: 'single' })).toBe(24);
    expect(r({ endMarker: { type: 'none' }, arrowType: 'single' })).toBe(12);
    expect(r({ startMarker: { type: 'diamond' }, arrowType: 'single' })).toBe(12);
    expect(r({ arrowType: 'single' })).toBe(14);
    expect(r({ arrowType: 'none' })).toBe(12);
  });

  it('passes endStubLength to the strategy and recalculates on marker changes', () => {
    const spy = vi.spyOn(PolylinePathStrategy.prototype, 'calculatePath');
    const edge = new Edge({
      from: { nodeId: 'a' },
      to: { nodeId: 'b' },
      type: 'polyline',
      endMarker: { type: 'diamond' },
    });
    edge.updateEndpoints({ x: 0, y: 0 }, { x: 100, y: 50 }, 'right', 'left');
    expect(spy.mock.calls.at(-1)?.[4]?.endStubLength).toBe(18);

    spy.mockClear();
    edge.endMarker = { type: 'arrow' };
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.at(-1)?.[4]?.endStubLength).toBe(16);

    spy.mockClear();
    edge.endMarker = undefined;
    edge.startMarker = undefined;
    edge.arrowType = 'none';
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.at(-1)?.[4]?.endStubLength).toBe(12);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run src/elements/Edge.test.ts`
Expected: FAIL — `getMarkerVisualLength` / `resolveEndStubLength` не экспортированы.

- [ ] **Step 3: Реализация**

`EdgeMarkerRenderer.ts` — импорт: `import { ARROW_ANGLE, ARROW_SIZE, END_STUB_EXTRA, END_STUB_MIN, MARKER_SIZES } from '@/constants';`, тип `ArrowType` уже импортирован. После `getCanvasMarkerLength`:

```ts
/** Drawn length of the marker along the path (unlike getCanvasMarkerLength, `open` counts). */
export function getMarkerVisualLength(config: ArrowMarkerConfig): number {
  if (config.type === 'none') return 0;
  const size = config.size ?? MARKER_SIZES[config.type] ?? ARROW_SIZE;
  return config.type === 'circle' || config.type === 'square' ? size * 2 : size;
}

/** Mirrors renderEdgeMarkers: configured markers win over the legacy arrowType head. */
export function resolveEndStubLength(markers: {
  startMarker?: ArrowMarkerConfig;
  endMarker?: ArrowMarkerConfig;
  arrowType: ArrowType;
}): number {
  let markerLength: number;
  if (markers.startMarker !== undefined || markers.endMarker !== undefined) {
    markerLength = markers.endMarker ? getMarkerVisualLength(markers.endMarker) : 0;
  } else {
    markerLength = markers.arrowType === 'none' ? 0 : ARROW_SIZE;
  }
  return Math.max(END_STUB_MIN, markerLength + END_STUB_EXTRA);
}
```

`Edge.ts`: импорт `import { getCanvasMarkerLength, renderEdgeMarkers, resolveEndStubLength } from './edge/EdgeMarkerRenderer';`.

`recalculatePath` — в объект опций добавить:

```ts
        endStubLength: resolveEndStubLength({
          startMarker: this._startMarker,
          endMarker: this._endMarker,
          arrowType: this._arrowType,
        }),
```

Сеттеры:

```ts
  set arrowType(value: ArrowType) {
    if (this._arrowType !== value) {
      this._arrowType = value;
      this.recalculatePath();
      this.markDirty();
    }
  }

  set startMarker(value: ArrowMarkerConfig | undefined) {
    this._startMarker = value;
    this.recalculatePath();
    this.markDirty();
  }

  set endMarker(value: ArrowMarkerConfig | undefined) {
    this._endMarker = value;
    this.recalculatePath();
    this.markDirty();
  }
```

- [ ] **Step 4: Тесты проходят**

Run: `npx vitest run src/elements/Edge.test.ts`
Expected: PASS.

- [ ] **Step 5: Регрессия всего пакета**

Run: `npx vitest run`
Expected: PASS, кроме тестов, падавших в базовой линии `/tmp/min-bend-baseline-tests.txt` (Task 0 Step 3). Любое новое падение (вне `src/elements/paths`, например в `src/core/*` из-за другой геометрии авто-путей) — разобрать по Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add src/elements/edge/EdgeMarkerRenderer.ts src/elements/Edge.ts src/elements/Edge.test.ts
git commit -m "feat(edge): end stub length from the end marker"
```

---

### Task 8: Документация, проверки, визуальная сверка, сборка

**Files:**
- Modify: `docs/elements.md:182`, `docs/utils.md:112`, `CHANGELOG.md`, `CHANGELOG.ru.md`

- [ ] **Step 1: Документация**

`docs/elements.md`, строка 182 — заменить на:

```markdown
- для `polyline` при известных сторонах (`fromDir` / `toDir`) и препятствиях родителя/цели путь строится ортогонально (`routeOrthogonalAround`): выход перпендикулярно стороне, минимум изломов, затем длина (излом = 160 px), без пересечения узлов; у конца — перпендикулярный хвостик длиной «видимый размер маркера конца + 4 px» (не меньше 12 px); без сторон остаётся прежний undirected-роутинг
```

`docs/utils.md`, строка 112 — заменить на:

```markdown
Автоматически пересчитывает путь рёбер (тип: `straight | polyline | bezier`). Для `polyline` со сторонами и препятствиями используется ортогональный обход (`routeOrthogonalAround`) с приоритетом минимума изломов и хвостиком у конца по размеру маркера; см. [Элементы](./elements.md).
```

`CHANGELOG.md`, в `## [Unreleased]` после блока `### Added`:

```markdown
### Changed
- Auto `polyline` routing minimizes bends first, then length (one bend ≈ 160 px), counting turns at the exit/entry stubs; a post-pass removes leftover staircases without crossing nodes.
- The route ends with a perpendicular stub of the end marker's visible size + 4 px (min 12 px) when it turns before the target. Changing `endMarker` / `startMarker` / `arrowType` re-routes the edge.
```

`CHANGELOG.ru.md`, в `## [Unreleased]` после блока `### Добавлено`:

```markdown
### Изменено
- Авто-роутинг `polyline` сначала минимизирует число изломов, затем длину (излом ≈ 160 px), учитывая повороты у хвостов выхода/входа; финальный проход убирает оставшиеся «лестницы», не пересекая узлы.
- У конца маршрута — перпендикулярный хвостик длиной «видимый размер маркера конца + 4 px» (не меньше 12 px), если перед целью есть поворот. Смена `endMarker` / `startMarker` / `arrowType` пересчитывает путь.
```

- [ ] **Step 2: Полная проверка**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: typecheck и lint без ошибок; тесты — как в Task 7 Step 5.

- [ ] **Step 3: Визуальная сверка**

Run (фон): `npm run dev -- --port 5173 --strictPort`. Снять `/tmp/min-bend-after-basic.png`, `/tmp/min-bend-after-composite.png` с тех же страниц, что в Task 0. Сравнить с «до»: меньше изломов, нет пересечений узлов, у стрелок короткий перпендикулярный хвостик. Сервер остановить. Скриншоты приложить в отчёт.

- [ ] **Step 4: Сборка и warchi**

Run: `npm run build`
Expected: `dist/` собран без ошибок.

Run (working_directory `/Users/nikolaygroznyh/Work/warchi-ws/warchi`): `npm install --no-audit --no-fund && npm run build`
Expected: warchi собирается с обновлённым papirus (`"@ngroznykh/papirus": "file:../papirus"`).

- [ ] **Step 5: Commit**

```bash
git add docs/elements.md docs/utils.md CHANGELOG.md CHANGELOG.ru.md
git commit -m "docs: min-bend polyline routing and end stub"
```
