import {
  DiagramRenderer,
  RectangleNode,
  CircleNode,
  DiamondNode,
  Edge,
  TextLabel,
  StyleManager,
  ImageExporter,
  SvgExporter,
  Serializer,
  GridOverlay,
  MiniMap,
  Group,
  SearchManager,
} from '../../dist/papirus.js';

// Initialize renderer
const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 550,
  backgroundColor: '#fafafa',
  animations: {
    enabled: true,
    enterDuration: 220,
    exitDuration: 180,
    highlightDuration: 420,
    enterScale: 0.94,
    exitScale: 0.98,
  },
});

function syncCanvasSize() {
  const canvas = renderer.getCanvas();
  const parent = canvas.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));
  if (renderer.width !== width || renderer.height !== height) {
    renderer.resize(width, height);
  }
}

function syncCanvasSizeAfterPageRender() {
  requestAnimationFrame(() => requestAnimationFrame(syncCanvasSize));
}

if (document.readyState === 'complete') {
  syncCanvasSizeAfterPageRender();
} else {
  window.addEventListener('load', syncCanvasSizeAfterPageRender, { once: true });
}

const imageExporter = new ImageExporter(renderer);
const svgExporter = new SvgExporter(renderer);

// Factories
const nodeFactory = (data) => {
  const baseOptions = {
    id: data.id,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    style: data.style,
    styleClass: data.styleClass,
    label: data.label
      ? typeof data.label === 'string'
        ? { text: data.label, styleClass: data.labelStyleClass }
        : data.label
      : undefined,
    icon: data.icon,
    anchorPoints: data.anchorPoints,
    ports: data.ports?.map((port) => ({
      id: port.id,
      type: port.type,
      position: port.position,
      styleClass: port.styleClass,
    })),
  };

  switch (data.type) {
    case 'circle':
      return new CircleNode(baseOptions);
    case 'diamond':
      return new DiamondNode(baseOptions);
    case 'rectangle':
    default:
      return new RectangleNode(baseOptions);
  }
};

const edgeFactory = (data) =>
  new Edge({
    id: data.id,
    from: data.from,
    to: data.to,
    type: data.type,
    startMarker: data.startMarker,
    endMarker: data.endMarker,
    style: data.style,
    styleClass: data.styleClass,
    label: data.label
      ? typeof data.label === 'string'
        ? { text: data.label, styleClass: data.labelStyleClass }
        : data.label
      : undefined,
    labelOffset: data.labelOffset,
    labelBackground: data.labelBackground,
  });

const serializer = new Serializer(renderer, { nodeFactory, edgeFactory });

// Style manager with theme classes
const styles = new StyleManager('default');
styles.registerClass({
  name: 'success',
  node: { fillColor: '#dcfce7', strokeColor: '#16a34a', strokeWidth: 1 },
});
styles.registerClass({
  name: 'warning',
  node: { fillColor: '#fef3c7', strokeColor: '#d97706', strokeWidth: 1 },
});
styles.registerClass({
  name: 'error',
  node: { fillColor: '#fee2e2', strokeColor: '#dc2626', strokeWidth: 1 },
  text: { color: '#991b1b' },
});
renderer.setStyleManager(styles);

// Overlays
const gridOverlay = new GridOverlay({ gridSize: 20, color: '#e5e5e5' });
const miniMap = new MiniMap({ width: 140, height: 100, padding: 16 });
renderer.use(gridOverlay);
renderer.use(miniMap);

// Interactions
const interactions = renderer.enableInteractions({
  nodeFactory,
  edgeFactory,
  createEdge: (from, to) => new Edge({
    from,
    to,
    type: 'bezier',
    endMarker: { type: 'open', size: 12 },
  }),
});

// Search manager
const searchManager = new SearchManager(renderer);

// Context menu
const menuIconDelete = `
  <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
`;

