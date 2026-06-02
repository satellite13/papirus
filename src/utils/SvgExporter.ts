import type { DiagramRenderer } from '@/core/DiagramRenderer';
import type { Bounds, ContentInsetSides, Point } from '@/types';
import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { Group } from '@/elements/Group';
import type { ArrowMarkerConfig, TextStyle } from '@/types';
import type { NodeImageOptions, NodeImagePlacement } from '@/elements/NodeImage';
import { EDGE_LABEL_BACKGROUND_RADIUS } from '@/constants';
import { applyStyleManagerToElements } from './style';
import { getContentBounds } from './contentBounds';
import { downloadBlob } from './download';
import { generateSvgMarker, calculateMarkerPoints } from './markers';
import { bezierPoint, segmentRectIntersections } from './geometry';

export interface SvgExportOptions {
  padding?: number;
  backgroundColor?: string;
  includeBackground?: boolean;
  /**
   * Global Y-offset override for edge labels in SVG export.
   * If omitted, exporter uses each edge's runtime labelOffset.
   */
  edgeLabelOffset?: number;
}

/**
 * Exports diagram to SVG
 */
export class SvgExporter {
  private renderer: DiagramRenderer;

  constructor(renderer: DiagramRenderer) {
    this.renderer = renderer;
  }

