# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

[Русская версия](./CHANGELOG.ru.md)

## [Unreleased]

## [0.6.4] - 2026-06-02

### Fixed
- SVG export for `CompositeNode` with `shapeType: 'custom'` now renders the custom outline via `svgPath` instead of falling back to a rectangle.

## [0.6.3] - 2026-04-07

### Fixed
- SVG export for edge labels now matches canvas behavior: `labelFollowPath` rotation is applied, and `labelLineGap` creates a gap in the exported edge path under the label.

## [0.6.2] - 2026-03-31

### Added
- Edge marker type `square` for `startMarker` / `endMarker`: canvas rendering, SVG export, and default size in `MARKER_SIZES`.

## [0.6.1] - 2026-03-31

### Changed
- Composite `CText`: binding to the display name uses `bindToProperty: '__name__'` instead of legacy `role: 'name'`; deserialization, interaction handling, examples, and tests updated accordingly.

### Documentation
- README, API/elements docs, and examples expanded for `CompositeNode`, edge label options (`labelPosition`, `labelFollowPath`, `labelLineGap`), and related UI in the basic and composite demos.

## [0.6.0] - 2026-03-31

### Added
- New `CompositeNode` with flex layout for complex notation elements (BPMN, ArchiMate, C4, UML), including examples such as swimlane and status card compositions.
- New edge label options: `labelPosition` and `labelFollowPath` for finer label placement behavior.
- Composite serialization now includes `label`, `bindToProperty`, and `bindsNotationIcon` fields in `SerializedCComponent`.

### Fixed
- Edge rendering with label offset/line gap now correctly respects label rotation.
- Composite text SVG export now follows wrapped lines consistently; auto-size measurement behavior was stabilized to avoid inflated bounds in examples.

## [0.5.9] - 2026-03-25

### Fixed
- `SvgExporter`: edge SVG export no longer draws a legacy end arrow when `startMarker` / `endMarker` are set explicitly but one or both ends are `none` (aligned with canvas `Edge` rendering). Added regression tests.

## [0.5.8] - 2026-03-25

### Added
- Diagram plugin hooks for overlay pointer ownership: optional `beginOverlayDrag` / `updateOverlayDrag` / `endOverlayDrag` and `blocksDiagramPointerAtScreen` on `DiagramPlugin` (used by `MiniMap` and routed through `DiagramRenderer`).
- `ConnectionManager` events `controlPointDragStart` and `controlPointDragEnd` when dragging polyline/bezier control points (for host apps such as collaborative editing).

### Changed
- `InteractionManager`, `ConnectionManager`, `ResizeManager`, `SelectionManager`, and `ContextMenuManager` respect overlay pointer blocking so minimap and similar overlays receive drags and clicks predictably.
- `MiniMap`: implements overlay drag sessions and screen hit-testing via the new plugin contract.

## [0.5.7] - 2026-03-25

### Changed
- Documentation and README examples aligned with the current public API and maintainer guidance (AGENTS, renderer and utils docs).

## [0.5.6] - 2026-03-17

### Added
- `enableInteractions()` option `previewPathType` to configure the connection preview path while dragging a new edge: `'bezier'` (default) or `'straight'`.

### Changed
- Interaction docs and README examples updated for `previewPathType`.
- Added tests covering both connection preview modes.

## [0.5.5] - 2026-03-15

### Changed
- Internal release workflow documentation was clarified and standardized for maintainers.

## [0.5.4] - 2026-03-04

### Changed
- InteractionManager: refactored mouse down event handling; in `navigationOnly` mode, navigation (panning) takes priority over selection; simplified conditions for starting selection rectangle and clearing selections.

## [0.5.3] - 2026-03-03

### Added
- `enableInteractions()` option `alignmentScreenTolerance`: screen distance (px) within which alignment guides snap when dragging. When not set, the default from `ALIGNMENT_SCREEN_TOLERANCE` (8) is used. Allows host apps (e.g. warchi) to use a larger value (e.g. 80) for easier alignment.

### Changed
- Default `ALIGNMENT_SCREEN_TOLERANCE` in constants is 8 again; override via options when needed.
- Docs: `alignmentScreenTolerance` described in `docs/interactions.md`.

