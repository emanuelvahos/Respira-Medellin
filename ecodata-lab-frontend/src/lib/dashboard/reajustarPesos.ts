import type { PesosAhp } from "@/types/rankingComuna";

type PesoKey = keyof PesosAhp;

/** Mismo orden que `CAMPOS` en AhpScenarioComparator (PM2.5, déficit, área). */
const PESO_KEYS: PesoKey[] = ["pesoPm25", "pesoDeficit", "pesoArea"];

/**
 * Mueve `key` a `nuevoValor` y reajusta los otros dos pesos proporcionalmente
 * para que la suma se mantenga en 1.0 — el segundo se deriva por resta del
 * remanente en vez de redondearse de forma independiente, así la suma queda
 * exacta en punto flotante (el backend valida con tolerancia 1e-6, no admite
 * redondeos sueltos que se salgan de ese margen).
 */
export function reajustarPesos(actual: PesosAhp, key: PesoKey, nuevoValor: number): PesosAhp {
  const clamped = Math.min(1, Math.max(0, nuevoValor));
  const otras = PESO_KEYS.filter((k) => k !== key) as [PesoKey, PesoKey];
  const [k1, k2] = otras;
  const sumaOtras = actual[k1] + actual[k2];
  const remanente = 1 - clamped;

  let v1: number;
  let v2: number;
  if (sumaOtras <= 0) {
    v1 = remanente / 2;
    v2 = remanente - v1;
  } else {
    v1 = (actual[k1] / sumaOtras) * remanente;
    v2 = remanente - v1;
  }

  return { ...actual, [key]: clamped, [k1]: v1, [k2]: v2 } as PesosAhp;
}
