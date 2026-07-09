# AGENTS.md

This file provides essential information for AI coding agents working with the Papirus codebase.

## Project Overview

**Papirus** is a TypeScript library for building interactive 2D diagrams and flowcharts on HTML Canvas. It is framework-agnostic with zero runtime dependencies.

- **Package**: `@ngroznykh/papirus`
- **License**: AGPL-3.0-or-later (dual-licensed with commercial option)
- **Node.js Requirements**: >= 18.0.0
- **Repository**: https://gitverse.ru/ngroznykh/papirus

## Technology Stack

- **Language**: TypeScript 6.x with strict mode enabled
- **Build Tool**: Vite 8.x with ES modules output
- **Testing**: Vitest 4.x with jsdom environment, coverage via v8
- **Linting**: ESLint 10.x with typescript-eslint
- **Formatting**: Prettier 3.8+
- **Target**: ES2020, DOM APIs

## Project Structure

```
src/
├── index.ts              # Public API exports
├── types.ts              # Shared TypeScript interfaces
├── constants.ts          # Rendering constants
├── core/                 # Core rendering and interaction
│   ├── DiagramRenderer.ts      # Main canvas orchestrator
│   ├── InteractionManager.ts   # Composes all interaction managers
│   ├── SelectionManager.ts     # Element selection
│   ├── DragManager.ts          # Drag and alignment
│   ├── ResizeManager.ts        # Node resizing
│   ├── NavigationManager.ts    # Zoom, pan, viewport
│   ├── ConnectionManager.ts    # Edge creation/reconnection
│   ├── HistoryManager.ts       # Undo/redo system
│   ├── AnimationManager.ts     # Element animations
│   ├── SearchManager.ts        # Find/filter elements
│   ├── ContextMenuManager.ts   # Right-click menus
│   ├── history/
│   │   └── commands.ts         # Command pattern implementations
│   └── overlays/
│       ├── BaseOverlay.ts      # Base overlay class
│       ├── GridOverlay.ts      # Grid background
│       ├── MiniMap.ts          # Overview map
│       ├── RulersOverlay.ts    # Ruler guides
│       └── GuidesOverlay.ts    # Smart alignment guides
├── elements/             # Diagram elements
│   ├── Element.ts        # Abstract base class
│   ├── Node.ts           # Abstract node base
│   ├── Edge.ts           # Connection edges
│   ├── Group.ts          # Node containers
│   ├── Port.ts           # Connection points
│   ├── TextLabel.ts      # Text rendering
│   ├── NodeImage.ts      # Node icons/images
│   ├── nodes/            # Concrete node types
│   │   ├── RectangleNode.ts
│   │   ├── CircleNode.ts
│   │   ├── DiamondNode.ts
│   │   └── CustomShapeNode.ts
│   ├── composite/        # Composite nodes (0.6.x)
│   │   ├── CompositeNode.ts
│   │   ├── CComponent.ts / CContainer.ts / CText.ts / CIcon.ts / …
│   │   ├── FlexLayout.ts
│   │   └── deserialize.ts
│   └── paths/            # Edge path strategies
│       ├── PathStrategy.ts
│       ├── StraightPathStrategy.ts
│       ├── PolylinePathStrategy.ts
│       └── BezierPathStrategy.ts
├── events/               # Event system
│   ├── EventEmitter.ts   # Type-safe event emitter
│   └── InputHandler.ts   # Mouse/touch/wheel handling
├── styles/               # Theming
│   └── StyleManager.ts   # Theme and style class management
└── utils/                # Utilities
    ├── Serializer.ts     # JSON save/load
    ├── ImageExporter.ts  # PNG export
    ├── SvgExporter.ts    # SVG export
    ├── AutoLayout.ts     # Automatic layout algorithms
    ├── AutoRouting.ts    # Edge routing
    ├── AlignDistribute.ts# Alignment/distribution
    ├── geometry.ts       # Geometric calculations
    ├── style.ts          # Style utilities (incl. applyStyleManagerToElements)
    ├── contentBounds.ts  # Content boundary calculation
    └── download.ts
```

## Build Commands

```bash
# Development
npm run dev              # Start Vite dev server

# Building
npm run build            # Full build: TSC + Vite (outputs to dist/)
npm run prepublishOnly   # Runs build before publishing
npm run pack:check       # Dry-run npm pack

# Type Checking
npm run typecheck        # TypeScript check without emit

# Testing
npm run test             # Run tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run with coverage (thresholds from vitest.config.ts: lines 48, functions 48, branches 39, statements 48)

# Code Quality
npm run lint             # ESLint on src/
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting

# Local Server for Examples
npm run serve            # Serve at localhost:3000/examples/
```

## Architecture Patterns

### 1. Dirty Flag Rendering
Elements track `_dirty` flag for render optimization. The render loop only redraws when dirty.

```typescript
// In Element base class
markDirty(): void {
  this._dirty = true;
  this._dirtyListener?.();  // Notifies DiagramRenderer
}
```

### 2. Strategy Pattern for Edge Paths
Edge rendering uses pluggable path strategies:

