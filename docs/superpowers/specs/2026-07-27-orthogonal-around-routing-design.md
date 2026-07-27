# Design: Orthogonally routed polylines around parent + target

**Date:** 2026-07-27  
**Status:** Approved for planning  
**Scope:** papirus (primary); warchi only via existing obstacle passing (`EdgeEndpointUpdater` / diagram obstacles)

## Problem

Polyline edges from a nested node (e.g. Component inside Digital Product) to an external target (e.g. Business Process) often:

- exit or arrive not perpendicular to the port side;
- crawl along the target edge;
- cut through the parent container or the target body;
- take a long detour above the target when a gap between parent and target exists.

Patches in `PolylinePathStrategy` (`ensureOrthogonalTerminals`, A* grid) do not give a clear, testable contract for this layout.

## Goals

1. First segment perpendicular to the **start** side (`fromDir`), outward.
2. Last segment perpendicular to the **end** side (`toDir`), with the pre-anchor point **outside** the target (never inside the target bbox).
3. Path does not intersect the interior of **parent** or **target** (expanded by margin).
4. Prefer the **shortest** orthogonal route (use the gap between parent and target when it exists).
5. Fixed endpoints: `from` and `to` are not moved.

## Non-goals

- Avoiding sibling / other diagram nodes (obstacles = parent + target only).
- Rewriting undirected polyline routing (no dirs, no obstacles).
- Editable-polyline / bezier / self-loop behavior changes.
- Full multi-obstacle visibility graph for arbitrary diagrams.

## Decisions (from brainstorming)

| Topic | Choice |
|-------|--------|
| Obstacles | Parent container + target node only |
| Around strategy | Shortest outside path (gap preferred when valid) |
| Terminals | Exit/entry stubs outside; no edge crawl on target |
| Clearance | ~8–12 px (`OBSTACLE_MARGIN ≈ 12`) |
| Algorithm family | Phased geometric router (not further A* patching) |
| Side matrix | 4×4 `fromDir × toDir` with exit → around → entry |

## API

New pure module:

```ts
// src/elements/paths/routeOrthogonalAround.ts

type Rect = { x: number; y: number; width: number; height: number; id?: string }

type RouteOrthogonalAroundInput = {
  from: Point
  to: Point
  fromDir: 'top' | 'right' | 'bottom' | 'left'
  toDir: 'top' | 'right' | 'bottom' | 'left'
  parent?: Rect   // containing / blocking start side
  target?: Rect   // node owning `to` (edge attachment on its border)
  margin?: number // default 12
  exitDistance?: number // default ≥ MIN_SEGMENT_LENGTH, used for stubs
}

function routeOrthogonalAround(input: RouteOrthogonalAroundInput): Point[]
```

Returns orthogonal polyline starting at `from` and ending at `to`.

## Pipeline

```
from
  → startExit   (phase 1: ⊥ fromDir, clear expanded parent)
  → …mid…       (phase 2: shortest ortho path startExit → endEntry)
  → endEntry    (phase 3: outside target along toDir)
  → to
```

### Phase 1 — exit

- `startExit = moveByDir(from, fromDir, exitDistance)`, then extend along `fromDir` until the point is outside expanded `parent` (if present).
- First segment must stay on the exit rail (no inward step-back / “tail”).

### Phase 2 — around

- Expand `parent` and `target` by `margin`.
- Build a small orthogonal graph:
  - nodes: `startExit`, `endEntry`, outer corners of expanded rects, and channel points for the gap between parent and target when they are separated;
  - edges: axis-aligned segments that do **not** intersect expanded interiors.
- Shortest path by Manhattan length; tie-break: fewer bends.
- Valid channels include the **gap** between parent and target (preferred when shorter). Do not route through target just because a vertical/horizontal rail aligns with an endpoint under a wide node.

### Phase 3 — entry

- `endEntry = moveByDir(to, outwardNormal(toDir), exitDistance)` so `endEntry` lies **outside** the target.
  - `bottom` → below the bottom edge; `top` → above; `left`/`right` analogously.
- Last segment is exactly `endEntry → to` (same X for vertical sides, same Y for horizontal sides).
- No intermediate point on the target edge line except `to` itself (no crawl).

### Simplify

Collapse colinear points; keep terminals and true corners.

## Integration

In `PolylinePathStrategy.calculatePath`:

1. If `fromDir` and `toDir` are set and at least one of `{parent, target}` can be resolved from `options.obstacles` (by id / containment of `from` / border hit of `to`), call `routeOrthogonalAround`.
2. Otherwise keep existing behavior (undirected manhattan, self-loop, generic A* for other obstacle sets).

`EdgeEndpointUpdater` / `DiagramRenderer` already attach obstacle `id`s and exclude only endpoint node ids from the obstacle list so the **parent** remains. Target rect should be passed explicitly when available (end node bbox), even though `to` lies on its border — the router treats target as a blocking body with an allowed exterior approach.

## Side combinations (reference)

Canonical layout for tests/docs: start inside parent below, target above.

| fromDir\toDir | left | right | top | bottom |
|---------------|------|-------|-----|--------|
| left | exit L, gap/side to left entry | exit L, gap to right entry | exit L, around to top | exit L, gap, vertical up |
| right | symmetric | symmetric | symmetric | symmetric |
| top | exit into gap, then to side | same | may need side+over top | often straight in gap |
| bottom | exit down, around side to entry | same | around side+over | around to bottom entry |

Exact polylines are defined by the shortest-channel rule, not by a hand-coded table — the table is the expected **shape class** for golden tests.

## Testing

Colocate unit tests: `routeOrthogonalAround.test.ts` + keep Edge-level cases.

Minimum:

1. First segment ⊥ `fromDir`; last segment ⊥ `toDir`.
2. `endEntry` outside target for all four `toDir`s.
3. No segment intersects expanded parent/target interiors (sample midpoints / segment–AABB).
4. `left → bottom` through gap (Component → BP case).
5. `left → right` uses gap under target, not a path through target body.
6. Spot-check remaining side pairs from the 4×4 matrix (golden paths or invariant checks).

## Risks / edge cases

- **No gap** (parent touches target): fall back to left/right/bottom outer channels.
- **Start not inside parent**: still exit ⊥; parent only blocks if the straight exit hits it.
- **Missing target rect**: infer a thin obstacle from `to` + `toDir` (half-plane / stub-only), or skip phase-2 target blocking and only enforce exterior `endEntry` (weaker); prefer passing real target bbox from the app.
- **Very tight gap** (&lt; margin): treat as no gap.

## Out of scope follow-ups

- Enable same router for N obstacles later (reuse corner graph).
- Prefer fewer bends over length via weight (optional).
