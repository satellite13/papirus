import { TextLabel } from '@/elements/TextLabel';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { Node } from '@/elements/Node';
import type {
  ArrowMarkerConfig,
  ArrowType,
  Command,
  EdgeLabelBackground,
  EdgePathType,
  EdgeStyle,
  ElementStyle,
  NodeStyle,
  Point,
  TextStyle,
} from '@/types';

export interface LabelSnapshot {
  text: string;
  editableText?: string;
  style?: TextStyle;
  styleClass?: string;
  maxWidth?: number;
}

export interface NodeSnapshot {
  style: NodeStyle;
  styleClass?: string;
  label?: LabelSnapshot;
  cornerRadius?: number;
  showPortsAlways: boolean;
}

export interface EdgeSnapshot {
  style: EdgeStyle;
  styleClass?: string;
  label?: LabelSnapshot;
  labelOffset: number;
  labelBackground?: EdgeLabelBackground;
  startMarker?: ArrowMarkerConfig;
  endMarker?: ArrowMarkerConfig;
  arrowType: ArrowType;
  type: EdgePathType;
  controlPoints?: Point[];
}

export interface GroupSnapshot {
  style: ElementStyle;
  styleClass?: string;
  label?: string;
  padding: number;
}

const cloneValue = <T>(value: T): T => {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const snapshotLabel = (label?: TextLabel): LabelSnapshot | undefined => {
  if (!label) {
    return undefined;
  }
  return {
    text: label.text,
    editableText: label.editableText,
    style: cloneValue(label.style),
    styleClass: label.styleClass,
    maxWidth: label.maxWidth,
  };
};

const applyLabelSnapshot = (
  current: TextLabel | undefined,
  snapshot?: LabelSnapshot
): TextLabel | undefined => {
  if (!snapshot) {
    return undefined;
  }
  if (current) {
    current.text = snapshot.text;
    current.editableText = snapshot.editableText;
    current.style = snapshot.style ?? {};
    current.styleClass = snapshot.styleClass;
    current.maxWidth = snapshot.maxWidth;
    return current;
  }
  return new TextLabel({
    text: snapshot.text,
    editableText: snapshot.editableText,
    style: snapshot.style,
    styleClass: snapshot.styleClass,
    maxWidth: snapshot.maxWidth,
  });
};

export const createNodeSnapshot = (node: Node): NodeSnapshot => {
  const cornerRadius = 'cornerRadius' in node ? (node as { cornerRadius: number }).cornerRadius : undefined;
  return {
    style: cloneValue(node.styleOverrides as NodeStyle),
    styleClass: node.styleClass,
    label: snapshotLabel(node.label),
    cornerRadius,
    showPortsAlways: node.showPortsAlways,
  };
};

export const createEdgeSnapshot = (edge: Edge): EdgeSnapshot => {
  return {
    style: cloneValue(edge.styleOverrides as EdgeStyle),
    styleClass: edge.styleClass,
    label: snapshotLabel(edge.label),
    labelOffset: edge.labelOffset,
    labelBackground: cloneValue(edge.labelBackground),
    startMarker: cloneValue(edge.startMarker),
    endMarker: cloneValue(edge.endMarker),
    arrowType: edge.arrowType,
    type: edge.type,
    controlPoints: cloneValue(edge.controlPoints),
  };
};

export const createGroupSnapshot = (group: Group): GroupSnapshot => {
  return {
    style: cloneValue(group.styleOverrides as ElementStyle),
    styleClass: group.styleClass,
    label: group.label,
    padding: group.padding,
  };
};

/**
 * Command for moving nodes
 */
export class MoveNodesCommand implements Command {
  private readonly nodePositions: Map<string, { before: { x: number; y: number }; after: { x: number; y: number } }>;
  private readonly getNode: (id: string) => { x: number; y: number } | undefined;

  constructor(
    getNode: (id: string) => { x: number; y: number } | undefined,
    nodePositions: Map<string, { before: { x: number; y: number }; after: { x: number; y: number } }>
  ) {
    this.getNode = getNode;
    this.nodePositions = new Map(nodePositions);
  }

  execute(): void {
    for (const [id, pos] of this.nodePositions) {
      const node = this.getNode(id);
      if (node !== undefined) {
        node.x = pos.after.x;
        node.y = pos.after.y;
      }
    }
  }

  undo(): void {
    for (const [id, pos] of this.nodePositions) {
      const node = this.getNode(id);
      if (node !== undefined) {
        node.x = pos.before.x;
        node.y = pos.before.y;
      }
    }
  }
}

/**
 * Command for adding a node
 */
export class AddNodeCommand implements Command {
  private readonly nodeId: string;
  private readonly addNode: () => void;
  private readonly removeNode: (id: string) => void;

  constructor(nodeId: string, addNode: () => void, removeNode: (id: string) => void) {
    this.nodeId = nodeId;
    this.addNode = addNode;
    this.removeNode = removeNode;
  }

  execute(): void {
    this.addNode();
  }

  undo(): void {
    this.removeNode(this.nodeId);
  }
}

/**
 * Command for removing a node
 */
export class RemoveNodeCommand implements Command {
  private readonly nodeId: string;
  private readonly addNode: () => void;
  private readonly removeNode: (id: string) => void;

  constructor(nodeId: string, addNode: () => void, removeNode: (id: string) => void) {
    this.nodeId = nodeId;
    this.addNode = addNode;
    this.removeNode = removeNode;
  }

  execute(): void {
    this.removeNode(this.nodeId);
  }

  undo(): void {
    this.addNode();
  }
}

/**
 * Composite command for grouping multiple commands
 */
export class CompositeCommand implements Command {
  private readonly commands: Command[];

  constructor(commands: Command[]) {
    this.commands = [...commands];
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]!.undo();
    }
  }
}

