import type { DiagramRenderer } from '@/core/DiagramRenderer';
import type { Point } from '@/types';
import type { Edge } from '@/elements/Edge';
import type { Node } from '@/elements/Node';
import type { Group } from '@/elements/Group';
import type { ArrowMarkerConfig, TextStyle } from '@/types';
import { applyStyleManagerToElements } from './applyStyleManager';
import { getContentBounds } from './contentBounds';
import { downloadBlob } from './download';

export interface SvgExportOptions {
  padding?: number;
  backgroundColor?: string;
  includeBackground?: boolean;
  /**
   * Global Y-offset for edge labels in SVG export.
   * Does not use runtime edge.labelOffset unless explicitly passed here.
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
    const edgeLabelOffset = options.edgeLabelOffset ?? 0;

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
    const markerDefs = new Map<string, string>();
    const renderedEdges: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    );
    for (const edge of this.renderer.edges.values()) {
      if (edge.visible) {
        renderedEdges.push(this.renderEdge(edge, markerDefs, edgeLabelOffset));
      }
    }
    parts.push(this.buildDefs(markerDefs));
    if (includeBackground) {
      parts.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);
    }
    parts.push(`<g transform="translate(${offsetX}, ${offsetY})">`);

    for (const group of this.renderer.groups.values()) {
      if (group.visible) {
        parts.push(this.renderGroup(group));
      }
    }

    parts.push(...renderedEdges);

    for (const node of this.renderer.nodes.values()) {
      if (node.visible) {
        parts.push(this.renderNode(node));
      }
    }

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
    const opacity = style.opacity ?? 1;

    let shape: string;
    switch (node.typeName) {
      case 'rectangle': {
        const radius = (style.cornerRadius ?? 0).toString();
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
      default: {
        shape = `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"`;
      }
    }

    const label = node.label
      ? this.renderTextLabel(node.label.text, node.getCenter(), node.label.style)
      : '';

    return [
      `${shape} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`,
      label,
    ].join('');
  }

  private renderEdge(edge: Edge, markerDefs: Map<string, string>, edgeLabelOffset: number): string {
    const path = edge.path;
    if (path.length < 2) {
      return '';
    }

    const style = edge.style;
    const stroke = style.strokeColor ?? '#666666';
    const strokeWidth = style.strokeWidth ?? 2;
    const opacity = style.opacity ?? 1;
    const dashValues = style.flowDash ?? style.lineDash;
    const dash = dashValues ? ` stroke-dasharray="${dashValues.join(' ')}"` : '';
    const dashOffset =
      style.lineDashOffset !== undefined ? ` stroke-dashoffset="${style.lineDashOffset}"` : '';

    const d = this.buildPath(edge);
    const startMarkerConfig = this.resolveMarkerConfig(edge, 'start');
    const endMarkerConfig = this.resolveMarkerConfig(edge, 'end');
    const markerStart = startMarkerConfig
      ? ` marker-start="url(#${this.ensureMarkerDef(markerDefs, startMarkerConfig, 'start', stroke)})"`
      : '';
    const markerEnd = endMarkerConfig
      ? ` marker-end="url(#${this.ensureMarkerDef(markerDefs, endMarkerConfig, 'end', stroke)})"`
      : '';

    const label = edge.label
      ? this.renderTextLabel(edge.label.text, this.getEdgeLabelPoint(edge, edgeLabelOffset), edge.label.style)
      : '';

    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" color="${stroke}"${dash}${dashOffset}${markerStart}${markerEnd}/>${label}`;
  }

  private resolveMarkerConfig(edge: Edge, side: 'start' | 'end'): ArrowMarkerConfig | null {
    const marker = side === 'start' ? edge.startMarker : edge.endMarker;
    if (marker && marker.type !== 'none') {
      return marker;
    }

    if (side === 'end') {
      return edge.arrowType === 'none' ? null : { type: 'arrow' };
    }

    return edge.arrowType === 'double' ? { type: 'arrow' } : null;
  }

  private ensureMarkerDef(
    markerDefs: Map<string, string>,
    marker: ArrowMarkerConfig,
    side: 'start' | 'end',
    stroke: string
  ): string {
    const size = marker.size ?? 12;
    const markerStroke = marker.strokeColor ?? stroke;
    const markerFill = marker.fillColor ?? markerStroke;
    const fillOpacity = marker.fillOpacity ?? 1;
    const markerId = this.buildMarkerId(side, marker.type, size, markerFill, markerStroke, fillOpacity);

    if (!markerDefs.has(markerId)) {
      const refX = marker.type === 'circle' ? 5 : 10;
      markerDefs.set(
        markerId,
        [
          `<marker id="${markerId}" viewBox="0 0 10 10" refX="${refX}" refY="5" markerWidth="${size}" markerHeight="${size}" orient="auto-start-reverse" markerUnits="userSpaceOnUse">`,
          this.renderMarkerShape(marker, markerFill, markerStroke, fillOpacity),
          `</marker>`,
        ].join('')
      );
    }

    return markerId;
  }

  private buildMarkerId(
    side: 'start' | 'end',
    type: string,
    size: number,
    fill: string,
    stroke: string,
    fillOpacity: number
  ): string {
    const token = `${side}-${type}-${size}-${fill}-${stroke}-${fillOpacity}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    return `marker-${token}`;
  }

  private renderMarkerShape(
    marker: ArrowMarkerConfig,
    fill: string,
    stroke: string,
    fillOpacity: number
  ): string {
    switch (marker.type) {
      case 'open':
        return `<path d="M 10 0 L 0 5 L 10 10" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'diamond':
        return `<path d="M 10 5 L 5 0 L 0 5 L 5 10 z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
      case 'circle':
        return `<circle cx="5" cy="5" r="4" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
      case 'arrow':
      default:
        return `<path d="M 0 0 L 10 5 L 0 10 z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
    }
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

  private getEdgeLabelPoint(edge: Edge, edgeLabelOffset: number): Point {
    const midpoint = this.getPathMidpoint(edge);
    return {
      x: midpoint.x,
      y: midpoint.y + edgeLabelOffset,
    };
  }

  private renderTextLabel(text: string, point: Point, style: TextStyle = {}): string {
    const fill = style.color ?? '#000000';
    const fontSize = style.fontSize ?? 14;
    const fontFamily = style.fontFamily ?? 'sans-serif';
    const fontWeight = style.fontWeight ?? 'normal';
    const anchor = style.align === 'left' ? 'start' : style.align === 'right' ? 'end' : 'middle';
    const baseline =
      style.baseline === 'top'
        ? 'text-before-edge'
        : style.baseline === 'bottom'
        ? 'text-after-edge'
        : 'middle';

    return `<text x="${point.x}" y="${point.y}" fill="${fill}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}" dominant-baseline="${baseline}">${this.escapeText(
      text
    )}</text>`;
  }

  private buildDefs(markerDefs: Map<string, string>): string {
    if (markerDefs.size === 0) {
      return '<defs></defs>';
    }
    return `<defs>${Array.from(markerDefs.values()).join('')}</defs>`;
  }

  private createEmptySvg(width: number, height: number, backgroundColor: string, includeBackground: boolean): string {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
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
