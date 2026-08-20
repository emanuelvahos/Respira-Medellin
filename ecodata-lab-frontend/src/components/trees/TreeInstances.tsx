"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  computeThreeCameraPose,
  lonLatToLocalMeters,
  type MapCameraState,
} from "@/lib/map/mapboxThreeSync";

export type TreePoint = {
  lon: number;
  lat: number;
  kind: "existing" | "recommended";
  /** Especie/estado reales del SAU, solo para `kind: "existing"` (ver
   * `MapCanvas.tsx`) — `kind: "recommended"` no tiene árbol real todavía,
   * así que estos campos quedan `undefined`. */
  especie?: string | null;
  nombreComun?: string | null;
  estado?: string | null;
};

/** Reposiciona la cámara three.js en cada cambio de estado de la cámara de Mapbox. */
function CameraRig({
  origin,
  cameraState,
}: {
  origin: [number, number];
  cameraState: MapCameraState;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const pose = computeThreeCameraPose(cameraState, origin, size.height);
    /* eslint-disable react-hooks/immutability --
       Mutar la cámara three.js in-place es el patrón estándar de R3F (la
       misma técnica que usa internamente drei's <PerspectiveCamera makeDefault>);
       no hay forma idiomática de "reemplazar" la cámara del contexto R3F. */
    camera.position.set(...pose.position);
    camera.fov = pose.fovDeg;
    camera.near = 1;
    camera.far = pose.position[1] * 4 + 1000;
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    /* eslint-enable react-hooks/immutability */
  }, [camera, cameraState, origin, size.height]);

  return null;
}

// Dimensiones de árbol real (~4-6m) son sub-píxel a la resolución de suelo
// del flyTo de comuna (~0.7 m/px a zoom ~17.8): confirmado con un diagnóstico
// visual de esferas de prueba (geometría/cámara/posiciones correctas, el
// modelo real simplemente era demasiado chico para ese punto de vista). Se
// escalan ~4x como marcador estilizado, no como tamaño real de árbol.
const TRUNK_HEIGHT = 15;
const TRUNK_RADIUS = 1.5;
const CANOPY_HEIGHT = 22;
const CANOPY_RADIUS = 9;
const GROWTH_DURATION_S = 0.9;
const GROWTH_STAGGER_S = 0.6;

// Colores planos (no derivados de tokens CSS ni de instanceColor): se
// confirmó visualmente con esferas de prueba que `setColorAt`/`instanceColor`
// en este InstancedMesh no se refleja en el render (queda con el color base
// del material, que con meshStandardMaterial + luces del canvas se veía casi
// negro contra el basemap oscuro de Mapbox). Separar las copas en dos
// InstancedMesh con color uniforme por `material.color` evita ese mecanismo
// roto y garantiza que el color se aplique.
const EXISTING_CANOPY_COLOR = "#22c55e";
const RECOMMENDED_CANOPY_COLOR = "#eab308";
const TRUNK_COLOR = "#8a5a35";

