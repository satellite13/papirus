# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Papirus is a TypeScript library for building interactive 2D diagrams and flowcharts on HTML Canvas. It's framework-agnostic with zero runtime dependencies.

## Commands

```bash
npm run dev              # Start Vite dev server
npm run build            # TypeScript compile + Vite build (outputs to dist/)
npm run serve            # Serve examples at localhost:3000/examples/
npm run typecheck        # TypeScript type checking only
npm run test             # Run vitest once
npm run test:watch       # Run vitest in watch mode
npm run test:coverage    # Run tests with coverage (80% threshold)
npm run lint             # ESLint on src/
npm run lint:fix         # Auto-fix ESLint errors
npm run format           # Format with Prettier
```

Run a single test file:
```bash
npx vitest run src/utils/Serializer.test.ts
```

## Architecture

### Core Layer (`src/core/`)
- **DiagramRenderer**: Main orchestrator - canvas management, coordinate system (world/screen), zoom/pan, render loop via requestAnimationFrame
- **InteractionManager**: Composes specialized managers (Selection, Drag, Resize, Navigation, Connection, History)
- **HistoryManager**: Undo/redo using Command pattern (`src/core/history/commands.ts`)
- **Overlays**: Plugin-based visual enhancements (GridOverlay, MiniMap, RulersOverlay, GuidesOverlay)

### Elements Layer (`src/elements/`)
```
Element (abstract) - base with state, style, bounds, dirty flag, hit testing
├── Node (abstract) - ports, labels, icons, anchor points
│   ├── RectangleNode, CircleNode, DiamondNode, CustomShapeNode
├── Edge - connections with path strategies (straight, polyline, bezier)
└── Group - container for organizing nodes
```

### Other Layers
- **Events** (`src/events/`): EventEmitter (type-safe) and InputHandler (mouse/touch/wheel with coordinate mapping)
- **Styles** (`src/styles/`): StyleManager with theme support (default, dark) and style classes
- **Utils** (`src/utils/`): Serializer (JSON save/load), ImageExporter (PNG), SvgExporter, AutoLayout, AutoRouting, AlignDistribute

## Key Patterns

1. **Dirty Flag**: Elements track `_dirty` for render optimization
2. **Strategy Pattern**: PathStrategy interface for edge rendering (StraightPathStrategy, PolylinePathStrategy, BezierPathStrategy)
3. **Factory Pattern**: NodeFactory/EdgeFactory in Serializer for custom element types
4. **Plugin Architecture**: `renderer.use(new GridOverlay())` - plugins implement `DiagramPlugin` interface
5. **Coordinate System**: World (diagram space) vs Screen (canvas pixels) with `screenToWorld()`/`worldToScreen()` conversion

## TypeScript Configuration

- Strict mode enabled with `noUncheckedIndexedAccess`
- Path alias: `@/*` → `src/*`
- ESLint requires explicit return types, no `any` types, no console in production
- Test files colocated with source (`*.test.ts`) — tests have relaxed ESLint rules (no explicit return types required, `any` allowed)

## Framework Integrations

- **Vue 3**: `packages/vue/` provides `PapirusCanvas` component

## Example Usage

```typescript
const renderer = new DiagramRenderer('#canvas', { width: 900, height: 600 });
const node = new RectangleNode({ x: 100, y: 100, width: 120, height: 60, label: 'Start' });
renderer.addNode(node);
renderer.enableInteractions();
renderer.use(new GridOverlay({ gridSize: 20 }));
```

See `examples/index.html` for a complete interactive demo. Additional documentation in `docs/` covers API, elements, interactions, overlays, and utilities.
