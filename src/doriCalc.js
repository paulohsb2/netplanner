/**
 * DORI Calculation Engine — NetPlanner
 * EN 62676-4: Detection/Observation/Recognition/Identification
 */

/** FoV horizontal in degrees from lens/sensor params */
export function calcFovH(sensorWidth, focalLength) {
  return 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI);
}

/** Distance in metres at which camera achieves targetPPM pixels-per-metre */
export function doriDistance(resolutionH, fovH, targetPPM) {
  const fovRad = fovH * (Math.PI / 180);
  return resolutionH / (2 * targetPPM * Math.tan(fovRad / 2));
}

export const DORI_THRESHOLDS = {
  detection:      25,
  observation:    62.5,
  recognition:    125,
  identification: 250,
};

export const DORI_ZONES = ["detection", "observation", "recognition", "identification"];

export const DORI_COLORS = {
  detection:      "#4ade80",
  observation:    "#facc15",
  recognition:    "#f97316",
  identification: "#f43f5e",
};

export const DORI_LABELS = {
  detection:      "Detecção",
  observation:    "Observação",
  recognition:    "Reconhecimento",
  identification: "Identificação",
};

export const DORI_OPACITIES = {
  detection:      0.28,
  observation:    0.34,
  recognition:    0.40,
  identification: 0.48,
};

/* ─── Generic presets ─── */
const GENERIC = {
  "720p_2.8mm":  { label: "720p — 2.8mm",  resolutionH: 1280, resolutionV: 720,  focalLength: 2.8, sensorWidth: 6.4, fps: 20, bitrate: 1024, codec: "H.265" },
  "1080p_2.8mm": { label: "1080p — 2.8mm", resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 20, bitrate: 2048, codec: "H.265" },
  "1080p_3.6mm": { label: "1080p — 3.6mm", resolutionH: 1920, resolutionV: 1080, focalLength: 3.6, sensorWidth: 6.4, fps: 20, bitrate: 2048, codec: "H.265" },
  "1080p_4mm":   { label: "1080p — 4mm",   resolutionH: 1920, resolutionV: 1080, focalLength: 4.0, sensorWidth: 6.4, fps: 20, bitrate: 2048, codec: "H.265" },
  "1080p_6mm":   { label: "1080p — 6mm",   resolutionH: 1920, resolutionV: 1080, focalLength: 6.0, sensorWidth: 6.4, fps: 20, bitrate: 2048, codec: "H.265" },
  "4MP_2.8mm":   { label: "4MP — 2.8mm",   resolutionH: 2560, resolutionV: 1440, focalLength: 2.8, sensorWidth: 6.4, fps: 20, bitrate: 4096, codec: "H.265" },
  "4MP_4mm":     { label: "4MP — 4mm",     resolutionH: 2560, resolutionV: 1440, focalLength: 4.0, sensorWidth: 6.4, fps: 20, bitrate: 4096, codec: "H.265" },
  "8MP_2.8mm":   { label: "8MP — 2.8mm",   resolutionH: 3840, resolutionV: 2160, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 8192, codec: "H.265" },
  "8MP_4mm":     { label: "8MP — 4mm",     resolutionH: 3840, resolutionV: 2160, focalLength: 4.0, sensorWidth: 6.4, fps: 15, bitrate: 8192, codec: "H.265" },
  "custom":      { label: "Personalizado",  resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 20, bitrate: 2048, codec: "H.265" },
};

/**
 * Intelbras IP camera lineup (specs baseados nos datasheets 2024/2025).
 * Sensor width: 1/4"=3.6mm, 1/3"=4.8mm, 1/2.9"=5.4mm, 1/2.8"=6.4mm, 1/2.7"=6.0mm
 * Verifique o datasheet do modelo específico para confirmar os valores.
 */
