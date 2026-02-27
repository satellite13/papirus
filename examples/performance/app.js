import {
  DiagramRenderer,
  RectangleNode,
  CircleNode,
  DiamondNode,
  Edge,
  Group,
} from '../../dist/papirus.js';

const NODE_COUNT = 1000;
const COLS = 40;
const SPACING_X = 150;
const SPACING_Y = 100;

const renderer = new DiagramRenderer('#canvas', {
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  retina: true,
  minZoom: 0.1,
  maxZoom: 5,
  initialZoom: 0.5,
  animations: {
    enabled: false,
  },
});

renderer.enableInteractions();

function syncCanvasSize() {
  const canvas = renderer.getCanvas();
  const rect = canvas.parentElement?.getBoundingClientRect();
  if (rect) {
    renderer.resize(rect.width, rect.height);
  }
}

syncCanvasSize();
window.addEventListener('resize', syncCanvasSize);

function generateNodes(count) {
  const nodes = [];
  const cols = Math.ceil(Math.sqrt(count));

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = col * SPACING_X + 50;
    const y = row * SPACING_Y + 50;

    const nodeTypes = [RectangleNode, CircleNode, DiamondNode];
    const NodeClass = nodeTypes[i % 3];

    const colors = [
      { fill: '#3b82f6', stroke: '#1d4ed8' },
      { fill: '#10b981', stroke: '#047857' },
      { fill: '#f59e0b', stroke: '#b45309' },
      { fill: '#ef4444', stroke: '#b91c1c' },
      { fill: '#8b5cf6', stroke: '#6d28d9' },
    ];
    const color = colors[i % colors.length];

    const node = new NodeClass({
      id: `node-${i}`,
      x,
      y,
      width: 80 + (i % 3) * 20,
      height: 50 + (i % 2) * 10,
      style: {
        fillColor: color.fill,
        strokeColor: color.stroke,
        strokeWidth: 2,
      },
      label: `Node ${i + 1}`,
    });

    nodes.push(node);
  }

  return nodes;
}

function generateEdges(nodes) {
  const edges = [];
  const edgeProbability = 0.15;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < edgeProbability) {
        const edge = new Edge({
          id: `edge-${i}-${j}`,
          from: { nodeId: nodes[i].id },
          to: { nodeId: nodes[j].id },
          style: {
            strokeColor: '#64748b',
            strokeWidth: 1.5,
          },
        });
        edges.push(edge);
      }
    }
  }

  return edges;
}

let nodes = [];
let edges = [];

function createDiagram(count) {
  const start = performance.now();

  renderer.clear();

  nodes = generateNodes(count);
  edges = generateEdges(nodes);

  for (const node of nodes) {
    renderer.addNode(node);
  }

  for (const edge of edges) {
    renderer.addEdge(edge);
  }

  const end = performance.now();

  document.getElementById('nodeCount').textContent = nodes.length.toString();
  document.getElementById('edgeCount').textContent = edges.length.toString();
  document.getElementById('renderTime').textContent = `${(end - start).toFixed(1)}ms`;
}

createDiagram(NODE_COUNT);

const fpsHistory = [];
const FPS_HISTORY_SIZE = 60;
let lastFrameTime = performance.now();

function updateStats() {
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  const fps = 1000 / delta;
  fpsHistory.push(fps);
  if (fpsHistory.length > FPS_HISTORY_SIZE) {
    fpsHistory.shift();
  }

  const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

  const fpsEl = document.getElementById('fps');
  const frameTimeEl = document.getElementById('frameTime');

  fpsEl.textContent = avgFps.toFixed(1);
  frameTimeEl.textContent = `${delta.toFixed(1)}ms`;

  fpsEl.className = 'stat-value';
  if (avgFps >= 55) {
    fpsEl.classList.add('good');
  } else if (avgFps >= 30) {
    fpsEl.classList.add('warn');
  } else {
    fpsEl.classList.add('bad');
  }

  requestAnimationFrame(updateStats);
}

updateStats();

document.getElementById('btn-100').addEventListener('click', () => createDiagram(100));
document.getElementById('btn-500').addEventListener('click', () => createDiagram(500));
document.getElementById('btn-1000').addEventListener('click', () => createDiagram(1000));

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  renderer.zoom = Math.min(renderer.zoom * 1.2, 5);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  renderer.zoom = Math.max(renderer.zoom / 1.2, 0.1);
});

document.getElementById('btn-zoom-reset').addEventListener('click', () => {
  renderer.zoom = 0.5;
  renderer.offsetX = 0;
  renderer.offsetY = 0;
});
