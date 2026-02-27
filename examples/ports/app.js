import {
  DiagramRenderer,
  RectangleNode,
  CircleNode,
  Edge,
  StyleManager,
  GridOverlay,
  MiniMap,
  RulersOverlay,
} from '../../dist/papirus.js';

// Initialize renderer
const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 550,
  backgroundColor: '#fafafa',
  retina: true,
  scrollbarOverlay: true,
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

// Style manager
const styles = new StyleManager('default');
styles.registerClass({
  name: 'input',
  node: { fillColor: '#dbeafe', strokeColor: '#2563eb' },
  port: { fillColor: '#2563eb', strokeColor: '#1d4ed8' },
});
styles.registerClass({
  name: 'process',
  node: { fillColor: '#fef3c7', strokeColor: '#d97706' },
  port: { fillColor: '#d97706', strokeColor: '#b45309' },
});
styles.registerClass({
  name: 'output',
  node: { fillColor: '#dcfce7', strokeColor: '#16a34a' },
  port: { fillColor: '#16a34a', strokeColor: '#15803d' },
});
renderer.setStyleManager(styles);

// Overlays
const gridOverlay = new GridOverlay({ gridSize: 20, color: '#e5e5e5' });
const miniMap = new MiniMap({ width: 140, height: 100, padding: 16, contentMargin: 200 });
const rulers = new RulersOverlay({ thickness: 20 });
renderer.use(gridOverlay);
renderer.use(miniMap);
renderer.use(rulers);

// Connection settings
let defaultPathType = 'bezier';
let defaultArrow = 'open';
let defaultColor = '#3b82f6';

// Interactions
let attachToOutlineEnabled = false;
const interactions = renderer.enableInteractions({
  attachToOutline: false,
  createEdge: (from, to) => {
    const edge = new Edge({
      from,
      to,
      type: defaultPathType,
      endMarker: defaultArrow === 'none' ? undefined : { type: defaultArrow, size: 10 },
      style: { strokeColor: defaultColor },
    });
    return edge;
  },
});

// Node counters
let inputCount = 0;
let processCount = 0;
let outputCount = 0;

// Create node functions
function createInputNode(x, y) {
  const node = new RectangleNode({
    x, y,
    width: 120, height: 60,
    label: { text: `Input ${++inputCount}`, padding: 5, margin: 3 },
    styleClass: 'input',
    ports: [
      { type: 'output', position: 'right', styleClass: 'input' },
    ],
    anchorPoints: { top: 0, right: 1, bottom: 0, left: 0 },
  });
  renderer.addNode(node);
  updateStats();
  return node;
}

function createProcessNode(x, y) {
  const node = new CircleNode({
    x, y,
    width: 100, height: 100,
    label: { text: `Process ${++processCount}`, padding: 5, margin: 3 },
    styleClass: 'process',
    ports: [
      { type: 'input', position: 'left', styleClass: 'process' },
      { type: 'output', position: 'right', styleClass: 'process' },
      { type: 'input', position: 'top', styleClass: 'process' },
      { type: 'output', position: 'bottom', styleClass: 'process' },
    ],
    anchorPoints: { top: 1, right: 1, bottom: 1, left: 1 },
  });
  renderer.addNode(node);
  updateStats();
  return node;
}

function createOutputNode(x, y) {
  const node = new RectangleNode({
    x, y,
    width: 120, height: 60,
    label: { text: `Output ${++outputCount}`, padding: 5, margin: 3 },
    styleClass: 'output',
    ports: [
      { type: 'input', position: 'left', styleClass: 'output' },
      { type: 'input', position: 'top', styleClass: 'output' },
    ],
    anchorPoints: { top: 1, right: 0, bottom: 0, left: 1 },
    style: { cornerRadius: 8 },
  });
  renderer.addNode(node);
  updateStats();
  return node;
}

// Initial diagram
const input1 = createInputNode(80, 150);
const input2 = createInputNode(80, 350);
const process1 = createProcessNode(280, 130);
const process2 = createProcessNode(280, 330);
const output1 = createOutputNode(500, 150);
const output2 = createOutputNode(500, 350);

