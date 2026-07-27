import { ANCHOR_PORT_PREFIX } from '@/constants';
import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { PathObstacle } from '@/elements/paths';
import type { EdgeEndpoint, Point } from '@/types';
import { isEdgeEdgeEndpoint, isNodeEdgeEndpoint } from '@/types';
import { directionFromAngle } from '@/utils/edgePath';
import { getDirectionFromOutlineParam } from '@/utils/direction';

export interface EdgeEndpointUpdaterHost {
  getNodes(): ReadonlyMap<string, Node>;
  getEdges(): ReadonlyMap<string, Edge>;
  getNodeObstacles(): PathObstacle[];
}

type ResolvedEnd = { point: Point; direction?: string };

const EDGE_ATTACH_MAX_PASSES = 3;

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
    const edges = this.host.getEdges();

    const nodeNode: Edge[] = [];
    const edgeAttached: Edge[] = [];
    for (const edge of edges.values()) {
      if (!edge.autoUpdateEndpoints) continue;
      if (isEdgeEdgeEndpoint(edge.from) || isEdgeEdgeEndpoint(edge.to)) {
        edgeAttached.push(edge);
      } else {
        nodeNode.push(edge);
      }
    }

    for (const edge of nodeNode) {
      this.updateNodeNodeEdge(edge, nodes, includeRoutingObstacles, obstacles);
    }

    for (let pass = 0; pass < EDGE_ATTACH_MAX_PASSES; pass++) {
      let changed = false;
      for (const edge of edgeAttached) {
        if (this.updateEdgeAttachedEdge(edge, nodes, edges, obstacles)) {
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  private updateNodeNodeEdge(
    edge: Edge,
    nodes: ReadonlyMap<string, Node>,
    includeRoutingObstacles: boolean,
    obstacles: PathObstacle[] | undefined
  ): void {
    if (!isNodeEdgeEndpoint(edge.from) || !isNodeEdgeEndpoint(edge.to)) return;
    const fromNode = nodes.get(edge.from.nodeId);
    const toNode = nodes.get(edge.to.nodeId);
    if (!fromNode || !toNode) return;

    if (includeRoutingObstacles) {
      this.lockAnchors(edge, fromNode, toNode);
    }
    const from = this.resolveNodeEndpoint(fromNode, edge.from, toNode.getCenter(), edge.lockAnchors);
    const to = this.resolveNodeEndpoint(toNode, edge.to, fromNode.getCenter(), edge.lockAnchors);
    // Keep source as role:source (avoid re-entering after exit), target as role:target.
    // Parent containers stay as other/containing obstacles for around-routing.
    const fromId = edge.from.nodeId;
    const toId = edge.to.nodeId;
    const routingObstacles = obstacles?.map((obstacle) => {
      if (obstacle.id === fromId) return { ...obstacle, role: 'source' as const };
      if (obstacle.id === toId) return { ...obstacle, role: 'target' as const };
      return obstacle;
    });
    edge.updateEndpoints(
      from.point,
      to.point,
      from.direction,
      to.direction,
      routingObstacles ? { obstacles: routingObstacles } : undefined
    );
  }

  /**
   * @returns true when the resolved geometry changed enough to warrant another pass
   */
  private updateEdgeAttachedEdge(
    edge: Edge,
    nodes: ReadonlyMap<string, Node>,
    edges: ReadonlyMap<string, Edge>,
    obstacles: PathObstacle[] | undefined
  ): boolean {
    // Resolve path-attached ends first so floating node ends can aim at them.
    const fromEdge = isEdgeEdgeEndpoint(edge.from)
      ? this.resolveEdgeEndpoint(edge.from, edges)
      : null;
    const toEdge = isEdgeEdgeEndpoint(edge.to) ? this.resolveEdgeEndpoint(edge.to, edges) : null;

    const from =
      fromEdge ??
      (isNodeEdgeEndpoint(edge.from)
        ? this.resolveNodeEnd(edge.from, nodes, toEdge?.point, edge.lockAnchors)
        : null);
    const to =
      toEdge ??
      (isNodeEdgeEndpoint(edge.to)
        ? this.resolveNodeEnd(edge.to, nodes, from?.point, edge.lockAnchors)
        : null);
    if (!from || !to) return false;

    const before = edge.path;
    const beforeKey =
      before.length >= 2
        ? `${before[0]!.x},${before[0]!.y}:${before[before.length - 1]!.x},${before[before.length - 1]!.y}`
        : '';

    edge.updateEndpoints(
      from.point,
      to.point,
      from.direction,
      to.direction,
      obstacles ? { obstacles } : undefined
    );

    const after = edge.path;
    const afterKey =
      after.length >= 2
        ? `${after[0]!.x},${after[0]!.y}:${after[after.length - 1]!.x},${after[after.length - 1]!.y}`
        : '';
    return beforeKey !== afterKey;
  }

  private resolveNodeEnd(
    endpoint: EdgeEndpoint & { nodeId: string },
    nodes: ReadonlyMap<string, Node>,
    toward: Point | undefined,
    lockAnchors: boolean
  ): ResolvedEnd | null {
    const node = nodes.get(endpoint.nodeId);
    if (!node) return null;
    return this.resolveNodeEndpoint(node, endpoint, toward, lockAnchors);
  }

  private resolveEdgeEndpoint(
    endpoint: EdgeEndpoint & { edgeId: string },
    edges: ReadonlyMap<string, Edge>
  ): ResolvedEnd | null {
    const host = edges.get(endpoint.edgeId);
    if (!host) return null;
    const pathParam = endpoint.pathParam ?? 0.5;
    const at = host.getPointAt(pathParam);
    if (!at) return null;
    return {
      point: at.point,
      direction: directionFromAngle(at.angle),
    };
  }

  private lockAnchors(edge: Edge, fromNode: Node, toNode: Node): void {
    if (
      isNodeEdgeEndpoint(edge.from) &&
      edge.lockAnchors &&
      edge.from.outlineParam === undefined &&
      !edge.from.portId
    ) {
      const anchor = fromNode.getNearestAnchor(toNode.getCenter());
      if (anchor) edge.from = { ...edge.from, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
    }
    if (
      isNodeEdgeEndpoint(edge.to) &&
      edge.lockAnchors &&
      edge.to.outlineParam === undefined &&
      !edge.to.portId
    ) {
      const anchor = toNode.getNearestAnchor(fromNode.getCenter());
      if (anchor) edge.to = { ...edge.to, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
    }
  }

  /**
   * Resolve a node endpoint:
   * - lockAnchors + portId → fixed side port (wins over leftover outlineParam)
   * - outlineParam → fixed point on outline (attach-to-outline)
   * - otherwise → floating nearest port/outline toward the other end
   */
  private resolveNodeEndpoint(
    node: Node,
    endpoint: EdgeEndpoint,
    toward: Point | undefined,
    lockAnchors: boolean
  ): ResolvedEnd {
    if (lockAnchors && isNodeEdgeEndpoint(endpoint) && endpoint.portId) {
      const anchorId = endpoint.portId.slice(ANCHOR_PORT_PREFIX.length);
      const point = node.getAnchorPointById(anchorId);
      if (point) {
        return { point, direction: anchorId.split(':')[0] };
      }
    }

    if (isNodeEdgeEndpoint(endpoint) && endpoint.outlineParam !== undefined) {
      return {
        point: node.getConnectionPointAtOutlineParam(endpoint.outlineParam),
        direction: getDirectionFromOutlineParam(endpoint.outlineParam),
      };
    }

    if (toward) {
      return this.resolveFloatingEndpoint(node, toward);
    }

    return { point: node.getCenter() };
  }

  private resolveFloatingEndpoint(node: Node, toward: Point): ResolvedEnd {
    const anchor = node.getNearestAnchor(toward);
    if (anchor) {
      return { point: anchor.point, direction: anchor.id.split(':')[0] };
    }
    return { point: node.getConnectionPoint(toward) };
  }
}
