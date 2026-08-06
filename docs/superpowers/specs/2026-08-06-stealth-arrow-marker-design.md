# Design: Stealth (barbed) arrow marker

**Date:** 2026-08-06  
**Status:** Approved for planning  
**Scope:** papirus (marker geometry + canvas/SVG); warchi (style UI + type unions / builders)

## Problem

Edge markers today: `none`, `arrow`, `open`, `diamond`, `circle`, `square`.  
`arrow` is a filled triangle with a **flat** base. Users need a filled **barbed / stealth** head: concave heel and sharp outer barbs (classic diagramming / Graphviz “stealth”), independent of stroke dash style.

## Goals

1. New marker type `stealth` with the same config surface as `arrow` (`size`, `fillColor`, `strokeColor`, `fillOpacity`).
2. Same look on canvas and SVG export.
3. Edge line shortened by marker length (like `arrow`), so the shaft does not poke through the tip.
4. Available for start and end markers in wArchi style panel (notation + model), with i18n.

## Non-goals

- Open/outline stealth variant (separate type later if needed).
- Changing geometry of existing `arrow` / `open`.
- New stroke-dash presets (dash already exists on the edge).
- DB / API schema migration (marker type is a string in diagram style attrs).

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | New `ArrowMarkerType` value `stealth` |
| Fill model | Same as `arrow` (filled path + stroke) |
| Open variant | Out of scope |
| Type name | `stealth` |
| UI labels | ru «Острая», en «Stealth» |
| Defaults | `MARKER_SIZES.stealth` same order as `arrow` (12) |

## Geometry

Filled pentagon (tip + two outer barbs + two inner heel points):

```
        leftOuter
           \
            \      leftInner
             \    /
              tip ———— edge direction →
             /    \
            /      rightInner
           /
        rightOuter
```

- Tip at endpoint `to`.
- Outer barbs: similar half-angle / length family as `arrow` (`ARROW_ANGLE` / `size`), so visual weight matches.
- Inner heel: pulled forward along the edge toward `to` and inward toward the centerline (classic stealth notch). Exact ratios fixed in implementation (constants next to arrow helpers); unit tests lock the polygon.
- Marker length for shaft shortening: distance along the edge from `to` back to the heel contact (≈ outer length, same idea as `size * cos(ARROW_ANGLE)` for `arrow`).

Shared helpers in `src/utils/markers.ts`; canvas draw in `EdgeMarkerRenderer`; SVG path in `generateSvgMarker` / exporter.

## API

```ts
export type ArrowMarkerType =
  | 'none'
  | 'arrow'
  | 'open'
  | 'diamond'
  | 'circle'
  | 'square'
  | 'stealth'
```

`ArrowMarkerConfig` unchanged aside from the wider `type` union. Serialization already stores `startMarker` / `endMarker` as config objects — no format change.

## wArchi

- Extend `MarkerKind` / validators / `buildMarker` allow-lists to include `stealth`.
- `NodeStylePanel` (and any duplicate selects): `<option value="stealth">`.
- i18n: `nodeStyle.markerStealth` — ru «Острая», en «Stealth».
- Persist via existing `diagramStyle.startMarkerType` / `endMarkerType` strings.
- Docs: papirus `docs/elements.md` marker list; optional one-line in wArchi changelog when shipping.

## Tests

- papirus: `stealth` in marker type round-trip (Edge / Serializer); canvas path / length helper; SVG export contains filled closed path for stealth.
- warchi: builder accepts `stealth`; invalid types still fall back as today.

## Compatibility

- Existing diagrams unchanged (`arrow` geometry untouched).
- Unknown older clients ignoring `stealth` keep current fallback behavior for unknown marker strings.
- Feature branch: `feat/stealth-arrow-marker` in papirus + warchi; local `file:../papirus` while developing.
