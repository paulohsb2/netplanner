/**
 * NetPlanner 3D Scene
 * React Three Fiber scene — orbit, zoom, full 3D visualization
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useRef, useMemo, useEffect, useState } from "react";

/* ─── constants ─── */
const S = 0.01;           // 1 pixel = 0.01 world units
const EQ_H = 0.22;        // equipment marker center height
const CONE_H = 4.5;       // camera cone height (ceiling to floor)
const SIZES = { small: 0.16, medium: 0.22, large: 0.30 };

const DORI_ZONES = ["detection", "observation", "recognition", "identification"];
const DORI_COLORS_HEX = {
  detection:      "#86efac",
  observation:    "#fde68a",
  recognition:    "#fb923c",
  identification: "#f87171",
};

const EQUIPMENT = [
  { type: "camera",  color: "#ef4444", layer: "cftv" },
  { type: "wifi",    color: "#3b82f6", layer: "wifi" },
  { type: "switch",  color: "#f59e0b", layer: "rede" },
  { type: "router",  color: "#a855f7", layer: "rede" },
  { type: "nvr",     color: "#10b981", layer: "cftv" },
];

/* ─── camera cone sector geometry ─── */
function buildSectorGeo(radius, height, angleRad, segs = 48) {
  if (angleRad >= Math.PI * 2 - 0.01) {
    return new THREE.ConeGeometry(radius, height, segs, 1, true);
  }
  const steps = Math.max(6, Math.round(segs * angleRad / (Math.PI * 2)));
  const verts = [], idx = [];
  verts.push(0, 0, 0); // tip at index 0
  for (let i = 0; i <= steps; i++) {
    const a = -angleRad / 2 + (angleRad * i / steps);
    verts.push(radius * Math.cos(a), -height, radius * Math.sin(a));
  }
  const cBase = verts.length / 3;
  verts.push(0, -height, 0);
  for (let i = 0; i < steps; i++) {
    idx.push(0, i + 2, i + 1);       // side face
    idx.push(cBase, i + 1, i + 2);   // base cap
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ─── flat sector (floor footprint) ─── */
function buildFloorSectorGeo(radius, angleRad, segs = 48) {
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

/* ─── annular sector (ring between innerR and outerR) ─── */
function buildRingSectorGeo(innerR, outerR, angleRad, segs = 48) {
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

/* ═══════════════════════════════════
   FLOOR PLANE
═══════════════════════════════════ */
function FloorPlane({ bgImage, width, height }) {
  const [tex, setTex] = useState(null);

  useEffect(() => {
    if (!bgImage) { setTex(null); return; }
    const loader = new THREE.TextureLoader();
    loader.load(bgImage, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    });
  }, [bgImage]);

  return (
    <group>
      {/* Base plate — extends beyond image */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.02, height / 2]}>
        <planeGeometry args={[width * 1.6, height * 1.6]} />
        <meshStandardMaterial color="#d1d9e6" roughness={1} />
      </mesh>

      {/* Floor plan image */}
      {tex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, height / 2]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            map={tex}
            transparent
            roughness={0.85}
            metalness={0.0}
            opacity={0.92}
          />
        </mesh>
      )}

      {/* Subtle border glow around floor plan */}
      {tex && (
        <lineSegments position={[width / 2, 0.01, height / 2]}>
          <edgesGeometry
            args={[new THREE.PlaneGeometry(width, height)]}
          />
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.6} />
        </lineSegments>
      )}
    </group>
  );
}

