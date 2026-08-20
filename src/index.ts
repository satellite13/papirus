// Core
export { DiagramRenderer } from './core/DiagramRenderer';
export type { DiagramEvents, DiagramPlugin } from './core/DiagramRenderer';
export type { DiagramSurface, OverlayDragSession } from './core/DiagramSurface';

export { SelectionManager } from './core/SelectionManager';
export type { SelectionEvents } from './core/SelectionManager';

export { DragManager } from './core/DragManager';
export type { DragEvents, DragManagerOptions } from './core/DragManager';

export { ResizeManager } from './core/ResizeManager';
export type { ResizeEvents, ResizeManagerOptions } from './core/ResizeManager';

export { NavigationManager } from './core/NavigationManager';
export type { NavigationEvents, NavigationManagerOptions } from './core/NavigationManager';

export { ConnectionManager } from './core/ConnectionManager';
export type {
  ConnectionEvents,
  ConnectionManagerOptions,
  ConnectionValidator,
  ConnectionPreviewPathType,
} from './core/ConnectionManager';

export { InteractionManager } from './core/InteractionManager';
export type { InteractionManagerOptions, InteractionKeymap } from './core/InteractionManager';

export { ClipboardManager } from './core/ClipboardManager';
export type { ClipboardManagerOptions } from './core/ClipboardManager';

export { PropertyChangeBatcher } from './core/PropertyChangeBatcher';
export type {
  PropertyChangeBatcherOptions,
  PropertyChangeKind,
  PropertySnapshot,
} from './core/PropertyChangeBatcher';

export { ContextMenuManager } from './core/ContextMenuManager';
export type {
  ContextMenuItem,
  ContextMenuIcon,
  ContextMenuTarget,
  ContextMenuProvider,
  ContextMenuConfig,
  ContextMenuOptions,
  ContextMenuEvents,
} from './core/ContextMenuManager';

export { SearchManager } from './core/SearchManager';
export type {
  SearchManagerOptions,
  SearchFindOptions,
  SearchFilterOptions,
  SearchMatch,
  SearchResult,
} from './core/SearchManager';

export { AnimationManager } from './core/AnimationManager';
export type { AnimationState } from './core/AnimationManager';

export { HistoryManager } from './core/HistoryManager';
export {
  MoveNodesCommand,
  ResizeNodesCommand,
  AddNodeCommand,
  RemoveNodeCommand,
  CompositeCommand,
  ChangeEditablePolylineControlPointsCommand,
  ChangeNodePropertiesCommand,
  ChangeEdgePropertiesCommand,
  ChangeGroupPropertiesCommand,
} from './core/history/commands';
export type { HistoryEvents, HistoryManagerOptions } from './core/HistoryManager';

// Elements
export { Element, generateId, resetIdCounter } from './elements/Element';
export { Node } from './elements/Node';
export type {
  NodeOptions,
  NodeBadgeOption,
  ResizeHandle,
  AnchorPointsConfig,
} from './elements/Node';

export { Port, resetPortIdCounter } from './elements/Port';
export type { PortOptions } from './elements/Port';

export { TextLabel } from './elements/TextLabel';
export type { TextLabelOptions } from './elements/TextLabel';

export { NodeImage, isCornerPlacement } from './elements/NodeImage';
export type {
  NodeImageOptions,
  NodeImageFit,
  NodeImagePlacement,
  NodeImageCornerPlacement,
  NodeImageEdgePlacement,
} from './elements/NodeImage';

export { Edge } from './elements/Edge';
export type { EdgeOptions } from './elements/Edge';

export {
  StraightPathStrategy,
  PolylinePathStrategy,
  BezierPathStrategy,
} from './elements/paths';
export type { PathStrategy, PathStrategyOptions, PathObstacle } from './elements/paths';

export { Group } from './elements/Group';
export type { GroupOptions } from './elements/Group';

// Node types
export { RectangleNode } from './elements/nodes/RectangleNode';
export type { RectangleNodeOptions } from './elements/nodes/RectangleNode';

export { CircleNode } from './elements/nodes/CircleNode';
export { DiamondNode } from './elements/nodes/DiamondNode';
export { CustomShapeNode, ShapeFactories } from './elements/nodes/CustomShapeNode';
export type { CustomShapeNodeOptions } from './elements/nodes/CustomShapeNode';

