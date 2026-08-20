import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramRenderer } from '@/core/DiagramRenderer';
import { Edge } from '@/elements/Edge';
import { RectangleNode } from '@/elements/nodes/RectangleNode';
import { CompositeNode } from '@/elements/composite/CompositeNode';
import { container, text, divider } from '@/elements/composite';
import { stubAnimationFrame, stubCanvasContext } from '@/test/testUtils';
import { SvgExporter } from './SvgExporter';

class FakeImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

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

  it('exports filled stealth end marker', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const a = new RectangleNode({ x: 0, y: 0, width: 40, height: 40 });
    const b = new RectangleNode({ x: 200, y: 0, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({ from: { nodeId: a.id }, to: { nodeId: b.id }, type: 'straight' });
    edge.startMarker = { type: 'none' };
    edge.endMarker = { type: 'stealth', size: 12 };
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

  it('exports CompositeNode with content tree', () => {
    vi.stubGlobal('Image', FakeImage);
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });

    const node = new CompositeNode({
      x: 10, y: 10, width: 200, height: 100,
      shapeType: 'rectangle',
      cornerRadius: 4,
      content: container({
        direction: 'column',
        padding: 8,
        children: [
          text({ text: 'Title', fontWeight: 'bold' }),
          divider({ color: '#333' }),
          text({ text: 'Description' }),
        ],
      }),
    });
    renderer.addNode(node);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });

    // Should contain the outer rect shape
    expect(svg).toContain('<rect');
    expect(svg).toContain('rx="4"');
    // Should contain text elements from content tree
    expect(svg).toContain('Title');
    expect(svg).toContain('Description');
    // Should contain divider line
    expect(svg).toContain('<line');

    renderer.destroy();
  });

  it('exports CompositeNode with circle shape', () => {
    vi.stubGlobal('Image', FakeImage);
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });

    const node = new CompositeNode({
      x: 10, y: 10, width: 100, height: 100,
      shapeType: 'circle',
      content: container({
        children: [text({ text: 'Center' })],
      }),
    });
    renderer.addNode(node);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });

    expect(svg).toContain('<ellipse');
    expect(svg).toContain('Center');

    renderer.destroy();
  });

  it('exports CompositeNode with custom shape via svgPath', () => {
    vi.stubGlobal('Image', FakeImage);
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });

    const node = new CompositeNode({
      x: 10,
      y: 10,
      width: 200,
      height: 100,
      shapeType: 'custom',
      pathFactory: (w, h) => {
        const path = new Path2D();
        const cut = Math.min(w, h) * 0.16;
        path.moveTo(cut, 0);
        path.lineTo(w - cut, 0);
        path.lineTo(w, cut);
        path.lineTo(w, h - cut);
        path.lineTo(w - cut, h);
        path.lineTo(cut, h);
        path.lineTo(0, h - cut);
        path.lineTo(0, cut);
        path.closePath();
        return path;
      },
      svgPath: (w, h) => {
        const cut = Math.min(w, h) * 0.16;
        return `M ${cut} 0 L ${w - cut} 0 L ${w} ${cut} L ${w} ${h - cut} L ${w - cut} ${h} L ${cut} ${h} L 0 ${h - cut} L 0 ${cut} Z`;
      },
      content: container({
        children: [text({ text: 'Custom frame' })],
      }),
    });
    renderer.addNode(node);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });

    expect(svg).toContain('<path d="M');
    expect(svg).not.toMatch(/<rect x="10" y="10" width="200" height="100"/);
    expect(svg).toContain('Custom frame');

    renderer.destroy();
  });

  it('rotates edge label in SVG when labelFollowPath is enabled', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const a = new RectangleNode({ x: 20, y: 20, width: 40, height: 40 });
    const b = new RectangleNode({ x: 220, y: 160, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({
      from: { nodeId: a.id },
      to: { nodeId: b.id },
      type: 'straight',
      label: 'Flow',
      labelFollowPath: true,
      labelBackground: { color: '#fff', opacity: 1, borderRadius: 0 },
    });
    edge.updateEndpoints(
      { x: a.x + a.width, y: a.y + a.height / 2 },
      { x: b.x, y: b.y + b.height / 2 }
    );
    renderer.addEdge(edge);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    expect(svg).toMatch(/<text[^>]*transform="rotate\([^)]+\s[\d.]+\s[\d.]+\)"/);
    expect(svg).toMatch(/<rect[^>]*transform="rotate\([^)]+\s[\d.]+\s[\d.]+\)"/);

    renderer.destroy();
  });

  it('cuts SVG edge path under label when labelLineGap is enabled', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const a = new RectangleNode({ x: 20, y: 20, width: 40, height: 40 });
    const b = new RectangleNode({ x: 280, y: 20, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({
      from: { nodeId: a.id },
      to: { nodeId: b.id },
      type: 'straight',
      label: 'Very long label for visible gap',
      labelLineGap: true,
    });
    edge.updateEndpoints(
      { x: a.x + a.width, y: a.y + a.height / 2 },
      { x: b.x, y: b.y + b.height / 2 }
    );
    renderer.addEdge(edge);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    const pathMatch = svg.match(/<path d="([^"]+)" fill="none"/);
    expect(pathMatch).not.toBeNull();
    expect(pathMatch?.[1]).toContain(' M ');

    renderer.destroy();
  });

  it('exports bezier edge with rotated label and line gap together', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 350, retina: false });
    const a = new RectangleNode({ x: 40, y: 180, width: 40, height: 40 });
    const b = new RectangleNode({ x: 360, y: 80, width: 40, height: 40 });
    renderer.addNode(a);
    renderer.addNode(b);

    const edge = new Edge({
      from: { nodeId: a.id },
      to: { nodeId: b.id },
      type: 'bezier',
      label: 'Bezier label',
      labelFollowPath: true,
      labelLineGap: true,
      labelBackground: { color: '#fff', opacity: 1, borderRadius: 4 },
    });
    edge.updateEndpoints(
      { x: a.x + a.width, y: a.y + a.height / 2 },
      { x: b.x, y: b.y + b.height / 2 }
    );
    renderer.addEdge(edge);

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    const pathMatch = svg.match(/<path d="([^"]+)" fill="none"/);
    expect(pathMatch).not.toBeNull();
    expect(pathMatch?.[1]).toContain(' M ');
    expect(svg).toMatch(/<text[^>]*transform="rotate\([^)]+\s[\d.]+\s[\d.]+\)"/);
    expect(svg).toMatch(/<rect[^>]*transform="rotate\([^)]+\s[\d.]+\s[\d.]+\)"/);

    renderer.destroy();
  });

  it('exports an external composite name once, outside the shape', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    renderer.addNode(
      new CompositeNode({
        x: 40,
        y: 20,
        width: 36,
        height: 36,
        label: 'Start',
        labelPlacement: 'bottom',
        shapeType: 'circle',
        content: container({
          children: [
            text({ text: 'Start', color: '#cc2244', fontStyle: 'italic', bindToProperty: '__name__' }),
          ],
        }),
      })
    );

    const svg = new SvgExporter(renderer).exportSVG({ includeBackground: false });
    expect(svg.match(/>Start</g)).toHaveLength(1);
    expect(svg).toMatch(/<text[^>]*y="[5-9]\d/);
    expect(svg).toMatch(/<text[^>]*fill="#cc2244"/);
    expect(svg).toMatch(/<text[^>]*font-style="italic"/);

    renderer.destroy();
  });
});