/* ═══════════════════════════════════
   EQUIPMENT 3D BODY
═══════════════════════════════════ */
function EquipBody3D({ type, sz, color, rotY }) {
  const mat = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} metalness={0.3} roughness={0.4} />;
  switch (type) {
    case "camera":
      // Cilindro corpo + lente projetada na direção de rotação
      return (
        <group rotation={[0, rotY, 0]}>
          <mesh userData={{ main: true }} position={[0, sz * 0.35, 0]} castShadow>
            <cylinderGeometry args={[sz * 0.9, sz * 0.9, sz * 0.7, 20]} />
            {mat}
          </mesh>
          {/* Lente frontal */}
          <mesh position={[0, sz * 0.35, sz * 0.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[sz * 0.38, sz * 0.44, sz * 0.55, 14]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      );
    case "wifi":
      // Disco plano (AP de teto)
      return (
        <group>
          <mesh userData={{ main: true }} position={[0, sz * 0.18, 0]} castShadow>
            <cylinderGeometry args={[sz * 1.3, sz * 1.3, sz * 0.35, 28]} />
            {mat}
          </mesh>
          {/* Botão central */}
          <mesh position={[0, sz * 0.38, 0]} castShadow>
            <cylinderGeometry args={[sz * 0.3, sz * 0.3, sz * 0.12, 16]} />
            <meshStandardMaterial color="#fff" metalness={0.2} roughness={0.6} />
          </mesh>
        </group>
      );
    case "switch":
      // Caixa rack plana
      return (
        <mesh userData={{ main: true }} position={[0, sz * 0.2, 0]} castShadow>
          <boxGeometry args={[sz * 2.6, sz * 0.4, sz * 1.2]} />
          {mat}
        </mesh>
      );
    case "router":
      // Caixa + 2 antenas verticais
      return (
        <group>
          <mesh userData={{ main: true }} position={[0, sz * 0.45, 0]} castShadow>
            <boxGeometry args={[sz * 1.9, sz * 0.9, sz * 1.3]} />
            {mat}
          </mesh>
          {[-0.55, 0.55].map((ox, i) => (
            <mesh key={i} position={[sz * ox, sz * 1.6, sz * -0.42]} castShadow>
              <cylinderGeometry args={[sz * 0.09, sz * 0.09, sz * 1.5, 8]} />
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
          ))}
        </group>
      );
    case "nvr":
      // Caixa DVR/NVR
      return (
        <mesh userData={{ main: true }} position={[0, sz * 0.6, 0]} castShadow>
          <boxGeometry args={[sz * 2.4, sz * 1.2, sz * 1.5]} />
          {mat}
        </mesh>
      );
    default:
      return (
        <mesh userData={{ main: true }} position={[0, sz, 0]} castShadow>
          <sphereGeometry args={[sz, 16, 16]} />
          {mat}
        </mesh>
      );
  }
}

/* ═══════════════════════════════════
   EQUIPMENT MARKER
═══════════════════════════════════ */
function EquipMarker({ el, color, selected, onSelect }) {
  const x = el.x * S;
  const z = el.y * S;
  const sz = SIZES[el.size || "medium"];
  const bodyRef = useRef();
  const ringRef = useRef();
  const rotY = -((el.rotation || 0) * Math.PI) / 180;

  useFrame(({ clock }) => {
    if (!bodyRef.current) return;
    const t = clock.elapsedTime;
    const intensity = selected
      ? 0.5 + 0.2 * Math.sin(t * 3.5)
      : 0.15 + 0.07 * Math.sin(t * 1.5);
    bodyRef.current.traverse((obj) => {
      if (obj.isMesh && obj.userData.main && obj.material?.emissive) {
        obj.material.emissiveIntensity = intensity;
      }
    });
    if (ringRef.current) {
      ringRef.current.material.opacity = 0.4 + 0.35 * Math.sin(t * 3.5);
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[sz * 1.3, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.15} depthWrite={false} />
      </mesh>

      {/* Equipment 3D body */}
      <group ref={bodyRef} onClick={(e) => { e.stopPropagation(); onSelect(el.id); }}>
        <EquipBody3D type={el.type} sz={sz} color={color} rotY={rotY} />
      </group>

      {/* Selection ring */}
      {selected && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[sz * 1.5, sz * 2.0, 36]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}

      {/* Label */}
      <Html position={[0, sz * 2.0, 0]} center zIndexRange={[100, 200]} occlude={false}>
        <div style={{
          background: "rgba(15,20,40,0.82)",
          color: "#f1f5f9",
          padding: "2px 7px",
          borderRadius: "4px",
          fontSize: "10px",
          fontWeight: 700,
          whiteSpace: "nowrap",
          border: `1px solid ${color}50`,
          fontFamily: "system-ui,sans-serif",
          pointerEvents: "none",
          letterSpacing: "0.2px",
          transform: "scale(0.85)",
        }}>
          {el.label}
        </div>
      </Html>
    </group>
  );
}

/* ═══════════════════════════════════
   CAMERA / CFTV COVERAGE CONE
═══════════════════════════════════ */
/* Volume cone for one DORI zone (no floor — rendered separately) */
function DoriConeZone({ radius, angleRad, color }) {
  const geo = useMemo(() => buildSectorGeo(radius, CONE_H, angleRad), [radius, angleRad]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/* Annular ring sectors on the floor for each DORI zone */
function DoriFloorRings({ detR, obsR, recR, idR, fovRad }) {
  const rings = useMemo(() => [
    { color: DORI_COLORS_HEX.detection,      outer: detR, inner: obsR },
    { color: DORI_COLORS_HEX.observation,    outer: obsR, inner: recR },
    { color: DORI_COLORS_HEX.recognition,    outer: recR, inner: idR  },
    { color: DORI_COLORS_HEX.identification, outer: idR,  inner: 0    },
  ], [detR, obsR, recR, idR]);

  return (
    <group position={[0, -CONE_H + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map(({ color, outer, inner }) => {
        if (outer <= 0) return null;
        const geo = inner > 0.001
          ? buildRingSectorGeo(inner, outer, fovRad)
          : buildFloorSectorGeo(outer, fovRad);
        return (
          <mesh key={color} geometry={geo}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.72} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function CameraCone({ el, color, scale }) {
  const x = el.x * S;
  const z = el.y * S;
  const rotY = -((el.rotation || 0) * Math.PI) / 180;
  const fovRad = ((el.cameraSpec?.fovH || el.angle || 90) * Math.PI) / 180;
  // Detection zone = el.radius pixels → world units
  const detR = (el.radius || 80) * S;
  // Always declare hooks unconditionally
  const sideGeo = useMemo(() => buildSectorGeo(detR, CONE_H, fovRad), [detR, fovRad]);
  const footGeo = useMemo(() => buildFloorSectorGeo(detR, fovRad), [detR, fovRad]);

  if (el.cameraSpec?.doriDistances) {
    const dists = el.cameraSpec.doriDistances;
    const detDist = dists.detection;
    // Scale zone radii proportionally relative to el.radius (user-controlled visual size)
    const zR = (zone) => detR * (dists[zone] / detDist);
    return (
      <group position={[x, CONE_H, z]} rotation={[0, rotY, 0]}>
        {/* Volume cones — outermost to innermost so inner colours blend nicely */}
        {DORI_ZONES.map(zone => (
          <DoriConeZone key={zone} radius={zR(zone)} angleRad={fovRad} color={DORI_COLORS_HEX[zone]} />
        ))}
        {/* Floor ring sectors — clearly distinct colour bands */}
        <DoriFloorRings
          detR={zR("detection")}
          obsR={zR("observation")}
          recR={zR("recognition")}
          idR={zR("identification")}
          fovRad={fovRad}
        />
      </group>
    );
  }

  return (
    <group position={[x, CONE_H, z]} rotation={[0, rotY, 0]}>
      <mesh geometry={sideGeo}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={sideGeo}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} transparent opacity={0.35} wireframe depthWrite={false} />
      </mesh>
      <mesh geometry={footGeo} position={[0, -CONE_H + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════
   WIFI / AP COVERAGE RINGS
═══════════════════════════════════ */
function WifiRings({ el, color }) {
  const x = el.x * S;
  const z = el.y * S;
  const radius = (el.radius || 120) * S;
  const ringsRef = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ringsRef.current.forEach((m, i) => {
      if (m) m.material.opacity = 0.45 + 0.15 * Math.sin(t * 1.8 + i * 1.2);
    });
  });

  const rings = [1, 0.66, 0.33];

  return (
    <group position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Filled disk */}
      <mesh>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Concentric glowing rings */}
      {rings.map((r, i) => (
        <mesh
          key={i}
          ref={(m) => (ringsRef.current[i] = m)}
        >
          <ringGeometry
            args={[radius * r - 0.05, radius * r, 72]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.0}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════
   CONNECTION CABLE LINE
═══════════════════════════════════ */
function CableLine({ from, to }) {
  const p1 = useMemo(
    () => new THREE.Vector3(from.x * S, 0.08, from.y * S),
    [from.x, from.y]
  );
  const p2 = useMemo(
    () => new THREE.Vector3(to.x * S, 0.08, to.y * S),
    [to.x, to.y]
  );

  return (
    <Line
      points={[p1, p2]}
      color="#475569"
      lineWidth={1.2}
      dashed
      dashSize={0.14}
      gapSize={0.08}
    />
  );
}

/* ═══════════════════════════════════
   MEASURE LINE 3D
═══════════════════════════════════ */
function MeasureLine3D({ ml, metricScale }) {
  const p1v = useMemo(
    () => new THREE.Vector3(ml.p1.x * S, 0.12, ml.p1.y * S),
    [ml.p1.x, ml.p1.y]
  );
  const p2v = useMemo(
    () => new THREE.Vector3(ml.p2.x * S, 0.12, ml.p2.y * S),
    [ml.p2.x, ml.p2.y]
  );
  const mid = useMemo(
    () => new THREE.Vector3().addVectors(p1v, p2v).multiplyScalar(0.5),
    [p1v, p2v]
  );
  const label = `${(ml.dist * metricScale).toFixed(1)}m`;

  return (
    <>
      <Line
        points={[p1v, p2v]}
        color="#f59e0b"
        lineWidth={1.8}
        dashed
        dashSize={0.1}
        gapSize={0.06}
      />
      {[p1v, p2v].map((p, i) => (
        <mesh key={i} position={p.toArray()}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
      <Html
        position={mid.toArray()}
        center
        distanceFactor={12}
        zIndexRange={[50, 100]}
      >
        <div
          style={{
            background: "rgba(10,15,30,0.9)",
            color: "#fbbf24",
            padding: "2px 7px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 700,
            border: "1px solid #f59e0b50",
            fontFamily: "system-ui,sans-serif",
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      </Html>
    </>
  );
}

/* ═══════════════════════════════════
   EMPTY STATE
═══════════════════════════════════ */
function EmptyPrompt() {
  return (
    <Html position={[0, 0, 0]} center fullscreen>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(15,23,42,0.85)",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px 40px",
            textAlign: "center",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌐</div>
          <div
            style={{
              color: "#e2e8f0",
              fontSize: "16px",
              fontWeight: 700,
              marginBottom: "8px",
              fontFamily: "system-ui,sans-serif",
            }}
          >
            Modo 3D
          </div>
          <div
            style={{
              color: "#64748b",
              fontSize: "13px",
              fontFamily: "system-ui,sans-serif",
            }}
          >
            Carregue uma planta e adicione equipamentos no modo 2D
            <br />
            para visualizar aqui em 3D
          </div>
        </div>
      </div>
    </Html>
  );
}

/* ═══════════════════════════════════
   MAIN SCENE
═══════════════════════════════════ */
export default function Scene3D({
  page,
  elements,
  connections,
  measureLines,
  scale,
  showCoverage,
  showCables,
  layerVisibility,
  selectedId,
  onSelect,
}) {
  const bgW = (page?.bgNatural?.w || 800) * S;
  const bgH = (page?.bgNatural?.h || 600) * S;
  const hasContent = page?.bgImage || elements.length > 0;

  const visibleEls = elements.filter((el) => {
    const eq = EQUIPMENT.find((e) => e.type === el.type);
    return eq && layerVisibility[eq.layer] !== false;
  });

  // Camera start position: isometric angle
  const camPos = useMemo(
    () => [bgW * 0.5, Math.max(bgW, bgH) * 0.5, bgH * 0.95],
    [bgW, bgH]
  );
  const target = useMemo(() => [bgW / 2, 0, bgH / 2], [bgW, bgH]);

  return (
    <Canvas
      style={{ width: "100%", height: "100%", background: "#e8ecf1" }}
      camera={{ position: camPos, fov: 48, near: 0.01, far: 1000 }}
      shadows={{ type: THREE.PCFShadowMap }}
    >
      <color attach="background" args={["#e8ecf1"]} />
      <fog attach="fog" args={["#e8ecf1", bgW * 5, bgW * 14]} />

      {/* Lighting */}
      <ambientLight intensity={1.2} color="#ffffff" />
      <directionalLight
        position={[bgW, bgW * 1.5, bgH]}
        intensity={1.0}
        color="#ffffff"
        castShadow
      />
      <pointLight
        position={[bgW / 2, bgW * 0.4, bgH / 2]}
        intensity={0.3}
        color="#dbeafe"
        distance={bgW * 3}
      />

      {/* Controls */}
      <OrbitControls
        target={target}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={0.5}
        maxDistance={bgW * 5}
        enableDamping
        dampingFactor={0.06}
      />

      {/* Floor */}
      <FloorPlane bgImage={page?.bgImage} width={bgW} height={bgH} />

      {/* Grid */}
      <gridHelper
        args={[
          Math.max(bgW, bgH) * 2,
          28,
          "#b0baca",
          "#c8d0dc",
        ]}
        position={[bgW / 2, -0.005, bgH / 2]}
      />

      {!hasContent && <EmptyPrompt />}

      {/* Equipment markers */}
      {visibleEls.map((el) => {
        const eq = EQUIPMENT.find((e) => e.type === el.type);
        const color = el.customColor || eq.color;
        return (
          <EquipMarker
            key={el.id}
            el={el}
            color={color}
            selected={selectedId === el.id}
            onSelect={onSelect}
          />
        );
      })}

      {/* Coverage zones */}
      {showCoverage &&
        visibleEls
          .filter((el) => el.radius > 0 && el.angle > 0)
          .map((el) => {
            const eq = EQUIPMENT.find((e) => e.type === el.type);
            const color = el.customColor || eq.color;
            if (el.type === "camera" || el.type === "nvr") {
              return <CameraCone key={`cov-${el.id}`} el={el} color={color} scale={scale} />;
            }
            return <WifiRings key={`cov-${el.id}`} el={el} color={color} />;
          })}

      {/* Cables */}
      {showCables &&
        connections.map((cn) => {
          const from = elements.find((e) => e.id === cn.from);
          const to = elements.find((e) => e.id === cn.to);
          if (!from || !to) return null;
          return <CableLine key={cn.id} from={from} to={to} />;
        })}

      {/* Measure lines */}
      {measureLines.map((ml, i) => (
        <MeasureLine3D key={i} ml={ml} metricScale={scale} />
      ))}

    </Canvas>
  );
}