const INTELBRAS = {
  /* ── Série VIP 1xxx (entrada) ── */
  "itl_vip1020d":    { label: "VIP 1020 D (720p 3.6mm)",        resolutionH: 1280, resolutionV: 720,  focalLength: 3.6, sensorWidth: 3.6, fps: 25, bitrate: 1024, codec: "H.265" },
  "itl_vip1120d":    { label: "VIP 1120 D (1080p 3.6mm)",       resolutionH: 1920, resolutionV: 1080, focalLength: 3.6, sensorWidth: 5.4, fps: 25, bitrate: 2048, codec: "H.265" },
  "itl_vip1220d_36": { label: "VIP 1220 D (1080p 3.6mm)",       resolutionH: 1920, resolutionV: 1080, focalLength: 3.6, sensorWidth: 6.4, fps: 25, bitrate: 2048, codec: "H.265" },
  "itl_vip1220d_28": { label: "VIP 1220 D (1080p 2.8mm)",       resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 25, bitrate: 2048, codec: "H.265" },
  /* ── Série VIP 3xxx (intermediária) ── */
  "itl_vip3230d":    { label: "VIP 3230 D Full Color (2MP)",     resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 20, bitrate: 4096, codec: "H.265" },
  "itl_vip3240d":    { label: "VIP 3240 D (4MP 2.8mm)",          resolutionH: 2560, resolutionV: 1440, focalLength: 2.8, sensorWidth: 4.8, fps: 20, bitrate: 6144, codec: "H.265" },
  "itl_vip3240d_4":  { label: "VIP 3240 D (4MP 4mm)",            resolutionH: 2560, resolutionV: 1440, focalLength: 4.0, sensorWidth: 4.8, fps: 20, bitrate: 6144, codec: "H.265" },
  "itl_vip3250d":    { label: "VIP 3250 D (5MP 2.8mm)",          resolutionH: 2592, resolutionV: 1944, focalLength: 2.8, sensorWidth: 6.0, fps: 15, bitrate: 8192, codec: "H.265" },
  "itl_vip3280d":    { label: "VIP 3280 D (8MP/4K 2.8mm)",       resolutionH: 3840, resolutionV: 2160, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 10240, codec: "H.265" },
  "itl_vip3280d_4":  { label: "VIP 3280 D (8MP/4K 4mm)",         resolutionH: 3840, resolutionV: 2160, focalLength: 4.0, sensorWidth: 6.4, fps: 15, bitrate: 10240, codec: "H.265" },
  "itl_vip3430d":    { label: "VIP 3430 D Full Color (4MP)",      resolutionH: 2560, resolutionV: 1440, focalLength: 2.8, sensorWidth: 4.8, fps: 15, bitrate: 6144, codec: "H.265" },
  "itl_vip3450d":    { label: "VIP 3450 D Full Color (5MP)",      resolutionH: 2592, resolutionV: 1944, focalLength: 2.8, sensorWidth: 6.0, fps: 15, bitrate: 8192, codec: "H.265" },
  /* ── Mini bullets / Bullet externo ── */
  "itl_vip1020b":    { label: "VIP 1020 B Bullet (720p 3.6mm)",  resolutionH: 1280, resolutionV: 720,  focalLength: 3.6, sensorWidth: 3.6, fps: 25, bitrate: 1024, codec: "H.265" },
  "itl_vip1220b":    { label: "VIP 1220 B Bullet (1080p 3.6mm)", resolutionH: 1920, resolutionV: 1080, focalLength: 3.6, sensorWidth: 6.4, fps: 25, bitrate: 2048, codec: "H.265" },
  "itl_vip3280b":    { label: "VIP 3280 B Bullet (8MP/4K)",       resolutionH: 3840, resolutionV: 2160, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 10240, codec: "H.265" },
};

export const CAMERA_PRESETS = { ...GENERIC, ...INTELBRAS };

/**
 * Groups for the preset <select> UI.
 * Each entry: { label: string, keys: string[] }
 */
export const PRESET_GROUPS = [
  { label: "Genéricos",          keys: Object.keys(GENERIC).filter(k => k !== "custom") },
  { label: "Intelbras",          keys: Object.keys(INTELBRAS) },
  { label: "Personalizado",      keys: ["custom"] },
];

/** Recalculate fovH + doriDistances from spec fields */
export function calcAllDori(spec) {
  const fovH = calcFovH(spec.sensorWidth, spec.focalLength);
  const distances = {};
  for (const [zone, ppm] of Object.entries(DORI_THRESHOLDS)) {
    distances[zone] = doriDistance(spec.resolutionH, fovH, ppm);
  }
  return { fovH, distances };
}

/** Build a fully initialised cameraSpec using the default 1080p 2.8mm preset */
export function defaultCameraSpec() {
  const p = CAMERA_PRESETS["1080p_2.8mm"];
  const { fovH, distances } = calcAllDori(p);
  return {
    preset: "1080p_2.8mm",
    resolutionH: p.resolutionH,
    resolutionV: p.resolutionV,
    focalLength: p.focalLength,
    sensorWidth: p.sensorWidth,
    fps: p.fps,
    bitrate: p.bitrate,
    codec: p.codec,
    fovH,
    doriDistances: distances,
  };
}

/**
 * Storage estimate in GB for one camera stream.
 * bitrate_kbps × 1000 b/kb × 3600 s/h × hours × days / (8 b/B × 1e9 B/GB)
 */
export function calcStorage(bitrate_kbps, fps, hours_per_day, retention_days) {
  return (bitrate_kbps * 1000 * 3600 * hours_per_day * retention_days) / (8 * 1e9);
}
