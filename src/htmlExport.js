/**
 * NetPlanner — Gerador de visualizador 3D standalone (HTML)
 * O arquivo gerado é autocontido: abre em qualquer browser sem instalar nada.
 * Usa Three.js via CDN (importmap ES modules).
 */

const EQUIPMENT_META = {
  camera:  { label: "Câmera",       color: "#ef4444" },
  wifi:    { label: "Access Point",  color: "#3b82f6" },
  switch:  { label: "Switch",        color: "#f59e0b" },
  router:  { label: "Roteador",      color: "#a855f7" },
  nvr:     { label: "NVR/DVR",       color: "#10b981" },
};

export function generateViewerHTML(projectName, pages, clientInfo, scale, companyLogo) {
  // Serialise project data (includes base64 images)
  const projectData = JSON.stringify({ projectName, pages, clientInfo, scale });

  // Counts per type across all pages
  const allEls = pages.flatMap((p) => p.elements);
  const counts = Object.entries(EQUIPMENT_META)
    .map(([t, m]) => ({ ...m, type: t, count: allEls.filter((e) => e.type === t).length }))
    .filter((e) => e.count > 0);

  const clientHTML = clientInfo?.name
    ? `<div class="client-name">${clientInfo.name}</div>
       ${clientInfo.address ? `<div class="client-info">${clientInfo.address}</div>` : ""}
       ${clientInfo.phone   ? `<div class="client-info">${clientInfo.phone}</div>`   : ""}
       ${clientInfo.email   ? `<div class="client-info">${clientInfo.email}</div>`   : ""}`
    : "";

  const legendItems = counts
    .map(
      (e) => `<div class="legend-item">
        <span class="legend-dot" style="background:${e.color};box-shadow:0 0 8px ${e.color}80"></span>
        <span class="legend-label">${e.label}</span>
        <span class="legend-count">${e.count}</span>
      </div>`
    )
    .join("");

  const pagesHTML = pages
    .map(
      (p, i) => `<button class="page-btn ${i === 0 ? "active" : ""}"
        onclick="switchPage(${i})" id="pbtn-${i}">${p.name}
        <span class="page-count">${p.elements.length}</span>
      </button>`
    )
    .join("");

  const logoHTML = companyLogo
    ? `<img src="${companyLogo}" class="company-logo" alt="Logo">`
    : `<div class="logo-icon">🌐</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — NetPlanner 3D</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#e8ecf1;color:#1a2332;font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;height:100vh;width:100vw}
    #canvas-container{position:fixed;inset:0}

    /* ── Header ── */
    .header{
      position:fixed;top:0;left:0;right:0;z-index:100;
      padding:10px 20px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      background:linear-gradient(180deg,rgba(248,249,251,0.97) 0%,rgba(248,249,251,0) 100%);
    }
    .header-left{display:flex;align-items:center;gap:14px}
    .logo-icon{width:36px;height:36px;background:#dbeafe;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .company-logo{width:36px;height:36px;object-fit:contain;border-radius:8px;background:#fff;padding:2px;border:1px solid #dfe3ea}
    .project-title{font-size:16px;font-weight:700;color:#1a2332;line-height:1.2}
    .project-sub{font-size:11px;color:#5f6b7a;margin-top:1px}
    .badge{background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #bfdbfe;letter-spacing:.4px}

    /* ── Client info ── */
    .client-name{font-size:14px;font-weight:700;color:#1a2332}
    .client-info{font-size:11px;color:#5f6b7a;margin-top:2px}

    /* ── Pages ── */
    .pages-bar{
      position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:100;
      display:flex;gap:4px;padding:6px;
      background:rgba(255,255,255,0.92);border-radius:12px;border:1px solid #dfe3ea;
      backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(0,0,0,0.08);
    }
    .page-btn{
      padding:5px 14px;border-radius:8px;border:1px solid transparent;
      background:transparent;color:#5f6b7a;cursor:pointer;font-size:12px;font-weight:600;
      display:flex;align-items:center;gap:6px;transition:all .2s;font-family:inherit;
    }
    .page-btn:hover{background:#f0f4f8;color:#1a2332}
    .page-btn.active{background:#2563eb;color:#fff;border-color:#1d4ed840}
    .page-count{background:rgba(0,0,0,.08);border-radius:4px;padding:0 5px;font-size:10px}

    /* ── Legend panel ── */
    .legend{
      position:fixed;bottom:20px;left:20px;z-index:100;
      background:rgba(255,255,255,0.92);border:1px solid #dfe3ea;
      border-radius:14px;padding:16px 18px;
      backdrop-filter:blur(16px);min-width:180px;box-shadow:0 2px 12px rgba(0,0,0,0.08);
    }
    .legend-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:10px}
    .legend-item{display:flex;align-items:center;gap:8px;margin-bottom:7px}
    .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .legend-label{font-size:12px;color:#5f6b7a;flex:1}
    .legend-count{font-size:13px;font-weight:700;color:#1a2332}
    .legend-total{border-top:1px solid #edf0f4;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;align-items:center}
    .legend-total-label{font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
    .legend-total-value{font-size:18px;font-weight:800;color:#2563eb}

    /* ── Controls hint ── */
    .controls-hint{
      position:fixed;bottom:20px;right:20px;z-index:100;
      background:rgba(255,255,255,0.88);border:1px solid #dfe3ea;
      border-radius:10px;padding:10px 14px;font-size:10px;color:#9ca3af;
      backdrop-filter:blur(12px);line-height:1.8;box-shadow:0 2px 8px rgba(0,0,0,0.06);
    }
    .controls-hint span{color:#5f6b7a}

    /* ── Watermark ── */
    .watermark{
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99;
      font-size:10px;color:#c8d0dc;font-weight:600;letter-spacing:.5px;
      pointer-events:none;
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>

  <div class="header">
    <div class="header-left">
      ${logoHTML}
      <div>
        <div class="project-title">${projectName}</div>
        <div class="project-sub">Visualização 3D Interativa</div>
      </div>
    </div>
    <div>${clientHTML}</div>
    <div class="badge">NetPlanner 3D</div>
  </div>

  ${pages.length > 1 ? `<div class="pages-bar">${pagesHTML}</div>` : ""}

  <div class="legend">
    <div class="legend-title">Equipamentos</div>
    ${legendItems}
    <div class="legend-total">
      <span class="legend-total-label">Total</span>
      <span class="legend-total-value">${allEls.length}</span>
    </div>
  </div>

  <div class="controls-hint">
    <span>🖱 Arrastar</span> — Orbitar<br>
    <span>🖱 Direito</span> — Mover<br>
    <span>🖱 Scroll</span> — Zoom
  </div>

  <div class="watermark">Gerado com NetPlanner</div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/"
    }
  }
  </script>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    /* ── Project data ── */
    const PROJECT = ${projectData};
    const SCALE = PROJECT.scale || 0.05;
    const S = 0.01;
    const CONE_H = 4.5;
    const EQ_META = {
      camera:  { color: 0xef4444 },
      wifi:    { color: 0x3b82f6 },
      switch:  { color: 0xf59e0b },
      router:  { color: 0xa855f7 },
      nvr:     { color: 0x10b981 },
    };

    /* ── Scene setup ── */
    const W = window.innerWidth, H = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8ecf1);
    scene.fog = new THREE.Fog(0xe8ecf1, 40, 160);

    /* ── Camera ── */
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.PointLight(0xdbeafe, 0.3, 60));

    /* ── Grid ── */
    const grid = new THREE.GridHelper(80, 30, 0xb0baca, 0xc8d0dc);
    grid.position.y = -0.005;
    scene.add(grid);

    /* ── Geometry helpers ── */
    function buildSectorGeo(radius, height, angleRad, segs) {
      segs = segs || 48;
      if (angleRad >= Math.PI * 2 - 0.01) {
        return new THREE.ConeGeometry(radius, height, segs, 1, true);
      }
      const steps = Math.max(6, Math.round(segs * angleRad / (Math.PI * 2)));
      const verts = [], idx = [];
      verts.push(0, 0, 0);
      for (let i = 0; i <= steps; i++) {
        const a = -angleRad / 2 + (angleRad * i / steps);
        verts.push(radius * Math.cos(a), -height, radius * Math.sin(a));
      }
      const cBase = verts.length / 3;
      verts.push(0, -height, 0);
      for (let i = 0; i < steps; i++) {
        idx.push(0, i + 2, i + 1);
        idx.push(cBase, i + 1, i + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }

    function buildFloorSector(radius, angleRad, segs) {
      segs = segs || 48;
      if (angleRad >= Math.PI * 2 - 0.01) {
        return new THREE.CircleGeometry(radius, segs);
      }
      const steps = Math.max(6, Math.round(segs * angleRad / (Math.PI * 2)));
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      for (let i = 0; i <= steps; i++) {
        const a = -angleRad / 2 + (angleRad * i / steps);
        shape.lineTo(radius * Math.cos(a), radius * Math.sin(a));
      }
      shape.lineTo(0, 0);
      return new THREE.ShapeGeometry(shape, steps);
    }

    function buildRingSector(innerR, outerR, angleRad, segs) {
      segs = segs || 48;
      if (angleRad >= Math.PI * 2 - 0.01) {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        return new THREE.ShapeGeometry(shape, segs);
      }
      const steps = Math.max(6, Math.round(segs * angleRad / (Math.PI * 2)));
      const halfA = angleRad / 2;
      const shape = new THREE.Shape();
      shape.moveTo(outerR * Math.cos(-halfA), outerR * Math.sin(-halfA));
      for (let i = 0; i <= steps; i++) {
        const a = -halfA + (angleRad * i / steps);
        shape.lineTo(outerR * Math.cos(a), outerR * Math.sin(a));
      }
      for (let i = steps; i >= 0; i--) {
        const a = -halfA + (angleRad * i / steps);
        shape.lineTo(innerR * Math.cos(a), innerR * Math.sin(a));
      }
      shape.closePath();
      return new THREE.ShapeGeometry(shape, steps);
    }

    /* ── Labels (CSS2D-style via DOM overlay) ── */
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:50';
    document.body.appendChild(labelContainer);
    const labels = [];

    function addLabel(text, color, worldPos) {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = \`
        position:absolute;
        background:rgba(10,15,30,0.92);
        color:#f1f5f9;
        padding:2px 8px 3px;
        border-radius:5px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
        border:1px solid \${color}60;
        letter-spacing:.3px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        box-shadow:0 0 10px \${color}30;
      \`;
      labelContainer.appendChild(el);
      labels.push({ el, worldPos });
      return el;
    }

    function updateLabels() {
      labels.forEach(({ el, worldPos }) => {
        const v = worldPos.clone().project(camera);
        if (v.z > 1) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.left = ((v.x + 1) / 2 * W) + 'px';
        el.style.top  = ((-v.y + 1) / 2 * H) + 'px';
      });
    }

    /* ── 3D equipment shapes — detailed miniatures ── */
    function build3DEquip(type, sz, color, x, z, rotY) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      if (type === 'camera') {
        const bg = new THREE.Group(); bg.rotation.y = rotY; group.add(bg);
        // Base plate
        const base = new THREE.Mesh(new THREE.CylinderGeometry(sz*1.05,sz*1.05,sz*0.1,36), new THREE.MeshStandardMaterial({color:0x1a2235,emissive:0x1a2235,emissiveIntensity:0.12,metalness:0.45,roughness:0.5}));
        base.position.y = sz*0.05; base.userData.main = true; base.castShadow = true; bg.add(base);
        // Collar
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.82,sz*0.97,sz*0.24,32), new THREE.MeshStandardMaterial({color:0x2d3f52,metalness:0.55,roughness:0.38}));
        collar.position.y = sz*0.17; collar.castShadow = true; bg.add(collar);
        // Dome glass
        const dome = new THREE.Mesh(new THREE.SphereGeometry(sz*0.8,36,18,0,Math.PI*2,0,Math.PI/2), new THREE.MeshStandardMaterial({color:0x0b1828,transparent:true,opacity:0.78,metalness:0.08,roughness:0.04}));
        dome.position.y = sz*0.24; bg.add(dome);
        // Iris lens
        const iris = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.24,sz*0.27,sz*0.1,24), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.8,metalness:0.3,roughness:0.2}));
        iris.rotation.z = -Math.PI/2; iris.position.set(sz*0.3,sz*0.3,0); iris.castShadow = true; bg.add(iris);
        // Screws
        for (let i=0;i<4;i++) { const a=(i*Math.PI)/2; const sc=new THREE.Mesh(new THREE.SphereGeometry(sz*0.06,8,8),new THREE.MeshStandardMaterial({color:0x0a1018,metalness:0.7,roughness:0.3})); sc.position.set(Math.cos(a)*sz*0.92,sz*0.06,Math.sin(a)*sz*0.92); bg.add(sc); }

      } else if (type === 'wifi') {
        // White disc body
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(sz*1.55,sz*1.45,sz*0.28,48), new THREE.MeshStandardMaterial({color:0xf1f5f9,emissive:0xf1f5f9,emissiveIntensity:0.08,metalness:0.1,roughness:0.25}));
        disc.position.y = sz*0.14; disc.userData.main = true; disc.castShadow = true; group.add(disc);
        // Groove rings
        [sz*1.22,sz*0.88].forEach((r,i) => { const ring=new THREE.Mesh(new THREE.CylinderGeometry(r,r,sz*0.04,48,1,true),new THREE.MeshStandardMaterial({color:i===0?0x94a3b8:0x64748b,side:THREE.DoubleSide,metalness:0.2,roughness:0.6})); ring.position.y=sz*0.27; group.add(ring); });
        // Hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.46,sz*0.46,sz*0.1,28), new THREE.MeshStandardMaterial({color:0x334155,metalness:0.4,roughness:0.4}));
        hub.position.y = sz*0.3; hub.castShadow = true; group.add(hub);
        // LED ring
        const ledR = new THREE.Mesh(new THREE.CylinderGeometry(sz*0.28,sz*0.28,sz*0.04,28,1,true), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.1,side:THREE.DoubleSide,transparent:true,opacity:0.9}));
        ledR.position.y = sz*0.35; group.add(ledR);
        // LED dots at 120°
        for (let i=0;i<3;i++) { const a=(i*Math.PI*2)/3; const led=new THREE.Mesh(new THREE.SphereGeometry(sz*0.07,8,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3})); led.position.set(Math.cos(a)*sz*1.35,sz*0.29,Math.sin(a)*sz*1.35); group.add(led); }

      } else if (type === 'switch') {
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(sz*3.1,sz*0.48,sz*1.5), new THREE.MeshStandardMaterial({color:0x1e293b,emissive:0x1e293b,emissiveIntensity:0.1,metalness:0.4,roughness:0.5}));
        chassis.position.y = sz*0.24; chassis.userData.main = true; chassis.castShadow = true; group.add(chassis);
        const top = new THREE.Mesh(new THREE.BoxGeometry(sz*3.05,sz*0.02,sz*1.45), new THREE.MeshStandardMaterial({color:0x263548,metalness:0.3,roughness:0.6}));
        top.position.y = sz*0.49; group.add(top);
        // Ports
        for (let row=0;row<2;row++) for (let i=0;i<8;i++) { const act=row===0?i<6:i<4; const p=new THREE.Mesh(new THREE.BoxGeometry(sz*0.22,sz*0.14,sz*0.06),new THREE.MeshStandardMaterial({color:act?0x22c55e:0x374151,emissive:act?0x22c55e:0,emissiveIntensity:act?0.85:0})); p.position.set((i-3.5)*sz*0.34,sz*0.44,sz*(row===0?0.4:0.62)); group.add(p); }
        // SFP
        const sfp=new THREE.Mesh(new THREE.BoxGeometry(sz*0.28,sz*0.18,sz*0.28),new THREE.MeshStandardMaterial({color:0xf59e0b,emissive:0xf59e0b,emissiveIntensity:0.55})); sfp.position.set(sz*1.2,sz*0.44,sz*0.51); group.add(sfp);
        // Status LEDs
        [[0.9,0x22c55e],[0.62,0x22c55e],[0.34,0x3b82f6]].forEach(([ox,c]) => { const led=new THREE.Mesh(new THREE.SphereGeometry(sz*0.08,8,8),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.0})); led.position.set(sz*ox,sz*0.52,sz*-0.6); group.add(led); });

      } else if (type === 'router') {
        const bg = new THREE.Group(); bg.rotation.y = rotY; group.add(bg);
        const body = new THREE.Mesh(new THREE.BoxGeometry(sz*2.1,sz*1.04,sz*1.5), new THREE.MeshStandardMaterial({color:0x2d1b69,emissive:0x2d1b69,emissiveIntensity:0.12,metalness:0.38,roughness:0.5}));
        body.position.y = sz*0.52; body.userData.main = true; body.castShadow = true; bg.add(body);
        // Antennas
        [-0.72,0.72].forEach(ox => {
          const base2=new THREE.Mesh(new THREE.CylinderGeometry(sz*0.13,sz*0.16,sz*0.22,12),new THREE.MeshStandardMaterial({color:0x1e1042,metalness:0.5,roughness:0.4})); base2.position.set(sz*ox,sz*0.62,sz*-0.55); bg.add(base2);
          const rod=new THREE.Mesh(new THREE.CylinderGeometry(sz*0.075,sz*0.1,sz*1.8,10),new THREE.MeshStandardMaterial({color:0x334155,metalness:0.6,roughness:0.3})); rod.position.set(sz*ox,sz*1.62,sz*-0.55); rod.castShadow=true; bg.add(rod);
          const tip=new THREE.Mesh(new THREE.SphereGeometry(sz*0.11,10,10),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.2})); tip.position.set(sz*ox,sz*2.55,sz*-0.55); bg.add(tip);
        });
        // LEDs
        [0x22c55e,0x22c55e,0x3b82f6,0x374151,0x374151].forEach((c,i) => { const led=new THREE.Mesh(new THREE.SphereGeometry(sz*0.08,8,8),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:c===0x374151?0:0.9})); led.position.set((i-2)*sz*0.34,sz*1.08,sz*0.52); bg.add(led); });
        // WAN
        const wan=new THREE.Mesh(new THREE.BoxGeometry(sz*0.28,sz*0.2,sz*0.06),new THREE.MeshStandardMaterial({color:0xf59e0b,emissive:0xf59e0b,emissiveIntensity:0.55})); wan.position.set(sz*-0.75,sz*0.3,sz*0.77); bg.add(wan);

      } else if (type === 'nvr') {
        const chassis=new THREE.Mesh(new THREE.BoxGeometry(sz*2.9,sz*1.44,sz*1.9),new THREE.MeshStandardMaterial({color:0x0f1f2e,emissive:0x0f1f2e,emissiveIntensity:0.1,metalness:0.4,roughness:0.5}));
        chassis.position.y=sz*0.72; chassis.userData.main=true; chassis.castShadow=true; group.add(chassis);
        const front=new THREE.Mesh(new THREE.BoxGeometry(sz*2.85,sz*1.38,sz*0.04),new THREE.MeshStandardMaterial({color:0x162636,metalness:0.3,roughness:0.6}));
        front.position.set(0,sz*0.72,sz*0.97); group.add(front);
        // HDD bays
        [-0.78,0,0.78].forEach((ox,i) => {
          const bay=new THREE.Mesh(new THREE.BoxGeometry(sz*0.65,sz*1.15,sz*0.04),new THREE.MeshStandardMaterial({color:0x1a3040,metalness:0.25,roughness:0.65})); bay.position.set(sz*ox,sz*0.72,sz*0.99); group.add(bay);
          const plt=new THREE.Mesh(new THREE.CylinderGeometry(sz*0.22,sz*0.22,sz*0.02,20),new THREE.MeshStandardMaterial({color:0x1d4ed8,emissive:0x1d4ed8,emissiveIntensity:0.4})); plt.rotation.x=Math.PI/2; plt.position.set(sz*ox,sz*0.8,sz*1.01); group.add(plt);
          const led=new THREE.Mesh(new THREE.SphereGeometry(sz*0.08,8,8),new THREE.MeshStandardMaterial({color:i<2?0x22c55e:0x374151,emissive:i<2?0x22c55e:0,emissiveIntensity:i<2?1.0:0})); led.position.set(sz*ox,sz*0.3,sz*1.01); group.add(led);
        });
        // Status LEDs
        [0x22c55e,0x22c55e,0xf59e0b,0x374151].forEach((c,i) => { const led=new THREE.Mesh(new THREE.SphereGeometry(sz*0.08,8,8),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:c===0x374151?0:0.9})); led.position.set((i-1.5)*sz*0.38,sz*1.38,sz*0.98); group.add(led); });
        // Power button
        const pwr=new THREE.Mesh(new THREE.CylinderGeometry(sz*0.14,sz*0.14,sz*0.06,16),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.85})); pwr.rotation.x=Math.PI/2; pwr.position.set(sz*1.22,sz*0.72,sz*0.99); group.add(pwr);

      } else {
        const s=new THREE.Mesh(new THREE.SphereGeometry(sz*0.7,16,16),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.15,metalness:0.3,roughness:0.4}));
        s.position.y=sz*0.8; s.userData.main=true; s.castShadow=true; group.add(s);
      }
      return group;
    }

    /* ── Page rendering ── */
    let pageGroup = null;

    function renderPage(pageIdx) {
      if (pageGroup) { scene.remove(pageGroup); pageGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } }); }
      labels.length = 0;
      labelContainer.innerHTML = '';
      pageGroup = new THREE.Group();
      scene.add(pageGroup);

      const pg = PROJECT.pages[pageIdx];
      if (!pg) return;

      const bgW = (pg.bgNatural?.w || 800) * S;
      const bgH = (pg.bgNatural?.h || 600) * S;

      // Position lights and grid
      dir.position.set(bgW, bgW * 1.2, bgH);
      dir.target.position.set(bgW / 2, 0, bgH / 2);
      scene.add(dir.target);
      grid.position.set(bgW / 2, -0.005, bgH / 2);
      grid.scale.set(Math.max(bgW, bgH) * 0.2, 1, Math.max(bgW, bgH) * 0.2);

      // Camera position
      const maxDim = Math.max(bgW, bgH);
      camera.position.set(bgW * 0.5, maxDim * 0.5, bgH * 0.95);
      controls.target.set(bgW / 2, 0, bgH / 2);
      controls.update();

      // Base plate
      const baseMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bgW * 1.6, bgH * 1.6),
        new THREE.MeshStandardMaterial({ color: 0xd1d9e6, roughness: 1 })
      );
      baseMesh.rotation.x = -Math.PI / 2;
      baseMesh.position.set(bgW / 2, -0.02, bgH / 2);
      pageGroup.add(baseMesh);

      // Floor plan image
      if (pg.bgImage) {
        const tex = new THREE.TextureLoader().load(pg.bgImage);
        tex.colorSpace = THREE.SRGBColorSpace;
        const floorMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(bgW, bgH),
          new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, opacity: 0.92 })
        );
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(bgW / 2, 0, bgH / 2);
        floorMesh.receiveShadow = true;
        pageGroup.add(floorMesh);
      }

      // Equipment
      pg.elements.forEach(el => {
        const meta = EQ_META[el.type] || { color: 0xffffff };
        const color = el.customColor ? parseInt(el.customColor.replace('#',''), 16) : meta.color;
        const colorHex = '#' + color.toString(16).padStart(6,'0');
        const x = el.x * S, z = el.y * S;
        const sz = { small: 0.25, medium: 0.36, large: 0.50 }[el.size || 'medium'];
        const rotY = -((el.rotation || 0) * Math.PI) / 180;

        // Base disc
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(sz * 1.3, 32),
          new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.15, depthWrite: false })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, 0.005, z);
        pageGroup.add(disc);

        // 3D equipment body
        const eqGroup = build3DEquip(el.type, sz, color, x, z, rotY);
        eqGroup.userData.isEquip = true;
        pageGroup.add(eqGroup);

        // Label
        addLabel(el.label, colorHex, new THREE.Vector3(x, sz * 3.5, z));

        // Coverage
        if (el.radius > 0 && el.angle > 0) {
          const radius = el.radius * S;
          const angleRad = (el.angle * Math.PI) / 180;
          const rotY = -(el.rotation || 0) * Math.PI / 180;

          if (el.type === 'camera' || el.type === 'nvr') {
            const coneGroup = new THREE.Group();
            coneGroup.position.set(x, CONE_H, z);
            coneGroup.rotation.y = rotY;

            // DORI zones if spec available
            if (el.type === 'camera' && el.cameraSpec?.doriDistances) {
              const dists = el.cameraSpec.doriDistances;
              const doriColors = { detection: 0x4ade80, observation: 0xfacc15, recognition: 0xf97316, identification: 0xf43f5e };
              const doriZones = ['detection', 'observation', 'recognition', 'identification'];
              const coneAngleRad = (el.cameraSpec.fovH || el.angle || 90) * Math.PI / 180;
              // Proportional: detection zone = el.radius pixels in world units
              const detWorldR = el.radius * S;
              const detDist = dists.detection;
              const zR = (zone) => detWorldR * (dists[zone] / detDist);

              // Volume cones (transparent)
              doriZones.forEach(zone => {
                const r = zR(zone);
                if (!r || r <= 0) return;
                const zColor = doriColors[zone];
                coneGroup.add(new THREE.Mesh(buildSectorGeo(r, CONE_H, coneAngleRad),
                  new THREE.MeshStandardMaterial({ color: zColor, emissive: zColor, emissiveIntensity: 0.45, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false })));
              });

              // Floor ring sectors — clear distinct colour bands
              const ringDefs = [
                { zone: 'detection',      outer: zR('detection'),      inner: zR('observation') },
                { zone: 'observation',    outer: zR('observation'),    inner: zR('recognition') },
                { zone: 'recognition',    outer: zR('recognition'),    inner: zR('identification') },
                { zone: 'identification', outer: zR('identification'), inner: 0 },
              ];
              const floorGroup = new THREE.Group();
              floorGroup.position.set(0, -CONE_H + 0.03, 0);
              floorGroup.rotation.x = -Math.PI / 2;
              ringDefs.forEach(({ zone, outer, inner }) => {
                if (outer <= 0) return;
                const geo = inner > 0.001 ? buildRingSector(inner, outer, coneAngleRad) : buildFloorSector(outer, coneAngleRad);
                const zColor = doriColors[zone];
                floorGroup.add(new THREE.Mesh(geo,
                  new THREE.MeshStandardMaterial({ color: zColor, emissive: zColor, emissiveIntensity: 0.65, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })));
              });
              coneGroup.add(floorGroup);
            } else {
              // Fallback single cone
              const coneGeo = buildSectorGeo(radius, CONE_H, angleRad);
              const fill = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
              const wire = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, transparent: true, opacity: 0.35, wireframe: true, depthWrite: false }));
              coneGroup.add(fill, wire);
              const floorFoot = new THREE.Mesh(buildFloorSector(radius, angleRad),
                new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
              floorFoot.position.set(0, -CONE_H + 0.03, 0);
              floorFoot.rotation.x = -Math.PI / 2;
              coneGroup.add(floorFoot);
            }

            pageGroup.add(coneGroup);
          } else {
            // WiFi / router rings
            const ringGroup = new THREE.Group();
            ringGroup.position.set(x, 0.02, z);
            ringGroup.rotation.x = -Math.PI / 2;

            const diskMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, transparent: true, opacity: 0.40, side: THREE.DoubleSide, depthWrite: false });
            ringGroup.add(new THREE.Mesh(new THREE.CircleGeometry(radius, 64), diskMat));

            [1, 0.66, 0.33].forEach(r => {
              const rMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
              ringGroup.add(new THREE.Mesh(new THREE.RingGeometry(radius * r - 0.05, radius * r, 72), rMat));
            });

            pageGroup.add(ringGroup);
          }
        }
      });

      // Connections
      pg.connections.forEach(cn => {
        const from = pg.elements.find(e => e.id === cn.from);
        const to   = pg.elements.find(e => e.id === cn.to);
        if (!from || !to) return;
        const points = [
          new THREE.Vector3(from.x * S, 0.08, from.y * S),
          new THREE.Vector3(to.x   * S, 0.08, to.y   * S)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.14, gapSize: 0.08, linewidth: 1 });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        pageGroup.add(line);
      });
    }

    /* ── Page switching ── */
    window.switchPage = function(idx) {
      document.querySelectorAll('.page-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
      renderPage(idx);
    };

    /* ── Initial render ── */
    renderPage(0);

    /* ── Animation loop ── */
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Animate emissive pulse on equipment bodies
      pageGroup?.traverse(obj => {
        if (obj.isMesh && obj.userData.main && obj.material?.emissive) {
          obj.material.emissiveIntensity = 0.12 + 0.06 * Math.sin(t * 1.5);
        }
      });

      controls.update();
      updateLabels();
      renderer.render(scene, camera);
    }
    animate();

    /* ── Resize ── */
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  </script>
</body>
</html>`;
}
