# Stealth Arrow Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filled barbed edge marker type `stealth` in papirus (canvas + SVG) and expose it in wArchi style UI as «Острая» / «Stealth».

**Architecture:** Extend `ArrowMarkerType` with `stealth`. Geometry lives in pure helpers in `markers.ts` (same pattern as `arrow`). Canvas draws via `EdgeMarkerRenderer`; SVG via `generateSvgMarker`. wArchi only widens allow-lists, selects, and i18n — no new attrs schema.

**Tech Stack:** TypeScript, Vitest, Vue 3 (`NodeStylePanel`), `@ngroznykh/papirus`

**Spec:** `docs/superpowers/specs/2026-08-06-stealth-arrow-marker-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| Modify `papirus/src/types.ts` | Add `'stealth'` to `ArrowMarkerType` |
| Modify `papirus/src/constants.ts` | `MARKER_SIZES.stealth = 12` |
| Modify `papirus/src/utils/markers.ts` | Stealth polygon + length + SVG path |
| Create `papirus/src/utils/markers.test.ts` | Geometry / length / SVG unit tests |
| Modify `papirus/src/elements/edge/EdgeMarkerRenderer.ts` | Canvas draw + length for `stealth` |
| Modify `papirus/src/elements/Edge.test.ts` | Include `stealth` in marker type list |
| Modify `papirus/src/utils/Serializer.test.ts` | Round-trip `stealth` if marker serialization covered |
| Modify `papirus/src/utils/SvgExporter.test.ts` | Export filled stealth path |
| Modify `papirus/docs/elements.md` | Document `stealth` in marker list |
| Modify `warchi/src/features/notations/utils/notationElementBuilders.ts` | `buildMarker` allow-list |
| Modify `warchi/src/features/notations/utils/notationElementBuilders.test.ts` | Assert `stealth` |
| Modify `warchi/src/features/diagram-style/composables/useEdgeStyleState.ts` | Widen marker unions |
| Modify `warchi/src/features/diagram-style/components/NodeStylePanel.vue` | `MarkerKind`, selects, handlers |
| Modify `warchi/src/i18n/locales/diagram.ts` | `markerStealth` ru/en |

---

### Task 0: Feature branches + local papirus link

**Files:**
- Modify: `warchi/package.json` (temporary `file:../papirus`)
- Modify: `warchi/package-lock.json` (must reflect `file:../papirus`)

- [ ] **Step 1: Create matching branches**

```bash
cd /Users/nikolaygroznyh/Work/papirus && git checkout -b feat/stealth-arrow-marker
cd /Users/nikolaygroznyh/Work/warchi && git checkout -b feat/stealth-arrow-marker
```

- [ ] **Step 2: Point warchi at local papirus and refresh lock**

In `warchi/package.json` set:

```json
"@ngroznykh/papirus": "file:../papirus"
```

Then:

```bash
cd /Users/nikolaygroznyh/Work/warchi && npm install
```

Confirm `package-lock.json` resolves `@ngroznykh/papirus` to `file:../papirus` (no leftover registry tarball for that package).

- [ ] **Step 3: Commit branch setup in warchi only if lock/package change is kept for the feature work**

```bash
cd /Users/nikolaygroznyh/Work/warchi
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: link local papirus for stealth marker work

EOF
)"
```

(Do not commit papirus link into a release branch; revert to npm before release.)

---

### Task 1: Type + failing geometry tests (papirus)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/constants.ts`
- Create: `src/utils/markers.test.ts`

- [ ] **Step 1: Extend the type union and default size**

In `src/types.ts`:

```ts
export type ArrowMarkerType = 'none' | 'arrow' | 'open' | 'diamond' | 'circle' | 'square' | 'stealth';
```

In `src/constants.ts` `MARKER_SIZES`:

```ts
export const MARKER_SIZES: Record<string, number> = {
  arrow: 12,
  open: 12,
  stealth: 12,
  diamond: 14,
  circle: 6,
  square: 6,
};
```

- [ ] **Step 2: Write failing geometry tests**

