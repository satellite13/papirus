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
 * Edge connection endpoint.
 * When attachToOutline is enabled, outlineParam (0-1 along shape perimeter) can be used
 * instead of portId to attach the edge anywhere on the shape outline.
 */
export interface EdgeEndpoint {
  nodeId: string;
  portId?: string;
  /** Position along shape outline (0-1), used when attachToOutline mode is on */
  outlineParam?: number;
}

/**
 * Edge path type
 */
export type EdgePathType = 'straight' | 'polyline' | 'bezier' | 'editable-polyline';

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
  borderRadius?: number;
}

/**
 * Content inset per side (for node content area)
 */
export interface ContentInsetSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
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
  /** Vertical alignment of text inside its bounds (innerBounds) */
  verticalAlign?: 'top' | 'middle' | 'bottom';
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
  /**
   * @deprecated Use `scrollbar.enabled` instead.
   */
  scrollbarOverlay?: boolean;
  scrollbar?: boolean | Partial<ScrollbarOptions>;
  animations?: AnimationOptions;
}

/**
 * Scrollbar overlay configuration
 */
export interface ScrollbarOptions {
  enabled: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  fadeDuration: number;
  thickness: number;
  hoverThickness: number;
  minThumbLength: number;
  hitAreaPadding: number;
  pageScrollRatio: number;
  trackColor: string;
  thumbColor: string;
  thumbHoverColor: string;
  thumbActiveColor: string;
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
  /** Single inset from edge of icon zone to image. When reading: inset ?? margin ?? padding ?? gap ?? 6 */
  inset?: number;
  /** @deprecated Use inset. Kept for backward compat when loading old files. */
  margin?: number;
  /** @deprecated Use inset. Kept for backward compat when loading old files. */
  padding?: number;
  /** @deprecated Use inset. Kept for backward compat when loading old files. */
  gap?: number;
  opacity?: number;
  strokeColor?: string;
  fillColor?: string;
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
  /** Inset from bounds edge to text: number (all sides) or { top?, right?, bottom?, left? }. When reading: inset ?? margin ?? padding ?? 8 */
  inset?: number | ContentInsetSides;
  /** @deprecated Use inset. Kept for backward compat when loading old files. */
  margin?: number;
  /** @deprecated Use inset. Kept for backward compat when loading old files. */
  padding?: number;
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
  /** Content area insets per side (default 0 = full bounds) */
  contentInset?: number | ContentInsetSides;
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
   labelLineGap?: boolean;
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
