import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { Node } from '@/elements/Node';
import type { CComponent } from '@/elements/composite/CComponent';
import type { Point } from '@/types';

export interface OverlayDragSession {
  plugin: unknown;
  payload: unknown;
}

/**
 * Rendering surface required by the interaction subsystem.
 * Keeping this structural contract separate prevents interaction managers from
 * depending on the concrete DiagramRenderer implementation.
 */
export interface DiagramSurface {
  zoom: number;
  offsetX: number;
  offsetY: number;
  attachToOutline: boolean;
  readonly width: number;
  readonly height: number;
  readonly snapToGrid: boolean;
  readonly nodes: ReadonlyMap<string, Node>;
  readonly edges: ReadonlyMap<string, Edge>;
  readonly groups: ReadonlyMap<string, Group>;

  getCanvas(): HTMLCanvasElement;
  getContext(): CanvasRenderingContext2D;
  getNode(id: string): Node | undefined;
  getEdge(id: string): Edge | undefined;
  getGroup(id: string): Group | undefined;
  addNode(node: Node): void;
  addEdge(edge: Edge): void;
  removeNode(id: string): boolean;
  removeEdge(id: string): boolean;
  markDirty(): void;
  markStyleDirty(): void;
  screenToWorld(screenX: number, screenY: number): Point;
  worldToScreen(worldX: number, worldY: number): Point;
  getInteractableElementAtPoint(
    worldPoint: Point,
    screenX: number,
    screenY: number
  ): Node | Edge | Group | undefined;
  updateBadgeHover(worldPoint: Point): void;
  blocksDiagramPointerAtScreen(screenX: number, screenY: number): boolean;
  addOverlayRenderer(renderer: (ctx: CanvasRenderingContext2D) => void): () => void;

  beginOverlayDrag(screenX: number, screenY: number): OverlayDragSession | null;
  updateOverlayDrag(session: OverlayDragSession, screenX: number, screenY: number): boolean;
  endOverlayDrag(session: OverlayDragSession): void;

  notifyScrollbarInteraction(): void;
  setScrollbarActiveAxis(axis: 'horizontal' | 'vertical' | null): void;
  updateScrollbarHover(screenX: number, screenY: number): boolean;
  clearScrollbarHover(): void;
  hitTestScrollbarThumb(
    screenX: number,
    screenY: number
  ): { axis: 'horizontal' | 'vertical'; pointerOffset: number } | null;
  dragScrollbarThumb(
    axis: 'horizontal' | 'vertical',
    screenX: number,
    screenY: number,
    pointerOffset: number
  ): boolean;
  clickScrollbarTrack(screenX: number, screenY: number): boolean;
  scrollViewportBy(screenDx: number, screenDy: number): boolean;
  scrollViewportToStart(): boolean;
  scrollViewportToEnd(): boolean;

  emit(event: 'select', elementIds: string[]): void;
  emit(event: 'nodeBadgeClick', nodeId: string, badgeId: string): void;
  emit(event: 'componentClick', nodeId: string, component: CComponent, point: Point): void;
}
