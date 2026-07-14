import { describe, expect, it } from 'vitest';
import { Edge } from '../elements/Edge';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { DARK_THEME, DEFAULT_THEME, StyleManager, type Theme } from './StyleManager';

const OCEAN_THEME: Theme = {
  ...DEFAULT_THEME,
  name: 'ocean',
  colors: {
    ...DEFAULT_THEME.colors,
    background: '#0b1f33',
  },
  node: {
    ...DEFAULT_THEME.node,
    default: {
      ...DEFAULT_THEME.node.default,
      fillColor: '#dbeafe',
      strokeColor: '#1d4ed8',
    },
    selected: {
      ...DEFAULT_THEME.node.selected,
      strokeColor: '#0e7490',
    },
  },
  edge: {
    ...DEFAULT_THEME.edge,
    default: {
      ...DEFAULT_THEME.edge.default,
      strokeColor: '#0284c7',
    },
    selected: {
      ...DEFAULT_THEME.edge.selected,
      strokeColor: '#0891b2',
    },
  },
};

describe('StyleManager', () => {
  it('registers a custom theme and activates it by name', () => {
    const styles = new StyleManager();

    styles.registerTheme(OCEAN_THEME);
    styles.setTheme('ocean');

    expect(styles.getThemeNames()).toEqual(expect.arrayContaining(['default', 'dark', 'ocean']));
    expect(styles.theme).toBe(OCEAN_THEME);
    expect(styles.getNodeStyle('normal')).toMatchObject({
      fillColor: '#dbeafe',
      strokeColor: '#1d4ed8',
    });
  });

  it('uses dark theme state styles', () => {
    const styles = new StyleManager('dark');

    expect(styles.theme).toBe(DARK_THEME);
    expect(styles.getNodeStyle('dragging')).toMatchObject({
      fillColor: '#404040',
      opacity: 0.8,
    });
    expect(styles.getEdgeStyle('selected')).toMatchObject({
      strokeColor: '#818cf8',
      strokeWidth: 3,
    });
  });

  it('merges a registered class over theme styles for node and edge states', () => {
    const styles = new StyleManager(OCEAN_THEME);
    styles.registerClass({
      name: 'emphasis',
      node: { strokeColor: '#db2777', opacity: 0.7 },
      edge: { strokeColor: '#db2777', lineDash: [4, 2] },
    });

    expect(styles.getClass('emphasis')).toMatchObject({ name: 'emphasis' });
    expect(styles.getNodeStyle('selected', 'emphasis')).toMatchObject({
      fillColor: '#dbeafe',
      strokeColor: '#db2777',
      opacity: 0.7,
    });
    expect(styles.getEdgeStyle('selected', 'emphasis')).toMatchObject({
      strokeColor: '#db2777',
      strokeWidth: 3,
      lineDash: [4, 2],
    });
  });

  it('lets node and edge element overrides win over class and state styles', () => {
    const styles = new StyleManager(OCEAN_THEME);
    styles.registerClass({
      name: 'emphasis',
      node: { fillColor: '#fce7f3', strokeWidth: 4 },
      edge: { strokeColor: '#db2777', strokeWidth: 4 },
    });
    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      styleClass: 'emphasis',
      style: { fillColor: '#fef08a', strokeWidth: 9 },
    });
    const edge = new Edge({
      from: { nodeId: 'source' },
      to: { nodeId: 'target' },
      styleClass: 'emphasis',
      style: { strokeWidth: 9, opacity: 0.4 },
    });

    node.state = 'selected';
    edge.state = 'selected';
    node.applyStyleManager(styles);
    edge.applyStyleManager(styles);

    expect(node.style).toMatchObject({
      fillColor: '#fef08a',
      strokeColor: '#0e7490',
      strokeWidth: 9,
    });
    expect(edge.style).toMatchObject({
      strokeColor: '#db2777',
      strokeWidth: 9,
      opacity: 0.4,
    });
  });
});
