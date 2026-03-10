import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  Camera, Wifi, Network, Router, HardDrive, Upload, Download, ZoomIn, ZoomOut,
  Undo2, Redo2, Trash2, Copy, Clipboard, Ruler, Move, MousePointer, Plus, Minus,
  List, X, GripVertical, RotateCw, Eye, EyeOff, FileImage, FileText, ChevronDown, ChevronRight,
  Maximize2, Save, FolderOpen, Share2, Grid3X3, Info, Settings, Layers
} from "lucide-react";

/* ─── constants ─── */
const EQUIPMENT = [
  { type: "camera", label: "Câmera", icon: Camera, color: "#ef4444", coverageRadius: 80, angle: 90, defaultRotation: 0 },
  { type: "wifi", label: "Access Point", icon: Wifi, color: "#3b82f6", coverageRadius: 120, angle: 360, defaultRotation: 0 },
  { type: "switch", label: "Switch", icon: Network, color: "#f59e0b", coverageRadius: 0, angle: 0, defaultRotation: 0 },
  { type: "router", label: "Roteador", icon: Router, color: "#8b5cf6", coverageRadius: 100, angle: 360, defaultRotation: 0 },
  { type: "nvr", label: "NVR/DVR", icon: HardDrive, color: "#10b981", coverageRadius: 0, angle: 0, defaultRotation: 0 },
];

const DARK = { bg: "#0a0e1a", sidebar: "#0f1629", toolbar: "#111827", card: "#1a2236", border: "#1e293b", accent: "#3b82f6", accentHover: "#2563eb", text: "#e2e8f0", textMuted: "#94a3b8", textDim: "#64748b", danger: "#ef4444", success: "#22c55e", canvas: "#1a1f2e" };

