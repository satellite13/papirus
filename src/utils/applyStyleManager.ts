import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { Node } from '@/elements/Node';
import type { StyleManager } from '@/styles/StyleManager';

export function applyStyleManagerToElements(
  styleManager: StyleManager | null | undefined,
  groups: Iterable<Group>,
  edges: Iterable<Edge>,
  nodes: Iterable<Node>
): void {
  if (!styleManager) {
    return;
  }

  for (const group of groups) {
    group.applyStyleManager(styleManager);
  }

  for (const edge of edges) {
    edge.applyStyleManager(styleManager);
  }

  for (const node of nodes) {
    node.applyStyleManager(styleManager);
  }
}
