import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { jsPDF } from "jspdf";
import {
  Camera, Wifi, Network, Router, HardDrive, Upload, Download,
  Undo2, Redo2, Trash2, Copy, Ruler, Move, MousePointer, Plus, Minus,
  X, Eye, EyeOff, FileImage, FileText,
  Maximize2, Save, FolderOpen, Grid3X3, Layers,
  Link2, Image, Building2, Box
} from "lucide-react";
import { generateViewerHTML } from "./htmlExport";
const Scene3D = lazy(() => import("./Scene3D"));

/* ═══ CONSTANTS ═══ */
const EQUIPMENT = [
  { type: "camera", label: "Câmera", icon: Camera, color: "#dc2626", layer: "cftv", coverageRadius: 80, angle: 90 },
  { type: "wifi", label: "Access Point", icon: Wifi, color: "#2563eb", layer: "wifi", coverageRadius: 120, angle: 360 },
  { type: "switch", label: "Switch", icon: Network, color: "#d97706", layer: "rede", coverageRadius: 0, angle: 0 },
  { type: "router", label: "Roteador", icon: Router, color: "#7c3aed", layer: "rede", coverageRadius: 100, angle: 360 },
  { type: "nvr", label: "NVR/DVR", icon: HardDrive, color: "#059669", layer: "cftv", coverageRadius: 0, angle: 0 },
];

const LAYERS = [
  { id: "cftv", label: "CFTV", color: "#dc2626", types: ["camera", "nvr"] },
  { id: "rede", label: "Rede", color: "#d97706", types: ["switch", "router"] },
  { id: "wifi", label: "Wi-Fi", color: "#2563eb", types: ["wifi"] },
];

const SIZES = { small: 24, medium: 32, large: 42 };