function useGrowthAnimation(
  count: number,
  reducedMotion: boolean,
  applyMatrices: (progress: Float32Array) => void,
) {
  const progressRef = useRef<Float32Array>(new Float32Array(0));
  const doneRef = useRef(false);

  useEffect(() => {
    progressRef.current = new Float32Array(count).fill(reducedMotion ? 1 : 0);
    doneRef.current = reducedMotion;
    applyMatrices(progressRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyMatrices se recrea cada render; solo debe re-ejecutar con count/reducedMotion.
  }, [count, reducedMotion]);

  useFrame((_, delta) => {
    if (doneRef.current || reducedMotion) return;
    let stillAnimating = false;
    const progress = progressRef.current;

    // Escalonado por índice: los árboles más tardíos crecen más despacio en
    // vez de esperar un delay explícito, para no tener que rastrear tiempo
    // transcurrido por instancia — visualmente equivalente a un "wave" de
    // crecimiento y más barato de calcular por frame.
    for (let i = 0; i < count; i += 1) {
      if (progress[i] >= 1) continue;
      const staggerFactor = (i / Math.max(1, count)) * GROWTH_STAGGER_S;
      progress[i] = Math.min(1, progress[i] + delta / (GROWTH_DURATION_S + staggerFactor));
      stillAnimating = true;
    }

    applyMatrices(progress);
    if (!stillAnimating) doneRef.current = true;
  });
}

function TreeGroup({
  points,
  origin,
  reducedMotion,
}: {
  points: TreePoint[];
  origin: [number, number];
  reducedMotion: boolean;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const existingCanopyRef = useRef<THREE.InstancedMesh>(null);
  const recommendedCanopyRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // computeThreeCameraPose posiciona la cámara con z = -norte (ver
  // mapboxThreeSync.ts); los árboles deben usar la misma convención o
  // quedan reflejados norte<->sur respecto a donde mira la cámara.
  const localPositions = useMemo(
    () =>
      points.map((p) => {
        const [east, north] = lonLatToLocalMeters(origin, [p.lon, p.lat]);
        return [east, -north] as [number, number];
      }),
    [points, origin],
  );

  const existingIndices = useMemo(
    () => points.map((p, i) => i).filter((i) => points[i].kind === "existing"),
    [points],
  );
  const recommendedIndices = useMemo(
    () => points.map((p, i) => i).filter((i) => points[i].kind === "recommended"),
    [points],
  );

  const applyMatrices = (progress: Float32Array) => {
    const setInstance = (
      mesh: THREE.InstancedMesh | null,
      idx: number,
      pointIdx: number,
      height: number,
    ) => {
      if (!mesh) return;
      const [x, z] = localPositions[pointIdx];
      const scale = Math.max(0.001, progress[pointIdx]);
      dummy.position.set(x, (height / 2) * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    };

    points.forEach((_, i) => setInstance(trunkRef.current, i, i, TRUNK_HEIGHT));
    existingIndices.forEach((pointIdx, idx) =>
      setInstance(existingCanopyRef.current, idx, pointIdx, CANOPY_HEIGHT),
    );
    recommendedIndices.forEach((pointIdx, idx) =>
      setInstance(recommendedCanopyRef.current, idx, pointIdx, CANOPY_HEIGHT),
    );

    [trunkRef.current, existingCanopyRef.current, recommendedCanopyRef.current].forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  };

  useGrowthAnimation(points.length, reducedMotion, applyMatrices);

  if (!points.length) return null;

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, points.length]}>
        <cylinderGeometry args={[TRUNK_RADIUS * 0.7, TRUNK_RADIUS, TRUNK_HEIGHT, 6]} />
        <meshBasicMaterial color={TRUNK_COLOR} />
      </instancedMesh>
      {existingIndices.length > 0 && (
        <instancedMesh ref={existingCanopyRef} args={[undefined, undefined, existingIndices.length]}>
          <coneGeometry args={[CANOPY_RADIUS, CANOPY_HEIGHT, 8]} />
          <meshBasicMaterial color={EXISTING_CANOPY_COLOR} />
        </instancedMesh>
      )}
      {recommendedIndices.length > 0 && (
        <instancedMesh
          ref={recommendedCanopyRef}
          args={[undefined, undefined, recommendedIndices.length]}
        >
          <coneGeometry args={[CANOPY_RADIUS, CANOPY_HEIGHT, 8]} />
          <meshBasicMaterial color={RECOMMENDED_CANOPY_COLOR} />
        </instancedMesh>
      )}
    </>
  );
}

export function TreeInstances({
  origin,
  cameraState,
  points,
  reducedMotion,
}: {
  origin: [number, number];
  cameraState: MapCameraState;
  points: TreePoint[];
  reducedMotion: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Canvas
        gl={{ alpha: true, antialias: true }}
        // frameloop "demand" en reduced-motion: solo redibuja si cambian props,
        // sin loop continuo de rAF (menos movimiento y menos consumo de batería).
        frameloop={reducedMotion ? "demand" : "always"}
        // @react-three/fiber pone `pointer-events: auto` inline en su propio
        // canvas y en los divs que crea internamente (para su sistema de
        // raycasting) — SOBRESCRIBE el `pointer-events-none` heredado del div
        // padre de arriba, porque un estilo inline gana a uno heredado. Sin
        // este `style` explícito, este canvas queda encima de deck.gl/Mapbox
        // en el DOM y se traga TODOS los clicks reales del mapa (comunas,
        // zonas de siembra, etc.) mientras los árboles están visibles — bug
        // real encontrado en Fase D.1 al verificar en navegador que el click
        // en una zona de siembra nunca abría su panel estando en modo "Por
        // comuna" (el modo default). El pan/zoom con mouse seguía funcionando
        // porque Mapbox GL escucha en su propio canvas por debajo, pero
        // cualquier interacción por click en deck.gl quedaba bloqueada.
        style={{ pointerEvents: "none" }}
      >
        <CameraRig origin={origin} cameraState={cameraState} />
        <TreeGroup points={points} origin={origin} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
