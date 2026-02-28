import type { DiagramRenderer } from '@/core/DiagramRenderer';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type {
  DiagramData,
  SerializedNode,
  SerializedEdge,
  SerializedGroup,
  SerializedPort,
  SerializedNodeIcon,
  SerializedAnchorPoints,
  SerializedTextLabel,
} from '@/types';
import { omitDefaultValues, omitEmptyValues, hasNonDefaultValues } from './omitDefaults';

const SERIALIZER_VERSION = '1.1';

/**
 * Validation error during deserialization
 */
export class SerializerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializerValidationError';
  }
}

export interface NodeFactory {
  (data: SerializedNode): Node;
}

export interface EdgeFactory {
  (data: SerializedEdge): Edge;
}

export interface GroupFactory {
  (data: SerializedGroup): Group;
}

export interface SerializerOptions {
  nodeFactory: NodeFactory;
  edgeFactory: EdgeFactory;
  groupFactory?: GroupFactory;
}

/**
 * Serializes and deserializes diagram data
 */
export class Serializer {
  private renderer: DiagramRenderer;
  private readonly nodeFactory: NodeFactory;
  private readonly edgeFactory: EdgeFactory;
  private readonly groupFactory?: GroupFactory;

  constructor(renderer: DiagramRenderer, options: SerializerOptions) {
    this.renderer = renderer;
    this.nodeFactory = options.nodeFactory;
    this.edgeFactory = options.edgeFactory;
    this.groupFactory = options.groupFactory;
  }

  /**
   * Serialize the diagram to JSON-compatible data
   */
  serialize(): DiagramData {
    const styleManager = this.renderer.getStyleManager();
    const nodes: SerializedNode[] = [];
    const edges: SerializedEdge[] = [];
    const groups: SerializedGroup[] = [];

    // Serialize nodes
    for (const node of this.renderer.nodes.values()) {
      nodes.push(this.serializeNode(node));
    }

    // Serialize edges
    for (const edge of this.renderer.edges.values()) {
      edges.push(this.serializeEdge(edge));
    }

    // Serialize groups
    for (const group of this.renderer.groups.values()) {
      groups.push(this.serializeGroup(group));
    }

    return {
      version: SERIALIZER_VERSION,
      nodes,
      edges,
      groups,
      viewport: { ...this.renderer.viewport },
      theme: styleManager?.theme,
      styleClasses: styleManager?.getClasses(),
    };
  }

