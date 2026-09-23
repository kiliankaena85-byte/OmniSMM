/**
 * OmniSMM 1.0 Architecture Cockpit (Uncle Bob Pattern)
 * Canvas2D Graph Engine & Developer Analytics
 */

// Application State
const state = {
  topology: null,
  stats: null,
  mode: 'rings', // 'rings' | 'clusters' | 'heatmap' | 'matrix' | 'proposals'
  selectedNode: null,
  hoveredNode: null,
  activeFilter: {
    search: '',
    layer: 'all',
    context: 'all',
    risk: 'all',
    clientOnly: false,
    showEdges: true
  },
  transform: {
    x: 0,
    y: 0,
    scale: 1
  },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  nodePositions: new Map(), // id -> { x, y, radius, visible }
  nodeMap: new Map(), // id -> node
  incomingMap: new Map(), // id -> Set of source node ids
  outgoingMap: new Map(), // id -> Set of target node ids
  animating: false
};

// Canvas references
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('graph-viewport');
const tooltip = document.getElementById('node-tooltip');
const zoomText = document.getElementById('zoom-level');

// Bounded Contexts Coordinates for cluster layout
const CONTEXT_CLUSTERS = {
  'FINTECH_LEDGER': { angle: 0, distance: 550, color: '#10b981' },
  'ORDERS_CHECKOUT': { angle: Math.PI / 3, distance: 550, color: '#f59e0b' },
  'CATALOG_INGESTION': { angle: (2 * Math.PI) / 3, distance: 550, color: '#3b82f6' },
  'MULTI_TENANT_CORE': { angle: Math.PI, distance: 550, color: '#a855f7' },
  'ASYNC_DAEMONS': { angle: (4 * Math.PI) / 3, distance: 550, color: '#ec4899' },
  'CORE_FRAMEWORK': { angle: (5 * Math.PI) / 3, distance: 550, color: '#64748b' }
};

/**
 * Initialize application
 */
async function init() {
  setupEventListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  await loadData();
  setTimeout(setupSSE, 500);
  computeLayout();
  resetView();
  requestAnimationFrame(render);
}

/**
 * Resize canvas to match container
 */
function resizeCanvas() {
  const rect = viewport.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  requestAnimationFrame(render);
}

/**
 * Fetch Topology & Stats from Server
 */
