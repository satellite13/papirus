# Papirus

[![npm version](https://img.shields.io/npm/v/papirus.svg)](https://www.npmjs.com/package/papirus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
npm install papirus
```

## Quick Start

```ts
import { DiagramRenderer, RectangleNode, Edge } from 'papirus';

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

- [API Overview](./docs/api.md)
- [Elements](./docs/elements.md)
- [Interactions](./docs/interactions.md)
- [Overlays](./docs/overlays.md)
- [Utils](./docs/utils.md)

## Features

### Interactivity

Built-in `InteractionManager` includes:
- drag/select/connect/undo/redo/copy/paste
- Pan on empty canvas area
- Zoom with mouse wheel, pinch-to-zoom, two-finger pan

```ts
const interactions = renderer.enableInteractions({ gridSize: 20, snapToGrid: true });
interactions.navigation.fitToView();
```

Default edge creation: `Shift + drag` from node to node (to avoid interfering with regular drag).

### Elements & Groups

```ts
const group = new Group({ label: 'Main Flow', padding: 16 });
group.addChild(nodeA);
group.addChild(nodeB);
renderer.addGroup(group);

const node = new RectangleNode({
  x: 20, y: 20, width: 120, height: 60,
  ports: [{ type: 'input', position: 'left' }],
  icon: { source: '/icons/start.svg', fit: 'contain', scaleWithBounds: true },
});
```

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
import { Serializer } from 'papirus';

const serializer = new Serializer(renderer, {
  nodeFactory: (data) => new RectangleNode(data),
  edgeFactory: (data) => new Edge(data),
});

const json = serializer.toJSON(true);
serializer.fromJSON(json);
```

### Export

```ts
import { ImageExporter, SvgExporter } from 'papirus';

const imageExporter = new ImageExporter(renderer);
await imageExporter.download('diagram.png', { scale: 2 });

const svgExporter = new SvgExporter(renderer);
await svgExporter.download('diagram.svg');
```

### Overlays

```ts
import { GridOverlay, MiniMap } from 'papirus';

renderer.use(new GridOverlay({ gridSize: 20 }));
renderer.use(new MiniMap({ width: 180, height: 120, padding: 12 }));
```

Also available: `RulersOverlay`, `GuidesOverlay`, `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`.

## Framework Integrations

- [Vue 3](./packages/vue)

## Example

See [`examples/index.html`](./examples/index.html) for a complete interactive demo.

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

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
