import {
  DiagramRenderer,
  RectangleNode,
  CircleNode,
  DiamondNode,
  Edge,
  StyleManager,
  GridOverlay,
  GuidesOverlay,
  MiniMap,
} from '../../dist/papirus.js';

// Theme handling
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
let savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  applyTheme(next);
  renderer.markDirty();
});

// Initialize renderer with animations enabled
const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 550,
  backgroundColor: '#fafafa',
  retina: true,
  animations: { enabled: true, enterDuration: 300, exitDuration: 200 },
  scrollbarOverlay: true,
});

// Custom themes
const themes = {
  light: {
    name: 'Light',
    background: '#fafafa',
    grid: '#e5e5e5',
    node: { fill: '#ffffff', stroke: '#333333' },
  },
  dark: {
    name: 'Dark',
    background: '#1a1a2e',
    grid: '#334155',
    node: { fill: '#2d2d44', stroke: '#4a4a6a' },
  },
  blue: {
    name: 'Blue',
    background: '#eff6ff',
    grid: '#bfdbfe',
    node: { fill: '#ffffff', stroke: '#3b82f6' },
  },
};

// Style manager
let styles = new StyleManager('default');
styles.registerClass({
  name: 'primary',
  node: { fillColor: '#dbeafe', strokeColor: '#2563eb' },
});
styles.registerClass({
  name: 'success',
  node: { fillColor: '#dcfce7', strokeColor: '#16a34a' },
});
styles.registerClass({
  name: 'warning',
  node: { fillColor: '#fef3c7', strokeColor: '#d97706' },
});
styles.registerClass({
  name: 'error',
  node: { fillColor: '#fee2e2', strokeColor: '#dc2626' },
});
renderer.setStyleManager(styles);

// Overlays
const gridOverlay = new GridOverlay({ gridSize: 20, color: themes.light.grid });
const guidesOverlay = new GuidesOverlay({ vertical: [300, 600], horizontal: [200, 400] });
const miniMap = new MiniMap({ width: 140, height: 100, padding: 16 });
renderer.use(gridOverlay);
renderer.use(guidesOverlay);
renderer.use(miniMap);

// Interactions
const interactions = renderer.enableInteractions();

// Flow animation state
let flowEnabled = true;
let flowSpeed = 30;
let pulseEnabled = false;

