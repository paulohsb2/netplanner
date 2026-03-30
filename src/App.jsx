import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { jsPDF } from "jspdf";
import {
  Camera, Wifi, Network, Router, HardDrive, Upload, Download,
  Undo2, Redo2, Trash2, Copy, Ruler, Move, MousePointer, Plus, Minus,
  X, Eye, EyeOff, FileImage, FileText,
  Maximize2, Save, FolderOpen, Grid3X3, Layers,
  Link2, Image, Building2, Box, LogIn, LogOut, User, Cloud, Star
} from "lucide-react";
import { generateViewerHTML } from "./htmlExport";
import { calcAllDori, CAMERA_PRESETS, PRESET_GROUPS, DORI_ZONES, DORI_COLORS, DORI_LABELS, DORI_OPACITIES, defaultCameraSpec, calcStorage } from "./doriCalc";
import { supabase, signOut, getProfile, saveProject, loadProject, PLAN_LIMITS } from "./supabase";
import AuthModal from "./AuthModal";
import PlansModal from "./PlansModal";
import ProjectsModal from "./ProjectsModal";

const defaultWifiSpec = () => ({ standard: "Wi-Fi 6", frequency: "2.4+5", maxClients: 50, txPower: 20, brand: "", model: "" });
const defaultSwitchSpec = () => ({ ports: 16, speed: "1G", poe: false, poeBudget: 150, managed: false, brand: "", model: "" });
const defaultRouterSpec = () => ({ wanType: "Fibra", wanSpeed: "500/500", lanPorts: 4, brand: "", model: "" });
const defaultNvrSpec = () => ({ channels: 16, storage: "2TB", poeChannels: 0, maxResolution: "4K", brand: "", model: "" });
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

const CABLE_TYPES = [
  { id: "CAT5e", label: "CAT5e", color: "#94a3b8" },
  { id: "CAT6", label: "CAT6", color: "#64748b" },
  { id: "CAT6A", label: "CAT6A", color: "#475569" },
  { id: "CAT7", label: "CAT7", color: "#334155" },
  { id: "Fibra OM3", label: "Fibra OM3", color: "#eab308" },
  { id: "Coaxial", label: "Coaxial", color: "#3b82f6" },
  { id: "PoE", label: "PoE", color: "#22c55e" },
];

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

