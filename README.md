# Papirus

[![npm version](https://img.shields.io/npm/v/%40ngroznykh%2Fpapirus.svg)](https://www.npmjs.com/package/@ngroznykh/papirus)
[![CI](https://github.com/satellite13/papirus/actions/workflows/ci.yml/badge.svg)](https://github.com/satellite13/papirus/actions/workflows/ci.yml)
[![License: AGPL%20v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

TypeScript library for building interactive 2D diagrams and flowcharts on HTML Canvas. Supports nodes, edges, groups, styling, serialization, export, and interactivity.

[Русская версия](./README.ru.md)

## About

Papirus is a diagram rendering and interaction engine designed to be embedded in any UI (SPA, static pages, design systems). The library provides:

- `DiagramRenderer` with coordinate system, zoom, and panning
- Set of elements (nodes/edges/groups) and base types
- Interaction managers (selection, drag, connection, history)
- Context menu and search/filtering
- Basic animations and animated edge flow
- Theming and styling via `StyleManager`
- Overlays (grid, minimap, rulers, guides) and export utilities

## Installation

```bash
npm install @ngroznykh/papirus
```

## Requirements

- Node.js `>=18`
- A modern browser with Canvas API support (Chrome, Edge, Firefox, Safari)

## Quick Start

```ts
import { DiagramRenderer, RectangleNode, Edge } from '@ngroznykh/papirus';

const renderer = new DiagramRenderer('#canvas', {
  width: 900,
  height: 600,
  backgroundColor: '#fafafa',
});

const nodeA = new RectangleNode({ x: 100, y: 100, width: 140, height: 60, label: 'Start' });
const nodeB = new RectangleNode({ x: 360, y: 100, width: 140, height: 60, label: 'Process' });

renderer.addNode(nodeA);
renderer.addNode(nodeB);
renderer.addEdge(new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  type: 'bezier',
}));

renderer.enableInteractions();
```

## Documentation

- [Docs Index](./docs/README.md)
- [API Overview](./docs/api.md)
- [CompositeNode](./docs/composite.md)
- [Elements](./docs/elements.md)
- [Renderer](./docs/renderer.md)
- [Interactions](./docs/interactions.md)
- [Input](./docs/input.md)
- [Search](./docs/search.md)
- [Overlays](./docs/overlays.md)
- [Utils](./docs/utils.md)
- [Changelog](./CHANGELOG.md)
- [Security Policy](./SECURITY.md)

## Features

### Interactivity

Built-in `InteractionManager` includes:
- drag/select/connect/undo/redo/copy/paste
- Pan on empty canvas area
- Zoom with mouse wheel, pinch-to-zoom, two-finger pan
- Smart alignment to other nodes while dragging (with guide lines)

```ts
const interactions = renderer.enableInteractions({
  gridSize: 20,
  snapToGrid: true,
  previewPathType: 'straight', // 'straight' | 'bezier'
});
interactions.navigation.fitToView();
interactions.drag.setAlignmentEnabled(true);
```

Default edge creation: drag from one node anchor point to another (no modifier key required).

Default keyboard shortcuts:
- `Delete/Backspace` — delete selection
- `Ctrl/Cmd + C` / `Ctrl/Cmd + V` — copy/paste
- `Ctrl/Cmd + Z` — undo
- `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z` — redo

Editable polyline edges:
- `type: 'editable-polyline'` supports draggable bend points.
- Mid-segment `+` controls add new bend points.
- Double-click a bend point to remove it.
- Bend points support grid snapping and axis magnet behavior while dragging.

### Elements & Groups

```ts
const group = new Group({ label: 'Main Flow', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);

const node = new RectangleNode({
  x: 20, y: 20, width: 120, height: 60,
  ports: [{ type: 'input', position: 'left' }],
  contentInset: { top: 8, right: 10, bottom: 8, left: 10 },
  label: {
    text: 'Start service',
    inset: 8,
    style: { align: 'left', verticalAlign: 'top' },
  },
  icon: {
    source: '/icons/start.svg',
    fit: 'contain',
    scaleWithBounds: true,
    placement: 'top-right',
    inset: 6,
  },
});
```

### Content Layout and Edge Label Background

Node layout is built in two steps:
- `contentInset` defines node content area (inside shape bounds).
- `label.inset` defines text inset inside content area.

Icon and text share the same content area:
- icon position is controlled by `icon.placement` + `icon.inset`;
- text alignment is controlled by `label.style.align` and `label.style.verticalAlign`.

Edge labels support background styling through `labelBackground`:

```ts
const edge = new Edge({
  from: { nodeId: nodeA.id },
  to: { nodeId: nodeB.id },
  label: 'API call',
  labelOffset: 12,
  labelPosition: 0.65, // 0..1 along edge path (0 = start, 1 = end)
  labelFollowPath: true, // rotate label with local edge direction
  labelLineGap: true, // line is cut under label bounds
  labelBackground: {
    color: '#ffffff',
    opacity: 0.9,
    borderRadius: 6,
  },
});
```

### CompositeNode (Flex Components)

`CompositeNode` lets you build notation-specific visual structures as a component tree (`container`, `text`, `icon`, `shape`, `divider`) with a flexbox-like layout engine:

```ts
import { CompositeNode, container, text, icon, divider } from '@ngroznykh/papirus';

const composite = new CompositeNode({
  x: 120,
  y: 80,
  width: 220,
  height: 120,
  shapeType: 'rectangle',
  autoSize: true,
  content: container({
    direction: 'column',
    padding: 10,
    gap: 6,
    children: [
      text({ id: 'name', text: 'Service API', bindToProperty: '__name__', style: { alignSelf: 'center' } }),
      divider({}),
      container({
        direction: 'row',
        justifyContent: 'space-between',
        children: [
          text({ text: 'v2.1.0', color: '#64748b' }),
          icon({ source: '/icons/cloud.svg', width: 16, height: 16, bindsNotationIcon: true }),
        ],
      }),
    ],
  }),
});
```

Serialized composite components (`SerializedCComponent`) include editor/integration fields:
- `label` — human-readable component caption for host editors.
- `bindToProperty` — bind `text` value to a property name (`'__name__'` for node display name).
- `bindsNotationIcon` — mark `icon` source as notation-level icon binding.

### Styling

`StyleManager` applies themes and classes to nodes/edges/text/ports/groups.

```ts
const styles = new StyleManager('dark');
styles.registerClass({
  name: 'error',
  node: { fillColor: '#fee2e2', strokeColor: '#dc2626' },
  text: { color: '#991b1b' },
});
renderer.setStyleManager(styles);
```

Built-in themes: `DEFAULT_THEME`, `DARK_THEME`.

### Serialization

```ts
import { Serializer } from '@ngroznykh/papirus';

const serializer = new Serializer(renderer, {
  nodeFactory: (data) => {
    if (data.type === 'composite') {
      /* see docs/utils.md — deserializeCComponent + CompositeNode */
    }
    return new RectangleNode(data);
  },
  edgeFactory: (data) => new Edge(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

See [Utils](./docs/utils.md) for multi-type and composite `nodeFactory` examples.

### Export

```ts
import { ImageExporter, SvgExporter } from '@ngroznykh/papirus';

const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2 });

const svgExporter = new SvgExporter(renderer);
svgExporter.download('diagram.svg');
```

### Overlays

```ts
import { GridOverlay, MiniMap } from '@ngroznykh/papirus';

renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12, contentMargin: 200 }));
```

Also available: `RulersOverlay`, `GuidesOverlay`, `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`.

## Framework Integrations

Papirus is framework-agnostic. It can be embedded in Vue/React/Svelte/vanilla apps.

## Example

See [`examples/index.html`](./examples/index.html) for interactive local demos.

## Versioning and Stability

Papirus follows [Semantic Versioning](https://semver.org/).  
Current major version is `0.x`, so some API changes are still possible between minor releases.

Breaking and notable changes are documented in [CHANGELOG.md](./CHANGELOG.md).

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint
npm run format          # Prettier formatting
npm run build           # Build library
npm run test            # Run tests
npm run test:coverage   # Tests with coverage
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

Key governance and contribution files:

- [CONTRIBUTING.md](./CONTRIBUTING.md) / [CONTRIBUTING.ru.md](./CONTRIBUTING.ru.md)
- [SECURITY.md](./SECURITY.md) / [SECURITY.ru.md](./SECURITY.ru.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) / [CODE_OF_CONDUCT.ru.md](./CODE_OF_CONDUCT.ru.md)

## License

This project uses dual licensing:

- `AGPL-3.0-or-later` for open-source usage
- Commercial license for proprietary/closed-source commercial usage

See:

- [LICENSE](./LICENSE)
- [LICENSE_COMMERCIAL.md](./LICENSE_COMMERCIAL.md)
