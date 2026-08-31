import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramRenderer } from '../core/DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { Group } from '../elements/Group';
import { StyleManager } from '../styles/StyleManager';
import { Serializer, SerializerValidationError } from './Serializer';
import { stubAnimationFrame, stubCanvasContext } from '../test/testUtils';
import { CompositeNode } from '../elements/composite/CompositeNode';
import { container, text, icon, divider, shape } from '../elements/composite';
import { deserializeCComponent } from '../elements/composite/deserialize';
import type { SerializedCompositeNode } from '../types';

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

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
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

  it('round-trips local style overrides without baking theme or selected styles', () => {
    const sourceCanvas = document.createElement('canvas');
    const source = new DiagramRenderer(sourceCanvas, { width: 300, height: 200 });
    const styles = new StyleManager();
    styles.registerClass({
      name: 'warning',
      node: { fillColor: '#fef3c7' },
      edge: { strokeColor: '#d97706' },
      text: { color: '#92400e' },
      group: { fillColor: '#fffbeb' },
    });
    source.setStyleManager(styles);

    const nodeA = new RectangleNode({
      id: 'node-a',
      x: 10,
      y: 10,
      width: 50,
      height: 40,
      style: { opacity: 0.75 },
      styleClass: 'warning',
      label: {
        text: 'Node A',
        style: { fontWeight: 'bold' },
        styleClass: 'warning',
      },
    });
    const nodeB = new RectangleNode({
      id: 'node-b',
      x: 200,
      y: 100,
      width: 50,
      height: 40,
    });
    const edge = new Edge({
      id: 'edge-a',
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      style: { lineDash: [3, 2] },
      styleClass: 'warning',
      label: {
        text: 'Edge A',
        style: { fontStyle: 'italic' },
        styleClass: 'warning',
      },
    });
    const group = new Group({
      id: 'group-a',
      style: { opacity: 0.4 },
      styleClass: 'warning',
    });
    group.addChild(nodeA);
    source.addNode(nodeA);
    source.addNode(nodeB);
    source.addEdge(edge);
    source.addGroup(group);

    nodeA.state = 'selected';
    edge.state = 'selected';
    nodeA.applyStyleManager(styles);
    edge.applyStyleManager(styles);
    group.applyStyleManager(styles);
    expect(nodeA.style.fillColor).toBe('#fef3c7');
    expect(nodeA.label?.style.color).toBe('#92400e');
    expect(edge.style.strokeColor).toBe('#d97706');
    expect(group.style.fillColor).toBe('#fffbeb');

    const sourceSerializer = new Serializer(source, {
      nodeFactory: (data) => new RectangleNode(data),
      edgeFactory: (data) => new Edge(data),
      groupFactory: (data) => new Group(data),
    });
    const data = sourceSerializer.serialize();

    expect(data.nodes[0]?.style).toEqual({ opacity: 0.75 });
    expect(data.nodes[0]?.label).toEqual({
      text: 'Node A',
      style: { fontWeight: 'bold' },
      styleClass: 'warning',
    });
    expect(data.edges[0]?.style).toEqual({ lineDash: [3, 2] });
    expect(data.edges[0]?.label).toEqual({
      text: 'Edge A',
      style: { fontStyle: 'italic' },
      styleClass: 'warning',
    });
    expect(data.groups[0]?.style).toEqual({ opacity: 0.4 });

    const targetCanvas = document.createElement('canvas');
    const target = new DiagramRenderer(targetCanvas, { width: 300, height: 200 });
    const targetSerializer = new Serializer(target, {
      nodeFactory: (serialized) => new RectangleNode(serialized),
      edgeFactory: (serialized) => new Edge(serialized),
      groupFactory: (serialized) => new Group(serialized),
    });
    targetSerializer.deserialize(data);

    expect(target.nodes.get('node-a')?.styleOverrides).toEqual({ opacity: 0.75 });
    expect(target.nodes.get('node-a')?.label?.styleOverrides).toEqual({
      fontWeight: 'bold',
    });
    expect(target.edges.get('edge-a')?.styleOverrides).toEqual({ lineDash: [3, 2] });
    expect(target.edges.get('edge-a')?.label?.styleOverrides).toEqual({
      fontStyle: 'italic',
    });
    expect(target.groups.get('group-a')?.styleOverrides).toEqual({ opacity: 0.4 });

    source.destroy();
    target.destroy();
  });

  it('round-trips badges, proportional content insets, edge anchors, labels, and padding', () => {
    const sourceCanvas = document.createElement('canvas');
    const source = new DiagramRenderer(sourceCanvas, { width: 300, height: 200 });
    const nodeA = new RectangleNode({
      id: 'node-a',
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      contentInset: { top: 8, right: 4, bottom: 8, left: 4 },
      contentInsetScale: { top: true, left: true },
      contentInsetBaseSize: { width: 100, height: 80 },
      badges: [{ id: 'details', iconUrl: '/details.svg' }],
    });
    const nodeB = new RectangleNode({
      id: 'node-b',
      x: 200,
      y: 100,
      width: 50,
      height: 40,
    });
    const edge = new Edge({
      id: 'edge-a',
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      lockAnchors: false,
      label: {
        text: 'Detailed edge',
        style: { color: '#123456' },
        maxWidth: 88,
        inset: 3,
        styleClass: 'caption',
      },
    });
    const group = new Group({ id: 'group-a', padding: 7 });
    group.addChild(nodeA);
    source.addNode(nodeA);
    source.addNode(nodeB);
    source.addEdge(edge);
    source.addGroup(group);

    const sourceSerializer = new Serializer(source, {
      nodeFactory: (data) => new RectangleNode(data),
      edgeFactory: (data) => new Edge(data),
      groupFactory: (data) => new Group(data),
    });
    const data = sourceSerializer.serialize();

    expect(data.nodes[0]?.badges).toEqual([{ id: 'details', iconUrl: '/details.svg' }]);
    expect(data.nodes[0]?.contentInsetScale).toEqual({ top: true, left: true });
    expect(data.nodes[0]?.contentInsetBaseSize).toEqual({ width: 100, height: 80 });
    expect(data.edges[0]?.lockAnchors).toBe(false);
    expect(data.edges[0]?.label).toEqual({
      text: 'Detailed edge',
      style: { color: '#123456' },
      maxWidth: 88,
      inset: 3,
      styleClass: 'caption',
    });
    expect(data.groups[0]?.padding).toBe(7);

    const targetCanvas = document.createElement('canvas');
    const target = new DiagramRenderer(targetCanvas, { width: 300, height: 200 });
    const targetSerializer = new Serializer(target, {
      nodeFactory: (serialized) => new RectangleNode(serialized),
      edgeFactory: (serialized) => new Edge(serialized),
      groupFactory: (serialized) => new Group(serialized),
    });
    targetSerializer.deserialize(data);

    expect(target.nodes.get('node-a')?.badges).toEqual([
      { id: 'details', iconUrl: '/details.svg' },
    ]);
    expect(target.nodes.get('node-a')?.contentInsetScale).toEqual({
      top: true,
      left: true,
    });
    expect(target.nodes.get('node-a')?.contentInsetBaseSize).toEqual({
      width: 100,
      height: 80,
    });
    expect(target.edges.get('edge-a')?.lockAnchors).toBe(false);
    expect(target.edges.get('edge-a')?.label?.styleOverrides).toEqual({
      color: '#123456',
    });
    expect(target.groups.get('group-a')?.padding).toBe(7);

    source.destroy();
    target.destroy();
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
        labelBackground: { color: '#f0f0f0', borderRadius: 4 },
      });
      renderer.addEdge(edge);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const serializedEdge = data.edges[0]!;

      expect(serializedEdge.labelOffset).toBe(15);
      expect(serializedEdge.labelBackground).toEqual({ color: '#f0f0f0', borderRadius: 4 });

      renderer.destroy();
    });
  });

  describe('CompositeNode serialization', () => {
    it('serializes CompositeNode with content tree', () => {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 300, height: 200 });

      const node = new CompositeNode({
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        shapeType: 'rectangle',
        cornerRadius: 8,
        content: container({
          direction: 'column',
          padding: 8,
          children: [
            text({ id: 'title', text: 'Hello', fontWeight: 'bold', bindToProperty: '__name__' }),
            divider({ color: '#333' }),
            text({ id: 'desc', text: 'Description' }),
          ],
        }),
      });
      renderer.addNode(node);

      const serializer = new Serializer(renderer, {
        nodeFactory: (data) => new RectangleNode(data),
        edgeFactory: (data) => new Edge(data),
      });

      const data = serializer.serialize();
      const sn = data.nodes[0] as SerializedCompositeNode;

      expect(sn.type).toBe('composite');
      expect(sn.shapeType).toBe('rectangle');
      expect(sn.cornerRadius).toBe(8);
      expect(sn.autoSize).toBe(false);
      expect(sn.content).toBeDefined();
      expect(sn.content.type).toBe('container');
      expect(sn.content.children).toHaveLength(3);
      expect(sn.content.children![0]!.type).toBe('text');
      expect(sn.content.children![0]!.text).toBe('Hello');
      expect(sn.content.children![0]!.bindToProperty).toBe('__name__');
      expect(sn.content.children![1]!.type).toBe('divider');

      renderer.destroy();
    });

    it('deserializeCComponent round-trips a component tree', () => {
      const original = container({
        direction: 'column',
        padding: 8,
        gap: 4,
        children: [
          text({ id: 'name', text: 'Title', fontWeight: 'bold', bindToProperty: '__name__' }),
          icon({ id: 'mainIcon', source: '/icons/component.svg', bindsNotationIcon: true }),
          shape({
            backgroundColor: '#eee',
            padding: 4,
            content: container({
              children: [text({ text: 'Nested' })],
            }),
          }),
          divider({ color: '#333', thickness: 2 }),
        ],
      });

      const serialized = original.serialize();
      const restored = deserializeCComponent(serialized);

      expect(restored.type).toBe('container');
      const restoredSerialized = restored.serialize();
      expect(restoredSerialized).toEqual(serialized);
      expect(restoredSerialized.children?.[1]?.type).toBe('icon');
      expect(restoredSerialized.children?.[1]?.bindsNotationIcon).toBe(true);
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

      const invalidData = {
        nodes: [],
        edges: [],
        groups: [],
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      };

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
        edges: [
          {
            id: 'edge1',
            from: { nodeId: 'node1' },
            to: { nodeId: 'nonexistent' },
            type: 'straight',
          },
        ],
        groups: [],
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      };

      expect(() => serializer.deserialize(invalidData as never)).toThrow(SerializerValidationError);
      expect(() => serializer.deserialize(invalidData as never)).toThrow(
        'non-existent target node'
      );

      renderer.destroy();
    });
  });
});
