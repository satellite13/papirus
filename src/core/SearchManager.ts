import type { DiagramRenderer } from './DiagramRenderer';
import type { EdgePathType } from '@/types';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import { AnimationManager } from './AnimationManager';

export interface SearchManagerOptions {
  highlightColor?: string;
  currentColor?: string;
  highlightLineWidth?: number;
  currentLineWidth?: number;
  highlightPadding?: number;
}

export interface SearchFindOptions {
  highlight?: boolean;
  caseSensitive?: boolean;
  highlightColor?: string;
}

export interface SearchFilterOptions {
  nodeType?: string;
  edgeType?: EdgePathType;
  styleClass?: string;
  scope?: 'nodes' | 'edges' | 'all';
  predicate?: (element: Node | Edge) => boolean;
}

export interface SearchMatch {
  id: string;
  type: 'node' | 'edge';
  label: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_OPTIONS: Required<SearchManagerOptions> = {
  highlightColor: '#f59e0b',
  currentColor: '#ef4444',
  highlightLineWidth: 2,
  currentLineWidth: 3,
  highlightPadding: 6,
};

export class SearchManager {
  private renderer: DiagramRenderer;
  private options: Required<SearchManagerOptions>;
  private highlightIds = new Set<string>();
  private currentId: string | null = null;
  private overlayCleanup: (() => void) | null = null;
  private lastMatches: SearchMatch[] = [];
  private currentIndex = -1;
  private visibilityCache = new Map<string, boolean>();
  private filterActive = false;
  private animationManager?: AnimationManager;

  constructor(renderer: DiagramRenderer, options: SearchManagerOptions = {}) {
    this.renderer = renderer;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.animationManager = renderer.getAnimationManager?.();
    this.overlayCleanup = this.renderer.addOverlayRenderer((ctx) => this.renderHighlights(ctx));
  }

  destroy(): void {
    this.overlayCleanup?.();
    this.overlayCleanup = null;
    this.highlightIds.clear();
    this.currentId = null;
    this.visibilityCache.clear();
    this.filterActive = false;
  }

  find(query: string, options: SearchFindOptions = {}): SearchResult {
    const caseSensitive = options.caseSensitive ?? false;
    const normalizedQuery = caseSensitive ? query : query.toLowerCase();

    const matches: SearchMatch[] = [];
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (const node of this.renderer.nodes.values()) {
      const label = node.label?.text ?? '';
      if (!label) continue;
      const haystack = caseSensitive ? label : label.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        matches.push({ id: node.id, type: 'node', label });
        nodes.push(node);
      }
    }

    for (const edge of this.renderer.edges.values()) {
      const label = edge.label?.text ?? '';
      if (!label) continue;
      const haystack = caseSensitive ? label : label.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        matches.push({ id: edge.id, type: 'edge', label });
        edges.push(edge);
      }
    }

    this.lastMatches = matches;
    this.currentIndex = matches.length > 0 ? 0 : -1;
    this.currentId = matches.length > 0 ? matches[0]!.id : null;

    if (options.highlight ?? true) {
      this.setHighlights(matches.map((match) => match.id), options.highlightColor);
    }

