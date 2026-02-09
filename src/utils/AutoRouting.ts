import type { DiagramRenderer } from '@/core/DiagramRenderer';
import type { Point } from '@/types';

export interface AutoRoutingOptions {
  type?: 'straight' | 'polyline' | 'bezier';
}

/**
 * Basic edge auto-routing
 */
export class AutoRouting {
  apply(renderer: DiagramRenderer, options: AutoRoutingOptions = {}): void {
    const type = options.type ?? 'polyline';

    for (const edge of renderer.edges.values()) {
      edge.type = type;

      const fromNode = renderer.getNode(edge.from.nodeId);
      const toNode = renderer.getNode(edge.to.nodeId);
      if (!fromNode || !toNode) continue;

      const fromPoint: Point =
        edge.from.portId !== undefined
          ? fromNode.getPortPosition(edge.from.portId) ?? fromNode.getCenter()
          : fromNode.getCenter();
      const toPoint: Point =
        edge.to.portId !== undefined
          ? toNode.getPortPosition(edge.to.portId) ?? toNode.getCenter()
          : toNode.getCenter();

      edge.updateEndpoints(fromPoint, toPoint);
    }

    renderer.markDirty();
  }
}
