import { ANCHOR_PORT_PREFIX } from '@/constants';
import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { PathObstacle } from '@/elements/paths';
import type { EdgeEndpoint, Point } from '@/types';
import { isEdgeEdgeEndpoint, isNodeEdgeEndpoint } from '@/types';
import { directionFromAngle } from '@/utils/edgePath';
import { getDirectionFromOutlineParam } from '@/utils/direction';
import { routeDebug } from '@/utils/routeDebug';

export interface EdgeEndpointUpdaterHost {
  getNodes(): ReadonlyMap<string, Node>;
  getEdges(): ReadonlyMap<string, Edge>;
  getNodeObstacles(): PathObstacle[];
}

type ResolvedEnd = { point: Point; direction?: string };
type Side = 'top' | 'right' | 'bottom' | 'left';

const EDGE_ATTACH_MAX_PASSES = 3;

export class EdgeEndpointUpdater {
  constructor(private readonly host: EdgeEndpointUpdaterHost) {}

  updateForDrag(): void {
    // Keep obstacle-aware routing while dragging — otherwise polylines fall back to
    // calculateDirectedPath and glue to target contours until drag ends.
    this.update(true);
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
      // Fix left/right locks on a vertical stack (and vice versa) before freezing
      // unset ports — otherwise approachDir follows the side port and the jog
      // crawls along the wide target edge.
      this.preferFacingSidePorts(edge, fromNode, toNode);
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
    routeDebug('updater.nodeNode', {
      edgeId: edge.id,
      type: edge.type,
      includeRoutingObstacles,
      lockAnchors: edge.lockAnchors,
      from: {
        nodeId: fromId,
        portId: edge.from.portId,
        outlineParam: edge.from.outlineParam,
        point: `${Math.round(from.point.x)},${Math.round(from.point.y)}`,
        dir: from.direction,
      },
      to: {
        nodeId: toId,
        portId: edge.to.portId,
        outlineParam: edge.to.outlineParam,
        point: `${Math.round(to.point.x)},${Math.round(to.point.y)}`,
        dir: to.direction,
      },
      obstacleCount: routingObstacles?.length ?? 0,
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
   * When nodes are clearly stacked, retarget unset / OEF-lateral ports toward
   * facing sides. Intentional same-side wraps (bottom→bottom, top→top, left→left)
   * are kept — orthogonal routing clears them around the stack.
   *
   * Uses bounding-box gaps (not center dx/dy): a large horizontal offset must not
   * flip bottom→left while the source is still below the target — that reintroduces
   * the left-edge contour jog when the user drags the node leftward.
   *
   * - Works for portId and outlineParam (OEF / attach-to-outline).
   * - Does NOT move an endpoint that is already on a chosen side — otherwise
   *   dragging a locked/outline anchor snaps back on every updateAll.
   * - Keeps intentional source left/right exits for nest wrap around a parent.
   */
  private preferFacingSidePorts(edge: Edge, fromNode: Node, toNode: Node): void {
    if (!edge.lockAnchors) return;
    if (!isNodeEdgeEndpoint(edge.from) || !isNodeEdgeEndpoint(edge.to)) return;

    const fromB = fromNode.getBounds();
    const toB = toNode.getBounds();
    // Positive = clear gap with `from` on that side of `to`.
    const fromBelow = fromB.y - (toB.y + toB.height);
    const fromAbove = toB.y - (fromB.y + fromB.height);
    const fromRight = fromB.x - (toB.x + toB.width);
    const fromLeft = toB.x - (fromB.x + fromB.width);

    const fc = fromNode.getCenter();
    const tc = toNode.getCenter();
    const curFrom = this.endpointSide(edge.from, fromNode);
    const curTo = this.endpointSide(edge.to, toNode);

    if (fromBelow > 0 || fromAbove > 0) {
      const fromSide: Side = fromBelow > 0 ? 'top' : 'bottom';
      const toSide: Side = fromBelow > 0 ? 'bottom' : 'top';
      // Port-locked lateral (OEF) → facing. Outline lateral is a user reconnect — keep it.
      const toOutlineLateral =
        (curTo === 'left' || curTo === 'right') &&
        isNodeEdgeEndpoint(edge.to) &&
        edge.to.outlineParam !== undefined;
      const toPortLateral =
        (curTo === 'left' || curTo === 'right') && !toOutlineLateral;

      if (!curFrom) {
        this.setEndpointSidePort(edge, 'from', fromNode, fromSide, tc);
      }
      if (!curTo || toPortLateral) {
        this.setEndpointSidePort(edge, 'to', toNode, toSide, fc);
      }
      return;
    }

    if (fromLeft > 0 || fromRight > 0) {
      const fromSide: Side = fromRight > 0 ? 'left' : 'right';
      const toSide: Side = fromRight > 0 ? 'right' : 'left';
      // Port-locked vertical (OEF) → facing. Outline top/bottom is user reconnect.
      const toOutlineVertical =
        (curTo === 'top' || curTo === 'bottom') &&
        isNodeEdgeEndpoint(edge.to) &&
        edge.to.outlineParam !== undefined;
      const toPortVertical =
        (curTo === 'top' || curTo === 'bottom') && !toOutlineVertical;

      if (!curFrom) {
        this.setEndpointSidePort(edge, 'from', fromNode, fromSide, tc);
      }
      // Only lateralize when there is no vertical gap (handled above). Never flip
      // a facing bottom/top while boxes are still stacked — that was the left-drag bug.
      // Keep user outline on the far side (wrap-around); rewrite port-locked vertical only.
      if (!curTo || toPortVertical) {
        this.setEndpointSidePort(edge, 'to', toNode, toSide, fc);
      }
    }
  }

  private portSide(portId: string | undefined): Side | undefined {
    if (!portId?.startsWith(ANCHOR_PORT_PREFIX)) return undefined;
    const side = portId.slice(ANCHOR_PORT_PREFIX.length).split(':')[0];
    if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
      return side;
    }
    return undefined;
  }

  private endpointSide(endpoint: EdgeEndpoint, node: Node): Side | undefined {
    if (!isNodeEdgeEndpoint(endpoint)) return undefined;
    const fromPort = this.portSide(endpoint.portId);
    if (fromPort) return fromPort;
    if (endpoint.outlineParam === undefined) return undefined;
    return getDirectionFromOutlineParam(endpoint.outlineParam, node.getBounds());
  }

  private nearestAnchorOnSide(
    node: Node,
    side: Side,
    toward: Point
  ): { id: string; point: Point } | null {
    const anchors = node.getAnchors().filter((a) => a.id.startsWith(`${side}:`));
    if (anchors.length === 0) return null;
    let best = anchors[0]!;
    let minDist = Infinity;
    for (const anchor of anchors) {
      const dist = (anchor.point.x - toward.x) ** 2 + (anchor.point.y - toward.y) ** 2;
      if (dist < minDist) {
        minDist = dist;
        best = anchor;
      }
    }
    return best;
  }

  private setEndpointSidePort(
    edge: Edge,
    end: 'from' | 'to',
    node: Node,
    side: Side,
    toward: Point
  ): void {
    const anchor = this.nearestAnchorOnSide(node, side, toward);
    if (!anchor) return;
    const next = {
      ...(end === 'from' ? edge.from : edge.to),
      portId: `${ANCHOR_PORT_PREFIX}${anchor.id}`,
      outlineParam: undefined,
    };
    if (end === 'from') {
      edge.from = next;
    } else {
      edge.to = next;
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
      const bounds = node.getBounds();
      return {
        point: node.getConnectionPointAtOutlineParam(endpoint.outlineParam),
        direction: getDirectionFromOutlineParam(endpoint.outlineParam, bounds),
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