async function loadData() {
  try {
    const [topoRes, statsRes] = await Promise.all([
      fetch('/api/topology'),
      fetch('/api/stats')
    ]);

    if (!topoRes.ok || !statsRes.ok) {
      throw new Error('Failed to load architecture topology');
    }

    state.topology = await topoRes.json();
    state.stats = await statsRes.json();

    buildGraphIndices();
    updateKpiStrip();
    populateProposalTargets();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

/**
 * Build graph indices for O(1) lookups
 */
function buildGraphIndices() {
  state.nodeMap.clear();
  state.incomingMap.clear();
  state.outgoingMap.clear();

  for (const node of state.topology.nodes) {
    state.nodeMap.set(node.id, node);
    state.incomingMap.set(node.id, new Set());
    state.outgoingMap.set(node.id, new Set());
  }

  if (state.topology.edges) {
    for (const edge of state.topology.edges) {
      if (state.outgoingMap.has(edge.source)) {
        state.outgoingMap.get(edge.source).add(edge.target);
      }
      if (state.incomingMap.has(edge.target)) {
        state.incomingMap.get(edge.target).add(edge.source);
      }
    }
  }
}

/**
 * Update Top KPI Strip
 */
function updateKpiStrip() {
  const m = state.stats.metrics;
  document.getElementById('kpi-modules').textContent = m.totalFiles.toLocaleString();
  document.getElementById('kpi-edges').textContent = m.totalEdges.toLocaleString();
  document.getElementById('kpi-violations').textContent = m.violationsCount;
  document.getElementById('kpi-cycles').textContent = m.cyclesCount;
  document.getElementById('kpi-crappy').textContent = m.totalCrappyMethods.toLocaleString();
  document.getElementById('kpi-health').textContent = m.archScore + '%';
}

/**
 * Setup Real-time SSE Stream
 */
function setupSSE() {
  const sse = new EventSource('/api/live-stream');
  const sseStatus = document.getElementById('sse-status');

  sse.onopen = () => {
    sseStatus.classList.remove('offline');
  };

  sse.addEventListener('topology-updated', async () => {
    console.log('[SSE] Topology update received, reloading...');
    await loadData();
    computeLayout();
    requestAnimationFrame(render);
  });

  sse.onerror = () => {
    sseStatus.classList.add('offline');
  };
}

/**
 * Compute Layout coordinates for nodes
 */
function computeLayout() {
  state.nodePositions.clear();
  if (!state.topology) return;

  const nodes = state.topology.nodes;

  if (state.mode === 'rings') {
    // Concentric Layer Rings layout (Uncle Bob Clean Architecture)
    const layerRings = {
      0: { minR: 40, maxR: 130 },   // Domain (Center)
      1: { minR: 180, maxR: 320 },  // Services
      2: { minR: 380, maxR: 560 },  // Application
      3: { minR: 620, maxR: 880 }   // Presentation (Outer)
    };

    // Group nodes by level
    const grouped = { 0: [], 1: [], 2: [], 3: [] };
    for (const node of nodes) {
      const lvl = node.level ?? 3;
      if (grouped[lvl]) grouped[lvl].push(node);
    }

    for (const lvl of [0, 1, 2, 3]) {
      const list = grouped[lvl];
      const ring = layerRings[lvl];
      const count = list.length;
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        const node = list[i];
        // Distribute uniformly in ring
        const angle = (i / count) * 2 * Math.PI;
        // Jitter radius pseudo-randomly to avoid thin circle packing
        const hash = simpleHash(node.id);
        const rNorm = ((hash % 100) / 100);
        const r = ring.minR + rNorm * (ring.maxR - ring.minR);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        // Radius based on LOC (min 4, max 16)
        const radius = Math.min(16, Math.max(4, Math.sqrt((node.linesCount || 50) / 3)));

        state.nodePositions.set(node.id, { x, y, radius, visible: true });
      }
    }
  } else if (state.mode === 'clusters') {
    // DDD Bounded Context Clusters
    const grouped = {};
    for (const node of nodes) {
      const ctx = node.boundedContext || 'CORE_FRAMEWORK';
      if (!grouped[ctx]) grouped[ctx] = [];
      grouped[ctx].push(node);
    }

    for (const [ctxName, list] of Object.entries(grouped)) {
      const clusterConfig = CONTEXT_CLUSTERS[ctxName] || { angle: 0, distance: 400 };
      const cx = Math.cos(clusterConfig.angle) * clusterConfig.distance;
      const cy = Math.sin(clusterConfig.angle) * clusterConfig.distance;
      const count = list.length;

      for (let i = 0; i < count; i++) {
        const node = list[i];
        const angle = (i / count) * 2 * Math.PI;
        const hash = simpleHash(node.id);
        const rNorm = ((hash % 100) / 100);
        const r = 20 + rNorm * 180;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const radius = Math.min(16, Math.max(4, Math.sqrt((node.linesCount || 50) / 3)));

        state.nodePositions.set(node.id, { x, y, radius, visible: true });
      }
    }
  }

  applyFilters();
}

/**
 * Hash helper for deterministic layout
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Filter nodes based on user query
 */
function applyFilters() {
  const f = state.activeFilter;
  const searchLower = f.search.toLowerCase().trim();

  for (const [id, pos] of state.nodePositions.entries()) {
    const node = state.nodeMap.get(id);
    if (!node) continue;

    let match = true;

    // Search query
    if (searchLower) {
      const idMatch = node.id.toLowerCase().includes(searchLower);
      const fnMatch = node.topRiskFunctions && node.topRiskFunctions.some(fn => fn.name.toLowerCase().includes(searchLower));
      if (!idMatch && !fnMatch) match = false;
    }

    // Layer filter
    if (match && f.layer !== 'all' && String(node.level) !== f.layer) {
      match = false;
    }

    // Context filter
    if (match && f.context !== 'all' && node.boundedContext !== f.context) {
      match = false;
    }

    // Risk filter
    if (match && f.risk !== 'all') {
      const crap = node.maxCrapScore || 0;
      if (f.risk === 'crappy' && crap <= 30) match = false;
      if (f.risk === 'high' && crap <= 15) match = false;
      if (f.risk === 'clean' && crap > 5) match = false;
    }

    // Client only
    if (match && f.clientOnly && !node.isClientComponent) {
      match = false;
    }

    pos.visible = match;
  }
}

/**
 * Reset viewport transform to fit all nodes
 */
function resetView() {
  const rect = viewport.getBoundingClientRect();
  state.transform.x = rect.width / 2;
  state.transform.y = rect.height / 2;
  state.transform.scale = 0.55;
  updateZoomHUD();
}

function updateZoomHUD() {
  zoomText.textContent = Math.round(state.transform.scale * 100) + '%';
}

/**
 * Main Canvas2D Render Loop (60 FPS with Viewport Culling)
 */
function render() {
  const rect = viewport.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(state.transform.x, state.transform.y);
  ctx.scale(state.transform.scale, state.transform.scale);

  // 1. Draw Macro Concentric Rings or Cluster boundaries in background
  if (state.mode === 'rings') {
    drawCleanArchitectureRings();
  } else if (state.mode === 'clusters') {
    drawClusterZones();
  }

  // 2. Draw Edges
  if (state.activeFilter.showEdges && state.topology?.edges) {
    drawEdges();
  }

  // 3. Draw Nodes
  drawNodes();

  ctx.restore();
}

/**
 * Draw Clean Architecture Macro Rings
 */
function drawCleanArchitectureRings() {
  const rings = [
    { r: 140, label: 'Level 0 — Domain & Invariants', color: 'rgba(16, 185, 129, 0.15)', stroke: 'rgba(16, 185, 129, 0.3)' },
    { r: 340, label: 'Level 1 — Services & Engines', color: 'rgba(59, 130, 246, 0.08)', stroke: 'rgba(59, 130, 246, 0.2)' },
    { r: 580, label: 'Level 2 — Application & Gateways', color: 'rgba(168, 85, 247, 0.05)', stroke: 'rgba(168, 85, 247, 0.15)' },
    { r: 900, label: 'Level 3 — Presentation & UI Shell', color: 'rgba(234, 179, 8, 0.03)', stroke: 'rgba(234, 179, 8, 0.1)' }
  ];

  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, 2 * Math.PI);
    ctx.fillStyle = ring.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ring.stroke;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ring Label
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = ring.stroke;
    ctx.textAlign = 'center';
    ctx.fillText(ring.label.toUpperCase(), 0, -ring.r + 18);
  }
}