/* ═══ ICON VARIANTS (SVG paths, viewBox 0 0 24 24) ═══ */
const ICON_VARIANTS = {
  camera: [
    { name: "Dome", path: "M12 16c-4.4 0-8-2.2-8-5h16c0 2.8-3.6 5-8 5zm-8-5a8 8 0 0116 0M12 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
    { name: "Bullet", path: "M3 10h2v4H3a1 1 0 01-1-1v-2a1 1 0 011-1zm2-1h12a3 3 0 010 6H5V9zm15 1.5a1.5 1.5 0 110 3v-3z" },
    { name: "Box", path: "M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm5 3a3 3 0 106 0 3 3 0 00-6 0zm3 1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 15h16" },
    { name: "PTZ", path: "M12 6a6 6 0 00-6 6h12a6 6 0 00-6-6zm0 4a2 2 0 100-4 2 2 0 000 4zm-1 3h2v4h3l-4 4-4-4h3v-4z" },
    { name: "Turret", path: "M12 4a5 5 0 00-5 5c0 2 1.5 3.5 3 4.5V16h4v-2.5c1.5-1 3-2.5 3-4.5a5 5 0 00-5-5zm0 3a2 2 0 110 4 2 2 0 010-4zM8 17h8v2H8z" },
  ],
  wifi: [
    { name: "AP Teto", path: "M4 13h16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm2-1l6-6 6 6M12 6v1m0 2a1 1 0 100 2 1 1 0 000-2z" },
    { name: "AP Parede", path: "M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm6 4a4 4 0 00-4 4m4-2a2 2 0 00-2 2m2 0a.5.5 0 100 1 .5.5 0 000-1z" },
    { name: "AP Externo", path: "M8 20V10l4-6 4 6v10M10 14h4m-2-4v2m-5 2h10M7 20h10" },
    { name: "Antena", path: "M12 20V8m0 0l-3-4m3 4l3-4M8 12a4 4 0 018 0M5 10a7 7 0 0114 0M12 14a1 1 0 100-2 1 1 0 000 2z" },
    { name: "Mesh", path: "M12 4l7 4v8l-7 4-7-4V8l7-4zm0 4a2 2 0 100 4 2 2 0 000-4zm0 8v-2m4-6l-2 1m-6-1l2 1" },
  ],
  switch: [
    { name: "Rack", path: "M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm2 3h2m2 0h2m2 0h2m2 0h2M5 13h2m2 0h2m2 0h2m2 0h2" },
    { name: "Desktop", path: "M4 8h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm2 2.5a.5.5 0 110 1 .5.5 0 010-1zm3 0a.5.5 0 110 1 .5.5 0 010-1zm3 0a.5.5 0 110 1 .5.5 0 010-1zm3 0a.5.5 0 110 1 .5.5 0 010-1zM17 12h2" },
    { name: "PoE", path: "M3 6h18v4H3V6zm0 6h18v4H3v-4zm2 1.5h1m2 0h1m2 0h1m2 0h1m-12-6h1m2 0h1m2 0h1m2 0h1M20 12l2-1v4l-2-1" },
    { name: "Gerenciável", path: "M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2h8v3H4V7zm10 1h5M14 10h5M4 12h16m-16 2h2m2 0h2m2 0h2m2 0h2" },
    { name: "Industrial", path: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm2 4h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM7 12h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" },
  ],
  router: [
    { name: "Enterprise", path: "M2 14h20v4a1 1 0 01-1 1H3a1 1 0 01-1-1v-4zm3 1.5a.5.5 0 110 1 .5.5 0 010-1zm3 0a.5.5 0 110 1 .5.5 0 010-1zM18 16h2M6 14V8l6-4 6 4v6" },
    { name: "Home", path: "M4 12h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm1 2h2m8 0a.5.5 0 110 1 .5.5 0 010-1zm3 0a.5.5 0 110 1 .5.5 0 010-1zM7 12V9m5-4v7m5-5v5" },
    { name: "Firewall", path: "M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zm9 2v8M8 10v4m4-6v8m4-6v4M5 12h14" },
    { name: "Gateway", path: "M4 8h16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm2 2v4m2-4v4m2-4v4m2-4v4m2-4v4m2-4v4M2 11h1m18 0h1" },
    { name: "Mesh", path: "M12 3a3 3 0 110 6 3 3 0 010-6zm-7 9a2 2 0 110 4 2 2 0 010-4zm14 0a2 2 0 110 4 2 2 0 010-4zM12 9v3m-4.5 2.5L10 12m4 2.5L14 12" },
  ],
  nvr: [
    { name: "Rack NVR", path: "M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 2h14v4H5V6zm0 6h14v4H5v-4zM17 8a.5.5 0 110 1 .5.5 0 010-1zm0 6a.5.5 0 110 1 .5.5 0 010-1zM7 8h6m-6 6h6" },
    { name: "Desktop NVR", path: "M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm2 2h4v4H5V9zm6 1h7M11 12h5M11 14h3M18 9a1 1 0 110 2 1 1 0 010-2z" },
    { name: "Servidor", path: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm1 3h8v3H8V5zm0 5h8v3H8v-3zM15 6.5a.5.5 0 110 1 .5.5 0 010-1zm0 5a.5.5 0 110 1 .5.5 0 010-1zM10 17a2 2 0 104 0 2 2 0 00-4 0z" },
    { name: "Storage", path: "M3 5h18a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm0 7h18a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3a1 1 0 011-1zm14-5.5a.5.5 0 110 1 .5.5 0 010-1zm0 7a.5.5 0 110 1 .5.5 0 010-1zM6 7.5h6m-6 7h6" },
    { name: "Mini NVR", path: "M6 8h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2zm1 2a1 1 0 100 2 1 1 0 000-2zm4 0h6M11 13h4" },
  ],
};

/* SVG icon component for equipment */
const EquipIcon = ({ type, variant = 0, size = 16, color = "#fff" }) => {
  const variants = ICON_VARIANTS[type];
  if (!variants) return null;
  const v = variants[variant] || variants[0];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={v.path} />
    </svg>
  );
};

/* Draw equipment icon on canvas context */
const drawEquipIconCanvas = (ctx, type, variant, x, y, size, color) => {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  const variants = ICON_VARIANTS[type];
  const v = variants?.[variant] || variants?.[0];
  if (v) {
    const p2d = new Path2D(v.path);
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke(p2d);
  }
  ctx.restore();
};

/* Refined light palette */
const T = {
  bg: "#f5f6f8", sidebar: "#ffffff", toolbar: "#ffffff", card: "#f0f2f5",
  cardHover: "#e8ebf0", border: "#dfe3ea", borderLight: "#edf0f4",
  accent: "#2563eb", accentLight: "#dbeafe", accentDark: "#1d4ed8",
  text: "#1a2332", textMuted: "#5f6b7a", textDim: "#9ca3af",
  danger: "#dc2626", dangerLight: "#fef2f2", success: "#059669",
  canvas: "#e8ecf1", white: "#ffffff",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
};

const makeBlankPage = (id, name) => ({
  id, name, bgImage: null, bgNatural: { w: 0, h: 0 },
  elements: [], measureLines: [], connections: [],
});

/* ═══ MAIN ═══ */
export default function NetPlanner() {
  const [pages, setPages] = useState([makeBlankPage("page-1", "Pavimento 1")]);
  const [currentPageId, setCurrentPageId] = useState("page-1");
  const [projectName, setProjectName] = useState("Novo Projeto");
  const [editingName, setEditingName] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: "", address: "", phone: "", email: "" });
  const [companyLogo, setCompanyLogo] = useState(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.06);
  const [scale, setScale] = useState(0.05);

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
  const [view3D, setView3D] = useState(false);

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const containerRef = useRef(null);

  const page = pages.find(p => p.id === currentPageId) || pages[0];
  const elements = page.elements;
  const measureLines = page.measureLines;
  const connections = page.connections;

  const updatePage = useCallback((u) => { setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, ...u } : p)); }, [currentPageId]);
  const setElements = useCallback((fn) => { setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, elements: typeof fn === "function" ? fn(p.elements) : fn } : p)); }, [currentPageId]);
  const setMeasureLines = useCallback((fn) => { setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, measureLines: typeof fn === "function" ? fn(p.measureLines) : fn } : p)); }, [currentPageId]);
  const setConnections = useCallback((fn) => { setPages(prev => prev.map(p => p.id === currentPageId ? { ...p, connections: typeof fn === "function" ? fn(p.connections) : fn } : p)); }, [currentPageId]);

  const visibleElements = elements.filter(el => { const eq = EQUIPMENT.find(e => e.type === el.type); return eq && layerVisibility[eq.layer] !== false; });
  const counts = {}; EQUIPMENT.forEach(eq => { counts[eq.type] = elements.filter(e => e.type === eq.type).length; });
  const totalEquip = elements.length;

  /* ─── undo/redo ─── */
  const saveSnapshot = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), JSON.stringify({ elements: page.elements, measureLines: page.measureLines, connections: page.connections })]);
    setRedoStack([]);
  }, [page]);

  const undo = () => { if (!undoStack.length) return; const s = JSON.parse(undoStack.at(-1)); setRedoStack(prev => [...prev, JSON.stringify({ elements, measureLines, connections })]); updatePage({ elements: s.elements, measureLines: s.measureLines || [], connections: s.connections || [] }); setUndoStack(prev => prev.slice(0, -1)); setSelectedId(null); setSelectedMeasure(null); };
  const redo = () => { if (!redoStack.length) return; const s = JSON.parse(redoStack.at(-1)); setUndoStack(prev => [...prev, JSON.stringify({ elements, measureLines, connections })]); updatePage({ elements: s.elements, measureLines: s.measureLines || [], connections: s.connections || [] }); setRedoStack(prev => prev.slice(0, -1)); setSelectedId(null); setSelectedMeasure(null); };

  /* ─── pages ─── */
  const addPage = () => { const id = `page-${Date.now()}`; setPages(prev => [...prev, makeBlankPage(id, `Pavimento ${prev.length + 1}`)]); setCurrentPageId(id); setUndoStack([]); setRedoStack([]); setSelectedId(null); };
  const deletePage = (id) => { if (pages.length <= 1) return; setPages(prev => prev.filter(p => p.id !== id)); if (currentPageId === id) setCurrentPageId(pages.find(p => p.id !== id).id); };
  const renamePage = (id, name) => { setPages(prev => prev.map(p => p.id === id ? { ...p, name } : p)); };

  /* ─── files ─── */
  const handleFile = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { const img = new window.Image(); img.onload = () => { updatePage({ bgImage: img.src, bgNatural: { w: img.naturalWidth, h: img.naturalHeight } }); if (containerRef.current) { const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight; const fz = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1) * 0.9; setZoom(fz); setPan({ x: (cw - img.naturalWidth * fz) / 2, y: (ch - img.naturalHeight * fz) / 2 }); } }; img.src = ev.target.result; }; r.readAsDataURL(f); e.target.value = ""; };
  const handleLogo = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setCompanyLogo(ev.target.result); r.readAsDataURL(f); e.target.value = ""; };

  /* ─── canvas ─── */
  const getPos = (e) => { const r = canvasRef.current?.getBoundingClientRect(); return r ? { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom } : { x: 0, y: 0 }; };

  const handleCanvasClick = (e) => {
    if (dragging) return;
    const { x, y } = getPos(e);
    if (tool.startsWith("place:")) {
      const type = tool.split(":")[1]; const eq = EQUIPMENT.find(eq => eq.type === type); if (!eq) return;
      saveSnapshot(); const num = nextNumbers[type]; setNextNumbers(prev => ({ ...prev, [type]: prev[type] + 1 }));
      const el = { id: `${type}-${Date.now()}`, type, label: `${eq.label} ${String(num).padStart(2, "0")}`, number: num, x, y, rotation: 0, angle: eq.angle, radius: eq.coverageRadius, visible: true, notes: "", customColor: null, size: "medium", iconVariant: 0 };
      setElements(prev => [...prev, el]); setSelectedId(el.id); return;
    }
    if (tool === "measure") { if (!measurePoints.length) setMeasurePoints([{ x, y }]); else { const p1 = measurePoints[0]; saveSnapshot(); setMeasureLines(prev => [...prev, { p1, p2: { x, y }, dist: Math.hypot(x - p1.x, y - p1.y) }]); setMeasurePoints([]); } return; }
    if (tool === "calibrate") { if (!calibratePoints.length) setCalibratePoints([{ x, y }]); else { const p1 = calibratePoints[0]; setCalibrateDialog({ pixelDist: Math.hypot(x - p1.x, y - p1.y), p1, p2: { x, y } }); setCalibrateMeters(""); setCalibratePoints([]); } return; }
    if (tool === "cable") { const hit = visibleElements.find(el => Math.hypot(x - el.x, y - el.y) < 20); if (!hit) return; if (!cableStart) setCableStart(hit.id); else if (hit.id !== cableStart) { saveSnapshot(); setConnections(prev => [...prev, { id: `c-${Date.now()}`, from: cableStart, to: hit.id }]); setCableStart(null); } return; }
    if (tool === "select") { let cm = null; measureLines.forEach((ml, i) => { const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; if (Math.hypot(x - mx, y - my) < 20 / zoom) cm = i; }); if (cm !== null) { setSelectedMeasure(cm); setSelectedId(null); return; } }
    setSelectedId(null); setSelectedMeasure(null);
  };

  const startDrag = (e, id) => { e.stopPropagation(); if (["measure", "calibrate", "cable"].includes(tool)) return; saveSnapshot(); setSelectedId(id); const p = getPos(e); const el = elements.find(el => el.id === id); setDragging({ id, ox: p.x - el.x, oy: p.y - el.y }); };
  const onMouseMove = (e) => { if (dragging) { const p = getPos(e); setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x: p.x - dragging.ox, y: p.y - dragging.oy } : el)); } if (panning) { setPan({ x: pan.x + e.clientX - panStart.x, y: pan.y + e.clientY - panStart.y }); setPanStart({ x: e.clientX, y: e.clientY }); } };
  const onMouseUp = () => { setDragging(null); setPanning(false); };
  const startPan = (e) => { if (tool === "pan" || e.button === 1) { e.preventDefault(); setPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); } };
  const handleWheel = (e) => { e.preventDefault(); const d = e.deltaY > 0 ? 0.9 : 1.1; const r = canvasRef.current.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const nz = Math.min(Math.max(zoom * d, 0.1), 5); setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz); };
  const fitToScreen = () => { if (!page.bgNatural.w || !containerRef.current) return; const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight; const fz = Math.min(cw / page.bgNatural.w, ch / page.bgNatural.h, 1) * 0.9; setZoom(fz); setPan({ x: (cw - page.bgNatural.w * fz) / 2, y: (ch - page.bgNatural.h * fz) / 2 }); };

  /* ─── CRUD ─── */
  const updateEl = (id, p) => { saveSnapshot(); setElements(prev => prev.map(el => el.id === id ? { ...el, ...p } : el)); };
  const deleteEl = (id) => { saveSnapshot(); setElements(prev => prev.filter(el => el.id !== id)); setConnections(prev => prev.filter(c => c.from !== id && c.to !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicateEl = (id) => { const el = elements.find(e => e.id === id); if (!el) return; saveSnapshot(); const eq = EQUIPMENT.find(eq => eq.type === el.type); const num = nextNumbers[el.type]; setNextNumbers(prev => ({ ...prev, [el.type]: prev[el.type] + 1 })); const cl = { ...el, id: `${el.type}-${Date.now()}`, x: el.x + 30, y: el.y + 30, number: num, label: `${eq.label} ${String(num).padStart(2, "0")}` }; setElements(prev => [...prev, cl]); setSelectedId(cl.id); };

  /* ─── keyboard ─── */
  useEffect(() => {
    const h = (e) => { if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return; if (e.key === "Delete") { if (selectedMeasure !== null) { saveSnapshot(); setMeasureLines(prev => prev.filter((_, i) => i !== selectedMeasure)); setSelectedMeasure(null); } else if (selectedId) deleteEl(selectedId); } if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); } if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); } if (e.key === "Escape") { setTool("select"); setMeasurePoints([]); setCalibratePoints([]); setCalibrateDialog(null); setCableStart(null); setSelectedId(null); setSelectedMeasure(null); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  useEffect(() => { const el = canvasRef.current; if (!el) return; const p = (e) => e.preventDefault(); el.addEventListener("wheel", p, { passive: false }); return () => el.removeEventListener("wheel", p); }, []);

  /* ─── render to canvas ─── */
  const renderToCanvas = (pg) => new Promise((resolve) => {
    const c = document.createElement("canvas"); c.width = pg.bgNatural.w; c.height = pg.bgNatural.h; const ctx = c.getContext("2d");
    const draw = () => {
      pg.connections.forEach(cn => { const f = pg.elements.find(e => e.id === cn.from), t = pg.elements.find(e => e.id === cn.to); if (!f || !t) return; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); });
      pg.elements.forEach(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq || el.radius <= 0 || el.angle <= 0) return; const col = el.customColor || eq.color; ctx.save(); ctx.translate(el.x, el.y); ctx.rotate((el.rotation - el.angle / 2) * Math.PI / 180); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, el.radius, 0, el.angle * Math.PI / 180); ctx.closePath(); ctx.fillStyle = col + "25"; ctx.strokeStyle = col + "70"; ctx.lineWidth = 1.2; ctx.fill(); ctx.stroke(); ctx.restore(); });
      pg.elements.forEach(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return; const col = el.customColor || eq.color; const r = 12; ctx.beginPath(); ctx.arc(el.x, el.y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke(); drawEquipIconCanvas(ctx, el.type, el.iconVariant || 0, el.x, el.y, 16, "#fff"); ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#1a2332"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.strokeText(el.label, el.x + r + 4, el.y + 4); ctx.fillText(el.label, el.x + r + 4, el.y + 4); });
      pg.measureLines.forEach(ml => { ctx.beginPath(); ctx.moveTo(ml.p1.x, ml.p1.y); ctx.lineTo(ml.p2.x, ml.p2.y); ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]); const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#92400e"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeText(`${(ml.dist * scale).toFixed(1)}m`, mx + 4, my - 5); ctx.fillText(`${(ml.dist * scale).toFixed(1)}m`, mx + 4, my - 5); });
      resolve(c);
    };
    if (pg.bgImage) { const img = new window.Image(); img.onload = () => { ctx.drawImage(img, 0, 0); draw(); }; img.src = pg.bgImage; } else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); draw(); }
  });

  const exportPNG = async () => { const c = await renderToCanvas(page); const a = document.createElement("a"); a.download = `${projectName} - ${page.name}.png`; a.href = c.toDataURL("image/png"); a.click(); };

  /* ─── PDF PROFESSIONAL (light/clean) ─── */
  const hex2rgb = (h) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0]; };

  const exportPDF = async () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 14;

    /* ── COVER ── */
    pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, W, H, "F");
    // top accent stripe
    pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, W, 4, "F");
    // left accent bar
    pdf.setFillColor(37, 99, 235); pdf.rect(0, 4, 4, H - 4, "F");

    let cy = 32;
    if (companyLogo) { try { pdf.addImage(companyLogo, "PNG", M + 4, cy, 36, 36); cy += 46; } catch { } }

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(37, 99, 235);
    pdf.text("PROJETO TÉCNICO", M + 4, cy); cy += 8;
    pdf.setFontSize(24); pdf.setTextColor(26, 35, 50);
    pdf.text(projectName, M + 4, cy); cy += 14;

    // thin separator
    pdf.setDrawColor(223, 227, 234); pdf.setLineWidth(0.4); pdf.line(M + 4, cy, W - M, cy); cy += 10;

    // client info
    if (clientInfo.name || clientInfo.address) {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(150, 160, 175); pdf.text("CLIENTE", M + 4, cy); cy += 6;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(26, 35, 50);
      if (clientInfo.name) { pdf.text(clientInfo.name, M + 4, cy); cy += 7; }
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(95, 107, 122);
      if (clientInfo.address) { pdf.text(clientInfo.address, M + 4, cy); cy += 6; }
      if (clientInfo.phone) { pdf.text(clientInfo.phone, M + 4, cy); cy += 6; }
      if (clientInfo.email) { pdf.text(clientInfo.email, M + 4, cy); cy += 6; }
      cy += 6;
    }

    // summary
    pdf.setDrawColor(223, 227, 234); pdf.line(M + 4, cy, W - M, cy); cy += 8;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(150, 160, 175); pdf.text("RESUMO DO PROJETO", M + 4, cy); cy += 8;

    const allEls = pages.flatMap(p => p.elements);
    EQUIPMENT.forEach(eq => {
      const c = allEls.filter(e => e.type === eq.type).length; if (c === 0) return;
      const [r, g, b] = hex2rgb(eq.color); pdf.setFillColor(r, g, b); pdf.circle(M + 7, cy - 1.2, 2, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 35, 50); pdf.text(`${c}`, M + 12, cy);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(95, 107, 122); pdf.text(eq.label, M + 20, cy);
      cy += 7;
    });
    cy += 4;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(37, 99, 235);
    pdf.text(`${allEls.length} equipamentos  ·  ${pages.filter(p => p.bgImage).length} planta(s)`, M + 4, cy);

    // footer
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(156, 163, 175);
    pdf.text(dateStr, M + 4, H - 14);
    pdf.text("Gerado por NetPlanner v2.1", M + 4, H - 9);

    /* ── PLANT PAGES ── */
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi]; if (!pg.bgImage) continue;
      const ls = pg.bgNatural.w > pg.bgNatural.h;
      pdf.addPage("a4", ls ? "landscape" : "portrait");
      const pW = ls ? 297 : 210, pH = ls ? 210 : 297;

      // white bg
      pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pW, pH, "F");
      // top accent
      pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, pW, 2.5, "F");

      // header
      const hY = 8;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(26, 35, 50);
      pdf.text(pg.name, M, hY + 6);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(156, 163, 175);
      const pgInfo = EQUIPMENT.map(eq => { const c = pg.elements.filter(e => e.type === eq.type).length; return c > 0 ? `${c} ${eq.label}` : null; }).filter(Boolean).join("  ·  ");
      pdf.text(pgInfo, pW - M, hY + 6, { align: "right" });

      pdf.setDrawColor(223, 227, 234); pdf.setLineWidth(0.3); pdf.line(M, hY + 10, pW - M, hY + 10);

      // plant image - give plenty of space, legend goes on next page if needed
      const imgTop = hY + 14;
      const imgAvailH = pH - imgTop - M - 6;
      const imgAvailW = pW - M * 2;
      const fs = Math.min(imgAvailW / pg.bgNatural.w, imgAvailH / pg.bgNatural.h);
      const iW = pg.bgNatural.w * fs, iH = pg.bgNatural.h * fs;
      const iX = M + (imgAvailW - iW) / 2, iY = imgTop;

      const cvs = await renderToCanvas(pg);
      pdf.addImage(cvs.toDataURL("image/png"), "PNG", iX, iY, iW, iH);
      // subtle border
      pdf.setDrawColor(200, 207, 216); pdf.setLineWidth(0.2); pdf.rect(iX, iY, iW, iH, "S");

      // footer on plant page
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(156, 163, 175);
      pdf.text(`${projectName}  ·  1px = ${scale}m`, M, pH - 5);
      pdf.text(`Página ${pi + 2}`, pW - M, pH - 5, { align: "right" });

      /* ── LEGEND PAGE (dedicated, full page) ── */
      if (pg.elements.length > 0) {
        pdf.addPage("a4", ls ? "landscape" : "portrait");
        pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pW, pH, "F");
        pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, pW, 2.5, "F");

        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 35, 50);
        pdf.text(`Legenda — ${pg.name}`, M, 14);
        pdf.setDrawColor(223, 227, 234); pdf.line(M, 17, pW - M, 17);

        // table header
        const tW = pW - M * 2;
        const colW = [tW * 0.18, tW * 0.13, tW * 0.14, tW * 0.12, tW * 0.12, tW * 0.31]; // ID, Tipo, Posição, Alcance, Ângulo, Obs
        const colX = [M]; for (let i = 1; i < 6; i++) colX.push(colX[i - 1] + colW[i - 1]);
        const headers = ["Identificação", "Tipo", "Posição", "Alcance", "Ângulo", "Observações"];

        let ty = 22;
        const rowH = 6;
        const maxY = pH - M - 4;

        const drawHeader = () => {
          pdf.setFillColor(240, 242, 245); pdf.rect(M, ty - 3.5, tW, rowH, "F");
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
          headers.forEach((h, i) => pdf.text(h, colX[i] + 2, ty));
          ty += rowH;
        };

        drawHeader();

        pg.elements.forEach((el, idx) => {
          if (ty + rowH > maxY) {
            // new page
            pdf.addPage("a4", ls ? "landscape" : "portrait");
            pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pW, pH, "F");
            pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, pW, 2.5, "F");
            ty = 12;
            drawHeader();
          }

          const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return;

          // alternating rows
          if (idx % 2 === 0) { pdf.setFillColor(248, 249, 251); pdf.rect(M, ty - 3.5, tW, rowH, "F"); }

          // color dot
          const [cr, cg, cb] = hex2rgb(el.customColor || eq.color);
          pdf.setFillColor(cr, cg, cb); pdf.circle(colX[0] + 3, ty - 0.8, 1.5, "F");

          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(26, 35, 50);
          pdf.text(el.label, colX[0] + 7, ty);

          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
          pdf.text(eq.label, colX[1] + 2, ty);
          pdf.text(`X:${Math.round(el.x)}  Y:${Math.round(el.y)}`, colX[2] + 2, ty);
          pdf.text(el.radius > 0 ? `${(el.radius * scale).toFixed(1)}m` : "—", colX[3] + 2, ty);
          pdf.text(el.angle > 0 ? `${el.angle}°` : "—", colX[4] + 2, ty);
          pdf.text((el.notes || "—").substring(0, 40), colX[5] + 2, ty);

          // subtle row line
          pdf.setDrawColor(237, 240, 244); pdf.setLineWidth(0.15); pdf.line(M, ty + 2, M + tW, ty + 2);

          ty += rowH;
        });

        // totals row
        ty += 3;
        pdf.setDrawColor(37, 99, 235); pdf.setLineWidth(0.4); pdf.line(M, ty - 2, M + tW, ty - 2);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(37, 99, 235);
        pdf.text(`Total: ${pg.elements.length} equipamentos`, M + 2, ty + 2);

        // connections count
        if (pg.connections.length > 0) {
          pdf.setTextColor(95, 107, 122); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
          pdf.text(`${pg.connections.length} conexão(ões) de cabeamento`, M + 2, ty + 7);
        }

        // measurements
        if (pg.measureLines.length > 0) {
          const mty = ty + (pg.connections.length > 0 ? 13 : 8);
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(26, 35, 50);
          pdf.text("Medições", M + 2, mty);
          pg.measureLines.forEach((ml, i) => {
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
            pdf.text(`#${i + 1}: ${(ml.dist * scale).toFixed(2)} metros`, M + 2, mty + 5 + i * 4.5);
          });
        }

        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(156, 163, 175);
        pdf.text(`${projectName}  ·  Legenda`, M, pH - 5);
      }
    }

    pdf.save(`${projectName}.pdf`);
    setPdfDialog(false);
  };

  /* ─── save/load ─── */
  const saveProject = () => { const d = { projectName, pages, clientInfo, companyLogo, watermarkOpacity, scale, nextNumbers, version: "2.1" }; const b = new Blob([JSON.stringify(d)], { type: "application/json" }); const a = document.createElement("a"); a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}.json`; a.href = URL.createObjectURL(b); a.click(); URL.revokeObjectURL(a.href); };
  const loadProject = () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); setPages(d.pages || [makeBlankPage("page-1", "Pavimento 1")]); setCurrentPageId((d.pages || [])[0]?.id || "page-1"); setProjectName(d.projectName || "Projeto"); setClientInfo(d.clientInfo || { name: "", address: "", phone: "", email: "" }); setCompanyLogo(d.companyLogo || null); setWatermarkOpacity(d.watermarkOpacity ?? 0.06); setScale(d.scale || 0.05); setNextNumbers(d.nextNumbers || { camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 }); setUndoStack([]); setRedoStack([]); setSelectedId(null); } catch { alert("Erro ao carregar."); } }; i.click(); };

  const exportHTML = () => {
    const html = generateViewerHTML(projectName, pages, clientInfo, scale, companyLogo);
    const b = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}_3D.html`;
    a.href = URL.createObjectURL(b);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sel = elements.find(e => e.id === selectedId);
  const selEq = sel ? EQUIPMENT.find(eq => eq.type === sel.type) : null;

  /* ─── style helpers ─── */
  const btnS = (active) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "6px 10px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "11.5px", fontWeight: 500, transition: "all .15s", background: active ? T.accent : "transparent", color: active ? "#fff" : T.textMuted });
  const lblS = { display: "block", fontSize: "10px", fontWeight: 600, color: T.textDim, marginBottom: "3px", letterSpacing: "0.3px" };
  const inpS = { width: "100%", padding: "7px 10px", borderRadius: "7px", border: `1px solid ${T.border}`, background: T.white, color: T.text, fontSize: "12px", outline: "none", boxSizing: "border-box" };
  const secT = { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.8px", color: T.textDim, marginBottom: "6px", fontWeight: 700 };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: T.bg, color: T.text, fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden", userSelect: "none" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div style={{ width: "256px", minWidth: "256px", background: T.sidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", boxShadow: "2px 0 8px rgba(0,0,0,0.03)" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(37,99,235,0.3)" }}><Layers size={15} color="#fff" /></div>
          <div><div style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>NetPlanner</div><div style={{ fontSize: "9px", color: T.textDim }}>Editor de Plantas</div></div>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${T.borderLight}`, background: T.card }}>
          {[["equip", "Equip."], ["layers", "Camadas"], ["pages", "Páginas"], ["config", "Config"]].map(([k, l]) => (
            <button key={k} onClick={() => setSidebarTab(k)} style={{ flex: 1, padding: "8px 2px", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, background: sidebarTab === k ? T.white : "transparent", color: sidebarTab === k ? T.accent : T.textDim, borderBottom: sidebarTab === k ? `2px solid ${T.accent}` : "2px solid transparent", transition: "all .15s" }}>{l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          {sidebarTab === "equip" && (<>
            <div style={secT}>Equipamentos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }}>
              {EQUIPMENT.map(eq => { const isA = tool === `place:${eq.type}`; return (
                <button key={eq.type} onClick={() => setTool(isA ? "select" : `place:${eq.type}`)} style={{ display: "flex", alignItems: "center", gap: "9px", padding: "8px 10px", borderRadius: "8px", border: isA ? `1.5px solid ${eq.color}` : `1px solid ${T.borderLight}`, cursor: "pointer", textAlign: "left", background: isA ? eq.color + "0c" : T.white, color: T.text, boxShadow: isA ? `0 0 0 3px ${eq.color}15` : T.shadow, transition: "all .15s" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: eq.color + "12", display: "flex", alignItems: "center", justifyContent: "center" }}><EquipIcon type={eq.type} variant={0} size={16} color={eq.color} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: "12px", fontWeight: 600 }}>{eq.label}</div><div style={{ fontSize: "9px", color: T.textDim }}>{counts[eq.type] || 0} un.</div></div>
                  <Plus size={12} color={T.textDim} />
                </button>
              ); })}
            </div>

            <div style={secT}>Ferramentas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "14px" }}>
              <button onClick={() => setTool(tool === "cable" ? "select" : "cable")} style={{ ...btnS(tool === "cable"), width: "100%", background: T.white, border: `1px solid ${T.borderLight}`, color: tool === "cable" ? T.accent : T.textMuted, boxShadow: T.shadow }}><Link2 size={13} /> Conectar (cabo)</button>
              <button onClick={() => { setTool("calibrate"); setCalibratePoints([]); }} style={{ ...btnS(tool === "calibrate"), width: "100%", background: T.white, border: `1px solid ${T.borderLight}`, color: tool === "calibrate" ? "#d97706" : T.textMuted, boxShadow: T.shadow }}><Ruler size={13} /> Calibrar escala</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: T.textDim, marginBottom: "14px", paddingLeft: "4px" }}>
              Escala: 1px = <input type="number" value={scale} onChange={e => setScale(parseFloat(e.target.value) || 0.01)} step="0.01" min="0.001" style={{ width: "52px", padding: "3px 5px", borderRadius: "5px", border: `1px solid ${T.border}`, background: T.white, color: T.text, fontSize: "10px", textAlign: "center" }} /> m
            </div>

            <div style={secT}>Resumo</div>
            {EQUIPMENT.map(eq => { const c = counts[eq.type] || 0; if (!c) return null; return (
              <div key={eq.type} style={{ display: "flex", alignItems: "center", gap: "7px", background: T.white, borderRadius: "7px", padding: "6px 9px", marginBottom: "3px", boxShadow: T.shadow }}>
                <EquipIcon type={eq.type} variant={0} size={14} color={eq.color} /><span style={{ flex: 1, fontSize: "11px", color: T.textMuted }}>{eq.label}</span><span style={{ fontSize: "13px", fontWeight: 800, color: eq.color }}>{c}</span>
              </div>
            ); })}
            {totalEquip > 0 && <div style={{ background: T.accentLight, borderRadius: "7px", padding: "7px", textAlign: "center", marginTop: "4px", border: `1px solid ${T.accent}20` }}><span style={{ fontSize: "15px", fontWeight: 800, color: T.accent }}>{totalEquip}</span><span style={{ fontSize: "9px", color: T.textMuted, marginLeft: "5px" }}>total</span></div>}
          </>)}

          {sidebarTab === "layers" && (<>
            <div style={secT}>Camadas de Visualização</div>
            {LAYERS.map(l => (
              <button key={l.id} onClick={() => setLayerVisibility(prev => ({ ...prev, [l.id]: !prev[l.id] }))} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${T.borderLight}`, cursor: "pointer", marginBottom: "4px", background: layerVisibility[l.id] ? l.color + "0a" : T.white, color: layerVisibility[l.id] ? l.color : T.textDim, boxShadow: T.shadow }}>
                {layerVisibility[l.id] ? <Eye size={14} /> : <EyeOff size={14} />}
                <span style={{ flex: 1, textAlign: "left", fontSize: "12px", fontWeight: 600 }}>{l.label}</span>
                <span style={{ fontSize: "10px", background: T.card, padding: "1px 6px", borderRadius: "4px" }}>{l.types.reduce((a, t) => a + (counts[t] || 0), 0)}</span>
              </button>
            ))}
            <div style={{ ...secT, marginTop: "14px" }}>Opções</div>
            {[[showCoverage, setShowCoverage, "Cobertura"], [showCables, setShowCables, "Cabeamento"], [showGrid, setShowGrid, "Grade"]].map(([v, fn, label]) => (
              <button key={label} onClick={() => fn(!v)} style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", padding: "7px 10px", borderRadius: "6px", border: `1px solid ${T.borderLight}`, cursor: "pointer", marginBottom: "3px", background: T.white, color: v ? T.accent : T.textDim, fontSize: "11px", fontWeight: 500, boxShadow: T.shadow }}>
                {v ? <Eye size={12} /> : <EyeOff size={12} />} {label}
              </button>
            ))}

            {elements.length > 0 && (<><div style={{ ...secT, marginTop: "14px" }}>Legenda</div>
              {EQUIPMENT.map(eq => { const its = elements.filter(e => e.type === eq.type); if (!its.length) return null; return (<div key={eq.type}><div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 5px", fontSize: "10px", fontWeight: 700, color: eq.color }}><EquipIcon type={eq.type} variant={0} size={12} color={eq.color} /> {eq.label} ({its.length})</div>{its.map(it => <button key={it.id} onClick={() => { setSelectedId(it.id); setSidebarTab("equip"); }} style={{ display: "block", width: "100%", padding: "3px 5px 3px 18px", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px", textAlign: "left", background: selectedId === it.id ? T.accentLight : "transparent", color: selectedId === it.id ? T.accent : T.textMuted }}>{it.label}</button>)}</div>); })}
            </>)}
            {measureLines.length > 0 && (<><div style={{ ...secT, marginTop: "14px" }}>Medições</div>
              {measureLines.map((ml, i) => (<div key={i} onClick={() => { setSelectedMeasure(i); setSelectedId(null); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 7px", background: selectedMeasure === i ? "#fef3c7" : T.white, border: `1px solid ${selectedMeasure === i ? "#fbbf24" : T.borderLight}`, borderRadius: "5px", marginBottom: "3px", cursor: "pointer", boxShadow: T.shadow }}><span style={{ fontSize: "10px", color: "#92400e" }}>#{i + 1}: {(ml.dist * scale).toFixed(2)}m</span><button onClick={(e) => { e.stopPropagation(); saveSnapshot(); setMeasureLines(prev => prev.filter((_, j) => j !== i)); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={10} /></button></div>))}
            </>)}
          </>)}

          {sidebarTab === "pages" && (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}><div style={secT}>Plantas / Andares</div><button onClick={addPage} style={{ display: "flex", alignItems: "center", gap: "3px", padding: "4px 9px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, background: T.accent, color: "#fff", boxShadow: "0 1px 4px rgba(37,99,235,0.3)" }}><Plus size={11} /> Nova</button></div>
            {pages.map(pg => (<div key={pg.id} onClick={() => { setCurrentPageId(pg.id); setSelectedId(null); setUndoStack([]); setRedoStack([]); }} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px", background: currentPageId === pg.id ? T.accentLight : T.white, border: `1px solid ${currentPageId === pg.id ? T.accent + "40" : T.borderLight}`, boxShadow: T.shadow }}>
              <Building2 size={14} color={currentPageId === pg.id ? T.accent : T.textDim} />
              <div style={{ flex: 1 }}><input value={pg.name} onChange={e => renamePage(pg.id, e.target.value)} onClick={e => e.stopPropagation()} style={{ background: "transparent", border: "none", color: T.text, fontSize: "12px", fontWeight: 600, width: "100%", outline: "none", padding: 0 }} /><div style={{ fontSize: "9px", color: T.textDim }}>{pg.elements.length} equip. {pg.bgImage ? "· ✓ planta" : ""}</div></div>
              {pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); deletePage(pg.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={12} /></button>}
            </div>))}
          </>)}

          {sidebarTab === "config" && (<>
            <div style={secT}>Dados do Cliente</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px" }}>
              {[["name", "Nome do cliente"], ["address", "Endereço"], ["phone", "Telefone"], ["email", "E-mail"]].map(([k, p]) => <input key={k} value={clientInfo[k]} onChange={e => setClientInfo({ ...clientInfo, [k]: e.target.value })} placeholder={p} style={inpS} />)}
            </div>
            <div style={secT}>Logo da Empresa</div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            {companyLogo ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: T.white, borderRadius: "7px", padding: "8px", marginBottom: "8px", boxShadow: T.shadow, border: `1px solid ${T.borderLight}` }}>
                <img src={companyLogo} style={{ width: "38px", height: "38px", objectFit: "contain", borderRadius: "5px" }} /><span style={{ flex: 1, fontSize: "11px", color: T.textMuted }}>Logo carregada</span><button onClick={() => setCompanyLogo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger }}><X size={13} /></button>
              </div>
            ) : <button onClick={() => logoRef.current?.click()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", width: "100%", padding: "8px", borderRadius: "7px", border: `1.5px dashed ${T.border}`, cursor: "pointer", fontSize: "11px", color: T.textMuted, background: T.white, marginBottom: "8px" }}><Image size={13} /> Carregar logo</button>}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: T.textDim }}>Marca d'água: <input type="range" value={watermarkOpacity} onChange={e => setWatermarkOpacity(parseFloat(e.target.value))} min="0" max="0.25" step="0.01" style={{ flex: 1, accentColor: T.accent }} /> {Math.round(watermarkOpacity * 100)}%</div>
          </>)}
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: "5px 14px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {editingName ? <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)} style={{ background: T.card, border: `1.5px solid ${T.accent}`, borderRadius: "5px", padding: "3px 8px", color: T.text, fontSize: "12px", fontWeight: 600, width: "140px" }} />
          : <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, fontSize: "12px", fontWeight: 700, marginRight: "4px" }}>{projectName}</button>}
          <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px" }} />
          <button onClick={() => fileRef.current?.click()} style={btnS()}><Upload size={13} /> Planta</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={saveProject} style={btnS()} title="Salvar"><Save size={13} /></button>
          <button onClick={loadProject} style={btnS()} title="Abrir"><FolderOpen size={13} /></button>
          <button onClick={exportPNG} style={btnS()} disabled={!page.bgImage}><Download size={13} /> PNG</button>
          <button onClick={() => setPdfDialog(true)} style={{ ...btnS(), background: pages.some(p => p.bgImage) ? T.accent : "transparent", color: pages.some(p => p.bgImage) ? "#fff" : T.textDim, borderRadius: "7px" }} disabled={!pages.some(p => p.bgImage)}><FileText size={13} /> PDF</button>
          <button onClick={exportHTML} style={btnS()} title="Exportar visualizador 3D (HTML standalone)"><Box size={13} /> HTML 3D</button>
          <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px" }} />
          <button onClick={() => setView3D(v => !v)} style={{ ...btnS(view3D), background: view3D ? "#0f172a" : "transparent", color: view3D ? "#60a5fa" : T.textMuted, border: view3D ? "1.5px solid #1e3a5f" : "none" }} title={view3D ? "Voltar ao 2D" : "Visualizar em 3D"}><Box size={13} /> {view3D ? "2D" : "3D"}</button>
          <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px" }} />
          <button onClick={() => { setTool("select"); setCableStart(null); }} style={btnS(tool === "select")}><MousePointer size={13} /></button>
          <button onClick={() => setTool("pan")} style={btnS(tool === "pan")}><Move size={13} /></button>
          <button onClick={() => { setTool("measure"); setMeasurePoints([]); }} style={btnS(tool === "measure")}><Ruler size={13} /></button>
          <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px" }} />
          <button onClick={undo} style={btnS()} disabled={!undoStack.length}><Undo2 size={13} /></button>
          <button onClick={redo} style={btnS()} disabled={!redoStack.length}><Redo2 size={13} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "10px", color: T.textDim, marginRight: "6px", fontWeight: 500 }}>{page.name}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", background: T.card, borderRadius: "6px", padding: "3px 6px" }}>
            <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Minus size={12} /></button>
            <span style={{ fontSize: "10px", color: T.textMuted, minWidth: "36px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Plus size={12} /></button>
            <button onClick={fitToScreen} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Maximize2 size={12} /></button>
          </div>
        </div>

        {tool !== "select" && !view3D && (
          <div style={{ padding: "5px 14px", fontSize: "11px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: "5px", background: tool === "measure" || tool === "calibrate" ? "#fffbeb" : tool === "cable" ? "#f0f9ff" : T.accentLight, color: tool === "measure" || tool === "calibrate" ? "#92400e" : tool === "cable" ? "#0369a1" : T.accent }}>
            {tool.startsWith("place:") && <><Plus size={11} /> Clique na planta para posicionar. Esc cancela.</>}
            {tool === "measure" && <><Ruler size={11} /> {!measurePoints.length ? "Clique no ponto inicial." : "Clique no ponto final."}</>}
            {tool === "calibrate" && <><Ruler size={11} /> {!calibratePoints.length ? "Clique no início de medida conhecida." : "Clique no ponto final."}</>}
            {tool === "cable" && <><Link2 size={11} /> {!cableStart ? "Clique no equipamento de origem." : "Clique no destino."}</>}
            {tool === "pan" && <><Move size={11} /> Arraste para mover.</>}
          </div>
        )}

        {view3D && (
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#e8ecf1" }}>
            <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#60a5fa", fontSize: "14px" }}>Carregando 3D...</div>}>
              <Scene3D
                page={page}
                elements={elements}
                connections={connections}
                measureLines={measureLines}
                scale={scale}
                showCoverage={showCoverage}
                showCables={showCables}
                layerVisibility={layerVisibility}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Suspense>
          </div>
        )}

        <div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative", background: T.canvas, cursor: tool === "pan" ? "grab" : tool === "measure" || tool === "calibrate" ? "crosshair" : tool === "cable" ? "cell" : tool.startsWith("place:") ? "copy" : "default", display: view3D ? "none" : undefined }}
          onMouseDown={startPan} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          {!page.bgImage ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "14px" }}>
              <div style={{ width: "68px", height: "68px", borderRadius: "16px", background: T.white, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${T.border}`, boxShadow: T.shadow }}><FileImage size={28} color={T.textDim} /></div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: T.textMuted }}>Carregue uma planta para "{page.name}"</div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: "9px 22px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: T.accent, color: "#fff", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}><Upload size={13} style={{ marginRight: "5px", verticalAlign: "-2px" }} /> Selecionar</button>
            </div>
          ) : (
            <div ref={canvasRef} onClick={handleCanvasClick} onWheel={handleWheel} style={{ position: "absolute", inset: 0 }}>
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute" }}>
                <img src={page.bgImage} style={{ display: "block", width: page.bgNatural.w, height: page.bgNatural.h }} draggable={false} />
                {companyLogo && watermarkOpacity > 0 && <img src={companyLogo} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "30%", maxHeight: "30%", opacity: watermarkOpacity, pointerEvents: "none" }} />}
                {showGrid && <svg style={{ position: "absolute", top: 0, left: 0, width: page.bgNatural.w, height: page.bgNatural.h, pointerEvents: "none" }}><defs><pattern id="gr" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#94a3b8" strokeWidth="0.3" opacity=".25" /></pattern></defs><rect width="100%" height="100%" fill="url(#gr)" /></svg>}
                <svg style={{ position: "absolute", top: 0, left: 0, width: page.bgNatural.w, height: page.bgNatural.h, pointerEvents: "none" }}>
                  {showCables && connections.map(cn => { const f = elements.find(e => e.id === cn.from), t = elements.find(e => e.id === cn.to); if (!f || !t) return null; return (<g key={cn.id} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); saveSnapshot(); setConnections(prev => prev.filter(c => c.id !== cn.id)); }}><line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={10 / zoom} /><line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#94a3b8" strokeWidth={1.5 / zoom} strokeDasharray={`${7 / zoom} ${4 / zoom}`} /><circle cx={(f.x + t.x) / 2} cy={(f.y + t.y) / 2} r={2.5 / zoom} fill="#94a3b8" /></g>); })}
                  {showCoverage && visibleElements.filter(e => e.radius > 0 && e.angle > 0).map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); const c = el.customColor || eq.color; const sa = (el.rotation - el.angle / 2) * Math.PI / 180, ea = (el.rotation + el.angle / 2) * Math.PI / 180; const x1 = el.x + el.radius * Math.cos(sa), y1 = el.y + el.radius * Math.sin(sa), x2 = el.x + el.radius * Math.cos(ea), y2 = el.y + el.radius * Math.sin(ea); const la = el.angle > 180 ? 1 : 0; const d = el.angle >= 360 ? `M ${el.x + el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x - el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x + el.radius} ${el.y}` : `M ${el.x} ${el.y} L ${x1} ${y1} A ${el.radius} ${el.radius} 0 ${la} 1 ${x2} ${y2} Z`; return <path key={`c-${el.id}`} d={d} fill={c + "18"} stroke={c + "50"} strokeWidth={1 / zoom} />; })}
                  {measureLines.map((ml, i) => { const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; const s = selectedMeasure === i; return (<g key={`m-${i}`} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedMeasure(i); setSelectedId(null); }}><line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke="transparent" strokeWidth={12 / zoom} /><line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke={s ? "#d97706" : "#f59e0b"} strokeWidth={(s ? 2.5 : 1.5) / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} /><circle cx={ml.p1.x} cy={ml.p1.y} r={(s ? 4.5 : 3.5) / zoom} fill={s ? "#d97706" : "#f59e0b"} stroke="#fff" strokeWidth={1.5 / zoom} /><circle cx={ml.p2.x} cy={ml.p2.y} r={(s ? 4.5 : 3.5) / zoom} fill={s ? "#d97706" : "#f59e0b"} stroke="#fff" strokeWidth={1.5 / zoom} /><rect x={mx - 22 / zoom} y={my - 15 / zoom} width={44 / zoom} height={16 / zoom} rx={4 / zoom} fill="#fff" stroke="#e5e7eb" strokeWidth={.5 / zoom} /><text x={mx} y={my - 4 / zoom} textAnchor="middle" fill="#92400e" fontSize={10 / zoom} fontWeight="bold">{(ml.dist * scale).toFixed(1)}m</text></g>); })}
                  {measurePoints.length === 1 && <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={5 / zoom} fill="#f59e0b" stroke="#fff" strokeWidth={2 / zoom} />}
                  {calibratePoints.length === 1 && <circle cx={calibratePoints[0].x} cy={calibratePoints[0].y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} />}
                  {calibrateDialog && <><line x1={calibrateDialog.p1.x} y1={calibrateDialog.p1.y} x2={calibrateDialog.p2.x} y2={calibrateDialog.p2.y} stroke="#ea580c" strokeWidth={2.5 / zoom} strokeDasharray={`${7 / zoom} ${4 / zoom}`} /><circle cx={calibrateDialog.p1.x} cy={calibrateDialog.p1.y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} /><circle cx={calibrateDialog.p2.x} cy={calibrateDialog.p2.y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} /></>}
                </svg>
                {visibleElements.map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return null; const isSel = selectedId === el.id; const isCbl = cableStart === el.id; const col = el.customColor || eq.color; const sz = SIZES[el.size || "medium"]; return (
                  <div key={el.id} onMouseDown={(e) => startDrag(e, el.id)} onClick={(e) => { e.stopPropagation(); if (tool === "cable") handleCanvasClick(e); else { setSelectedId(el.id); setSelectedMeasure(null); } }} style={{ position: "absolute", left: el.x - sz / 2, top: el.y - sz / 2, width: sz, height: sz, cursor: tool === "cable" ? "cell" : "pointer", zIndex: isSel ? 100 : 10 }}>
                    {(isSel || isCbl) && <div style={{ position: "absolute", inset: -5, borderRadius: "50%", border: `2px solid ${isCbl ? T.success : col}`, opacity: .5, animation: "pulse 1.5s infinite" }} />}
                    <div style={{ width: sz, height: sz, borderRadius: "50%", background: col, border: `2.5px solid #fff`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${col}40, 0 0 0 ${isSel ? "3px" : "0"} ${col}30` }}>
                      <EquipIcon type={el.type} variant={el.iconVariant || 0} size={sz * .52} color="#fff" />
                    </div>
                    <div style={{ position: "absolute", left: "50%", top: sz + 4 + "px", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: Math.max(9, 10 / Math.sqrt(zoom)), fontWeight: 700, color: T.text, textShadow: "0 0 4px #fff, 0 0 8px #fff, 0 1px 2px rgba(0,0,0,.15)", pointerEvents: "none" }}>{el.label}</div>
                  </div>); })}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: T.toolbar, borderTop: `1px solid ${T.borderLight}`, padding: "3px 14px", display: "flex", alignItems: "center", gap: "10px", fontSize: "10px", color: T.textDim }}>
          {EQUIPMENT.map(eq => { const c = counts[eq.type] || 0; if (!c) return null; return <span key={eq.type} style={{ display: "flex", alignItems: "center", gap: "2px" }}><EquipIcon type={eq.type} variant={0} size={11} color={eq.color} /> {c}</span>; })}
          <span style={{ fontWeight: 600, color: T.text }}>{totalEquip}</span>
          <span>· {connections.length} cabos · {measureLines.length} med.</span>
          <div style={{ flex: 1 }} />
          <span>{page.name} · {pages.length} pág.</span>
          <span>{Math.round(zoom * 100)}% · 1px={scale}m</span>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      {sel && selEq && (
        <div style={{ width: "258px", minWidth: "258px", background: T.sidebar, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "auto", boxShadow: "-2px 0 8px rgba(0,0,0,0.03)" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: (sel.customColor || selEq.color) + "12", display: "flex", alignItems: "center", justifyContent: "center" }}><EquipIcon type={sel.type} variant={sel.iconVariant || 0} size={18} color={sel.customColor || selEq.color} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: "12px", fontWeight: 700 }}>{sel.label}</div><div style={{ fontSize: "9px", color: T.textDim }}>{selEq.label} #{sel.number}</div></div>
            <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={14} /></button>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "9px" }}>
            <div><label style={lblS}>Nome</label><input value={sel.label} onChange={e => updateEl(sel.id, { label: e.target.value })} style={inpS} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}><div><label style={lblS}>X</label><input type="number" value={Math.round(sel.x)} onChange={e => updateEl(sel.id, { x: +e.target.value || 0 })} style={inpS} /></div><div><label style={lblS}>Y</label><input type="number" value={Math.round(sel.y)} onChange={e => updateEl(sel.id, { y: +e.target.value || 0 })} style={inpS} /></div></div>
            <div><label style={lblS}>Rotação (°)</label><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><input type="number" value={sel.rotation} onChange={e => updateEl(sel.id, { rotation: +e.target.value || 0 })} min={0} max={360} style={{ ...inpS, flex: 1 }} /><input type="range" value={sel.rotation} onChange={e => updateEl(sel.id, { rotation: +e.target.value })} min={0} max={360} style={{ flex: 2, accentColor: sel.customColor || selEq.color }} /></div><div style={{ display: "flex", gap: "3px", marginTop: "4px" }}>{[["N", 270], ["L", 0], ["S", 90], ["O", 180]].map(([d, v]) => <button key={d} onClick={() => updateEl(sel.id, { rotation: v })} style={{ flex: 1, padding: "4px", borderRadius: "5px", border: `1px solid ${T.borderLight}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: sel.rotation === v ? (sel.customColor || selEq.color) + "15" : T.white, color: sel.rotation === v ? (sel.customColor || selEq.color) : T.textDim }}>{d}</button>)}</div></div>
            <div><label style={lblS}>Ângulo cobertura</label><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><input type="number" value={sel.angle} onChange={e => updateEl(sel.id, { angle: Math.min(360, Math.max(0, +e.target.value || 0)) })} style={{ ...inpS, flex: 1 }} /><input type="range" value={sel.angle} onChange={e => updateEl(sel.id, { angle: +e.target.value })} min={0} max={360} style={{ flex: 2, accentColor: sel.customColor || selEq.color }} /></div></div>
            <div><label style={lblS}>Alcance (px)</label><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><input type="number" value={sel.radius} onChange={e => updateEl(sel.id, { radius: Math.max(0, +e.target.value || 0) })} style={{ ...inpS, flex: 1 }} /><input type="range" value={sel.radius} onChange={e => updateEl(sel.id, { radius: +e.target.value })} min={0} max={300} style={{ flex: 2, accentColor: sel.customColor || selEq.color }} /></div>{sel.radius > 0 && <div style={{ fontSize: "9px", color: T.textDim, marginTop: "2px" }}>≈ {(sel.radius * scale).toFixed(1)}m</div>}</div>
            <div><label style={lblS}>Cor</label><div style={{ display: "flex", gap: "5px", alignItems: "center" }}><input type="color" value={sel.customColor || selEq.color} onChange={e => updateEl(sel.id, { customColor: e.target.value })} style={{ width: "30px", height: "28px", border: `1px solid ${T.border}`, borderRadius: "5px", cursor: "pointer", padding: "2px" }} /><span style={{ fontSize: "10px", color: T.textDim, flex: 1 }}>{sel.customColor || "Padrão"}</span>{sel.customColor && <button onClick={() => updateEl(sel.id, { customColor: null })} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: "10px" }}>Reset</button>}</div></div>
            <div><label style={lblS}>Tamanho</label><div style={{ display: "flex", gap: "3px" }}>{["small", "medium", "large"].map(s => <button key={s} onClick={() => updateEl(sel.id, { size: s })} style={{ flex: 1, padding: "4px", borderRadius: "5px", border: `1px solid ${T.borderLight}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: (sel.size || "medium") === s ? T.accentLight : T.white, color: (sel.size || "medium") === s ? T.accent : T.textDim }}>{s === "small" ? "P" : s === "medium" ? "M" : "G"}</button>)}</div></div>
            <div><label style={lblS}>Modelo do Ícone</label><div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {(ICON_VARIANTS[sel.type] || []).map((v, i) => (
                <button key={i} onClick={() => updateEl(sel.id, { iconVariant: i })} title={v.name}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", border: (sel.iconVariant || 0) === i ? `2px solid ${sel.customColor || selEq.color}` : `1px solid ${T.borderLight}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", background: (sel.iconVariant || 0) === i ? (sel.customColor || selEq.color) + "10" : T.white, boxShadow: (sel.iconVariant || 0) === i ? `0 0 0 3px ${(sel.customColor || selEq.color)}15` : T.shadow, transition: "all .15s" }}>
                  <EquipIcon type={sel.type} variant={i} size={20} color={(sel.iconVariant || 0) === i ? (sel.customColor || selEq.color) : T.textMuted} />
                  <span style={{ fontSize: "6px", color: T.textDim, lineHeight: 1 }}>{v.name}</span>
                </button>
              ))}
            </div></div>
            <div><label style={lblS}>Observações</label><textarea value={sel.notes || ""} onChange={e => updateEl(sel.id, { notes: e.target.value })} placeholder="Modelo, specs..." rows={2} style={{ ...inpS, resize: "vertical", fontFamily: "inherit" }} /></div>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              <button onClick={() => duplicateEl(sel.id)} style={{ flex: 1, padding: "7px", borderRadius: "6px", border: `1px solid ${T.borderLight}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: T.white, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", boxShadow: T.shadow }}><Copy size={11} /> Duplicar</button>
              <button onClick={() => deleteEl(sel.id)} style={{ flex: 1, padding: "7px", borderRadius: "6px", border: `1px solid ${T.danger}30`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: T.dangerLight, color: T.danger, display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}><Trash2 size={11} /> Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}
      {calibrateDialog && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}><div style={{ background: T.white, borderRadius: "12px", padding: "22px", width: "320px", boxShadow: T.shadowMd }}>
        <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Calibrar Escala</div>
        <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "12px" }}>Distância traçada: <strong style={{ color: "#ea580c" }}>{Math.round(calibrateDialog.pixelDist)} px</strong></div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}><input autoFocus type="number" value={calibrateMeters} onChange={e => setCalibrateMeters(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && parseFloat(calibrateMeters) > 0) { setScale(parseFloat(calibrateMeters) / calibrateDialog.pixelDist); setCalibrateDialog(null); setTool("select"); } }} placeholder="5.0" step="0.1" style={{ flex: 1, padding: "9px", borderRadius: "7px", border: `1.5px solid ${T.border}`, color: T.text, fontSize: "15px", textAlign: "center" }} /><span style={{ fontSize: "13px", color: T.textMuted, alignSelf: "center" }}>metros</span></div>
        <div style={{ display: "flex", gap: "6px" }}><button onClick={() => { setCalibrateDialog(null); setTool("select"); }} style={{ flex: 1, padding: "8px", borderRadius: "7px", border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "11px", background: T.white, color: T.textMuted }}>Cancelar</button><button onClick={() => { const m = parseFloat(calibrateMeters); if (m > 0) { setScale(m / calibrateDialog.pixelDist); setCalibrateDialog(null); setTool("select"); } }} style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: "#ea580c", color: "#fff" }}>Aplicar</button></div>
      </div></div>)}

      {pdfDialog && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}><div style={{ background: T.white, borderRadius: "12px", padding: "22px", width: "380px", boxShadow: T.shadowMd, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px" }}>Gerar Proposta em PDF</div>
        <div style={secT}>Dados do Cliente</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "12px" }}>
          <input value={clientInfo.name} onChange={e => setClientInfo({ ...clientInfo, name: e.target.value })} placeholder="Nome do cliente" style={inpS} />
          <input value={clientInfo.address} onChange={e => setClientInfo({ ...clientInfo, address: e.target.value })} placeholder="Endereço" style={inpS} />
          <div style={{ display: "flex", gap: "5px" }}><input value={clientInfo.phone} onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })} placeholder="Telefone" style={inpS} /><input value={clientInfo.email} onChange={e => setClientInfo({ ...clientInfo, email: e.target.value })} placeholder="E-mail" style={inpS} /></div>
        </div>
        {!companyLogo && <button onClick={() => logoRef.current?.click()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", padding: "8px", borderRadius: "7px", border: `1.5px dashed ${T.border}`, cursor: "pointer", fontSize: "11px", color: T.textMuted, background: T.white, marginBottom: "10px" }}><Image size={12} /> Adicionar logo</button>}
        <div style={{ fontSize: "11px", color: T.textMuted, background: T.card, padding: "9px", borderRadius: "7px", marginBottom: "14px" }}>
          Capa profissional + {pages.filter(p => p.bgImage).length} planta(s) + legenda completa com {pages.flatMap(p => p.elements).length} equipamentos
        </div>
        <div style={{ display: "flex", gap: "6px" }}><button onClick={() => setPdfDialog(false)} style={{ flex: 1, padding: "8px", borderRadius: "7px", border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "11px", background: T.white, color: T.textMuted }}>Cancelar</button><button onClick={exportPDF} style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: T.accent, color: "#fff", boxShadow: "0 2px 6px rgba(37,99,235,0.3)" }}><FileText size={12} style={{ marginRight: "4px", verticalAlign: "-2px" }} /> Gerar PDF</button></div>
      </div></div>)}

      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.7;transform:scale(1.15)}}input[type=range]{height:4px}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}`}</style>
    </div>
  );
}
