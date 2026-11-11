import { describe, expect, it } from "vitest";
import { normalizeComunaName } from "./matchComuna";

describe("normalizeComunaName", () => {
  it("uppercases and strips accents", () => {
    expect(normalizeComunaName("Belén")).toBe("BELEN");
  });

  it("is a no-op for already-normalized names", () => {
    expect(normalizeComunaName("LAURELES")).toBe("LAURELES");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeComunaName("  Guayabal  ")).toBe("GUAYABAL");
  });

  it("maps the 'Laureles Estadio' CSV alias to the geojson 'LAURELES' name", () => {
    // Comuna 11: catastral geojson only has "LAURELES", but siembra/PM2.5
    // sources bring it as "Laureles Estadio" / "Laureles - Estadio".
    expect(normalizeComunaName("Laureles Estadio")).toBe("LAURELES");
    expect(normalizeComunaName("LAURELES ESTADIO")).toBe("LAURELES");
  });

  it("does not alter unrelated comuna names that already differ", () => {
    expect(normalizeComunaName("LAURELES")).not.toBe("LAURELES ESTADIO");
  });

  it("normalizes corregimientos with accents and mixed case", () => {
    expect(normalizeComunaName("San Cristóbal")).toBe("SAN CRISTOBAL");
    expect(normalizeComunaName("SAN ANTONIO DE PRADO")).toBe("SAN ANTONIO DE PRADO");
  });

  it("normalizes 'Doce de Octubre' consistently regardless of case", () => {
    expect(normalizeComunaName("Doce de Octubre")).toBe(normalizeComunaName("DOCE DE OCTUBRE"));
  });

  it("normalizes 'La Candelaria' with accented input", () => {
    expect(normalizeComunaName("La Candelaria")).toBe("LA CANDELARIA");
  });

  it("normalizes 'Buenos Aires' and 'Villa Hermosa'", () => {
    expect(normalizeComunaName("Buenos Aires")).toBe("BUENOS AIRES");
    expect(normalizeComunaName("Villa Hermosa")).toBe("VILLA HERMOSA");
  });

  it("strips the 'Corregimiento de' prefix used by salud/población", () => {
    expect(normalizeComunaName("Corregimiento de San Cristóbal")).toBe("SAN CRISTOBAL");
    expect(normalizeComunaName("Corregimiento de Altavista")).toBe("ALTAVISTA");
    expect(normalizeComunaName("Corregimiento de Santa Elena")).toBe("SANTA ELENA");
  });

  it("maps 'Corregimiento de San Sebastián de Palmitas' to the geojson 'PALMITAS' name", () => {
    expect(normalizeComunaName("Corregimiento de San Sebastián de Palmitas")).toBe("PALMITAS");
  });
});