/**
 * Command for changing node properties
 */
export class ChangeNodePropertiesCommand implements Command {
  private readonly getNode: (id: string) => Node | undefined;
  private readonly nodeId: string;
  private before: NodeSnapshot;
  private after: NodeSnapshot;

  constructor(
    getNode: (id: string) => Node | undefined,
    nodeId: string,
    before: NodeSnapshot,
    after: NodeSnapshot
  ) {
    this.getNode = getNode;
    this.nodeId = nodeId;
    this.before = cloneValue(before);
    this.after = cloneValue(after);
  }

  execute(): void {
    const node = this.getNode(this.nodeId);
    if (!node) {
      return;
    }
    node.style = cloneValue(this.after.style ?? {});
    node.styleClass = this.after.styleClass;
    node.label = applyLabelSnapshot(node.label, this.after.label);
    node.showPortsAlways = this.after.showPortsAlways;
    if (this.after.cornerRadius !== undefined && 'cornerRadius' in node) {
      (node as { cornerRadius: number }).cornerRadius = this.after.cornerRadius;
    }
  }

  undo(): void {
    const node = this.getNode(this.nodeId);
    if (!node) {
      return;
    }
    node.style = cloneValue(this.before.style ?? {});
    node.styleClass = this.before.styleClass;
    node.label = applyLabelSnapshot(node.label, this.before.label);
    node.showPortsAlways = this.before.showPortsAlways;
    if (this.before.cornerRadius !== undefined && 'cornerRadius' in node) {
      (node as { cornerRadius: number }).cornerRadius = this.before.cornerRadius;
    }
  }
}

/**
 * Command for changing edge properties
 */
export class ChangeEdgePropertiesCommand implements Command {
  private readonly getEdge: (id: string) => Edge | undefined;
  private readonly edgeId: string;
  private before: EdgeSnapshot;
  private after: EdgeSnapshot;

