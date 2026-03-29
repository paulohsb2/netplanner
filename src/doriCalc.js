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
  detection:      "#86efac",
  observation:    "#fde68a",
  recognition:    "#fb923c",
  identification: "#f87171",
};

export const DORI_LABELS = {
  detection:      "Detecção",
  observation:    "Observação",
  recognition:    "Reconhecimento",
  identification: "Identificação",
};

export const DORI_OPACITIES = {
  detection:      0.18,
  observation:    0.22,
  recognition:    0.26,
  identification: 0.30,
};

export const CAMERA_PRESETS = {
  "720p_2.8mm":  { label: "720p 2.8mm",  resolutionH: 1280, resolutionV: 720,  focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 1024, codec: "H.265" },
  "1080p_2.8mm": { label: "1080p 2.8mm", resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 2048, codec: "H.265" },
  "1080p_4mm":   { label: "1080p 4mm",   resolutionH: 1920, resolutionV: 1080, focalLength: 4.0, sensorWidth: 6.4, fps: 15, bitrate: 2048, codec: "H.265" },
  "1080p_6mm":   { label: "1080p 6mm",   resolutionH: 1920, resolutionV: 1080, focalLength: 6.0, sensorWidth: 6.4, fps: 15, bitrate: 2048, codec: "H.265" },
  "4MP_2.8mm":   { label: "4MP 2.8mm",   resolutionH: 2560, resolutionV: 1440, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 4096, codec: "H.265" },
  "4MP_4mm":     { label: "4MP 4mm",     resolutionH: 2560, resolutionV: 1440, focalLength: 4.0, sensorWidth: 6.4, fps: 15, bitrate: 4096, codec: "H.265" },
  "8MP_2.8mm":   { label: "8MP 2.8mm",   resolutionH: 3840, resolutionV: 2160, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 8192, codec: "H.265" },
  "8MP_4mm":     { label: "8MP 4mm",     resolutionH: 3840, resolutionV: 2160, focalLength: 4.0, sensorWidth: 6.4, fps: 15, bitrate: 8192, codec: "H.265" },
  "custom":      { label: "Personalizado", resolutionH: 1920, resolutionV: 1080, focalLength: 2.8, sensorWidth: 6.4, fps: 15, bitrate: 2048, codec: "H.265" },
};

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
