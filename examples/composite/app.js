import {
  DiagramRenderer,
  Edge,
  Serializer,
  SvgExporter,
  GridOverlay,
  CompositeNode,
  container,
  text,
  icon,
  divider,
  shape,
} from '../../dist/papirus.js';

// --- Renderer setup ---

const renderer = new DiagramRenderer('#canvas', {
  width: 1000,
  height: 600,
  backgroundColor: '#fafafa',
  animations: { enabled: true, enterDuration: 220, exitDuration: 180 },
});

function syncCanvasSize() {
  const canvas = renderer.getCanvas();
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  renderer.resize(Math.max(320, Math.floor(rect.width)), Math.max(240, Math.floor(rect.height)));
}

requestAnimationFrame(() => requestAnimationFrame(syncCanvasSize));
window.addEventListener('resize', syncCanvasSize);

const svgExporter = new SvgExporter(renderer);

// Grid
const gridOverlay = new GridOverlay({ visible: false });
renderer.use(gridOverlay);

// Interactions
const interactionManager = renderer.enableInteractions({
  alignToNodes: true,
});

// --- Notation factories ---

let nodeCounter = 0;

function createBpmnTask(x, y) {
  nodeCounter++;
  return new CompositeNode({
    x, y, width: 180, height: 80,
    shapeType: 'rectangle',
    cornerRadius: 10,
    style: { fillColor: '#fff9e6', strokeColor: '#e6a817', strokeWidth: 2 },
    contentInset: 4,
    content: container({
      direction: 'column',
      padding: 8,
      gap: 4,
      children: [
        container({
          direction: 'row',
          justifyContent: 'start',
          alignItems: 'center',
          children: [
            icon({
              id: 'type-icon',
              source: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e6a817" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>')}`,
              width: 18,
              height: 18,
              onClick: () => console.log('BPMN icon clicked'),
            }),
          ],
        }),
        text({
          id: 'name',
          text: `Task ${nodeCounter}`,
          fontSize: 13,
          fontWeight: 'bold',
          color: '#5a4a00',
          role: 'name',
          style: { flexGrow: 1, alignSelf: 'center' },
        }),
        container({
          direction: 'row',
          justifyContent: 'center',
          gap: 6,
          children: [
            icon({
              source: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#999" stroke-width="1.5"><path d="M8 2v12M5 11l3 3 3-3M5 5l3-3 3 3"/></svg>')}`,
              width: 14,
              height: 14,
            }),
          ],
        }),
      ],
    }),
  });
}

function createArchiElement(x, y) {
  nodeCounter++;
  return new CompositeNode({
    x, y, width: 180, height: 60,
    shapeType: 'rectangle',
    style: { fillColor: '#e8f4fd', strokeColor: '#3498db', strokeWidth: 1.5 },
    contentInset: 4,
    content: container({
      direction: 'column',
      padding: 8,
      children: [
        container({
          direction: 'row',
          justifyContent: 'end',
          children: [
            icon({
              id: 'type-icon',
              source: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#3498db" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></svg>')}`,
              width: 16,
              height: 16,
            }),
          ],
        }),
        text({
          id: 'name',
          text: `Service ${nodeCounter}`,
          fontSize: 12,
          color: '#1a5276',
          role: 'name',
          style: { flexGrow: 1, alignSelf: 'center' },
        }),
      ],
    }),
  });
}

function createC4Container(x, y) {
  nodeCounter++;
  return new CompositeNode({
    x, y, width: 220, height: 110,
    shapeType: 'rectangle',
    cornerRadius: 6,
    style: { fillColor: '#438DD5', strokeColor: '#2b6cb0', strokeWidth: 1.5 },
    contentInset: 4,
    content: container({
      direction: 'column',
      padding: 14,
      gap: 4,
      alignItems: 'center',
      children: [
        text({
          id: 'name',
          text: `API Gateway ${nodeCounter}`,
          fontSize: 15,
          fontWeight: 'bold',
          color: '#ffffff',
          role: 'name',
        }),
        text({
          id: 'technology',
          text: '[Container: Node.js]',
          fontSize: 11,
          fontStyle: 'italic',
          color: '#b3d4f0',
        }),
        text({
          id: 'description',
          text: 'Routes requests to microservices and handles auth',
          fontSize: 11,
          color: '#dce9f5',
          style: { flexGrow: 1 },
        }),
      ],
    }),
  });
}

