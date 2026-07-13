import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { Point, SerializedEdge, SerializedNode } from '@/types';
import type { DiagramSurface } from './DiagramSurface';
import type { HistoryManager } from './HistoryManager';
import type { SelectionManager } from './SelectionManager';

export interface ClipboardManagerOptions {
  renderer: DiagramSurface;
  selectionManager: SelectionManager;
  historyManager: HistoryManager;
  nodeFactory?: (data: SerializedNode) => Node;
  edgeFactory?: (data: SerializedEdge) => Edge;
}

interface ClipboardContents {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export class ClipboardManager {
  private readonly renderer: DiagramSurface;
  private readonly selectionManager: SelectionManager;
  private readonly historyManager: HistoryManager;
  private readonly nodeFactory?: (data: SerializedNode) => Node;
  private readonly edgeFactory?: (data: SerializedEdge) => Edge;
  private clipboard: ClipboardContents | null = null;

  constructor(options: ClipboardManagerOptions) {
    this.renderer = options.renderer;
    this.selectionManager = options.selectionManager;
    this.historyManager = options.historyManager;
    this.nodeFactory = options.nodeFactory;
    this.edgeFactory = options.edgeFactory;
  }

  copySelection(): void {
    const selectedIds = new Set(this.selectionManager.selectedIds);
    if (selectedIds.size === 0) {
      return;
    }

    const nodes: SerializedNode[] = [];
    const edges: SerializedEdge[] = [];
    const nodeIds = new Set<string>();

    for (const id of selectedIds) {
      const node = this.renderer.getNode(id);
      if (node) {
        nodes.push({
          id: node.id,
          type: node.typeName,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          style: node.style,
          styleClass: node.styleClass,
          label: node.label?.text,
          labelStyleClass: node.label?.styleClass,
          ports: node.ports.map((port) => ({
            id: port.id,
            type: port.type,
            position: port.position,
            styleClass: port.styleClass,
          })),
          data: Object.keys(node.data).length > 0 ? node.data : undefined,
        });
        nodeIds.add(node.id);
      }
    }

    for (const edge of this.renderer.edges.values()) {
      if (nodeIds.has(edge.from.nodeId) && nodeIds.has(edge.to.nodeId)) {
        edges.push({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          type: edge.type,
          controlPoints: edge.controlPoints,
          arrowType: edge.arrowType,
          style: edge.style,
          styleClass: edge.styleClass,
          label: edge.label?.text,
          labelStyleClass: edge.label?.styleClass,
          labelOffset: edge.labelOffset !== 0 ? edge.labelOffset : undefined,
          labelBackground: edge.labelBackground,
          labelLineGap: edge.labelLineGap ? true : undefined,
          data: Object.keys(edge.data).length > 0 ? edge.data : undefined,
        });
      }
    }

    this.clipboard = { nodes, edges };
  }

  pasteSelection(): void {
    if (!this.clipboard || !this.nodeFactory || !this.edgeFactory) {
      return;
    }

    const offset: Point = { x: 20, y: 20 };
    const idMap = new Map<string, string>();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    for (const nodeData of this.clipboard.nodes) {
      const newId = `${nodeData.id}_copy_${Date.now()}`;
      idMap.set(nodeData.id, newId);
      const copyData: SerializedNode = {
        ...nodeData,
        id: newId,
        x: nodeData.x + offset.x,
        y: nodeData.y + offset.y,
      };
      newNodes.push(this.nodeFactory(copyData));
    }

    for (const edgeData of this.clipboard.edges) {
      const fromNodeId = idMap.get(edgeData.from.nodeId);
      const toNodeId = idMap.get(edgeData.to.nodeId);
      if (!fromNodeId || !toNodeId) {
        continue;
      }
      const newId = `${edgeData.id}_copy_${Date.now()}`;
      const copyEdge: SerializedEdge = {
        ...edgeData,
        id: newId,
        from: { ...edgeData.from, nodeId: fromNodeId },
        to: { ...edgeData.to, nodeId: toNodeId },
      };
      newEdges.push(this.edgeFactory(copyEdge));
    }

    if (newNodes.length === 0 && newEdges.length === 0) {
      return;
    }

    this.historyManager.execute({
      execute: (): void => {
        for (const node of newNodes) {
          this.renderer.addNode(node);
        }
        for (const edge of newEdges) {
          this.renderer.addEdge(edge);
        }
      },
      undo: (): void => {
        for (const edge of newEdges) {
          this.renderer.removeEdge(edge.id);
        }
        for (const node of newNodes) {
          this.renderer.removeNode(node.id);
        }
      },
    });
  }
}