// Create animated diagram
function createDiagram() {
  // Source node
  const source = new CircleNode({
    x: 100, y: 250,
    width: 100, height: 100,
    label: 'Source',
    styleClass: 'primary',
  });
  renderer.addNode(source);

  // Process nodes
  const process1 = new RectangleNode({
    x: 280, y: 150,
    width: 120, height: 70,
    label: 'Process A',
    styleClass: 'success',
    style: { cornerRadius: 8 },
  });
  renderer.addNode(process1);

  const process2 = new RectangleNode({
    x: 280, y: 350,
    width: 120, height: 70,
    label: 'Process B',
    styleClass: 'warning',
    style: { cornerRadius: 8 },
  });
  renderer.addNode(process2);

  // Decision node
  const decision = new DiamondNode({
    x: 480, y: 225,
    width: 100, height: 100,
    label: 'OK?',
  });
  renderer.addNode(decision);

  // Output nodes
  const success = new RectangleNode({
    x: 680, y: 150,
    width: 120, height: 70,
    label: 'Success',
    styleClass: 'success',
  });
  renderer.addNode(success);

  const error = new RectangleNode({
    x: 680, y: 350,
    width: 120, height: 70,
    label: 'Error',
    styleClass: 'error',
  });
  renderer.addNode(error);

  // Animated edges with flow
  const edges = [
    new Edge({
      from: { nodeId: source.id },
      to: { nodeId: process1.id },
      type: 'bezier',
      style: { flowSpeed, flowDash: [6, 6], strokeColor: '#2563eb' },
      endMarker: { type: 'arrow', size: 10 },
    }),
    new Edge({
      from: { nodeId: source.id },
      to: { nodeId: process2.id },
      type: 'bezier',
      style: { flowSpeed, flowDash: [6, 6], strokeColor: '#d97706' },
      endMarker: { type: 'arrow', size: 10 },
    }),
    new Edge({
      from: { nodeId: process1.id },
      to: { nodeId: decision.id },
      type: 'bezier',
      style: { flowSpeed: flowSpeed * 0.8, flowDash: [4, 4], strokeColor: '#16a34a' },
      endMarker: { type: 'arrow', size: 10 },
    }),
    new Edge({
      from: { nodeId: process2.id },
      to: { nodeId: decision.id },
      type: 'bezier',
      style: { flowSpeed: flowSpeed * 0.8, flowDash: [4, 4], strokeColor: '#d97706' },
      endMarker: { type: 'arrow', size: 10 },
    }),
    new Edge({
      from: { nodeId: decision.id },
      to: { nodeId: success.id },
      type: 'bezier',
      label: 'Yes',
      labelBackground: { color: '#dcfce7', padding: 4, borderRadius: 3 },
      style: { flowSpeed: flowSpeed * 1.2, flowDash: [8, 4], strokeColor: '#16a34a' },
      endMarker: { type: 'arrow', size: 12 },
    }),
    new Edge({
      from: { nodeId: decision.id },
      to: { nodeId: error.id },
      type: 'bezier',
      label: 'No',
      labelBackground: { color: '#fee2e2', padding: 4, borderRadius: 3 },
      style: { flowSpeed: flowSpeed * 1.2, flowDash: [8, 4], strokeColor: '#dc2626' },
      endMarker: { type: 'arrow', size: 12 },
    }),
  ];

  edges.forEach(edge => renderer.addEdge(edge));
}

createDiagram();

// Apply theme
function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;

  renderer.options.backgroundColor = theme.background;
  renderer.markDirty();
  gridOverlay.setColor(theme.grid);

  // Update style manager theme
  styles = new StyleManager(themeName === 'dark' ? 'dark' : 'default');
  styles.registerClass({
    name: 'primary',
    node: { fillColor: themeName === 'dark' ? '#1e3a5f' : '#dbeafe', strokeColor: '#2563eb' },
  });
  styles.registerClass({
    name: 'success',
    node: { fillColor: themeName === 'dark' ? '#14532d' : '#dcfce7', strokeColor: '#16a34a' },
  });
  styles.registerClass({
    name: 'warning',
    node: { fillColor: themeName === 'dark' ? '#713f12' : '#fef3c7', strokeColor: '#d97706' },
  });
  styles.registerClass({
    name: 'error',
    node: { fillColor: themeName === 'dark' ? '#7f1d1d' : '#fee2e2', strokeColor: '#dc2626' },
  });
  renderer.setStyleManager(styles);
  renderer.markDirty();

  document.getElementById('activeTheme').textContent = theme.name;

  // Update button states
  document.getElementById('themeLight').classList.toggle('btn-primary', themeName === 'light');
  document.getElementById('themeDark').classList.toggle('btn-primary', themeName === 'dark');
  document.getElementById('themeBlue').classList.toggle('btn-primary', themeName === 'blue');

  // Store theme
  localStorage.setItem('papirus-demo-theme', themeName);
}

// Restore saved theme
const savedDemoTheme = localStorage.getItem('papirus-demo-theme') || 'light';
applyTheme(savedDemoTheme);

// Update flow speed display
function updateFlowSpeed(speed) {
  flowSpeed = speed;
  document.getElementById('flowSpeedDisplay').textContent = `${speed} px/s`;

  // Update all edges with flow
  renderer.edges.forEach(edge => {
    const currentSpeed = edge.style?.flowSpeed || 30;
    const ratio = currentSpeed / 30;
    interactions.changeEdgeProperties(edge.id, (e) => {
      e.style = { ...e.style, flowSpeed: speed * ratio };
    });
  });
  renderer.markDirty();
}