Create `src/utils/markers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ARROW_ANGLE } from '@/constants';
import {
  calculateStealthMarkerPoints,
  generateSvgMarker,
  getMarkerLength,
} from '@/utils/markers';

describe('stealth marker', () => {
  it('builds a barbed pentagon with tip at to and concave heel', () => {
    const to = { x: 100, y: 50 };
    const angle = 0; // pointing +x
    const size = 12;
    const p = calculateStealthMarkerPoints(to, angle, size);

    expect(p.tip).toEqual(to);
    // Outer barbs match arrow wings
    expect(p.leftOuter.x).toBeCloseTo(to.x - size * Math.cos(angle - ARROW_ANGLE), 5);
    expect(p.rightOuter.x).toBeCloseTo(to.x - size * Math.cos(angle + ARROW_ANGLE), 5);
    // Inner heel closer to tip than outer barbs (concave notch)
    const outerDepth = Math.max(
      to.x - p.leftOuter.x,
      to.x - p.rightOuter.x
    );
    const innerDepth = Math.max(to.x - p.leftInner.x, to.x - p.rightInner.x);
    expect(innerDepth).toBeLessThan(outerDepth);
    expect(Math.abs(p.leftInner.y - to.y)).toBeLessThan(Math.abs(p.leftOuter.y - to.y));
  });

  it('shortens the edge by arrow-equivalent length', () => {
    const len = getMarkerLength({ type: 'stealth', size: 12 });
    expect(len).toBeCloseTo(12 * Math.cos(ARROW_ANGLE), 5);
  });

  it('generates a filled closed SVG path', () => {
    const svg = generateSvgMarker(
      { type: 'stealth', size: 12, fillColor: '#000', fillOpacity: 1 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      '#000'
    );
    expect(svg).toMatch(/^<path /);
    expect(svg).toContain(' Z"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toContain('fill="none"');
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (missing `calculateStealthMarkerPoints` / switch cases)**

```bash
cd /Users/nikolaygroznyh/Work/papirus && npx vitest run src/utils/markers.test.ts
```

Expected: FAIL — `calculateStealthMarkerPoints` is not exported / not a function.

- [ ] **Step 4: Commit type + failing tests**

```bash
cd /Users/nikolaygroznyh/Work/papirus
git add src/types.ts src/constants.ts src/utils/markers.test.ts
git commit -m "$(cat <<'EOF'
test: add failing stealth marker geometry coverage

EOF
)"
```

---

### Task 2: Implement stealth geometry + SVG (papirus)

**Files:**
- Modify: `src/utils/markers.ts`

- [ ] **Step 1: Add calculator + wire length/SVG switches**

Add after `calculateArrowMarkerPoints`:

```ts
/** Depth of stealth heel notch along the edge (fraction of arrow shaft length). */
const STEALTH_NOTCH_DEPTH = 0.55;
/** Lateral inset of heel vs outer barb half-width. */
const STEALTH_NOTCH_WIDTH = 0.35;

/**
 * Stealth (barbed) marker: tip + outer barbs + concave heel (two inner points).
 */
export function calculateStealthMarkerPoints(
  to: Point,
  angle: number,
  size: number
): {
  tip: Point;
  leftOuter: Point;
  leftInner: Point;
  rightInner: Point;
  rightOuter: Point;
} {
  const { left: leftOuter, right: rightOuter } = calculateArrowMarkerPoints(to, angle, size);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const depth = size * Math.cos(ARROW_ANGLE);
  const halfWidth = size * Math.sin(ARROW_ANGLE);
  const innerDepth = depth * STEALTH_NOTCH_DEPTH;
  const innerHalf = halfWidth * STEALTH_NOTCH_WIDTH;
  const leftInner = {
    x: to.x - innerDepth * cos + innerHalf * sin,
    y: to.y - innerDepth * sin - innerHalf * cos,
  };
  const rightInner = {
    x: to.x - innerDepth * cos - innerHalf * sin,
    y: to.y - innerDepth * sin + innerHalf * cos,
  };
  return { tip: to, leftOuter, leftInner, rightInner, rightOuter };
}
```

In `getMarkerLength`:

```ts
case 'arrow':
case 'stealth':
  return size * Math.cos(ARROW_ANGLE);
```

Add SVG helper and case in `generateSvgMarker`:

```ts
export function generateSvgStealthMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const { tip, leftOuter, leftInner, rightInner, rightOuter } = calculateStealthMarkerPoints(
    to,
    angle,
    size
  );
  return `<path d="M ${tip.x} ${tip.y} L ${leftOuter.x} ${leftOuter.y} L ${leftInner.x} ${leftInner.y} L ${rightInner.x} ${rightInner.y} L ${rightOuter.x} ${rightOuter.y} Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}
```