  constructor(
    getEdge: (id: string) => Edge | undefined,
    edgeId: string,
    before: EdgeSnapshot,
    after: EdgeSnapshot
  ) {
    this.getEdge = getEdge;
    this.edgeId = edgeId;
    this.before = cloneValue(before);
    this.after = cloneValue(after);
  }

  execute(): void {
    const edge = this.getEdge(this.edgeId);
    if (!edge) {
      return;
    }
    edge.type = this.after.type;
    edge.controlPoints = cloneValue(this.after.controlPoints);
    edge.arrowType = this.after.arrowType;
    edge.startMarker = cloneValue(this.after.startMarker);
    edge.endMarker = cloneValue(this.after.endMarker);
    edge.labelOffset = this.after.labelOffset;
    edge.labelBackground = cloneValue(this.after.labelBackground);
    edge.style = cloneValue(this.after.style ?? {});
    edge.styleClass = this.after.styleClass;
    edge.label = applyLabelSnapshot(edge.label, this.after.label);
  }

  undo(): void {
    const edge = this.getEdge(this.edgeId);
    if (!edge) {
      return;
    }
    edge.type = this.before.type;
    edge.controlPoints = cloneValue(this.before.controlPoints);
    edge.arrowType = this.before.arrowType;
    edge.startMarker = cloneValue(this.before.startMarker);
    edge.endMarker = cloneValue(this.before.endMarker);
    edge.labelOffset = this.before.labelOffset;
    edge.labelBackground = cloneValue(this.before.labelBackground);
    edge.style = cloneValue(this.before.style ?? {});
    edge.styleClass = this.before.styleClass;
    edge.label = applyLabelSnapshot(edge.label, this.before.label);
  }
}

/**
 * Command for changing group properties
 */
export class ChangeGroupPropertiesCommand implements Command {
  private readonly getGroup: (id: string) => Group | undefined;
  private readonly groupId: string;
  private before: GroupSnapshot;
  private after: GroupSnapshot;

  constructor(
    getGroup: (id: string) => Group | undefined,
    groupId: string,
    before: GroupSnapshot,
    after: GroupSnapshot
  ) {
    this.getGroup = getGroup;
    this.groupId = groupId;
    this.before = cloneValue(before);
    this.after = cloneValue(after);
  }

  execute(): void {
    const group = this.getGroup(this.groupId);
    if (!group) {
      return;
    }
    group.style = cloneValue(this.after.style ?? {});
    group.styleClass = this.after.styleClass;
    group.label = this.after.label;
    group.padding = this.after.padding;
  }

  undo(): void {
    const group = this.getGroup(this.groupId);
    if (!group) {
      return;
    }
    group.style = cloneValue(this.before.style ?? {});
    group.styleClass = this.before.styleClass;
    group.label = this.before.label;
    group.padding = this.before.padding;
  }
}

/**
 * Command for removing a node from groups
 */
export class RemoveNodeFromGroupsCommand implements Command {
  private readonly getGroup: (id: string) => Group | undefined;
  private readonly getNode: (id: string) => Node | undefined;
  private readonly nodeId: string;
  private readonly groupIds: string[];

  constructor(
    getGroup: (id: string) => Group | undefined,
    getNode: (id: string) => Node | undefined,
    nodeId: string,
    groupIds: string[]
  ) {
    this.getGroup = getGroup;
    this.getNode = getNode;
    this.nodeId = nodeId;
    this.groupIds = [...groupIds];
  }

  execute(): void {
    for (const groupId of this.groupIds) {
      const group = this.getGroup(groupId);
      if (group) {
        group.removeChild(this.nodeId);
      }
    }
  }

  undo(): void {
    const node = this.getNode(this.nodeId);
    if (!node) {
      return;
    }
    for (const groupId of this.groupIds) {
      const group = this.getGroup(groupId);
      if (group) {
        if (!group.hasChild(this.nodeId)) {
          group.addChild(node);
        }
      }
    }
  }
}
