import type { DiagramRenderer } from '@/core/DiagramRenderer';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';

export interface ElementIteratorOptions {
  /** Include only visible elements (default: false) */
  visibleOnly?: boolean;
  /** Include groups in iteration (default: true) */
  includeGroups?: boolean;
  /** Include edges in iteration (default: true) */
  includeEdges?: boolean;
  /** Include nodes in iteration (default: true) */
  includeNodes?: boolean;
}

/**
 * Get all diagram elements in render order (groups -> edges -> nodes)
 */
export function* getAllElements(
  renderer: DiagramRenderer,
  options: ElementIteratorOptions = {}
): IterableIterator<Group | Edge | Node> {
  const {
    visibleOnly = false,
    includeGroups = true,
    includeEdges = true,
    includeNodes = true,
  } = options;

  if (includeGroups) {
    for (const group of renderer.groups.values()) {
      if (!visibleOnly || group.visible) {
        yield group;
      }
    }
  }

  if (includeEdges) {
    for (const edge of renderer.edges.values()) {
      if (!visibleOnly || edge.visible) {
        yield edge;
      }
    }
  }

  if (includeNodes) {
    for (const node of renderer.nodes.values()) {
      if (!visibleOnly || node.visible) {
        yield node;
      }
    }
  }
}

/**
 * Get only visible elements in render order
 */
export function* getVisibleElements(
  renderer: DiagramRenderer
): IterableIterator<Group | Edge | Node> {
  yield* getAllElements(renderer, { visibleOnly: true });
}

/**
 * Get only nodes
 */
export function* getNodes(
  renderer: DiagramRenderer,
  options: { visibleOnly?: boolean } = {}
): IterableIterator<Node> {
  const { visibleOnly = false } = options;
  for (const node of renderer.nodes.values()) {
    if (!visibleOnly || node.visible) {
      yield node;
    }
  }
}

/**
 * Get only edges
 */
export function* getEdges(
  renderer: DiagramRenderer,
  options: { visibleOnly?: boolean } = {}
): IterableIterator<Edge> {
  const { visibleOnly = false } = options;
  for (const edge of renderer.edges.values()) {
    if (!visibleOnly || edge.visible) {
      yield edge;
    }
  }
}

/**
 * Get only groups
 */
export function* getGroups(
  renderer: DiagramRenderer,
  options: { visibleOnly?: boolean } = {}
): IterableIterator<Group> {
  const { visibleOnly = false } = options;
  for (const group of renderer.groups.values()) {
    if (!visibleOnly || group.visible) {
      yield group;
    }
  }
}

/**
 * Apply a function to all elements
 */
export function forEachElement(
  renderer: DiagramRenderer,
  fn: (element: Group | Edge | Node) => void,
  options: ElementIteratorOptions = {}
): void {
  for (const element of getAllElements(renderer, options)) {
    fn(element);
  }
}
