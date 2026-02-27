# Papirus — Context for AI Assistants

## Project Overview

**Papirus** is a TypeScript library for building interactive 2D diagrams and flowcharts on HTML Canvas. It is framework-agnostic with zero runtime dependencies.

- **Package**: `@ngroznykh/papirus`
- **Version**: 0.3.18 (0.x — API changes possible)
- **License**: AGPL-3.0-or-later (dual-licensed with commercial option)
- **Node.js**: >=18
- **Entry point**: `src/index.ts`

## Project Structure

```
src/
  core/         # DiagramRenderer, InteractionManager, HistoryManager, overlays (plugins)
  elements/     # Element, Node, Edge, Group + concrete node types
  events/       # EventEmitter, InputHandler (mouse/touch/wheel)
  styles/       # StyleManager, themes (DEFAULT_THEME, DARK_THEME)
  utils/        # Serializer, ImageExporter, SvgExporter, AutoLayout, AutoRouting
  test/         # Test utilities
  index.ts      # Public API exports
  types.ts      # Shared types (Point, Size, Bounds, etc.)
  constants.ts  # Global constants
```

## Architecture

### Core Layer (`src/core/`)
- **DiagramRenderer**: Main orchestrator — canvas management, coordinate system (world/screen), zoom/pan, render loop via `requestAnimationFrame`
- **InteractionManager**: Composes specialized managers (Selection, Drag, Resize, Navigation, Connection, History)
- **HistoryManager**: Undo/redo using Command pattern (`src/core/history/commands.ts`)
- **Overlays**: Plugin-based visual enhancements (`GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`)

### Elements Layer (`src/elements/`)
```
Element (abstract) — base with state, style, bounds, dirty flag, hit testing
├── Node (abstract) — ports, labels, icons, anchor points
│   ├── RectangleNode, CircleNode, DiamondNode, CustomShapeNode
├── Edge — connections with path strategies (straight, polyline, bezier)
└── Group — container for organizing nodes
```

### Key Patterns
1. **Dirty Flag**: Elements track `_dirty` for render optimization
2. **Strategy Pattern**: `PathStrategy` interface for edge rendering
3. **Factory Pattern**: `NodeFactory`/`EdgeFactory` in Serializer
4. **Plugin Architecture**: `renderer.use(new GridOverlay())` — plugins implement `DiagramPlugin`
5. **Coordinate System**: World (diagram space) vs Screen (canvas pixels) with `screenToWorld()`/`worldToScreen()`

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
npm run format:check     # Check Prettier formatting
```

Run a single test file:
```bash
npx vitest run src/utils/Serializer.test.ts
```

## Development Conventions

### TypeScript
- Strict mode enabled with `noUncheckedIndexedAccess`
- Path alias: `@/*` → `src/*`
- Explicit return types required for public APIs
- No `any` types allowed

### ESLint (`eslint.config.js`)
- `@typescript-eslint/explicit-function-return-type`: error
- `@typescript-eslint/no-explicit-any`: error
- `no-console`: warn
- Test files (`*.test.ts`) have relaxed rules (no explicit return types, `any` allowed)

### Testing (`vitest.config.ts`)
- Test files: `src/**/*.test.ts` (colocated with source)
- Environment: `jsdom`
- Coverage threshold: 80% (lines, functions, branches, statements)

### Code Style
- Prettier for formatting
- Conventional Commits for commit messages:
  - `feat:` — new functionality
  - `fix:` — bug fix
  - `docs:` — documentation update
  - `test:` — test update
  - `refactor:` — behavior-preserving refactor

## Example Usage

```typescript
import { DiagramRenderer, RectangleNode, Edge, GridOverlay } from '@ngroznykh/papirus';

const renderer = new DiagramRenderer('#canvas', { width: 900, height: 600 });
const node = new RectangleNode({ x: 100, y: 100, width: 120, height: 60, label: 'Start' });
renderer.addNode(node);
renderer.enableInteractions();
renderer.use(new GridOverlay({ gridSize: 20 }));
```

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Public API exports |
| `src/core/DiagramRenderer.ts` | Main renderer orchestrator |
| `src/core/InteractionManager.ts` | Interaction composition |
| `src/elements/Node.ts` | Base node class |
| `src/elements/Edge.ts` | Edge with path strategies |
| `src/utils/Serializer.ts` | JSON serialization |
| `src/styles/StyleManager.ts` | Theming system |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `vitest.config.ts` | Test configuration |
| `eslint.config.js` | Linting rules |

## Documentation

- `docs/README.md` — Documentation index
- `docs/api.md` — API overview
- `docs/elements.md` — Elements reference
- `docs/interactions.md` — Interaction managers
- `docs/overlays.md` — Overlay plugins
- `examples/index.html` — Interactive demo

## Release Process

See `MEMORY.md` for the release playbook. Key steps:
1. `npm version X.Y.Z --no-git-tag-version`
2. Update `CHANGELOG.md`
3. Run `npm run typecheck && npm run build`
4. Commit and tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z."`
5. Publish: `npm publish`