## [0.5.2] - 2026-03-03

### Added
- Edge option `labelLineGap`: when `true` and the edge has a label, the line is not drawn through the label bounds (gap at label). Supported in serialization, history, and clipboard. New geometry helper `segmentRectIntersections` in `utils/geometry`.

### Changed
- Docs: edge options (`labelOffset`, `labelLineGap`) and example in `docs/elements.md`; `docs/README.md` mentions `labelLineGap`.

## [0.5.1] - 2026-03-03

### Changed
- ContextMenuManager: enhanced icon handling options for context menu items.

## [0.5.0] - 2026-03-02

### Added
- Interactive node properties: inline editing of custom properties in selection panel (feature/interactive-properties).

## [0.4.0] - 2026-03-01

### Added
- Node content layout settings: `contentInset`, `label.inset`, icon `placement`/`inset`, and edge `labelBackground` support across runtime/serialization/export paths.
- Extended `basic` example controls for node/edge label layout and background customization.

### Changed
- Refactored node inner layout and SVG export behavior for text/icon/content area placement.
- Updated README (EN/RU) and docs pages for current layout API usage.

### Fixed
- Improved selected panel refresh logic to keep style settings consistent after selection changes.

## [0.3.23] - 2026-03-01

### Added
- Node style: added icon placement support and related options for node layout.
- Examples (`basic`): added controls for content/label insets and edge label background inset/radius.

### Changed
- Refactored node inner layout logic and SVG export handling for text, icon, and content area placement.
- Updated docs and examples for new content layout settings.

### Fixed
- Improved selected panel refresh behavior to keep style panel state consistent when selection changes.

## [0.3.22] - 2026-02-28

### Fixed
- TextLabel: защита от `undefined` в `text` — при отсутствии или присвоении `undefined` (например из опций лейбла при десериализации) больше не возникает `TypeError: undefined is not an object (evaluating 'this._text.split')`. В конструкторе и сеттере используется `?? ''`, в `measure()` — безопасное разбиение по строкам.

## [0.3.21] - 2026-02-27

### Fixed
- Keyboard shortcuts (Ctrl+Z/Y/C/V) work with any keyboard layout: uses `event.code` instead of `event.key` for letter keys.

## [0.3.20] - 2026-02-27

### Fixed
- `_canvasRect` cache invalidation every frame: `screenToWorld`/`worldToScreen` correctly account for layout changes (e.g., panel resizing around canvas without canvas size change).

## [0.3.19] - 2026-02-27

### Fixed
- When switching edge type from `editable-polyline` to `bezier`/`straight`/`polyline`, control points are now removed.
- Removed type casting for `attachToOutline` in ConnectionManager.

### Changed
- Refactoring: `mergeBounds`, `clonePoints` in geometry; tolerance constants; `hasEditableControlPoints`, `getPathVertices` in Edge.
- Optimized `resolveAlignmentDelta`: only checks nodes in drag area.
- Optimized edge iteration in ConnectionManager (reverse loop instead of `reverse()`).

### Added
- ConnectionManager tests: create connection (attachToOutline), reconnect.
- Lowered coverage thresholds (lines/statements 48%, branches/functions 39%).

## [0.3.18] - 2026-02-27

### Fixed
- With `attachToOutline`, edge endpoint for `CustomShapeNode` follows the shape contour (Path2D), not the bounding rectangle.

## [0.3.17] - 2026-02-27

### Added
- `CustomShapeNodeOptions.svgPath` — option for correct SVG export of custom shapes. Path2D cannot be converted to SVG, so `svgPath` is set separately (string or factory `(w, h) => string`).
- `ShapeFactories.svg` — ready SVG paths for hexagon, parallelogram, cylinder, document, chamfered.
- `CustomShapeNode.getSvgPath()`, `setSvgPath()` — access to SVG path for export.
- `TextLabel.getWrappedLines(ctx, maxWidth)` — get word-wrapped text for SVG export.
- `Node.getLabelBoundsForExport(ctx)` — bounds and label lines for SVG export (with icon and placement).

