import type { Bounds, Size } from '@/types';

/**
 * Sides configuration (padding, margin, inset)
 */
export interface SidesConfig {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Normalize a number or SidesConfig into a Required<SidesConfig>
 */
export function normalizeSides(
  value: number | SidesConfig | undefined,
  fallback = 0
): Required<SidesConfig> {
  if (value === undefined) {
    return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  }
  if (typeof value === 'number') {
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: value.top ?? fallback,
    right: value.right ?? fallback,
    bottom: value.bottom ?? fallback,
    left: value.left ?? fallback,
  };
}

/**
 * Flex child style properties for layout
 */
export interface CComponentStyle {
  visible?: boolean;
  opacity?: number;
  /** Flex grow factor (default 0) */
  flexGrow?: number;
  /** Flex shrink factor (default 1) */
  flexShrink?: number;
  /** Base size before grow/shrink. 'auto' uses measure() result (default 'auto') */
  flexBasis?: number | 'auto';
  /** Override container's alignItems for this child */
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  /** Outer margin */
  margin?: number | SidesConfig;
}

/**
 * Component type discriminator
 */
export type CComponentType = 'text' | 'icon' | 'shape' | 'container' | 'divider';

/**
 * Base interface for all composite node components.
 * Components are lightweight canvas-rendered elements within a CompositeNode.
 */
export interface CComponent {
  readonly type: CComponentType;
  /** Optional id for lookup via CompositeNode.getComponent(id) */
  readonly id?: string;
  /** Flex child style */
  style: CComponentStyle;

  /** Measure intrinsic (preferred) size. Requires ctx for text measurement. */
  measure(ctx: CanvasRenderingContext2D): Size;

  /** Render the component within the given bounds (computed by layout). */
  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void;

  /**
   * Hit test a point against this component's assigned bounds.
   * Returns the deepest matching component, or null if not hit.
   */
  hitTest(point: { x: number; y: number }, bounds: Bounds): CComponent | null;

  /** Set dirty callback — called when any property changes. */
  setOnChange(cb: (() => void) | undefined): void;

  /** Serialize to JSON-compatible object. */
  serialize(): SerializedCComponent;

  /** Generate SVG markup for this component at the given bounds. */
  toSVG(bounds: Bounds): string;
}

/**
 * Serialized component data — recursive JSON structure.
 * Type discriminator determines which fields are relevant.
 */
export interface SerializedCComponent {
  type: CComponentType;
  id?: string;
  style?: CComponentStyle;

  // CText fields
  text?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  maxLines?: number;
  lineHeight?: number;
  role?: string;
  rotation?: number;

  // CIcon fields
  source?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  /** Binds this icon to notation-level icon source in host app integrations */
  bindsNotationIcon?: boolean;

  // CShape fields
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  padding?: number | SidesConfig;
  content?: SerializedCComponent;

  // CDivider fields
  thickness?: number;

  // CContainer fields
  direction?: 'row' | 'column';
  justifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  gap?: number;
  children?: SerializedCComponent[];
}