/**
 * Draw DDD Cluster Zones
 */
function drawClusterZones() {
  for (const [name, config] of Object.entries(CONTEXT_CLUSTERS)) {
    const cx = Math.cos(config.angle) * config.distance;
    const cy = Math.sin(config.angle) * config.distance;

    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.2)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = config.color;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillStyle = config.color;
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy - 220);
  }
}

/**
 * Draw Dependency Edges
 */
function drawEdges() {
  const edges = state.topology.edges;
  const isTargeted = state.selectedNode || state.hoveredNode;
  const targetId = (state.selectedNode || state.hoveredNode)?.id;

  for (const edge of edges) {
    const p1 = state.nodePositions.get(edge.source);
    const p2 = state.nodePositions.get(edge.target);
    if (!p1 || !p2 || !p1.visible || !p2.visible) continue;

    // Violating edges are always highlighted
    if (edge.isViolating) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      continue;
    }

    if (isTargeted) {
      if (edge.source === targetId) {
        // Outgoing dependency
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (edge.target === targetId) {
        // Incoming dependency
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    } else {
      // Background edges (subtle)
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

/**
 * Draw Nodes
 */
function drawNodes() {
  const layerBorders = {
    0: '#10b981',
    1: '#3b82f6',
    2: '#a855f7',
    3: '#eab308'
  };

  for (const [id, pos] of state.nodePositions.entries()) {
    if (!pos.visible) continue;

    const node = state.nodeMap.get(id);
    if (!node) continue;

    const crap = node.maxCrapScore || 0;
    let fillColor = '#10b981';
    if (crap > 30) fillColor = '#ef4444';
    else if (crap > 15) fillColor = '#f97316';
    else if (crap > 5) fillColor = '#eab308';

    const isSelected = state.selectedNode?.id === id;
    const isHovered = state.hoveredNode?.id === id;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.radius, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.lineWidth = isSelected ? 3 : (isHovered ? 2.5 : 1.5);
    ctx.strokeStyle = isSelected ? '#ffffff' : (layerBorders[node.level] || '#ffffff');
    ctx.stroke();

    // Pulse highlight for selected node
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.radius + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Client component marker
    if (node.isClientComponent) {
      ctx.beginPath();
      ctx.arc(pos.x + pos.radius * 0.7, pos.y - pos.radius * 0.7, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();
    }
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Canvas Pan & Zoom
  viewport.addEventListener('mousedown', (e) => {
    if (e.target !== canvas) return;
    state.isDragging = true;
    state.dragStart.x = e.clientX - state.transform.x;
    state.dragStart.y = e.clientY - state.transform.y;
  });

  window.addEventListener('mousemove', (e) => {
    if (state.isDragging) {
      state.transform.x = e.clientX - state.dragStart.x;
      state.transform.y = e.clientY - state.dragStart.y;
      requestAnimationFrame(render);
    } else {
      handleCanvasHover(e);
    }
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
  });

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    state.transform.x = mouseX - (mouseX - state.transform.x) * zoomFactor;
    state.transform.y = mouseY - (mouseY - state.transform.y) * zoomFactor;
    state.transform.scale *= zoomFactor;

    updateZoomHUD();
    requestAnimationFrame(render);
  }, { passive: false });

  // Canvas Click
  canvas.addEventListener('click', (e) => {
    const node = getNodeAtMouse(e);
    if (node) {
      selectNode(node);
    } else {
      closeDrawer();
    }
  });

  // Zoom HUD
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    state.transform.scale *= 1.25;
    updateZoomHUD();
    requestAnimationFrame(render);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    state.transform.scale *= 0.8;
    updateZoomHUD();
    requestAnimationFrame(render);
  });
  document.getElementById('btn-fit').addEventListener('click', () => {
    resetView();
    requestAnimationFrame(render);
  });

  // Rescan Action
  document.getElementById('btn-rescan').addEventListener('click', async () => {
    const btn = document.getElementById('btn-rescan');
    btn.disabled = true;
    btn.textContent = 'Scanning AST...';
    try {
      const res = await fetch('/api/rescan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await loadData();
        computeLayout();
        requestAnimationFrame(render);
      }
    } catch (err) {
      console.error('Rescan error:', err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Rescan AST`;
    }
  });

  // Mode Tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchMode(tab.dataset.mode);
    });
  });

  // Filters
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', (e) => {
    state.activeFilter.search = e.target.value;
    searchClear.classList.toggle('hidden', !e.target.value);
    applyFilters();
    requestAnimationFrame(render);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.activeFilter.search = '';
    searchClear.classList.add('hidden');
    applyFilters();
    requestAnimationFrame(render);
  });

  document.getElementById('filter-layer').addEventListener('change', (e) => {
    state.activeFilter.layer = e.target.value;
    applyFilters();
    requestAnimationFrame(render);
  });

  document.getElementById('filter-context').addEventListener('change', (e) => {
    state.activeFilter.context = e.target.value;
    applyFilters();
    requestAnimationFrame(render);
  });

  document.getElementById('filter-risk').addEventListener('change', (e) => {
    state.activeFilter.risk = e.target.value;
    applyFilters();
    requestAnimationFrame(render);
  });

  document.getElementById('toggle-client-only').addEventListener('change', (e) => {
    state.activeFilter.clientOnly = e.target.checked;
    applyFilters();
    requestAnimationFrame(render);
  });

  document.getElementById('toggle-edges').addEventListener('change', (e) => {
    state.activeFilter.showEdges = e.target.checked;
    requestAnimationFrame(render);
  });

  // Drawer Tabs & Close
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.dtab-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById('dtab-' + tab.dataset.dtab).classList.remove('hidden');
    });
  });

  // Proposals Simulation Button
  document.getElementById('btn-run-proposal').addEventListener('click', runProposalSimulation);
  document.getElementById('proposal-target-select').addEventListener('change', handleProposalTargetChange);
}

/**
 * Handle hover on canvas
 */
function handleCanvasHover(e) {
  const node = getNodeAtMouse(e);
  if (node !== state.hoveredNode) {
    state.hoveredNode = node;
    requestAnimationFrame(render);
  }

  if (node) {
    const pos = state.nodePositions.get(node.id);
    const screenX = pos.x * state.transform.scale + state.transform.x;
    const screenY = pos.y * state.transform.scale + state.transform.y;

    tooltip.style.left = (screenX + 12) + 'px';
    tooltip.style.top = (screenY - 24) + 'px';
    tooltip.classList.remove('hidden');
    tooltip.innerHTML = `
      <div style="font-weight:700;font-family:var(--font-mono);font-size:12px;margin-bottom:4px;">${node.label}</div>
      <div style="color:var(--text-muted);font-size:11px;">Layer: <b style="color:#38bdf8">${node.layer}</b> (L${node.level})</div>
      <div style="color:var(--text-muted);font-size:11px;">Context: <b>${node.boundedContext}</b></div>
      <div style="color:var(--text-muted);font-size:11px;">LOC: <b>${node.linesCount}</b> &bull; Max CRAP: <b style="color:${node.maxCrapScore > 30 ? '#ef4444' : '#10b981'}">${node.maxCrapScore}</b></div>
    `;
  } else {
    tooltip.classList.add('hidden');
  }
}

/**
 * Find node under mouse pointer
 */
function getNodeAtMouse(e) {
  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - state.transform.x) / state.transform.scale;
  const worldY = (mouseY - state.transform.y) / state.transform.scale;

  for (const [id, pos] of state.nodePositions.entries()) {
    if (!pos.visible) continue;
    const dx = worldX - pos.x;
    const dy = worldY - pos.y;
    if (dx * dx + dy * dy <= (pos.radius + 4) * (pos.radius + 4)) {
      return state.nodeMap.get(id);
    }
  }
  return null;
}

/**
 * Switch View Mode
 */
function switchMode(newMode) {
  state.mode = newMode;

  // Toggle visible containers
  const isGraph = newMode === 'rings' || newMode === 'clusters';
  document.getElementById('graph-viewport').classList.toggle('hidden', !isGraph);
  document.getElementById('heatmap-view').classList.toggle('hidden', newMode !== 'heatmap');
  document.getElementById('matrix-view').classList.toggle('hidden', newMode !== 'matrix');
  document.getElementById('proposals-view').classList.toggle('hidden', newMode !== 'proposals');

  if (isGraph) {
    computeLayout();
    resetView();
    requestAnimationFrame(render);
  } else if (newMode === 'heatmap') {
    populateHeatmapView();
  } else if (newMode === 'matrix') {
    populateMatrixView();
  }
}

/**
 * Select node and open side inspector
 */
async function selectNode(node) {
  state.selectedNode = node;
  requestAnimationFrame(render);

  const drawer = document.getElementById('inspector-drawer');
  drawer.classList.remove('collapsed');

  // Fill Header
  document.getElementById('insp-filename').textContent = node.label;
  document.getElementById('insp-meta').textContent = `${node.id} • ${node.linesCount} LOC`;

  const layerPill = document.getElementById('insp-layer-pill');
  layerPill.textContent = `L${node.level} ${node.layer}`;
  layerPill.className = `layer-pill layer-l${node.level}`;

  document.getElementById('insp-context-pill').textContent = node.boundedContext;

  // Fill CRAP Banner
  document.getElementById('insp-max-crap').textContent = node.maxCrapScore || 0;
  document.getElementById('insp-max-cc').textContent = node.maxCyclomaticComplexity || 1;
  document.getElementById('insp-crappy-count').textContent = node.crappyMethodsCount || 0;

  // Fill Functions list
  const fnContainer = document.getElementById('insp-functions-list');
  fnContainer.innerHTML = '';
  if (node.topRiskFunctions && node.topRiskFunctions.length > 0) {
    for (const fn of node.topRiskFunctions) {
      const card = document.createElement('div');
      card.className = `fn-card ${fn.isCrappy ? 'crappy' : ''}`;
      card.innerHTML = `
        <div class="fn-card-header">
          <span class="fn-name">${fn.name}</span>
          <span class="badge-crap" style="color:${fn.isCrappy ? '#ef4444' : '#10b981'}">CRAP ${fn.crapScore}</span>
        </div>
        <div class="fn-stats">
          <span>Lines: ${fn.startLine}–${fn.endLine}</span>
          <span>CC: <b>${fn.cyclomaticComplexity}</b></span>
          <span>Cov: ${fn.coverageRatio !== null ? fn.coverageRatio * 100 + '%' : 'Unmeasured'}</span>
        </div>
      `;
      fnContainer.appendChild(card);
    }
  } else {
    fnContainer.innerHTML = '<div class="text-muted" style="font-size:12px;">No risk functions recorded. Module is clean!</div>';
  }

  // Fill Dependencies list
  const incContainer = document.getElementById('insp-incoming-list');
  const outContainer = document.getElementById('insp-outgoing-list');
  incContainer.innerHTML = '';
  outContainer.innerHTML = '';

  const incoming = Array.from(state.incomingMap.get(node.id) || []);
  const outgoing = Array.from(state.outgoingMap.get(node.id) || []);

  document.getElementById('insp-inc-count').textContent = incoming.length;
  document.getElementById('insp-out-count').textContent = outgoing.length;

  for (const src of incoming) {
    const item = document.createElement('div');
    item.className = 'dep-item';
    item.textContent = src;
    item.title = src;
    item.onclick = () => {
      const targetNode = state.nodeMap.get(src);
      if (targetNode) selectNode(targetNode);
    };
    incContainer.appendChild(item);
  }

  for (const tgt of outgoing) {
    const item = document.createElement('div');
    item.className = 'dep-item';
    item.textContent = tgt;
    item.title = tgt;
    item.onclick = () => {
      const targetNode = state.nodeMap.get(tgt);
      if (targetNode) selectNode(targetNode);
    };
    outContainer.appendChild(item);
  }

  // Fetch Source Code Preview
  const codeElem = document.getElementById('insp-code-content');
  codeElem.textContent = 'Loading source code...';
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(node.id)}`);
    if (res.ok) {
      const data = await res.json();
      codeElem.textContent = data.content;
    } else {
      codeElem.textContent = '// Source code preview unavailable (Path restricted or external)';
    }
  } catch {
    codeElem.textContent = '// Failed to fetch source code';
  }
}

function closeDrawer() {
  state.selectedNode = null;
  document.getElementById('inspector-drawer').classList.add('collapsed');
  requestAnimationFrame(render);
}

/**
 * Populate CRAP Heatmap View
 */
function populateHeatmapView() {
  const tbody = document.getElementById('tbody-heatmap');
  tbody.innerHTML = '';

  const nodes = [...state.topology.nodes]
    .filter(n => (n.maxCrapScore || 0) > 0)
    .sort((a, b) => (b.maxCrapScore || 0) - (a.maxCrapScore || 0));

  for (const node of nodes.slice(0, 50)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:var(--font-mono);font-size:11px;font-weight:600;">${node.id}</td>
      <td><span class="layer-pill layer-l${node.level}">L${node.level} ${node.layer}</span></td>
      <td><span class="context-pill">${node.boundedContext}</span></td>
      <td style="font-family:var(--font-mono);">${node.linesCount}</td>
      <td style="font-family:var(--font-mono);color:${node.crappyMethodsCount > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${node.crappyMethodsCount}</td>
      <td style="font-family:var(--font-mono);">${node.maxCyclomaticComplexity}</td>
      <td><span class="badge-crap">${node.maxCrapScore}</span></td>
      <td><button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;">Inspect</button></td>
    `;
    tr.querySelector('button').onclick = () => {
      selectNode(node);
    };
    tbody.appendChild(tr);
  }
}

/**
 * Populate Architecture Matrix View (4 Layers x 6 Contexts)
 */
function populateMatrixView() {
  const grid = document.getElementById('matrix-grid');
  grid.innerHTML = '';

  const contexts = Object.keys(CONTEXT_CLUSTERS);
  const layers = [
    { lvl: 0, name: 'L0 Domain' },
    { lvl: 1, name: 'L1 Services' },
    { lvl: 2, name: 'L2 Application' },
    { lvl: 3, name: 'L3 Presentation' }
  ];

  for (const ctx of contexts) {
    const col = document.createElement('div');
    col.innerHTML = `<div class="matrix-col-header">${ctx}</div>`;

    for (const layer of layers) {
      // Aggregate matching nodes
      const matching = state.topology.nodes.filter(n => n.boundedContext === ctx && n.level === layer.lvl);
      const crapLoad = matching.reduce((acc, n) => acc + (n.crapLoad || 0), 0);
      const crappyCount = matching.reduce((acc, n) => acc + (n.crappyMethodsCount || 0), 0);

      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.innerHTML = `
        <div class="matrix-cell-title">${layer.name}</div>
        <div class="matrix-cell-num" style="color:${crappyCount > 0 ? '#f87171' : '#10b981'}">${matching.length} <span style="font-size:11px;font-weight:normal;color:var(--text-muted)">modules</span></div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">CrapLoad: <b>${crapLoad.toLocaleString()}</b></div>
      `;
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

/**
 * Populate Proposal Targets
 */
function populateProposalTargets() {
  const select = document.getElementById('proposal-target-select');
  select.innerHTML = '<option value="">-- Choose High-Risk Monolith --</option>';

  const candidates = [...state.topology.nodes]
    .filter(n => (n.crappyMethodsCount || 0) > 0)
    .sort((a, b) => (b.maxCrapScore || 0) - (a.maxCrapScore || 0));

  for (const c of candidates) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.id} (CRAP ${c.maxCrapScore}, ${c.crappyMethodsCount} crappy fns)`;
    select.appendChild(opt);
  }
}

function handleProposalTargetChange(e) {
  const targetId = e.target.value;
  const info = document.getElementById('proposal-target-info');
  const checklist = document.getElementById('proposal-functions-checklist');
  checklist.innerHTML = '';

  if (!targetId) {
    info.textContent = '';
    return;
  }

  const node = state.nodeMap.get(targetId);
  if (!node) return;

  info.innerHTML = `
    <b>Current Metrics:</b> ${node.linesCount} lines, Max CC: ${node.maxCyclomaticComplexity}, Max CRAP: ${node.maxCrapScore}, CrapLoad: ${node.crapLoad}.
  `;

  if (node.topRiskFunctions) {
    for (const fn of node.topRiskFunctions) {
      const item = document.createElement('label');
      item.className = 'check-item';
      item.innerHTML = `
        <span><input type="checkbox" name="prop-fn" value="${fn.name}" ${fn.isCrappy ? 'checked' : ''} /> <b>${fn.name}</b> (lines ${fn.startLine}-${fn.endLine})</span>
        <span class="badge-crap">CRAP ${fn.crapScore}</span>
      `;
      checklist.appendChild(item);
    }
  }
}

/**
 * Run Proposal Simulation
 */
async function runProposalSimulation() {
  const targetId = document.getElementById('proposal-target-select').value;
  if (!targetId) {
    alert('Please select a target module');
    return;
  }

  const checkedFns = Array.from(document.querySelectorAll('input[name="prop-fn"]:checked')).map(cb => cb.value);
  if (checkedFns.length === 0) {
    alert('Select at least one function to extract');
    return;
  }

  try {
    const res = await fetch('/api/proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetNodeId: targetId,
        splitFunctionNames: checkedFns
      })
    });

    const data = await res.json();
    if (data.success) {
      const p = data.proposal;
      document.getElementById('proposal-outcome-empty').classList.add('hidden');
      document.getElementById('proposal-outcome-result').classList.remove('hidden');

      document.getElementById('prop-reduction-pct').textContent = `-${p.crapReductionPct}%`;
      document.getElementById('prop-details').innerHTML = `
        <div style="font-size:13px;line-height:1.6;margin-top:12px;">
          <div>&bull; Extracted functions: <b>${p.removedRiskFns}</b></div>
          <div>&bull; Original CrapLoad: <b>${p.initialCrapLoad.toLocaleString()}</b> &rarr; Simulated: <b>${p.simulatedCrapLoad.toLocaleString()}</b></div>
          <div style="color:#38bdf8;font-weight:600;margin-top:6px;">${p.recommendation}</div>
        </div>
      `;

      // Generate SDD Draft
      const baseName = targetId.split('/').pop().replace(/\.tsx?$/, '');
      document.getElementById('prop-spec-code').textContent = 
`# SPEC: Refactoring of ${targetId}
1. Extract functions: [${checkedFns.join(', ')}] into 'src/services/${baseName}.pure.ts' (Level 1)
2. Add Unit Test Coverage >= 80% to bring CRAP score from ${p.initialCrapLoad} down to < 5
3. Replace direct implementation in ${baseName} with thin delegator wrapper
4. Verification: npx vitest run and npm run check:arch`;
    }
  } catch (err) {
    console.error('Proposal error:', err);
  }
}

// Start app
window.addEventListener('DOMContentLoaded', init);
