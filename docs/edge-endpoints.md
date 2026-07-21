# Edge-to-edge endpoints (junctions)

## Goal

Allow an edge endpoint to attach to **another edge** at a normalized position along its path
(relation→relation / ArchiMate junction), instead of requiring a fake mid-edge node.

## API

```ts
interface EdgeEndpoint {
  /** Node attachment (mutually exclusive with edgeId). */
  nodeId?: string
  portId?: string
  outlineParam?: number
  /** Host edge attachment (mutually exclusive with nodeId). */
  edgeId?: string
  /** Position along host edge path length in `[0, 1]`. Default `0.5`. */
  pathParam?: number
}
```

Helpers:

- `Edge.getPointAt(pathParam): { point, angle }` — point + tangent on the current path
- `isNodeEdgeEndpoint` / `isEdgeEdgeEndpoint` type guards

## Update order

`EdgeEndpointUpdater.updateAll`:

1. **Pass A** — edges whose both ends resolve to nodes (current behavior)
2. **Pass B** — edges with one or both ends on edges, using host `path` from pass A  
   Depth-limited (default 3) so edge→edge→edge chains settle; cycles keep the previous point

## wArchi mapping

- Diagram edge attrs may set `fromHostEdgeInstanceId` / `toHostEdgeInstanceId` + `pathParam`
- Legacy `isEdgeAnchor` instances are mapped at sync time to `{ edgeId, pathParam }` and are **not** added as Papirus nodes
- OEF import writes `pathParam` (default `0.5`) and can stop creating anchor nodes once consumers rely on host-edge attrs

## Interactive connect-to-edge

`ConnectionManager` accepts a drop onto an existing edge while drawing a connection
(Shift+drag with `attachToOutline`, or from a port). The new edge’s target (or source)
is `{ edgeId, pathParam }` at the closest point on the host path within hit tolerance.

## Non-goals (v1)

- Persisting exact Archi bend coordinates as `pathParam` (can improve import later)