// Composite
export {
  CompositeNode,
  CText,
  CIcon,
  CDivider,
  CContainer,
  CShape,
  container,
  text,
  icon,
  divider,
  shape,
  flexLayout,
  normalizeSides,
  deserializeCComponent,
} from './elements/composite';
export type {
  CompositeNodeOptions,
  CompositeShapeType,
  CTextOptions,
  CIconOptions,
  CDividerOptions,
  CContainerOptions,
  CShapeOptions,
  CComponent,
  CComponentType,
  CComponentStyle,
  SerializedCComponent,
  SidesConfig,
  FlexConfig,
  FlexChild,
  LayoutResult,
} from './elements/composite';

// Events
export { EventEmitter } from './events/EventEmitter';
export { InputHandler } from './events/InputHandler';
export type {
  InputEvents,
  InputEvent,
  WheelInputEvent,
  PanInputEvent,
  PinchInputEvent,
  InputHandlerOptions,
} from './events/InputHandler';

// Styles
export { StyleManager, DEFAULT_THEME, DARK_THEME } from './styles/StyleManager';
export type { Theme, StyleClass } from './styles/StyleManager';

// Utilities
export { Serializer } from './utils/Serializer';
export type { SerializerOptions, NodeFactory, EdgeFactory, GroupFactory } from './utils/Serializer';

export { ImageExporter } from './utils/ImageExporter';
export type { ExportOptions } from './utils/ImageExporter';

export { SvgExporter } from './utils/SvgExporter';
export type { SvgExportOptions } from './utils/SvgExporter';

export { AutoLayout } from './utils/AutoLayout';
export type { GridLayoutOptions } from './utils/AutoLayout';

export { AutoRouting } from './utils/AutoRouting';
export type { AutoRoutingOptions } from './utils/AutoRouting';

export { alignNodes, distributeNodes } from './utils/AlignDistribute';
export type { AlignType, DistributeType } from './utils/AlignDistribute';

export { GridOverlay } from './core/overlays/GridOverlay';
export type { GridOverlayOptions } from './core/overlays/GridOverlay';

export { RulersOverlay } from './core/overlays/RulersOverlay';
export type { RulersOverlayOptions } from './core/overlays/RulersOverlay';

export { GuidesOverlay } from './core/overlays/GuidesOverlay';
export type { GuidesOverlayOptions } from './core/overlays/GuidesOverlay';

export { MiniMap } from './core/overlays/MiniMap';
export type { MiniMapOptions } from './core/overlays/MiniMap';

export {
  distance,
  distanceToSegment,
  pointInRect,
  rectsIntersect,
  rectIntersection,
  rectUnion,
  segmentRectIntersections,
  pointInEllipse,
  angle,
  rotatePoint,
  lerp,
  clamp,
  snapToGrid,
  snapPointToGrid,
  expandBounds,
  boundsCenter,
  calculateBezierControlPoints,
  bezierPoint,
  mergeBounds,
  clonePoints,
  drawRoundedRectPath,
} from './utils/geometry';
export type { SegmentRectIntersection } from './utils/geometry';
export { applyNodeStyle, renderFillAndStroke, applyEdgeStyle } from './utils/canvas';

// Types
export type { ContentInsetScaleSides } from './utils/resolveContentInset';
export { resolveContentInset } from './utils/resolveContentInset';
export type {
  Point,
  Size,
  Bounds,
  ContentInsetSides,
  ElementState,
  PortPosition,
  PortType,
  EdgeEndpoint,
  EdgePathType,
  ArrowType,
  ArrowMarkerType,
  ArrowMarkerConfig,
  ElementStyle,
  NodeStyle,
  EdgeStyle,
  TextStyle,
  DiagramOptions,
  ScrollbarOptions,
  AnimationOptions,
  ViewportState,
  DiagramData,
  SerializedNode,
  SerializedPort,
  SerializedEdge,
  SerializedGroup,
  Command,
  SerializedCompositeNode,
  LabelPlacement,
} from './types';
export {
  DEFAULT_LABEL_GAP,
  isExternalLabelPlacement,
} from './utils/labelPlacement';
export { isEdgeEdgeEndpoint, isNodeEdgeEndpoint } from './types';
export { getPathPointAt, getClosestPointOnPath, directionFromAngle } from './utils/edgePath';