  /**
   * Serialize to JSON string
   */
  toJSON(pretty = false): string {
    const data = this.serialize();
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  /**
   * Deserialize data and populate the diagram
   */
  deserialize(data: DiagramData): void {
    // Validate data before deserialization
    this.validate(data);

    // Clear existing content
    this.clear();

    // Restore viewport
    this.renderer.viewport = data.viewport;

    // Restore theme and classes if available
    const styleManager = this.renderer.getStyleManager();
    if (styleManager && data.theme) {
      styleManager.setTheme(data.theme);
    }
    if (styleManager && data.styleClasses) {
      for (const styleClass of data.styleClasses) {
        styleManager.registerClass(styleClass);
      }
    }

    // Create nodes
    for (const nodeData of data.nodes) {
      const node = this.nodeFactory(nodeData);
      this.renderer.addNode(node);
    }

    // Create edges
    for (const edgeData of data.edges) {
      const edge = this.edgeFactory(edgeData);
      this.renderer.addEdge(edge);
    }

    // Create groups
    if (this.groupFactory !== undefined) {
      for (const groupData of data.groups) {
        const group = this.groupFactory(groupData);
        this.renderer.addGroup(group);
      }
    }

    this.renderer.markDirty();
  }

  /**
   * Validate diagram data before deserialization
   */
  private validate(data: DiagramData): void {
    if (!data.version) {
      throw new SerializerValidationError('Missing version field in diagram data');
    }

    if (!Array.isArray(data.nodes)) {
      throw new SerializerValidationError('Invalid or missing nodes array');
    }

    if (!Array.isArray(data.edges)) {
      throw new SerializerValidationError('Invalid or missing edges array');
    }

    // Build a set of node IDs for edge validation
    const nodeIds = new Set(data.nodes.map((n) => n.id));

    // Validate edges reference existing nodes
    for (const edge of data.edges) {
      if (!nodeIds.has(edge.from.nodeId)) {
        throw new SerializerValidationError(
          `Edge "${edge.id}" references non-existent source node "${edge.from.nodeId}"`
        );
      }
      if (!nodeIds.has(edge.to.nodeId)) {
        throw new SerializerValidationError(
          `Edge "${edge.id}" references non-existent target node "${edge.to.nodeId}"`
        );
      }
    }
  }

  /**
   * Parse JSON string and deserialize
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json) as DiagramData;
    this.deserialize(data);
  }

  /**
   * Clear the diagram
   */
  clear(): void {
    // Remove all edges first (to avoid orphaned references)
    for (const edge of this.renderer.edges.values()) {
      this.renderer.removeEdge(edge.id);
    }

    // Remove all nodes
    for (const node of this.renderer.nodes.values()) {
      this.renderer.removeNode(node.id);
    }

    // Remove all groups
    for (const group of this.renderer.groups.values()) {
      this.renderer.removeGroup(group.id);
    }
  }

  private serializeNode(node: Node): SerializedNode {
    const ports: SerializedPort[] = node.ports.map((port) => ({
      id: port.id,
      type: port.type,
      position: port.position,
      styleClass: port.styleClass,
    }));

    // Serialize label - full TextLabel if it has more than just text
    let label: string | SerializedTextLabel | undefined;
    if (node.label) {
      const ins = node.label.inset;
      const defaultInset = 8;
      const insetAllDefault =
        ins.top === defaultInset &&
        ins.right === defaultInset &&
        ins.bottom === defaultInset &&
        ins.left === defaultInset;
      const serializedInset = insetAllDefault
        ? undefined
        : ins.top === ins.right && ins.top === ins.bottom && ins.top === ins.left
          ? ins.top
          : { top: ins.top, right: ins.right, bottom: ins.bottom, left: ins.left };

      const labelDefaults = { inset: undefined, style: {}, maxWidth: undefined, styleClass: undefined };
      const labelData = {
        text: node.label.text,
        style: node.label.style,
        maxWidth: node.label.maxWidth,
        inset: serializedInset ?? undefined,
        styleClass: node.label.styleClass,
      };
      const hasExtendedOptions = hasNonDefaultValues(labelData, labelDefaults);

      if (hasExtendedOptions) {
        label = omitEmptyValues({
          text: node.label.text,
          style: Object.keys(node.label.style).length > 0 ? node.label.style : undefined,
          maxWidth: node.label.maxWidth,
          inset: serializedInset,
          styleClass: node.label.styleClass,
        }) as SerializedTextLabel | undefined;
      } else {
        label = node.label.text;
      }
    }

    // Serialize icon
    let icon: SerializedNodeIcon | undefined;
    if (node.icon) {
      const opts = node.icon.options;
      const source = typeof opts.source === 'string' ? opts.source : undefined;
      if (source) {
        icon = omitEmptyValues({
          source,
          width: opts.width,
          height: opts.height,
          fit: opts.fit,
          placement: opts.placement,
          scaleWithBounds: opts.scaleWithBounds,
          inset: node.icon.inset !== 6 ? node.icon.inset : undefined,
          opacity: opts.opacity,
        }) as SerializedNodeIcon;
      }
    }

    // Serialize anchor points if non-default
    let anchorPoints: SerializedAnchorPoints | undefined;
    const ap = node.anchorPoints;
    const anchorDefaults = { top: 1, right: 1, bottom: 1, left: 1 };
    const anchorData = { top: ap.top, right: ap.right, bottom: ap.bottom, left: ap.left };
    if (hasNonDefaultValues(anchorData, anchorDefaults)) {
      anchorPoints = omitDefaultValues(anchorData, anchorDefaults);
    }

    const contentInset = node.contentInset;
    const hasContentInset =
      contentInset.top !== 0 ||
      contentInset.right !== 0 ||
      contentInset.bottom !== 0 ||
      contentInset.left !== 0;

    return omitEmptyValues({
      id: node.id,
      type: node.typeName,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      style: node.style,
      styleClass: node.styleClass,
      label,
      labelStyleClass: typeof label === 'string' ? node.label?.styleClass : undefined,
      icon,
      contentInset: hasContentInset ? contentInset : undefined,
      anchorPoints,
      ports: ports.length > 0 ? ports : undefined,
      data: Object.keys(node.data).length > 0 ? node.data : undefined,
    }) as SerializedNode;
  }

  private serializeEdge(edge: Edge): SerializedEdge {
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      controlPoints: edge.controlPoints,
      arrowType: edge.arrowType,
      startMarker: edge.startMarker,
      endMarker: edge.endMarker,
      style: edge.style,
      styleClass: edge.styleClass,
      label: edge.label?.text,
      labelStyleClass: edge.label?.styleClass,
      labelOffset: edge.labelOffset !== 0 ? edge.labelOffset : undefined,
      labelBackground: edge.labelBackground,
      data: Object.keys(edge.data).length > 0 ? edge.data : undefined,
    };
  }

  private serializeGroup(group: Group): SerializedGroup {
    return {
      id: group.id,
      childIds: group.children.map((c) => c.id),
      style: group.style,
      styleClass: group.styleClass,
      label: group.label,
      data: Object.keys(group.data).length > 0 ? group.data : undefined,
    };
  }
}