/* ═══ PROFESSIONAL EQUIPMENT SHAPES (top-down technical view) ═══ */
const equipSVGStr = (type, color, rotation = 0, cameraType = "dome") => {
  const c = (color || "#888").replace(/[<>"]/g, "");
  const r = Number(rotation) || 0;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width:100%;height:100%;display:block">`;
  const close = `</svg>`;
  switch (type) {
    case "camera": {
      if (cameraType === "bullet") return open + `
        <g transform="rotate(${r},50,50)">
          <rect x="10" y="32" width="66" height="36" rx="8" fill="#1a2235" stroke="rgba(255,255,255,0.85)" stroke-width="2.5"/>
          <rect x="10" y="32" width="66" height="15" rx="7" fill="#263548"/>
          <circle cx="24" cy="40" r="4" fill="${c}" opacity="0.7" stroke="${c}" stroke-width="2"/>
          <circle cx="24" cy="40" r="1.5" fill="${c}"/>
          <rect x="68" y="38" width="18" height="14" rx="3" fill="#0f1824" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <circle cx="77" cy="45" r="4.5" fill="${c}" opacity="0.85"/>
          <circle cx="77" cy="45" r="2" fill="white" opacity="0.4"/>
          <polygon points="50,2 43,12 57,12" fill="${c}" opacity="0.95"/>
        </g>
      ` + close;
      if (cameraType === "ptz") return open + `
        <circle cx="50" cy="50" r="46" fill="#1a2235" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="8 5"/>
        <circle cx="50" cy="50" r="28" fill="#0f1824"/>
        <circle cx="50" cy="50" r="20" fill="none" stroke="${c}" stroke-width="4"/>
        <circle cx="50" cy="50" r="13" fill="${c}" opacity="0.7"/>
        <circle cx="50" cy="50" r="5" fill="${c}" opacity="0.95"/>
        <ellipse cx="43" cy="43" rx="5" ry="3" fill="white" opacity="0.28" transform="rotate(-35,50,50)"/>
        <g transform="rotate(${r},50,50)">
          <polygon points="50,2 41,16 59,16" fill="${c}" opacity="0.95"/>
          <polygon points="50,98 41,84 59,84" fill="${c}" opacity="0.5"/>
          <polygon points="2,50 16,41 16,59" fill="${c}" opacity="0.5"/>
          <polygon points="98,50 84,41 84,59" fill="${c}" opacity="0.5"/>
        </g>
      ` + close;
      if (cameraType === "box") return open + `
        <g transform="rotate(${r},50,50)">
          <rect x="8" y="20" width="74" height="60" rx="5" fill="#1a2235" stroke="rgba(255,255,255,0.85)" stroke-width="2.5"/>
          <rect x="8" y="20" width="74" height="18" rx="5" fill="#263548"/>
          <circle cx="20" cy="29" r="3" fill="#22c55e"/>
          <circle cx="29" cy="29" r="3" fill="#22c55e"/>
          <rect x="16" y="43" width="36" height="28" rx="3" fill="#0f1824" stroke="${c}" stroke-width="2"/>
          <circle cx="34" cy="57" r="10" fill="${c}" opacity="0.75"/>
          <circle cx="34" cy="57" r="5" fill="#0a1420"/>
          <circle cx="34" cy="57" r="2.5" fill="${c}"/>
          <ellipse cx="29" cy="52" rx="4" ry="2.5" fill="white" opacity="0.22" transform="rotate(-25,34,57)"/>
          <rect x="56" y="44" width="20" height="8" rx="2" fill="#f59e0b"/>
          <polygon points="50,2 43,12 57,12" fill="${c}" opacity="0.95"/>
        </g>
      ` + close;
      // default: dome
      return open + `
        <circle cx="50" cy="50" r="46" fill="#1a2235" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
        <circle cx="50" cy="50" r="36" fill="#0f1824"/>
        <circle cx="50" cy="50" r="27" fill="none" stroke="${c}" stroke-width="5"/>
        <circle cx="50" cy="50" r="21" fill="#08101e"/>
        <circle cx="50" cy="50" r="13" fill="${c}" opacity="0.7"/>
        <circle cx="50" cy="50" r="5" fill="${c}" opacity="0.95"/>
        <ellipse cx="42" cy="42" rx="5" ry="3" fill="white" opacity="0.28" transform="rotate(-35,50,50)"/>
        <circle cx="96" cy="50" r="3" fill="#060d16" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
        <circle cx="4" cy="50" r="3" fill="#060d16" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
        <circle cx="50" cy="96" r="3" fill="#060d16" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
        <g transform="rotate(${r},50,50)">
          <polygon points="50,2 41,16 59,16" fill="${c}" opacity="0.95"/>
        </g>
      ` + close;
    }
    case "wifi": return open + `
      <circle cx="51" cy="52" r="46" fill="rgba(0,0,0,0.13)"/>
      <circle cx="50" cy="50" r="46" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="41" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="34" fill="#e8edf5" stroke="#8fa0b8" stroke-width="1"/>
      <circle cx="50" cy="50" r="26" fill="#dde4f0" stroke="#64748b" stroke-width="1"/>
      <circle cx="50" cy="50" r="18" fill="#334155"/>
      <circle cx="50" cy="50" r="10" fill="none" stroke="${c}" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="4" fill="${c}"/>
      <circle cx="50" cy="6" r="3.5" fill="${c}" opacity="0.9"/>
      <circle cx="88" cy="72" r="3.5" fill="${c}" opacity="0.9"/>
      <circle cx="12" cy="72" r="3.5" fill="${c}" opacity="0.9"/>
    ` + close;
    case "switch": return open + `
      <rect x="9" y="21" width="84" height="60" rx="6" fill="rgba(0,0,0,0.18)"/>
      <rect x="8" y="20" width="84" height="60" rx="6" fill="#1e293b" stroke="rgba(255,255,255,0.75)" stroke-width="2"/>
      <rect x="8" y="20" width="84" height="14" rx="5" fill="#263548"/>
      <circle cx="18" cy="27" r="3" fill="#22c55e"/>
      <circle cx="27" cy="27" r="3" fill="#22c55e"/>
      <circle cx="36" cy="27" r="3" fill="#3b82f6"/>
      <circle cx="45" cy="27" r="2" fill="#374151"/>
      <circle cx="84" cy="27" r="4" fill="#22c55e" stroke="#15803d" stroke-width="1"/>
      <rect x="12" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="22" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="32" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="42" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="52" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="62" y="40" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="72" y="40" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="82" y="40" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="12" y="50" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="22" y="50" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="32" y="50" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="42" y="50" width="7" height="5" rx="1" fill="#22c55e"/>
      <rect x="52" y="50" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="62" y="50" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="72" y="50" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="82" y="50" width="7" height="5" rx="1" fill="#374151"/>
      <rect x="12" y="62" width="14" height="8" rx="2" fill="#f59e0b"/>
      <rect x="28" y="62" width="14" height="8" rx="2" fill="#374151"/>
    ` + close;
    case "router": return open + `
      <rect x="15" y="29" width="72" height="44" rx="6" fill="rgba(0,0,0,0.18)"/>
      <rect x="14" y="28" width="72" height="44" rx="6" fill="#2d1b69" stroke="rgba(255,255,255,0.75)" stroke-width="2"/>
      <rect x="14" y="28" width="72" height="13" rx="5" fill="#3b1f80"/>
      <circle cx="24" cy="35" r="3" fill="#22c55e"/>
      <circle cx="33" cy="35" r="3" fill="#22c55e"/>
      <circle cx="42" cy="35" r="3" fill="#3b82f6"/>
      <circle cx="51" cy="35" r="2.5" fill="#374151"/>
      <circle cx="78" cy="35" r="4" fill="${c}" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
      <circle cx="21" cy="8" r="7" fill="#3b1f80" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      <circle cx="21" cy="8" r="3.5" fill="${c}" opacity="0.85"/>
      <circle cx="79" cy="8" r="7" fill="#3b1f80" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      <circle cx="79" cy="8" r="3.5" fill="${c}" opacity="0.85"/>
      <rect x="19" y="13" width="4" height="17" rx="2" fill="#4c1d95"/>
      <rect x="77" y="13" width="4" height="17" rx="2" fill="#4c1d95"/>
      <rect x="20" y="52" width="11" height="8" rx="2" fill="#f59e0b"/>
      <rect x="35" y="52" width="11" height="8" rx="2" fill="#374151"/>
      <rect x="50" y="52" width="11" height="8" rx="2" fill="#374151"/>
      <rect x="65" y="52" width="11" height="8" rx="2" fill="#374151"/>
      <rect x="14" y="63" width="72" height="9" fill="#1e1042"/>
    ` + close;
    case "nvr": return open + `
      <rect x="9" y="19" width="84" height="64" rx="6" fill="rgba(0,0,0,0.18)"/>
      <rect x="8" y="18" width="84" height="64" rx="6" fill="#0f1f2e" stroke="rgba(255,255,255,0.75)" stroke-width="2"/>
      <rect x="8" y="18" width="84" height="13" rx="5" fill="#162636"/>
      <circle cx="18" cy="25" r="3" fill="#22c55e"/>
      <circle cx="27" cy="25" r="3" fill="#22c55e"/>
      <circle cx="36" cy="25" r="3" fill="#f59e0b"/>
      <circle cx="45" cy="25" r="2" fill="#374151"/>
      <circle cx="80" cy="25" r="5" fill="${c}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      <line x1="80" y1="20" x2="80" y2="25" stroke="white" stroke-width="1.5"/>
      <rect x="13" y="35" width="23" height="36" rx="3" fill="#1a3040" stroke="#2d4a60" stroke-width="1.5"/>
      <circle cx="24.5" cy="51" r="9" fill="#0a1828" stroke="#1d4ed8" stroke-width="1.2"/>
      <circle cx="24.5" cy="51" r="4" fill="#1d4ed8" opacity="0.6"/>
      <circle cx="24.5" cy="51" r="1.5" fill="#60a5fa"/>
      <line x1="24.5" y1="42" x2="30" y2="51" stroke="#60a5fa" stroke-width="1.5"/>
      <circle cx="24.5" cy="65" r="2.5" fill="#22c55e"/>
      <rect x="40" y="35" width="23" height="36" rx="3" fill="#1a3040" stroke="#2d4a60" stroke-width="1.5"/>
      <circle cx="51.5" cy="51" r="9" fill="#0a1828" stroke="#1d4ed8" stroke-width="1.2"/>
      <circle cx="51.5" cy="51" r="4" fill="#1d4ed8" opacity="0.6"/>
      <circle cx="51.5" cy="51" r="1.5" fill="#60a5fa"/>
      <line x1="51.5" y1="42" x2="57" y2="51" stroke="#60a5fa" stroke-width="1.5"/>
      <circle cx="51.5" cy="65" r="2.5" fill="#22c55e"/>
      <rect x="67" y="35" width="23" height="36" rx="3" fill="#1a3040" stroke="#2d4a60" stroke-width="1.5"/>
      <circle cx="78.5" cy="51" r="9" fill="#0a1828" stroke="#1d4ed8" stroke-width="1.2"/>
      <circle cx="78.5" cy="51" r="4" fill="#1d4ed8" opacity="0.6"/>
      <circle cx="78.5" cy="51" r="1.5" fill="#60a5fa"/>
      <line x1="78.5" y1="42" x2="84" y2="51" stroke="#60a5fa" stroke-width="1.5"/>
      <circle cx="78.5" cy="65" r="2.5" fill="#374151"/>
    ` + close;
    default: return open + `<circle cx="50" cy="50" r="46" fill="${c}" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>` + close;
  }
};

/* React component — renders equipment shape inline */
const EquipShape2D = ({ type, color, size, rotation = 0, cameraType = "dome" }) => (
  <div
    style={{ width: size, height: size, lineHeight: 0, flexShrink: 0, overflow: "hidden" }}
    dangerouslySetInnerHTML={{ __html: equipSVGStr(type, color, rotation, cameraType) }}
  />
);

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

/** Build SVG arc-sector path for coverage areas */
function makeSectorPath(cx, cy, radius, angle, rotation) {
  if (angle >= 360) {
    return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
  }
  const sa = (rotation - angle / 2) * Math.PI / 180;
  const ea = (rotation + angle / 2) * Math.PI / 180;
  const x1 = cx + radius * Math.cos(sa), y1 = cy + radius * Math.sin(sa);
  const x2 = cx + radius * Math.cos(ea), y2 = cy + radius * Math.sin(ea);
  const la = angle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${la} 1 ${x2} ${y2} Z`;
}

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
  const [cableType, setCableType] = useState("CAT6");
  const [snap, setSnap] = useState(false);
  const [nextNumbers, setNextNumbers] = useState({ camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
  const [pdfDialog, setPdfDialog] = useState(false);
  const [view3D, setView3D] = useState(false);
  const [calcModal, setCalcModal] = useState(false);
  const [calcHours, setCalcHours] = useState(24);
  const [calcDays, setCalcDays] = useState(30);
  const [toast, setToast] = useState(null);

  // Auth / Cloud
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [authModal, setAuthModal] = useState(false);
  const [plansModal, setPlansModal] = useState(false);
  const [projectsModal, setProjectsModal] = useState(false);
  const [cloudProjectId, setCloudProjectId] = useState(null); // current Supabase project id
  const [cloudSaving, setCloudSaving] = useState(false);

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

  const snapPos = (x, y) => snap ? { x: Math.round(x / 50) * 50, y: Math.round(y / 50) * 50 } : { x, y };

  const handleCanvasClick = (e) => {
    if (dragging) return;
    const raw = getPos(e); const { x, y } = snapPos(raw.x, raw.y);
    if (tool.startsWith("place:")) {
      const type = tool.split(":")[1]; const eq = EQUIPMENT.find(eq => eq.type === type); if (!eq) return;
      saveSnapshot(); const num = nextNumbers[type]; setNextNumbers(prev => ({ ...prev, [type]: prev[type] + 1 }));
      const camSpec = type === "camera" ? defaultCameraSpec() : null;
      const initAngle = camSpec ? camSpec.fovH : eq.angle;
      const initRadius = camSpec ? camSpec.doriDistances.detection / scale : eq.coverageRadius;
      const typeSpecs = type === "wifi" ? { wifiSpec: defaultWifiSpec() } : type === "switch" ? { switchSpec: defaultSwitchSpec() } : type === "router" ? { routerSpec: defaultRouterSpec() } : type === "nvr" ? { nvrSpec: defaultNvrSpec() } : {};
      const el = { id: `${type}-${Date.now()}`, type, label: `${eq.label} ${String(num).padStart(2, "0")}`, number: num, x, y, rotation: 0, angle: initAngle, radius: initRadius, visible: true, notes: "", customColor: null, size: "medium", iconVariant: 0, ...(camSpec ? { cameraSpec: camSpec } : {}), ...typeSpecs };
      setElements(prev => [...prev, el]); setSelectedId(el.id); return;
    }
    if (tool === "measure") { if (!measurePoints.length) setMeasurePoints([{ x, y }]); else { const p1 = measurePoints[0]; saveSnapshot(); setMeasureLines(prev => [...prev, { p1, p2: { x, y }, dist: Math.hypot(x - p1.x, y - p1.y) }]); setMeasurePoints([]); } return; }
    if (tool === "calibrate") { if (!calibratePoints.length) setCalibratePoints([{ x, y }]); else { const p1 = calibratePoints[0]; setCalibrateDialog({ pixelDist: Math.hypot(x - p1.x, y - p1.y), p1, p2: { x, y } }); setCalibrateMeters(""); setCalibratePoints([]); } return; }
    if (tool === "cable") { const hit = visibleElements.find(el => Math.hypot(x - el.x, y - el.y) < 20); if (!hit) return; if (!cableStart) setCableStart(hit.id); else if (hit.id !== cableStart) { saveSnapshot(); setConnections(prev => [...prev, { id: `c-${Date.now()}`, from: cableStart, to: hit.id, cableType }]); setCableStart(null); } return; }
    if (tool === "select") { let cm = null; measureLines.forEach((ml, i) => { const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; if (Math.hypot(x - mx, y - my) < 20 / zoom) cm = i; }); if (cm !== null) { setSelectedMeasure(cm); setSelectedId(null); return; } }
    setSelectedId(null); setSelectedMeasure(null);
  };

  const startDrag = (e, id) => { e.stopPropagation(); if (["measure", "calibrate", "cable"].includes(tool)) return; saveSnapshot(); setSelectedId(id); const p = getPos(e); const el = elements.find(el => el.id === id); setDragging({ id, ox: p.x - el.x, oy: p.y - el.y }); };
  const onMouseMove = (e) => { if (dragging) { const p = getPos(e); const { x, y } = snapPos(p.x - dragging.ox, p.y - dragging.oy); setElements(prev => prev.map(el => el.id === dragging.id ? { ...el, x, y } : el)); } if (panning) { setPan({ x: pan.x + e.clientX - panStart.x, y: pan.y + e.clientY - panStart.y }); setPanStart({ x: e.clientX, y: e.clientY }); } };
  const onMouseUp = () => { setDragging(null); setPanning(false); };
  const startPan = (e) => { if (tool === "pan" || e.button === 1) { e.preventDefault(); setPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); } };
  const handleWheel = (e) => { e.preventDefault(); const d = e.deltaY > 0 ? 0.9 : 1.1; const r = canvasRef.current.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const nz = Math.min(Math.max(zoom * d, 0.1), 5); setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz); };
  const fitToScreen = () => { if (!page.bgNatural.w || !containerRef.current) return; const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight; const fz = Math.min(cw / page.bgNatural.w, ch / page.bgNatural.h, 1) * 0.9; setZoom(fz); setPan({ x: (cw - page.bgNatural.w * fz) / 2, y: (ch - page.bgNatural.h * fz) / 2 }); };

  const showToast = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // Cloud save
  const cloudSave = async () => {
    if (!user) { setAuthModal(true); return; }
    setCloudSaving(true);
    const projectData = { projectName, pages, clientInfo, companyLogo, watermarkOpacity, scale, nextNumbers, version: "2.1" };
    const { data, error } = await saveProject(user.id, projectName, projectData, cloudProjectId);
    setCloudSaving(false);
    if (error) { showToast("Erro ao salvar na nuvem: " + error.message, "error"); return; }
    setCloudProjectId(data.id);
    showToast("Projeto salvo na nuvem!", "success");
  };

  // Cloud load
  const cloudLoad = async (id) => {
    const { data, error } = await loadProject(id);
    if (error || !data) { showToast("Erro ao carregar projeto.", "error"); return; }
    const d = data.data;
    setPages(d.pages || [makeBlankPage("page-1", "Pavimento 1")]);
    setCurrentPageId((d.pages || [])[0]?.id || "page-1");
    setProjectName(d.projectName || "Projeto");
    setClientInfo(d.clientInfo || { name: "", address: "", phone: "", email: "" });
    setCompanyLogo(d.companyLogo || null);
    setWatermarkOpacity(d.watermarkOpacity ?? 0.06);
    setScale(d.scale || 0.05);
    setNextNumbers(d.nextNumbers || { camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 });
    setUndoStack([]); setRedoStack([]); setSelectedId(null);
    setCloudProjectId(id);
    showToast(`Projeto "${d.projectName}" carregado!`, "success");
  };

  // Subscribe via Stripe
  const handleSubscribe = async (priceId) => {
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, userId: user.id, email: user.email }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e) {
      showToast("Erro ao iniciar checkout: " + e.message, "error");
    }
  };

  /* ─── CRUD ─── */
  const updateEl = (id, p) => { saveSnapshot(); setElements(prev => prev.map(el => el.id === id ? { ...el, ...p } : el)); };
  const deleteEl = (id) => { saveSnapshot(); setElements(prev => prev.filter(el => el.id !== id)); setConnections(prev => prev.filter(c => c.from !== id && c.to !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicateEl = (id) => { const el = elements.find(e => e.id === id); if (!el) return; saveSnapshot(); const eq = EQUIPMENT.find(eq => eq.type === el.type); const num = nextNumbers[el.type]; setNextNumbers(prev => ({ ...prev, [el.type]: prev[el.type] + 1 })); const cl = { ...el, id: `${el.type}-${Date.now()}`, x: el.x + 30, y: el.y + 30, number: num, label: `${eq.label} ${String(num).padStart(2, "0")}` }; setElements(prev => [...prev, cl]); setSelectedId(cl.id); };

  const updateCameraSpec = (id, updates) => {
    setElements(prev => prev.map(el => {
      if (el.id !== id || el.type !== "camera") return el;
      const cur = el.cameraSpec || defaultCameraSpec();
      let newSpec;
      if (updates.preset && updates.preset !== "custom") {
        const p = CAMERA_PRESETS[updates.preset];
        newSpec = { ...cur, ...p, preset: updates.preset };
      } else {
        newSpec = { ...cur, ...updates };
        if (Object.keys(updates).some(k => k !== "preset")) newSpec.preset = "custom";
      }
      const { fovH, distances } = calcAllDori(newSpec);
      newSpec.fovH = fovH;
      newSpec.doriDistances = distances;
      return { ...el, cameraSpec: newSpec, angle: fovH };
    }));
  };

  /* ─── keyboard ─── */
  useEffect(() => {
    const h = (e) => { if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return; if (e.key === "Delete") { if (selectedMeasure !== null) { saveSnapshot(); setMeasureLines(prev => prev.filter((_, i) => i !== selectedMeasure)); setSelectedMeasure(null); } else if (selectedId) deleteEl(selectedId); } if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); } if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); } if (e.key === "Escape") { setTool("select"); setMeasurePoints([]); setCalibratePoints([]); setCalibrateDialog(null); setCableStart(null); setSelectedId(null); setSelectedMeasure(null); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  useEffect(() => { const el = canvasRef.current; if (!el) return; const p = (e) => e.preventDefault(); el.addEventListener("wheel", p, { passive: false }); return () => el.removeEventListener("wheel", p); }, []);

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) getProfile(session.user.id).then(({ data }) => setProfile(data));
      setAuthLoaded(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) getProfile(session.user.id).then(({ data }) => setProfile(data));
      else { setProfile(null); setCloudProjectId(null); }
      setAuthLoaded(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ─── render to canvas ─── */
  const renderToCanvas = (pg) => new Promise(async (resolve) => {
    const c = document.createElement("canvas"); c.width = pg.bgNatural.w; c.height = pg.bgNatural.h; const ctx = c.getContext("2d");
    // Pre-load all equipment SVG icons
    const iconMap = {};
    await Promise.all(pg.elements.map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return Promise.resolve(); const col = el.customColor || eq.color; const ct = el.cameraType || "dome"; const key = `${el.type}|${col}|${el.rotation}|${ct}`; if (iconMap[key]) return Promise.resolve(); return new Promise(r => { const img = new window.Image(); img.onload = () => { iconMap[key] = img; r(); }; img.onerror = r; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(equipSVGStr(el.type, col, el.rotation, ct)); }); }));
    const draw = () => {
      pg.connections.forEach(cn => { const f = pg.elements.find(e => e.id === cn.from), t = pg.elements.find(e => e.id === cn.to); if (!f || !t) return; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); });
      pg.elements.forEach(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq || el.radius <= 0 || el.angle <= 0) return; const col = el.customColor || eq.color; ctx.save(); ctx.translate(el.x, el.y); ctx.rotate((el.rotation - el.angle / 2) * Math.PI / 180); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, el.radius, 0, el.angle * Math.PI / 180); ctx.closePath(); ctx.fillStyle = col + "45"; ctx.strokeStyle = col + "99"; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore(); });
      pg.elements.forEach(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return; const col = el.customColor || eq.color; const sz = SIZES[el.size || "medium"]; const ct = el.cameraType || "dome"; const key = `${el.type}|${col}|${el.rotation}|${ct}`; const icon = iconMap[key]; if (icon) ctx.drawImage(icon, el.x - sz / 2, el.y - sz / 2, sz, sz); ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#1a2332"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.strokeText(el.label, el.x + sz / 2 + 4, el.y + 4); ctx.fillText(el.label, el.x + sz / 2 + 4, el.y + 4); });
      pg.measureLines.forEach(ml => { ctx.beginPath(); ctx.moveTo(ml.p1.x, ml.p1.y); ctx.lineTo(ml.p2.x, ml.p2.y); ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]); const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; ctx.font = "bold 11px sans-serif"; ctx.fillStyle = "#92400e"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeText(`${(ml.dist * scale).toFixed(1)}m`, mx + 4, my - 5); ctx.fillText(`${(ml.dist * scale).toFixed(1)}m`, mx + 4, my - 5); });
      resolve(c);
    };
    if (pg.bgImage) { const img = new window.Image(); img.onload = () => { ctx.drawImage(img, 0, 0); draw(); }; img.src = pg.bgImage; } else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); draw(); }
  });

  const exportPNG = async () => { const c = await renderToCanvas(page); const a = document.createElement("a"); a.download = `${projectName} - ${page.name}.png`; a.href = c.toDataURL("image/png"); a.click(); showToast("PNG exportado com sucesso!", "success"); };

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

        // DORI legend (only if there are cameras with cameraSpec)
        const hasCams = pg.elements.some(e => e.type === "camera" && e.cameraSpec);
        if (hasCams) {
          const doriLegendY = ty + (pg.connections.length > 0 ? 13 : 8) + (pg.measureLines.length > 0 ? 5 + pg.measureLines.length * 4.5 + 10 : 0) + 10;
          if (doriLegendY < pH - 30) {
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(26, 35, 50);
            pdf.text("Zonas DORI", M + 2, doriLegendY);
            const doriInfo = [
              { zone: "detection", label: "Detection (≥25 PPM)", color: "#22c55e" },
              { zone: "observation", label: "Observation (≥62.5 PPM)", color: "#84cc16" },
              { zone: "recognition", label: "Recognition (≥125 PPM)", color: "#f59e0b" },
              { zone: "identification", label: "Identification (≥250 PPM)", color: "#ef4444" },
            ];
            doriInfo.forEach((d, i) => {
              const dx = M + 2 + (i % 2) * 88, dy = doriLegendY + 5 + Math.floor(i / 2) * 5.5;
              const [dr, dg, db] = hex2rgb(d.color);
              pdf.setFillColor(dr, dg, db); pdf.rect(dx, dy - 2.5, 4, 4, "F");
              pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(95, 107, 122);
              pdf.text(d.label, dx + 5.5, dy);
            });
          }
        }

        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(156, 163, 175);
        pdf.text(`${projectName}  ·  Legenda`, M, pH - 5);
      }
    }

    /* ── BOM PAGE ── */
    const allElements = pages.flatMap(p => p.elements);
    if (allElements.length > 0) {
      pdf.addPage("a4", "portrait");
      const bW = 210, bH = 297;
      pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, bW, bH, "F");
      pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, bW, 2.5, "F");

      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(26, 35, 50);
      pdf.text("Lista de Materiais (BOM)", M, 14);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(156, 163, 175);
      pdf.text(new Date().toLocaleDateString("pt-BR"), bW - M, 14, { align: "right" });
      pdf.setDrawColor(223, 227, 234); pdf.setLineWidth(0.3); pdf.line(M, 17, bW - M, 17);

      const bTW = bW - M * 2;
      const bColW = [bTW * 0.06, bTW * 0.14, bTW * 0.22, bTW * 0.38, bTW * 0.1, bTW * 0.1];
      const bColX = [M]; for (let i = 1; i < 6; i++) bColX.push(bColX[i - 1] + bColW[i - 1]);
      const bHeaders = ["#", "Tipo", "Marca / Modelo", "Especificações", "Qtd", "Pavimento"];

      let bty = 24; const browH = 6;
      const drawBomHeader = () => {
        pdf.setFillColor(240, 242, 245); pdf.rect(M, bty - 3.5, bTW, browH, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
        bHeaders.forEach((h, i) => pdf.text(h, bColX[i] + 1.5, bty));
        bty += browH;
      };
      drawBomHeader();

      // Group by type across all pages
      let lineNum = 1;
      EQUIPMENT.forEach(eq => {
        const items = allElements.filter(e => e.type === eq.type);
        if (!items.length) return;

        items.forEach((el, idx) => {
          if (bty + browH > bH - M - 10) {
            pdf.addPage("a4", "portrait");
            pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, bW, bH, "F");
            pdf.setFillColor(37, 99, 235); pdf.rect(0, 0, bW, 2.5, "F");
            bty = 12; drawBomHeader();
          }

          if (lineNum % 2 === 0) { pdf.setFillColor(248, 249, 251); pdf.rect(M, bty - 3.5, bTW, browH, "F"); }

          const [cr, cg, cb] = hex2rgb(el.customColor || eq.color);
          pdf.setFillColor(cr, cg, cb); pdf.circle(bColX[0] + 2.5, bty - 0.8, 1.5, "F");
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(26, 35, 50);
          pdf.text(String(lineNum), bColX[0] + 5, bty);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
          pdf.text(eq.label, bColX[1] + 1.5, bty);

          // Brand/Model
          let brandModel = "";
          if (el.type === "camera" && el.cameraSpec) brandModel = [el.cameraSpec.brand, el.cameraSpec.model].filter(Boolean).join(" ") || "—";
          else if (el.type === "wifi" && el.wifiSpec) brandModel = [el.wifiSpec.brand, el.wifiSpec.model].filter(Boolean).join(" ") || "—";
          else if (el.type === "switch" && el.switchSpec) brandModel = [el.switchSpec.brand, el.switchSpec.model].filter(Boolean).join(" ") || "—";
          else if (el.type === "router" && el.routerSpec) brandModel = [el.routerSpec.brand, el.routerSpec.model].filter(Boolean).join(" ") || "—";
          else if (el.type === "nvr" && el.nvrSpec) brandModel = [el.nvrSpec.brand, el.nvrSpec.model].filter(Boolean).join(" ") || "—";
          else brandModel = el.label;
          pdf.text(brandModel.substring(0, 28), bColX[2] + 1.5, bty);

          // Specs summary
          let specSummary = "";
          if (el.type === "camera" && el.cameraSpec) { const s = el.cameraSpec; specSummary = `${s.resolutionH}×${s.resolutionV} · ${s.focalLength}mm · ${s.codec}`; }
          else if (el.type === "wifi" && el.wifiSpec) { const s = el.wifiSpec; specSummary = `${s.standard} · ${s.frequency} · ${s.maxClients} cli.`; }
          else if (el.type === "switch" && el.switchSpec) { const s = el.switchSpec; specSummary = `${s.ports}p ${s.speed}${s.poe ? " PoE" : ""}${s.managed ? " Mgd" : ""}`; }
          else if (el.type === "router" && el.routerSpec) { const s = el.routerSpec; specSummary = `${s.wanType} · ${s.wanSpeed} · ${s.lanPorts} LAN`; }
          else if (el.type === "nvr" && el.nvrSpec) { const s = el.nvrSpec; specSummary = `${s.channels}ch · ${s.maxResolution} · ${s.storage}`; }
          pdf.text(specSummary.substring(0, 44), bColX[3] + 1.5, bty);

          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(26, 35, 50);
          pdf.text("1", bColX[4] + 1.5, bty);

          // Page name
          const pgName = pages.find(pg => pg.elements.some(e => e.id === el.id))?.name || "";
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(95, 107, 122);
          pdf.text(pgName.substring(0, 14), bColX[5] + 1.5, bty);

          pdf.setDrawColor(237, 240, 244); pdf.setLineWidth(0.15); pdf.line(M, bty + 2, M + bTW, bty + 2);
          bty += browH; lineNum++;
        });
      });

      // Totals
      bty += 3;
      pdf.setDrawColor(37, 99, 235); pdf.setLineWidth(0.4); pdf.line(M, bty - 2, M + bTW, bty - 2);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(37, 99, 235);
      pdf.text(`Total: ${allElements.length} item(s)`, M + 2, bty + 2);

      // Cable summary
      const allConns = pages.flatMap(p => p.connections);
      if (allConns.length > 0) {
        bty += 12;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(26, 35, 50);
        pdf.text("Cabeamento", M + 2, bty);
        bty += 5;
        const cableGroups = {};
        allConns.forEach(cn => { const t = cn.cableType || "CAT6"; cableGroups[t] = (cableGroups[t] || 0) + 1; });
        Object.entries(cableGroups).forEach(([type, count]) => {
          const cbl = CABLE_TYPES.find(c => c.id === type);
          const [cr, cg, cb] = hex2rgb(cbl?.color || "#64748b");
          pdf.setFillColor(cr, cg, cb); pdf.rect(M + 2, bty - 2.5, 3, 3, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(95, 107, 122);
          pdf.text(`${type}: ${count} ponto(s)`, M + 7, bty);
          bty += 4.5;
        });
      }
    }

    pdf.save(`${projectName}.pdf`);
    setPdfDialog(false);
  };

  /* ─── save/load ─── */
  const saveProject = () => { const d = { projectName, pages, clientInfo, companyLogo, watermarkOpacity, scale, nextNumbers, version: "2.1" }; const b = new Blob([JSON.stringify(d)], { type: "application/json" }); const a = document.createElement("a"); a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}.json`; a.href = URL.createObjectURL(b); a.click(); URL.revokeObjectURL(a.href); };
  const loadProject = () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); setPages(d.pages || [makeBlankPage("page-1", "Pavimento 1")]); setCurrentPageId((d.pages || [])[0]?.id || "page-1"); setProjectName(d.projectName || "Projeto"); setClientInfo(d.clientInfo || { name: "", address: "", phone: "", email: "" }); setCompanyLogo(d.companyLogo || null); setWatermarkOpacity(d.watermarkOpacity ?? 0.06); setScale(d.scale || 0.05); setNextNumbers(d.nextNumbers || { camera: 1, wifi: 1, switch: 1, router: 1, nvr: 1 }); setUndoStack([]); setRedoStack([]); setSelectedId(null); } catch { showToast("Erro ao carregar o arquivo. Verifique se é um projeto NetPlanner válido.", "error"); } }; i.click(); };

  const exportHTML = () => {
    const html = generateViewerHTML(projectName, pages, clientInfo, scale, companyLogo);
    const b = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}_3D.html`;
    a.href = URL.createObjectURL(b);
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Visualizador 3D exportado com sucesso!", "success");
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
              Escala: 1px = <input type="number" value={scale} onChange={e => setScale(Math.max(0.001, parseFloat(e.target.value) || 0.05))} step="0.01" min="0.001" style={{ width: "52px", padding: "3px 5px", borderRadius: "5px", border: `1px solid ${T.border}`, background: T.white, color: T.text, fontSize: "10px", textAlign: "center" }} /> m
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
            {connections.length > 0 && (<><div style={{ ...secT, marginTop: "14px" }}>Cabeamento</div>
              {Object.entries(connections.reduce((acc, cn) => { const t = cn.cableType || "CAT6"; acc[t] = (acc[t] || 0) + 1; return acc; }, {})).map(([type, count]) => {
                const cbl = CABLE_TYPES.find(c => c.id === type) || CABLE_TYPES[1];
                return (<div key={type} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 5px", fontSize: "10px", color: T.textMuted }}><div style={{ width: "20px", height: "3px", background: cbl.color, borderRadius: "2px", flexShrink: 0 }} /><span style={{ flex: 1 }}>{type}</span><span style={{ fontWeight: 700, color: T.text }}>{count}×</span></div>);
              })}
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
        <div style={{ background: T.toolbar, borderBottom: `1px solid ${T.border}`, padding: "5px 14px", display: "flex", alignItems: "center", gap: "4px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", minHeight: "38px" }}>
          {/* LEFT — tool buttons (can overflow-scroll) */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, overflow: "hidden", minWidth: 0 }}>
            {editingName ? <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => e.key === "Enter" && setEditingName(false)} style={{ background: T.card, border: `1.5px solid ${T.accent}`, borderRadius: "5px", padding: "3px 8px", color: T.text, fontSize: "12px", fontWeight: 600, width: "140px" }} />
            : <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, fontSize: "12px", fontWeight: 700, marginRight: "4px", whiteSpace: "nowrap" }}>{projectName}</button>}
            <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px", flexShrink: 0 }} />
            <button onClick={() => fileRef.current?.click()} style={btnS()}><Upload size={13} /> Planta</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <button onClick={saveProject} style={btnS()} title="Salvar local (JSON)"><Save size={13} /></button>
            <button onClick={loadProject} style={btnS()} title="Abrir local (JSON)"><FolderOpen size={13} /></button>
            {user && (
              <button onClick={cloudSave} style={{ ...btnS(), color: cloudSaving ? T.textDim : "#059669", background: T.white, border: `1px solid #d1fae5` }} title="Salvar na nuvem">
                <Cloud size={13} /> {cloudSaving ? "..." : "Salvar"}
              </button>
            )}
            {user && (
              <button onClick={() => setProjectsModal(true)} style={{ ...btnS(), color: T.accent, background: T.white, border: `1px solid ${T.accentLight}` }} title="Projetos na nuvem">
                <Cloud size={13} /> Projetos
              </button>
            )}
            <button onClick={exportPNG} style={btnS()} disabled={!page.bgImage}><Download size={13} /> PNG</button>
            <button onClick={() => setPdfDialog(true)} style={{ ...btnS(), background: pages.some(p => p.bgImage) ? T.accent : "transparent", color: pages.some(p => p.bgImage) ? "#fff" : T.textDim, borderRadius: "7px" }} disabled={!pages.some(p => p.bgImage)}><FileText size={13} /> PDF</button>
            <button onClick={exportHTML} style={btnS()} title="Exportar visualizador 3D (HTML standalone)"><Box size={13} /> HTML 3D</button>
            <button onClick={() => setCalcModal(true)} style={{ ...btnS(), color: T.success }} title="Calculadora de Bandwidth e Storage">BW/Stor</button>
            <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px", flexShrink: 0 }} />
            <button onClick={() => setView3D(v => !v)} style={{ ...btnS(view3D), background: view3D ? "#0f172a" : "transparent", color: view3D ? "#60a5fa" : T.textMuted, border: view3D ? "1.5px solid #1e3a5f" : "none" }} title={view3D ? "Voltar ao 2D" : "Visualizar em 3D"}><Box size={13} /> {view3D ? "2D" : "3D"}</button>
            <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px", flexShrink: 0 }} />
            <button onClick={() => { setTool("select"); setCableStart(null); }} style={btnS(tool === "select")}><MousePointer size={13} /></button>
            <button onClick={() => setTool("pan")} style={btnS(tool === "pan")}><Move size={13} /></button>
            <button onClick={() => { setTool("measure"); setMeasurePoints([]); }} style={btnS(tool === "measure")}><Ruler size={13} /></button>
            <button onClick={() => setSnap(s => !s)} style={{ ...btnS(snap), background: snap ? "#f0fdf4" : "transparent", color: snap ? "#059669" : T.textMuted, border: snap ? "1.5px solid #059669" : "none" }} title="Snap ao grid (50px)"><Grid3X3 size={13} /></button>
            <div style={{ width: "1px", height: "20px", background: T.border, margin: "0 3px", flexShrink: 0 }} />
            <button onClick={undo} style={btnS()} disabled={!undoStack.length}><Undo2 size={13} /></button>
            <button onClick={redo} style={btnS()} disabled={!redoStack.length}><Redo2 size={13} /></button>
          </div>
          {/* RIGHT — auth + page name + zoom (always visible) */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "6px" }}>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", background: T.card, borderRadius: "8px", padding: "3px 8px" }}>
                <User size={12} color={T.textMuted} />
                <span style={{ fontSize: "10px", color: T.textMuted, maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email?.split("@")[0]}
                </span>
                <span style={{ fontSize: "9px", fontWeight: 700, color: (profile?.plan && profile.plan !== "free") ? "#7c3aed" : T.textDim, background: (profile?.plan && profile.plan !== "free") ? "#ede9fe" : T.borderLight, padding: "1px 5px", borderRadius: "3px" }}>
                  {PLAN_LIMITS[profile?.plan || "free"]?.label}
                </span>
                <button onClick={() => setPlansModal(true)} title="Planos" style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", display: "flex", padding: "1px" }}><Star size={11} /></button>
                <button onClick={() => signOut()} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, display: "flex", padding: "1px" }}><LogOut size={11} /></button>
              </div>
            ) : (
              <button onClick={() => setAuthModal(true)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer", background: T.accent, color: "#fff", fontSize: "11px", fontWeight: 600, boxShadow: "0 1px 6px rgba(37,99,235,0.3)", whiteSpace: "nowrap" }}>
                <LogIn size={12} /> Entrar
              </button>
            )}
            <span style={{ fontSize: "10px", color: T.textDim, fontWeight: 500, whiteSpace: "nowrap" }}>{page.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", background: T.card, borderRadius: "6px", padding: "3px 6px" }}>
              <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Minus size={12} /></button>
              <span style={{ fontSize: "10px", color: T.textMuted, minWidth: "36px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Plus size={12} /></button>
              <button onClick={fitToScreen} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}><Maximize2 size={12} /></button>
            </div>
          </div>
        </div>

        {tool !== "select" && !view3D && (
          <div style={{ padding: "5px 14px", fontSize: "11px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: "5px", background: tool === "measure" || tool === "calibrate" ? "#fffbeb" : tool === "cable" ? "#f0f9ff" : T.accentLight, color: tool === "measure" || tool === "calibrate" ? "#92400e" : tool === "cable" ? "#0369a1" : T.accent }}>
            {tool.startsWith("place:") && <><Plus size={11} /> Clique na planta para posicionar. Esc cancela.</>}
            {tool === "measure" && <><Ruler size={11} /> {!measurePoints.length ? "Clique no ponto inicial." : "Clique no ponto final."}</>}
            {tool === "calibrate" && <><Ruler size={11} /> {!calibratePoints.length ? "Clique no início de medida conhecida." : "Clique no ponto final."}</>}
            {tool === "cable" && <><Link2 size={11} /> {!cableStart ? "Clique no equipamento de origem." : "Clique no destino."} <select value={cableType} onChange={e => setCableType(e.target.value)} style={{ marginLeft: "8px", padding: "2px 6px", borderRadius: "5px", border: `1px solid #bae6fd`, background: "#fff", fontSize: "10px", color: "#0369a1", cursor: "pointer" }}>{CABLE_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: CABLE_TYPES.find(c => c.id === cableType)?.color || "#64748b", display: "inline-block", marginLeft: "4px" }} /></>}
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
                  {showCables && connections.map(cn => { const f = elements.find(e => e.id === cn.from), t = elements.find(e => e.id === cn.to); if (!f || !t) return null; const cbl = CABLE_TYPES.find(c => c.id === (cn.cableType || "CAT6")) || CABLE_TYPES[1]; return (<g key={cn.id} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); saveSnapshot(); setConnections(prev => prev.filter(c => c.id !== cn.id)); }}><line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={10 / zoom} /><line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke={cbl.color} strokeWidth={1.5 / zoom} strokeDasharray={`${7 / zoom} ${4 / zoom}`} /><circle cx={(f.x + t.x) / 2} cy={(f.y + t.y) / 2} r={2.5 / zoom} fill={cbl.color} /></g>); })}
                  {showCoverage && visibleElements.filter(e => e.radius > 0 && e.angle > 0).map(el => {
                    const eq = EQUIPMENT.find(e => e.type === el.type);
                    const c = el.customColor || eq.color;
                    if (el.type === "camera" && el.cameraSpec?.doriDistances) {
                      const fov = el.cameraSpec.fovH || el.angle;
                      const dists = el.cameraSpec.doriDistances;
                      const detDist = dists.detection;
                      return (
                        <g key={`c-${el.id}`}>
                          {DORI_ZONES.map(zone => {
                            // Scale proportionally: detection zone = el.radius pixels
                            const r = el.radius * (dists[zone] / detDist);
                            if (!r || r <= 0) return null;
                            return <path key={zone} d={makeSectorPath(el.x, el.y, r, fov, el.rotation)} fill={DORI_COLORS[zone]} fillOpacity={DORI_OPACITIES[zone]} stroke={DORI_COLORS[zone]} strokeOpacity={0.65} strokeWidth={1.5 / zoom} />;
                          })}
                        </g>
                      );
                    }
                    return <path key={`c-${el.id}`} d={makeSectorPath(el.x, el.y, el.radius, el.angle, el.rotation)} fill={c + "40"} stroke={c + "99"} strokeWidth={1.5 / zoom} />;
                  })}
                  {measureLines.map((ml, i) => { const mx = (ml.p1.x + ml.p2.x) / 2, my = (ml.p1.y + ml.p2.y) / 2; const s = selectedMeasure === i; return (<g key={`m-${i}`} style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedMeasure(i); setSelectedId(null); }}><line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke="transparent" strokeWidth={12 / zoom} /><line x1={ml.p1.x} y1={ml.p1.y} x2={ml.p2.x} y2={ml.p2.y} stroke={s ? "#d97706" : "#f59e0b"} strokeWidth={(s ? 2.5 : 1.5) / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} /><circle cx={ml.p1.x} cy={ml.p1.y} r={(s ? 4.5 : 3.5) / zoom} fill={s ? "#d97706" : "#f59e0b"} stroke="#fff" strokeWidth={1.5 / zoom} /><circle cx={ml.p2.x} cy={ml.p2.y} r={(s ? 4.5 : 3.5) / zoom} fill={s ? "#d97706" : "#f59e0b"} stroke="#fff" strokeWidth={1.5 / zoom} /><rect x={mx - 22 / zoom} y={my - 15 / zoom} width={44 / zoom} height={16 / zoom} rx={4 / zoom} fill="#fff" stroke="#e5e7eb" strokeWidth={.5 / zoom} /><text x={mx} y={my - 4 / zoom} textAnchor="middle" fill="#92400e" fontSize={10 / zoom} fontWeight="bold">{(ml.dist * scale).toFixed(1)}m</text></g>); })}
                  {measurePoints.length === 1 && <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={5 / zoom} fill="#f59e0b" stroke="#fff" strokeWidth={2 / zoom} />}
                  {calibratePoints.length === 1 && <circle cx={calibratePoints[0].x} cy={calibratePoints[0].y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} />}
                  {calibrateDialog && <><line x1={calibrateDialog.p1.x} y1={calibrateDialog.p1.y} x2={calibrateDialog.p2.x} y2={calibrateDialog.p2.y} stroke="#ea580c" strokeWidth={2.5 / zoom} strokeDasharray={`${7 / zoom} ${4 / zoom}`} /><circle cx={calibrateDialog.p1.x} cy={calibrateDialog.p1.y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} /><circle cx={calibrateDialog.p2.x} cy={calibrateDialog.p2.y} r={6 / zoom} fill="#ea580c" stroke="#fff" strokeWidth={2 / zoom} /></>}
                </svg>
                {visibleElements.map(el => { const eq = EQUIPMENT.find(e => e.type === el.type); if (!eq) return null; const isSel = selectedId === el.id; const isCbl = cableStart === el.id; const col = el.customColor || eq.color; const sz = SIZES[el.size || "medium"]; const isRound = el.type === "camera" || el.type === "wifi"; return (
                  <div key={el.id} onMouseDown={(e) => startDrag(e, el.id)} onClick={(e) => { e.stopPropagation(); if (tool === "cable") handleCanvasClick(e); else { setSelectedId(el.id); setSelectedMeasure(null); } }} style={{ position: "absolute", left: el.x - sz / 2, top: el.y - sz / 2, width: sz, height: sz, cursor: tool === "cable" ? "cell" : "pointer", zIndex: isSel ? 100 : 10, filter: isSel ? `drop-shadow(0 0 6px ${col})` : `drop-shadow(0 2px 4px rgba(0,0,0,0.35))` }}>
                    {(isSel || isCbl) && <div style={{ position: "absolute", inset: -6, borderRadius: isRound ? "50%" : "10px", border: `2.5px solid ${isCbl ? T.success : col}`, opacity: .65, animation: "pulse 1.5s infinite", pointerEvents: "none" }} />}
                    <EquipShape2D type={el.type} color={col} size={sz} rotation={el.rotation} cameraType={el.cameraType || "dome"} />
                    <div style={{ position: "absolute", left: "50%", top: sz + 4 + "px", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: Math.max(9, 10 / Math.sqrt(zoom)), fontWeight: 700, color: T.text, textShadow: "0 0 4px #fff, 0 0 8px #fff, 0 1px 2px rgba(0,0,0,.15)", pointerEvents: "none" }}>{el.label}</div>
                  </div>); })}
              </div>
            </div>
          )}
          {/* Scale bar */}
          {page.bgImage && (() => {
            const roundMeters = [1, 2, 5, 10, 20, 50, 100, 200, 500];
            const barM = roundMeters.find(m => (m / scale) * zoom > 60) || roundMeters[roundMeters.length - 1];
            const barPx = Math.round((barM / scale) * zoom);
            return (
              <div style={{ position: "absolute", bottom: "12px", left: "14px", zIndex: 50, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#1a2332", background: "rgba(255,255,255,0.75)", padding: "0 3px", borderRadius: "3px" }}>{barM}m</span>
                <svg width={barPx + 4} height="10" style={{ overflow: "visible", display: "block" }}>
                  <rect x="2" y="3" width={barPx} height="5" fill="rgba(255,255,255,0.7)" stroke="#1a2332" strokeWidth="1.5" />
                  <rect x="2" y="3" width={barPx / 2} height="5" fill="#1a2332" />
                </svg>
              </div>
            );
          })()}
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
            <div><label style={lblS}>Alcance (px)</label><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><input type="number" value={sel.radius} onChange={e => updateEl(sel.id, { radius: Math.max(0, +e.target.value || 0) })} style={{ ...inpS, flex: 1 }} /><input type="range" value={sel.radius} onChange={e => updateEl(sel.id, { radius: +e.target.value })} min={0} max={600} style={{ flex: 2, accentColor: sel.customColor || selEq.color }} /></div>{sel.radius > 0 && <div style={{ fontSize: "9px", color: T.textDim, marginTop: "2px" }}>≈ {(sel.radius * scale).toFixed(1)}m</div>}</div>
            <div><label style={lblS}>Cor</label><div style={{ display: "flex", gap: "5px", alignItems: "center" }}><input type="color" value={sel.customColor || selEq.color} onChange={e => updateEl(sel.id, { customColor: e.target.value })} style={{ width: "30px", height: "28px", border: `1px solid ${T.border}`, borderRadius: "5px", cursor: "pointer", padding: "2px" }} /><span style={{ fontSize: "10px", color: T.textDim, flex: 1 }}>{sel.customColor || "Padrão"}</span>{sel.customColor && <button onClick={() => updateEl(sel.id, { customColor: null })} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: "10px" }}>Reset</button>}</div></div>
            <div><label style={lblS}>Tamanho</label><div style={{ display: "flex", gap: "3px" }}>{["small", "medium", "large"].map(s => <button key={s} onClick={() => updateEl(sel.id, { size: s })} style={{ flex: 1, padding: "4px", borderRadius: "5px", border: `1px solid ${T.borderLight}`, cursor: "pointer", fontSize: "10px", fontWeight: 600, background: (sel.size || "medium") === s ? T.accentLight : T.white, color: (sel.size || "medium") === s ? T.accent : T.textDim }}>{s === "small" ? "P" : s === "medium" ? "M" : "G"}</button>)}</div></div>
            {sel.type === "camera" && (
              <div><label style={lblS}>Tipo de Câmera</label><div style={{ display: "flex", gap: "3px" }}>{[["dome","Dome"],["bullet","Bullet"],["ptz","PTZ"],["box","Box"]].map(([v,l]) => <button key={v} onClick={() => updateEl(sel.id, { cameraType: v })} style={{ flex: 1, padding: "4px 2px", borderRadius: "5px", border: `1px solid ${T.borderLight}`, cursor: "pointer", fontSize: "9px", fontWeight: 600, background: (sel.cameraType || "dome") === v ? T.accentLight : T.white, color: (sel.cameraType || "dome") === v ? T.accent : T.textDim }}>{l}</button>)}</div></div>
            )}
            <div><label style={lblS}>Observações</label><textarea value={sel.notes || ""} onChange={e => updateEl(sel.id, { notes: e.target.value })} placeholder="Modelo, specs..." rows={2} style={{ ...inpS, resize: "vertical", fontFamily: "inherit" }} /></div>

            {/* ─── Camera Technical Spec (DORI) ─── */}
            {sel.type === "camera" && (() => {
              const spec = sel.cameraSpec || defaultCameraSpec();
              return (
                <div style={{ background: T.card, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}` }}>
                  <div style={{ ...secT, marginBottom: "8px", color: T.accent }}>Especificações / DORI</div>
                  {/* Preset */}
                  <div style={{ marginBottom: "6px" }}>
                    <label style={lblS}>Preset</label>
                    <select value={spec.preset || "custom"} onChange={e => updateCameraSpec(sel.id, { preset: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>
                      {PRESET_GROUPS.map(g => (
                        <optgroup key={g.label} label={g.label}>
                          {g.keys.map(k => <option key={k} value={k}>{CAMERA_PRESETS[k]?.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {/* Resolution */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Resolução H</label><input type="number" value={spec.resolutionH} onChange={e => updateCameraSpec(sel.id, { resolutionH: +e.target.value || 1920 })} style={inpS} /></div>
                    <div><label style={lblS}>Resolução V</label><input type="number" value={spec.resolutionV} onChange={e => updateCameraSpec(sel.id, { resolutionV: +e.target.value || 1080 })} style={inpS} /></div>
                  </div>
                  {/* Lens */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Focal (mm)</label><input type="number" step="0.1" value={spec.focalLength} onChange={e => updateCameraSpec(sel.id, { focalLength: +e.target.value || 2.8 })} style={inpS} /></div>
                    <div><label style={lblS}>Sensor (mm)</label><input type="number" step="0.1" value={spec.sensorWidth} onChange={e => updateCameraSpec(sel.id, { sensorWidth: +e.target.value || 6.4 })} style={inpS} /></div>
                  </div>
                  {/* FoV calculated */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 7px", background: T.accentLight, borderRadius: "5px", marginBottom: "7px" }}>
                    <span style={{ fontSize: "10px", color: T.textMuted, fontWeight: 600 }}>FoV H calculado</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: T.accent }}>{(spec.fovH || 0).toFixed(1)}°</span>
                  </div>
                  {/* DORI table */}
                  <div style={{ fontSize: "9px", fontWeight: 700, color: T.textDim, marginBottom: "4px", letterSpacing: "0.5px" }}>DISTÂNCIAS DORI</div>
                  {DORI_ZONES.map(zone => (
                    <div key={zone} style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: DORI_COLORS[zone], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: "10px", color: T.textMuted }}>{DORI_LABELS[zone]}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: T.text }}>{spec.doriDistances?.[zone] ? spec.doriDistances[zone].toFixed(1) + "m" : "—"}</span>
                    </div>
                  ))}
                  {/* FPS / Bitrate / Codec */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", marginTop: "8px" }}>
                    <div><label style={lblS}>FPS</label><input type="number" value={spec.fps} onChange={e => updateCameraSpec(sel.id, { fps: +e.target.value || 15 })} style={inpS} /></div>
                    <div><label style={lblS}>Bitrate(k)</label><input type="number" value={spec.bitrate} onChange={e => updateCameraSpec(sel.id, { bitrate: +e.target.value || 2048 })} style={inpS} /></div>
                    <div><label style={lblS}>Codec</label>
                      <select value={spec.codec} onChange={e => updateCameraSpec(sel.id, { codec: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>
                        {["H.265", "H.264", "MJPEG"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── WiFi Spec ─── */}
            {sel.type === "wifi" && (() => {
              const spec = sel.wifiSpec || defaultWifiSpec();
              const upd = (p) => setElements(prev => prev.map(el => el.id === sel.id ? { ...el, wifiSpec: { ...(el.wifiSpec || defaultWifiSpec()), ...p } } : el));
              return (
                <div style={{ background: T.card, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}` }}>
                  <div style={{ ...secT, marginBottom: "8px", color: "#2563eb" }}>Especificações Wi-Fi</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Padrão</label><select value={spec.standard} onChange={e => upd({ standard: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{["Wi-Fi 4","Wi-Fi 5","Wi-Fi 6","Wi-Fi 6E"].map(v => <option key={v}>{v}</option>)}</select></div>
                    <div><label style={lblS}>Frequência</label><select value={spec.frequency} onChange={e => upd({ frequency: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{["2.4GHz","5GHz","2.4+5","2.4+5+6"].map(v => <option key={v}>{v}</option>)}</select></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Clientes máx.</label><input type="number" value={spec.maxClients} onChange={e => upd({ maxClients: +e.target.value || 1 })} style={inpS} /></div>
                    <div><label style={lblS}>Potência TX (dBm)</label><input type="number" value={spec.txPower} onChange={e => upd({ txPower: +e.target.value || 0 })} style={inpS} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                    <div><label style={lblS}>Marca</label><input value={spec.brand} onChange={e => upd({ brand: e.target.value })} placeholder="Ex: Ubiquiti" style={inpS} /></div>
                    <div><label style={lblS}>Modelo</label><input value={spec.model} onChange={e => upd({ model: e.target.value })} placeholder="Ex: U6-Pro" style={inpS} /></div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Switch Spec ─── */}
            {sel.type === "switch" && (() => {
              const spec = sel.switchSpec || defaultSwitchSpec();
              const upd = (p) => setElements(prev => prev.map(el => el.id === sel.id ? { ...el, switchSpec: { ...(el.switchSpec || defaultSwitchSpec()), ...p } } : el));
              return (
                <div style={{ background: T.card, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}` }}>
                  <div style={{ ...secT, marginBottom: "8px", color: "#d97706" }}>Especificações Switch</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Portas</label><select value={spec.ports} onChange={e => upd({ ports: +e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{[8,16,24,48].map(v => <option key={v}>{v}</option>)}</select></div>
                    <div><label style={lblS}>Velocidade</label><select value={spec.speed} onChange={e => upd({ speed: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{["100M","1G","2.5G","10G"].map(v => <option key={v}>{v}</option>)}</select></div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "5px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.textMuted, cursor: "pointer" }}><input type="checkbox" checked={spec.poe} onChange={e => upd({ poe: e.target.checked })} /> PoE</label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.textMuted, cursor: "pointer" }}><input type="checkbox" checked={spec.managed} onChange={e => upd({ managed: e.target.checked })} /> Gerenciável</label>
                  </div>
                  {spec.poe && <div style={{ marginBottom: "5px" }}><label style={lblS}>Budget PoE (W)</label><input type="number" value={spec.poeBudget} onChange={e => upd({ poeBudget: +e.target.value || 0 })} style={inpS} /></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                    <div><label style={lblS}>Marca</label><input value={spec.brand} onChange={e => upd({ brand: e.target.value })} placeholder="Ex: Cisco" style={inpS} /></div>
                    <div><label style={lblS}>Modelo</label><input value={spec.model} onChange={e => upd({ model: e.target.value })} placeholder="Ex: SG350-16" style={inpS} /></div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Router Spec ─── */}
            {sel.type === "router" && (() => {
              const spec = sel.routerSpec || defaultRouterSpec();
              const upd = (p) => setElements(prev => prev.map(el => el.id === sel.id ? { ...el, routerSpec: { ...(el.routerSpec || defaultRouterSpec()), ...p } } : el));
              return (
                <div style={{ background: T.card, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}` }}>
                  <div style={{ ...secT, marginBottom: "8px", color: "#7c3aed" }}>Especificações Roteador</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Tipo WAN</label><select value={spec.wanType} onChange={e => upd({ wanType: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{["Fibra","ADSL","Cable","4G","5G","SD-WAN"].map(v => <option key={v}>{v}</option>)}</select></div>
                    <div><label style={lblS}>Velocidade WAN</label><input value={spec.wanSpeed} onChange={e => upd({ wanSpeed: e.target.value })} placeholder="Ex: 500/500 Mbps" style={inpS} /></div>
                  </div>
                  <div style={{ marginBottom: "5px" }}><label style={lblS}>Portas LAN</label><input type="number" value={spec.lanPorts} onChange={e => upd({ lanPorts: +e.target.value || 1 })} style={inpS} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                    <div><label style={lblS}>Marca</label><input value={spec.brand} onChange={e => upd({ brand: e.target.value })} placeholder="Ex: MikroTik" style={inpS} /></div>
                    <div><label style={lblS}>Modelo</label><input value={spec.model} onChange={e => upd({ model: e.target.value })} placeholder="Ex: RB4011" style={inpS} /></div>
                  </div>
                </div>
              );
            })()}

            {/* ─── NVR Spec ─── */}
            {sel.type === "nvr" && (() => {
              const spec = sel.nvrSpec || defaultNvrSpec();
              const upd = (p) => setElements(prev => prev.map(el => el.id === sel.id ? { ...el, nvrSpec: { ...(el.nvrSpec || defaultNvrSpec()), ...p } } : el));
              return (
                <div style={{ background: T.card, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}` }}>
                  <div style={{ ...secT, marginBottom: "8px", color: "#059669" }}>Especificações NVR/DVR</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Canais</label><select value={spec.channels} onChange={e => upd({ channels: +e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{[4,8,16,32,64].map(v => <option key={v}>{v}</option>)}</select></div>
                    <div><label style={lblS}>Resolução máx.</label><select value={spec.maxResolution} onChange={e => upd({ maxResolution: e.target.value })} style={{ ...inpS, cursor: "pointer" }}>{["1080p","4MP","4K","8MP"].map(v => <option key={v}>{v}</option>)}</select></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginBottom: "5px" }}>
                    <div><label style={lblS}>Storage</label><input value={spec.storage} onChange={e => upd({ storage: e.target.value })} placeholder="Ex: 4×4TB" style={inpS} /></div>
                    <div><label style={lblS}>Canais PoE</label><input type="number" value={spec.poeChannels} onChange={e => upd({ poeChannels: +e.target.value || 0 })} style={inpS} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                    <div><label style={lblS}>Marca</label><input value={spec.brand} onChange={e => upd({ brand: e.target.value })} placeholder="Ex: Intelbras" style={inpS} /></div>
                    <div><label style={lblS}>Modelo</label><input value={spec.model} onChange={e => upd({ model: e.target.value })} placeholder="Ex: MHDX 1116" style={inpS} /></div>
                  </div>
                </div>
              );
            })()}

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

      {/* ═══ CALCULATOR MODAL ═══ */}
      {calcModal && (() => {
        const cams = pages.flatMap(p => p.elements).filter(e => e.type === "camera" && e.cameraSpec);
        const totalBW = cams.reduce((s, e) => s + (e.cameraSpec.bitrate * (e.cameraSpec.fps / 15)) / 1000, 0);
        const storages = cams.map(e => ({ label: e.label, gb: calcStorage(e.cameraSpec.bitrate, e.cameraSpec.fps, calcHours, calcDays) }));
        const totalGB = storages.reduce((s, x) => s + x.gb, 0);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: T.white, borderRadius: "12px", padding: "22px", width: "420px", boxShadow: T.shadowMd, maxHeight: "82vh", overflow: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>Calculadora Bandwidth & Storage</div>
                <button onClick={() => setCalcModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}><X size={16} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                <div><label style={lblS}>Gravação (h/dia)</label><input type="number" value={calcHours} onChange={e => setCalcHours(+e.target.value || 24)} min={1} max={24} style={inpS} /></div>
                <div><label style={lblS}>Retenção (dias)</label><input type="number" value={calcDays} onChange={e => setCalcDays(+e.target.value || 30)} min={1} style={inpS} /></div>
              </div>
              {cams.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: T.textMuted, fontSize: "12px", background: T.card, borderRadius: "8px" }}>Adicione câmeras ao projeto para calcular.</div>
              ) : (<>
                <div style={{ ...secT, marginBottom: "6px" }}>Por câmera</div>
                <div style={{ border: `1px solid ${T.borderLight}`, borderRadius: "7px", overflow: "hidden", marginBottom: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px", padding: "5px 9px", background: T.card, fontSize: "9px", fontWeight: 700, color: T.textDim }}>
                    <span>CÂMERA</span><span>BW(Mbps)</span><span>BITRATE</span><span>STORAGE</span>
                  </div>
                  {cams.map((e, i) => (
                    <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px", padding: "5px 9px", background: i % 2 ? T.card : T.white, fontSize: "11px", color: T.text }}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                      <span style={{ color: T.textMuted }}>{((e.cameraSpec.bitrate * e.cameraSpec.fps / 15) / 1000).toFixed(2)}</span>
                      <span style={{ color: T.textMuted }}>{e.cameraSpec.bitrate}k</span>
                      <span style={{ fontWeight: 700, color: T.accent }}>{storages[i].gb.toFixed(1)}GB</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  {[["Câmeras", `${cams.length} ch`, T.text], ["Bandwidth", `${totalBW.toFixed(2)} Mbps`, "#2563eb"], ["Storage", totalGB >= 1000 ? `${(totalGB / 1000).toFixed(2)} TB` : `${totalGB.toFixed(0)} GB`, T.success]].map(([l, v, col]) => (
                    <div key={l} style={{ background: T.card, borderRadius: "8px", padding: "10px", textAlign: "center", border: `1px solid ${T.borderLight}` }}>
                      <div style={{ fontSize: "9px", color: T.textDim, fontWeight: 700, marginBottom: "4px" }}>{l}</div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: col }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "10px", color: T.textDim, background: T.card, borderRadius: "6px", padding: "8px" }}>
                  Sugestão NVR: <strong style={{ color: T.text }}>{cams.length} canais</strong> · HD mínimo: <strong style={{ color: T.text }}>{totalGB >= 1000 ? `${(totalGB / 1000).toFixed(1)} TB` : `${Math.ceil(totalGB / 500) * 500} GB`}</strong> ({calcDays} dias · {calcHours}h/dia)
                </div>
              </>)}
              <button onClick={() => setCalcModal(false)} style={{ marginTop: "14px", width: "100%", padding: "9px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: T.accent, color: "#fff" }}>Fechar</button>
            </div>
          </div>
        );
      })()}

      {/* ═══ AUTH GATE — não logado ═══ */}
      {authLoaded && !user && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(15,23,42,0.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "40px 48px", maxWidth: "440px", width: "90%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ width: "56px", height: "56px", background: "#2563eb", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>NetPlanner</h2>
            <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#64748b" }}>Editor profissional de plantas de redes CFTV e infraestrutura.</p>
            <p style={{ margin: "0 0 28px", fontSize: "13px", color: "#94a3b8" }}>Assine um dos planos para ter acesso completo ao sistema.</p>
            <button onClick={() => setAuthModal(true)} style={{ width: "100%", padding: "13px", borderRadius: "10px", border: "none", cursor: "pointer", background: "#2563eb", color: "#fff", fontSize: "15px", fontWeight: 700, boxShadow: "0 4px 12px rgba(37,99,235,0.35)", marginBottom: "12px" }}>
              Entrar / Criar conta
            </button>
            <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>Ao continuar você concorda com os Termos de Uso.</p>
          </div>
        </div>
      )}

      {/* ═══ PLAN GATE — logado mas sem plano pago ═══ */}
      {authLoaded && user && profile && profile.plan === "free" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99997, background: "rgba(15,23,42,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "36px 44px", maxWidth: "480px", width: "90%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>Acesso restrito</h2>
            <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#64748b" }}>
              Olá, <strong>{user.email?.split("@")[0]}</strong>! Para acessar o NetPlanner é necessário um plano ativo.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#94a3b8" }}>Escolha o plano ideal para o seu perfil:</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "center" }}>
              {[
                { id: "basic",      label: "Básico",  price: "R$79/mês",  projects: "10 projetos",  priceId: "price_basic"      },
                { id: "pro",        label: "Pro",      price: "R$149/mês", projects: "Ilimitado",    priceId: "price_pro", highlight: true },
                { id: "enterprise", label: "Empresa",  price: "R$299/mês", projects: "Ilimitado",    priceId: "price_enterprise" },
              ].map(plan => (
                <div key={plan.id} onClick={() => handleSubscribe(plan.priceId, plan.id)} style={{ flex: 1, border: plan.highlight ? "2px solid #2563eb" : "1.5px solid #e2e8f0", borderRadius: "10px", padding: "14px 10px", cursor: "pointer", background: plan.highlight ? "#eff6ff" : "#fff", transition: "box-shadow .15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,0.15)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                  {plan.highlight && <div style={{ fontSize: "9px", fontWeight: 700, color: "#2563eb", letterSpacing: "0.05em", marginBottom: "6px" }}>MAIS POPULAR</div>}
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>{plan.label}</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#2563eb", marginBottom: "4px" }}>{plan.price}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{plan.projects}</div>
                </div>
              ))}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#94a3b8" }}>7 dias grátis · Cancele quando quiser</p>
            <button onClick={() => signOut()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#94a3b8", textDecoration: "underline" }}>
              Sair da conta
            </button>
          </div>
        </div>
      )}

      {/* ═══ AUTH / CLOUD MODALS ═══ */}
      {authModal && <AuthModal onClose={() => setAuthModal(false)} />}
      {plansModal && <PlansModal currentPlan={profile?.plan || "free"} user={user} onClose={() => setPlansModal(false)} onSubscribe={handleSubscribe} />}
      {projectsModal && user && <ProjectsModal user={user} profile={profile} onClose={() => setProjectsModal(false)} onLoad={cloudLoad} onNew={() => { setPages([makeBlankPage("page-1", "Pavimento 1")]); setCurrentPageId("page-1"); setProjectName("Novo Projeto"); setCloudProjectId(null); }} currentProjectId={cloudProjectId} />}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 99999, padding: "11px 16px", borderRadius: "9px", background: toast.type === "error" ? "#dc2626" : toast.type === "success" ? "#059669" : "#1e293b", color: "#fff", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "8px", maxWidth: "320px", animation: "fadeInToast .2s ease" }}>
          <span>{toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "ℹ"}</span>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", marginLeft: "4px", padding: 0, display: "flex" }}><X size={13} /></button>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.7;transform:scale(1.15)}}@keyframes fadeInToast{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}input[type=range]{height:4px}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}`}</style>
    </div>
  );
}