renderer.enableContextMenu({
  menu: {
    node: (target) => {
      const groupsWithNode = Array.from(renderer.groups.values()).filter((group) =>
        group.hasChild(target.node.id)
      );
      return [
        {
          label: 'Delete Node',
          icon: { type: 'svg', value: menuIconDelete },
          action: () => interactions.deleteByIds([target.node.id]),
        },
        { separator: true },
        {
          label: 'Remove from Group',
          icon: '⊘',
          enabled: groupsWithNode.length > 0,
          action: () => {
            interactions.removeNodeFromGroups(target.node.id, groupsWithNode.map((g) => g.id));
          },
        },
        { separator: true },
        {
          label: 'Style',
          icon: 'S',
          items: [
            {
              label: '✓ Success',
              action: () => applyNodeStyleClass(target.node.id, 'success'),
            },
            {
              label: '⚠ Warning',
              action: () => applyNodeStyleClass(target.node.id, 'warning'),
            },
            {
              label: '✗ Error',
              action: () => applyNodeStyleClass(target.node.id, 'error'),
            },
            {
              label: 'Clear',
              action: () => {
                interactions.changeNodeProperties(target.node.id, (node) => {
                  node.styleClass = undefined;
                  if (node.label) node.label.styleClass = undefined;
                });
              },
            },
          ],
        },
      ];
    },
    edge: (target) => [
      {
        label: 'Delete Edge',
        icon: { type: 'svg', value: menuIconDelete },
        action: () => interactions.deleteByIds([target.edge.id]),
      }
    ],
    canvas: [
      {
        label: 'Filter: Warning',
        icon: '⚠',
        action: () => searchManager.filter({ styleClass: 'warning' }),
      },
      {
        label: 'Clear Filter',
        icon: '⊘',
        action: () => searchManager.clearFilter(),
      },
      {
        label: 'Add Node Here',
        icon: '+',
        action: (target) => {
          const node = new RectangleNode({
            x: target.point.x - 60,
            y: target.point.y - 30,
            width: 120,
            height: 60,
            label: 'New Node',
          });
          renderer.addNode(node);
        },
      },
    ],
  },
});

function applyNodeStyleClass(nodeId, className) {
  interactions.changeNodeProperties(nodeId, (node) => {
    node.clearStyleOverrides();
    node.styleClass = className;
    if (node.label) node.label.styleClass = className;
  });
}

// Icon SVG
const iconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <rect x="6" y="10" width="36" height="26" rx="6" fill="#2563eb"/>
    <path d="M16 24h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 16v16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </svg>
