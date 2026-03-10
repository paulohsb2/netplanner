import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  Camera, Wifi, Network, Router, HardDrive, Upload, Download,
  Undo2, Redo2, Trash2, Copy, Ruler, Move, MousePointer, Plus, Minus,
  X, Eye, EyeOff, FileImage, FileText,
  Maximize2, Save, FolderOpen, Grid3X3, Layers,
  Link2, Image, Building2
} from "lucide-react";

/* ═══════════════════════ CONSTANTS ═══════════════════════ */
const EQUIPMENT = [
  { type: "camera", label: "Câmera", icon: Camera, color: "#ef4444", layer: "cftv", coverageRadius: 80, angle: 90 },
  { type: "wifi", label: "Access Point", icon: Wifi, color: "#3b82f6", layer: "wifi", coverageRadius: 120, angle: 360 },
  { type: "switch", label: "Switch", icon: Network, color: "#f59e0b", layer: "rede", coverageRadius: 0, angle: 0 },
  { type: "router", label: "Roteador", icon: Router, color: "#8b5cf6", layer: "rede", coverageRadius: 100, angle: 360 },
  { type: "nvr", label: "NVR/DVR", icon: HardDrive, color: "#10b981", layer: "cftv", coverageRadius: 0, angle: 0 },
];

const LAYERS = [
  { id: "cftv", label: "CFTV", color: "#ef4444", types: ["camera", "nvr"] },
  { id: "rede", label: "Rede", color: "#f59e0b", types: ["switch", "router"] },
  { id: "wifi", label: "Wi-Fi", color: "#3b82f6", types: ["wifi"] },
];

const SIZES = { small: 24, medium: 32, large: 42 };

const DK = {
  bg: "#0a0e1a", sidebar: "#0f1629", toolbar: "#111827", card: "#1a2236",
  border: "#1e293b", accent: "#3b82f6", text: "#e2e8f0",
  textMuted: "#94a3b8", textDim: "#64748b", danger: "#ef4444",
  success: "#22c55e", canvas: "#1a1f2e",
};

