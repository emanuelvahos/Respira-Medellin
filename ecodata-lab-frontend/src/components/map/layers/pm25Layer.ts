import { ScatterplotLayer } from "@deck.gl/layers";
import type { EstacionPM25 } from "@/types/estacionPM25";
import { interpolateTokenRamp } from "@/lib/map/colorTokens";

/**
 * Campo de partículas de PM2.5 (Fase 3), en reemplazo del heatmap estático de
 * Fase 2. Cada estación SIATA genera un anillo de partículas que orbitan su
 * posición real; la concentración de esa estación controla tanto la
 * DENSIDAD (número de partículas) como la VELOCIDAD angular y la amplitud del
 * flujo, dando la sensación de "más partículas moviéndose más rápido" donde
 * el aire está más contaminado.
 *
 * La posición de cada partícula es una función pura de `t` (segundos
 * transcurridos, congelados mientras la animación está en pausa) — no hay
 * estado mutable que mantener entre frames, lo que hace trivial pausar/
 * reanudar y evita divergencias por reconciliación de React.
 */

const MIN_PARTICLES_PER_STATION = 6;
const MAX_PARTICLES_PER_STATION = 48;
const MIN_ORBIT_RADIUS_DEG = 0.0008;
const MAX_ORBIT_RADIUS_DEG = 0.0035;
const MIN_ANGULAR_SPEED = 0.15; // rad/s
const MAX_ANGULAR_SPEED = 0.9; // rad/s

const PM25_COLOR_RAMP_TOKENS = ["data-sky", "warning", "critical"];

export type Pm25Particle = {
  stationId: string;
  lon: number;
  lat: number;
};

type ParticleSeed = {
  stationIdx: number;
  baseAngle: number;
  radiusJitter: number; // 0..1, posición radial relativa dentro del anillo
  phaseJitter: number;
};

export type Pm25ParticleField = {
  seeds: ParticleSeed[];
  stations: EstacionPM25[];
  minValor: number;
  maxValor: number;
};

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

/** Construye los "seeds" deterministas de partículas a partir de las estaciones reales. */
export function buildPm25ParticleField(estaciones: EstacionPM25[]): Pm25ParticleField {
  if (!estaciones.length) {
    return { seeds: [], stations: [], minValor: 0, maxValor: 1 };
  }
  const valores = estaciones.map((e) => e.valor_ug_m3);
  const minValor = Math.min(...valores);
  const maxValor = Math.max(...valores, minValor + 1);

  const seeds: ParticleSeed[] = [];
  estaciones.forEach((estacion, stationIdx) => {
    const n = Math.round(
      mapRange(estacion.valor_ug_m3, minValor, maxValor, MIN_PARTICLES_PER_STATION, MAX_PARTICLES_PER_STATION),
    );
    for (let i = 0; i < n; i += 1) {
      // Semilla pseudoaleatoria determinista (misma estación+índice -> mismo valor),
      // para que el campo no "salte" al recomponerse el layer.
      const seedValue = Math.sin(stationIdx * 97.13 + i * 13.37) * 43758.5453;
      const rand = seedValue - Math.floor(seedValue);
      const seedValue2 = Math.sin(stationIdx * 51.7 + i * 7.91 + 1) * 12345.678;
      const rand2 = seedValue2 - Math.floor(seedValue2);
      seeds.push({
        stationIdx,
        baseAngle: rand * Math.PI * 2,
        radiusJitter: 0.3 + rand2 * 0.7,
        phaseJitter: rand2 * Math.PI * 2,
      });
    }
  });

  return { seeds, stations: estaciones, minValor, maxValor };
}

/** Evalúa la posición de cada partícula del campo en el instante `t` (segundos). */
export function evaluatePm25Particles(field: Pm25ParticleField, t: number): Pm25Particle[] {
  const { seeds, stations, minValor, maxValor } = field;
  const particles: Pm25Particle[] = new Array(seeds.length);

  for (let i = 0; i < seeds.length; i += 1) {
    const seed = seeds[i];
    const estacion = stations[seed.stationIdx];
    const intensity = mapRange(estacion.valor_ug_m3, minValor, maxValor, 0, 1);
    const angularSpeed = mapRange(intensity, 0, 1, MIN_ANGULAR_SPEED, MAX_ANGULAR_SPEED);
    const maxRadius = mapRange(intensity, 0, 1, MIN_ORBIT_RADIUS_DEG, MAX_ORBIT_RADIUS_DEG);
    const radius = maxRadius * seed.radiusJitter * (0.85 + 0.15 * Math.sin(t * 0.5 + seed.phaseJitter));
    const angle = seed.baseAngle + angularSpeed * t;

    particles[i] = {
      stationId: estacion.id,
      lon: estacion.lon + radius * Math.cos(angle),
      lat: estacion.lat + radius * Math.sin(angle) * 0.75, // achatado: Medellín es más angosto en longitud
    };
  }

  return particles;
}

export function createPm25ParticlesLayer({
  particles,
  field,
}: {
  particles: Pm25Particle[];
  field: Pm25ParticleField;
}) {
  if (!particles.length) return null;

  const valorPorEstacion = new Map(field.stations.map((e) => [e.id, e.valor_ug_m3]));

  return new ScatterplotLayer<Pm25Particle>({
    id: "pm25-particles",
    data: particles,
    pickable: false,
    radiusUnits: "pixels",
    getRadius: 2.2,
    getPosition: (d) => [d.lon, d.lat],
    getFillColor: (d) => {
      const valor = valorPorEstacion.get(d.stationId) ?? field.minValor;
      const t = mapRange(valor, field.minValor, field.maxValor, 0, 1);
      return interpolateTokenRamp(PM25_COLOR_RAMP_TOKENS, t, 0.8);
    },
    updateTriggers: {
      getPosition: particles,
    },
  });
}
