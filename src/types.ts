/**
 * 2D point in coordinate space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size dimensions
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Rectangular bounds combining position and size
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element interaction states
 */
export type ElementState = 'normal' | 'hover' | 'selected' | 'dragging';

/**
 * Port position on a node
 */
export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Port type for connection directionality
 */
export type PortType = 'input' | 'output';

/**
 * Edge connection endpoint
 */
export interface EdgeEndpoint {
  nodeId: string;
  portId?: string;
}

/**
 * Edge path type
 */
export type EdgePathType = 'straight' | 'polyline' | 'bezier';

/**
 * Arrow type for edges (legacy, use ArrowMarkerType for new code)
 */
export type ArrowType = 'none' | 'single' | 'double';

/**
 * Arrow marker type
 */
export type ArrowMarkerType = 'none' | 'arrow' | 'open' | 'diamond' | 'circle';

/**
 * Arrow marker configuration
 */
export interface ArrowMarkerConfig {
  type: ArrowMarkerType;
  size?: number;
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
}

/**
 * Style properties for elements
 */
export interface ElementStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  lineDash?: number[];
  opacity?: number;
}

/**
 * Style properties for nodes
 */
export interface NodeStyle extends ElementStyle {
  fillOpacity?: number;
  strokeOpacity?: number;
  cornerRadius?: number;
  lineDash?: number[];
  lineDashOffset?: number;
}

/**
 * Placement for label inside node bounds
 */
export type LabelPlacement = 'auto' | 'center' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Style properties for edges
 */
export interface EdgeStyle extends ElementStyle {
  strokeOpacity?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  flowSpeed?: number;
  flowDash?: number[];
}

/**
 * Edge label background configuration
 */
export interface EdgeLabelBackground {
  color?: string;
  opacity?: number;
  padding?: number;
  borderRadius?: number;
}

/**
 * Style properties for text
 */
export interface TextStyle {
  font?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  opacity?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

/**
 * Configuration options for DiagramRenderer
 */
export interface DiagramOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  retina?: boolean;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  snapToGrid?: boolean;
  scrollbarOverlay?: boolean;
  animations?: AnimationOptions;
}

/**
 * Animation configuration for DiagramRenderer
 */
export interface AnimationOptions {
  enabled?: boolean;
  enterDuration?: number;
  exitDuration?: number;
  highlightDuration?: number;
  enterScale?: number;
  exitScale?: number;
}

/**
 * Viewport state
 */
export interface ViewportState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Serialized diagram data
 */
export interface DiagramData {
  version: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  groups: SerializedGroup[];
  viewport: ViewportState;
  theme?: SerializedTheme;
  styleClasses?: SerializedStyleClass[];
}

/**
 * Serialized node icon data
 */
export interface SerializedNodeIcon {
  source: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'stretch' | 'none';
  placement?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  scaleWithBounds?: boolean;
  padding?: number;
  margin?: number;
  gap?: number;
  opacity?: number;
  strokeColor?: string;
  fillColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  offsetX?: number;
  offsetY?: number;
}

/**
 * Serialized anchor points configuration
 */
export interface SerializedAnchorPoints {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Serialized text label data
 */
export interface SerializedTextLabel {
  text: string;
  style?: TextStyle;
  maxWidth?: number;
  padding?: number;
  margin?: number;
  styleClass?: string;
}

/**
 * Serialized node data
 */
export interface SerializedNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: NodeStyle;
  styleClass?: string;
  label?: string | SerializedTextLabel;
  labelStyleClass?: string;
  labelPlacement?: LabelPlacement;
  icon?: SerializedNodeIcon;
  anchorPoints?: SerializedAnchorPoints;
  ports?: SerializedPort[];
  data?: Record<string, unknown>;
}

/**
 * Serialized port data
 */
export interface SerializedPort {
  id: string;
  type: PortType;
  position: PortPosition | Point;
  styleClass?: string;
}

/**
 * Serialized edge data
 */
export interface SerializedEdge {
  id: string;
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  type: EdgePathType;
  controlPoints?: Point[];
  arrowType?: ArrowType;
  startMarker?: ArrowMarkerConfig;
  endMarker?: ArrowMarkerConfig;
  style?: EdgeStyle;
  styleClass?: string;
  label?: string;
  labelStyleClass?: string;
  labelOffset?: number;
  labelBackground?: EdgeLabelBackground;
  data?: Record<string, unknown>;
}

/**
 * Serialized group data
 */
export interface SerializedGroup {
  id: string;
  childIds: string[];
  style?: ElementStyle;
  styleClass?: string;
  label?: string;
  data?: Record<string, unknown>;
}

/**
 * Serialized theme data (compatible with StyleManager Theme)
 */
export interface SerializedTheme {
  name: string;
  colors: {
    background: string;
    grid: string;
    selection: string;
    connectionPreview: string;
  };
  node: {
    default: NodeStyle;
    hover: NodeStyle;
    selected: NodeStyle;
    dragging: NodeStyle;
  };
  edge: {
    default: EdgeStyle;
    hover: EdgeStyle;
    selected: EdgeStyle;
  };
  text: TextStyle;
  port: {
    default: { color: string; radius: number };
    hover: { color: string; radius: number };
  };
  group: {
    default: ElementStyle;
    selected: ElementStyle;
  };
}

/**
 * Serialized style class data (compatible with StyleManager StyleClass)
 */
export interface SerializedStyleClass {
  name: string;
  node?: Partial<NodeStyle>;
  edge?: Partial<EdgeStyle>;
  text?: Partial<TextStyle>;
  port?: Partial<{ color: string; radius: number }>;
  group?: Partial<ElementStyle>;
}

/**
 * Command for history/undo system
 */
export interface Command {
  execute(): void;
  undo(): void;
}
