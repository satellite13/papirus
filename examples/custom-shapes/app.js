import {
  DiagramRenderer,
  RectangleNode,
  CustomShapeNode,
  Edge,
  StyleManager,
  GridOverlay,
  MiniMap,
} from '../../dist/papirus.js';
import { DatabaseNode } from './DatabaseNode.js';

// Для проверки типа в updateShapeProps
const isCustomShape = (node) => node instanceof CustomShapeNode;

// Theme handling
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  renderer.options.backgroundColor = next === 'dark' ? '#1a1a2e' : '#fafafa';
  gridOverlay.setColor(next === 'dark' ? '#334155' : '#e5e5e5');
});

// Initialize renderer
const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 550,
  backgroundColor: savedTheme === 'dark' ? '#1a1a2e' : '#fafafa',
  retina: true,
  scrollbarOverlay: true,
});

// Style manager
const styles = new StyleManager(savedTheme === 'dark' ? 'dark' : 'default');
renderer.setStyleManager(styles);

// Overlays
const gridOverlay = new GridOverlay({ gridSize: 20, color: savedTheme === 'dark' ? '#334155' : '#e5e5e5' });
const miniMap = new MiniMap({ width: 140, height: 100, padding: 16 });
renderer.use(gridOverlay);
renderer.use(miniMap);

// Interactions
const interactions = renderer.enableInteractions();

// Custom shape path functions
function createChamferedRectPath(width, height) {
  const cut = Math.max(6, Math.min(20, width * 0.18, height * 0.18));
  const path = new Path2D();
  path.moveTo(cut, 0);
  path.lineTo(width - cut, 0);
  path.lineTo(width, cut);
  path.lineTo(width, height - cut);
  path.lineTo(width - cut, height);
  path.lineTo(cut, height);
  path.lineTo(0, height - cut);
  path.lineTo(0, cut);
  path.closePath();
  return path;
}

function createHexagonPath(width, height) {
  const path = new Path2D();
  const w = width;
  const h = height;
  const offset = w * 0.25;
  path.moveTo(offset, 0);
  path.lineTo(w - offset, 0);
  path.lineTo(w, h * 0.5);
  path.lineTo(w - offset, h);
  path.lineTo(offset, h);
  path.lineTo(0, h * 0.5);
  path.closePath();
  return path;
}

// DatabaseNode импортирован из ./DatabaseNode.js

function createDocumentPath(width, height) {
  const path = new Path2D();
  const w = width;
  const h = height;
  const fold = Math.min(30, w * 0.25, h * 0.25);
  
  path.moveTo(0, 0);
  path.lineTo(w - fold, 0);
  path.lineTo(w, fold);
  path.lineTo(w, h);
  path.lineTo(0, h);
  path.closePath();
  
  // Fold line
  path.moveTo(w - fold, 0);
  path.lineTo(w - fold, fold);
  path.lineTo(w, fold);
  
  return path;
}

// Shape counters
let chamferCount = 0;
let hexagonCount = 0;
let cylinderCount = 0;
let documentCount = 0;

// Create shape functions
function createChamferedNode(x, y) {
  const node = new CustomShapeNode({
    x, y,
    width: 140, height: 70,
    label: `Chamfered ${++chamferCount}`,
    path: createChamferedRectPath,
    anchorPoints: { top: 3, right: 2, bottom: 3, left: 2 },
    style: { fillColor: '#ede9fe', strokeColor: '#7c3aed', strokeWidth: 2 },
  });
  renderer.addNode(node);
  return node;
}

function createHexagonNode(x, y) {
  const node = new CustomShapeNode({
    x, y,
    width: 120, height: 100,
    label: `Hexagon ${++hexagonCount}`,
    path: createHexagonPath,
    anchorPoints: { top: 2, right: 1, bottom: 2, left: 1 },
    style: { fillColor: '#cffafe', strokeColor: '#0891b2', strokeWidth: 2 },
  });
  renderer.addNode(node);
  return node;
}

function createCylinderNode(x, y) {
  const node = new DatabaseNode({
    x, y,
    width: 100, height: 120,
    label: `DB ${++cylinderCount}`,
    style: { fillColor: '#fce7f3', strokeColor: '#db2777', strokeWidth: 2 },
    anchorPoints: { top: 1, right: 2, bottom: 1, left: 2 },
  });
  renderer.addNode(node);
  return node;
}

