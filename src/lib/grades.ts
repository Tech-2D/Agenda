export type Situation = "aprovado" | "aprovado-rec" | "recuperacao" | "reprovado" | "andamento" | "sem-notas";

export interface Result {
  recovered: number | null;   // média recuperada (só quando 2º sem > 1º)
  annual: number | null;
  needed: number | null;      // nota necessária na recuperação final
  final: number | null;
  situation: Situation;
}

export const ANNUAL_PASS = 7;
export const FINAL_PASS = 6;
export const RECOVERED_CAP = 7;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Média anual = (M1 + M2 × 2) / 3. Com só o 1º semestre, a anual é a própria M1. */
export function calculate(m1: number | null, m2: number | null, rec: number | null): Result {
  if (m1 === null && m2 === null) {
    return { recovered: null, annual: null, needed: null, final: null, situation: "sem-notas" };
  }
  if (m2 === null) {
    const annual = m1!;
    return { recovered: null, annual, needed: null, final: null, situation: "andamento" };
  }
  const first = m1 ?? 0;
  // Se o 2º semestre supera o 1º, a média recuperada passa a compor a anual (teto 7,00).
  // Ela só substitui o 1º semestre quando aumenta a nota: com M1 ≥ 7 o teto nunca pode rebaixá-la.
  const candidate = round2(Math.min((first + m2) / 2, RECOVERED_CAP));
  const recovered = m2 > first && candidate > first ? candidate : null;
  const annual = round2(((recovered ?? first) + m2 * 2) / 3);

  if (annual >= ANNUAL_PASS) {
    return { recovered, annual, needed: null, final: null, situation: "aprovado" };
  }
  const needed = Math.max(0, round2(FINAL_PASS * 2 - annual));
  if (rec === null) {
    return { recovered, annual, needed, final: null, situation: "recuperacao" };
  }
  const final = round2((rec + annual) / 2);
  return { recovered, annual, needed, final, situation: final >= FINAL_PASS ? "aprovado-rec" : "reprovado" };
}

export const fmt = (n: number | null) => (n === null ? "-" : n.toFixed(2).replace(".", ","));

export function parseGrade(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.min(10, Math.max(0, n));
}
