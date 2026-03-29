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
    body{background:#060c18;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;height:100vh;width:100vw}
    #canvas-container{position:fixed;inset:0}

    /* ── Header ── */
    .header{
      position:fixed;top:0;left:0;right:0;z-index:100;
      padding:10px 20px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      background:linear-gradient(180deg,rgba(6,12,24,0.97) 0%,rgba(6,12,24,0) 100%);
    }
    .header-left{display:flex;align-items:center;gap:14px}
    .logo-icon{width:36px;height:36px;background:#1e3a5f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .company-logo{width:36px;height:36px;object-fit:contain;border-radius:8px;background:#fff;padding:2px}
    .project-title{font-size:16px;font-weight:700;color:#f1f5f9;line-height:1.2}
    .project-sub{font-size:11px;color:#64748b;margin-top:1px}
    .badge{background:#1e3a5f;color:#93c5fd;font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #2563eb40;letter-spacing:.4px}

    /* ── Client info ── */
    .client-name{font-size:14px;font-weight:700;color:#f1f5f9}
    .client-info{font-size:11px;color:#64748b;margin-top:2px}

    /* ── Pages ── */
    .pages-bar{
      position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:100;
      display:flex;gap:4px;padding:6px;
      background:rgba(6,12,24,0.9);border-radius:12px;border:1px solid #1e293b;
      backdrop-filter:blur(12px);
    }
    .page-btn{
      padding:5px 14px;border-radius:8px;border:1px solid transparent;
      background:transparent;color:#64748b;cursor:pointer;font-size:12px;font-weight:600;
      display:flex;align-items:center;gap:6px;transition:all .2s;font-family:inherit;
    }
    .page-btn:hover{background:#1e293b;color:#e2e8f0}
    .page-btn.active{background:#1e40af;color:#fff;border-color:#3b82f640}
    .page-count{background:rgba(255,255,255,.12);border-radius:4px;padding:0 5px;font-size:10px}

    /* ── Legend panel ── */
    .legend{
      position:fixed;bottom:20px;left:20px;z-index:100;
      background:rgba(10,15,30,0.9);border:1px solid #1e293b;
      border-radius:14px;padding:16px 18px;
      backdrop-filter:blur(16px);min-width:180px;
    }
    .legend-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#475569;margin-bottom:10px}
    .legend-item{display:flex;align-items:center;gap:8px;margin-bottom:7px}
    .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .legend-label{font-size:12px;color:#94a3b8;flex:1}
    .legend-count{font-size:13px;font-weight:700;color:#f1f5f9}
    .legend-total{border-top:1px solid #1e293b;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;align-items:center}
    .legend-total-label{font-size:10px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
    .legend-total-value{font-size:18px;font-weight:800;color:#3b82f6}

    /* ── Controls hint ── */
    .controls-hint{
      position:fixed;bottom:20px;right:20px;z-index:100;
      background:rgba(10,15,30,0.85);border:1px solid #1e293b;
      border-radius:10px;padding:10px 14px;font-size:10px;color:#475569;
      backdrop-filter:blur(12px);line-height:1.8;
    }
    .controls-hint span{color:#64748b}

    /* ── Watermark ── */
    .watermark{
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99;
      font-size:10px;color:#1e293b;font-weight:600;letter-spacing:.5px;
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c18);
    scene.fog = new THREE.Fog(0x060c18, 30, 120);

    /* ── Camera ── */
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xc8d8f0, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 0.65);
    dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.PointLight(0x3b82f6, 0.6, 60));

    /* ── Grid ── */
    const grid = new THREE.GridHelper(80, 30, 0x1a2744, 0x0f1a2e);
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
      camera.position.set(bgW * 0.5, bgW * 0.85, bgH + bgH * 0.6);
      controls.target.set(bgW / 2, 0, bgH / 2);
      controls.update();

      // Dark base
      const baseMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bgW * 1.6, bgH * 1.6),
        new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 1 })
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
        const sz = { small: 0.16, medium: 0.22, large: 0.30 }[el.size || 'medium'];

        // Base disc
        const discGeo = new THREE.CircleGeometry(sz * 1.1, 32);
        const discMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.18, depthWrite: false });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, 0.005, z);
        pageGroup.add(disc);

        // Sphere
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(sz, 20, 20),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, metalness: 0.35, roughness: 0.3 })
        );
        sphere.position.set(x, 0.22, z);
        sphere.castShadow = true;
        pageGroup.add(sphere);

        // Label
        addLabel(el.label, colorHex, new THREE.Vector3(x, 0.22 + sz + 0.2, z));

        // Coverage
        if (el.radius > 0 && el.angle > 0) {
          const radius = el.radius * S;
          const angleRad = (el.angle * Math.PI) / 180;
          const rotY = -(el.rotation || 0) * Math.PI / 180;

          if (el.type === 'camera' || el.type === 'nvr') {
            // 3D cone
            const coneGeo = buildSectorGeo(radius, CONE_H, angleRad);
            const coneGroup = new THREE.Group();
            coneGroup.position.set(x, CONE_H, z);
            coneGroup.rotation.y = rotY;

            const fill = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
            const wire = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.28, wireframe: true, depthWrite: false }));
            coneGroup.add(fill, wire);

            // Floor footprint
            const floorGeo = buildFloorSector(radius, angleRad);
            const floorMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
            const floorFoot = new THREE.Mesh(floorGeo, floorMat);
            floorFoot.position.set(0, -CONE_H + 0.03, 0);
            floorFoot.rotation.x = -Math.PI / 2;
            coneGroup.add(floorFoot);

            pageGroup.add(coneGroup);
          } else {
            // WiFi rings
            const ringGroup = new THREE.Group();
            ringGroup.position.set(x, 0.02, z);
            ringGroup.rotation.x = -Math.PI / 2;

            const diskMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
            ringGroup.add(new THREE.Mesh(new THREE.CircleGeometry(radius, 64), diskMat));

            [1, 0.66, 0.33].forEach(r => {
              const rMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
              ringGroup.add(new THREE.Mesh(new THREE.RingGeometry(radius * r - 0.04, radius * r, 72), rMat));
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

      // Animate emissive on spheres (simple pulse)
      pageGroup?.traverse(obj => {
        if (obj.isMesh && obj.geometry?.type === 'SphereGeometry' && obj.material?.emissive) {
          obj.material.emissiveIntensity = 0.25 + 0.12 * Math.sin(t * 1.5);
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