`;

// Create nodes
const nodes = new Map();

const nodeDefinitions = [
  {
    key: 'start',
    type: 'rectangle',
    options: {
      x: 100, y: 100,
      width: 120, height: 60,
      label: { text: 'Start', padding: 6, margin: 3 },
      anchorPoints: { top: 3, right: 1, bottom: 3, left: 1 },
      style: { cornerRadius: 8, fillColor: '#e0f2fe', strokeColor: '#0284c7' },
    },
  },
  {
    key: 'process',
    type: 'rectangle',
    options: {
      x: 300, y: 100,
      width: 140, height: 60,
      label: { text: 'Process', padding: 6, margin: 4 },
      anchorPoints: { top: 3, right: 1, bottom: 3, left: 1 },
      style: { cornerRadius: 4 },
      icon: {
        source: iconSvg,
        placement: 'left',
        fit: 'contain',
        padding: 8,
        margin: 4,
        gap: 10,
      },
    },
  },
  {
    key: 'check',
    type: 'diamond',
    options: {
      x: 520, y: 80,
      width: 100, height: 100,
      label: 'Check',
      anchorPoints: { top: 1, right: 1, bottom: 1, left: 1 },
      styleClass: 'warning',
    },
  },
  {
    key: 'end',
    type: 'circle',
    options: {
      x: 700, y: 100,
      width: 80, height: 60,
      label: 'End',
      anchorPoints: { top: 1, right: 1, bottom: 1, left: 1 },
      styleClass: 'success',
    },
  },
  {
    key: 'error',
    type: 'rectangle',
    options: {
      x: 520, y: 280,
      width: 120, height: 60,
      label: 'Error',
      anchorPoints: { top: 3, right: 1, bottom: 3, left: 1 },
      style: { cornerRadius: 4 },
      styleClass: 'error',
    },
  },
];

nodeDefinitions.forEach((def) => {
  let node;
  switch (def.type) {
    case 'circle':
      node = new CircleNode(def.options);
      break;
    case 'diamond':
      node = new DiamondNode(def.options);
      break;
    case 'rectangle':
    default:
      node = new RectangleNode(def.options);
  }
  nodes.set(def.key, node);
  renderer.addNode(node);
});

// Create group
const mainGroup = new Group({ label: 'Main Flow' });
mainGroup.addChild(nodes.get('start'));
mainGroup.addChild(nodes.get('process'));
mainGroup.addChild(nodes.get('check'));
mainGroup.addChild(nodes.get('end'));
renderer.addGroup(mainGroup);

// Create edges
const edgeDefinitions = [
  {
    from: 'start', to: 'process', type: 'polyline',
    endMarker: { type: 'open', size: 12 },
  },
  {
    from: 'process', to: 'check', type: 'polyline',
    endMarker: { type: 'open', size: 12 },
  },
  {
    from: 'check', to: 'end', type: 'polyline',
    endMarker: { type: 'open', size: 12 },
    label: 'Yes',
    labelBackground: { color: '#dcfce7', padding: 6, borderRadius: 4 },
  },
  {
    from: 'check', to: 'error', type: 'polyline',
    endMarker: { type: 'open', size: 12 },
    label: 'No',
    labelOffset: 10,
    labelBackground: { color: '#fee2e2', padding: 6, borderRadius: 4 },
  },
];

edgeDefinitions.forEach((def) => {
  const edge = new Edge({
    from: { nodeId: nodes.get(def.from).id },
    to: { nodeId: nodes.get(def.to).id },
    type: def.type,
    startMarker: def.startMarker,
    endMarker: def.endMarker,
    label: def.label,
    labelOffset: def.labelOffset,
    labelBackground: def.labelBackground,
    style: def.style,
  });
  renderer.addEdge(edge);
});

// UI Panel Logic
const nodeStylePanel = document.getElementById('nodeStylePanel');
const edgeStylePanel = document.getElementById('edgeStylePanel');
const groupStylePanel = document.getElementById('groupStylePanel');
const infoPanel = document.getElementById('infoPanel');

let selectedNode = null;
let selectedEdge = null;
let selectedGroup = null;

function showPanel(panel) {
  nodeStylePanel.classList.add('hidden');
  edgeStylePanel.classList.add('hidden');
  groupStylePanel.classList.add('hidden');
  infoPanel.classList.add('hidden');
  panel.classList.remove('hidden');
}

function toNonNegativeNumber(value, fallback = 0) {
  const next = Number.parseFloat(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(0, next);
}

function rebuildNodeLabel(node, patch = {}) {
  if (!node.label) return;
  const label = node.label;
  node.label = new TextLabel({
    text: label.text,
    style: label.style,
    maxWidth: label.maxWidth,
    styleClass: label.styleClass,
    padding: patch.padding ?? label.padding,
    margin: patch.margin ?? label.margin,
  });
}

function updateNodePanel(node) {
  document.getElementById('nodeLabel').value = node.label?.text || '';
  const labelStyle = node.label?.style || {};
  document.getElementById('nodeLabelColor').value = labelStyle.color || '#333333';
  document.getElementById('nodeLabelColorText').value = labelStyle.color || '#333333';
  document.getElementById('nodeLabelSize').value = labelStyle.fontSize || 12;
  document.getElementById('nodeLabelPadding').value = node.label?.padding ?? 8;
  document.getElementById('nodeLabelMargin').value = node.label?.margin ?? 0;
  document.getElementById('nodeLabelPlacement').value = node.labelPlacement || 'auto';
  document.getElementById('nodeIconPadding').value = node.icon?.options.padding ?? 8;
  document.getElementById('nodeIconMargin').value = node.icon?.options.margin ?? 0;
  document.getElementById('nodeIconGap').value = node.icon?.options.gap ?? 6;
  const style = node.style || {};
  document.getElementById('nodeFillColor').value = style.fillColor || '#ffffff';
  document.getElementById('nodeFillColorText').value = style.fillColor || '#ffffff';
  document.getElementById('nodeStrokeColor').value = style.strokeColor || '#333333';
  document.getElementById('nodeStrokeColorText').value = style.strokeColor || '#333333';
  document.getElementById('nodeStrokeWidth').value = style.strokeWidth || 2;
  document.getElementById('nodeCornerRadius').value = node.cornerRadius ?? 0;
  document.getElementById('nodeOpacity').value = style.opacity || 1;
}

function updateEdgePanel(edge) {
  document.getElementById('edgeLabel').value = edge.label?.text || '';
  document.getElementById('edgeType').value = edge.type || 'bezier';
  const style = edge.style || {};
  document.getElementById('edgeStrokeColor').value = style.strokeColor || '#666666';
  document.getElementById('edgeStrokeColorText').value = style.strokeColor || '#666666';
  document.getElementById('edgeStrokeWidth').value = style.strokeWidth || 2;
  document.getElementById('edgeLabelOffset').value = edge.labelOffset ?? 0;
  document.getElementById('edgeStartMarker').value = edge.startMarker?.type || 'none';
  document.getElementById('edgeStartMarkerSize').value = edge.startMarker?.size || 12;
  document.getElementById('edgeEndMarker').value = edge.endMarker?.type || 'open';
  document.getElementById('edgeEndMarkerSize').value = edge.endMarker?.size || 12;
}

function updateGroupPanel(group) {
  document.getElementById('groupLabel').value = group.label || '';
  document.getElementById('groupPadding').value = group.padding ?? 20;
  const style = group.style || {};
  const fillColor = style.fillColor || 'rgba(200, 200, 200, 0.2)';
  document.getElementById('groupFillColor').value = typeof fillColor === 'string' && fillColor.startsWith('#') ? fillColor : '#c8c8c8';
  document.getElementById('groupFillColorText').value = fillColor;
  document.getElementById('groupStrokeColor').value = style.strokeColor || '#999999';
  document.getElementById('groupStrokeColorText').value = style.strokeColor || '#999999';
}

// Selection handler
renderer.on('select', (elementIds) => {
  selectedNode = null;
  selectedEdge = null;
  selectedGroup = null;

  if (elementIds.length === 0) {
    showPanel(infoPanel);
    return;
  }

  const node = renderer.getNode(elementIds[0]);
  if (node) {
    selectedNode = node;
    updateNodePanel(node);
    showPanel(nodeStylePanel);
    return;
  }

  const edge = renderer.getEdge(elementIds[0]);
  if (edge) {
    selectedEdge = edge;
    updateEdgePanel(edge);
    showPanel(edgeStylePanel);
    return;
  }

  const group = renderer.getGroup(elementIds[0]);
  if (group) {
    selectedGroup = group;
    updateGroupPanel(group);
    showPanel(groupStylePanel);
    return;
  }

  showPanel(infoPanel);
});

// Event handlers for node panel
document.getElementById('nodeLabel').addEventListener('input', (e) => {
  if (!selectedNode) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    if (e.target.value) {
      const fontSize = parseFloat(document.getElementById('nodeLabelSize').value);
      const color = document.getElementById('nodeLabelColor').value;
      const padding = toNonNegativeNumber(document.getElementById('nodeLabelPadding').value, 8);
      const margin = toNonNegativeNumber(document.getElementById('nodeLabelMargin').value, 0);
      if (node.label) {
        node.label.text = e.target.value;
      } else {
        node.label = new TextLabel({
          text: e.target.value,
          style: { color, fontSize },
          padding,
          margin,
        });
      }
    } else {
      node.label = undefined;
    }
  });
});

document.getElementById('nodeLabelColor').addEventListener('input', (e) => {
  document.getElementById('nodeLabelColorText').value = e.target.value;
  if (selectedNode?.label) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      if (node.label) node.label.style = { ...node.label.style, color: e.target.value };
    });
  }
});

document.getElementById('nodeLabelSize').addEventListener('input', (e) => {
  if (selectedNode?.label) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      if (node.label) node.label.style = { ...node.label.style, fontSize: parseFloat(e.target.value) };
    });
  }
});

document.getElementById('nodeLabelPlacement').addEventListener('change', (e) => {
  if (selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      node.labelPlacement = e.target.value;
    });
  }
});

document.getElementById('nodeLabelPadding').addEventListener('input', (e) => {
  if (!selectedNode?.label) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    rebuildNodeLabel(node, { padding: toNonNegativeNumber(e.target.value, node.label?.padding ?? 8) });
  });
});

document.getElementById('nodeLabelMargin').addEventListener('input', (e) => {
  if (!selectedNode?.label) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    rebuildNodeLabel(node, { margin: toNonNegativeNumber(e.target.value, node.label?.margin ?? 0) });
  });
});

document.getElementById('nodeIconPadding').addEventListener('input', (e) => {
  if (!selectedNode?.icon) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    if (!node.icon) return;
    node.icon.options = {
      ...node.icon.options,
      padding: toNonNegativeNumber(e.target.value, node.icon.options.padding ?? 8),
    };
  });
});

document.getElementById('nodeIconMargin').addEventListener('input', (e) => {
  if (!selectedNode?.icon) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    if (!node.icon) return;
    node.icon.options = {
      ...node.icon.options,
      margin: toNonNegativeNumber(e.target.value, node.icon.options.margin ?? 0),
    };
  });
});

document.getElementById('nodeIconGap').addEventListener('input', (e) => {
  if (!selectedNode?.icon) return;
  interactions.changeNodeProperties(selectedNode.id, (node) => {
    if (!node.icon) return;
    node.icon.options = {
      ...node.icon.options,
      gap: toNonNegativeNumber(e.target.value, node.icon.options.gap ?? 6),
    };
  });
});

document.getElementById('nodeFillColor').addEventListener('input', (e) => {
  document.getElementById('nodeFillColorText').value = e.target.value;
  if (selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      node.style = { ...node.style, fillColor: e.target.value };
    });
  }
});

document.getElementById('nodeStrokeColor').addEventListener('input', (e) => {
  document.getElementById('nodeStrokeColorText').value = e.target.value;
  if (selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      node.style = { ...node.style, strokeColor: e.target.value };
    });
  }
});

document.getElementById('nodeStrokeWidth').addEventListener('input', (e) => {
  if (selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      node.style = { ...node.style, strokeWidth: parseFloat(e.target.value) };
    });
  }
});

document.getElementById('nodeCornerRadius').addEventListener('input', (e) => {
  if (selectedNode && 'cornerRadius' in selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      if ('cornerRadius' in node) node.cornerRadius = parseFloat(e.target.value);
    });
  }
});

document.getElementById('nodeOpacity').addEventListener('input', (e) => {
  if (selectedNode) {
    interactions.changeNodeProperties(selectedNode.id, (node) => {
      node.style = { ...node.style, opacity: parseFloat(e.target.value) };
    });
  }
});

// Edge panel handlers
document.getElementById('edgeLabel').addEventListener('input', (e) => {
  if (!selectedEdge) return;
  interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
    if (e.target.value) {
      edge.label = edge.label ? { ...edge.label, text: e.target.value } : e.target.value;
    } else {
      edge.label = undefined;
    }
  });
});

document.getElementById('edgeType').addEventListener('change', (e) => {
  if (selectedEdge) {
    interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
      edge.type = e.target.value;
    });
  }
});

document.getElementById('edgeStrokeColor').addEventListener('input', (e) => {
  document.getElementById('edgeStrokeColorText').value = e.target.value;
  if (selectedEdge) {
    interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
      edge.style = { ...edge.style, strokeColor: e.target.value };
    });
  }
});

document.getElementById('edgeStrokeWidth').addEventListener('input', (e) => {
  if (selectedEdge) {
    interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
      edge.style = { ...edge.style, strokeWidth: parseFloat(e.target.value) };
    });
  }
});

document.getElementById('edgeLabelOffset').addEventListener('input', (e) => {
  if (selectedEdge) {
    interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
      edge.labelOffset = parseFloat(e.target.value) || 0;
    });
  }
});

function updateMarkers() {
  if (!selectedEdge) return;
  const startType = document.getElementById('edgeStartMarker').value;
  const endType = document.getElementById('edgeEndMarker').value;
  const startSize = parseFloat(document.getElementById('edgeStartMarkerSize').value) || 12;
  const endSize = parseFloat(document.getElementById('edgeEndMarkerSize').value) || 12;
  interactions.changeEdgeProperties(selectedEdge.id, (edge) => {
    edge.startMarker = startType === 'none' ? undefined : { type: startType, size: startSize };
    edge.endMarker = endType === 'none' ? undefined : { type: endType, size: endSize };
  });
}

document.getElementById('edgeStartMarker').addEventListener('change', updateMarkers);
document.getElementById('edgeEndMarker').addEventListener('change', updateMarkers);
document.getElementById('edgeStartMarkerSize').addEventListener('input', updateMarkers);
document.getElementById('edgeEndMarkerSize').addEventListener('input', updateMarkers);

// Group panel handlers
document.getElementById('groupLabel').addEventListener('input', (e) => {
  if (selectedGroup) {
    interactions.changeGroupProperties(selectedGroup.id, (group) => {
      group.label = e.target.value || undefined;
    });
  }
});

document.getElementById('groupPadding').addEventListener('input', (e) => {
  if (selectedGroup) {
    interactions.changeGroupProperties(selectedGroup.id, (group) => {
      group.padding = parseFloat(e.target.value);
    });
  }
});

document.getElementById('groupFillColor').addEventListener('input', (e) => {
  document.getElementById('groupFillColorText').value = e.target.value;
  if (selectedGroup) {
    interactions.changeGroupProperties(selectedGroup.id, (group) => {
      group.style = { ...group.style, fillColor: e.target.value };
    });
  }
});

document.getElementById('groupStrokeColor').addEventListener('input', (e) => {
  document.getElementById('groupStrokeColorText').value = e.target.value;
  if (selectedGroup) {
    interactions.changeGroupProperties(selectedGroup.id, (group) => {
      group.style = { ...group.style, strokeColor: e.target.value };
    });
  }
});

// Toolbar handlers
let nodeCount = 5;

document.getElementById('addRect').addEventListener('click', () => {
  const node = new RectangleNode({
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
    width: 120, height: 60,
    label: `Node ${++nodeCount}`,
    style: { cornerRadius: 4 },
  });
  renderer.addNode(node);
});

document.getElementById('addCircle').addEventListener('click', () => {
  const node = new CircleNode({
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
    width: 80, height: 80,
    label: `Node ${++nodeCount}`,
  });
  renderer.addNode(node);
});

document.getElementById('addDiamond').addEventListener('click', () => {
  const node = new DiamondNode({
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
    width: 100, height: 100,
    label: `Node ${++nodeCount}`,
    style: { fillColor: '#fef3c7', strokeColor: '#d97706' },
  });
  renderer.addNode(node);
});

document.getElementById('fitView').addEventListener('click', () => {
  interactions.navigation.fitToView();
});

document.getElementById('zoomSelection').addEventListener('click', () => {
  interactions.zoomToSelection();
});

document.getElementById('resetView').addEventListener('click', () => {
  interactions.navigation.resetView();
});

// Toggle buttons
const gridButton = document.getElementById('toggleGrid');
const miniMapButton = document.getElementById('toggleMiniMap');
const snapButton = document.getElementById('toggleSnap');
const gridButtonLabel = document.getElementById('toggleGridLabel');
const miniMapButtonLabel = document.getElementById('toggleMiniMapLabel');
const snapButtonLabel = document.getElementById('toggleSnapLabel');
let gridVisible = true;
let miniMapVisible = true;
let snapEnabled = false;

function updateToggleLabels() {
  gridButtonLabel.textContent = gridVisible ? 'Grid ON' : 'Grid OFF';
  miniMapButtonLabel.textContent = miniMapVisible ? 'Minimap ON' : 'Minimap OFF';
  miniMapButton.classList.toggle('btn-primary', miniMapVisible);
  snapButtonLabel.textContent = snapEnabled ? 'Snap ON' : 'Snap OFF';
  snapButton.classList.toggle('btn-primary', snapEnabled);
}

gridButton.addEventListener('click', () => {
  gridVisible = !gridVisible;
  gridOverlay.setEnabled(gridVisible);
  renderer.markDirty();
  updateToggleLabels();
});

miniMapButton.addEventListener('click', () => {
  miniMapVisible = !miniMapVisible;
  miniMap.setEnabled(miniMapVisible);
  renderer.markDirty();
  updateToggleLabels();
});

snapButton.addEventListener('click', () => {
  snapEnabled = !snapEnabled;
  interactions.drag.setSnapToGrid(snapEnabled);
  updateToggleLabels();
});

updateToggleLabels();

// Export handlers
document.getElementById('exportPng').addEventListener('click', async () => {
  await imageExporter.download('diagram.png', { scale: 2 });
});

document.getElementById('exportSvg').addEventListener('click', async () => {
  await svgExporter.download('diagram.svg');
});

document.getElementById('exportJson').addEventListener('click', () => {
  const json = serializer.toJSON(true);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagram.json';
  a.click();
  URL.revokeObjectURL(url);
});