function createDocumentNode(x, y) {
  const node = new CustomShapeNode({
    x, y,
    width: 100, height: 130,
    label: `Doc ${++documentCount}`,
    path: createDocumentPath,
    anchorPoints: { top: 2, right: 2, bottom: 2, left: 2 },
    style: { fillColor: '#fef3c7', strokeColor: '#d97706', strokeWidth: 2 },
  });
  renderer.addNode(node);
  return node;
}

// Create initial diagram
const chamfer1 = createChamferedNode(100, 80);
const hexagon1 = createHexagonNode(350, 70);
const cylinder1 = createCylinderNode(600, 80);
const doc1 = createDocumentNode(100, 300);
const chamfer2 = createChamferedNode(350, 320);
const hexagon2 = createHexagonNode(600, 310);

// Connect shapes
const edges = [
  new Edge({
    from: { nodeId: chamfer1.id },
    to: { nodeId: hexagon1.id },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
  }),
  new Edge({
    from: { nodeId: hexagon1.id },
    to: { nodeId: cylinder1.id },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
  }),
  new Edge({
    from: { nodeId: doc1.id },
    to: { nodeId: chamfer2.id },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
  }),
  new Edge({
    from: { nodeId: chamfer2.id },
    to: { nodeId: hexagon2.id },
    type: 'bezier',
    endMarker: { type: 'arrow', size: 10 },
  }),
  new Edge({
    from: { nodeId: cylinder1.id },
    to: { nodeId: hexagon2.id },
    type: 'polyline',
    style: { lineDash: [4, 4] },
    endMarker: { type: 'open', size: 8 },
  }),
];

edges.forEach(edge => renderer.addEdge(edge));

// Shape properties panel
const shapeProps = document.getElementById('shapeProps');

function updateShapeProps(node) {
  if (!node || !isCustomShape(node)) {
    shapeProps.innerHTML = '<p style="color: var(--muted); font-size: 13px;">Select a custom shape to see its properties</p>';
    return;
  }

  const pathName = node instanceof DatabaseNode ? 'Database (Cylinder)' :
                   node.path === createChamferedRectPath ? 'Chamfered Rectangle' :
                   node.path === createHexagonPath ? 'Hexagon' :
                   node.path === createDocumentPath ? 'Document' : 'Custom';

  shapeProps.innerHTML = `
    <div class="form-row">
      <label class="form-label">Type</label>
      <span>${pathName}</span>
    </div>
    <div class="form-row">
      <label class="form-label">Size</label>
      <span>${Math.round(node.width)}×${Math.round(node.height)}</span>
    </div>
    <div class="form-row">
      <label class="form-label">Position</label>
      <span>${Math.round(node.x)}, ${Math.round(node.y)}</span>
    </div>
    <div class="form-row">
      <label class="form-label">Fill</label>
      <span style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 16px; height: 16px; background: ${node.style?.fillColor || '#fff'}; border: 1px solid var(--border); border-radius: 3px;"></span>
        ${node.style?.fillColor || '#ffffff'}
      </span>
    </div>
    <div class="form-row">
      <label class="form-label">Stroke</label>
      <span style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 16px; height: 16px; background: ${node.style?.strokeColor || '#333'}; border: 1px solid var(--border); border-radius: 3px;"></span>
        ${node.style?.strokeColor || '#333333'}
      </span>
    </div>
  `;
}

// Selection handler
renderer.on('select', (elementIds) => {
  if (elementIds.length === 0) {
    updateShapeProps(null);
    return;
  }
  const node = renderer.getNode(elementIds[0]);
  updateShapeProps(node);
});

// Toolbar handlers
document.getElementById('addChamfer').addEventListener('click', () => {
  createChamferedNode(50 + Math.random() * 200, 50 + Math.random() * 400);
});

document.getElementById('addHexagon').addEventListener('click', () => {
  createHexagonNode(50 + Math.random() * 200, 50 + Math.random() * 400);
});

document.getElementById('addCylinder').addEventListener('click', () => {
  createCylinderNode(50 + Math.random() * 200, 50 + Math.random() * 400);
});

document.getElementById('addDocument').addEventListener('click', () => {
  createDocumentNode(50 + Math.random() * 200, 50 + Math.random() * 400);
});

document.getElementById('fitView').addEventListener('click', () => {
  interactions.navigation.fitToView();
});

document.getElementById('resetView').addEventListener('click', () => {
  interactions.navigation.resetView();
});