### Fixed
- SVG export of node labels: text now wraps by words (as on canvas), not rendered in a single line.
- SVG export of labels: text positioning (with icon, labelPlacement, getLabelContainerBounds) matches canvas rendering.

## [0.3.16] - 2026-02-26

### Fixed
- `fillOpacity` and `strokeOpacity` now applied when rendering `CustomShapeNode` and `DiamondNode` (previously only in SVG export).

## [0.3.15] - 2026-02-26

### Added
- `contentMargin` option in `MiniMap`: margin (in world coordinates) around content, extends view drag area when dragging minimap frame.

### Changed
- Updated docs: `contentMargin` in examples and docs; `overlays.md` — `anchor`, `enabled` options; `renderer.md` — `scrollbar` instead of deprecated `scrollbarOverlay`; `elements.md` — `editable-polyline` edge type.

## [0.3.14] - 2026-02-25

### Added
- `attachToOutline` option in `enableInteractions`: when enabled, edges can attach anywhere on the shape outline, not just ports; attachment position stored in `EdgeEndpoint.outlineParam`.
- With `attachToOutline`: ports and anchors hidden; outline snapping with magnetic snap; horizontal/vertical alignment with other edge end or nearest polyline breakpoint.
- Shift+click on node starts connection from nearest point on outline.

### Fixed
- With Outline ON for editable polyline, horizontal/vertical snap uses nearest breakpoint, not opposite edge end.
- When dragging on CircleNode and DiamondNode outline, edge end follows actual contour (ellipse/diamond), not bounding box.

## [0.3.13] - 2026-02-24

### Fixed
- Fixed minimap rendering: minimap frame and viewport frame no longer inherit dash from previously rendered dashed edges.
- Added explicit `lineDash`/`lineDashOffset` reset in `MiniMap` before drawing frames so canvas state does not leak between elements.

## [0.3.12] - 2026-02-24

### Added
- New edge path type `editable-polyline` with interactive breakpoints.
- For `editable-polyline`: default center point, `+` buttons on segments to insert breakpoints, double-click to remove point.
- Axis magnets and grid snap for editing breakpoints.
- Smart-align nodes when dragging with visual guides.
- `alignToNodes` setting in `enableInteractions` and runtime toggle `interactions.drag.setAlignmentEnabled(...)`.

### Changed
- Updated examples (`basic`, `ports`): added `editable-polyline` demo, Align ON/OFF and Rulers ON/OFF toggles, expanded snap controls.
- Updated docs (`README.md`, `README.ru.md`, `docs/interactions.md`) with new interactive features.

## [0.3.11] - 2026-02-24

### Fixed
- Fixed canvas pan sticking when releasing mouse outside canvas: on cursor re-entry, pan session correctly ends.
- Added InteractionManager test for pan completion after `mouseup` loss.

## [0.3.10] - 2026-02-24

### Fixed
- Fixed scrollbars/minimap drag sticking: if mouse released outside canvas, drag session forcibly ends on cursor return.
- Disabled horizontal pan from wheel/trackpad: wheel scroll now used for zoom only.
- Updated `basic` example: removed deprecated Shift+wheel horizontal pan hint.

## [0.3.9] - 2026-02-23

### Fixed
- Fixed node icon export to SVG: icons now correctly included in export file.
- Fixed SVG export of rounded rectangles: runtime `RectangleNode.cornerRadius` now used (as in canvas render).
- SVG export of nodes: added `fillOpacity`, `strokeOpacity`, `lineDash`, `lineDashOffset`.
- SVG text labels: `TextStyle.opacity` and node label position via `getLabelPosition()`.
- SVG node labels: `padding`/`margin` and text alignment (`left`/`center`/`right`).
- SVG edges: `strokeOpacity`, `lineCap`, `lineJoin`.
- SVG edge labels: added `labelBackground` export, improved style/position matching.
- Fixed layer order in SVG export: edges and arrows render above nodes (as in canvas).

## [0.3.4] - 2026-02-19

### Added
- Self-loop edges (node to itself) allowed via ConnectionManager.
- For `polyline`: obstacle-aware orthogonal routing with shape avoidance; obstacle margin 12, turn penalty, horizontal-first priority.
- For `bezier`: self-loop/corner avoidance rules so path does not pass under shape in short local edges.