function createUmlClass(x, y) {
  nodeCounter++;
  return new CompositeNode({
    x, y, width: 220, height: 160,
    shapeType: 'rectangle',
    style: { fillColor: '#ffffff', strokeColor: '#333333', strokeWidth: 1.5 },
    autoSize: true,
    content: container({
      direction: 'column',
      children: [
        shape({
          backgroundColor: '#f5f0ff',
          padding: { top: 8, right: 12, bottom: 8, left: 12 },
          content: container({
            direction: 'column',
            alignItems: 'center',
            gap: 2,
            children: [
              text({ text: '\u00AB\u0069\u006E\u0074\u0065\u0072\u0066\u0061\u0063\u0065\u00BB', fontSize: 10, fontStyle: 'italic', color: '#7c3aed' }),
              text({
                id: 'name',
                text: `IRepository${nodeCounter}`,
                fontSize: 14,
                fontWeight: 'bold',
                color: '#1e1b4b',
                role: 'name',
              }),
            ],
          }),
        }),
        divider({ color: '#333333' }),
        shape({
          padding: { top: 6, right: 12, bottom: 6, left: 12 },
          content: container({
            direction: 'column',
            gap: 3,
            children: [
              text({ text: '+ findById(id: string): T', fontSize: 11, color: '#374151', align: 'left' }),
              text({ text: '+ findAll(): T[]', fontSize: 11, color: '#374151', align: 'left' }),
              text({ text: '+ save(entity: T): void', fontSize: 11, color: '#374151', align: 'left' }),
            ],
          }),
        }),
        divider({ color: '#333333' }),
        shape({
          padding: { top: 6, right: 12, bottom: 6, left: 12 },
          content: container({
            direction: 'column',
            gap: 3,
            children: [
              text({ text: '- connection: DbPool', fontSize: 11, color: '#6b7280', align: 'left' }),
            ],
          }),
        }),
      ],
    }),
  });
}

// --- Create initial demo elements ---

const bpmn1 = createBpmnTask(40, 40);
const bpmn2 = createBpmnTask(280, 40);
renderer.addNode(bpmn1);
renderer.addNode(bpmn2);

// Debug: log measured sizes after first render
requestAnimationFrame(() => {
  const canvas = renderer.getCanvas();
  const ctx = canvas.getContext('2d');
  if (ctx) {
    console.log('BPMN1 debug:', bpmn1.debugMeasure(ctx));
    console.log('BPMN1 actual size:', bpmn1.width, bpmn1.height);
  }
});
renderer.addEdge(new Edge({
  from: { nodeId: bpmn1.id }, to: { nodeId: bpmn2.id },
  type: 'polyline',
  style: { strokeColor: '#e6a817' },
}));

const archi1 = createArchiElement(40, 180);
const archi2 = createArchiElement(280, 180);
renderer.addNode(archi1);
renderer.addNode(archi2);
renderer.addEdge(new Edge({
  from: { nodeId: archi1.id }, to: { nodeId: archi2.id },
  type: 'straight',
  style: { strokeColor: '#3498db' },
}));

const c4 = createC4Container(520, 40);
renderer.addNode(c4);

const uml = createUmlClass(520, 200);
renderer.addNode(uml);

// --- componentClick event ---

renderer.on('componentClick', (nodeId, component, point) => {
  console.log(`Component clicked: node=${nodeId}, component=${component.id ?? component.type}, point=(${point.x.toFixed(0)},${point.y.toFixed(0)})`);
});

// --- Toolbar ---

let addX = 40;
let addY = 380;
function nextPos() {
  const pos = { x: addX, y: addY };
  addX += 240;
  if (addX > 700) { addX = 40; addY += 180; }
  return pos;
}

document.getElementById('addBpmn')?.addEventListener('click', () => {
  const { x, y } = nextPos();
  renderer.addNode(createBpmnTask(x, y));
});

document.getElementById('addArchi')?.addEventListener('click', () => {
  const { x, y } = nextPos();
  renderer.addNode(createArchiElement(x, y));
});

document.getElementById('addC4')?.addEventListener('click', () => {
  const { x, y } = nextPos();
  renderer.addNode(createC4Container(x, y));
});

document.getElementById('addUml')?.addEventListener('click', () => {
  const { x, y } = nextPos();
  renderer.addNode(createUmlClass(x, y));
});

document.getElementById('fitView')?.addEventListener('click', () => {
  interactionManager.navigation.fitToView();
});

let gridVisible = false;
document.getElementById('toggleGrid')?.addEventListener('click', () => {
  gridVisible = !gridVisible;
  gridOverlay.setEnabled(gridVisible);
  renderer.markDirty();
});

document.getElementById('exportSvg')?.addEventListener('click', () => {
  const svg = svgExporter.exportSVG({ includeBackground: true });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composite-diagram.svg';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('exportJson')?.addEventListener('click', () => {
  const serializer = new Serializer(renderer, {
    nodeFactory: (data) => new CompositeNode({ ...data, content: container() }),
    edgeFactory: (data) => new Edge(data),
  });
  const data = serializer.serialize();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composite-diagram.json';
  a.click();
  URL.revokeObjectURL(url);
});
