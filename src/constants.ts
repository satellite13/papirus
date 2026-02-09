/**
 * Centralized constants for the diagram library
 */

// Edge rendering
export const EDGE_HANDLE_RADIUS = 6;
export const ARROW_SIZE = 10;
export const ARROW_ANGLE = Math.PI / 6; // 30 degrees

// Marker sizes
export const MARKER_SIZES: Record<string, number> = {
  arrow: 12,
  open: 12,
  diamond: 14,
  circle: 6,
};

// Edge label
export const EDGE_LABEL_BACKGROUND_PADDING = 4;
export const EDGE_LABEL_BACKGROUND_RADIUS = 2;

// Resize handles
export const RESIZE_HANDLE_SIZE = 8;
export const RESIZE_HANDLE_OFFSET = 6;

// Anchor points
export const ANCHOR_POINT_RADIUS = 4;
export const ANCHOR_POINT_HOVER_RADIUS = 6;
export const ANCHOR_POINT_HITBOX_RADIUS = 10;
export const NODE_HITBOX_PADDING = 10;

// Anchor points
export const ANCHOR_PORT_PREFIX = 'anchor:';

// Bezier curve calculation
export const BEZIER_MAX_OFFSET = 100;

// Selection
export const SELECTION_RECT_MIN_SIZE = 1;
export const DEFAULT_SELECTION_COLOR = '#3b82f6';
export const DEFAULT_HOVER_COLOR = '#6366f1';