### Changed
- DiagramRenderer draw order: edges now render above nodes; edge handles remain top layer.
- Bezier and polyline avoidance rules limited to self-loop cases where needed.

## [0.3.3] - 2026-02-19

### Fixed
- Fixed SVG export of edge labels: when `SvgExportOptions.edgeLabelOffset` absent, runtime `edge.labelOffset` now used per edge.

### Added
- `basic` example: Label Offset setting for interactive edge label offset adjustment.

## [0.3.2] - 2026-02-19

### Fixed
- Fixed marker rendering in SVG export for diagrams with different marker types: markers now output as geometry (`path`/`circle`), fixing SVG viewer compatibility with `marker-start`/`marker-end`.

## [0.3.1] - 2026-02-19

### Fixed
- Fixed SVG export for new edge markers (`startMarker`/`endMarker`): arrow, open, diamond, circle types now export correctly.
- Added fallback to legacy `arrowType` in SVG export to match canvas render behavior.

### Changed
- SVG export edge label behavior: label renders without offset by default; `SvgExportOptions.edgeLabelOffset` for explicit offset.

## [0.3.0] - 2026-02-19

### Added
- Public API to disable node resize handles: `NodeOptions.resizeHandlesEnabled` and `node.resizeHandlesEnabled`
- Public API for custom shape: `CustomShapeNodeOptions.shapeType` and `customShapeNode.shapeType`
- Public setters `TextLabel.padding` and `TextLabel.margin` for runtime padding/margin

### Changed
- Improved integration with external diagram editors: less need for internal field access and `any` casts

## [0.2.0] - 2026-02-18

### Added
- Inline label editing on double-click for nodes and edges (InteractionManager)
- New docs: `renderer.md`, `input.md`, `search.md`
- Label Pad/Margin and Icon Pad/Margin/Gap settings in Node Style panel of `basic` example

### Changed
- Improved node text layout: word wrap considers available text area with icon; circle/diamond use inscribed rect; node expansion only if wrap does not fix overflow
- Updated examples (`basic`, `ports`, `custom-shapes`): improved toolbars and icons, inline edit hints, simplified theme, better canvas size handling
- Expanded docs on interactivity, overlays, and elements

## [0.1.0] - 2026-02-18

### Added
- First public release
- `DiagramRenderer` — main renderer with coordinate system, zoom, and panning
- Elements: `RectangleNode`, `CircleNode`, `DiamondNode`, `CustomShapeNode`, `Edge`, `Group`
- `InteractionManager` with drag/select/connect/undo/redo/copy/paste
- `StyleManager` with themes (default, dark) and custom style classes
- `Serializer` for JSON save/load
- `ImageExporter` and `SvgExporter`
- Overlays: `GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`
- Utilities: `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`
- Port (`Port`) and node icon (`NodeImage`) support
- Edge animations (flow effect)
- Context menu and search/filter

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.4...HEAD
[0.6.4]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.3...v0.6.4
[0.6.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.3
[0.6.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.2
[0.6.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.6.1
[0.6.0]: https://gitverse.ru/ngroznykh/papirus/compare/v0.6.0...v0.6.1
[0.5.9]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.9
[0.5.8]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.8
[0.5.7]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.7
[0.5.6]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.6
[0.5.5]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.5
[0.5.4]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.4
[0.5.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.3
[0.5.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.2
[0.5.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.1
[0.5.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.5.0
[0.4.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.4.0
[0.3.23]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.23
[0.3.22]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.22
[0.3.21]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.21
[0.3.20]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.20
[0.3.19]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.19
[0.3.18]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.18
[0.3.17]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.17
[0.3.16]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.16
[0.3.15]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.15
[0.3.14]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.14
[0.3.13]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.13
[0.3.12]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.12
[0.3.11]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.11
[0.3.10]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.10
[0.3.9]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.9
[0.3.4]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.4
[0.3.3]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.3
[0.3.2]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.2
[0.3.1]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.1
[0.3.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.3.0
[0.2.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.2.0
[0.1.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.1.0
