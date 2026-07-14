import { ANCHOR_PORT_PREFIX } from '@/constants';
import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { PathObstacle } from '@/elements/paths';
import type { Point } from '@/types';
import { getDirectionFromOutlineParam } from '@/utils/direction';

export interface EdgeEndpointUpdaterHost {
  getNodes(): ReadonlyMap<string, Node>;
  getEdges(): ReadonlyMap<string, Edge>;
  getNodeObstacles(): PathObstacle[];
}

export class EdgeEndpointUpdater {
  constructor(private readonly host: EdgeEndpointUpdaterHost) {}

  updateForDrag(): void {
    this.update(false);
  }

  updateAll(): void {
    this.update(true);
  }

  private update(includeRoutingObstacles: boolean): void {
    const obstacles = includeRoutingObstacles ? this.host.getNodeObstacles() : undefined;
    const nodes = this.host.getNodes();
    for (const edge of this.host.getEdges().values()) {
      if (!edge.autoUpdateEndpoints) continue;
      const fromNode = nodes.get(edge.from.nodeId);
      const toNode = nodes.get(edge.to.nodeId);
      if (!fromNode || !toNode) continue;

      if (includeRoutingObstacles) {
        this.lockAnchors(edge, fromNode, toNode);
      }
      const from = this.resolveEndpoint(fromNode, edge.from.portId, edge.from.outlineParam);
      const to = this.resolveEndpoint(toNode, edge.to.portId, edge.to.outlineParam);
      edge.updateEndpoints(
        from.point,
        to.point,
        from.direction,
        to.direction,
        obstacles ? { obstacles } : undefined
      );
    }
  }

  private lockAnchors(edge: Edge, fromNode: Node, toNode: Node): void {
    if (edge.lockAnchors && edge.from.outlineParam === undefined && !edge.from.portId) {
      const anchor = fromNode.getNearestAnchor(toNode.getCenter());
      if (anchor) edge.from = { ...edge.from, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
    }
    if (edge.lockAnchors && edge.to.outlineParam === undefined && !edge.to.portId) {
      const anchor = toNode.getNearestAnchor(fromNode.getCenter());
      if (anchor) edge.to = { ...edge.to, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
    }
  }

  private resolveEndpoint(
    node: Node,
    portId: string | undefined,
    outlineParam: number | undefined
  ): { point: Point; direction?: string } {
    if (portId) {
      const anchorId = portId.slice(ANCHOR_PORT_PREFIX.length);
      const point = node.getAnchorPointById(anchorId);
      return point ? { point, direction: anchorId.split(':')[0] } : { point: node.getCenter() };
    }
    if (outlineParam !== undefined) {
      return {
        point: node.getConnectionPointAtOutlineParam(outlineParam),
        direction: getDirectionFromOutlineParam(outlineParam),
      };
    }
    return { point: node.getCenter() };
  }
}