In `generateSvgMarker` switch (before `arrow` default):

```ts
case 'stealth':
  return generateSvgStealthMarker(to, angle, size, fill, fillOpacity, stroke);
```

- [ ] **Step 2: Run geometry tests — expect PASS**

```bash
cd /Users/nikolaygroznyh/Work/papirus && npx vitest run src/utils/markers.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/nikolaygroznyh/Work/papirus
git add src/utils/markers.ts
git commit -m "$(cat <<'EOF'
feat: add stealth barbed arrow marker geometry

EOF
)"
```

---

### Task 3: Canvas renderer + Edge/Serializer/SVG tests (papirus)

**Files:**
- Modify: `src/elements/edge/EdgeMarkerRenderer.ts`
- Modify: `src/elements/Edge.test.ts`
- Modify: `src/utils/SvgExporter.test.ts`
- Modify: `src/utils/Serializer.test.ts` (if it lists marker types)

- [ ] **Step 1: Draw stealth on canvas**

In `getCanvasMarkerLength`:

```ts
case 'arrow':
case 'stealth':
  return size * Math.cos(ARROW_ANGLE);
```

Import `calculateStealthMarkerPoints` from `@/utils/markers`.

In `drawMarker` switch:

```ts
case 'stealth':
  drawStealthMarker(ctx, to, angle, size, fillColor, fillOpacity);
  break;
```

Add:

```ts
function drawStealthMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const { tip, leftOuter, leftInner, rightInner, rightOuter } = calculateStealthMarkerPoints(
    to,
    angle,
    size
  );
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(leftOuter.x, leftOuter.y);
  ctx.lineTo(leftInner.x, leftInner.y);
  ctx.lineTo(rightInner.x, rightInner.y);
  ctx.lineTo(rightOuter.x, rightOuter.y);
  ctx.closePath();
  fillAndStroke(ctx, fillColor, fillOpacity);
}
```

- [ ] **Step 2: Extend Edge marker type list**

In `src/elements/Edge.test.ts` (`supports all marker types`):

```ts
const types = ['none', 'arrow', 'open', 'diamond', 'circle', 'square', 'stealth'] as const;
```

- [ ] **Step 3: Add SvgExporter smoke test**

Append in `src/utils/SvgExporter.test.ts`:

```ts
it('exports filled stealth end marker', () => {
  const canvas = document.createElement('canvas');
  const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
  const a = new RectangleNode({ x: 0, y: 0, width: 40, height: 40 });
  const b = new RectangleNode({ x: 200, y: 0, width: 40, height: 40 });
  renderer.addNode(a);
  renderer.addNode(b);

  const edge = new Edge({ from: { nodeId: a.id }, to: { nodeId: b.id }, type: 'straight' });
  edge.startMarker = { type: 'none' };
  edge.endMarker = { type: 'stealth', size: 12 };
  edge.updateEndpoints({ x: 40, y: 20 }, { x: 200, y: 20 });
  renderer.addEdge(edge);

  const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
  expect(filledMarkerPathCount(svg)).toBe(1);

  renderer.destroy();
});
```

If `Serializer.test.ts` asserts a fixed list of marker types, add `'stealth'` the same way as `'arrow'`.

- [ ] **Step 4: Run papirus tests for touched files**

```bash
cd /Users/nikolaygroznyh/Work/papirus && npx vitest run src/utils/markers.test.ts src/elements/Edge.test.ts src/utils/SvgExporter.test.ts src/utils/Serializer.test.ts
```

Expected: PASS

- [ ] **Step 5: Update docs and commit**

In `docs/elements.md`, extend the marker list to include `stealth`.

```bash
cd /Users/nikolaygroznyh/Work/papirus
git add src/elements/edge/EdgeMarkerRenderer.ts src/elements/Edge.test.ts src/utils/SvgExporter.test.ts src/utils/Serializer.test.ts docs/elements.md
git commit -m "$(cat <<'EOF'
feat: render stealth markers on canvas and SVG export

EOF
)"
```

---

### Task 4: wArchi allow-list + UI + i18n

**Files:**
- Modify: `src/features/notations/utils/notationElementBuilders.ts`
- Modify: `src/features/notations/utils/notationElementBuilders.test.ts`
- Modify: `src/features/diagram-style/composables/useEdgeStyleState.ts`
- Modify: `src/features/diagram-style/components/NodeStylePanel.vue`
- Modify: `src/i18n/locales/diagram.ts`

