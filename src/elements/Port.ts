import type { Point, PortPosition, PortType } from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import type { Node } from './Node';

let portIdCounter = 1;

/**
 * Generate a unique port ID
 */
function generatePortId(): string {
  return `port_${portIdCounter++}`;
}

/**
 * Reset port ID counter (for testing)
 * @internal
 */
export function resetPortIdCounter(): void {
  portIdCounter = 1;
}

export interface PortOptions {
  id?: string;
  type: PortType;
  position: PortPosition | Point;
  radius?: number;
  color?: string;
  hoverColor?: string;
  styleClass?: string;
}

/**
 * Connection port on a node
 */
export class Port {
  readonly id: string;
  readonly type: PortType;
  private _styleClass?: string;
  private _position: PortPosition | Point;
  private _radius: number;
  private _color: string;
  private _hoverColor: string;
  private _hovered = false;
  private _hasCustomRadius: boolean;
  private _hasCustomColor: boolean;
  private _hasCustomHoverColor: boolean;

  constructor(options: PortOptions) {
    this.id = options.id ?? generatePortId();
    this.type = options.type;
    this._position = options.position;
    this._radius = options.radius ?? 6;
    this._color = options.color ?? '#666666';
    this._hoverColor = options.hoverColor ?? '#3b82f6';
    this._styleClass = options.styleClass;
    this._hasCustomRadius = options.radius !== undefined;
    this._hasCustomColor = options.color !== undefined;
    this._hasCustomHoverColor = options.hoverColor !== undefined;
  }

  /**
   * Port position (relative or absolute)
   */
  get position(): PortPosition | Point {
    return this._position;
  }

  set position(value: PortPosition | Point) {
    this._position = value;
  }

  /**
   * Style class name for StyleManager
   */
  get styleClass(): string | undefined {
    return this._styleClass;
  }

  set styleClass(value: string | undefined) {
    this._styleClass = value;
  }

  /**
   * Port radius for rendering and hit testing
   */
  get radius(): number {
    return this._radius;
  }

  set radius(value: number) {
    this._radius = value;
  }

  /**
   * Port color
   */
  get color(): string {
    return this._hovered ? this._hoverColor : this._color;
  }

  set color(value: string) {
    this._color = value;
  }

  /**
   * Whether the port is hovered
   */
  get hovered(): boolean {
    return this._hovered;
  }

  set hovered(value: boolean) {
    this._hovered = value;
  }

  applyStyleManager(styleManager: StyleManager): void {
    const style = styleManager.getPortStyle(this._hovered, this._styleClass);
    if (!this._hasCustomRadius) {
      this._radius = style.radius;
    }
    if (!this._hasCustomColor) {
      this._color = style.color;
    }
    if (!this._hasCustomHoverColor) {
      this._hoverColor = style.color;
    }
  }

  /**
   * Get the absolute position of this port relative to a node
   */
  getAbsolutePosition(node: Node): Point {
    if (typeof this._position === 'object') {
      // Custom position relative to node
      return {
        x: node.x + this._position.x,
        y: node.y + this._position.y,
      };
    }

    // Named position
    const bounds = node.getBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    switch (this._position) {
      case 'top':
        return { x: centerX, y: bounds.y };
      case 'bottom':
        return { x: centerX, y: bounds.y + bounds.height };
      case 'left':
        return { x: bounds.x, y: centerY };
      case 'right':
        return { x: bounds.x + bounds.width, y: centerY };
    }
  }

  /**
   * Test if a point hits this port
   */
  hitTest(point: Point, node: Node): boolean {
    const pos = this.getAbsolutePosition(node);
    const dx = point.x - pos.x;
    const dy = point.y - pos.y;
    // Use larger hit area for easier interaction (2x visual radius)
    const hitRadius = this._radius * 2;
    return dx * dx + dy * dy <= hitRadius * hitRadius;
  }

  /**
   * Render the port
   */
  render(ctx: CanvasRenderingContext2D, node: Node): void {
    const pos = this.getAbsolutePosition(node);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this._radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