// Create edges
const edges = [
  new Edge({
    from: { nodeId: input1.id, portId: 'anchor:right:0' },
    to: { nodeId: process1.id, portId: 'anchor:left:0' },
    type: 'bezier',
    endMarker: { type: 'open', size: 10 },
    label: 'ingest',
  }),
  new Edge({
    from: { nodeId: input2.id, portId: 'anchor:right:0' },
    to: { nodeId: process2.id, portId: 'anchor:left:0' },
    type: 'bezier',
    endMarker: { type: 'open', size: 10 },
    label: 'ingest',
  }),
  new Edge({
    from: { nodeId: process1.id, portId: 'anchor:right:0' },
    to: { nodeId: output1.id, portId: 'anchor:left:0' },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
    label: 'result',
  }),
  new Edge({
    from: { nodeId: process2.id, portId: 'anchor:right:0' },
    to: { nodeId: output2.id, portId: 'anchor:left:0' },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
    label: 'result',
  }),
  new Edge({
    from: { nodeId: process1.id, portId: 'anchor:bottom:0' },
    to: { nodeId: process2.id, portId: 'anchor:top:0' },
    type: 'editable-polyline',
    controlPoints: [
      { x: 380, y: 240 },
    ],
    endMarker: { type: 'diamond', size: 8 },
    style: { strokeColor: '#8b5cf6', lineDash: [4, 2] },
    label: 'feedback',
    labelBackground: { color: '#f3e8ff', padding: 2, borderRadius: 2 },
  }),
];

edges.forEach(edge => renderer.addEdge(edge));
updateStats();

// Update stats
function updateStats() {
  document.getElementById('nodeCount').textContent = renderer.nodes.size;
  document.getElementById('edgeCount').textContent = renderer.edges.size;
}

// Listen for changes
renderer.on('edgeAdded', updateStats);
renderer.on('edgeRemoved', updateStats);
renderer.on('nodeAdded', updateStats);
renderer.on('nodeRemoved', updateStats);

// Toolbar handlers
document.getElementById('addInput').addEventListener('click', () => {
  createInputNode(50 + Math.random() * 100, 50 + Math.random() * 400);
});

document.getElementById('addProcess').addEventListener('click', () => {
  createProcessNode(250 + Math.random() * 100, 50 + Math.random() * 400);
});

document.getElementById('addOutput').addEventListener('click', () => {
  createOutputNode(450 + Math.random() * 100, 50 + Math.random() * 400);
});

document.getElementById('fitView').addEventListener('click', () => {
  interactions.navigation.fitToView();
});

document.getElementById('clearAll').addEventListener('click', () => {
  // Удаляем все узлы (вместе с ними удалятся и рёбра)
  const nodeIds = Array.from(renderer.nodes.keys());
  interactions.deleteByIds(nodeIds);
  inputCount = 0;
  processCount = 0;
  outputCount = 0;
  updateStats();
});

// Path type buttons
const pathButtons = {
  straight: document.getElementById('pathStraight'),
  polyline: document.getElementById('pathPolyline'),
  'editable-polyline': document.getElementById('pathEditablePolyline'),
  bezier: document.getElementById('pathBezier'),
};

function setPathType(type) {
  defaultPathType = type;
  Object.entries(pathButtons).forEach(([key, btn]) => {
    btn.classList.toggle('btn-primary', key === type);
  });
  document.getElementById('defaultPathType').value = type;
}

Object.entries(pathButtons).forEach(([type, btn]) => {
  btn.addEventListener('click', () => setPathType(type));
});

// Settings panel
document.getElementById('defaultPathType').addEventListener('change', (e) => {
  setPathType(e.target.value);
});

document.getElementById('defaultArrow').addEventListener('change', (e) => {
  defaultArrow = e.target.value;
});

document.getElementById('defaultColor').addEventListener('input', (e) => {
  defaultColor = e.target.value;
});

document.getElementById('attachToOutline').addEventListener('change', (e) => {
  attachToOutlineEnabled = e.target.checked;
  interactions.connection.setAttachToOutline(attachToOutlineEnabled);
});

// Initial state
setPathType('bezier');
