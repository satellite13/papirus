import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramRenderer } from '../core/DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { StyleManager } from '../styles/StyleManager';
import { Serializer, SerializerValidationError } from './Serializer';
import { stubAnimationFrame, stubCanvasContext } from '../test/testUtils';

describe('Serializer', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('serializes theme and style classes', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

    const styles = new StyleManager();
    styles.registerClass({
      name: 'warning',
      node: { fillColor: '#fef3c7', strokeColor: '#d97706' },
    });
    renderer.setStyleManager(styles);

    const nodeA = new RectangleNode({ x: 10, y: 10, width: 50, height: 40, styleClass: 'warning' });
    const nodeB = new RectangleNode({ x: 200, y: 100, width: 50, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({ from: { nodeId: nodeA.id }, to: { nodeId: nodeB.id }, type: 'straight' });
    renderer.addEdge(edge);

    const serializer = new Serializer(renderer, {
      nodeFactory: (data) => new RectangleNode(data),
      edgeFactory: (data) => new Edge(data),
    });

    const data = serializer.serialize();
    expect(data.theme?.name).toBe('default');
    expect(data.styleClasses?.length).toBe(1);

    renderer.destroy();
  });

  describe('node icon serialization', () => {
    it('serializes node icon with all options', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const node = new RectangleNode({
        x: 10,
        y: 10,
        width: 100,
        height: 80,
        icon: {
          source: 'https://example.com/icon.png',
          fit: 'contain',
          placement: 'top',
          inset: 10,
        },
      });
      renderer.addNode(node);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedNode = data.nodes[0]!;

      expect(serializedNode.icon).toBeDefined();
      expect(serializedNode.icon?.source).toBe('https://example.com/icon.png');
      expect(serializedNode.icon?.fit).toBe('contain');
      expect(serializedNode.icon?.placement).toBe('top');
      expect(serializedNode.icon?.inset).toBe(10);

      renderer.destroy();
    });
  });

  describe('node anchor points serialization', () => {
    it('serializes custom anchor points', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const node = new RectangleNode({
        x: 10,
        y: 10,
        width: 100,
        height: 80,
        anchorPoints: { top: 3, right: 2, bottom: 3, left: 2 },
      });
      renderer.addNode(node);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedNode = data.nodes[0]!;

      expect(serializedNode.anchorPoints).toBeDefined();
      expect(serializedNode.anchorPoints?.top).toBe(3);
      expect(serializedNode.anchorPoints?.right).toBe(2);

      renderer.destroy();
    });

    it('does not serialize default anchor points', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const node = new RectangleNode({
        x: 10,
        y: 10,
        width: 100,
        height: 80,
      });
      renderer.addNode(node);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedNode = data.nodes[0]!;

      expect(serializedNode.anchorPoints).toBeUndefined();

      renderer.destroy();
    });
  });

  describe('edge marker serialization', () => {
    it('serializes edge markers', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const nodeA = new RectangleNode({ x: 10, y: 10, width: 50, height: 40 });
      const nodeB = new RectangleNode({ x: 200, y: 100, width: 50, height: 40 });
      renderer.addNode(nodeA);
      renderer.addNode(nodeB);

      const edge = new Edge({
        from: { nodeId: nodeA.id },
        to: { nodeId: nodeB.id },
        startMarker: { type: 'circle', size: 6 },
        endMarker: { type: 'arrow', size: 12 },
      });
      renderer.addEdge(edge);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedEdge = data.edges[0]!;

      expect(serializedEdge.startMarker).toEqual({ type: 'circle', size: 6 });
      expect(serializedEdge.endMarker).toEqual({ type: 'arrow', size: 12 });

      renderer.destroy();
    });

    it('serializes edge label offset and background', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const nodeA = new RectangleNode({ x: 10, y: 10, width: 50, height: 40 });
      const nodeB = new RectangleNode({ x: 200, y: 100, width: 50, height: 40 });
      renderer.addNode(nodeA);
      renderer.addNode(nodeB);

      const edge = new Edge({
        from: { nodeId: nodeA.id },
        to: { nodeId: nodeB.id },
        label: 'Test',
        labelOffset: 15,
        labelBackground: { color: '#f0f0f0', padding: 8, borderRadius: 4 },
      });
      renderer.addEdge(edge);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedEdge = data.edges[0]!;

      expect(serializedEdge.labelOffset).toBe(15);
      expect(serializedEdge.labelBackground).toEqual({ color: '#f0f0f0', padding: 8, borderRadius: 4 });

      renderer.destroy();
    });
  });

  describe('validation', () => {
    it('throws error for missing version', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const invalidData = { nodes: [], edges: [], groups: [], viewport: { zoom: 1, offsetX: 0, offsetY: 0 } };

      expect(() => serializer.deserialize(invalidData as never)).toThrow(SerializerValidationError);
      expect(() => serializer.deserialize(invalidData as never)).toThrow('Missing version field');

      renderer.destroy();
    });

    it('throws error for edge referencing non-existent node', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const invalidData = {
        version: '1.1',
        nodes: [{ id: 'node1', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 }],
        edges: [{ id: 'edge1', from: { nodeId: 'node1' }, to: { nodeId: 'nonexistent' }, type: 'straight' }],
        groups: [],
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      };

      expect(() => serializer.deserialize(invalidData as never)).toThrow(SerializerValidationError);
      expect(() => serializer.deserialize(invalidData as never)).toThrow('non-existent target node');

      renderer.destroy();
    });
  });
});