```typescript
interface PathStrategy {
  calculatePath(from: Point, to: Point, options?: PathStrategyOptions): PathResult;
}
// Implementations: StraightPathStrategy, PolylinePathStrategy, BezierPathStrategy
```

### 3. Command Pattern for History
All undoable operations are commands:

```typescript
interface Command {
  execute(): void;
  undo(): void;
}
// See: src/core/history/commands.ts
```

### 4. Plugin Architecture
Overlays and extensions implement `DiagramPlugin`:

```typescript
interface DiagramPlugin {
  name?: string;
  install(renderer: DiagramRenderer): void;
  destroy?(renderer: DiagramRenderer): void;
}
// Usage: renderer.use(new GridOverlay({ gridSize: 20 }))
```

### 5. Coordinate System
World coordinates (diagram space) vs Screen coordinates (canvas pixels):

```typescript
screenToWorld(screenX: number, screenY: number): Point
worldToScreen(worldX: number, worldY: number): Point
```

### 6. Event Emitter Pattern
Type-safe event system used throughout:

```typescript
class DiagramRenderer extends EventEmitter<DiagramEvents> {
  // Emits: 'render', 'zoom', 'pan', 'select', 'nodeAdd', etc.
}
```

## Code Style Guidelines

### TypeScript Configuration
- **Strict mode**: Enabled with `noUncheckedIndexedAccess`
- **Path alias**: `@/*` → `src/*`
- **Explicit return types**: Required for all public APIs (enforced by ESLint)
- **No `any` types**: Forbidden in production code
- **No console**: Warned in production code

### ESLint Rules (from `eslint.config.js`)
```javascript
'@typescript-eslint/explicit-function-return-type': 'error'
'@typescript-eslint/no-explicit-any': 'error'
'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
'no-console': 'warn'
```

### Test File Exceptions
Test files (`*.test.ts`) have relaxed rules:
- No explicit return type required
- `any` type allowed
- Type-aware rules disabled

### Prettier Configuration
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

## Testing Strategy

### Test File Location
Tests are colocated with source files: `*.test.ts` alongside `*.ts`

### Running Tests
```bash
# Single test file
npx vitest run src/utils/Serializer.test.ts

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage  # thresholds from vitest.config.ts: lines 48, functions 48, branches 39, statements 48
```

### Test Environment
- **Runner**: Vitest with globals enabled
- **Environment**: jsdom (for DOM APIs)
- **Coverage**: v8 provider

### Test Utilities
Shared test utilities in `src/test/testUtils.ts`

## Development Conventions

### Adding New Features

1. **New Element Type**: Extend `Node` or `Element`, implement `render()` and `hitTest()`
2. **New Interaction**: Add manager in `core/`, integrate with `InteractionManager`
3. **New Overlay**: Implement `DiagramPlugin`, use `renderer.addOverlayRenderer()`
4. **New Utility**: Add to `utils/`, export from `index.ts`

### ID Generation
Elements use prefix-based IDs:
```typescript
generateId('node')  // "node_1", "node_2", ...
```

### State Management
- Use private fields with underscore prefix (`_dirty`)
- Expose getters/setters for reactive properties
- Call `markDirty()` on state changes

### Style System
- `StyleManager` applies themes
- Elements can have `styleClass` for custom styling
- Style precedence: Theme defaults → styleClass → element.style overrides

## Key Entry Points

### For Users
```typescript
import { DiagramRenderer, RectangleNode, Edge } from '@ngroznykh/papirus';

const renderer = new DiagramRenderer('#canvas', { width: 900, height: 600 });
renderer.addNode(new RectangleNode({ x: 100, y: 100, width: 120, height: 60 }));
renderer.enableInteractions();
```

### Internal Module Imports
Always use path aliases:
```typescript
import { EventEmitter } from '@/events/EventEmitter';
import type { Point } from '@/types';
```

## Build Output

The build produces:
- `dist/papirus.js` - ES module bundle
- `dist/index.d.ts` - TypeScript declarations
- `dist/*.d.ts.map` - Declaration source maps
- Source maps for debugging

## Framework Integration

Papirus is framework-agnostic and can be integrated into Vue/React/Svelte/vanilla apps from the application side.

## Documentation

- Docs index: `docs/README.md`
- API overview: `docs/api.md`
- Composite nodes: `docs/composite.md`
- Elements: `docs/elements.md`
- Renderer: `docs/renderer.md`
- Interactions: `docs/interactions.md`
- Input: `docs/input.md`
- Search: `docs/search.md`
- Overlays: `docs/overlays.md`
- Utils: `docs/utils.md`
- Examples: `examples/index.html`

## Security Considerations

- No external runtime dependencies
- Canvas operations are client-side only
- Export utilities generate data URLs/SVG strings
- See `SECURITY.md` for vulnerability reporting

## License Notes

This is dual-licensed software:
- Open source: AGPL-3.0-or-later
- Commercial: Available for proprietary use

Contributions are accepted under AGPL-3.0-or-later unless explicitly agreed otherwise.
