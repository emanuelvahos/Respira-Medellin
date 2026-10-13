import { describe, expect, it } from "vitest";
import { puntosIndicativosSchema, zonaAptitudSchema } from "@/types/aptitud";

describe("zonaAptitudSchema", () => {
  const base = {
    id_poligono: 1,
    aptitud: "apta_con_condiciones",
    motivos_no_apta: [],
    condiciones: ["Franja de seguridad"],
    metricas: {
      pendiente_media_grados: 12.3,
      pendiente_p90_grados: 18,
      fraccion_amenaza_mov_masa_alta: 0,
      fraccion_amenaza_inundacion_alta: 0,
      fraccion_amenaza_torrencial_alta: 0,
      fraccion_riesgo_no_mitigable: 0,
      fraccion_retiro_quebrada: 0.2,
      fraccion_franja_tension: 0,
      anden_ancho_m: null,
      redes_cercanas: ["Acueducto"],
    },
    razones_especie: ["x"],
    puntos_indicativos: 0,
    cupo_estimado_previo: 4,
    puntos_publicos: false,
    avisos: ["a"],
    fecha_consulta: "2026-10-13",
  };
  it("acepta una respuesta válida", () => {
    expect(zonaAptitudSchema.parse(base).aptitud).toBe("apta_con_condiciones");
  });
  it("rechaza una aptitud desconocida", () => {
    expect(() => zonaAptitudSchema.parse({ ...base, aptitud: "quizas" })).toThrow();
  });
  it("valida puntos indicativos", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-75.5, 6.2] },
          properties: { id_poligono: 1, n: 1, especie: "Suribio", nombre_cientifico: "Zygia longifolia" },
        },
      ],
    };
    expect(puntosIndicativosSchema.parse(fc).features).toHaveLength(1);
  });
});