- [ ] **Step 1: Failing / update unit test for `buildMarker`**

In `notationElementBuilders.test.ts`:

```ts
it('returns marker for all valid types', () => {
  for (const t of ['arrow', 'open', 'diamond', 'circle', 'square', 'stealth']) {
    expect(buildMarker(t, {}, 'end')!.type).toBe(t)
  }
})
```

Run:

```bash
cd /Users/nikolaygroznyh/Work/warchi && npx vitest run src/features/notations/utils/notationElementBuilders.test.ts
```

Expected: FAIL on `stealth` until Step 2.

- [ ] **Step 2: Allow `stealth` in `buildMarker`**

```ts
const markerType =
  typeStr === 'arrow' ||
  typeStr === 'open' ||
  typeStr === 'diamond' ||
  typeStr === 'circle' ||
  typeStr === 'square' ||
  typeStr === 'stealth'
    ? (typeStr as ArrowMarkerType)
    : undefined
```

- [ ] **Step 3: Widen UI types and selects**

`useEdgeStyleState.ts`: add `'stealth'` to every marker union on `edgeEndMarker` / `edgeStartMarker` (declaration + casts in `loadEdgeProps`).

`NodeStylePanel.vue`:

```ts
type MarkerKind = "none" | "arrow" | "open" | "diamond" | "circle" | "square" | "stealth";
```

Update `toMarkerKind`, `handleEdgeEndMarkerChange` / `handleEdgeStartMarkerChange` casts, and `buildMarkerConfig` type param the same way.

In both `<select>` blocks (start + end), after `arrow`:

```html
<option value="stealth">{{ t("nodeStyle.markerStealth") }}</option>
```

- [ ] **Step 4: i18n**

In `src/i18n/locales/diagram.ts` next to `markerArrow`:

```ts
// ru nodeStyle:
markerStealth: 'Острая',

// en nodeStyle:
markerStealth: 'Stealth',
```

- [ ] **Step 5: Run warchi tests + typecheck touchpoints**

```bash
cd /Users/nikolaygroznyh/Work/warchi && npx vitest run src/features/notations/utils/notationElementBuilders.test.ts src/features/models/utils/diagramCanvasBuilders.test.ts
```

Expected: PASS

Optional smoke: `npm run build` in papirus then open style panel in warchi and pick «Острая» on an edge.

- [ ] **Step 6: Commit warchi**

```bash
cd /Users/nikolaygroznyh/Work/warchi
git add src/features/notations/utils/notationElementBuilders.ts \
  src/features/notations/utils/notationElementBuilders.test.ts \
  src/features/diagram-style/composables/useEdgeStyleState.ts \
  src/features/diagram-style/components/NodeStylePanel.vue \
  src/i18n/locales/diagram.ts
git commit -m "$(cat <<'EOF'
feat: add stealth arrow marker to edge style UI

EOF
)"
```

---

### Task 5: Verification checklist

- [ ] **Step 1: Full papirus marker-related tests**

```bash
cd /Users/nikolaygroznyh/Work/papirus && npm run test -- --run src/utils/markers.test.ts src/elements/Edge.test.ts src/utils/SvgExporter.test.ts
```

Expected: PASS

- [ ] **Step 2: Manual visual check (optional but recommended)**

1. `cd papirus && npm run build`
2. `cd warchi && npm run dev`
3. Open a diagram → select a link → Markers → End → «Острая»
4. Confirm barbed filled head; with dashed stroke the head stays solid filled
5. Export SVG and confirm the same head shape

- [ ] **Step 3: Do not bump papirus version / publish unless releasing**

Version bump + warchi npm dependency restore are a separate release step (see release-papirus / release-warchi skills).

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Type `stealth` | Task 1 |
| Same config as `arrow` | Tasks 2–4 (size/fill/stroke via existing config) |
| Canvas + SVG same look | Tasks 2–3 |
| Shaft shortening | Tasks 2–3 (`getMarkerLength` / `getCanvasMarkerLength`) |
| wArchi UI + i18n | Task 4 |
| No DB migration | — (string in existing attrs) |
| Docs `elements.md` | Task 3 |
| Feature branch + `file:../papirus` | Task 0 |
| Tests | Tasks 1–4 |