// Toggle flow animation
const flowBtn = document.getElementById('toggleFlow');
if (!flowBtn) console.error('Flow button not found');
flowBtn?.addEventListener('click', () => {
  flowEnabled = !flowEnabled;
  flowBtn.classList.toggle('btn-primary', flowEnabled);
  flowBtn.textContent = flowEnabled ? '▶ Flow Animation' : '⏸ Flow Animation';

  renderer.edges.forEach(edge => {
    interactions.changeEdgeProperties(edge.id, (e) => {
      if (flowEnabled) {
        e.style = { ...e.style, flowSpeed: flowSpeed * (e.style?.flowSpeed ? 1 : 1), flowDash: [6, 6] };
      } else {
        const { flowSpeed: _, flowDash: __, ...rest } = e.style || {};
        e.style = rest;
      }
    });
  });
  renderer.markDirty();

  document.getElementById('animStatus').textContent = flowEnabled ? 'Active' : 'Paused';
});

// Pulse effect (simulated by changing opacity)
const pulseBtn = document.getElementById('togglePulse');
if (!pulseBtn) console.error('Pulse button not found');
let pulseInterval = null;
pulseBtn?.addEventListener('click', () => {
  pulseEnabled = !pulseEnabled;
  pulseBtn.classList.toggle('btn-primary', pulseEnabled);

  if (pulseEnabled) {
    let phase = 0;
    pulseInterval = setInterval(() => {
      phase += 0.1;
      const opacity = 0.7 + 0.3 * Math.sin(phase);
      renderer.nodes.forEach(node => {
        if (node.style) {
          node.style = { ...node.style, opacity };
        }
      });
      renderer.markDirty();
    }, 50);
  } else {
    clearInterval(pulseInterval);
    renderer.nodes.forEach(node => {
      if (node.style) {
        node.style = { ...node.style, opacity: 1 };
      }
    });
    renderer.markDirty();
  }
});

// Theme buttons
document.getElementById('themeLight')?.addEventListener('click', () => applyTheme('light'));
document.getElementById('themeDark')?.addEventListener('click', () => applyTheme('dark'));
document.getElementById('themeBlue')?.addEventListener('click', () => applyTheme('blue'));

// Speed buttons
const speedBtns = {
  slow: document.getElementById('speedSlow'),
  normal: document.getElementById('speedNormal'),
  fast: document.getElementById('speedFast'),
};

function setSpeed(speed, name) {
  updateFlowSpeed(speed);
  Object.entries(speedBtns).forEach(([key, btn]) => {
    btn.classList.toggle('btn-primary', key === name);
  });
}

speedBtns.slow?.addEventListener('click', () => setSpeed(15, 'slow'));
speedBtns.normal?.addEventListener('click', () => setSpeed(30, 'normal'));
speedBtns.fast?.addEventListener('click', () => setSpeed(60, 'fast'));

// Particles toggle (visual effect)
const particlesBtn = document.getElementById('toggleParticles');
if (!particlesBtn) console.error('Particles button not found');
let particlesEnabled = false;
particlesBtn?.addEventListener('click', () => {
  particlesEnabled = !particlesEnabled;
  particlesBtn.classList.toggle('btn-primary', particlesEnabled);

  if (particlesEnabled) {
    // Add some decorative floating nodes
    for (let i = 0; i < 5; i++) {
      const node = new CircleNode({
        x: 50 + Math.random() * 800,
        y: 50 + Math.random() * 500,
        width: 20, height: 20,
        style: { fillColor: '#8b5cf6', strokeColor: '#6d28d9', opacity: 0.5 },
      });
      renderer.addNode(node);
    }
  } else {
    // Remove small decorative nodes
    const toRemove = [];
    renderer.nodes.forEach(node => {
      if (node.width === 20 && node.height === 20) {
        toRemove.push(node.id);
      }
    });
    toRemove.forEach(id => renderer.removeNode(id));
  }
  renderer.markDirty();
});

// Initial state
flowBtn.classList.add('btn-primary');
