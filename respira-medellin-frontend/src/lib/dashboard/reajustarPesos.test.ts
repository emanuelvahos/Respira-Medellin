import { describe, expect, it } from "vitest";
import { reajustarPesos } from "./reajustarPesos";
import { PESOS_AHP_ORIGINALES, type PesosAhp } from "@/types/rankingComuna";

function suma(pesos: PesosAhp): number {
  return pesos.pesoPm25 + pesos.pesoDeficit + pesos.pesoArea;
}

describe("reajustarPesos", () => {
  it("keeps the three weights summing to 1.0 after moving one slider", () => {
    const result = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoPm25", 0.6);
    expect(suma(result)).toBeCloseTo(1, 6);
    expect(result.pesoPm25).toBe(0.6);
  });

  it("redistributes the other two weights proportionally to their prior ratio", () => {
    // pesoDeficit:pesoArea starts at 0.35:0.2 (7:4) — that ratio must be
    // preserved in the leftover after pesoPm25 moves.
    const result = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoPm25", 0.7);
    const remanente = 0.3;
    expect(result.pesoDeficit).toBeCloseTo((0.35 / 0.55) * remanente, 6);
    expect(result.pesoArea).toBeCloseTo((0.2 / 0.55) * remanente, 6);
    expect(suma(result)).toBeCloseTo(1, 6);
  });

  it("clamps the moved slider to [0, 1]", () => {
    const overOne = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoArea", 1.5);
    expect(overOne.pesoArea).toBe(1);
    expect(suma(overOne)).toBeCloseTo(1, 6);

    const underZero = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoArea", -0.5);
    expect(underZero.pesoArea).toBe(0);
    expect(suma(underZero)).toBeCloseTo(1, 6);
  });

  it("moving one slider to 1 forces both other sliders to 0", () => {
    const result = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoDeficit", 1);
    expect(result.pesoDeficit).toBe(1);
    expect(result.pesoPm25).toBe(0);
    expect(result.pesoArea).toBe(0);
    expect(suma(result)).toBeCloseTo(1, 6);
  });

  it("splits the remainder evenly when both other sliders start at 0", () => {
    const zeroed: PesosAhp = { pesoPm25: 1, pesoDeficit: 0, pesoArea: 0 };
    const result = reajustarPesos(zeroed, "pesoPm25", 0.4);
    expect(result.pesoDeficit).toBeCloseTo(0.3, 6);
    expect(result.pesoArea).toBeCloseTo(0.3, 6);
    expect(suma(result)).toBeCloseTo(1, 6);
  });

  it("moving a slider to 0 gives the full remainder to the other two proportionally", () => {
    const result = reajustarPesos(PESOS_AHP_ORIGINALES, "pesoPm25", 0);
    expect(result.pesoPm25).toBe(0);
    expect(suma(result)).toBeCloseTo(1, 6);
    expect(result.pesoDeficit).toBeGreaterThan(result.pesoArea);
  });
});