/* ─── main component ─── */
export default function EditorPlantas() {
  /* state */
  const [bgImage, setBgImage] = useState(null);
  const [bgNatural, setBgNatural] = useState({ w: 0, h: 0 });
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState("select"); // select | place:type | measure | pan | calibrate
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showLegend, setShowLegend] = useState(false);
  const [showCoverage, setShowCoverage] = useState(true);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measureLines, setMeasureLines] = useState([]);
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [calibratePoints, setCalibratePoints] = useState([]);
  const [calibrateDialog, setCalibrateDialog] = useState(null); // { pixelDist }
  const [calibrateMeters, setCalibrateMeters] = useState("");
  const [scale, setScale] = useState(0.05); // meters per pixel
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [sidebarSection, setSidebarSection] = useState("equip");
  const [nextNumbers, setNextNumbers] = useState({ camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
  const [showGrid, setShowGrid] = useState(false);
  const [projectName, setProjectName] = useState("Novo Projeto");
  const [editingName, setEditingName] = useState(false);

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const containerRef = useRef(null);

  /* helpers */
  const saveSnapshot = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), JSON.stringify({ elements, measureLines })]);
    setRedoStack([]);
  }, [elements, measureLines]);

  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack(prev => [...prev, JSON.stringify({ elements, measureLines })]);
    const snap = JSON.parse(undoStack[undoStack.length - 1]);
    setElements(snap.elements || snap);
    setMeasureLines(snap.measureLines || []);
    setUndoStack(prev => prev.slice(0, -1));
    setSelectedId(null);
    setSelectedMeasure(null);
  };

  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack(prev => [...prev, JSON.stringify({ elements, measureLines })]);
    const snap = JSON.parse(redoStack[redoStack.length - 1]);
    setElements(snap.elements || snap);
    setMeasureLines(snap.measureLines || []);
    setRedoStack(prev => prev.slice(0, -1));
    setSelectedId(null);
    setSelectedMeasure(null);
  };

  const cameraCount = elements.filter(e => e.type === "camera").length;
  const totalEquip = elements.length;

  /* file loading */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img.src);
        setBgNatural({ w: img.naturalWidth, h: img.naturalHeight });
        setZoom(1);
        setPan({ x: 0, y: 0 });
        // fit to view
        if (containerRef.current) {
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const fitZoom = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1) * 0.9;
          setZoom(fitZoom);
          setPan({
            x: (cw - img.naturalWidth * fitZoom) / 2,
            y: (ch - img.naturalHeight * fitZoom) / 2,
          });
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  /* canvas click */
  const handleCanvasClick = (e) => {
    if (dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (tool.startsWith("place:")) {
      const type = tool.split(":")[1];
      const eq = EQUIPMENT.find(eq => eq.type === type);
      if (!eq) return;
      saveSnapshot();
      const num = nextNumbers[type];
      setNextNumbers(prev => ({ ...prev, [type]: prev[type] + 1 }));
      const newEl = {
        id: `${type}-${Date.now()}`,
        type,
        label: `${eq.label} ${String(num).padStart(2, "0")}`,
        number: num,
        x, y,
        rotation: eq.defaultRotation,
        angle: eq.angle,
        radius: eq.coverageRadius,
        visible: true,
        notes: "",
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      return;
    }

    if (tool === "measure") {
      if (measurePoints.length === 0) {
        setMeasurePoints([{ x, y }]);
      } else {
        const p1 = measurePoints[0];
        const dist = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);
        saveSnapshot();
        setMeasureLines(prev => [...prev, { p1, p2: { x, y }, dist }]);
        setMeasurePoints([]);
      }
      return;
    }

    if (tool === "calibrate") {
      if (calibratePoints.length === 0) {
        setCalibratePoints([{ x, y }]);
      } else {
        const p1 = calibratePoints[0];
        const pixelDist = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);
        setCalibrateDialog({ pixelDist, p1, p2: { x, y } });
        setCalibrateMeters("");
        setCalibratePoints([]);
      }
      return;
    }

    // select tool - check if clicking near a measurement line
    if (tool === "select") {
      let clickedMeasure = null;
      measureLines.forEach((ml, i) => {
        const mx = (ml.p1.x + ml.p2.x) / 2;
        const my = (ml.p1.y + ml.p2.y) / 2;
        const d = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        if (d < 20 / zoom) clickedMeasure = i;
      });
      if (clickedMeasure !== null) {
        setSelectedMeasure(clickedMeasure);
        setSelectedId(null);
        return;
      }
    }

    // select tool - deselect
    setSelectedId(null);
    setSelectedMeasure(null);
  };

  /* element drag */
  const startDrag = (e, id) => {
    e.stopPropagation();
    if (tool === "measure") return;
    saveSnapshot();
    setSelectedId(id);
    const rect = canvasRef.current.getBoundingClientRect();
    const el = elements.find(el => el.id === id);
    setDragging({
      id,
      offsetX: (e.clientX - rect.left - pan.x) / zoom - el.x,
      offsetY: (e.clientY - rect.top - pan.y) / zoom - el.y,
    });
  };

  const onMouseMove = (e) => {
    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragging.offsetX;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragging.offsetY;
      setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x, y } : el));
    }
    if (panning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const onMouseUp = () => {
    setDragging(null);
    setPanning(false);
  };

  /* pan */
  const startPan = (e) => {
    if (tool === "pan" || e.button === 1) {
      e.preventDefault();
      setPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  /* zoom */
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5);
    setPan({
      x: mx - (mx - pan.x) * (newZoom / zoom),
      y: my - (my - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  /* keyboard */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Delete") {
        if (selectedMeasure !== null) {
          saveSnapshot();
          setMeasureLines(prev => prev.filter((_, i) => i !== selectedMeasure));
          setSelectedMeasure(null);
        } else if (selectedId) {
          saveSnapshot();
          setElements(prev => prev.filter(el => el.id !== selectedId));
          setSelectedId(null);
        }
      }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Escape") { setTool("select"); setMeasurePoints([]); setCalibratePoints([]); setCalibrateDialog(null); setSelectedId(null); setSelectedMeasure(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedMeasure, undoStack, redoStack, elements, measureLines]);

  /* prevent wheel default on container */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  /* update element */
  const updateEl = (id, props) => {
    saveSnapshot();
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...props } : el));
  };

  const deleteEl = (id) => {
    saveSnapshot();
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateEl = (id) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    saveSnapshot();
    const eq = EQUIPMENT.find(eq => eq.type === el.type);
    const num = nextNumbers[el.type];
    setNextNumbers(prev => ({ ...prev, [el.type]: prev[el.type] + 1 }));
    const clone = { ...el, id: `${el.type}-${Date.now()}`, x: el.x + 30, y: el.y + 30, number: num, label: `${eq.label} ${String(num).padStart(2, "0")}` };
    setElements(prev => [...prev, clone]);
    setSelectedId(clone.id);
  };

  /* export */
  const exportPNG = () => {
    const canvas = document.createElement("canvas");
    canvas.width = bgNatural.w;
    canvas.height = bgNatural.h;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      elements.forEach(el => {
        const eq = EQUIPMENT.find(e => e.type === el.type);
        if (!eq) return;
        // coverage
        if (el.radius > 0 && el.angle > 0 && showCoverage) {
          ctx.save();
          ctx.translate(el.x, el.y);
          ctx.rotate((el.rotation - el.angle / 2) * Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, el.radius, 0, el.angle * Math.PI / 180);
          ctx.closePath();
          ctx.fillStyle = eq.color + "30";
          ctx.strokeStyle = eq.color + "80";
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        // dot
        ctx.beginPath();
        ctx.arc(el.x, el.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = eq.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        // label
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(el.label, el.x + 12, el.y + 4);
        ctx.fillText(el.label, el.x + 12, el.y + 4);
      });
      // measurement lines
      measureLines.forEach(ml => {
        ctx.beginPath();
        ctx.moveTo(ml.p1.x, ml.p1.y);
        ctx.lineTo(ml.p2.x, ml.p2.y);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const mx = (ml.p1.x + ml.p2.x) / 2;
        const my = (ml.p1.y + ml.p2.y) / 2;
        const meters = (ml.dist * scale).toFixed(1);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(`${meters}m`, mx + 4, my - 6);
        ctx.fillText(`${meters}m`, mx + 4, my - 6);
      });
      const link = document.createElement("a");
      link.download = `${projectName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = bgImage;
  };

  /* export PDF - auto-fit to page */
  const exportPDF = () => {
    // First render everything to a canvas (same as PNG)
    const canvas = document.createElement("canvas");
    canvas.width = bgNatural.w;
    canvas.height = bgNatural.h;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      elements.forEach(el => {
        const eq = EQUIPMENT.find(e => e.type === el.type);
        if (!eq) return;
        if (el.radius > 0 && el.angle > 0 && showCoverage) {
          ctx.save();
          ctx.translate(el.x, el.y);
          ctx.rotate((el.rotation - el.angle / 2) * Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, el.radius, 0, el.angle * Math.PI / 180);
          ctx.closePath();
          ctx.fillStyle = eq.color + "30";
          ctx.strokeStyle = eq.color + "80";
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(el.x, el.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = eq.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(el.label, el.x + 12, el.y + 4);
        ctx.fillText(el.label, el.x + 12, el.y + 4);
      });
      measureLines.forEach(ml => {
        ctx.beginPath();
        ctx.moveTo(ml.p1.x, ml.p1.y);
        ctx.lineTo(ml.p2.x, ml.p2.y);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const mx = (ml.p1.x + ml.p2.x) / 2;
        const my = (ml.p1.y + ml.p2.y) / 2;
        const meters = (ml.dist * scale).toFixed(1);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(`${meters}m`, mx + 4, my - 6);
        ctx.fillText(`${meters}m`, mx + 4, my - 6);
      });

      // Determine orientation and page size
      const isLandscape = bgNatural.w > bgNatural.h;
      const orientation = isLandscape ? "landscape" : "portrait";

      // A4 dimensions in mm
      const pageW = isLandscape ? 297 : 210;
      const pageH = isLandscape ? 210 : 297;

      const margin = 10; // mm
      const headerH = 18; // mm for title area
      const legendH = elements.length > 0 ? Math.min(50, 12 + elements.length * 5) : 0; // mm for legend
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2 - headerH - legendH;

      // Scale image to fit available area
      const scaleX = availW / bgNatural.w;
      const scaleY = availH / bgNatural.h;
      const fitScale = Math.min(scaleX, scaleY);
      const imgW = bgNatural.w * fitScale;
      const imgH = bgNatural.h * fitScale;
      const imgX = margin + (availW - imgW) / 2;
      const imgY = margin + headerH;

      const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });

      // Header
      pdf.setFillColor(15, 22, 41); // dark header
      pdf.rect(0, 0, pageW, margin + headerH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(projectName, margin, margin + 7);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      pdf.text(`Gerado em ${dateStr}`, margin, margin + 13);
      pdf.text(`${cameraCount} câmera${cameraCount !== 1 ? "s" : ""} | ${totalEquip} equipamentos | ${measureLines.length} medição${measureLines.length !== 1 ? "ões" : ""}`, pageW - margin, margin + 7, { align: "right" });

      // Plant image with border
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.3);
      pdf.rect(imgX - 0.5, imgY - 0.5, imgW + 1, imgH + 1, "S");
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);

      // Legend table
      if (elements.length > 0) {
        const legendY = imgY + imgH + 6;
        pdf.setFillColor(15, 22, 41);
        pdf.rect(margin, legendY - 1, availW, legendH, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        pdf.text("LEGENDA DE EQUIPAMENTOS", margin + 3, legendY + 4);

        // Table header
        const tableY = legendY + 8;
        pdf.setFillColor(30, 41, 59);
        pdf.rect(margin + 2, tableY - 3, availW - 4, 6, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        const cols = [margin + 4, margin + 28, margin + 70, margin + 100, margin + 135];
        pdf.text("ID", cols[0], tableY);
        pdf.text("TIPO", cols[1], tableY);
        pdf.text("POSIÇÃO", cols[2], tableY);
        pdf.text("COBERTURA", cols[3], tableY);
        pdf.text("OBSERVAÇÕES", cols[4], tableY);

        // Table rows
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        let rowY = tableY + 6;
        elements.forEach((el, i) => {
          const eq = EQUIPMENT.find(e => e.type === el.type);
          if (!eq) return;
          if (rowY > pageH - margin - 4) {
            // new page if legend overflows
            pdf.addPage();
            rowY = margin + 6;
          }
          // alternating row background
          if (i % 2 === 0) {
            pdf.setFillColor(20, 30, 50);
            pdf.rect(margin + 2, rowY - 3, availW - 4, 5, "F");
          }
          // color dot
          const rgb = hexToRgb(eq.color);
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.circle(cols[0] + 1.5, rowY - 0.8, 1.2, "F");
          pdf.setTextColor(226, 232, 240);
          pdf.text(el.label, cols[0] + 5, rowY);
          pdf.setTextColor(148, 163, 184);
          pdf.text(eq.label, cols[1], rowY);
          pdf.text(`(${Math.round(el.x)}, ${Math.round(el.y)})`, cols[2], rowY);
          if (el.radius > 0) {
            pdf.text(`${(el.radius * scale).toFixed(1)}m / ${el.angle}°`, cols[3], rowY);
          } else {
            pdf.text("—", cols[3], rowY);
          }
          pdf.text(el.notes || "—", cols[4], rowY);
          rowY += 5;
        });
      }

      // Footer
      pdf.setFontSize(6);
      pdf.setTextColor(100, 116, 139);
      pdf.text("NetPlanner v2.0 — Editor de Plantas", margin, pageH - 4);
      pdf.text(`Escala: 1px = ${scale}m`, pageW - margin, pageH - 4, { align: "right" });

      pdf.save(`${projectName}.pdf`);
    };
    img.src = bgImage;
  };

  /* helper: hex to rgb */
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
  };
  const saveProject = () => {
    const data = { name: projectName, bgImage, bgNatural, elements, measureLines, scale, nextNumbers, zoom, pan, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const loadProject = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        setBgImage(data.bgImage);
        setBgNatural(data.bgNatural);
        setElements(data.elements || []);
        setMeasureLines(data.measureLines || []);
        setScale(data.scale || 0.05);
        setNextNumbers(data.nextNumbers || { camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
        setProjectName(data.name || "Projeto");
        setZoom(data.zoom || 1);
        setPan(data.pan || { x: 0, y: 0 });
        setUndoStack([]);
        setRedoStack([]);
        setSelectedId(null);
      } catch {
        alert("Erro ao carregar projeto.");
      }
    };
    input.click();
  };

  const fitToScreen = () => {
    if (!bgNatural.w || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const fitZoom = Math.min(cw / bgNatural.w, ch / bgNatural.h, 1) * 0.9;
    setZoom(fitZoom);
    setPan({ x: (cw - bgNatural.w * fitZoom) / 2, y: (ch - bgNatural.h * fitZoom) / 2 });
  };

  const selected = elements.find(e => e.id === selectedId);
  const selectedEq = selected ? EQUIPMENT.find(eq => eq.type === selected.type) : null;

  /* get counts by type */
  const counts = {};
  EQUIPMENT.forEach(eq => { counts[eq.type] = elements.filter(e => e.type === eq.type).length; });

  /* styles */
  const btnStyle = (active = false) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    padding: "7px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
    fontSize: "12px", fontWeight: 500, transition: "all 0.15s",
    background: active ? DARK.accent : "transparent",
    color: active ? "#fff" : DARK.textMuted,
  });

  const toolBtn = (t, icon, label) => (
    <button
      key={t}
      onClick={() => { setTool(t); setMeasurePoints([]); }}
      style={btnStyle(tool === t)}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: DARK.bg, color: DARK.text, fontFamily: "'Segoe UI', -apple-system, sans-serif", overflow: "hidden", userSelect: "none" }}>

      {/* ───── LEFT SIDEBAR ───── */}
      <div style={{ width: "260px", minWidth: "260px", background: DARK.sidebar, borderRight: `1px solid ${DARK.border}`, display: "flex", flexDirection: "column" }}>

        {/* logo */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${DARK.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, ${DARK.accent}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.3px" }}>NetPlanner</div>
            <div style={{ fontSize: "10px", color: DARK.textDim }}>Editor de Plantas v2.0</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${DARK.border}` }}>
          {[["equip", "Equipamentos"], ["legend", "Legenda"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSidebarSection(key)}
              style={{
                flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                background: sidebarSection === key ? DARK.card : "transparent",
                color: sidebarSection === key ? DARK.accent : DARK.textDim,
                borderBottom: sidebarSection === key ? `2px solid ${DARK.accent}` : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
          {sidebarSection === "equip" && (
            <>
              {/* equipment palette */}
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DARK.textDim, marginBottom: "8px", fontWeight: 700 }}>
                Adicionar equipamento
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "20px" }}>
                {EQUIPMENT.map(eq => {
                  const Icon = eq.icon;
                  const isActive = tool === `place:${eq.type}`;
                  return (
                    <button
                      key={eq.type}
                      onClick={() => setTool(isActive ? "select" : `place:${eq.type}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
                        borderRadius: "8px", border: isActive ? `1px solid ${eq.color}` : `1px solid transparent`,
                        cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                        background: isActive ? eq.color + "18" : DARK.card,
                        color: isActive ? eq.color : DARK.text,
                      }}
                    >
                      <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: eq.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} color={eq.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{eq.label}</div>
                        <div style={{ fontSize: "10px", color: DARK.textDim }}>{counts[eq.type] || 0} no projeto</div>
                      </div>
                      <Plus size={14} color={DARK.textDim} />
                    </button>
                  );
                })}
              </div>

              {/* scale / calibration */}
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DARK.textDim, marginBottom: "8px", fontWeight: 700 }}>
                Escala do projeto
              </div>
              <div style={{ background: DARK.card, borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                <button
                  onClick={() => { setTool("calibrate"); setCalibratePoints([]); }}
                  style={{
                    width: "100%", padding: "8px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                    border: tool === "calibrate" ? `1px solid #fbbf24` : `1px solid ${DARK.border}`,
                    background: tool === "calibrate" ? "#fbbf2418" : DARK.bg,
                    color: tool === "calibrate" ? "#fbbf24" : DARK.text,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  }}
                >
                  <Ruler size={14} /> Calibrar escala
                </button>
                <div style={{ fontSize: "10px", color: DARK.textDim, marginTop: "8px", lineHeight: "1.4" }}>
                  Trace uma linha sobre uma medida conhecida na planta e informe o valor real em metros.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                  <Ruler size={14} color={DARK.textDim} />
                  <span style={{ fontSize: "12px", color: DARK.textMuted }}>1 pixel =</span>
                  <input
                    type="number"
                    value={scale}
                    onChange={e => setScale(parseFloat(e.target.value) || 0.01)}
                    step="0.01"
                    min="0.001"
                    style={{ width: "60px", padding: "4px 6px", borderRadius: "4px", border: `1px solid ${DARK.border}`, background: DARK.bg, color: DARK.text, fontSize: "12px", textAlign: "center" }}
                  />
                  <span style={{ fontSize: "12px", color: DARK.textMuted }}>m</span>
                </div>
              </div>

              {/* stats */}
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DARK.textDim, marginBottom: "8px", fontWeight: 700 }}>
                Resumo
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "4px" }}>
                {EQUIPMENT.map(eq => {
                  const count = counts[eq.type] || 0;
                  if (count === 0) return null;
                  const Icon = eq.icon;
                  return (
                    <div key={eq.type} style={{ display: "flex", alignItems: "center", gap: "8px", background: DARK.card, borderRadius: "6px", padding: "8px 10px" }}>
                      <Icon size={14} color={eq.color} />
                      <span style={{ flex: 1, fontSize: "12px", color: DARK.textMuted }}>{eq.label}</span>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: eq.color }}>{count}</span>
                    </div>
                  );
                })}
                {totalEquip === 0 && (
                  <div style={{ color: DARK.textDim, fontSize: "11px", textAlign: "center", padding: "8px" }}>Nenhum equipamento</div>
                )}
              </div>
              <div style={{ background: `linear-gradient(135deg, ${DARK.accent}20, #8b5cf620)`, borderRadius: "8px", padding: "10px", textAlign: "center", border: `1px solid ${DARK.accent}30` }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: DARK.accent }}>{totalEquip}</div>
                <div style={{ fontSize: "10px", color: DARK.textDim }}>Total de equipamentos</div>
              </div>
            </>
          )}

          {sidebarSection === "legend" && (
            <>
              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DARK.textDim, marginBottom: "8px", fontWeight: 700 }}>
                Tabela de equipamentos
              </div>
              {elements.length === 0 ? (
                <div style={{ color: DARK.textDim, fontSize: "12px", textAlign: "center", padding: "20px" }}>
                  Nenhum equipamento adicionado
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {EQUIPMENT.map(eq => {
                    const items = elements.filter(e => e.type === eq.type);
                    if (items.length === 0) return null;
                    const Icon = eq.icon;
                    return (
                      <div key={eq.type}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", fontSize: "11px", fontWeight: 700, color: eq.color }}>
                          <Icon size={12} /> {eq.label} ({items.length})
                        </div>
                        {items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 8px 6px 24px",
                              border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px", textAlign: "left",
                              background: selectedId === item.id ? DARK.accent + "25" : "transparent",
                              color: selectedId === item.id ? DARK.text : DARK.textMuted,
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: eq.color }} />
                            {item.label}
                            {item.notes && <Info size={10} color={DARK.textDim} />}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* measurement lines */}
              {measureLines.length > 0 && (
                <>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: DARK.textDim, margin: "16px 0 8px", fontWeight: 700 }}>
                    Medições
                  </div>
                  {measureLines.map((ml, i) => (
                    <div
                      key={i}
                      onClick={() => { setSelectedMeasure(i); setSelectedId(null); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px",
                        background: selectedMeasure === i ? "#fbbf2420" : DARK.card,
                        border: selectedMeasure === i ? "1px solid #fbbf2440" : "1px solid transparent",
                        borderRadius: "6px", marginBottom: "4px", cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "#fbbf24" }}>
                        <Ruler size={10} /> Medição {i + 1}: {(ml.dist * scale).toFixed(2)}m
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); saveSnapshot(); setMeasureLines(prev => prev.filter((_, j) => j !== i)); if (selectedMeasure === i) setSelectedMeasure(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: DARK.textDim, padding: "2px" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ───── MAIN AREA ───── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* ── TOP TOOLBAR ── */}
        <div style={{ background: DARK.toolbar, borderBottom: `1px solid ${DARK.border}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>

          {/* project name */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "8px" }}>
            {editingName ? (
              <input
                autoFocus
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                style={{ background: DARK.bg, border: `1px solid ${DARK.accent}`, borderRadius: "4px", padding: "4px 8px", color: DARK.text, fontSize: "13px", fontWeight: 600, width: "160px" }}
              />
            ) : (
              <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", cursor: "pointer", color: DARK.text, fontSize: "13px", fontWeight: 600 }}>
                {projectName}
              </button>
            )}
          </div>

          <div style={{ width: "1px", height: "24px", background: DARK.border, margin: "0 4px" }} />

          {/* file ops */}
          <button onClick={() => fileRef.current?.click()} style={btnStyle()} title="Carregar planta">
            <Upload size={15} /> <span>Planta</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={saveProject} style={btnStyle()} title="Salvar projeto"><Save size={15} /></button>
          <button onClick={loadProject} style={btnStyle()} title="Abrir projeto"><FolderOpen size={15} /></button>
          <button onClick={exportPNG} style={btnStyle()} title="Exportar PNG" disabled={!bgImage}><Download size={15} /> <span>PNG</span></button>
          <button onClick={exportPDF} style={btnStyle()} title="Exportar PDF" disabled={!bgImage}><FileText size={15} /> <span>PDF</span></button>

          <div style={{ width: "1px", height: "24px", background: DARK.border, margin: "0 4px" }} />

          {/* tools */}
          {toolBtn("select", <MousePointer size={15} />, "Selecionar (Esc)")}
          {toolBtn("pan", <Move size={15} />, "Mover canvas")}
          {toolBtn("measure", <Ruler size={15} />, "Medir distância")}

          <div style={{ width: "1px", height: "24px", background: DARK.border, margin: "0 4px" }} />

          {/* undo/redo */}
          <button onClick={undo} style={btnStyle()} title="Desfazer (Ctrl+Z)" disabled={!undoStack.length}><Undo2 size={15} /></button>
          <button onClick={redo} style={btnStyle()} title="Refazer (Ctrl+Y)" disabled={!redoStack.length}><Redo2 size={15} /></button>

          <div style={{ width: "1px", height: "24px", background: DARK.border, margin: "0 4px" }} />

          {/* toggles */}
          <button onClick={() => setShowCoverage(!showCoverage)} style={btnStyle(showCoverage)} title="Cobertura">
            {showCoverage ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button onClick={() => setShowGrid(!showGrid)} style={btnStyle(showGrid)} title="Grade">
            <Grid3X3 size={15} />
          </button>

          <div style={{ flex: 1 }} />

          {/* zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: DARK.card, borderRadius: "8px", padding: "4px 8px" }}>
            <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))} style={{ background: "none", border: "none", cursor: "pointer", color: DARK.textMuted, display: "flex" }}><Minus size={14} /></button>
            <span style={{ fontSize: "11px", color: DARK.textMuted, minWidth: "40px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} style={{ background: "none", border: "none", cursor: "pointer", color: DARK.textMuted, display: "flex" }}><Plus size={14} /></button>
            <button onClick={fitToScreen} style={{ background: "none", border: "none", cursor: "pointer", color: DARK.textMuted, display: "flex" }} title="Ajustar à tela"><Maximize2 size={14} /></button>
          </div>
        </div>

        {/* tool hint */}
        {tool !== "select" && (
          <div style={{ background: tool === "measure" ? "#fbbf24" + "15" : DARK.accent + "15", padding: "6px 16px", fontSize: "12px", color: tool === "measure" ? "#fbbf24" : DARK.accent, display: "flex", alignItems: "center", gap: "8px", borderBottom: `1px solid ${DARK.border}` }}>
            {tool.startsWith("place:") && <><Plus size={13} /> Clique na planta para posicionar o equipamento. Pressione Esc para cancelar.</>}
            {tool === "measure" && <><Ruler size={13} /> {measurePoints.length === 0 ? "Clique no ponto inicial." : "Clique no ponto final para medir."} Pressione Esc para cancelar.</>}
            {tool === "calibrate" && <><Ruler size={13} /> {calibratePoints.length === 0 ? "Clique no ponto inicial de uma medida conhecida na planta." : "Clique no ponto final."} Pressione Esc para cancelar.</>}
            {tool === "pan" && <><Move size={13} /> Clique e arraste para mover a planta.</>}
          </div>
        )}

        {/* ── CANVAS ── */}
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: "hidden", position: "relative", background: DARK.canvas, cursor: tool === "pan" ? "grab" : tool === "measure" || tool === "calibrate" ? "crosshair" : tool.startsWith("place:") ? "copy" : "default" }}
          onMouseDown={startPan}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {!bgImage ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: DARK.card, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${DARK.border}` }}>
                <FileImage size={32} color={DARK.textDim} />
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: DARK.textMuted }}>Carregue uma planta baixa</div>
              <div style={{ fontSize: "12px", color: DARK.textDim }}>Suporta JPG, PNG, BMP</div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: DARK.accent, color: "#fff" }}
              >
                <Upload size={14} style={{ marginRight: "8px", verticalAlign: "-2px" }} />
                Selecionar arquivo
              </button>
            </div>
          ) : (
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              onWheel={handleWheel}
              style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "hidden" }}
            >
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute" }}>
                {/* background */}
                <img src={bgImage} style={{ display: "block", width: bgNatural.w, height: bgNatural.h, imageRendering: zoom > 2 ? "pixelated" : "auto" }} draggable={false} />

                {/* grid overlay */}
                {showGrid && (
                  <svg style={{ position: "absolute", top: 0, left: 0, width: bgNatural.w, height: bgNatural.h, pointerEvents: "none" }}>
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke={DARK.textDim} strokeWidth="0.3" opacity="0.4" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {/* SVG for coverage, lines, measurement */}
                <svg style={{ position: "absolute", top: 0, left: 0, width: bgNatural.w, height: bgNatural.h, pointerEvents: "none" }}>
                  {/* coverage arcs */}
                  {showCoverage && elements.filter(e => e.radius > 0 && e.angle > 0 && e.visible !== false).map(el => {
                    const eq = EQUIPMENT.find(e => e.type === el.type);
                    const startAngle = (el.rotation - el.angle / 2) * Math.PI / 180;
                    const endAngle = (el.rotation + el.angle / 2) * Math.PI / 180;
                    const x1 = el.x + el.radius * Math.cos(startAngle);
                    const y1 = el.y + el.radius * Math.sin(startAngle);
                    const x2 = el.x + el.radius * Math.cos(endAngle);
                    const y2 = el.y + el.radius * Math.sin(endAngle);
                    const largeArc = el.angle > 180 ? 1 : 0;
                    const d = el.angle >= 360
                      ? `M ${el.x + el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x - el.radius} ${el.y} A ${el.radius} ${el.radius} 0 1 1 ${el.x + el.radius} ${el.y}`
                      : `M ${el.x} ${el.y} L ${x1} ${y1} A ${el.radius} ${el.radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    return (
                      <path key={`cov-${el.id}`} d={d} fill={eq.color + "20"} stroke={eq.color + "60"} strokeWidth={1.2 / zoom} />
                    );
                  })}

                  {/* measurement lines */}
                  {measureLines.map((ml, i) => {
                    const mx = (ml.p1.x + ml.p2.x) / 2;
                    const my = (ml.p1.y + ml.p2.y) / 2;
                    const isSel = selectedMeasure === i;
                    return (
                      <g key={`ml-${i}`} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedMeasure(i); setSelectedId(null); }}>
                        {/* wider invisible hitbox for easier clicking */}
                        <line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke="transparent" strokeWidth={12 / zoom} />
                        <line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke={isSel ? "#fff" : "#fbbf24"} strokeWidth={(isSel ? 3 : 2) / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} />
                        <circle cx={ml.p1.x} cy={ml.p1.y} r={(isSel ? 5 : 4) / zoom} fill={isSel ? "#fff" : "#fbbf24"} />
                        <circle cx={ml.p2.x} cy={ml.p2.y} r={(isSel ? 5 : 4) / zoom} fill={isSel ? "#fff" : "#fbbf24"} />
                        <rect x={mx - 24 / zoom} y={my - 16 / zoom} width={48 / zoom} height={18 / zoom} rx={4 / zoom} fill={isSel ? "#fbbf24" : "#000"} opacity={isSel ? 0.9 : 0.7} />
                        <text x={mx} y={my - 4 / zoom} textAnchor="middle" fill={isSel ? "#000" : "#fbbf24"} fontSize={11 / zoom} fontWeight="bold">
                          {(ml.dist * scale).toFixed(1)}m
                        </text>
                        {isSel && (
                          <text x={mx} y={my + 10 / zoom} textAnchor="middle" fill="#ef4444" fontSize={9 / zoom} fontWeight="bold">
                            Delete para remover
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* measurement in-progress */}
                  {measurePoints.length === 1 && (
                    <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={5 / zoom} fill="#fbbf24" stroke="#000" strokeWidth={1.5 / zoom} />
                  )}

                  {/* calibration in-progress */}
                  {calibratePoints.length === 1 && (
                    <circle cx={calibratePoints[0].x} cy={calibratePoints[0].y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} />
                  )}
                  {calibrateDialog && (
                    <g>
                      <line x1={calibrateDialog.p1.x} y1={calibrateDialog.p1.y} x2={calibrateDialog.p2.x} y2={calibrateDialog.p2.y} stroke="#f97316" strokeWidth={3 / zoom} strokeDasharray={`${8 / zoom} ${4 / zoom}`} />
                      <circle cx={calibrateDialog.p1.x} cy={calibrateDialog.p1.y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} />
                      <circle cx={calibrateDialog.p2.x} cy={calibrateDialog.p2.y} r={6 / zoom} fill="#f97316" stroke="#fff" strokeWidth={2 / zoom} />
                    </g>
                  )}
                </svg>

                {/* element markers */}
                {elements.filter(e => e.visible !== false).map(el => {
                  const eq = EQUIPMENT.find(e => e.type === el.type);
                  const Icon = eq?.icon;
                  const isSel = selectedId === el.id;
                  return (
                    <div
                      key={el.id}
                      onMouseDown={(e) => startDrag(e, el.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                      style={{
                        position: "absolute",
                        left: el.x - 16,
                        top: el.y - 16,
                        width: 32, height: 32,
                        cursor: "pointer",
                        zIndex: isSel ? 100 : 10,
                      }}
                    >
                      {/* glow */}
                      {isSel && (
                        <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${eq.color}`, opacity: 0.6, animation: "pulse 1.5s infinite" }} />
                      )}
                      {/* dot */}
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: `radial-gradient(circle, ${eq.color}, ${eq.color}cc)`,
                        border: isSel ? "2.5px solid #fff" : `2px solid ${eq.color}88`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 2px 8px ${eq.color}50`,
                      }}>
                        <Icon size={15} color="#fff" strokeWidth={2.2} />
                      </div>
                      {/* label */}
                      <div style={{
                        position: "absolute", left: "50%", top: "38px", transform: "translateX(-50%)",
                        whiteSpace: "nowrap", fontSize: Math.max(10, 11 / Math.sqrt(zoom)),
                        fontWeight: 700, color: "#fff", textShadow: "0 1px 3px #000, 0 0 6px #000",
                        pointerEvents: "none",
                      }}>
                        {el.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── STATUS BAR ── */}
        <div style={{ background: DARK.toolbar, borderTop: `1px solid ${DARK.border}`, padding: "4px 16px", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: DARK.textDim, flexWrap: "wrap" }}>
          {EQUIPMENT.map(eq => {
            const c = counts[eq.type] || 0;
            if (c === 0) return null;
            const Icon = eq.icon;
            return (
              <span key={eq.type} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <Icon size={11} color={eq.color} /> {c}
              </span>
            );
          })}
          <span style={{ fontWeight: 600 }}>{totalEquip} total</span>
          <span>| {measureLines.length} medição{measureLines.length !== 1 ? "ões" : ""}</span>
          <div style={{ flex: 1 }} />
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>Escala: 1px = {scale}m</span>
        </div>
      </div>

      {/* ───── RIGHT PANEL (Properties) ───── */}
      {selected && selectedEq && (
        <div style={{ width: "280px", minWidth: "280px", background: DARK.sidebar, borderLeft: `1px solid ${DARK.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>

          <div style={{ padding: "16px", borderBottom: `1px solid ${DARK.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: selectedEq.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(() => { const Icon = selectedEq.icon; return <Icon size={18} color={selectedEq.color} />; })()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{selected.label}</div>
              <div style={{ fontSize: "10px", color: DARK.textDim }}>{selectedEq.label} #{selected.number}</div>
            </div>
            <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DARK.textDim }}><X size={16} /></button>
          </div>

          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* label */}
            <div>
              <label style={labelStyle}>Nome/Rótulo</label>
              <input
                value={selected.label}
                onChange={e => updateEl(selected.id, { label: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* position */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={labelStyle}>X (px)</label>
                <input
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={e => updateEl(selected.id, { x: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Y (px)</label>
                <input
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={e => updateEl(selected.id, { y: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* rotation */}
            <div>
              <label style={labelStyle}>Rotação (°)</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="number"
                  value={selected.rotation}
                  onChange={e => updateEl(selected.id, { rotation: parseFloat(e.target.value) || 0 })}
                  min={0} max={360}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="range"
                  value={selected.rotation}
                  onChange={e => updateEl(selected.id, { rotation: parseFloat(e.target.value) })}
                  min={0} max={360}
                  style={{ flex: 2, accentColor: selectedEq.color }}
                />
              </div>
              <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                {[["N", 270], ["L", 0], ["S", 90], ["O", 180]].map(([d, v]) => (
                  <button
                    key={d}
                    onClick={() => updateEl(selected.id, { rotation: v })}
                    style={{ flex: 1, padding: "4px", borderRadius: "4px", border: `1px solid ${DARK.border}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: selected.rotation === v ? selectedEq.color + "30" : DARK.card, color: selected.rotation === v ? selectedEq.color : DARK.textDim }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* angle (coverage) */}
            {selected.angle !== undefined && (
              <div>
                <label style={labelStyle}>Ângulo de cobertura (°)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    value={selected.angle}
                    onChange={e => updateEl(selected.id, { angle: Math.min(360, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    min={0} max={360}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="range"
                    value={selected.angle}
                    onChange={e => updateEl(selected.id, { angle: parseFloat(e.target.value) })}
                    min={0} max={360}
                    style={{ flex: 2, accentColor: selectedEq.color }}
                  />
                </div>
              </div>
            )}

            {/* radius */}
            <div>
              <label style={labelStyle}>Alcance (px)</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="number"
                  value={selected.radius}
                  onChange={e => updateEl(selected.id, { radius: Math.max(0, parseFloat(e.target.value) || 0) })}
                  min={0}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="range"
                  value={selected.radius}
                  onChange={e => updateEl(selected.id, { radius: parseFloat(e.target.value) })}
                  min={0} max={300}
                  style={{ flex: 2, accentColor: selectedEq.color }}
                />
              </div>
              {selected.radius > 0 && (
                <div style={{ fontSize: "10px", color: DARK.textDim, marginTop: "2px" }}>
                  ≈ {(selected.radius * scale).toFixed(1)}m de alcance
                </div>
              )}
            </div>

            {/* notes */}
            <div>
              <label style={labelStyle}>Observações</label>
              <textarea
                value={selected.notes || ""}
                onChange={e => updateEl(selected.id, { notes: e.target.value })}
                placeholder="Ex: Modelo Hikvision DS-2CD..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {/* actions */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <button onClick={() => duplicateEl(selected.id)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${DARK.border}`, cursor: "pointer", fontSize: "11px", fontWeight: 600, background: DARK.card, color: DARK.text, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                <Copy size={13} /> Duplicar
              </button>
              <button onClick={() => deleteEl(selected.id)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${DARK.danger}30`, cursor: "pointer", fontSize: "11px", fontWeight: 600, background: DARK.danger + "15", color: DARK.danger, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CALIBRATION DIALOG ── */}
      {calibrateDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: DARK.sidebar, borderRadius: "12px", padding: "24px", width: "340px", border: `1px solid ${DARK.border}` }}>
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px", color: DARK.text }}>Calibrar Escala</div>
            <div style={{ fontSize: "12px", color: DARK.textMuted, marginBottom: "16px" }}>
              A linha traçada tem <strong style={{ color: "#f97316" }}>{Math.round(calibrateDialog.pixelDist)} pixels</strong>. Quantos metros ela representa na planta real?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <input
                autoFocus
                type="number"
                value={calibrateMeters}
                onChange={e => setCalibrateMeters(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const m = parseFloat(calibrateMeters);
                    if (m > 0) {
                      setScale(m / calibrateDialog.pixelDist);
                      setCalibrateDialog(null);
                      setTool("select");
                    }
                  }
                }}
                placeholder="Ex: 5.0"
                step="0.1"
                min="0.01"
                style={{ flex: 1, padding: "10px 12px", borderRadius: "6px", border: `1px solid ${DARK.border}`, background: DARK.bg, color: DARK.text, fontSize: "16px", textAlign: "center" }}
              />
              <span style={{ fontSize: "14px", color: DARK.textMuted, fontWeight: 600 }}>metros</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => { setCalibrateDialog(null); setTool("select"); }}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${DARK.border}`, cursor: "pointer", fontSize: "12px", fontWeight: 600, background: DARK.card, color: DARK.textMuted }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const m = parseFloat(calibrateMeters);
                  if (m > 0) {
                    setScale(m / calibrateDialog.pixelDist);
                    setCalibrateDialog(null);
                    setTool("select");
                  }
                }}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: "#f97316", color: "#fff" }}
              >
                Aplicar escala
              </button>
            </div>
            {calibrateMeters && parseFloat(calibrateMeters) > 0 && (
              <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", background: DARK.bg, fontSize: "11px", color: DARK.textMuted, textAlign: "center" }}>
                Nova escala: 1 pixel = {(parseFloat(calibrateMeters) / calibrateDialog.pixelDist).toFixed(4)} metros
              </div>
            )}
          </div>
        </div>
      )}

      {/* pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        input[type=range] { height: 4px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${DARK.bg}; }
        ::-webkit-scrollbar-thumb { background: ${DARK.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${DARK.textDim}; }
      `}</style>
    </div>
  );
}

/* shared styles */
const labelStyle = { display: "block", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: DARK.textDim, marginBottom: "4px", fontWeight: 700 };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${DARK.border}`, background: DARK.bg, color: DARK.text, fontSize: "12px", outline: "none", boxSizing: "border-box" };