  exportSVG(options: SvgExportOptions = {}): string {
    const padding = options.padding ?? 20;
    const includeBackground = options.includeBackground ?? true;
    const backgroundColor = options.backgroundColor ?? '#ffffff';
    const edgeLabelOffset = options.edgeLabelOffset;

    const bounds = getContentBounds({
      nodes: this.renderer.nodes.values(),
      edges: this.renderer.edges.values(),
      groups: this.renderer.groups.values(),
    });
    if (bounds === null) {
      return this.createEmptySvg(100, 100, backgroundColor, includeBackground);
    }

    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;
    const offsetX = -bounds.x + padding;
    const offsetY = -bounds.y + padding;

    applyStyleManagerToElements(
      this.renderer.getStyleManager(),
      this.renderer.groups.values(),
      this.renderer.edges.values(),
      this.renderer.nodes.values()
    );

    const parts: string[] = [];
    const renderedEdges: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    );
    for (const edge of this.renderer.edges.values()) {
      if (edge.visible) {
        renderedEdges.push(this.renderEdge(edge, edgeLabelOffset));
      }
    }
    if (includeBackground) {
      parts.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);
    }
    parts.push(`<g transform="translate(${offsetX}, ${offsetY})">`);

    for (const group of this.renderer.groups.values()) {
      if (group.visible) {
        parts.push(this.renderGroup(group));
      }
    }

    for (const node of this.renderer.nodes.values()) {
      if (node.visible) {
        parts.push(this.renderNode(node));
      }
    }

    // Keep SVG layering aligned with canvas renderer: edges above nodes.
    parts.push(...renderedEdges);

    parts.push(`</g></svg>`);
    return parts.join('');
  }

  exportDataURL(options: SvgExportOptions = {}): string {
    const svg = this.exportSVG(options);
    const encoded = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }

  download(filename: string, options: SvgExportOptions = {}): void {
    const svg = this.exportSVG(options);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(filename, blob);
  }

  private renderGroup(group: Group): string {
    const bounds = group.getBounds();
    const style = group.style;
    const fill = style.fillColor ?? 'rgba(200, 200, 200, 0.2)';
    const stroke = style.strokeColor ?? '#999999';
    const strokeWidth = style.strokeWidth ?? 1;
    const opacity = style.opacity ?? 1;

    const label = group.label
      ? `<text x="${bounds.x + 8}" y="${bounds.y + 14}" fill="#666666" font-size="12">${this.escapeText(
          group.label
        )}</text>`
      : '';

    return [
      `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"`,
      ` fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"`,
      ` stroke-dasharray="4 4"/>`,
      label,
    ].join('');
  }

  private renderNode(node: Node): string {
    const bounds = node.getBounds();
    const style = node.style;
    const fill = style.fillColor ?? '#ffffff';
    const stroke = style.strokeColor ?? '#333333';
    const strokeWidth = style.strokeWidth ?? 2;
    const baseOpacity = style.opacity ?? 1;
    const fillOpacity = (style.fillOpacity ?? 1) * baseOpacity;
    const strokeOpacity = (style.strokeOpacity ?? 1) * baseOpacity;
    const dash = style.lineDash?.length ? ` stroke-dasharray="${style.lineDash.join(' ')}"` : '';
    const dashOffset =
      style.lineDashOffset !== undefined ? ` stroke-dashoffset="${style.lineDashOffset}"` : '';

    let shape: string;
    switch (node.typeName) {
      case 'rectangle': {
        const radius = this.getNodeCornerRadius(node, bounds);
        shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${radius}" ry="${radius}"`;
        break;
      }
      case 'circle': {
        const center = node.getCenter();
        shape = `<ellipse cx="${center.x}" cy="${center.y}" rx="${bounds.width / 2}" ry="${bounds.height / 2}"`;
        break;
      }
      case 'diamond': {
        const center = node.getCenter();
        const hw = bounds.width / 2;
        const hh = bounds.height / 2;
        const points = [
          `${center.x},${center.y - hh}`,
          `${center.x + hw},${center.y}`,
          `${center.x},${center.y + hh}`,
          `${center.x - hw},${center.y}`,
        ].join(' ');
        shape = `<polygon points="${points}"`;
        break;
      }
      case 'custom': {
        const svgPath =
          'getSvgPath' in node && typeof node.getSvgPath === 'function'
            ? (node as { getSvgPath: () => string | null }).getSvgPath()
            : null;
        if (svgPath) {
          shape = `<path d="${this.escapeAttribute(svgPath)}" transform="translate(${bounds.x}, ${bounds.y})"`;
        } else {
          shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"`;
        }
        break;
      }
      case 'composite': {
        const cn = node as import('@/elements/composite/CompositeNode').CompositeNode;
        switch (cn.shapeType) {
          case 'circle': {
            const center = node.getCenter();
            shape = `<ellipse cx="${center.x}" cy="${center.y}" rx="${bounds.width / 2}" ry="${bounds.height / 2}"`;
            break;
          }
          case 'diamond': {
            const center = node.getCenter();
            const hw = bounds.width / 2;
            const hh = bounds.height / 2;
            const points = [
              `${center.x},${center.y - hh}`,
              `${center.x + hw},${center.y}`,
              `${center.x},${center.y + hh}`,
              `${center.x - hw},${center.y}`,
            ].join(' ');
            shape = `<polygon points="${points}"`;
            break;
          }
          case 'custom': {
            const svgPath = cn.getSvgPath();
            if (svgPath) {
              shape = `<path d="${this.escapeAttribute(svgPath)}" transform="translate(${bounds.x}, ${bounds.y})"`;
            } else {
              const radius = cn.cornerRadius;
              shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${radius}" ry="${radius}"`;
            }
            break;
          }
          default: {
            const radius = cn.cornerRadius;
            shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${radius}" ry="${radius}"`;
            break;
          }
        }

        // Render component tree instead of label/icon
        const contentBounds = cn.getLabelContainerBounds(bounds);
        const contentSvg = cn.content.toSVG(contentBounds);
        return [
          `${shape} fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}"${dash}${dashOffset}/>`,
          contentSvg,
        ].join('');
      }
      default: {
        shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"`;
      }
    }

    const label = this.renderNodeLabel(node, bounds);
    const icon = this.renderNodeIcon(node, bounds);

    return [
      `${shape} fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}"${dash}${dashOffset}/>`,
      icon,
      label,
    ].join('');
  }

  private renderEdge(edge: Edge, edgeLabelOffset?: number): string {
    const path = edge.path;
    if (path.length < 2) {
      return '';
    }

    const style = edge.style;
    const stroke = style.strokeColor ?? '#666666';
    const strokeWidth = style.strokeWidth ?? 2;
    const strokeOpacity = (style.strokeOpacity ?? 1) * (style.opacity ?? 1);
    const lineCap = style.lineCap ? ` stroke-linecap="${style.lineCap}"` : '';
    const lineJoin = style.lineJoin ? ` stroke-linejoin="${style.lineJoin}"` : '';
    const dashValues = style.flowDash ?? style.lineDash;
    const dash = dashValues ? ` stroke-dasharray="${dashValues.join(' ')}"` : '';
    const dashOffset =
      style.lineDashOffset !== undefined ? ` stroke-dashoffset="${style.lineDashOffset}"` : '';

    const d = this.buildEdgePath(edge, edgeLabelOffset);
    const markerShapes = this.renderEdgeMarkers(edge, stroke);
    const label = this.renderEdgeLabel(edge, edgeLabelOffset);

    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" color="${stroke}"${lineCap}${lineJoin}${dash}${dashOffset}/>${markerShapes}${label}`;
  }

  private renderEdgeLabel(edge: Edge, edgeLabelOffset?: number): string {
    if (!edge.label) {
      return '';
    }

    const labelState = this.getEdgeLabelState(edge, edgeLabelOffset);
    if (!labelState) {
      return '';
    }
    const text = this.renderTextLabel(edge.label.text, labelState.point, edge.label.style, labelState.rotation);
    const bg = this.renderEdgeLabelBackground(edge, labelState.point, labelState.rotation);
    return `${bg}${text}`;
  }

  private renderEdgeLabelBackground(edge: Edge, point: Point, rotation = 0): string {
    if (!edge.label) {
      return '';
    }

    const metrics = this.measureTextLabel(edge.label.text, edge.label.style, edge.label.inset);
    const bgColor = edge.labelBackground?.color ?? '#ffffff';
    const bgOpacity = edge.labelBackground?.opacity ?? 1;
    const bgRadius = edge.labelBackground?.borderRadius ?? EDGE_LABEL_BACKGROUND_RADIUS;

    const x = point.x - metrics.width / 2;
    const y = point.y - metrics.height / 2;
    const width = metrics.width;
    const height = metrics.height;
    const radius = Math.max(0, Math.min(bgRadius, width / 2, height / 2));

    const transform = rotation !== 0 ? ` transform="rotate(${(rotation * 180) / Math.PI} ${point.x} ${point.y})"` : '';

    if (radius <= 0) {
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bgColor}" fill-opacity="${bgOpacity}"${transform}/>`;
    }

    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${bgColor}" fill-opacity="${bgOpacity}"${transform}/>`;
  }

  private normalizeLabelInset(
    value: number | ContentInsetSides | undefined,
    defaultVal: number
  ): Required<ContentInsetSides> {
    const n = (v: number | undefined): number =>
      v !== undefined && Number.isFinite(v) ? Math.max(0, v) : defaultVal;
    if (value === undefined) {
      return { top: defaultVal, right: defaultVal, bottom: defaultVal, left: defaultVal };
    }
    if (typeof value === 'number') {
      const v = n(value);
      return { top: v, right: v, bottom: v, left: v };
    }
    return {
      top: n(value.top),
      right: n(value.right),
      bottom: n(value.bottom),
      left: n(value.left),
    };
  }

  private measureTextLabel(
    text: string,
    style: TextStyle = {},
    inset: number | ContentInsetSides = 8
  ): { width: number; height: number } {
    const fontSize = style.fontSize ?? 14;
    const fontFamily = style.fontFamily ?? 'sans-serif';
    const fontWeight = style.fontWeight ?? 'normal';
    const lineHeight = fontSize * 1.2;
    const lines = text.split('\n');
    let maxWidth = 0;

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        for (const line of lines) {
          maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
        }
      }
    }

    if (maxWidth === 0) {
      const longestLine = lines.reduce((max, line) => (line.length > max.length ? line : max), '');
      maxWidth = longestLine.length * fontSize * 0.6;
    }

    const ins = this.normalizeLabelInset(inset, 8);
    return {
      width: maxWidth + ins.left + ins.right,
      height: lines.length * lineHeight + ins.top + ins.bottom,
    };
  }

  private resolveMarkerConfig(edge: Edge, side: 'start' | 'end'): ArrowMarkerConfig | null {
    const usesExplicitMarkers = edge.startMarker !== undefined || edge.endMarker !== undefined;

    if (usesExplicitMarkers) {
      const marker = side === 'start' ? edge.startMarker : edge.endMarker;
      return marker && marker.type !== 'none' ? marker : null;
    }

    if (side === 'end') {
      return edge.arrowType === 'none' ? null : { type: 'arrow' };
    }

    return edge.arrowType === 'double' ? { type: 'arrow' } : null;
  }

  private renderEdgeMarkers(edge: Edge, edgeStroke: string): string {
    const startMarker = this.resolveMarkerConfig(edge, 'start');
    const endMarker = this.resolveMarkerConfig(edge, 'end');
    const parts: string[] = [];

    if (endMarker) {
      const points = this.getMarkerPoints(edge, 'end');
      if (points) {
        parts.push(this.renderMarkerShape(endMarker, points.from, points.to, edgeStroke));
      }
    }

    if (startMarker) {
      const points = this.getMarkerPoints(edge, 'start');
      if (points) {
        parts.push(this.renderMarkerShape(startMarker, points.from, points.to, edgeStroke));
      }
    }

    return parts.join('');
  }

  private getMarkerPoints(edge: Edge, position: 'start' | 'end'): { from: Point; to: Point } | null {
    return calculateMarkerPoints(edge.path, position, edge.type);
  }

  private renderMarkerShape(
    marker: ArrowMarkerConfig,
    from: Point,
    to: Point,
    edgeStroke: string
  ): string {
    return generateSvgMarker(marker, from, to, edgeStroke);
  }

  private buildPath(edge: Edge): string {
    const path = edge.path;
    if (edge.type === 'bezier' && path.length >= 4) {
      let d = `M ${path[0]!.x} ${path[0]!.y}`;
      for (let i = 1; i + 2 < path.length; i += 3) {
        d += ` C ${path[i]!.x} ${path[i]!.y} ${path[i + 1]!.x} ${path[i + 1]!.y} ${path[i + 2]!.x} ${path[i + 2]!.y}`;
      }
      return d;
    }

    let d = `M ${path[0]!.x} ${path[0]!.y}`;
    for (let i = 1; i < path.length; i++) {
      d += ` L ${path[i]!.x} ${path[i]!.y}`;
    }
    return d;
  }

  private getPathMidpoint(edge: Edge): Point {
    const path = edge.path;
    if (edge.type === 'bezier' && path.length >= 4) {
      const t = 0.5;
      const mt = 1 - t;
      return {
        x:
          mt * mt * mt * path[0]!.x +
          3 * mt * mt * t * path[1]!.x +
          3 * mt * t * t * path[2]!.x +
          t * t * t * path[3]!.x,
        y:
          mt * mt * mt * path[0]!.y +
          3 * mt * mt * t * path[1]!.y +
          3 * mt * t * t * path[2]!.y +
          t * t * t * path[3]!.y,
      };
    }

    let totalLength = 0;
    const segments: { start: Point; end: Point; length: number }[] = [];
    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1]!;
      const end = path[i]!;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      segments.push({ start, end, length });
      totalLength += length;
    }

    const halfLength = totalLength / 2;
    let accumulated = 0;

    for (const seg of segments) {
      if (accumulated + seg.length >= halfLength) {
        const t = (halfLength - accumulated) / seg.length;
        return {
          x: seg.start.x + t * (seg.end.x - seg.start.x),
          y: seg.start.y + t * (seg.end.y - seg.start.y),
        };
      }
      accumulated += seg.length;
    }

    return path[0]!;
  }

  private getEdgeLabelPoint(edge: Edge, edgeLabelOffset?: number): Point {
    if (edgeLabelOffset === undefined) {
      const runtimePoint = edge.getLabelPosition();
      if (runtimePoint) {
        return runtimePoint;
      }
    }

    const midpoint = this.getPathMidpoint(edge);
    const effectiveOffset = edgeLabelOffset ?? edge.labelOffset;
    return {
      x: midpoint.x,
      y: midpoint.y + effectiveOffset,
    };
  }

  private getEdgeLabelState(
    edge: Edge,
    edgeLabelOffset?: number
  ): { point: Point; rotation: number } | null {
    if (!edge.label) {
      return null;
    }
    const point = this.getEdgeLabelPoint(edge, edgeLabelOffset);
    const rotation = edgeLabelOffset === undefined ? edge.getLabelRotation() : 0;
    return { point, rotation };
  }

  private renderTextLabel(text: string, point: Point, style: TextStyle = {}, rotation = 0): string {
    const fill = style.color ?? '#000000';
    const fontSize = style.fontSize ?? 14;
    const fontFamily = style.fontFamily ?? 'sans-serif';
    const fontWeight = style.fontWeight ?? 'normal';
    const opacity = style.opacity ?? 1;
    const anchor = style.align === 'left' ? 'start' : style.align === 'right' ? 'end' : 'middle';
    const baseline =
      style.baseline === 'top'
        ? 'text-before-edge'
        : style.baseline === 'bottom'
        ? 'text-after-edge'
        : 'middle';

    const transform = rotation !== 0 ? ` transform="rotate(${(rotation * 180) / Math.PI} ${point.x} ${point.y})"` : '';

    const lines = text.split('\n');
    if (lines.length <= 1) {
      return `<text x="${point.x}" y="${point.y}" fill="${fill}" fill-opacity="${opacity}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}" dominant-baseline="${baseline}"${transform}>${this.escapeText(
        text
      )}</text>`;
    }

    const lineHeight = fontSize * 1.2;
    const startY = point.y - ((lines.length - 1) * lineHeight) / 2;
    const tspans = lines
      .map((line, index) => `<tspan x="${point.x}" y="${startY + index * lineHeight}">${this.escapeText(line)}</tspan>`)
      .join('');
    return `<text x="${point.x}" y="${point.y}" fill="${fill}" fill-opacity="${opacity}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}" dominant-baseline="${baseline}"${transform}>${tspans}</text>`;
  }

  private buildEdgePath(edge: Edge, edgeLabelOffset?: number): string {
    if (!edge.label || !edge.labelLineGap) {
      return this.buildPath(edge);
    }

    const labelState = this.getEdgeLabelState(edge, edgeLabelOffset);
    if (!labelState) {
      return this.buildPath(edge);
    }

    const polyline = this.buildEdgePolyline(edge);
    if (polyline.length < 2) {
      return this.buildPath(edge);
    }

    const metrics = this.measureTextLabel(edge.label.text, edge.label.style, edge.label.inset);
    const labelRect = this.getLabelGapRect(labelState.point, metrics, labelState.rotation);
    const withGap = this.cutPolylineByRect(polyline, labelRect);
    return this.buildPolylinePath(withGap);
  }

  private buildEdgePolyline(edge: Edge): Point[] {
    const path = edge.path;
    if (edge.type !== 'bezier' || path.length < 4) {
      return path.map((point) => ({ x: point.x, y: point.y }));
    }

    const samples: Point[] = [];
    const steps = 20;
    for (let i = 1; i + 2 < path.length; i += 3) {
      const p0 = path[i - 1]!;
      const p1 = path[i]!;
      const p2 = path[i + 1]!;
      const p3 = path[i + 2]!;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        if (samples.length > 0 && t === 0) {
          continue;
        }
        samples.push(bezierPoint(p0, p1, p2, p3, t));
      }
    }
    return samples;
  }

  private getLabelGapRect(
    point: Point,
    metrics: { width: number; height: number },
    rotation: number
  ): Bounds {
    let width = metrics.width;
    let height = metrics.height;

    if (rotation !== 0) {
      const cos = Math.abs(Math.cos(rotation));
      const sin = Math.abs(Math.sin(rotation));
      width = metrics.width * cos + metrics.height * sin;
      height = metrics.width * sin + metrics.height * cos;
    }

    return {
      x: point.x - width / 2,
      y: point.y - height / 2,
      width,
      height,
    };
  }

  private cutPolylineByRect(polyline: Point[], rect: Bounds): Point[][] {
    type SegmentIntersection = { segIndex: number; t: number; point: Point };
    const intersections: SegmentIntersection[] = [];

    for (let i = 0; i < polyline.length - 1; i++) {
      const p0 = polyline[i]!;
      const p1 = polyline[i + 1]!;
      const segmentHits = segmentRectIntersections(p0, p1, rect);
      for (const hit of segmentHits) {
        intersections.push({ segIndex: i, t: hit.t, point: hit.point });
      }
    }

    if (intersections.length < 2) {
      return [polyline];
    }

    intersections.sort((a, b) => {
      if (a.segIndex === b.segIndex) {
        return a.t - b.t;
      }
      return a.segIndex - b.segIndex;
    });

    const segments: Point[][] = [];
    let current: Point[] = [{ ...polyline[0]! }];
    let entered = false;
    let exited = false;

    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i + 1]!;
      const currentIntersections = intersections
        .filter((intersection) => intersection.segIndex === i)
        .sort((a, b) => a.t - b.t);

      if (!entered && currentIntersections.length > 0) {
        current.push({ ...currentIntersections[0]!.point });
        if (current.length > 1) {
          segments.push(current);
        }
        current = [];
        entered = true;

        const exitOnSameSegment =
          currentIntersections.length > 1 ? currentIntersections[currentIntersections.length - 1]! : undefined;
        if (exitOnSameSegment) {
          current = [{ ...exitOnSameSegment.point }, { ...p1 }];
          exited = true;
        }
        continue;
      }

      if (entered && !exited && currentIntersections.length > 0) {
        const exitPoint = currentIntersections[currentIntersections.length - 1]!.point;
        current = [{ ...exitPoint }, { ...p1 }];
        exited = true;
        continue;
      }

      if (!entered || exited) {
        if (current.length === 0) {
          current.push({ ...polyline[i]! });
        }
        current.push({ ...p1 });
      }
    }

    if (current.length > 1) {
      segments.push(current);
    }

    return segments.length > 0 ? segments : [polyline];
  }

  private buildPolylinePath(segments: Point[][]): string {
    return segments
      .filter((segment) => segment.length > 1)
      .map((segment) => {
        let d = `M ${segment[0]!.x} ${segment[0]!.y}`;
        for (let i = 1; i < segment.length; i++) {
          d += ` L ${segment[i]!.x} ${segment[i]!.y}`;
        }
        return d;
      })
      .join(' ');
  }

  private getMeasurementContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') {
      return null;
    }
    const canvas = document.createElement('canvas');
    return canvas.getContext('2d');
  }

  private renderNodeLabel(node: Node, nodeBounds: { x: number; y: number; width: number; height: number }): string {
    const label = node.label;
    if (!label) {
      return '';
    }

    const style = label.style;
    const ins = this.normalizeLabelInset(label.inset, 8);
    const align = style.align ?? 'center';
    const verticalAlign = style.verticalAlign ?? 'middle';

    const ctx = this.getMeasurementContext();
    let bounds: { x: number; y: number; width: number; height: number };
    let lines: string[];

    if (ctx !== null) {
      const result = node.getLabelBoundsForExport(ctx);
      if (result) {
        bounds = result.bounds;
        lines = result.lines;
      } else {
        bounds = nodeBounds;
        lines = label.text.split('\n');
      }
    } else {
      bounds = nodeBounds;
      lines = label.text.split('\n');
    }

    const inner = {
      x: bounds.x + ins.left,
      y: bounds.y + ins.top,
      width: Math.max(0, bounds.width - ins.left - ins.right),
      height: Math.max(0, bounds.height - ins.top - ins.bottom),
    };

    let x = inner.x + inner.width / 2;
    if (align === 'left') {
      x = inner.x;
    } else if (align === 'right') {
      x = inner.x + inner.width;
    }

    const lineHeight = (style.fontSize ?? 14) * 1.2;
    const totalHeight = lines.length * lineHeight;
    // renderTextLabel expects point.y = center of text block
    let y: number;
    if (verticalAlign === 'top') {
      y = inner.y + totalHeight / 2;
    } else if (verticalAlign === 'bottom') {
      y = inner.y + inner.height - totalHeight / 2;
    } else {
      y = inner.y + inner.height / 2;
    }

    return this.renderTextLabel(lines.join('\n'), { x, y }, style);
  }

  private getNodeCornerRadius(node: Node, bounds: { width: number; height: number }): number {
    const rectangleRadius =
      'cornerRadius' in node && typeof (node as { cornerRadius?: unknown }).cornerRadius === 'number'
        ? ((node as { cornerRadius: number }).cornerRadius ?? 0)
        : node.style.cornerRadius ?? 0;
    return Math.max(0, Math.min(rectangleRadius, bounds.width / 2, bounds.height / 2));
  }

  private renderNodeIcon(node: Node, nodeBounds: { x: number; y: number; width: number; height: number }): string {
    const icon = node.icon;
    if (!icon) {
      return '';
    }

    const opts = icon.options;
    const iconSize = icon.getSize();
    if (iconSize.width <= 0 || iconSize.height <= 0) {
      return '';
    }

    const iconInset = icon.inset;
    const iconBoxSize = this.getIconBoxSize(iconSize, iconInset);
    const iconBounds = this.getIconBounds(
      nodeBounds,
      iconBoxSize,
      opts.placement ?? 'center',
      iconInset
    );
    const drawRect = this.getIconDrawRect(iconBounds, opts, iconSize, iconInset);
    if (drawRect.width <= 0 || drawRect.height <= 0) {
      return '';
    }

    const href = this.resolveIconHref(opts);
    if (!href) {
      return '';
    }

    const opacity = opts.opacity ?? 1;
    const escapedHref = this.escapeAttribute(href);
    return `<image href="${escapedHref}" xlink:href="${escapedHref}" x="${drawRect.x}" y="${drawRect.y}" width="${drawRect.width}" height="${drawRect.height}" opacity="${opacity}" preserveAspectRatio="none"/>`;
  }

  private getIconBoxSize(
    imageSize: { width: number; height: number },
    inset: number
  ): { width: number; height: number } {
    return {
      width: imageSize.width + inset * 2,
      height: imageSize.height + inset * 2,
    };
  }

  private getIconBounds(
    bounds: { x: number; y: number; width: number; height: number },
    iconBoxSize: { width: number; height: number },
    placement: NodeImagePlacement,
    inset: number
  ): { x: number; y: number; width: number; height: number } {
    switch (placement) {
      case 'top':
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: iconBoxSize.height };
      case 'bottom':
        return {
          x: bounds.x,
          y: bounds.y + bounds.height - iconBoxSize.height,
          width: bounds.width,
          height: iconBoxSize.height,
        };
      case 'left':
        return { x: bounds.x, y: bounds.y, width: iconBoxSize.width, height: bounds.height };
      case 'right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width,
          y: bounds.y,
          width: iconBoxSize.width,
          height: bounds.height,
        };
      case 'top-left':
        return {
          x: bounds.x + inset,
          y: bounds.y + inset,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'top-right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width - inset,
          y: bounds.y + inset,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'bottom-left':
        return {
          x: bounds.x + inset,
          y: bounds.y + bounds.height - iconBoxSize.height - inset,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'bottom-right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width - inset,
          y: bounds.y + bounds.height - iconBoxSize.height - inset,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'center':
      default:
        return bounds;
    }
  }

  private getIconDrawRect(
    bounds: { x: number; y: number; width: number; height: number },
    opts: NodeImageOptions,
    imageSize: { width: number; height: number },
    inset: number
  ): { x: number; y: number; width: number; height: number } {
    const fit = opts.fit ?? 'none';
    const scaleWithBounds = opts.scaleWithBounds ?? false;

    const innerBounds = {
      x: bounds.x + inset,
      y: bounds.y + inset,
      width: Math.max(0, bounds.width - inset * 2),
      height: Math.max(0, bounds.height - inset * 2),
    };
    const availableWidth = Math.max(0, innerBounds.width);
    const availableHeight = Math.max(0, innerBounds.height);

    let drawWidth = opts.width ?? imageSize.width;
    let drawHeight = opts.height ?? imageSize.height;

    if (scaleWithBounds) {
      if ((fit === 'contain' || fit === 'cover') && imageSize.width > 0 && imageSize.height > 0) {
        const scaleX = availableWidth / imageSize.width;
        const scaleY = availableHeight / imageSize.height;
        const scale = fit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
        drawWidth = imageSize.width * scale;
        drawHeight = imageSize.height * scale;
      } else if (fit === 'stretch') {
        drawWidth = availableWidth;
        drawHeight = availableHeight;
      }
    }

    drawWidth = Math.min(Math.max(0, drawWidth), Math.max(0, availableWidth));
    drawHeight = Math.min(Math.max(0, drawHeight), Math.max(0, availableHeight));

    const x = innerBounds.x + (innerBounds.width - drawWidth) / 2;
    const y = innerBounds.y + (innerBounds.height - drawHeight) / 2;

    return {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    };
  }

  private resolveIconHref(opts: NodeImageOptions): string {
    const source = opts.source;
    if (source instanceof HTMLImageElement) {
      return source.src;
    }

    if (!source) {
      return '';
    }

    if (this.isSvgMarkup(source)) {
      return this.svgToDataUrl(this.tintSvg(source, opts.strokeColor, opts.fillColor));
    }

    const shouldInlineSvg = source.toLowerCase().endsWith('.svg');
    if (shouldInlineSvg) {
      const svgText = this.readSvgFromUrlSync(source);
      if (svgText) {
        return this.svgToDataUrl(this.tintSvg(svgText, opts.strokeColor, opts.fillColor));
      }
    }

    return source;
  }

  private readSvgFromUrlSync(url: string): string | null {
    if (typeof XMLHttpRequest === 'undefined') {
      return null;
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send();
      if (xhr.status >= 200 && xhr.status < 300) {
        return xhr.responseText || null;
      }
    } catch {
      // Ignore and fallback to raw URL source.
    }

    return null;
  }

  private isSvgMarkup(value: string): boolean {
    const trimmed = value.trim().toLowerCase();
    return trimmed.startsWith('<svg') || trimmed.includes('<svg');
  }

  private styleSetColor(style: string, key: 'stroke' | 'fill', color: string): string {
    const hasKey = new RegExp(`${key}\\s*:`).test(style);
    if (hasKey) {
      return style.replace(new RegExp(`${key}\\s*:[^;]+`), `${key}:${color}`);
    }
    const suffix = style.trim().endsWith(';') || style.trim() === '' ? '' : ';';
    return `${style}${suffix}${key}:${color};`;
  }

  private tintSvg(svgText: string, strokeColor?: string, fillColor?: string): string {
    if (!strokeColor && !fillColor) return svgText;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === 'parsererror') {
      return svgText;
    }

    const all = [root, ...Array.from(root.querySelectorAll('*'))] as Element[];
    for (const el of all) {
      const stroke = el.getAttribute('stroke');
      if (strokeColor && stroke !== null && stroke.toLowerCase() !== 'none') {
        el.setAttribute('stroke', strokeColor);
      }
      const fill = el.getAttribute('fill');
      if (fillColor && fill !== null && fill.toLowerCase() !== 'none') {
        el.setAttribute('fill', fillColor);
      }
      const style = el.getAttribute('style');
      if (style) {
        let next = style;
        if (strokeColor && /stroke\s*:\s*(?!none)/.test(style)) {
          next = this.styleSetColor(next, 'stroke', strokeColor);
        }
        if (fillColor && /fill\s*:\s*(?!none)/.test(style)) {
          next = this.styleSetColor(next, 'fill', fillColor);
        }
        if (next !== style) {
          el.setAttribute('style', next);
        }
      }
    }

    return new XMLSerializer().serializeToString(root);
  }

  private svgToDataUrl(svg: string): string {
    const encoded = encodeURIComponent(svg)
      .replace(/%0A/g, '')
      .replace(/%0D/g, '')
      .replace(/%09/g, ' ')
      .replace(/%20/g, ' ');
    return `data:image/svg+xml;utf8,${encoded}`;
  }

  private escapeAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private createEmptySvg(width: number, height: number, backgroundColor: string, includeBackground: boolean): string {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      includeBackground ? `<rect width="100%" height="100%" fill="${backgroundColor}"/>` : '',
      '</svg>',
    ].join('');
  }

  private escapeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