const makeBlankPage = (id, name) => ({
  id, name, bgImage: null, bgNatural: { w: 0, h: 0 },
  elements: [], measureLines: [], connections: [],
});

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function NetPlanner() {
  /* ─── project state ─── */
  const [pages, setPages] = useState([makeBlankPage("page-1", "Pavimento 1")]);
  const [currentPageId, setCurrentPageId] = useState("page-1");
  const [projectName, setProjectName] = useState("Novo Projeto");
  const [editingName, setEditingName] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: "", address: "", phone: "", email: "" });
  const [companyLogo, setCompanyLogo] = useState(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.08);
  const [scale, setScale] = useState(0.05);

  /* ─── UI state ─── */
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showCables, setShowCables] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState({ cftv: true, rede: true, wifi: true });
  const [sidebarTab, setSidebarTab] = useState("equip");
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [measurePoints, setMeasurePoints] = useState([]);
  const [calibratePoints, setCalibratePoints] = useState([]);
  const [calibrateDialog, setCalibrateDialog] = useState(null);
  const [calibrateMeters, setCalibrateMeters] = useState("");
  const [cableStart, setCableStart] = useState(null);
  const [nextNumbers, setNextNumbers] = useState({ camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
  const [pdfDialog, setPdfDialog] = useState(false);

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const containerRef = useRef(null);

  /* ─── derived ─── */
  const page = pages.find(p => p.id === currentPageId) || pages[0];
  const elements = page.elements;
  const measureLines = page.measureLines;
  const connections = page.connections;

  const updatePage = useCallback((updates) => {
    setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, ...updates } : p));
  }, [currentPageId]);

  const setElements = useCallback((fn) => {
    setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, elements: typeof fn === "function" ? fn(p.elements) : fn } : p));
  }, [currentPageId]);

  const setMeasureLines = useCallback((fn) => {
    setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, measureLines: typeof fn === "function" ? fn(p.measureLines) : fn } : p));
  }, [currentPageId]);

  const setConnections = useCallback((fn) => {
    setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, connections: typeof fn === "function" ? fn(p.connections) : fn } : p));
  }, [currentPageId]);

  const visibleElements = elements.filter(el => {
    const eq = EQUIPMENT.find(e => e.type === el.type);
    return eq && layerVisibility[eq.layer] !== false;
  });

  const counts = {};
  EQUIPMENT.forEach(eq => { counts[eq.type] = elements.filter(e => e.type === eq.type).length; });
  const totalEquip = elements.length;

  /* ─── undo/redo ─── */
  const saveSnapshot = useCallback(() => {
    const snap = JSON.stringify({ elements: page.elements, measureLines: page.measureLines, connections: page.connections });
    setUndoStack(prev => [...prev.slice(-30), snap]);
    setRedoStack([]);
  }, [page]);

  const undo = () => {
    if (!undoStack.length) return;
    const snap = JSON.parse(undoStack[undoStack.length - 1]);
    setRedoStack(prev => [...prev, JSON.stringify({ elements, measureLines, connections })]);
    updatePage({ elements: snap.elements, measureLines: snap.measureLines || [], connections: snap.connections || [] });
    setUndoStack(prev => prev.slice(0, -1));
    setSelectedId(null); setSelectedMeasure(null);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const snap = JSON.parse(redoStack[redoStack.length - 1]);
    setUndoStack(prev => [...prev, JSON.stringify({ elements, measureLines, connections })]);
    updatePage({ elements: snap.elements, measureLines: snap.measureLines || [], connections: snap.connections || [] });
    setRedoStack(prev => prev.slice(0, -1));
    setSelectedId(null); setSelectedMeasure(null);
  };

  /* ─── page management ─── */
  const addPage = () => {
    const id = `page-${Date.now()}`;
    setPages(prev => [...prev, makeBlankPage(id, `Pavimento ${prev.length + 1}`)]);
    setCurrentPageId(id);
    setUndoStack([]); setRedoStack([]); setSelectedId(null);
  };

  const deletePage = (id) => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter(p => p.id !== id));
    if (currentPageId === id) setCurrentPageId(pages.find(p => p.id !== id).id);
  };

  const renamePage = (id, name) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  /* ─── file loading ─── */
  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        updatePage({ bgImage: img.src, bgNatural: { w: img.naturalWidth, h: img.naturalHeight } });
        if (containerRef.current) {
          const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
          const fitZoom = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1) * 0.9;
          setZoom(fitZoom);
          setPan({ x: (cw - img.naturalWidth * fitZoom) / 2, y: (ch - img.naturalHeight * fitZoom) / 2 });
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCompanyLogo(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* ─── canvas interactions ─── */
  const getCanvasPos = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom };
  };

  const handleCanvasClick = (e) => {
    if (dragging) return;
    const { x, y } = getCanvasPos(e);

    if (tool.startsWith("place:")) {
      const type = tool.split(":")[1];
      const eq = EQUIPMENT.find(eq => eq.type === type); if (!eq) return;
      saveSnapshot();
      const num = nextNumbers[type];
      setNextNumbers(prev => ({ ...prev, [type]: prev[type] + 1 }));
      const newEl = {
        id: `${type}-${Date.now()}`, type, label: `${eq.label} ${String(num).padStart(2, "0")}`,
        number: num, x, y, rotation: 0, angle: eq.angle, radius: eq.coverageRadius,
        visible: true, notes: "", customColor: null, size: "medium",
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }

    if (tool === "measure") {
      if (measurePoints.length === 0) setMeasurePoints([{ x, y }]);
      else {
        const p1 = measurePoints[0];
        const dist = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);
        saveSnapshot();
        setMeasureLines(prev => [...prev, { p1, p2: { x, y }, dist }]);
        setMeasurePoints([]);
      }
      return;
    }

    if (tool === "calibrate") {
      if (calibratePoints.length === 0) setCalibratePoints([{ x, y }]);
      else {
        const p1 = calibratePoints[0];
        const pixelDist = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);
        setCalibrateDialog({ pixelDist, p1, p2: { x, y } });
        setCalibrateMeters(""); setCalibratePoints([]);
      }
      return;
    }

    if (tool === "cable") {
      const hitEl = visibleElements.find(el => Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2) < 20);
      if (!hitEl) return;
      if (!cableStart) setCableStart(hitEl.id);
      else if (hitEl.id !== cableStart) {
        saveSnapshot();
        setConnections(prev => [...prev, { id: `conn-${Date.now()}`, from: cableStart, to: hitEl.id }]);
        setCableStart(null);
      }
      return;
    }

    // select - check measurement hit
    if (tool === "select") {
      let clickedMeasure = null;
      measureLines.forEach((ml, i) => {
        const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2;
        if (Math.sqrt((x - mx) ** 2 + (y - my) ** 2) < 20 / zoom) clickedMeasure = i;
      });
      if (clickedMeasure !== null) { setSelectedMeasure(clickedMeasure); setSelectedId(null); return; }
    }

    setSelectedId(null); setSelectedMeasure(null);
  };

  const startDrag = (e, id) => {
    e.stopPropagation();
    if (tool === "measure" || tool === "calibrate" || tool === "cable") return;
    saveSnapshot(); setSelectedId(id);
    const { x, y } = getCanvasPos(e);
    const el = elements.find(el => el.id === id);
    setDragging({ id, offsetX: x - el.x, offsetY: y - el.y });
  };

  const onMouseMove = (e) => {
    if (dragging) {
      const { x, y } = getCanvasPos(e);
      setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x: x - dragging.offsetX, y: y - dragging.offsetY } : el));
    }
    if (panning) {
      setPan({ x: pan.x + (e.clientX - panStart.x), y: pan.y + (e.clientY - panStart.y) });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const onMouseUp = () => { setDragging(null); setPanning(false); };

  const startPan = (e) => {
    if (tool === "pan" || e.button === 1) { e.preventDefault(); setPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5);
    setPan({ x: mx - (mx - pan.x) * (newZoom / zoom), y: my - (my - pan.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const fitToScreen = () => {
    if (!page.bgNatural.w || !containerRef.current) return;
    const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
    const fitZoom = Math.min(cw / page.bgNatural.w, ch / page.bgNatural.h, 1) * 0.9;
    setZoom(fitZoom);
    setPan({ x: (cw - page.bgNatural.w * fitZoom) / 2, y: (ch - page.bgNatural.h * fitZoom) / 2 });
  };

  /* ─── element CRUD ─── */
  const updateEl = (id, props) => { saveSnapshot(); setElements(prev => prev.map(el => el.id === id ? { ...el, ...props } : el)); };
  const deleteEl = (id) => {
    saveSnapshot();
    setElements(prev => prev.filter(el => el.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicateEl = (id) => {
    const el = elements.find(e => e.id === id); if (!el) return;
    saveSnapshot();
    const eq = EQUIPMENT.find(eq => eq.type === el.type);
    const num = nextNumbers[el.type];
    setNextNumbers(prev => ({ ...prev, [el.type]: prev[el.type] + 1 }));
    const clone = { ...el, id: `${el.type}-${Date.now()}`, x: el.x + 30, y: el.y + 30, number: num, label: `${eq.label} ${String(num).padStart(2, "0")}` };
    setElements(prev => [...prev, clone]);
    setSelectedId(clone.id);
  };

  /* ─── keyboard ─── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Delete") {
        if (selectedMeasure !== null) { saveSnapshot(); setMeasureLines(prev => prev.filter((_, i) => i !== selectedMeasure)); setSelectedMeasure(null); }
        else if (selectedId) deleteEl(selectedId);
      }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Escape") { setTool("select"); setMeasurePoints([]); setCalibratePoints([]); setCalibrateDialog(null); setCableStart(null); setSelectedId(null); setSelectedMeasure(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  /* ─── render to canvas (for export) ─── */
  const renderToCanvas = (pg) => {
    return new Promise((resolve) => {
      const cvs = document.createElement("canvas");
      cvs.width = pg.bgNatural.w; cvs.height = pg.bgNatural.h;
      const ctx = cvs.getContext("2d");

      const draw = () => {
        // cables
        pg.connections.forEach(conn => {
          const f = pg.elements.find(e => e.id === conn.from), t = pg.elements.find(e => e.id === conn.to);
          if (!f || !t) return;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.setLineDash([8, 4]); ctx.stroke(); ctx.setLineDash([]);
        });
        // coverage
        pg.elements.forEach(el => {
          const eq = EQUIPMENT.find(e => e.type === el.type);
          if (!eq || el.radius <= 0 || el.angle <= 0) return;
          const color = el.customColor || eq.color;
          ctx.save(); ctx.translate(el.x, el.y);
          ctx.rotate((el.rotation - el.angle / 2) * Math.PI / 180);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, el.radius, 0, el.angle * Math.PI / 180); ctx.closePath();
          ctx.fillStyle = color + "30"; ctx.strokeStyle = color + "80"; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
        });
        // dots
        pg.elements.forEach(el => {
          const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return;
          const color = el.customColor || eq.color;
          ctx.beginPath(); ctx.arc(el.x, el.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
          ctx.strokeText(el.label, el.x + 14, el.y + 4); ctx.fillText(el.label, el.x + 14, el.y + 4);
        });
        // measurements
        pg.measureLines.forEach(ml => {
          ctx.beginPath(); ctx.moveTo(ml.p1.x, ml.p1.y); ctx.lineTo(ml.p2.x, ml.p2.y);
          ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
          const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2;
          ctx.font = "bold 12px sans-serif"; ctx.fillStyle = "#fbbf24"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
          const t = `${(ml.dist * scale).toFixed(1)}m`;
          ctx.strokeText(t, mx + 4, my - 6); ctx.fillText(t, mx + 4, my - 6);
        });
        resolve(cvs);
      };

      if (pg.bgImage) {
        const img = new window.Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); draw(); };
        img.src = pg.bgImage;
      } else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cvs.width, cvs.height); draw(); }
    });
  };

  /* ─── export PNG ─── */
  const exportPNG = async () => {
    const cvs = await renderToCanvas(page);
    const link = document.createElement("a");
    link.download = `${projectName} - ${page.name}.png`;
    link.href = cvs.toDataURL("image/png"); link.click();
  };

  /* ─── export PDF ─── */
  const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 0, b: 0 };
  };

  const exportPDF = async () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 12;

    // ── COVER ──
    pdf.setFillColor(10, 14, 26); pdf.rect(0, 0, W, H, "F");
    pdf.setFillColor(59, 130, 246); pdf.rect(0, 0, 5, H, "F");

    if (companyLogo) { try { pdf.addImage(companyLogo, "PNG", M + 8, 28, 38, 38); } catch {} }

    const tY = companyLogo ? 86 : 55;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(226, 232, 240);
    pdf.text("PROJETO TÉCNICO", M + 8, tY);
    pdf.setFontSize(15); pdf.setTextColor(59, 130, 246);
    pdf.text(projectName.toUpperCase(), M + 8, tY + 11);

    if (clientInfo.name || clientInfo.address) {
      let cy = tY + 26;
      pdf.setFillColor(15, 22, 41); pdf.rect(M + 4, cy - 6, W - M * 2 - 4, 36, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184); pdf.text("CLIENTE", M + 8, cy); cy += 7;
      pdf.setFontSize(12); pdf.setTextColor(226, 232, 240);
      if (clientInfo.name) { pdf.text(clientInfo.name, M + 8, cy); cy += 6; }
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(148, 163, 184);
      if (clientInfo.address) { pdf.text(clientInfo.address, M + 8, cy); cy += 5; }
      if (clientInfo.phone) { pdf.text(`Tel: ${clientInfo.phone}`, M + 8, cy); cy += 5; }
      if (clientInfo.email) { pdf.text(clientInfo.email, M + 8, cy); }
    }

    const allEls = pages.flatMap(p => p.elements);
    const sY = 178;
    pdf.setFillColor(15, 22, 41); pdf.rect(M + 4, sY, W - M * 2 - 4, 48, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184); pdf.text("RESUMO DO PROJETO", M + 8, sY + 7);
    let sx = M + 8, sy = sY + 16;
    EQUIPMENT.forEach(eq => {
      const c = allEls.filter(e => e.type === eq.type).length; if (c === 0) return;
      const rgb = hexToRgb(eq.color); pdf.setFillColor(rgb.r, rgb.g, rgb.b); pdf.circle(sx + 2, sy - 1.5, 1.8, "F");
      pdf.setFontSize(10); pdf.setTextColor(226, 232, 240); pdf.setFont("helvetica", "bold"); pdf.text(`${c}x`, sx + 6, sy);
      pdf.setFont("helvetica", "normal"); pdf.text(eq.label, sx + 14, sy);
      sx += 48; if (sx > W - M - 20) { sx = M + 8; sy += 8; }
    });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(59, 130, 246);
    pdf.text(`Total: ${allEls.length} equipamentos | ${pages.filter(p => p.bgImage).length} planta(s)`, M + 8, sY + 40);

    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.setFont("helvetica", "normal");
    pdf.text(dateStr, M + 8, H - 16); pdf.setFontSize(7); pdf.text("Gerado por NetPlanner v2.1", M + 8, H - 10);

    // ── PLANT PAGES ──
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi]; if (!pg.bgImage) continue;
      const landscape = pg.bgNatural.w > pg.bgNatural.h;
      pdf.addPage("a4", landscape ? "landscape" : "portrait");
      const pW = landscape ? 297 : 210, pH = landscape ? 210 : 297;

      pdf.setFillColor(10, 14, 26); pdf.rect(0, 0, pW, M + 14, "F");
      pdf.setFillColor(59, 130, 246); pdf.rect(0, 0, pW, 2, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(226, 232, 240); pdf.text(pg.name, M, M + 6);
      pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
      const pgInfo = EQUIPMENT.map(eq => { const c = pg.elements.filter(e => e.type === eq.type).length; return c > 0 ? `${c} ${eq.label}` : null; }).filter(Boolean).join(" | ");
      pdf.text(pgInfo || "", pW - M, M + 6, { align: "right" });

      const hH = M + 16, legH = pg.elements.length > 0 ? Math.min(42, 8 + pg.elements.length * 4) : 0;
      const aW = pW - M * 2, aH = pH - hH - M - legH - 4;
      const fs = Math.min(aW / pg.bgNatural.w, aH / pg.bgNatural.h);
      const iW = pg.bgNatural.w * fs, iH = pg.bgNatural.h * fs;
      const iX = M + (aW - iW) / 2, iY = hH;

      const cvs = await renderToCanvas(pg);
      pdf.addImage(cvs.toDataURL("image/png"), "PNG", iX, iY, iW, iH);
      pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.3); pdf.rect(iX, iY, iW, iH, "S");

      if (pg.elements.length > 0) {
        const ly = iY + iH + 3;
        pdf.setFillColor(10, 14, 26); pdf.rect(M, ly, aW, legH, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184); pdf.text("LEGENDA", M + 3, ly + 5);
        let ry = ly + 9;
        const cols = [M + 3, M + 24, M + 54, M + 84, M + 114];
        pdf.setFontSize(6); pdf.text("ID", cols[0], ry); pdf.text("TIPO", cols[1], ry);
        pdf.text("POSIÇÃO", cols[2], ry); pdf.text("COBERTURA", cols[3], ry); pdf.text("OBS", cols[4], ry); ry += 3.5;
        pg.elements.forEach((el, i) => {
          if (ry > pH - M - 2) return;
          const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return;
          if (i % 2 === 0) { pdf.setFillColor(15, 22, 41); pdf.rect(M + 1, ry - 2.2, aW - 2, 3.8, "F"); }
          const rgb = hexToRgb(el.customColor || eq.color); pdf.setFillColor(rgb.r, rgb.g, rgb.b); pdf.circle(cols[0] + 1.2, ry - 0.4, 0.9, "F");
          pdf.setFontSize(6); pdf.setTextColor(226, 232, 240); pdf.setFont("helvetica", "bold"); pdf.text(el.label, cols[0] + 3.5, ry);
          pdf.setFont("helvetica", "normal"); pdf.setTextColor(148, 163, 184);
          pdf.text(eq.label, cols[1], ry); pdf.text(`(${Math.round(el.x)},${Math.round(el.y)})`, cols[2], ry);
          pdf.text(el.radius > 0 ? `${(el.radius * scale).toFixed(1)}m/${el.angle}°` : "—", cols[3], ry);
          pdf.text((el.notes || "—").substring(0, 28), cols[4], ry); ry += 3.8;
        });
      }

      pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
      pdf.text(`NetPlanner — ${projectName}`, M, pH - 3);
      pdf.text(`1px = ${scale}m | Pág. ${pi + 2}`, pW - M, pH - 3, { align: "right" });
    }

    pdf.save(`${projectName}.pdf`);
    setPdfDialog(false);
  };

  /* ─── save/load ─── */
  const saveProject = () => {
    const data = { projectName, pages, clientInfo, companyLogo, watermarkOpacity, scale, nextNumbers, version: "2.1" };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a"); link.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}.json`;
    link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href);
  };

  const loadProject = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const d = JSON.parse(await file.text());
        setPages(d.pages || [makeBlankPage("page-1", "Pavimento 1")]);
        setCurrentPageId((d.pages || [])[0]?.id || "page-1");
        setProjectName(d.projectName || "Projeto"); setClientInfo(d.clientInfo || { name: "", address: "", phone: "", email: "" });
        setCompanyLogo(d.companyLogo || null); setWatermarkOpacity(d.watermarkOpacity ?? 0.08);
        setScale(d.scale || 0.05); setNextNumbers(d.nextNumbers || { camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
        setUndoStack([]); setRedoStack([]); setSelectedId(null);
      } catch { alert("Erro ao carregar projeto."); }
    };
    input.click();
  };

  const selected = elements.find(e => e.id === selectedId);
  const selectedEq = selected ? EQUIPMENT.find(eq => eq.type === selected.type) : null;

  /* ─── styles ─── */
  const btnS = (active = false) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "6px 9px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 500, background: active ? DK.accent : "transparent", color: active ? "#fff" : DK.textMuted });
  const lblS = { display: "block", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: DK.textDim, marginBottom: "3px", fontWeight: 700 };
  const inpS = { width: "100%", padding: "7px 9px", borderRadius: "5px", border: `1px solid ${DK.border}`, background: DK.bg, color: DK.text, fontSize: "12px", outline: "none", boxSizing: "border-box" };
  const secT = { fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DK.textDim, marginBottom: "6px", fontWeight: 700 };

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: DK.bg, color: DK.text, fontFamily: "'Segoe UI', -apple-system, sans-serif", overflow: "hidden", userSelect: "none" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div style={{ width: "256px", minWidth: "256px", background: DK.sidebar, borderRight: `1px solid ${DK.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${DK.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: `linear-gradient(135deg, ${DK.accent}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center" }}><Layers size={14} color="#fff" /></div>
          <div><div style={{ fontSize: "12px", fontWeight: 700 }}>NetPlanner</div><div style={{ fontSize: "9px", color: DK.textDim }}>v2.1</div></div>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${DK.border}` }}>
          {[["equip", "Equip."], ["layers", "Camadas"], ["pages", "Páginas"], ["config", "Config"]].map(([k, l]) => (
            <button key={k} onClick={() => setSidebarTab(k)} style={{ flex: 1, padding: "7px 2px", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, background: sidebarTab === k ? DK.card : "transparent", color: sidebarTab === k ? DK.accent : DK.textDim, borderBottom: sidebarTab === k ? `2px solid ${DK.accent}` : "2px solid transparent" }}>{l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>

          {sidebarTab === "equip" && (<>
            <div style={secT}>Adicionar equipamento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "12px" }}>
              {EQUIPMENT.map(eq => { const Icon = eq.icon; const isA = tool === `place:${eq.type}`; return (
                <button key={eq.type} onClick={() => setTool(isA ? "select" : `place:${eq.type}`)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", borderRadius: "6px", border: isA ? `1px solid ${eq.color}` : "1px solid transparent", cursor: "pointer", textAlign: "left", background: isA ? eq.color + "18" : DK.card, color: isA ? eq.color : DK.text }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "5px", background: eq.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={13} color={eq.color} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: "11px", fontWeight: 600 }}>{eq.label}</div><div style={{ fontSize: "9px", color: DK.textDim }}>{counts[eq.type] || 0} un.</div></div>
                  <Plus size={11} color={DK.textDim} />
                </button>
              ); })}
            </div>

            <div style={secT}>Ferramentas</div>
            <button onClick={() => setTool(tool === "cable" ? "select" : "cable")} style={{ ...btnS(tool === "cable"), width: "100%", marginBottom: "4px", background: DK.card, border: `1px solid ${DK.border}` }}><Link2 size={13} /> Conectar (cabo)</button>
            <button onClick={() => { setTool("calibrate"); setCalibratePoints([]); }} style={{ ...btnS(tool === "calibrate"), width: "100%", marginBottom: "6px", background: DK.card, border: `1px solid ${DK.border}` }}><Ruler size={13} /> Calibrar escala</button>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: DK.textDim, marginBottom: "12px", paddingLeft: "3px" }}>
              1px = <input type="number" value={scale} onChange={e => setScale(parseFloat(e.target.value) || 0.01)} step="0.01" min="0.001" style={{ width: "50px", padding: "2px 4px", borderRadius: "3px", border: `1px solid ${DK.border}`, background: DK.bg, color: DK.text, fontSize: "10px", textAlign: "center" }} /> m
            </div>

            <div style={secT}>Resumo</div>
            {EQUIPMENT.map(eq => { const c = counts[eq.type] || 0; if (c === 0) return null; const Icon = eq.icon; return (
              <div key={eq.type} style={{ display: "flex", alignItems: "center", gap: "6px", background: DK.card, borderRadius: "5px", padding: "5px 7px", marginBottom: "3px" }}>
                <Icon size={11} color={eq.color} /><span style={{ flex: 1, fontSize: "10px", color: DK.textMuted }}>{eq.label}</span><span style={{ fontSize: "12px", fontWeight: 800, color: eq.color }}>{c}</span>
              </div>
            ); })}
            {totalEquip > 0 && <div style={{ background: `${DK.accent}15`, borderRadius: "5px", padding: "6px", textAlign: "center", marginTop: "4px", border: `1px solid ${DK.accent}20` }}><span style={{ fontSize: "14px", fontWeight: 800, color: DK.accent }}>{totalEquip}</span><span style={{ fontSize: "9px", color: DK.textDim, marginLeft: "5px" }}>total</span></div>}
          </>)}

          {sidebarTab === "layers" && (<>
            <div style={secT}>Camadas</div>
            {LAYERS.map(layer => (
              <button key={layer.id} onClick={() => setLayerVisibility(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))} style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", padding: "9px", borderRadius: "6px", border: "none", cursor: "pointer", marginBottom: "4px", background: layerVisibility[layer.id] ? layer.color + "15" : DK.card, color: layerVisibility[layer.id] ? layer.color : DK.textDim }}>
                {layerVisibility[layer.id] ? <Eye size={13} /> : <EyeOff size={13} />}
                <span style={{ flex: 1, textAlign: "left", fontSize: "11px", fontWeight: 600 }}>{layer.label}</span>
                <span style={{ fontSize: "9px" }}>{layer.types.reduce((a, t) => a + (counts[t] || 0), 0)}</span>
              </button>
            ))}
            <div style={{ ...secT, marginTop: "14px" }}>Opções</div>
            <button onClick={() => setShowCoverage(!showCoverage)} style={{ ...btnS(showCoverage), width: "100%", marginBottom: "3px", background: DK.card, border: `1px solid ${DK.border}` }}>{showCoverage ? <Eye size={12} /> : <EyeOff size={12} />} Cobertura</button>
            <button onClick={() => setShowCables(!showCables)} style={{ ...btnS(showCables), width: "100%", marginBottom: "3px", background: DK.card, border: `1px solid ${DK.border}` }}>{showCables ? <Eye size={12} /> : <EyeOff size={12} />} Cabeamento</button>
            <button onClick={() => setShowGrid(!showGrid)} style={{ ...btnS(showGrid), width: "100%", background: DK.card, border: `1px solid ${DK.border}` }}><Grid3X3 size={12} /> Grade</button>

            {elements.length > 0 && (<>
              <div style={{ ...secT, marginTop: "14px" }}>Legenda</div>
              {EQUIPMENT.map(eq => { const items = elements.filter(e => e.type === eq.type); if (!items.length) return null; const Icon = eq.icon; return (
                <div key={eq.type}><div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 5px", fontSize: "9px", fontWeight: 700, color: eq.color }}><Icon size={10} /> {eq.label} ({items.length})</div>
                {items.map(it => <button key={it.id} onClick={() => { setSelectedId(it.id); setSidebarTab("equip"); }} style={{ display: "block", width: "100%", padding: "3px 5px 3px 18px", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px", textAlign: "left", background: selectedId === it.id ? DK.accent + "25" : "transparent", color: selectedId === it.id ? DK.text : DK.textMuted }}>{it.label}</button>)}</div>
              ); })}
            </>)}

            {measureLines.length > 0 && (<>
              <div style={{ ...secT, marginTop: "14px" }}>Medições</div>
              {measureLines.map((ml, i) => (
                <div key={i} onClick={() => { setSelectedMeasure(i); setSelectedId(null); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", background: selectedMeasure === i ? "#fbbf2420" : DK.card, border: selectedMeasure === i ? "1px solid #fbbf2430" : "1px solid transparent", borderRadius: "4px", marginBottom: "2px", cursor: "pointer" }}>
                  <span style={{ fontSize: "10px", color: "#fbbf24" }}>#{i + 1}: {(ml.dist * scale).toFixed(2)}m</span>
                  <button onClick={(e) => { e.stopPropagation(); saveSnapshot(); setMeasureLines(prev => prev.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textDim, padding: "1px" }}><X size={10} /></button>
                </div>
              ))}
            </>)}
          </>)}

          {sidebarTab === "pages" && (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={secT}>Plantas / Andares</div>
              <button onClick={addPage} style={{ ...btnS(), background: DK.accent, color: "#fff", padding: "3px 7px", borderRadius: "4px", fontSize: "10px" }}><Plus size={11} /> Nova</button>
            </div>
            {pages.map(pg => (
              <div key={pg.id} onClick={() => { setCurrentPageId(pg.id); setSelectedId(null); setUndoStack([]); setRedoStack([]); }} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 9px", borderRadius: "5px", cursor: "pointer", marginBottom: "3px", background: currentPageId === pg.id ? DK.accent + "20" : DK.card, border: currentPageId === pg.id ? `1px solid ${DK.accent}35` : "1px solid transparent" }}>
                <Building2 size={13} color={currentPageId === pg.id ? DK.accent : DK.textDim} />
                <div style={{ flex: 1 }}>
                  <input value={pg.name} onChange={e => renamePage(pg.id, e.target.value)} onClick={e => e.stopPropagation()} style={{ background: "transparent", border: "none", color: DK.text, fontSize: "11px", fontWeight: 600, width: "100%", outline: "none", padding: 0 }} />
                  <div style={{ fontSize: "8px", color: DK.textDim }}>{pg.elements.length} equip. | {pg.bgImage ? "✓" : "—"}</div>
                </div>
                {pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); deletePage(pg.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textDim }}><X size={11} /></button>}
              </div>
            ))}
          </>)}

          {sidebarTab === "config" && (<>
            <div style={secT}>Dados do cliente (PDF)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "12px" }}>
              <input value={clientInfo.name} onChange={e => setClientInfo({ ...clientInfo, name: e.target.value })} placeholder="Nome do cliente" style={inpS} />
              <input value={clientInfo.address} onChange={e => setClientInfo({ ...clientInfo, address: e.target.value })} placeholder="Endereço" style={inpS} />
              <input value={clientInfo.phone} onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })} placeholder="Telefone" style={inpS} />
              <input value={clientInfo.email} onChange={e => setClientInfo({ ...clientInfo, email: e.target.value })} placeholder="E-mail" style={inpS} />
            </div>
            <div style={secT}>Logo da empresa</div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            {companyLogo ? (
              <div style={{ display: "flex", alignItems: "center", gap: "7px", background: DK.card, borderRadius: "5px", padding: "7px", marginBottom: "8px" }}>
                <img src={companyLogo} style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "3px" }} />
                <span style={{ flex: 1, fontSize: "10px", color: DK.textMuted }}>Logo OK</span>
                <button onClick={() => setCompanyLogo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DK.danger }}><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => logoRef.current?.click()} style={{ ...btnS(), width: "100%", background: DK.card, border: `1px solid ${DK.border}`, marginBottom: "8px" }}><Image size={12} /> Carregar logo</button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "10px", color: DK.textDim }}>
              Marca d'água: <input type="range" value={watermarkOpacity} onChange={e => setWatermarkOpacity(parseFloat(e.target.value))} min="0" max="0.3" step="0.01" style={{ flex: 1, accentColor: DK.accent }} /> {Math.round(watermarkOpacity * 100)}%
            </div>
          </>)}
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* toolbar */}
        <div style={{ background: DK.toolbar, borderBottom: `1px solid ${DK.border}`, padding: "5px 12px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
          {editingName ? <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)} style={{ background: DK.bg, border: `1px solid ${DK.accent}`, borderRadius: "3px", padding: "3px 6px", color: DK.text, fontSize: "11px", fontWeight: 600, width: "130px" }} />
          : <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", cursor: "pointer", color: DK.text, fontSize: "11px", fontWeight: 600, marginRight: "3px" }}>{projectName}</button>}
          <div style={{ width: "1px", height: "20px", background: DK.border, margin: "0 2px" }} />
          <button onClick={() => fileRef.current?.click()} style={btnS()} title="Planta"><Upload size={13} /> Planta</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={saveProject} style={btnS()}><Save size={13} /></button>
          <button onClick={loadProject} style={btnS()}><FolderOpen size={13} /></button>
          <button onClick={exportPNG} style={btnS()} disabled={!page.bgImage}><Download size={13} /> PNG</button>
          <button onClick={() => setPdfDialog(true)} style={btnS()} disabled={!pages.some(p => p.bgImage)}><FileText size={13} /> PDF</button>
          <div style={{ width: "1px", height: "20px", background: DK.border, margin: "0 2px" }} />
          <button onClick={() => { setTool("select"); setCableStart(null); }} style={btnS(tool === "select")}><MousePointer size={13} /></button>
          <button onClick={() => setTool("pan")} style={btnS(tool === "pan")}><Move size={13} /></button>
          <button onClick={() => { setTool("measure"); setMeasurePoints([]); }} style={btnS(tool === "measure")}><Ruler size={13} /></button>
          <div style={{ width: "1px", height: "20px", background: DK.border, margin: "0 2px" }} />
          <button onClick={undo} style={btnS()} disabled={!undoStack.length}><Undo2 size={13} /></button>
          <button onClick={redo} style={btnS()} disabled={!redoStack.length}><Redo2 size={13} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "9px", color: DK.textDim, marginRight: "6px" }}>{page.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", background: DK.card, borderRadius: "5px", padding: "2px 5px" }}>
            <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textMuted, display: "flex" }}><Minus size={12} /></button>
            <span style={{ fontSize: "10px", color: DK.textMuted, minWidth: "34px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textMuted, display: "flex" }}><Plus size={12} /></button>
            <button onClick={fitToScreen} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textMuted, display: "flex" }}><Maximize2 size={12} /></button>
          </div>
        </div>

        {/* hint bar */}
        {tool !== "select" && (
          <div style={{ padding: "4px 12px", fontSize: "10px", borderBottom: `1px solid ${DK.border}`, display: "flex", alignItems: "center", gap: "5px", background: DK.card, color: tool === "cable" ? "#94a3b8" : tool === "measure" || tool === "calibrate" ? "#fbbf24" : DK.accent }}>
            {tool.startsWith("place:") && <><Plus size={11} /> Clique para posicionar. Esc cancela.</>}
            {tool === "measure" && <><Ruler size={11} /> {measurePoints.length === 0 ? "Clique no ponto inicial." : "Clique no ponto final."}</>}
            {tool === "calibrate" && <><Ruler size={11} /> {calibratePoints.length === 0 ? "Clique no início de medida conhecida." : "Clique no ponto final."}</>}
            {tool === "cable" && <><Link2 size={11} /> {!cableStart ? "Clique no equipamento de origem." : "Clique no destino."}</>}
            {tool === "pan" && <><Move size={11} /> Arraste para mover.</>}
          </div>
        )}

        {/* canvas */}
        <div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative", background: DK.canvas, cursor: tool === "pan" ? "grab" : tool === "measure" || tool === "calibrate" ? "crosshair" : tool === "cable" ? "cell" : tool.startsWith("place:") ? "copy" : "default" }}
          onMouseDown={startPan} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          {!page.bgImage ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "12px", background: DK.card, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${DK.border}` }}><FileImage size={26} color={DK.textDim} /></div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: DK.textMuted }}>Carregue uma planta para "{page.name}"</div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: "8px 20px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: DK.accent, color: "#fff" }}><Upload size={12} style={{ marginRight: "5px", verticalAlign: "-2px" }} /> Selecionar</button>
            </div>
          ) : (
            <div ref={canvasRef} onClick={handleCanvasClick} onWheel={handleWheel} style={{ position: "absolute", inset: 0 }}>
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute" }}>
                <img src={page.bgImage} style={{ display: "block", width: page.bgNatural.w, height: page.bgNatural.h, imageRendering: zoom > 2 ? "pixelated" : "auto" }} draggable={false} />

                {companyLogo && watermarkOpacity > 0 && <img src={companyLogo} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "30%", maxHeight: "30%", opacity: watermarkOpacity, pointerEvents: "none" }} />}

                {showGrid && <svg style={{ position: "absolute", top: 0, left: 0, width: page.bgNatural.w, height: page.bgNatural.h, pointerEvents: "none" }}><defs><pattern id="gr" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke={DK.textDim} strokeWidth="0.3" opacity="0.3" /></pattern></defs><rect width="100%" height="100%" fill="url(#gr)" /></svg>}

                <svg style={{ position: "absolute", top: 0, left: 0, width: page.bgNatural.w, height: page.bgNatural.h, pointerEvents: "none" }}>
                  {showCables && connections.map(conn => { const f = elements.find(e => e.id === conn.from), t = elements.find(e => e.id === conn.to); if (!f || !t) return null; return (
                    <g key={conn.id} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); saveSnapshot(); setConnections(prev => prev.filter(c => c.id !== conn.id)); }}>
                      <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={10 / zoom} />
                      <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#475569" strokeWidth={2 / zoom} strokeDasharray={`${8 / zoom} ${4 / zoom}`} />
                      <circle cx={(f.x + t.x) / 2} cy={(f.y + t.y) / 2} r={3 / zoom} fill="#64748b" />
                    </g>); })}

                  {showCoverage && visibleElements.filter(e => e.radius > 0 && e.angle > 0).map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); const c = el.customColor || eq.color; const sa = (el.rotation - el.angle / 2) * Math.PI / 180, ea = (el.rotation + el.angle / 2) * Math.PI / 180; const x1 = el.x + el.radius * Math.cos(sa), y1 = el.y + el.radius * Math.sin(sa), x2 = el.x + el.radius * Math.cos(ea), y2 = el.y + el.radius * Math.sin(ea); const la = el.angle > 180 ? 1 : 0; const d = el.angle >= 360 ? `M ${el.x + el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x - el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x + el.radius} ${el.y}` : `M ${el.x} ${el.y} L ${x1} ${y1} A ${el.radius} ${el.radius} 0 ${la} 1 ${x2} ${y2} Z`; return <path key={`c-${el.id}`} d={d} fill={c + "20"} stroke={c + "60"} strokeWidth={1.2 / zoom} />; })}

                  {measureLines.map((ml, i) => { const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; const s = selectedMeasure === i; return (
                    <g key={`m-${i}`} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedMeasure(i); setSelectedId(null); }}>
                      <line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke="transparent" strokeWidth={12 / zoom} />
                      <line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke={s ? "#fff" : "#fbbf24"} strokeWidth={(s ? 3 : 2) / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />
                      <circle cx={ml.p1.x} cy={ml.p1.y} r={(s ? 5 : 4) / zoom} fill={s ? "#fff" : "#fbbf24"} />
                      <circle cx={ml.p2.x} cy={ml.p2.y} r={(s ? 5 : 4) / zoom} fill={s ? "#fff" : "#fbbf24"} />
                      <rect x={mx - 24 / zoom} y={my - 16 / zoom} width={48 / zoom} height={18 / zoom} rx={3 / zoom} fill={s ? "#fbbf24" : "#000"} opacity={s ? .9 : .7} />
                      <text x={mx} y={my - 4 / zoom} textAnchor="middle" fill={s ? "#000" : "#fbbf24"} fontSize={11 / zoom} fontWeight="bold">{(ml.dist * scale).toFixed(1)}m</text>
                    </g>); })}

                  {measurePoints.length === 1 && <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={5 / zoom} fill="#fbbf24" stroke="#000" strokeWidth={1.5 / zoom} />}
                  {calibratePoints.length === 1 && <circle cx={calibratePoints[0].x} cy={calibratePoints[0].y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} />}
                  {calibrateDialog && <><line x1={calibrateDialog.p1.x} y1={calibrateDialog.p1.y} x2={calibrateDialog.p2.x} y2={calibrateDialog.p2.y} stroke="#f97316" strokeWidth={3 / zoom} strokeDasharray={`${8 / zoom} ${4 / zoom}`} /><circle cx={calibrateDialog.p1.x} cy={calibrateDialog.p1.y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} /><circle cx={calibrateDialog.p2.x} cy={calibrateDialog.p2.y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} /></>}
                </svg>

                {visibleElements.map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return null; const Icon = eq.icon; const isSel = selectedId === el.id; const isCbl = cableStart === el.id; const color = el.customColor || eq.color; const sz = SIZES[el.size || "medium"]; return (
                  <div key={el.id} onMouseDown={(e) => startDrag(e, el.id)} onClick={(e) => { e.stopPropagation(); if (tool === "cable") handleCanvasClick(e); else { setSelectedId(el.id); setSelectedMeasure(null); } }} style={{ position: "absolute", left: el.x - sz / 2, top: el.y - sz / 2, width: sz, height: sz, cursor: tool === "cable" ? "cell" : "pointer", zIndex: isSel ? 100 : 10 }}>
                    {(isSel || isCbl) && <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${isCbl ? DK.success : color}`, opacity: .6, animation: "pulse 1.5s infinite" }} />}
                    <div style={{ width: sz, height: sz, borderRadius: "50%", background: `radial-gradient(circle, ${color}, ${color}cc)`, border: isSel ? "2.5px solid #fff" : `2px solid ${color}88`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${color}50` }}><Icon size={sz * .45} color="#fff" strokeWidth={2.2} /></div>
                    <div style={{ position: "absolute", left: "50%", top: sz + 3 + "px", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: Math.max(9, 10 / Math.sqrt(zoom)), fontWeight: 700, color: "#fff", textShadow: "0 1px 3px #000, 0 0 6px #000", pointerEvents: "none" }}>{el.label}</div>
                  </div>); })}
              </div>
            </div>
          )}
        </div>

        {/* status bar */}
        <div style={{ background: DK.toolbar, borderTop: `1px solid ${DK.border}`, padding: "2px 12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", color: DK.textDim }}>
          {EQUIPMENT.map(eq => { const c = counts[eq.type] || 0; if (!c) return null; const I = eq.icon; return <span key={eq.type} style={{ display: "flex", alignItems: "center", gap: "2px" }}><I size={9} color={eq.color} /> {c}</span>; })}
          <span style={{ fontWeight: 600 }}>{totalEquip} total</span>
          <span>| {connections.length} cabo{connections.length !== 1 ? "s" : ""} | {measureLines.length} med.</span>
          <div style={{ flex: 1 }} />
          <span>{page.name} | {pages.length} pág.</span>
          <span>{Math.round(zoom * 100)}% | 1px={scale}m</span>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      {selected && selectedEq && (
        <div style={{ width: "260px", minWidth: "260px", background: DK.sidebar, borderLeft: `1px solid ${DK.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
          <div style={{ padding: "12px", borderBottom: `1px solid ${DK.border}`, display: "flex", alignItems: "center", gap: "7px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "5px", background: (selected.customColor || selectedEq.color) + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>{(() => { const I = selectedEq.icon; return <I size={14} color={selected.customColor || selectedEq.color} />; })()}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: "11px", fontWeight: 700 }}>{selected.label}</div><div style={{ fontSize: "9px", color: DK.textDim }}>{selectedEq.label} #{selected.number}</div></div>
            <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textDim }}><X size={13} /></button>
          </div>
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div><label style={lblS}>Nome</label><input value={selected.label} onChange={e => updateEl(selected.id, { label: e.target.value })} style={inpS} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
              <div><label style={lblS}>X</label><input type="number" value={Math.round(selected.x)} onChange={e => updateEl(selected.id, { x: +e.target.value || 0 })} style={inpS} /></div>
              <div><label style={lblS}>Y</label><input type="number" value={Math.round(selected.y)} onChange={e => updateEl(selected.id, { y: +e.target.value || 0 })} style={inpS} /></div>
            </div>
            <div><label style={lblS}>Rotação</label>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}><input type="number" value={selected.rotation} onChange={e => updateEl(selected.id, { rotation: +e.target.value || 0 })} min={0} max={360} style={{ ...inpS, flex: 1 }} /><input type="range" value={selected.rotation} onChange={e => updateEl(selected.id, { rotation: +e.target.value })} min={0} max={360} style={{ flex: 2, accentColor: selected.customColor || selectedEq.color }} /></div>
              <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>{[["N", 270], ["L", 0], ["S", 90], ["O", 180]].map(([d, v]) => <button key={d} onClick={() => updateEl(selected.id, { rotation: v })} style={{ flex: 1, padding: "3px", borderRadius: "3px", border: `1px solid ${DK.border}`, cursor: "pointer", fontSize: "9px", fontWeight: 600, background: selected.rotation === v ? (selected.customColor || selectedEq.color) + "30" : DK.card, color: selected.rotation === v ? (selected.customColor || selectedEq.color) : DK.textDim }}>{d}</button>)}</div>
            </div>
            <div><label style={lblS}>Ângulo cobertura</label><div style={{ display: "flex", gap: "5px", alignItems: "center" }}><input type="number" value={selected.angle} onChange={e => updateEl(selected.id, { angle: Math.min(360, Math.max(0, +e.target.value || 0)) })} style={{ ...inpS, flex: 1 }} /><input type="range" value={selected.angle} onChange={e => updateEl(selected.id, { angle: +e.target.value })} min={0} max={360} style={{ flex: 2, accentColor: selected.customColor || selectedEq.color }} /></div></div>
            <div><label style={lblS}>Alcance (px)</label><div style={{ display: "flex", gap: "5px", alignItems: "center" }}><input type="number" value={selected.radius} onChange={e => updateEl(selected.id, { radius: Math.max(0, +e.target.value || 0) })} style={{ ...inpS, flex: 1 }} /><input type="range" value={selected.radius} onChange={e => updateEl(selected.id, { radius: +e.target.value })} min={0} max={300} style={{ flex: 2, accentColor: selected.customColor || selectedEq.color }} /></div>{selected.radius > 0 && <div style={{ fontSize: "9px", color: DK.textDim, marginTop: "1px" }}>≈ {(selected.radius * scale).toFixed(1)}m</div>}</div>
            <div><label style={lblS}>Cor</label><div style={{ display: "flex", gap: "4px", alignItems: "center" }}><input type="color" value={selected.customColor || selectedEq.color} onChange={e => updateEl(selected.id, { customColor: e.target.value })} style={{ width: "30px", height: "26px", border: `1px solid ${DK.border}`, borderRadius: "3px", cursor: "pointer", background: DK.bg, padding: "1px" }} /><span style={{ fontSize: "10px", color: DK.textMuted, flex: 1 }}>{selected.customColor || "Padrão"}</span>{selected.customColor && <button onClick={() => updateEl(selected.id, { customColor: null })} style={{ background: "none", border: "none", cursor: "pointer", color: DK.textDim, fontSize: "9px" }}>Reset</button>}</div></div>
            <div><label style={lblS}>Tamanho</label><div style={{ display: "flex", gap: "2px" }}>{["small", "medium", "large"].map(s => <button key={s} onClick={() => updateEl(selected.id, { size: s })} style={{ flex: 1, padding: "3px", borderRadius: "3px", border: `1px solid ${DK.border}`, cursor: "pointer", fontSize: "9px", fontWeight: 600, background: (selected.size || "medium") === s ? DK.accent + "30" : DK.card, color: (selected.size || "medium") === s ? DK.accent : DK.textDim }}>{s === "small" ? "P" : s === "medium" ? "M" : "G"}</button>)}</div></div>
            <div><label style={lblS}>Observações</label><textarea value={selected.notes || ""} onChange={e => updateEl(selected.id, { notes: e.target.value })} placeholder="Modelo, specs..." rows={2} style={{ ...inpS, resize: "vertical", fontFamily: "inherit" }} /></div>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <button onClick={() => duplicateEl(selected.id)} style={{ flex: 1, padding: "6px", borderRadius: "4px", border: `1px solid ${DK.border}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: DK.card, color: DK.text, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}><Copy size={11} /> Duplicar</button>
              <button onClick={() => deleteEl(selected.id)} style={{ flex: 1, padding: "6px", borderRadius: "4px", border: `1px solid ${DK.danger}30`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: DK.danger + "15", color: DK.danger, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}><Trash2 size={11} /> Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}
      {calibrateDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: DK.sidebar, borderRadius: "10px", padding: "20px", width: "300px", border: `1px solid ${DK.border}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Calibrar Escala</div>
            <div style={{ fontSize: "10px", color: DK.textMuted, marginBottom: "10px" }}>Linha: <strong style={{ color: "#f97316" }}>{Math.round(calibrateDialog.pixelDist)}px</strong>. Informe metros:</div>
            <div style={{ display: "flex", gap: "5px", marginBottom: "12px" }}>
              <input autoFocus type="number" value={calibrateMeters} onChange={e => setCalibrateMeters(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && parseFloat(calibrateMeters) > 0) { setScale(parseFloat(calibrateMeters) / calibrateDialog.pixelDist); setCalibrateDialog(null); setTool("select"); } }} placeholder="5.0" step="0.1" style={{ flex: 1, padding: "8px", borderRadius: "4px", border: `1px solid ${DK.border}`, background: DK.bg, color: DK.text, fontSize: "14px", textAlign: "center" }} />
              <span style={{ fontSize: "12px", color: DK.textMuted, alignSelf: "center" }}>m</span>
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <button onClick={() => { setCalibrateDialog(null); setTool("select"); }} style={{ flex: 1, padding: "6px", borderRadius: "4px", border: `1px solid ${DK.border}`, cursor: "pointer", fontSize: "10px", background: DK.card, color: DK.textMuted }}>Cancelar</button>
              <button onClick={() => { const m = parseFloat(calibrateMeters); if (m > 0) { setScale(m / calibrateDialog.pixelDist); setCalibrateDialog(null); setTool("select"); } }} style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, background: "#f97316", color: "#fff" }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {pdfDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: DK.sidebar, borderRadius: "10px", padding: "20px", width: "360px", border: `1px solid ${DK.border}`, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Exportar PDF Profissional</div>
            <div style={secT}>Cliente</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
              <input value={clientInfo.name} onChange={e => setClientInfo({ ...clientInfo, name: e.target.value })} placeholder="Nome" style={inpS} />
              <input value={clientInfo.address} onChange={e => setClientInfo({ ...clientInfo, address: e.target.value })} placeholder="Endereço" style={inpS} />
              <div style={{ display: "flex", gap: "4px" }}><input value={clientInfo.phone} onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })} placeholder="Tel" style={inpS} /><input value={clientInfo.email} onChange={e => setClientInfo({ ...clientInfo, email: e.target.value })} placeholder="E-mail" style={inpS} /></div>
            </div>
            {!companyLogo && <button onClick={() => logoRef.current?.click()} style={{ ...btnS(), width: "100%", background: DK.card, border: `1px solid ${DK.border}`, marginBottom: "10px" }}><Image size={12} /> Logo</button>}
            <div style={{ fontSize: "10px", color: DK.textMuted, background: DK.card, padding: "7px", borderRadius: "4px", marginBottom: "10px" }}>
              Capa + {pages.filter(p => p.bgImage).length} planta(s) + {pages.flatMap(p => p.elements).length} equipamentos
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <button onClick={() => setPdfDialog(false)} style={{ flex: 1, padding: "7px", borderRadius: "4px", border: `1px solid ${DK.border}`, cursor: "pointer", fontSize: "10px", background: DK.card, color: DK.textMuted }}>Cancelar</button>
              <button onClick={exportPDF} style={{ flex: 1, padding: "7px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, background: DK.accent, color: "#fff" }}><FileText size={12} style={{ marginRight: "3px", verticalAlign: "-2px" }} /> Gerar PDF</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.8;transform:scale(1.15)}}input[type=range]{height:4px}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${DK.bg}}::-webkit-scrollbar-thumb{background:${DK.border};border-radius:3px}`}</style>
    </div>
  );
}
