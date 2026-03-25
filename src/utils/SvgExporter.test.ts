import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramRenderer } from '@/core/DiagramRenderer';
import { Edge } from '@/elements/Edge';
import { RectangleNode } from '@/elements/nodes/RectangleNode';
import { stubAnimationFrame, stubCanvasContext } from '@/test/testUtils';
import { SvgExporter } from './SvgExporter';

describe('SvgExporter', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  /** Closed arrow/diamond SVG markers use path … Z with a non-none fill. */
  function filledMarkerPathCount(svg: string): number {
    return (svg.match(/Z" fill="(?!none)[^"]*"/g) ?? []).length;
  }

  it('does not add end marker from arrowType when explicit markers are used and end is none', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const a = new RectangleNode({ x: 0, y: 0, width: 40, height: 40 });
    const b = new RectangleNode({ x: 200, y: 0, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({ from: { nodeId: a.id }, to: { nodeId: b.id }, type: 'straight' });
    edge.startMarker = { type: 'arrow' };
    edge.endMarker = { type: 'none' };
    edge.updateEndpoints({ x: 40, y: 20 }, { x: 200, y: 20 });
    renderer.addEdge(edge);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    expect(filledMarkerPathCount(svg)).toBe(1);

    renderer.destroy();
  });

  it('does not draw markers when both ends are explicitly none (ignores default arrowType)', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const a = new RectangleNode({ x: 0, y: 0, width: 40, height: 40 });
    const b = new RectangleNode({ x: 200, y: 0, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({ from: { nodeId: a.id }, to: { nodeId: b.id }, type: 'straight' });
    edge.startMarker = { type: 'none' };
    edge.endMarker = { type: 'none' };
    edge.updateEndpoints({ x: 40, y: 20 }, { x: 200, y: 20 });
    renderer.addEdge(edge);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    expect(filledMarkerPathCount(svg)).toBe(0);

    renderer.destroy();
  });
});