    return { matches, nodes, edges };
  }

  next(): SearchMatch | null {
    if (this.lastMatches.length === 0) {
      return null;
    }
    this.currentIndex = (this.currentIndex + 1) % this.lastMatches.length;
    const match = this.lastMatches[this.currentIndex]!;
    this.currentId = match.id;
    this.animationManager?.registerHighlight(match.id);
    this.renderer.markDirty();
    return match;
  }

  previous(): SearchMatch | null {
    if (this.lastMatches.length === 0) {
      return null;
    }
    this.currentIndex =
      (this.currentIndex - 1 + this.lastMatches.length) % this.lastMatches.length;
    const match = this.lastMatches[this.currentIndex]!;
    this.currentId = match.id;
    this.animationManager?.registerHighlight(match.id);
    this.renderer.markDirty();
    return match;
  }

  clear(): void {
    this.clearHighlights();
    this.clearFilter();
    this.lastMatches = [];
    this.currentIndex = -1;
    this.currentId = null;
  }

  filter(options: SearchFilterOptions): void {
    if (!this.filterActive) {
      this.visibilityCache.clear();
      for (const node of this.renderer.nodes.values()) {
        this.visibilityCache.set(node.id, node.visible);
      }
      for (const edge of this.renderer.edges.values()) {
        this.visibilityCache.set(edge.id, edge.visible);
      }
      this.filterActive = true;
    }

    const scope = options.scope ?? 'all';

    for (const node of this.renderer.nodes.values()) {
      if (scope === 'edges') {
        continue;
      }
      node.visible = this.matchesNode(node, options);
    }

    for (const edge of this.renderer.edges.values()) {
      if (scope === 'nodes') {
        continue;
      }
      const matchesEdge = this.matchesEdge(edge, options);
      const fromId = edge.from.nodeId;
      const toId = edge.to.nodeId;
      const fromVisible = fromId ? (this.renderer.getNode(fromId)?.visible ?? true) : true;
      const toVisible = toId ? (this.renderer.getNode(toId)?.visible ?? true) : true;
      edge.visible = matchesEdge && fromVisible && toVisible;
    }

    this.renderer.markDirty();
  }

  clearFilter(): void {
    if (!this.filterActive) {
      return;
    }
    for (const node of this.renderer.nodes.values()) {
      const cached = this.visibilityCache.get(node.id);
      if (cached !== undefined) {
        node.visible = cached;
      }
    }
    for (const edge of this.renderer.edges.values()) {
      const cached = this.visibilityCache.get(edge.id);
      if (cached !== undefined) {
        edge.visible = cached;
      }
    }
    this.visibilityCache.clear();
    this.filterActive = false;
    this.renderer.markDirty();
  }

  private setHighlights(ids: string[], colorOverride?: string): void {
    this.highlightIds = new Set(ids);
    if (colorOverride) {
      this.options = { ...this.options, highlightColor: colorOverride };
    }
    for (const id of this.highlightIds) {
      this.animationManager?.registerHighlight(id);
    }
    this.renderer.markDirty();
  }

  private clearHighlights(): void {
    this.highlightIds.clear();
    this.renderer.markDirty();
  }

  private matchesNode(node: Node, options: SearchFilterOptions): boolean {
    if (options.nodeType) {
      const typeName = node.typeName;
      const className = node.constructor?.name ?? '';
      if (options.nodeType !== typeName && options.nodeType !== className) {
        return false;
      }
    }
    if (options.styleClass && node.styleClass !== options.styleClass) {
      return false;
    }
    return !(options.predicate && !options.predicate(node));

  }

  private matchesEdge(edge: Edge, options: SearchFilterOptions): boolean {
    if (options.edgeType && edge.type !== options.edgeType) {
      return false;
    }
    if (options.styleClass && edge.styleClass !== options.styleClass) {
      return false;
    }
    return !(options.predicate && !options.predicate(edge));

  }

  private renderHighlights(ctx: CanvasRenderingContext2D): void {
    if (this.highlightIds.size === 0) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = 1;

    for (const id of this.highlightIds) {
      const node = this.renderer.getNode(id);
      if (node && node.visible) {
        this.renderNodeHighlight(ctx, node, id === this.currentId);
        continue;
      }
      const edge = this.renderer.getEdge(id);
      if (edge && edge.visible) {
        this.renderEdgeHighlight(ctx, edge, id === this.currentId);
      }
    }

    ctx.restore();
  }

  private renderNodeHighlight(
    ctx: CanvasRenderingContext2D,
    node: Node,
    isCurrent: boolean
  ): void {
    const bounds = node.getBounds();
    const padding = this.options.highlightPadding;
    const color = isCurrent ? this.options.currentColor : this.options.highlightColor;
    const width = isCurrent ? this.options.currentLineWidth : this.options.highlightLineWidth;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2
    );
  }

  private renderEdgeHighlight(
    ctx: CanvasRenderingContext2D,
    edge: Edge,
    isCurrent: boolean
  ): void {
    const path = edge.path;
    if (path.length < 2) {
      return;
    }
    const color = isCurrent ? this.options.currentColor : this.options.highlightColor;
    const width = isCurrent ? this.options.currentLineWidth : this.options.highlightLineWidth;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(path[0]!.x, path[0]!.y);
    if (edge.type === 'bezier' && path.length >= 4) {
      for (let i = 1; i + 2 < path.length; i += 3) {
        const cp1 = path[i]!;
        const cp2 = path[i + 1]!;
        const end = path[i + 2]!;
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
      }
    } else {
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i]!.x, path[i]!.y);
      }
    }
    ctx.stroke();
  }
}
